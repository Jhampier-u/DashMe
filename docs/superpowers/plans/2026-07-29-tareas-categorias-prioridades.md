# Tareas unificadas, con categorías y prioridades · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `tasks` sea la única tabla de tareas del dashboard, y que una tarea pueda llevar categoría y prioridad, filtrables desde la URL.

**Architecture:** `tasks` absorbe `project_items` con una migración idempotente que corre en cada arranque. `/proyectos` pasa a ser `/tareas` filtrado por `project_id`. Categoría es una tabla propia con un color de la paleta compartida; prioridad son cuatro valores de texto resueltos en lectura.

**Tech Stack:** Next 16.2.12 · Drizzle sobre SQLite · better-sqlite3 · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-28-tareas-categorias-prioridades-design.md`

---

## Antes de empezar: lee esto

**Haz la copia de seguridad ANTES de tocar nada.** La Tarea 1 modifica la base
real en el primer arranque y no hay vuelta atrás sin ella. Es el paso 1 y no es
opcional.

**La Tarea 1 es grande y no se puede partir.** Quitar `project_items` del
esquema rompe `projects.ts`, `mutations.ts` y `quests.ts` a la vez: no hay punto
intermedio donde el repo esté verde. Partirla dejaría commits que no compilan.
Las otras cinco sí son pequeñas.

**No renombres los tests de `projects.test.ts` por gusto.** Cambian los nombres
de tabla y de tipo, nada más. Si te ves reescribiendo una afirmación sobre el
árbol, los conteos o el último avance, párate: eso es que rompiste algo.

**Los cuatro tamaños de punto no son decoración.** 6·9·12·15 px son la segunda
señal de la prioridad, para quien no distingue lavanda de coral. Si algún paso
te pide unificarlos, es un error del paso.

**Ninguna fila se pierde.** Si te ves escribiendo un `DELETE` que no sea el
`DROP TABLE project_items` del final de la migración, te has salido.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/modules/core/db/migrar.ts` | **Nuevo.** `ponerAlDia()`: añade columnas y absorbe `project_items` |
| `src/modules/core/db/migrar.test.ts` | **Nuevo.** Base con la forma vieja → forma nueva |
| `src/modules/core/db/schema-sql.ts` | `task_categories`, `tasks` con cuatro columnas, sin `project_items` |
| `src/modules/core/db/index.ts` | Llama a `ponerAlDia()` tras `SCHEMA_SQL` |
| `src/modules/core/db/testing.ts` | Lo mismo, para que los tests recorran el mismo camino |
| `src/modules/habitos/schema.ts` | Las tablas en Drizzle |
| `src/modules/habitos/lib/prioridad.ts` | **Nuevo.** Puro: claves, etiquetas, color y tamaño |
| `src/modules/habitos/lib/prioridad.test.ts` | **Nuevo.** |
| `src/modules/habitos/lib/categorias.ts` | **Nuevo.** Consultas y mutaciones de categoría |
| `src/modules/habitos/lib/categorias.test.ts` | **Nuevo.** |
| `src/modules/habitos/lib/tasks.ts` | El árbol, las raíces y el filtrado |
| `src/modules/habitos/lib/projects.ts` | Repuntado a `tasks` |
| `src/modules/habitos/lib/quests.ts` | Las dos cuentas, separadas por `project_id` |
| `src/modules/habitos/lib/mutations.ts` | Cuatro funciones de proyecto colapsan en las de tarea |
| `src/modules/habitos/components/tasks/PriorityDot.tsx` | **Nuevo.** |
| `src/modules/habitos/components/tasks/FilterBar.tsx` | **Nuevo.** Lee el filtro de la URL |
| `src/modules/habitos/components/tasks/CategoriesPanel.tsx` | **Nuevo.** Crear, renombrar, recolorear y borrar categorías |
| `src/modules/habitos/components/tasks/TaskCard.tsx` | Punto, subrayado y conteo de hijos |
| `src/modules/habitos/components/tasks/NewTaskForm.tsx` | Selector de categoría y prioridad |
| `src/app/tareas/page.tsx` | Lee `searchParams` |

---

### Tarea 1: El esquema, la migración y el repuntado

**Files:**
- Create: `src/modules/core/db/migrar.ts`
- Create: `src/modules/core/db/migrar.test.ts`
- Modify: `src/modules/core/db/schema-sql.ts`
- Modify: `src/modules/core/db/index.ts`
- Modify: `src/modules/core/db/testing.ts`
- Modify: `src/modules/habitos/schema.ts`
- Modify: `src/modules/habitos/lib/projects.ts`
- Modify: `src/modules/habitos/lib/projects.test.ts`
- Modify: `src/modules/habitos/lib/quests.ts`
- Modify: `src/modules/habitos/lib/mutations.ts`
- Modify: `src/modules/habitos/actions.ts`
- Modify: `src/modules/habitos/index.ts`
- Modify: `src/modules/habitos/components/projects/ProjectTree.tsx`
- Modify: `src/modules/habitos/components/projects/ProjectTreeItem.tsx`

- [x] **Paso 1: La copia de seguridad**

**Un `cp` NO vale.** La base va en modo WAL: hay un `juampi.db-wal` de varios MB
con transacciones que todavía no están en el `.db`. Copiar solo el `.db` produce
una copia que parece correcta y a la que le faltan los últimos cambios.

Se usa el backup propio de SQLite, que vuelca el WAL y deja un archivo
consistente, y se comprueba que lo es:

```bash
cd "/c/PROYECTO JUAMPI"
node -e "
const D=require('better-sqlite3');
const d=new D('data/juampi.db',{readonly:true});
d.backup('data/juampi.db.antes-de-unificar.bak').then(()=>{
  d.close();
  const b=new D('data/juampi.db.antes-de-unificar.bak',{readonly:true});
  console.log('integridad:', b.pragma('integrity_check'));
  console.log('tareas:', b.prepare('select count(*) c from tasks').get());
  b.close();
});
"
```

Esperado: `integrity_check: ok` y el número de tareas que tengas.
**No sigas sin ver las dos líneas.**

- [x] **Paso 2: Escribir el test de la migración**

`src/modules/core/db/migrar.test.ts`:

```ts
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
      .prepare("select id, title, status, parent_id, project_id from tasks order by id")
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
```

- [x] **Paso 3: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/core/db/migrar.test.ts
```

Esperado: **FAIL**, `Failed to resolve import "./migrar"`.

- [x] **Paso 4: Escribir la migración**

`src/modules/core/db/migrar.ts`:

```ts
// El mismo patrón que `migrar-ledger.test.ts`: los tipos de better-sqlite3 se
// declaran con `export =`, así que el tipo de la instancia es `Database.Database`
// y se llega a él por el import por defecto.
import type Database from "better-sqlite3";

type Sqlite = Database.Database;

/*
  El repo no tenía sistema de migraciones y hasta ahora no hizo falta:
  `SCHEMA_SQL` son `CREATE TABLE IF NOT EXISTS`, que basta mientras el esquema
  solo crezca con tablas nuevas. Añadir COLUMNAS a una tabla que ya existe en la
  base del usuario es otra cosa, y esto es lo que la pone al día.

  Corre en cada arranque y es idempotente por diseño: comprueba qué falta antes
  de tocar nada. Sobre una base recién creada con `SCHEMA_SQL` no hace
  absolutamente nada, y así lo afirma su test.
*/

/**
 * Las columnas que `tasks` ganó al unificarse con `project_items`.
 *
 * Van SIN clave foránea a propósito. SQLite no admite `ADD COLUMN` con
 * referencia; declararlas obligaría a recrear la tabla entera y a copiar sus
 * filas, y eso es mucho riesgo para una base con una tarea dentro. En las bases
 * NUEVAS sí llevan su foránea, porque `SCHEMA_SQL` las crea de golpe.
 *
 * Consecuencia real y consciente: en la base que se pone al día, la integridad
 * de estas tres referencias la sostiene el código y no el motor.
 */
const COLUMNAS_NUEVAS: [string, string][] = [
  ["parent_id", "TEXT"],
  ["project_id", "TEXT"],
  ["category_id", "TEXT"],
  ["priority", "TEXT"],
];

function columnasDe(sqlite: Sqlite, tabla: string): Set<string> {
  const filas = sqlite.prepare(`pragma table_info(${tabla})`).all() as {
    name: string;
  }[];
  return new Set(filas.map((c) => c.name));
}

function existeTabla(sqlite: Sqlite, tabla: string): boolean {
  return (
    sqlite
      .prepare("select name from sqlite_master where type='table' and name=?")
      .get(tabla) !== undefined
  );
}

/**
 * Los índices de las columnas nuevas. Van aquí y no en `SCHEMA_SQL` por orden:
 * allí se crearían antes que las columnas a las que apuntan.
 */
const INDICES_NUEVOS = [
  "CREATE INDEX IF NOT EXISTS tasks_parent_idx   ON tasks(parent_id)",
  "CREATE INDEX IF NOT EXISTS tasks_project_idx  ON tasks(project_id)",
  "CREATE INDEX IF NOT EXISTS tasks_category_idx ON tasks(category_id)",
];

