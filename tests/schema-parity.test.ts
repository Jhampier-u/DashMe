import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { isTable } from "drizzle-orm";
import * as schema from "@/modules/core/db/schema";
import { SCHEMA_SQL } from "@/modules/core/db/schema-sql";
import { createTestDb } from "./helpers/test-db";

type ColumnaSqlite = {
  name: string;
  notnull: number;
  pk: number;
};

const tablas = Object.values(schema).filter(isTable) as Parameters<
  typeof getTableConfig
>[0][];

/**
 * El esquema está descrito dos veces: como DDL en `schema-sql.ts` (lo que
 * ejecuta SQLite) y como definiciones de Drizzle en `schema.ts` (lo que ve
 * TypeScript). Nada obliga a que coincidan, y una columna añadida en un solo
 * lado compila, pasa los demás tests y falla al insertar.
 *
 * Se compara contra el esquema compuesto de `core/db/schema.ts` —el que
 * reexporta hábitos y música— porque `SCHEMA_SQL` describe la base entera. Si
 * aquí solo se mirara el esquema de música, las tablas de los demás módulos
 * quedarían sin cubrir y el recuento de tablas nunca cuadraría.
 */
describe("paridad entre el DDL y las definiciones de Drizzle", () => {
  it("compara todas las tablas del esquema", () => {
    const enDdl = (SCHEMA_SQL.match(/CREATE TABLE/g) ?? []).length;
    expect(tablas.length).toBe(enDdl);
  });

  it("no hay tablas en el DDL que falten en Drizzle", () => {
    const { sqlite } = createTestDb();

    const enSqlite = (
      sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' " +
            "AND name NOT LIKE 'sqlite_%'",
        )
        .all() as { name: string }[]
    ).map((f) => f.name);

    const enDrizzle = new Set(tablas.map((t) => getTableConfig(t).name));

    // La comparación por columnas solo recorre tablas que ya existen en
    // Drizzle, así que una tabla creada únicamente en el DDL no la ve nadie.
    const soloEnDdl = enSqlite.filter((n) => !enDrizzle.has(n));
    expect(soloEnDdl).toEqual([]);
  });

  it("las columnas únicas en Drizzle lo son también en el DDL", () => {
    const { sqlite } = createTestDb();
    const problemas: string[] = [];

    for (const tabla of tablas) {
      const config = getTableConfig(tabla);

      const indices = sqlite
        .prepare(`PRAGMA index_list(${config.name})`)
        .all() as { name: string; unique: number }[];

      // Columnas cubiertas por algún índice único de una sola columna.
      const unicasEnSqlite = new Set<string>();
      for (const idx of indices.filter((i) => i.unique === 1)) {
        const cols = sqlite
          .prepare(`PRAGMA index_info(${idx.name})`)
          .all() as { name: string }[];
        if (cols.length === 1) unicasEnSqlite.add(cols[0].name);
      }

      for (const col of config.columns) {
        if (!col.isUnique) continue;
        if (!unicasEnSqlite.has(col.name)) {
          problemas.push(
            `${config.name}.${col.name}: única en Drizzle pero sin UNIQUE en el DDL`,
          );
        }
      }
    }

    expect(problemas).toEqual([]);
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
