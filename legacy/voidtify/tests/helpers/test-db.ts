import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";
import { SCHEMA_SQL } from "@/db/schema-sql";

/**
 * Base en memoria con el mismo esquema que producción. Cada test crea la suya,
 * así que no comparten estado.
 */
export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SCHEMA_SQL);
  return { db: drizzle(sqlite, { schema }), sqlite };
}