export function ponerAlDia(sqlite: Sqlite): void {
  const tiene = columnasDe(sqlite, "tasks");
  for (const [nombre, tipo] of COLUMNAS_NUEVAS) {
    if (!tiene.has(nombre)) {
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN ${nombre} ${tipo}`);
    }
  }
  for (const sql of INDICES_NUEVOS) sqlite.exec(sql);
  if (existeTabla(sqlite, "project_items")) absorberProjectItems(sqlite);
}

/**
 * Los elementos de proyecto pasan a ser tareas y su tabla desaparece.
 *
 * Conservan su `id`, y eso es deliberado: `parent_id` apunta a esos mismos ids,
 * así que copiar el árbol se reduce a copiar la columna. Renumerar obligaría a
 * un segundo recorrido para reapuntar cada padre.
 *
 * Copiar y borrar van en UNA transacción: o están las dos cosas o ninguna. El
 * `NOT IN` es un cinturón de más por si alguien vuelve a crear la tabla.
 */
function absorberProjectItems(sqlite: Sqlite): void {
  sqlite.transaction(() => {
    sqlite.exec(`
      INSERT INTO tasks (id, title, description, status, "order",
                         parent_id, project_id, category_id, priority,
                         created_at, updated_at, completed_at)
      SELECT id, title, NULL, status, "order",
             parent_id, project_id, NULL, NULL,
             created_at, updated_at, completed_at
      FROM project_items
      WHERE id NOT IN (SELECT id FROM tasks)
    `);
    sqlite.exec("DROP TABLE project_items");
  })();
}
```

- [x] **Paso 5: El esquema SQL**

En `src/modules/core/db/schema-sql.ts`, sustituye el bloque que va desde
`CREATE TABLE IF NOT EXISTS tasks` hasta el índice
`project_items_parent_idx` (líneas 57–89) por:

```sql
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT NOT NULL DEFAULT '📁',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
-- NOCASE para que «Casa» y «casa» no sean dos categorías. El código comprueba
-- lo mismo antes de insertar, para dar un mensaje en vez de una excepción.
CREATE UNIQUE INDEX IF NOT EXISTS task_categories_name_unq
  ON task_categories(name COLLATE NOCASE);

-- `tasks` va DESPUÉS de las dos tablas a las que apunta. SQLite resuelve las
-- foráneas al usarlas y no al crearlas, así que el orden no es obligatorio;
-- se pone así para que se lea de arriba abajo.
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'TODO',
  "order"      INTEGER NOT NULL DEFAULT 0,
  parent_id    TEXT REFERENCES tasks(id)           ON DELETE CASCADE,
  project_id   TEXT REFERENCES projects(id)        ON DELETE SET NULL,
  category_id  TEXT REFERENCES task_categories(id) ON DELETE SET NULL,
  priority     TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER
);
```

Borrar un proyecto ya **no** borra sus tareas: `SET NULL` las deja sueltas.

**Los tres índices de las columnas nuevas NO van aquí** — corrección hecha
durante la ejecución, porque así reventaba. Sobre una base que ya existe, la
sentencia de creación de la tabla no hace nada porque la tabla ya está, pero un
índice sí se crea, y apunta a columnas que la migración todavía no ha añadido:
`SqliteError: no such column: parent_id`, en el primer arranque del usuario.
Los crea `ponerAlDia()`, después de los `ALTER TABLE`.

**No escribas las dos palabras del DDL de creación de tabla en un comentario de
este archivo.** `tests/schema-parity.test.ts` cuenta tablas con una expresión
regular sobre el texto entero, comentarios incluidos, y un comentario que las
mencione descuadra el recuento.

- [x] **Paso 6: Conectar la migración**

En `src/modules/core/db/index.ts`, tras `sqlite.exec(SCHEMA_SQL);`:

```ts
  sqlite.exec(SCHEMA_SQL);
  // `SCHEMA_SQL` crea lo que falta; esto pone al día lo que ya estaba.
  ponerAlDia(sqlite);
```

Y el import arriba:

```ts
import { ponerAlDia } from "./migrar";
```

Lo mismo en `src/modules/core/db/testing.ts`:

```ts
import { ponerAlDia } from "./migrar";
// …
  sqlite.exec(SCHEMA_SQL);
  // Sobre un esquema recién creado no debe hacer nada. Se llama igualmente para
  // que los tests recorran el mismo camino que producción: si algún día dejara
  // de ser inofensiva, se enteran los 432, no el usuario.
  ponerAlDia(sqlite);
```

- [x] **Paso 7: Ejecutar el test de la migración**

```bash
npx vitest run src/modules/core/db/migrar.test.ts
```

Esperado: **PASS**, 11 afirmaciones.

Un bloque de esas once se añadió durante la ejecución y es el más importante:
recorre la SECUENCIA REAL —`SCHEMA_SQL` y después `ponerAlDia`— sobre una base
con la forma vieja. Los otros dos bloques probaban cada forma por su cuenta y
nunca esa combinación, que es justo la que reventaba.

- [x] **Paso 8: El esquema en Drizzle**

En `src/modules/habitos/schema.ts`, sustituye los bloques de `tasks`,
`projects` y `projectItems` (líneas 102–154) por:

```ts
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("📁"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;

export const taskCategories = sqliteTable("task_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Clave de la paleta categórica —`pink`, `lav`…—, no un hexadecimal. */
  color: text("color").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type TaskCategoryRow = typeof taskCategories.$inferSelect;

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    /** TODO | IN_PROGRESS | DONE */
    status: text("status").notNull().default("TODO"),
    order: integer("order").notNull().default(0),
    /**
     * Autorreferencial: el árbol de subtareas. La clave foránea se declara en
     * SCHEMA_SQL y no aquí, porque una referencia a la propia tabla dentro del
     * objeto de columnas provoca una inicialización circular. Es el mismo
     * motivo por el que lo hacía así `project_items`, de quien hereda el árbol.
     */
    parentId: text("parent_id"),
    projectId: text("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => taskCategories.id, {
      onDelete: "set null",
    }),
    /** URGENT | HIGH | MEDIUM | LOW, o nada. Se resuelve en `lib/prioridad.ts`. */
    priority: text("priority"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    byParent: index("tasks_parent_idx").on(t.parentId),
    byProject: index("tasks_project_idx").on(t.projectId),
    byCategory: index("tasks_category_idx").on(t.categoryId),
  }),
);

export type TaskRow = typeof tasks.$inferSelect;
```

`projectItems` y `ProjectItemRow` **desaparecen del archivo**.

- [x] **Paso 9: `projects.ts` lee de `tasks`**

En `src/modules/habitos/lib/projects.ts`:

Cambia el import:

```ts
import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { projects, tasks } from "@/modules/habitos/schema";
```

Sustituye el tipo y la constante de estado por un alias del de tarea, para que
no haya dos vocabularios para lo mismo:

```ts
/*
  Un elemento de proyecto ES una tarea desde la unificación. Los estados se
  reexportan con su nombre viejo para no mantener dos listas de lo mismo; lo
  que se pinta y lo que se guarda son ya la misma cosa.
*/
export type { TaskStatus as ProjectItemStatus } from "./tasks";
export { TASK_STATUSES as PROJECT_ITEM_STATUSES } from "./tasks";
```

Y borra las declaraciones locales de `ProjectItemStatus` y
`PROJECT_ITEM_STATUSES`.

**`ProjectItemNode` se queda donde está en esta tarea**, con su definición
local y su `projectId: string`. Se traslada en la Tarea 4, cuando exista
`buildTaskTree`. Moverlo ahora dejaría este paso sin compilar.

En `listProjects`, la segunda consulta:

```ts
    db
      .select({
        projectId: tasks.projectId,
        status: tasks.status,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .where(isNotNull(tasks.projectId)),
```

Y como `projectId` pasa a ser `string | null`, el agrupador necesita saltarse
las tareas sueltas:

```ts
  const itemsPorProyecto = new Map<string, typeof items>();
  for (const it of items) {
    // `isNotNull` ya las filtró en SQL; esto es lo que se lo dice a TypeScript.
    if (it.projectId === null) continue;
    const lista = itemsPorProyecto.get(it.projectId);
    if (lista) lista.push(it);
    else itemsPorProyecto.set(it.projectId, [it]);
  }
```

En `getProjectWithTree`, la consulta de items:

```ts
  const items = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, id))
    .orderBy(asc(tasks.order), asc(tasks.createdAt));
```

Y dentro del `map.set`, `projectId: it.projectId ?? id`.

En `getProjectMetrics`:

```ts
  const items = await db
    .select({ completedAt: tasks.completedAt })
    .from(tasks)
    .where(
      and(
        eq(tasks.status, "DONE"),
        isNotNull(tasks.projectId),
        isNotNull(tasks.completedAt),
      ),
    );
```

- [x] **Paso 10: Las cuatro mutaciones de proyecto colapsan**

En `src/modules/habitos/lib/mutations.ts`:

Quita `projectItems` del import de `@/modules/habitos/schema` y quita el import
de `PROJECT_ITEM_STATUSES` y `ProjectItemStatus` de `./projects`.

**Borra `updateProjectItemStatus` entera.** Era byte a byte lo mismo que
`updateTaskStatus` salvo el nombre de la tabla; ahora es la misma tabla, así que
es la misma función. Colapsarlas es el motivo de haber unificado.

**Borra `deleteProjectItem`** y en su lugar extrae el cuerpo de `deleteTask`:

```ts
/** Borra por id. Sus subtareas caen con ella por la foránea en cascada. */
export async function deleteTaskById(db: Db, id: string) {
  if (!id) return;
  await db.delete(tasks).where(eq(tasks.id, id));
  const quests = await syncDailyQuests(db);
  await grantXp(db, quests.xpDelta);
}

export async function deleteTask(db: Db, formData: FormData) {
  await deleteTaskById(db, String(formData.get("id") ?? ""));
}
```

`createProjectItem` pasa a llamarse `createProjectTask` y escribe en `tasks`:

```ts
export async function createProjectTask(
  db: Db,
  projectId: string,
  parentId: string | null,
  title: string,
) {
  const t = title.trim().slice(0, LIMITS.taskTitle);
  if (!projectId || !t) return;
  // `parentId` puede ser null y en SQL `= NULL` nunca casa: hay que usar
  // IS NULL. isNull/eq según el caso, no un eq a secas.
  const [last] = await db
    .select({ order: tasks.order })
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        parentId === null ? isNull(tasks.parentId) : eq(tasks.parentId, parentId),
      ),
    )
    .orderBy(desc(tasks.order))
    .limit(1);
  const ahora = new Date();
  await db.insert(tasks).values({
    id: crypto.randomUUID(),
    projectId,
    parentId,
    title: t,
    order: (last?.order ?? 0) + 1,
    status: "TODO",
    createdAt: ahora,
    updatedAt: ahora,
  });
}
```

`renameProjectItem` pasa a `renameTask` y cambia `projectItems` por `tasks` en
su cuerpo. `LIMITS.itemTitle` deja de usarse: se borra de `LIMITS`.

Y `createTask` calcula el orden **dentro de su grupo**, no dentro de todo
`TODO`, porque ahora hay grupos:

```ts
  const [last] = await db
    .select({ order: tasks.order })
    .from(tasks)
    .where(and(eq(tasks.status, "TODO"), isNull(tasks.parentId), isNull(tasks.projectId)))
    .orderBy(desc(tasks.order))
    .limit(1);
```

- [x] **Paso 11: Las dos misiones diarias**

En `src/modules/habitos/lib/quests.ts`, quita `projectItems` del import y añade
`isNotNull` e `isNull` a los de `drizzle-orm`. Sustituye las dos consultas de
conteo por:

```ts
    /*
      Dos misiones distintas, no una: «Dos tareas» y «Una subtarea de proyecto».
      Antes las separaba la tabla; ahora las separa `project_id`, y el conjunto
      que cuenta cada una es exactamente el mismo de antes, fila por fila:
      ninguna tarea tenía proyecto y todo elemento de proyecto lo tenía.
    */
    db
      .select({ n: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "DONE"),
          isNull(tasks.projectId),
          gte(tasks.completedAt, start),
          lt(tasks.completedAt, end),
        ),
      ),
    db
      .select({ n: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "DONE"),
          isNotNull(tasks.projectId),
          gte(tasks.completedAt, start),
          lt(tasks.completedAt, end),
        ),
      ),
```

- [x] **Paso 12: Los server actions y la interfaz del módulo**

En `src/modules/habitos/actions.ts`:

- `createProjectItem` → `createProjectTask`, llamando a `m.createProjectTask`
- `updateProjectItemStatus` → **borrar**; `ProjectTree` usará `updateTaskStatus`
- `deleteProjectItem(itemId)` → llama a `m.deleteTaskById(db, itemId)`
- `renameProjectItem` → `renameTask`
- borra el `import type { ProjectItemStatus }`

En `src/modules/habitos/index.ts`, `type ProjectItemNode` sigue exportándose
desde `./lib/projects` (que ahora lo reexporta). No cambia nada más.

- [x] **Paso 13: El árbol de proyecto en pantalla**

En `ProjectTree.tsx` y `ProjectTreeItem.tsx`, sustituye los nombres importados
de `@/modules/habitos/actions`:

- `createProjectItem` → `createProjectTask`
- `updateProjectItemStatus` → `updateTaskStatus`
- `renameProjectItem` → `renameTask`

`deleteProjectItem` conserva su nombre. Ninguna llamada cambia de argumentos.

- [x] **Paso 14: Los tests de proyecto**

En `src/modules/habitos/lib/projects.test.ts`, sustituye `projectItems` por
`tasks` en los imports y en los `insert`. Los `insert` necesitan además
`updated_at`, que `project_items` tenía y las inserciones puede que omitieran.

**No cambies ninguna afirmación.** Si una falla, es un fallo real.

- [x] **Paso 15: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

Esperado: todo verde. Si `projects.test.ts` falla en una afirmación sobre
conteos o sobre el último avance, revisa el paso 9 antes de tocar el test.

- [x] **Paso 16: Comprobar la base real**

```bash
npm run build && node -e "
const D=require('better-sqlite3');const d=new D('data/juampi.db',{readonly:true});
console.log('columnas:', d.prepare('pragma table_info(tasks)').all().map(c=>c.name).join(', '));
console.log('tareas:', d.prepare('select count(*) c from tasks').get());
console.log('project_items existe:', d.prepare(\"select count(*) c from sqlite_master where type='table' and name='project_items'\").get());
"
```

Esperado: las cuatro columnas nuevas, 1 tarea, y `project_items` a 0.

> El `build` es lo que abre la base y dispara la migración. Si aún no ha
> corrido, arranca el servidor una vez.

- [x] **Paso 17: Commit**

```bash
git add -A src
git commit -m "feat(tareas): una sola tabla de tareas

project_items desaparece y sus filas pasan a tasks con su arbol y su
proyecto intactos. Nace core/db/migrar.ts, que el repo no tenia: hasta
ahora el esquema solo crecia con tablas nuevas y CREATE IF NOT EXISTS
bastaba.

updateProjectItemStatus se borra: era identica a updateTaskStatus salvo
el nombre de la tabla, y ahora es la misma tabla.

Borrar un proyecto ya no borra su trabajo."
```

---

### Tarea 2: Las prioridades

**Files:**
- Create: `src/modules/habitos/lib/prioridad.ts`
- Create: `src/modules/habitos/lib/prioridad.test.ts`

- [x] **Paso 1: Escribir el test**

`src/modules/habitos/lib/prioridad.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PRIORIDADES,
  PRIORIDAD_DEFS,
  prioridadColorVar,
  resolvePrioridad,
} from "./prioridad";
import { PALETA_CATEGORICA } from "@/modules/core/ui/paleta";

describe("PRIORIDAD_DEFS", () => {
  it("son cuatro", () => {
    expect(PRIORIDADES).toHaveLength(4);
  });

  it("sus colores salen de la paleta compartida", () => {
    for (const p of PRIORIDADES) {
      expect(PALETA_CATEGORICA).toHaveProperty(PRIORIDAD_DEFS[p].color);
    }
  });

  it("no repiten color", () => {
    const colores = PRIORIDADES.map((p) => PRIORIDAD_DEFS[p].color);
    expect(new Set(colores).size).toBe(4);
  });

  /*
    El tamaño es la SEGUNDA señal, la que funciona para quien no distingue
    lavanda de coral —que son justamente Urgente y Alto—. Si algún día los
    cuatro puntos midieran lo mismo, la prioridad pasaría a ser solo color y
    rompería la regla que sostiene el sistema visual entero.
  */
  it("el punto crece con la prioridad, estrictamente", () => {
    const tam = PRIORIDADES.map((p) => PRIORIDAD_DEFS[p].punto);
    expect(tam).toEqual([...tam].sort((a, b) => b - a));
    expect(new Set(tam).size).toBe(4);
  });

  it("los tamaños caen en la rejilla de 3px del sistema pixel", () => {
    for (const p of PRIORIDADES) {
      expect(PRIORIDAD_DEFS[p].punto % 3).toBe(0);
    }
  });

  it("el mayor dobla al menor, para que la diferencia se vea", () => {
    const tam = PRIORIDADES.map((p) => PRIORIDAD_DEFS[p].punto);
    expect(Math.max(...tam) / Math.min(...tam)).toBeGreaterThanOrEqual(2);
  });
});

describe("resolvePrioridad", () => {
  it("deja pasar las cuatro válidas", () => {
    for (const p of PRIORIDADES) expect(resolvePrioridad(p)).toBe(p);
  });

  it("una tarea sin prioridad no tiene prioridad", () => {
    expect(resolvePrioridad(null)).toBeNull();
  });

  /*
    Cae a null y no a MEDIUM: un valor corrupto no debe inventarse una urgencia
    que el usuario nunca puso.
  */
  it("cualquier otra cosa es no tener prioridad", () => {
    expect(resolvePrioridad("")).toBeNull();
    expect(resolvePrioridad("urgent")).toBeNull();
    expect(resolvePrioridad("CRITICAL")).toBeNull();
  });
});

describe("prioridadColorVar", () => {
  it("devuelve la referencia al token de la paleta", () => {
    expect(prioridadColorVar("URGENT")).toBe("var(--c-lav)");
    expect(prioridadColorVar("LOW")).toBe("var(--c-mint)");
  });
});
```

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/habitos/lib/prioridad.test.ts
```

Esperado: **FAIL**, `Failed to resolve import "./prioridad"`.

- [x] **Paso 3: Escribir el módulo**

`src/modules/habitos/lib/prioridad.ts`:

```ts
import { varColor, type ColorCategorico } from "@/modules/core/ui/paleta";

/**
 * Las cuatro prioridades de una tarea. Son OPCIONALES: una tarea sin prioridad
 * no lleva punto.
 *
 * Eso es lo que hace que el punto signifique algo. Si todas las tareas llevaran
 * uno, ninguna llamaría la atención, y una señal que está siempre encendida no
 * es una señal.
 *
 * No son una tabla porque no crecen: cuatro prioridades son un sistema, ocho
 * son una lista. Añadir una quinta debe costar tocar código.
 */
export type Prioridad = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

/** De más a menos urgente. El orden importa: es el del selector y el del test. */
export const PRIORIDADES: Prioridad[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

type Def = {
  label: string;
  color: ColorCategorico;
  /** Diámetro del punto en px. */
  punto: number;
};

/*
  El tamaño no es decoración.

  La regla que sostiene el sistema visual es NUNCA SOLO COLOR. Un punto que solo
  cambia de tono deja fuera a quien no distingue lavanda de coral, y esos son
  justamente Urgente y Alto. El diámetro va de 6 a 15: dos señales
  independientes por el precio de una, y sigue siendo el punto redondo pedido.

  Los cuatro son múltiplos de 3 para caer en la rejilla del sistema pixel.
*/
export const PRIORIDAD_DEFS: Record<Prioridad, Def> = {
  URGENT: { label: "Urgente", color: "lav", punto: 15 },
  HIGH: { label: "Alto", color: "coral", punto: 12 },
  MEDIUM: { label: "Medio", color: "amber", punto: 9 },
  LOW: { label: "Bajo", color: "mint", punto: 6 },
};

/**
 * Traduce lo guardado. Cae a `null` y no a una prioridad media a propósito: un
 * valor corrupto no debe inventarse una urgencia que el usuario nunca puso.
 */
export function resolvePrioridad(stored: string | null): Prioridad | null {
  if (stored === null) return null;
  return (PRIORIDADES as string[]).includes(stored)
    ? (stored as Prioridad)
    : null;
}

/** Referencia al token CSS del color, para estilos en línea. */
export function prioridadColorVar(p: Prioridad): string {
  return varColor(PRIORIDAD_DEFS[p].color);
}
```

- [x] **Paso 4: Verificar**

```bash
npx vitest run src/modules/habitos/lib/prioridad.test.ts && npx tsc --noEmit
```

Esperado: **PASS**, 10 afirmaciones.

- [x] **Paso 5: Commit**

```bash
git add src/modules/habitos/lib/prioridad.ts src/modules/habitos/lib/prioridad.test.ts
git commit -m "feat(tareas): las cuatro prioridades, con el tamano como segunda senal"
```

---

### Tarea 3: Las categorías

**Files:**
- Create: `src/modules/habitos/lib/categorias.ts`
- Create: `src/modules/habitos/lib/categorias.test.ts`
- Modify: `src/modules/habitos/actions.ts`
- Modify: `src/modules/habitos/index.ts`

- [x] **Paso 1: Escribir el test**

`src/modules/habitos/lib/categorias.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { tasks } from "@/modules/habitos/schema";
import {
  createCategoria,
  deleteCategoria,
  listCategorias,
  renameCategoria,
  resolveCategoriaColor,
} from "./categorias";

async function conCategoria(nombre = "Casa", color = "pink") {
  const db = createTestDb();
  const r = await createCategoria(db, nombre, color);
  if (!r.ok) throw new Error(`no se creó: ${r.motivo}`);
  return { db, id: r.id };
}

describe("createCategoria", () => {
  it("la crea y la devuelve la lista", async () => {
    const { db } = await conCategoria();
    const lista = await listCategorias(db);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ name: "Casa", color: "pink", taskCount: 0 });
  });

  it("rechaza un nombre vacío", async () => {
    const db = createTestDb();
    expect(await createCategoria(db, "   ", "pink")).toEqual({
      ok: false,
      motivo: "vacio",
    });
  });

  /*
    Se comprueba en el código ADEMÁS del índice único de SQLite. El índice es la
    garantía; esto es lo que permite decir «ya existe» en vez de reventar con
    una excepción del motor a la cara del usuario.
  */
  it("rechaza una repetida sin mirar mayúsculas", async () => {
    const { db } = await conCategoria("Casa");
    expect(await createCategoria(db, "casa", "mint")).toEqual({
      ok: false,
      motivo: "repetida",
    });
    expect(await listCategorias(db)).toHaveLength(1);
  });

  it("un color que no está en la paleta cae al de por defecto", async () => {
    const db = createTestDb();
    const r = await createCategoria(db, "Casa", "chartreuse");
    expect(r.ok).toBe(true);
    expect((await listCategorias(db))[0].color).toBe("pink");
  });
});

describe("listCategorias", () => {
  it("cuenta cuántas tareas usan cada una", async () => {
    const { db, id } = await conCategoria();
    const ahora = new Date();
    await db.insert(tasks).values([
      { id: "t1", title: "A", categoryId: id, order: 1, status: "TODO", createdAt: ahora, updatedAt: ahora },
      { id: "t2", title: "B", categoryId: id, order: 2, status: "DONE", createdAt: ahora, updatedAt: ahora },
      { id: "t3", title: "C", categoryId: null, order: 3, status: "TODO", createdAt: ahora, updatedAt: ahora },
    ]);
    expect((await listCategorias(db))[0].taskCount).toBe(2);
  });
});

describe("deleteCategoria", () => {
  /*
    Lo importante de este test no es que la categoría desaparezca, es que la
    TAREA sobreviva. Borrar una etiqueta no puede llevarse trabajo por delante.
  */
  it("deja vivas sus tareas, sin categoría", async () => {
    const { db, id } = await conCategoria();
    const ahora = new Date();
    await db.insert(tasks).values({
      id: "t1", title: "A", categoryId: id, order: 1, status: "TODO",
      createdAt: ahora, updatedAt: ahora,
    });
    await deleteCategoria(db, id);
    expect(await listCategorias(db)).toHaveLength(0);
    const [t] = await db.select().from(tasks);
    expect(t.title).toBe("A");
    expect(t.categoryId).toBeNull();
  });
});

describe("renameCategoria", () => {
  it("cambia el nombre", async () => {
    const { db, id } = await conCategoria();
    await renameCategoria(db, id, "Hogar");
    expect((await listCategorias(db))[0].name).toBe("Hogar");
  });

  it("no deja chocar con otra que ya existe", async () => {
    const { db, id } = await conCategoria("Casa");
    await createCategoria(db, "Trabajo", "sky");
    expect(await renameCategoria(db, id, "trabajo")).toEqual({
      ok: false,
      motivo: "repetida",
    });
    expect((await listCategorias(db)).map((c) => c.name).sort()).toEqual([
      "Casa",
      "Trabajo",
    ]);
  });
});

describe("resolveCategoriaColor", () => {
  it("deja pasar las claves de la paleta", () => {
    expect(resolveCategoriaColor("acid")).toBe("acid");
    expect(resolveCategoriaColor("lav")).toBe("lav");
  });

  it("cualquier otra cosa cae al color por defecto", () => {
    expect(resolveCategoriaColor("violet")).toBe("pink");
    expect(resolveCategoriaColor("")).toBe("pink");
  });
});
```

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/habitos/lib/categorias.test.ts
```

Esperado: **FAIL**, `Failed to resolve import "./categorias"`.

- [x] **Paso 3: Escribir el módulo**

`src/modules/habitos/lib/categorias.ts`:

```ts
import { asc, count, eq, sql } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { taskCategories, tasks } from "@/modules/habitos/schema";
import { PALETA_CATEGORICA, type ColorCategorico } from "@/modules/core/ui/paleta";

export const LIMITE_NOMBRE_CATEGORIA = 40;

/** El de por defecto: el acento de la marca en todo el dashboard. */
const COLOR_POR_DEFECTO: ColorCategorico = "pink";

export type Categoria = {
  id: string;
  name: string;
  color: ColorCategorico;
  taskCount: number;
};

export type ResultadoCategoria =
  | { ok: true; id: string }
  | { ok: false; motivo: "vacio" | "repetida" };

/**
 * Traduce el color guardado. Las OCHO claves valen, incluida `acid`: las
 * categorías no son identidad de hábito, así que no arrastran su exclusión.
 */
export function resolveCategoriaColor(stored: string): ColorCategorico {
  return stored in PALETA_CATEGORICA
    ? (stored as ColorCategorico)
    : COLOR_POR_DEFECTO;
}

/**
 * Busca por nombre sin distinguir mayúsculas.
 *
 * El índice único de la tabla ya lo impide, pero saltar el error del motor y
 * devolver un motivo es lo que permite decirle al usuario «esa ya existe» en
 * vez de enseñarle una excepción de SQLite.
 */
async function idPorNombre(db: Db, nombre: string): Promise<string | null> {
  const [fila] = await db
    .select({ id: taskCategories.id })
    .from(taskCategories)
    .where(sql`lower(${taskCategories.name}) = lower(${nombre})`)
    .limit(1);
  return fila?.id ?? null;
}

export async function listCategorias(db: Db): Promise<Categoria[]> {
  // Dos consultas y agrupación en memoria, como en `listProjects`: traer los
  // conteos de golpe evita una consulta por categoría.
  const [filas, usos] = await Promise.all([
    db.select().from(taskCategories).orderBy(asc(taskCategories.name)),
    db
      .select({ categoryId: tasks.categoryId, n: count() })
      .from(tasks)
      .groupBy(tasks.categoryId),
  ]);
  const porId = new Map(usos.map((u) => [u.categoryId, u.n]));
  return filas.map((c) => ({
    id: c.id,
    name: c.name,
    color: resolveCategoriaColor(c.color),
    taskCount: porId.get(c.id) ?? 0,
  }));
}

export async function createCategoria(
  db: Db,
  name: string,
  color: string,
): Promise<ResultadoCategoria> {
  const n = name.trim().slice(0, LIMITE_NOMBRE_CATEGORIA);
  if (!n) return { ok: false, motivo: "vacio" };
  if (await idPorNombre(db, n)) return { ok: false, motivo: "repetida" };
  const id = crypto.randomUUID();
  await db.insert(taskCategories).values({
    id,
    name: n,
    color: resolveCategoriaColor(color),
    createdAt: new Date(),
  });
  return { ok: true, id };
}

export async function renameCategoria(
  db: Db,
  id: string,
  name: string,
): Promise<ResultadoCategoria> {
  const n = name.trim().slice(0, LIMITE_NOMBRE_CATEGORIA);
  if (!n) return { ok: false, motivo: "vacio" };
  const otra = await idPorNombre(db, n);
  if (otra && otra !== id) return { ok: false, motivo: "repetida" };
  await db.update(taskCategories).set({ name: n }).where(eq(taskCategories.id, id));
  return { ok: true, id };
}

export async function setCategoriaColor(db: Db, id: string, color: string) {
  await db
    .update(taskCategories)
    .set({ color: resolveCategoriaColor(color) })
    .where(eq(taskCategories.id, id));
}

/**
 * Borra la categoría. Sus tareas SOBREVIVEN y se quedan sin categoría: lo
 * garantiza el `ON DELETE SET NULL` del esquema. Borrar una etiqueta no puede
 * llevarse trabajo por delante.
 */
export async function deleteCategoria(db: Db, id: string) {
  if (!id) return;
  await db.delete(taskCategories).where(eq(taskCategories.id, id));
}
```

- [x] **Paso 4: Ejecutar el test**

```bash
npx vitest run src/modules/habitos/lib/categorias.test.ts
```

Esperado: **PASS**, 10 afirmaciones.

> Si el borrado deja `category_id` apuntando a una categoría que ya no existe,
> es que la base de test no tiene `foreign_keys` activo. `createTestDb` lo
> activa; no lo arregles en el test.

- [x] **Paso 5: Los server actions**

En `src/modules/habitos/actions.ts`, al final, junto al resto:

```ts
export async function crearCategoria(name: string, color: string) {
  const r = await c.createCategoria(db, name, color);
  refresh();
  return r;
}

export async function renombrarCategoria(id: string, name: string) {
  const r = await c.renameCategoria(db, id, name);
  refresh();
  return r;
}

export async function cambiarColorCategoria(id: string, color: string) {
  await c.setCategoriaColor(db, id, color);
  refresh();
}

export async function borrarCategoria(id: string) {
  await c.deleteCategoria(db, id);
  refresh();
}
```

Con el import arriba, junto a los demás:

```ts
import * as c from "./lib/categorias";
```

`refresh` ya está importado de `next/cache` al principio del archivo; es el
mismo que llaman las demás acciones.

En `src/modules/habitos/index.ts`, añade la lectura:

```ts
export { listCategorias, type Categoria } from "./lib/categorias";
export { PRIORIDADES, PRIORIDAD_DEFS, resolvePrioridad, prioridadColorVar, type Prioridad } from "./lib/prioridad";
```

- [x] **Paso 6: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

- [x] **Paso 7: Commit**

```bash
git add -A src
git commit -m "feat(tareas): categorias propias con color de la paleta compartida"
```

---

### Tarea 4: El árbol, las raíces y el filtro

**Files:**
- Modify: `src/modules/habitos/lib/tasks.ts`
- Modify: `src/modules/habitos/lib/tasks.test.ts`
- Modify: `src/modules/habitos/lib/projects.ts`

- [x] **Paso 1: Escribir los tests**

Añade a `src/modules/habitos/lib/tasks.test.ts`, conservando lo que ya hay:

```ts
import { buildTaskTree, parseTaskFilter } from "./tasks";

function nodo(id: string, parentId: string | null) {
  return { id, parentId, title: id };
}

describe("buildTaskTree", () => {
  it("cuelga cada hijo de su padre", () => {
    const raices = buildTaskTree([nodo("a", null), nodo("b", "a"), nodo("c", "b")]);
    expect(raices).toHaveLength(1);
    expect(raices[0].children[0].id).toBe("b");
    expect(raices[0].children[0].children[0].id).toBe("c");
  });

  /*
    En la base que se pone al día, `parent_id` no tiene clave foránea: SQLite no
    admite añadirla con ALTER TABLE. Así que un padre que no existe es un estado
    POSIBLE, y el árbol tiene que aguantarlo enseñando el huérfano como raíz en
    vez de tragárselo.
  */
  it("un hijo cuyo padre no existe sale como raíz, no desaparece", () => {
    const raices = buildTaskTree([nodo("a", null), nodo("huerfano", "fantasma")]);
    expect(raices.map((r) => r.id).sort()).toEqual(["a", "huerfano"]);
  });

  it("con la lista vacía devuelve una lista vacía", () => {
    expect(buildTaskTree([])).toEqual([]);
  });
});

describe("parseTaskFilter", () => {
  it("lee la categoría y la prioridad de la URL", () => {
    expect(parseTaskFilter({ cat: "c1", pri: "URGENT" })).toEqual({
      categoriaId: "c1",
      prioridad: "URGENT",
    });
  });

  it("sin parámetros no filtra nada", () => {
    expect(parseTaskFilter({})).toEqual({ categoriaId: null, prioridad: null });
  });

  /*
    Una prioridad inventada en la URL no debe filtrar por algo que no existe y
    dejar el tablero vacío sin explicación: se ignora.
  */
  it("una prioridad que no existe se ignora", () => {
    expect(parseTaskFilter({ pri: "CRITICAL" }).prioridad).toBeNull();
  });

  it("un parámetro repetido se queda con el primero", () => {
    expect(parseTaskFilter({ cat: ["c1", "c2"] }).categoriaId).toBe("c1");
  });
});
```

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/habitos/lib/tasks.test.ts
```

Esperado: **FAIL**, `buildTaskTree is not a function`.

- [x] **Paso 3: El árbol y el filtro**

Añade a `src/modules/habitos/lib/tasks.ts`:

```ts
import { resolvePrioridad, type Prioridad } from "./prioridad";

/** Lo único que `buildTaskTree` necesita saber de una fila. */
export type TaskTreeInput = {
  id: string;
  parentId: string | null;
};

/** El nodo que devuelve: la fila que le diste, con sus hijos colgando. */
export type TaskTreeNode<T> = T & { children: TaskTreeNode<T>[] };

/**
 * Monta el árbol a partir de una lista plana.
 *
 * Vivía dentro de `getProjectWithTree`. Sube aquí porque desde la unificación
 * lo necesitan las dos pantallas, y porque un árbol mal montado es un fallo que
 * merece su propio test en vez de esconderse dentro de una consulta.
 *
 * Es GENÉRICA en la fila y no fija una forma concreta. Así `/proyectos` puede
 * meter nodos con `projectId: string` y recuperarlos con ese mismo tipo, en vez
 * de con un `string | null` que obligaría a comprobar por todas partes algo que
 * la consulta ya garantiza.
 *
 * Un hijo cuyo padre no está en la lista sale como RAÍZ. No es un caso
 * hipotético: en la base que se pone al día `parent_id` no tiene foránea, así
 * que nada impide que quede colgando. Perderlo en silencio sería peor.
 */
export function buildTaskTree<T extends TaskTreeInput>(
  filas: T[],
): TaskTreeNode<T>[] {
  const map = new Map<string, TaskTreeNode<T>>();
  for (const f of filas) map.set(f.id, { ...f, children: [] });

  const raices: TaskTreeNode<T>[] = [];
  for (const nodo of map.values()) {
    const padre = nodo.parentId ? map.get(nodo.parentId) : undefined;
    if (padre) padre.children.push(nodo);
    else raices.push(nodo);
  }
  return raices;
}

export type TaskFilter = {
  categoriaId: string | null;
  prioridad: Prioridad | null;
};

/** Un parámetro repetido en la URL llega como lista; vale el primero. */
function primero(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * Lee el filtro de los parámetros de la URL.
 *
 * Que el filtro viva en la URL y no en el estado del cliente es lo que hace que
 * recargar no lo pierda y que «atrás» funcione.
 */
export function parseTaskFilter(sp: {
  [k: string]: string | string[] | undefined;
}): TaskFilter {
  return {
    categoriaId: primero(sp.cat),
    prioridad: resolvePrioridad(primero(sp.pri)),
  };
}
```

- [x] **Paso 4: `getTasksGrouped` devuelve solo raíces**

Sustituye `getTasksGrouped` y amplía `TaskRow` en el mismo archivo:

```ts
export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  order: number;
  createdAt: Date;
  completedAt: Date | null;
  categoryId: string | null;
  priority: Prioridad | null;
  /** Cuántas subtareas cuelgan de ella y cuántas están hechas. */
  hijos: { total: number; hechos: number };
};

/**
 * Las tareas del tablero, agrupadas por estado.
 *
 * Devuelve SOLO LAS RAÍCES. Si devolviera todo, al unificar aparecerían de
 * golpe como tarjetas sueltas los elementos anidados de los proyectos,
 * descolgados de su contexto. Las subtareas se cuentan en `hijos` para que el
 * trabajo anidado no desaparezca de la vista sin decir nada.
 */
export async function getTasksGrouped(
  db: Db,
  filtro: TaskFilter = { categoriaId: null, prioridad: null },
): Promise<Record<TaskStatus, TaskRow[]>> {
  const all = await db
    .select()
    .from(tasks)
    .orderBy(asc(tasks.order), asc(tasks.createdAt));

  // Los hijos se cuentan sobre TODAS las filas, filtre lo que filtre la vista:
  // «3 subtareas» es una propiedad de la tarea, no del filtro que tengas puesto.
  const hijosDe = new Map<string, { total: number; hechos: number }>();
  for (const t of all) {
    if (!t.parentId) continue;
    const c = hijosDe.get(t.parentId) ?? { total: 0, hechos: 0 };
    c.total += 1;
    if (t.status === "DONE") c.hechos += 1;
    hijosDe.set(t.parentId, c);
  }

  const grouped: Record<TaskStatus, TaskRow[]> = {
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };
  for (const t of all) {
    if (t.parentId) continue;
    const s = (t.status as TaskStatus) ?? "TODO";
    if (!(s in grouped)) continue;
    if (filtro.categoriaId && t.categoryId !== filtro.categoriaId) continue;
    const prioridad = resolvePrioridad(t.priority);
    if (filtro.prioridad && prioridad !== filtro.prioridad) continue;
    grouped[s].push({
      id: t.id,
      title: t.title,
      description: t.description,
      status: s,
      order: t.order,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      categoryId: t.categoryId,
      priority: prioridad,
      hijos: hijosDe.get(t.id) ?? { total: 0, hechos: 0 },
    });
  }
  return grouped;
}
```

- [x] **Paso 5: `projects.ts` usa el árbol compartido**

En `getProjectWithTree`, sustituye el montaje a mano del árbol (el bloque
`// build tree` con su `map`, sus `roots` y su bucle) por:

```ts
  const roots = buildTaskTree(
    items.map((it) => ({
      id: it.id,
      parentId: it.parentId,
      title: it.title,
      status: (it.status as TaskStatus) ?? "TODO",
      order: it.order,
      createdAt: it.createdAt,
      completedAt: it.completedAt,
      // `?? id` no es defensa por si acaso: la consulta filtra por
      // `projectId = id`, así que esto solo le dice a TypeScript lo que el SQL
      // ya garantiza, y de paso el nodo sale con `projectId: string` en vez de
      // `string | null`. `ProjectTreeItem` se lo pasa a `createProjectTask`,
      // que exige un string.
      projectId: it.projectId ?? id,
    })),
  );
```

Con el import `import { buildTaskTree, type TaskStatus } from "./tasks";`.

Y ahora sí, la definición local de `ProjectItemNode` que la Tarea 1 dejó en su
sitio pasa a apoyarse en el nodo genérico, conservando exactamente la misma
forma que tenía:

```ts
/**
 * Un nodo del árbol de un proyecto. Es una tarea con hijos: desde la
 * unificación no hay un tipo aparte para «elemento de proyecto», solo este
 * alias, que fija `projectId` como `string` porque dentro de un proyecto
 * siempre lo hay.
 */
export type ProjectItemNode = TaskTreeNode<{
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  status: TaskStatus;
  order: number;
  createdAt: Date;
  completedAt: Date | null;
}>;
```

Importando también `type TaskTreeNode` de `./tasks`. `ProjectTree.tsx` y
`ProjectTreeItem.tsx` **no cambian de tipos**: la forma es la de siempre.

La función `counts` recursiva se queda: cuenta, no monta.

- [x] **Paso 6: Verificar**

```bash
npx vitest run && npx tsc --noEmit && npm run lint
```

Esperado: verde. `projects.test.ts` no debería necesitar ni un cambio: el árbol
que devuelve tiene la misma forma.

- [x] **Paso 7: Commit**

```bash
git add -A src
git commit -m "feat(tareas): el arbol sube a tasks.ts y el tablero filtra por URL"
```

---

### Tarea 5: La pantalla

**Files:**
- Create: `src/modules/habitos/components/tasks/PriorityDot.tsx`
- Create: `src/modules/habitos/components/tasks/FilterBar.tsx`
- Create: `src/modules/habitos/components/tasks/CategoriesPanel.tsx`
- Modify: `src/modules/habitos/components/tasks/TaskCard.tsx`
- Modify: `src/modules/habitos/components/tasks/TasksBoard.tsx`
- Modify: `src/modules/habitos/components/tasks/NewTaskForm.tsx`
- Modify: `src/modules/habitos/lib/mutations.ts`
- Modify: `src/app/tareas/page.tsx`

- [x] **Paso 1: El punto**

`src/modules/habitos/components/tasks/PriorityDot.tsx`:

```tsx
import {
  PRIORIDAD_DEFS,
  prioridadColorVar,
  type Prioridad,
} from "@/modules/habitos/lib/prioridad";

/**
 * El punto de prioridad. Color Y tamaño: dos señales, no una.
 *
 * El borde de 2px en tinta es lo que lo separa del papel; sin él, `mint` a 6px
 * sobre papel casi no se ve. Y el `title` lo dice en palabras, que es la tercera
 * señal y la única que sirve con un lector de pantalla.
 */
export function PriorityDot({ prioridad }: { prioridad: Prioridad }) {
  const { label, punto } = PRIORIDAD_DEFS[prioridad];
  return (
    <span
      title={label}
      aria-label={`Prioridad: ${label}`}
      role="img"
      style={{
        width: punto,
        height: punto,
        borderRadius: 999,
        background: prioridadColorVar(prioridad),
        border: "2px solid var(--color-line)",
        display: "inline-block",
        flexShrink: 0,
        // Alinea el punto con la primera línea del título sea cual sea su
        // tamaño: sin esto, el de 15px empuja el texto hacia abajo.
        marginTop: 2,
      }}
    />
  );
}
```

- [x] **Paso 2: La barra de filtros**

`src/modules/habitos/components/tasks/FilterBar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { varColor } from "@/modules/core/ui/paleta";
import type { Categoria } from "@/modules/habitos/lib/categorias";
import {
  PRIORIDADES,
  PRIORIDAD_DEFS,
  prioridadColorVar,
  type Prioridad,
} from "@/modules/habitos/lib/prioridad";
import type { TaskFilter } from "@/modules/habitos/lib/tasks";

/*
  Los filtros son ENLACES y no botones. Cambiar de filtro es cambiar de URL, y
  un enlace ya sabe hacer eso: se puede abrir en otra pestaña, se puede copiar,
  y «atrás» funciona sin escribir una línea de historial a mano.
*/
const CHIP =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control " +
  "border-3 border-line text-tinta font-cuerpo text-xs no-underline " +
  "transition-[transform,box-shadow] duration-75 ease-out " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line";

function href(filtro: TaskFilter, cambio: Partial<TaskFilter>): string {
  const f = { ...filtro, ...cambio };
  const p = new URLSearchParams();
  if (f.categoriaId) p.set("cat", f.categoriaId);
  if (f.prioridad) p.set("pri", f.prioridad);
  const q = p.toString();
  return q ? `/tareas?${q}` : "/tareas";
}

export function FilterBar({
  categorias,
  filtro,
}: {
  categorias: Categoria[];
  filtro: TaskFilter;
}) {
  const hayFiltro = filtro.categoriaId !== null || filtro.prioridad !== null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {PRIORIDADES.map((p: Prioridad) => {
        const activo = filtro.prioridad === p;
        return (
          <Link
            key={p}
            href={href(filtro, { prioridad: activo ? null : p })}
            aria-current={activo ? "true" : undefined}
            className={CHIP}
            style={{
              background: activo ? prioridadColorVar(p) : "var(--color-paper)",
              boxShadow: activo ? "var(--shadow-hard)" : "none",
            }}
          >
            <span
              style={{
                width: PRIORIDAD_DEFS[p].punto,
                height: PRIORIDAD_DEFS[p].punto,
                borderRadius: 999,
                background: prioridadColorVar(p),
                border: "2px solid var(--color-line)",
              }}
            />
            {PRIORIDAD_DEFS[p].label}
          </Link>
        );
      })}

      {categorias.map((c) => {
        const activo = filtro.categoriaId === c.id;
        return (
          <Link
            key={c.id}
            href={href(filtro, { categoriaId: activo ? null : c.id })}
            aria-current={activo ? "true" : undefined}
            className={CHIP}
            style={{
              background: activo ? varColor(c.color) : "var(--color-paper)",
              boxShadow: activo ? "var(--shadow-hard)" : "none",
              // El filo lleva el color aunque el chip esté apagado: es lo que
              // permite reconocer la categoría sin tener que activarla.
              borderBottom: `3px solid ${varColor(c.color)}`,
            }}
          >
            {c.name}
          </Link>
        );
      })}

      {hayFiltro ? (
        <Link href="/tareas" className={`${CHIP} bg-paper-2`}>
          ✕ Quitar filtros
        </Link>
      ) : null}
    </div>
  );
}
```

- [x] **Paso 2b: Gestionar las categorías**

Sin esto no hay forma de crear ninguna y los filtros de categoría están siempre
vacíos. `FilterBar` solo lee; esto es lo que escribe.

`src/modules/habitos/components/tasks/CategoriesPanel.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { COLORES, varColor } from "@/modules/core/ui/paleta";
import {
  borrarCategoria,
  cambiarColorCategoria,
  crearCategoria,
  renombrarCategoria,
} from "@/modules/habitos/actions";
import type { Categoria } from "@/modules/habitos/lib/categorias";
import { useConfirm } from "@/modules/habitos/components/ConfirmDialog";

const MUESTRA =
  "w-5 h-5 rounded-control border-3 border-line cursor-pointer shrink-0 " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line";

const CHIP =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control " +
  "border-3 border-line text-tinta font-cuerpo text-xs cursor-pointer bg-paper";

export function CategoriesPanel({ categorias }: { categorias: Categoria[] }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState<string>("pink");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  function crear() {
    if (!nombre.trim()) return;
    startTransition(async () => {
      const r = await crearCategoria(nombre, color);
      if (r.ok) {
        setNombre("");
        setAviso(null);
      } else {
        // El motivo se traduce aquí y no en `lib/`: la capa de datos devuelve
        // una causa, no una frase para una persona.
        setAviso(r.motivo === "repetida" ? "Esa ya existe" : "Ponle un nombre");
      }
    });
  }

  async function borrar(c: Categoria) {
    const ok = await confirm({
      title: "Borrar categoría",
      message:
        c.taskCount > 0
          ? `"${c.name}" está en ${c.taskCount} tarea(s). Se quedarán sin categoría, no se borran.`
          : `Se borrará "${c.name}".`,
    });
    if (!ok) return;
    startTransition(() => borrarCategoria(c.id));
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={CHIP}>
        ✎ Categorías
      </button>
    );
  }

  return (
    <div
      style={{
        background: "var(--color-paper)",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-hard)",
        padding: 14,
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        width: "100%",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") crear();
            if (e.key === "Escape") setAbierto(false);
          }}
          placeholder="Nueva categoría"
          maxLength={40}
          className="bg-paper-2 text-tinta font-cuerpo text-[13.5px] border-3 border-line rounded-control px-2.5 py-2 w-48 placeholder:text-tinta-2 outline-none focus:outline-3 focus:outline-offset-2 focus:outline-line"
        />
        {COLORES.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setColor(k)}
            aria-label={k}
            aria-pressed={color === k}
            className={MUESTRA}
            style={{
              background: varColor(k),
              boxShadow: color === k ? "var(--shadow-hard)" : "none",
            }}
          />
        ))}
        <button
          type="button"
          onClick={crear}
          disabled={pending || !nombre.trim()}
          className={`${CHIP} disabled:opacity-40`}
        >
          Crear
        </button>
        <button type="button" onClick={() => setAbierto(false)} className={CHIP}>
          Cerrar
        </button>
      </div>

      {aviso ? <div style={{ fontSize: 12 }}>{aviso}</div> : null}

      {categorias.map((c) => (
        <div
          key={c.id}
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        >
          <input
            defaultValue={c.name}
            maxLength={40}
            onBlur={(e) => {
              const v = e.target.value;
              if (v.trim() && v !== c.name) {
                startTransition(() => renombrarCategoria(c.id, v).then(() => {}));
              }
            }}
            className="bg-paper-2 text-tinta font-cuerpo text-[13px] border-3 border-line rounded-control px-2 py-1 w-40 outline-none focus:outline-3 focus:outline-offset-2 focus:outline-line"
            style={{ borderBottom: `3px solid ${varColor(c.color)}` }}
          />
          {COLORES.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => startTransition(() => cambiarColorCategoria(c.id, k))}
              aria-label={`${c.name} en ${k}`}
              aria-pressed={c.color === k}
              className={MUESTRA}
              style={{
                background: varColor(k),
                boxShadow: c.color === k ? "var(--shadow-hard)" : "none",
              }}
            />
          ))}
          <span style={{ fontSize: 11.5 }}>{c.taskCount} tarea(s)</span>
          <button
            type="button"
            onClick={() => borrar(c)}
            className={`${CHIP} bg-peach`}
            aria-label={`Borrar ${c.name}`}
          >
            ✕
          </button>
        </div>
      ))}
      {dialog}
    </div>
  );
}
```

Y en `FilterBar`, al final del contenedor, junto a «Quitar filtros»:

```tsx
      <CategoriesPanel categorias={categorias} />
```

con `import { CategoriesPanel } from "./CategoriesPanel";`.

> El renombrado se dispara en `onBlur` y no con un botón: son campos que se
> editan de uno en uno y volver a pulsar «guardar» por cada uno sobra. Si
> `renombrarCategoria` devuelve `{ ok: false }` porque el nombre choca, el
> campo se queda con lo escrito y `refresh()` lo devuelve al valor real en el
> siguiente pintado.

- [x] **Paso 3: La tarjeta**

En `TaskCard.tsx`, amplía las props y sustituye el bloque del título:

```tsx
import { PriorityDot } from "./PriorityDot";
import { varColor, type ColorCategorico } from "@/modules/core/ui/paleta";

export function TaskCard({
  task,
  categoria,
}: {
  task: TaskRow;
  categoria?: { name: string; color: ColorCategorico };
}) {
```

Y el título pasa de un `<div>` suelto a título con punto y subrayado:

```tsx
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {task.priority ? <PriorityDot prioridad={task.priority} /> : null}
        <div style={{ minWidth: 0 }}>
          {/* Lo hecho se tacha en vez de apagarse de color: sobre papel, bajar
              el tono se come el contraste, y el tachado se ve sin distinguir
              tonos. */}
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              textDecoration: done ? "line-through" : "none",
              // El subrayado de categoría es un borde y no `text-decoration`,
              // que ya lo usa el tachado. Los dos a la vez en la misma
              // propiedad no caben.
              borderBottom: categoria
                ? `3px solid ${varColor(categoria.color)}`
                : "none",
              paddingBottom: categoria ? 2 : 0,
              display: "inline-block",
            }}
          >
            {task.title}
          </div>
          {categoria ? (
            <div style={{ fontSize: 11, marginTop: 3 }}>{categoria.name}</div>
          ) : null}
        </div>
      </div>
```

Y bajo la descripción, el conteo de subtareas:

```tsx
      {task.hijos.total > 0 ? (
        <div style={{ fontSize: 11.5, marginTop: 6 }}>
          {task.hijos.total} subtarea{task.hijos.total === 1 ? "" : "s"} ·{" "}
          {task.hijos.hechos} hecha{task.hijos.hechos === 1 ? "" : "s"}
        </div>
      ) : null}
```

- [x] **Paso 4: El tablero pasa las categorías**

En `TasksBoard.tsx`, añade la prop y el mapa:

```tsx
import type { Categoria } from "@/modules/habitos/lib/categorias";

type Props = {
  grouped: Record<TaskStatus, TaskRow[]>;
  categorias: Categoria[];
};

export function TasksBoard({ grouped, categorias }: Props) {
  const porId = new Map(categorias.map((c) => [c.id, c]));
```

Y en el `map` de tarjetas:

```tsx
              grouped[status].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  categoria={
                    task.categoryId
                      ? porId.get(task.categoryId) ?? undefined
                      : undefined
                  }
                />
              ))
```

- [x] **Paso 5: El formulario elige categoría y prioridad**

En `NewTaskForm.tsx`, añade dos estados y dos selectores. Las props crecen:

```tsx
export function NewTaskForm({
  onDone,
  categorias,
}: {
  onDone: () => void;
  categorias: Categoria[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
```

En `submit`, antes de `startTransition`:

```tsx
    if (prioridad) fd.set("priority", prioridad);
    if (categoriaId) fd.set("categoryId", categoriaId);
```

Y entre la descripción y los botones, los dos selectores:

```tsx
      <div>
        <span className="block text-xs font-semibold text-tinta font-cuerpo mb-1.5">
          Prioridad (opcional)
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRIORIDADES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrioridad(prioridad === p ? null : p)}
              aria-pressed={prioridad === p}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control border-3 border-line text-tinta font-cuerpo text-xs cursor-pointer"
              style={{
                background:
                  prioridad === p ? prioridadColorVar(p) : "var(--color-paper)",
                boxShadow: prioridad === p ? "var(--shadow-hard)" : "none",
              }}
            >
              <span
                style={{
                  width: PRIORIDAD_DEFS[p].punto,
                  height: PRIORIDAD_DEFS[p].punto,
                  borderRadius: 999,
                  background: prioridadColorVar(p),
                  border: "2px solid var(--color-line)",
                }}
              />
              {PRIORIDAD_DEFS[p].label}
            </button>
          ))}
        </div>
      </div>

      {categorias.length > 0 ? (
        <div>
          <span className="block text-xs font-semibold text-tinta font-cuerpo mb-1.5">
            Categoría (opcional)
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoriaId(categoriaId === c.id ? null : c.id)}
                aria-pressed={categoriaId === c.id}
                className="px-2.5 py-1 rounded-control border-3 border-line text-tinta font-cuerpo text-xs cursor-pointer"
                style={{
                  background:
                    categoriaId === c.id ? varColor(c.color) : "var(--color-paper)",
                  borderBottom: `3px solid ${varColor(c.color)}`,
                  boxShadow: categoriaId === c.id ? "var(--shadow-hard)" : "none",
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
```

Con los imports que hacen falta:

```tsx
import { varColor } from "@/modules/core/ui/paleta";
import type { Categoria } from "@/modules/habitos/lib/categorias";
import {
  PRIORIDADES,
  PRIORIDAD_DEFS,
  prioridadColorVar,
  type Prioridad,
} from "@/modules/habitos/lib/prioridad";
```

Y `TasksHeader`, que es quien monta el formulario, pasa la lista a través:

```tsx
export function TasksHeader({
  total,
  categorias,
}: {
  total: number;
  categorias: Categoria[];
}) {
```

```tsx
      {open ? (
        <NewTaskForm onDone={() => setOpen(false)} categorias={categorias} />
      ) : null}
```

Con `import type { Categoria } from "@/modules/habitos/lib/categorias";` arriba.

- [x] **Paso 6: `createTask` guarda los dos campos**

En `mutations.ts`, dentro de `createTask`, antes del insert:

```ts
  const priority = resolvePrioridad(String(formData.get("priority") ?? "") || null);
  const categoryId = text(formData.get("categoryId"), 60);
```

Y en `.values({ … })`, `priority` y `categoryId`.

> `categoryId` no se valida contra la tabla: si llega un id que no existe, la
> foránea de la base nueva lo rechaza y en la puesta al día queda apuntando a
> nada, que se resuelve a «sin categoría» al pintar. Validar aquí obligaría a
> una consulta por cada creación para un caso que solo ocurre manipulando la
> petición a mano.

Añade el import `import { resolvePrioridad } from "./prioridad";`.

- [x] **Paso 7: La página**

`src/app/tareas/page.tsx`, sustituyendo la cabecera de la función:

```tsx
import { db } from "@/modules/core/db";
import {
  getTasksGrouped,
  getTaskMetrics,
  listCategorias,
} from "@/modules/habitos";
import { parseTaskFilter } from "@/modules/habitos/lib/tasks";
import { FilterBar } from "@/modules/habitos/components/tasks/FilterBar";

export const dynamic = "force-dynamic";

/*
  `searchParams` es una PROMESA en esta versión de Next y hay que esperarla.
  Verificado en node_modules/next/dist/docs/01-app/01-getting-started/
  03-layouts-and-pages.md, sección «Rendering with search params».
*/
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const filtro = parseTaskFilter(await searchParams);
  const [grouped, metrics, categorias] = await Promise.all([
    getTasksGrouped(db, filtro),
    getTaskMetrics(db),
    listCategorias(db),
  ]);
```

Y en el cuerpo, entre `TasksHeader` y el tablero:

```tsx
        <TasksHeader total={total} categorias={categorias} />
        <FilterBar categorias={categorias} filtro={filtro} />
```

Y el estado vacío distingue los dos casos:

```tsx
        {total === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {filtro.categoriaId || filtro.prioridad
                ? "Ninguna tarea pasa este filtro."
                : "Aún no tienes tareas."}
            </p>
            <p style={{ fontSize: 13 }}>
              {filtro.categoriaId || filtro.prioridad
                ? "Prueba a quitar el filtro de arriba."
                : "Crea la primera y esta pantalla empezará a medir tu ritmo."}
            </p>
          </Card>
        ) : (
          <>
            <TasksBoard grouped={grouped} categorias={categorias} />
            <FlowPanel metrics={metrics} />
          </>
        )}
```

> El `total` se calcula sobre `grouped`, que ya viene filtrado. Eso es lo que
> hace que un filtro sin resultados enseñe el mensaje en vez de tres columnas
> vacías.

`listCategorias` tiene que estar exportada en `src/modules/habitos/index.ts`
(Tarea 3, paso 5). `parseTaskFilter` se importa de `lib/` solo si `index.ts` no
la exporta; si prefieres respetar la frontera del módulo, expórtala allí y
cambia el import.

- [x] **Paso 8: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [x] **Paso 9: Commit**

```bash
git add -A src
git commit -m "feat(tareas): punto de prioridad, subrayado de categoria y filtros en la URL"
```

---

### Tarea 5b: La integridad que el motor no vigila

Añadida durante la ejecución. El spec ya avisaba de que en la base puesta al
día las tres foráneas nuevas no las vigila SQLite —no admite `ALTER TABLE ADD
COLUMN` con referencia— y de que ahí «la integridad la sostiene el código». Al
llegar a la verificación, el código no la sostenía: solo confiaba en el
esquema, que en esa base no existe.

El caso grave era borrar una tarea con subtareas. `getTasksGrouped` se salta
toda tarea con padre, así que un hijo con el `parent_id` colgando no salía en
el tablero NI debajo de nadie: **desaparecía de la vista sin que nadie lo
hubiera borrado**.

- [x] `deleteTaskById` baja por el árbol y borra los descendientes
- [x] `deleteProject` pone `projectId` a null antes de borrar
- [x] `deleteCategoria` pone `categoryId` a null antes de borrar
- [x] `integridad.test.ts`, que corre contra una base con la forma de la real
      —esquema auténtico y `tasks` rehecha sin foráneas— porque contra
      `createTestDb()` estos tests pasarían sin que el código hiciera nada

---

### Tarea 6: Verificación final

- [x] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [x] **Paso 2: Que no quede rastro de la tabla vieja**

```bash
grep -rn "projectItems\|project_items" src/ || echo "sin restos"
```

Esperado: **sin restos**. El único sitio donde puede aparecer `project_items`
es `core/db/migrar.ts` y su test, que es donde tiene que estar.

- [x] **Paso 3: La base real**

```bash
node -e "
const D=require('better-sqlite3');const d=new D('data/juampi.db',{readonly:true});
console.log('tareas:', d.prepare('select id,title,project_id,parent_id,priority,category_id from tasks').all());
console.log('project_items:', d.prepare(\"select count(*) c from sqlite_master where type='table' and name='project_items'\").get());
"
```

Esperado: `project_items` a 0 y las cuatro columnas nuevas presentes.

Nota de la ejecución: la tarea que había —«Probar la migración a Drizzle»— ya no
está, y **no la borró la migración**. El registro del servidor muestra que la
borró el usuario desde el navegador mientras esto se ejecutaba
(`ƒ deleteTask({})`), entre dos peticiones suyas a `/tareas`. La copia de
seguridad la conserva.

- [x] **Paso 4: En pantalla**

Con el servidor en marcha, en `http://127.0.0.1:3000/tareas`:

1. Crea una categoría y comprueba que aparece como chip.
2. Crea una tarea con prioridad Urgente y esa categoría.
3. Comprueba el punto grande a la izquierda y el subrayado bajo el título.
4. Pincha el chip de Urgente: la URL pasa a `/tareas?pri=URGENT`.
5. **Recarga la página**: el filtro sigue puesto.
6. Pincha «atrás»: vuelve a `/tareas` sin filtro.

- [x] **Paso 5: Que los cuatro puntos se distingan**

En la consola del navegador, con los cuatro chips de prioridad a la vista:

```js
[...document.querySelectorAll('a[href*="pri="] span')].map(s => {
  const c = getComputedStyle(s);
  return `${c.width} ${c.backgroundColor}`;
})
```

Esperado: cuatro anchos distintos —15, 12, 9 y 6 px— y cuatro colores distintos.

- [x] **Paso 6: Que borrar un proyecto ya no borre su trabajo**

Se comprobó con un test y NO a mano en el navegador, a propósito: hacerlo en
vivo obligaba a crear y borrar un proyecto en la base real del usuario, que
estaba usando la aplicación en ese momento.

El test es además más fuerte que la comprobación manual. Vive en
`integridad.test.ts` y corre contra una base con la forma de la real —esquema
auténtico y `tasks` rehecha sin foráneas—, así que comprueba el caso que de
verdad importa: el de una base donde el motor no vigila nada. Una comprobación
en el navegador solo habría probado ese mismo caso, sin dejar nada que lo
proteja mañana.

- [x] **Paso 7: Marcar el plan y el spec como ejecutados**

Marca las casillas y anota cualquier desvío en el propio documento, con el
motivo. Un plan que dice lo que se pensaba hacer y no lo que se hizo no sirve
para nada la próxima vez.

---

## Criterios de aceptación

- [x] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [x] 2. `project_items` no existe ni en el esquema ni en la base
- [x] 3. La migración corre dos veces seguidas sin cambiar nada la segunda
- [x] 4. Un elemento de proyecto anidado sobrevive con su padre y su proyecto
- [x] 5. Borrar un proyecto deja sus tareas vivas y sin proyecto
- [x] 6. Una tarea admite una categoría y una prioridad, ambas opcionales
- [x] 7. Los filtros van en la URL y sobreviven a una recarga
- [x] 8. Los cuatro puntos se distinguen por tamaño además de por color
- [x] 9. En `projects.test.ts` solo cambian nombres de tabla y de columna
- [x] 10. El tablero solo muestra tareas raíz, y las que tienen hijos lo dicen
- [x] 11. Existe `data/juampi.db.antes-de-unificar.bak`
- [x] 12. Las categorías se pueden crear, renombrar, recolorear y borrar desde
     la propia pantalla de tareas
