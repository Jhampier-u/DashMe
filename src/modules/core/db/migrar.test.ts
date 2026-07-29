import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema-sql";
import { ponerAlDia } from "./migrar";

/*
  El esquema tal y como era ANTES de unificar. Va aquí escrito a mano y no
  importado de ningún sitio a propósito: es un fósil. Si `SCHEMA_SQL` cambia, la
  forma vieja no debe cambiar con él, porque la base del usuario ya está grabada
  en disco con esta forma exacta.
*/
const ESQUEMA_VIEJO = `
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
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT NOT NULL DEFAULT '📁',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE TABLE project_items (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id    TEXT REFERENCES project_items(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'TODO',
  "order"      INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER
);
`;

/** Una base con la forma vieja, un proyecto, un árbol de dos y una tarea suelta. */
function baseVieja(): Database.Database {
  const s = new Database(":memory:");
  s.pragma("foreign_keys = ON");
  s.exec(ESQUEMA_VIEJO);
  s.prepare(
    "insert into projects (id, name, icon, created_at, updated_at) values (?,?,?,?,?)",
  ).run("p1", "Casa", "🏠", 1000, 1000);
  const item = s.prepare(
    'insert into project_items (id, project_id, parent_id, title, status, "order", created_at, updated_at, completed_at) values (?,?,?,?,?,?,?,?,?)',
  );
  item.run("i1", "p1", null, "Pintar el salón", "IN_PROGRESS", 1, 1000, 1000, null);
  item.run("i2", "p1", "i1", "Comprar pintura", "DONE", 1, 1000, 2000, 2000);
  s.prepare(
    'insert into tasks (id, title, description, status, "order", created_at, updated_at, completed_at) values (?,?,?,?,?,?,?,?)',
  ).run("t1", "Llamar al banco", "Antes del viernes", "TODO", 1, 1000, 1000, null);
  return s;
}

/** Una base recién creada con el esquema NUEVO: la migración no debe tocarla. */
function baseNueva(): Database.Database {
  const s = new Database(":memory:");
  s.pragma("foreign_keys = ON");
  s.exec(SCHEMA_SQL);
  return s;
}

function columnas(s: Database.Database, tabla: string): string[] {
  return (s.prepare(`pragma table_info(${tabla})`).all() as { name: string }[])
    .map((c) => c.name)
    .sort();
}

function existe(s: Database.Database, tabla: string): boolean {
  return (
    s
      .prepare("select name from sqlite_master where type='table' and name=?")
      .get(tabla) !== undefined
  );
}

describe("ponerAlDia sobre una base con la forma vieja", () => {
  it("añade las cuatro columnas que faltaban", () => {
    const s = baseVieja();
    ponerAlDia(s);
    const c = columnas(s, "tasks");
    expect(c).toContain("parent_id");
    expect(c).toContain("project_id");
    expect(c).toContain("category_id");
    expect(c).toContain("priority");
    s.close();
  });

  it("trae los elementos de proyecto con su árbol y su proyecto intactos", () => {
    const s = baseVieja();
    ponerAlDia(s);
    const filas = s
      .prepare(
        "select id, title, status, parent_id, project_id from tasks order by id",
      )
      .all() as Record<string, unknown>[];
    expect(filas).toHaveLength(3);
    expect(filas[0]).toMatchObject({
      id: "i1",
      title: "Pintar el salón",
      parent_id: null,
      project_id: "p1",
    });
    expect(filas[1]).toMatchObject({ id: "i2", parent_id: "i1", project_id: "p1" });
    s.close();
  });

  it("no toca la tarea que ya existía", () => {
    const s = baseVieja();
    ponerAlDia(s);
    const t = s.prepare("select * from tasks where id = 't1'").get() as Record<
      string,
      unknown
    >;
    expect(t.title).toBe("Llamar al banco");
    expect(t.description).toBe("Antes del viernes");
    expect(t.project_id).toBeNull();
    s.close();
  });

  it("conserva las fechas de cierre, que es de donde salen las métricas", () => {
    const s = baseVieja();
    ponerAlDia(s);
    const t = s.prepare("select completed_at from tasks where id = 'i2'").get() as {
      completed_at: number;
    };
    expect(t.completed_at).toBe(2000);
    s.close();
  });

  it("borra project_items", () => {
    const s = baseVieja();
    ponerAlDia(s);
    expect(existe(s, "project_items")).toBe(false);
    s.close();
  });

  it("correrla dos veces no cambia nada la segunda", () => {
    const s = baseVieja();
    ponerAlDia(s);
    const antes = s.prepare("select * from tasks order by id").all();
    ponerAlDia(s);
    expect(s.prepare("select * from tasks order by id").all()).toEqual(antes);
    s.close();
  });
});

/*
  El camino REAL de producción, que los dos bloques de arriba no recorrían:
  `createDb()` ejecuta SCHEMA_SQL y DESPUÉS pone al día. Sobre una base vieja,
  el CREATE TABLE IF NOT EXISTS de `tasks` no hace nada porque la tabla ya
  está, pero los CREATE INDEX sí se ejecutan, y apuntan a columnas que todavía
  no existen.

  Este bloque existe porque esa combinación reventaba con «no such column:
  parent_id» y ninguno de los otros la probaba. Los índices de las columnas
  nuevas se crean ahora dentro de `ponerAlDia`, después de las columnas.
*/
describe("la secuencia real: SCHEMA_SQL y después ponerAlDia", () => {
  it("no revienta sobre una base con la forma vieja", () => {
    const s = baseVieja();
    expect(() => {
      s.exec(SCHEMA_SQL);
      ponerAlDia(s);
    }).not.toThrow();
    s.close();
  });

  it("deja los índices de las columnas nuevas creados", () => {
    const s = baseVieja();
    s.exec(SCHEMA_SQL);
    ponerAlDia(s);
    const idx = (
      s
        .prepare("select name from sqlite_master where type='index'")
        .all() as { name: string }[]
    ).map((i) => i.name);
    expect(idx).toContain("tasks_parent_idx");
    expect(idx).toContain("tasks_project_idx");
    expect(idx).toContain("tasks_category_idx");
    s.close();
  });

  it("y trae igualmente los elementos de proyecto", () => {
    const s = baseVieja();
    s.exec(SCHEMA_SQL);
    ponerAlDia(s);
    expect(
      s.prepare("select count(*) c from tasks").get() as { c: number },
    ).toEqual({ c: 3 });
    expect(existe(s, "project_items")).toBe(false);
    s.close();
  });
});

describe("ponerAlDia sobre una base ya al día", () => {
  it("no hace nada", () => {
    const s = baseNueva();
    const antes = columnas(s, "tasks");
    ponerAlDia(s);
    expect(columnas(s, "tasks")).toEqual(antes);
    s.close();
  });

  it("deja crear una tarea con padre, proyecto y categoría", () => {
    const s = baseNueva();
    ponerAlDia(s);
    s.prepare(
      "insert into projects (id, name, created_at, updated_at) values ('p1','Casa',1,1)",
    ).run();
    s.prepare(
      "insert into task_categories (id, name, color, created_at) values ('c1','Casa','pink',1)",
    ).run();
    s.prepare(
      'insert into tasks (id, title, status, "order", project_id, category_id, priority, created_at, updated_at) values (?,?,?,?,?,?,?,?,?)',
    ).run("t1", "Pintar", "TODO", 1, "p1", "c1", "URGENT", 1, 1);
    const t = s.prepare("select * from tasks where id='t1'").get() as Record<
      string,
      unknown
    >;
    expect(t.priority).toBe("URGENT");
    expect(t.category_id).toBe("c1");
    s.close();
  });
});
