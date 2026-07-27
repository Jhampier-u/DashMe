import "server-only";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { SCHEMA_SQL } from "./schema-sql";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "ledger.db");

function createDb() {
  // `mkdirSync(recursive)` es idempotente: no hace falta comprobar existsSync.
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // Reintenta ante SQLITE_BUSY (p. ej. materialize + aplicar tag concurrentes).
  sqlite.pragma("busy_timeout = 5000");

  // Auto-create tables on first run. Idempotent.
  sqlite.exec(SCHEMA_SQL);

  return drizzle(sqlite, { schema });
}

declare global {
  var __ledgerDb: ReturnType<typeof createDb> | undefined;
}

// Singleton por proceso: evita abrir una conexión nueva en cada recarga de HMR
// (mismo patrón que el rate-limiter global).
export const db = globalThis.__ledgerDb ?? (globalThis.__ledgerDb = createDb());
