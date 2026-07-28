import { streams, type NewStreamRow } from "@/modules/musica/schema";
import type { db as ProductionDb } from "@/modules/core/db";

/**
 * Acepta la base como argumento en vez de importar el singleton, para que los
 * tests puedan pasar una base en memoria.
 */
type Db = typeof ProductionDb;

/** Por debajo del límite de variables por sentencia de SQLite. */
const CHUNK = 400;

/**
 * Inserta filas ignorando las que ya existan (mismo `dedup_key`).
 *
 * Devuelve cuántas se insertaron realmente. Deliberadamente sin `.returning()`
 * de las filas completas: en el importador esto recibirá cientos de miles de
 * filas y devolverlas sería caro para nada.
 */
export async function insertStreams(
  db: Db,
  filas: NewStreamRow[],
): Promise<number> {
  if (filas.length === 0) return 0;

  // Deduplicar dentro del lote: SQLite falla si una misma sentencia INSERT
  // contiene dos veces la misma clave única, aunque haya ON CONFLICT.
  const porClave = new Map<string, NewStreamRow>();
  for (const f of filas) porClave.set(f.dedupKey, f);
  const unicas = [...porClave.values()];

  let insertadas = 0;
  for (let i = 0; i < unicas.length; i += CHUNK) {
    const lote = unicas.slice(i, i + CHUNK);
    const resultado = await db
      .insert(streams)
      .values(lote)
      .onConflictDoNothing({ target: streams.dedupKey })
      .returning({ id: streams.id });
    insertadas += resultado.length;
  }

  return insertadas;
}
