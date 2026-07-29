import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { SCHEMA_SQL } from "./schema-sql";
import { ponerAlDia } from "./migrar";
import type { Db } from "./index";

/**
 * Base SQLite en memoria, aislada por llamada. Para tests: no toca el disco y
 * desaparece al terminar. Comparte SCHEMA_SQL con la de producción, así que si
 * el esquema real se rompe, los tests se enteran.
 *
 * El tipo de retorno es `Db` a propósito: es el mismo que reciben las funciones
 * de `lib/`, así que si divergieran, tsc avisa. `import type` no arrastra el
 * `server-only` de `index.ts` — se borra al compilar.
 */
export function createTestDb(): Db {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(SCHEMA_SQL);
  // Sobre un esquema recién creado no debe hacer nada. Se llama igualmente para
  // que los tests recorran el mismo camino que producción: si algún día dejara
  // de ser inofensiva, se enteran los tests y no el usuario.
  ponerAlDia(sqlite);
  return drizzle(sqlite, { schema });
}
