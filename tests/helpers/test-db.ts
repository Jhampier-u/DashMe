import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/modules/core/db/schema";
import { SCHEMA_SQL } from "@/modules/core/db/schema-sql";
import type { Db } from "@/modules/core/db";

/**
 * Base en memoria con el mismo esquema que producción. Cada test crea la suya,
 * así que no comparten estado.
 *
 * El esquema es el compuesto de `core/db/schema.ts`, no el de música a secas:
 * las funciones de `lib/` reciben `Db`, que se construye sobre el compuesto, y
 * un drizzle tipado solo con las tablas de música no es asignable a él. Se
 * devuelve además el `sqlite` crudo porque varios tests inspeccionan PRAGMAs.
 *
 * `import type` no arrastra el `server-only` de `index.ts`: se borra al
 * compilar.
 */
export function createTestDb(): { db: Db; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SCHEMA_SQL);
  return { db: drizzle(sqlite, { schema }), sqlite };
}
