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
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       INTEGER NOT NULL,
  partial    INTEGER NOT NULL DEFAULT 0,
  shielded   INTEGER NOT NULL DEFAULT 0,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS habit_logs_habit_date_unq ON habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS habit_logs_date_idx ON habit_logs(date);

CREATE TABLE IF NOT EXISTS player (
  id              TEXT PRIMARY KEY,
  xp              INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'TODO',
  "order"      INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT NOT NULL DEFAULT '📁',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_items (
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
CREATE INDEX IF NOT EXISTS project_items_project_idx ON project_items(project_id);
CREATE INDEX IF NOT EXISTS project_items_parent_idx ON project_items(parent_id);
`;
