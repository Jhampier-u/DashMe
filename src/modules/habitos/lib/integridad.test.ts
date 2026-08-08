import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/modules/core/db/schema";
import { ponerAlDia } from "@/modules/core/db/migrar";
import { SCHEMA_SQL } from "@/modules/core/db/schema-sql";
import type { Db } from "@/modules/core/db";
import { projects, tasks } from "@/modules/habitos/schema";
import { addFileBytes } from "./adjuntos";
import { createCategoria, deleteCategoria } from "./categorias";
import { deleteProject, deleteTaskById } from "./mutations";
import { getTasksGrouped } from "./tasks";

/*
  Estos tests NO corren contra `createTestDb()`.

  Corren contra una base con la forma que tiene la del usuario: la que existía
  antes de unificar y a la que `ponerAlDia` le añadió las columnas con ALTER
  TABLE. SQLite no admite añadir una columna CON clave foránea, así que ahí
  `parent_id`, `project_id` y `category_id` NO tienen ninguna, y el motor no
  vigila nada.

  El spec ya lo decía: en esa base la integridad la sostiene el código. Esto es
  lo que comprueba que de verdad la sostiene. Contra `createTestDb()` estos
  mismos tests pasarían sin que el código hiciera nada, porque los aprobaría el
  motor — y en la base real fallarían en silencio.
*/
/**
 * `tasks` tal y como estaba antes de unificar: sin las cuatro columnas y, sobre
 * todo, sin ninguna clave foránea.
 */
const TASKS_VIEJA = `
CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'TODO',
  "order"      INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER
);
`;

/**
 * Una base con la forma de la del usuario: todo el esquema real, salvo `tasks`,
 * que se rehace con la forma vieja y se pone al día con `ALTER TABLE`.
 *
 * Se parte del `SCHEMA_SQL` de verdad y no de una copia a mano porque las demás
 * tablas —jugador, misiones, hábitos— tienen que ser las auténticas: por ahí
 * pasan `grantXp` y `syncDailyQuests`, que se llaman al borrar.
 */
function basePuestaAlDia(): Db {
  const s = new Database(":memory:");
  s.pragma("foreign_keys = ON");
  s.exec(SCHEMA_SQL);
  s.exec("DROP TABLE tasks");
  s.exec(TASKS_VIEJA);
  ponerAlDia(s);
  return drizzle(s, { schema }) as unknown as Db;
}

const T0 = new Date(1700000000000);
const tarea = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id,
  status: "TODO",
  order: 1,
  createdAt: T0,
  updatedAt: T0,
  ...extra,
});

describe("el motor no vigila nada en la base puesta al día", () => {
  it("y por eso estos tests tienen sentido", () => {
    const db = basePuestaAlDia();
    const fks = (db as unknown as { $client: Database.Database }).$client
      .prepare("pragma foreign_key_list(tasks)")
      .all();
    expect(fks).toHaveLength(0);
  });
});

describe("borrar una tarea con subtareas", () => {
  /*
    Este es el caso grave. `getTasksGrouped` se salta toda tarea que tenga
    padre, porque las subtareas no son tarjetas del tablero. Si al borrar el
    padre los hijos se quedan con un `parent_id` que ya no apunta a nada, no
    salen en el tablero NI debajo de nadie: desaparecen de la vista sin que
    nadie los haya borrado.
  */
  it("se lleva también sus descendientes, y no solo un nivel", async () => {
    const db = basePuestaAlDia();
    await db
      .insert(tasks)
      .values([
        tarea("padre"),
        tarea("hijo", { parentId: "padre" }),
        tarea("nieto", { parentId: "hijo" }),
        tarea("ajena"),
      ]);

    await deleteTaskById(db, "padre");

    const quedan = (await db.select().from(tasks)).map((t) => t.id);
    expect(quedan).toEqual(["ajena"]);
  });

  it("no deja huérfanos invisibles en el tablero", async () => {
    const db = basePuestaAlDia();
    await db
      .insert(tasks)
      .values([tarea("padre"), tarea("hijo", { parentId: "padre" })]);

    await deleteTaskById(db, "padre");

    const g = await getTasksGrouped(db);
    const total = g.TODO.length + g.IN_PROGRESS.length + g.DONE.length;
    const filas = await db.select().from(tasks);
    // Lo que hay en la base y lo que se ve tiene que ser lo mismo.
    expect(total).toBe(filas.length);
  });
});

