import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "@/db/schema";
import { createTestDb } from "./helpers/test-db";

type ColumnaSqlite = {
  name: string;
  notnull: number;
  pk: number;
};

/**
 * El esquema está descrito dos veces: como DDL en `schema-sql.ts` (lo que
 * ejecuta SQLite) y como definiciones de Drizzle en `schema.ts` (lo que ve
 * TypeScript). Nada obliga a que coincidan, y una columna añadida en un solo
 * lado compila, pasa los demás tests y falla al insertar.
 */
describe("paridad entre el DDL y las definiciones de Drizzle", () => {
  const tablas = Object.values(schema).filter(
    (v) => typeof v === "object" && v !== null && getTableConfigSeguro(v) !== null,
  ) as Parameters<typeof getTableConfig>[0][];

  it("encuentra tablas que comparar", () => {
    expect(tablas.length).toBeGreaterThanOrEqual(11);
  });

  it("cada tabla de Drizzle tiene las mismas columnas que el DDL", () => {
    const { sqlite } = createTestDb();
    const problemas: string[] = [];

    for (const tabla of tablas) {
      const config = getTableConfig(tabla);
      const enSqlite = sqlite
        .prepare(`PRAGMA table_info(${config.name})`)
        .all() as ColumnaSqlite[];

      if (enSqlite.length === 0) {
        problemas.push(`${config.name}: no existe en el DDL`);
        continue;
      }

      const nombresSqlite = new Set(enSqlite.map((c) => c.name));
      const nombresDrizzle = new Set(config.columns.map((c) => c.name));

      for (const n of nombresDrizzle) {
        if (!nombresSqlite.has(n)) {
          problemas.push(`${config.name}.${n}: en Drizzle pero no en el DDL`);
        }
      }
      for (const n of nombresSqlite) {
        if (!nombresDrizzle.has(n)) {
          problemas.push(`${config.name}.${n}: en el DDL pero no en Drizzle`);
        }
      }

      // La nulabilidad también tiene que coincidir: una columna NOT NULL en SQL
      // y opcional en Drizzle deja pasar inserciones que la base rechazará.
      for (const col of config.columns) {
        const sqliteCol = enSqlite.find((c) => c.name === col.name);
        if (!sqliteCol) continue;
        // Una PRIMARY KEY INTEGER es implícitamente NOT NULL en SQLite aunque
        // `notnull` valga 0, así que se excluye de la comparación.
        if (sqliteCol.pk === 1) continue;
        const sqlNotNull = sqliteCol.notnull === 1;
        if (sqlNotNull !== col.notNull) {
          problemas.push(
            `${config.name}.${col.name}: NOT NULL difiere ` +
              `(DDL=${sqlNotNull}, Drizzle=${col.notNull})`,
          );
        }
      }
    }

    expect(problemas).toEqual([]);
  });
});

/** `getTableConfig` lanza si el valor no es una tabla; esto lo convierte en null. */
function getTableConfigSeguro(v: unknown) {
  try {
    return getTableConfig(v as Parameters<typeof getTableConfig>[0]);
  } catch {
    return null;
  }
}
