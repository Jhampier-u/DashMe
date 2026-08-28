/**
 * Auto-creación idempotente de tablas al abrir la conexión. Red de seguridad
 * para el arranque en una máquina nueva; los cambios de esquema a partir de
 * aquí deberían pasar por migraciones versionadas (`npm run db:generate`).
 *
 * Lo comparten la base real y la de test, así que si esto se desincroniza del
 * esquema de Drizzle, los tests se enteran.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS habits (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT 'star',
  color         TEXT NOT NULL DEFAULT 'aqua',
  plant_species TEXT NOT NULL DEFAULT 'flower',
  minimal_goal  TEXT,
  is_anchor     INTEGER NOT NULL DEFAULT 0,
  schedule      TEXT NOT NULL DEFAULT '1111111',
  intention     TEXT,
  target_count  INTEGER,
  garden_slot   INTEGER,
  internalized_at INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       INTEGER NOT NULL,
  partial    INTEGER NOT NULL DEFAULT 0,
  shielded   INTEGER NOT NULL DEFAULT 0,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  count      INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS habit_logs_habit_date_unq ON habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS habit_logs_date_idx ON habit_logs(date);

CREATE TABLE IF NOT EXISTS habit_notes (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       INTEGER NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
-- Una nota por habito y dia, mismo patron que habit_logs.
--
-- Tabla aparte y NO una columna de habit_logs a proposito: si fuera una columna,
-- escribir una nota en un dia que no cumpliste obligaria a crear el registro de
-- ese dia, o sea a marcar el habito como hecho para poder decir que no lo
-- hiciste. Y ese es justo el dia en que mas quieres escribir algo.
CREATE UNIQUE INDEX IF NOT EXISTS habit_notes_habit_date_unq
  ON habit_notes(habit_id, date);

CREATE TABLE IF NOT EXISTS habit_pauses (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  from_day   INTEGER NOT NULL,
  to_day     INTEGER NOT NULL,
  reason     TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS habit_pauses_habit_idx ON habit_pauses(habit_id);
-- Los rangos PUEDEN solaparse y no se impide: la pregunta que se hace siempre es
-- si un dia cae dentro de ALGUNA pausa, asi que solapar es inofensivo.
-- Prohibirlo obligaria a validar contra todas las demas en cada guardado.
--
-- from_day y to_day son claves de dia normalizadas, y los dos extremos ENTRAN.

CREATE TABLE IF NOT EXISTS habit_automaticity (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  week       INTEGER NOT NULL,
  i1         INTEGER NOT NULL,
  i2         INTEGER NOT NULL,
  i3         INTEGER NOT NULL,
  i4         INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CHECK (i1 BETWEEN 1 AND 7),
  CHECK (i2 BETWEEN 1 AND 7),
  CHECK (i3 BETWEEN 1 AND 7),
  CHECK (i4 BETWEEN 1 AND 7)
);
-- El SRBAI de Gardner, Abraham, Lally y de Bruijn (2012): cuatro items que
-- miden AUTOMATICIDAD, que no es lo mismo que frecuencia. La racha cuenta dias
-- seguidos; esto pregunta si ya no tienes que querer hacerlo.
--
-- Una medida por habito y semana, y la columna week es la clave de dia del
-- lunes. El indice unico impide contestar dos veces la misma semana y falsear
-- la curva a base de repetir.
--
-- Los cuatro items se guardan por separado y NO su media: la media se calcula
-- al leer. Guardar solo el resumen impediria revisar despues si un item se
-- comporta distinto, y el numero derivado siempre puede recalcularse.
--
-- El CHECK del 1 al 7 es el rango de la escala. Sin el, un fallo de la interfaz
-- entraria como dato valido y ensuciaria la curva en silencio.
CREATE UNIQUE INDEX IF NOT EXISTS habit_automaticity_habit_week_unq
  ON habit_automaticity(habit_id, week);

CREATE TABLE IF NOT EXISTS player (
  id              TEXT PRIMARY KEY,
  xp              INTEGER NOT NULL DEFAULT 0,
  xp_spent        INTEGER NOT NULL DEFAULT 0,
  shields         INTEGER NOT NULL DEFAULT 2,
  shields_updated INTEGER NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_quests (
  id           TEXT PRIMARY KEY,
  date         INTEGER NOT NULL,
  kind         TEXT NOT NULL,
  target       INTEGER NOT NULL DEFAULT 1,
  progress     INTEGER NOT NULL DEFAULT 0,
  xp_reward    INTEGER NOT NULL DEFAULT 50,
  completed    INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_quests_date_kind_unq ON daily_quests(date, kind);
CREATE INDEX IF NOT EXISTS daily_quests_date_idx ON daily_quests(date);

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

-- tasks absorbió a project_items: una tarea es una tarea, tenga proyecto o no.
-- Va DESPUÉS de las dos tablas a las que apunta; SQLite resuelve las foráneas
-- al usarlas y no al crearlas, así que el orden no es obligatorio, se pone así
-- para que se lea de arriba abajo.
--
-- Sin acentos graves en estos comentarios: SCHEMA_SQL es una plantilla literal
-- y cualquiera de ellos la cerraría a media cadena.
--
-- Las tres foráneas borran de tres maneras y cada una es una decisión:
--   parent_id  CASCADE  — una subtarea sin padre no significa nada
--   project_id SET NULL — borrar el contenedor no se lleva el trabajo
--   category_id SET NULL — borrar una etiqueta tampoco
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
CREATE TABLE IF NOT EXISTS task_attachments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  name       TEXT NOT NULL,
  url        TEXT,
  stored_as  TEXT,
  size       INTEGER,
  mime       TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS task_attachments_task_idx ON task_attachments(task_id);
-- Esta foránea SÍ la vigila el motor también en la base del usuario, al
-- contrario que las columnas que se añadieron con ALTER: la tabla es nueva y
-- nace con la referencia declarada. (Sin acentos graves aquí: esto es una
-- plantilla literal y cualquiera de ellos la cerraría a media cadena.)
--
-- Y sus índices sí pueden ir aquí, por lo mismo: se crean junto a la tabla, no
-- sobre una que ya existía sin las columnas.

-- Los índices de parent_id, project_id y category_id NO van aquí: los crea
-- ponerAlDia(), que corre justo después.
--
-- El motivo es de orden. Sobre una base que ya existía, la sentencia de arriba
-- no hace nada porque la tabla ya está, pero un índice sí se crearía, y
-- apuntaría a columnas que todavía no se han añadido. Reventaba con "no such
-- column: parent_id" en el primer arranque.
--
-- (Y sin escribir aquí las dos palabras del DDL: tests/schema-parity.test.ts
-- cuenta tablas con una expresión regular sobre este texto, comentarios
-- incluidos.)

-- Aqui vivian las tablas de musica (Voidtify). El modulo salio del dashboard
-- el 8 de agosto de 2026 y volvio a ser una app aparte.
--
-- Quitarlas de aqui NO borra nada: cada sentencia era un CREATE ... IF NOT
-- EXISTS, o sea que solo se ejecutaba cuando la tabla faltaba. En la base del
-- usuario las filas siguen donde estaban, intactas; lo unico que cambia es que
-- este fichero deja de crearlas en una base nueva. Si musica vuelve, se
-- recupera este bloque de la etiqueta musica-antes-de-salir.

CREATE TABLE IF NOT EXISTS garden_decorations (
  kind       TEXT PRIMARY KEY,
  precio     INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`;