describe("borrar un proyecto", () => {
  it("deja vivas sus tareas y sin proyecto", async () => {
    const db = basePuestaAlDia();
    await db
      .insert(projects)
      .values({ id: "p1", name: "Casa", createdAt: T0, updatedAt: T0 });
    await db.insert(tasks).values(tarea("t1", { projectId: "p1" }));

    const fd = new FormData();
    fd.set("id", "p1");
    await deleteProject(db, fd);

    const [t] = await db.select().from(tasks);
    expect(t.title).toBe("t1");
    // Sin proyecto, NO con un proyecto que ya no existe: una tarea que apunta a
    // un proyecto fantasma no sale en /proyectos y dice pertenecer a algo que
    // no está.
    expect(t.projectId).toBeNull();
  });
});

describe("borrar una categoría", () => {
  it("deja vivas sus tareas y sin categoría", async () => {
    const db = basePuestaAlDia();
    const r = await createCategoria(db, "Casa", "pink");
    if (!r.ok) throw new Error(r.motivo);
    await db.insert(tasks).values(tarea("t1", { categoryId: r.id }));

    await deleteCategoria(db, r.id);

    const [t] = await db.select().from(tasks);
    expect(t.title).toBe("t1");
    expect(t.categoryId).toBeNull();
  });
});

describe("borrar una tarea con adjuntos", () => {
  /*
    El ORDEN es lo que se prueba aquí. La foránea es en cascada: al borrar las
    tareas, sus filas de adjuntos desaparecen solas y con ellas los nombres de
    los archivos en disco. Hay que LEERLOS antes, o quedan huérfanos para
    siempre y sin forma de saber cuáles eran.
  */
  it("se lleva los archivos de todo el árbol", async () => {
    const db = basePuestaAlDia();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adjuntos-borrado-"));
    await db
      .insert(tasks)
      .values([tarea("padre"), tarea("hijo", { parentId: "padre" })]);
    for (const id of ["padre", "hijo"]) {
      await addFileBytes(
        db,
        id,
        { name: "x.txt", size: 1, mime: "text/plain" },
        Buffer.from("a"),
        dir,
      );
    }
    expect(fs.readdirSync(dir)).toHaveLength(2);

    await deleteTaskById(db, "padre", dir);

    expect(fs.readdirSync(dir)).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("un enlace no deja nada en disco y tampoco estorba", async () => {
    const db = basePuestaAlDia();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adjuntos-enlace-"));
    await db.insert(tasks).values(tarea("sola"));

    await expect(deleteTaskById(db, "sola", dir)).resolves.not.toThrow();

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

/*
  HALLAZGO 4 DE LA AUDITORÍA. Una tarea huérfana —con `parent_id` apuntando a una
  fila que ya no está— desaparecía del tablero de `/tareas` mientras seguía
  saliendo en el árbol.

  `getTasksGrouped` hacía `if (t.parentId) continue` sin comprobar si ese padre
  existe, mientras `buildTaskTree`, en el mismo archivo, documenta que una
  huérfana debe salir como raíz porque «perderlo en silencio sería peor». Dos
  políticas opuestas ante el mismo caso.

  Va aquí y no en `tasks.test.ts` por un motivo concreto: en esta base, que es la
  del usuario, `parent_id` NO tiene clave foránea, así que el estado huérfano es
  alcanzable de verdad. En una base nueva el motor lo impediría y el test estaría
  probando algo que no puede pasar.
*/
describe("una tarea huérfana no se pierde", () => {
  it("sale en el tablero como si fuera raíz", async () => {
    const db = basePuestaAlDia();
    await db
      .insert(tasks)
      .values([tarea("padre"), tarea("hija", { parentId: "padre" })]);

    // Se borra el padre POR SQL, saltándose el borrado en cascada del código:
    // es la forma de llegar al estado que la base real sí permite.
    await db.delete(tasks).where(eq(tasks.id, "padre"));

    const grouped = await getTasksGrouped(db);
    const ids = grouped.TODO.map((t) => t.id);
    expect(ids).toContain("hija");
  });

  it("y una hija con padre vivo sigue SIN salir en el tablero", async () => {
    // La otra mitad: rescatar huérfanas no puede convertir el tablero en una
    // lista plana con todas las subtareas sueltas.
    const db = basePuestaAlDia();
    await db
      .insert(tasks)
      .values([tarea("padre"), tarea("hija", { parentId: "padre" })]);

    const grouped = await getTasksGrouped(db);
    expect(grouped.TODO.map((t) => t.id)).toEqual(["padre"]);
  });
});
