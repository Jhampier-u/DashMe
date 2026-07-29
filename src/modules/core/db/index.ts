import "server-only";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { SCHEMA_SQL } from "./schema-sql";
import { ponerAlDia } from "./migrar";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "juampi.db");

function createDb() {
  // `mkdirSync(recursive)` es idempotente: no hace falta comprobar existsSync.
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  // Sin esto SQLite ignora las claves foráneas en silencio y borrar un hábito
  // deja sus registros huérfanos.
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(SCHEMA_SQL);
  // `SCHEMA_SQL` crea lo que falta; esto pone al día lo que ya estaba. Hasta
  // ahora el esquema solo crecía con tablas nuevas y no hacía falta.
  ponerAlDia(sqlite);

  return drizzle(sqlite, { schema });
}

declare global {
  var __juampiDb: ReturnType<typeof createDb> | undefined;
}

// Singleton por proceso: evita abrir una conexión nueva en cada recarga de HMR.
export const db = globalThis.__juampiDb ?? (globalThis.__juampiDb = createDb());

export type Db = typeof db;
