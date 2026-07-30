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

-- ─── música (Voidtify) ────────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS artists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      genres TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS artists_updated_at ON artists(updated_at);

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT 'acid',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS track_tags (
      track_uri TEXT NOT NULL,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (track_uri, tag_id)
    );
    CREATE INDEX IF NOT EXISTS track_tags_tag_idx ON track_tags(tag_id);

    CREATE TABLE IF NOT EXISTS liked_tracks (
      uri TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      artists_json TEXT NOT NULL,
      album_id TEXT,
      album_name TEXT,
      album_image TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      explicit INTEGER NOT NULL DEFAULT 0,
      added_at TEXT,
      scanned_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS liked_tracks_added_at_idx ON liked_tracks(added_at);

    CREATE TABLE IF NOT EXISTS smart_playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      rules_json TEXT NOT NULL DEFAULT '{}',
      spotify_playlist_id TEXT,
      last_synced_at INTEGER,
      last_sync_count INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS streams (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ts            INTEGER NOT NULL,
      ms_played     INTEGER NOT NULL,
      track_uri     TEXT,
      track_name    TEXT NOT NULL,
      artist_name   TEXT NOT NULL,
      album_name    TEXT,
      track_key     TEXT NOT NULL,
      artist_key    TEXT NOT NULL,
      album_key     TEXT,
      local_date    TEXT NOT NULL,
      local_hour    INTEGER NOT NULL,
      reason_start  TEXT,
      reason_end    TEXT,
      shuffle       INTEGER,
      skipped       INTEGER,
      platform      TEXT,
      source        TEXT NOT NULL CHECK (source IN ('live', 'import')),
      dedup_key     TEXT NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS streams_ts_idx         ON streams(ts);
    CREATE INDEX IF NOT EXISTS streams_artist_idx     ON streams(artist_key, ts);
    CREATE INDEX IF NOT EXISTS streams_track_idx      ON streams(track_key, ts);
    CREATE INDEX IF NOT EXISTS streams_album_idx      ON streams(album_key, ts);
    CREATE INDEX IF NOT EXISTS streams_local_date_idx ON streams(local_date);
    CREATE INDEX IF NOT EXISTS streams_local_hour_idx ON streams(local_hour);
    CREATE INDEX IF NOT EXISTS streams_source_ts_idx  ON streams(source, ts);

    CREATE TABLE IF NOT EXISTS spotify_credentials (
      id               INTEGER PRIMARY KEY CHECK (id = 1),
      spotify_user_id  TEXT NOT NULL,
      refresh_token    TEXT NOT NULL,
      access_token     TEXT,
      expires_at       INTEGER,
      updated_at       INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS capture_state (
      id                INTEGER PRIMARY KEY CHECK (id = 1),
      last_played_at    INTEGER,
      last_run_at       INTEGER,
      last_run_status   TEXT,
      last_run_inserted INTEGER,
      last_error        TEXT,
      gap_suspected_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      filename      TEXT NOT NULL,
      file_hash     TEXT,
      format        TEXT,
      rows_read     INTEGER,
      rows_inserted INTEGER,
      rows_skipped  INTEGER,
      rows_invalid  INTEGER,
      range_start   INTEGER,
      range_end     INTEGER,
      imported_at   INTEGER NOT NULL,
      status        TEXT
    );

    CREATE TABLE IF NOT EXISTS artist_resolution (
      artist_key        TEXT PRIMARY KEY,
      spotify_artist_id TEXT,
      image_url         TEXT,
      resolved_at       INTEGER,
      attempts          INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS top_snapshots (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      taken_at     INTEGER NOT NULL,
      time_range   TEXT NOT NULL,
      entity       TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );

  CREATE TABLE IF NOT EXISTS artist_genres (
    artist_key TEXT PRIMARY KEY,
    genres     TEXT NOT NULL DEFAULT '[]',
    fetched_at INTEGER NOT NULL
  );
`;
