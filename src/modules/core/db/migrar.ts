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
 * Las columnas que cada tabla fue ganando después de su creación.
 *
 * Van SIN clave foránea y anulables a propósito. SQLite no admite `ADD COLUMN`
 * con referencia, ni con NOT NULL sin valor por defecto; declararlas obligaría a
 * recrear la tabla entera y copiar sus filas, y eso es mucho riesgo. En las
 * bases NUEVAS sí llevan su foránea, porque `SCHEMA_SQL` las crea de golpe.
 *
 * Consecuencia real y consciente: en la base que se pone al día, la integridad
 * de las referencias de `tasks` la sostiene el código y no el motor.
 */
const COLUMNAS_NUEVAS: Record<string, [string, string][]> = {
  tasks: [
    ["parent_id", "TEXT"],
    ["project_id", "TEXT"],
    ["category_id", "TEXT"],
    ["priority", "TEXT"],
  ],
  /** El objetivo numérico del día. Nulo = este hábito no se cuenta. */
  habits: [["target_count", "INTEGER"]],
  /** Lo apuntado ese día. Nulo = no se apuntó cantidad. */
  habit_logs: [["count", "INTEGER"]],
};

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
 * Los índices de las columnas nuevas.
 *
 * Se crean AQUÍ y no en `SCHEMA_SQL` por una cuestión de orden. Allí, sobre una
 * base que ya existía, el `CREATE TABLE IF NOT EXISTS` no hace nada porque la
 * tabla ya está —pero el `CREATE INDEX` sí se ejecuta, y apuntaría a columnas
 * que todavía no se han añadido. Reventaba con «no such column: parent_id» en
 * el primer arranque.
 *
 * Aquí van después de los `ALTER TABLE`, así que las columnas existen seguro.
 */
const INDICES_NUEVOS = [
  "CREATE INDEX IF NOT EXISTS tasks_parent_idx   ON tasks(parent_id)",
  "CREATE INDEX IF NOT EXISTS tasks_project_idx  ON tasks(project_id)",
  "CREATE INDEX IF NOT EXISTS tasks_category_idx ON tasks(category_id)",
];

export function ponerAlDia(sqlite: Sqlite): void {
  for (const [tabla, columnas] of Object.entries(COLUMNAS_NUEVAS)) {
    const tiene = columnasDe(sqlite, tabla);
    // `pragma table_info` de una tabla que no existe devuelve vacío: si la tabla
    // no está, no hay nada que poner al día.
    if (tiene.size === 0) continue;
    for (const [nombre, tipo] of columnas) {
      if (!tiene.has(nombre)) {
        sqlite.exec(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${tipo}`);
      }
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
