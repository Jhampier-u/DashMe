import { desc, eq } from "drizzle-orm";
import { importBatches, type ImportBatchRow } from "@/modules/musica/schema";
import type { Db } from "@/modules/musica/lib/stats/shared";

export type NuevaTanda = {
  filename: string;
  fileHash: string;
  format: string;
  rowsRead: number;
  rowsInserted: number;
  rowsSkipped: number;
  rowsInvalid: number;
  rangeStart: number | null;
  rangeEnd: number | null;
  status: string;
};

/**
 * Deja constancia de un archivo importado.
 *
 * No hay restricción de unicidad sobre el hash a propósito: reimportar el mismo
 * archivo es legítimo —la deduplicación por `dedup_key` impide que se dupliquen
 * filas— y el historial de intentos es información útil, no ruido.
 */
export async function registrarTanda(
  db: Db,
  tanda: NuevaTanda,
): Promise<void> {
  await db.insert(importBatches).values({
    ...tanda,
    importedAt: Date.now(),
  });
}

/** La tanda más reciente de un archivo con ese contenido, si la hubo. */
export async function tandaPorHash(
  db: Db,
  fileHash: string,
): Promise<ImportBatchRow | null> {
  const filas = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.fileHash, fileHash))
    .orderBy(desc(importBatches.importedAt), desc(importBatches.id))
    .limit(1);

  return filas[0] ?? null;
}

export async function listarTandas(db: Db): Promise<ImportBatchRow[]> {
  return db
    .select()
    .from(importBatches)
    .orderBy(desc(importBatches.importedAt), desc(importBatches.id));
}
