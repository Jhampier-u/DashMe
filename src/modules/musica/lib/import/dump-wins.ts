import { and, eq, gte, lte } from "drizzle-orm";
import { streams } from "@/modules/musica/schema";
import type { Db } from "@/modules/musica/lib/stats/shared";

/**
 * El dump manda en su propio rango (decisión D2 del documento de diseño).
 *
 * Las filas capturadas en vivo dentro del periodo que cubre el dump se borran y
 * las sustituyen las importadas, que traen `ms_played` real y `skipped` en vez
 * de aproximaciones. Las posteriores al dump sobreviven: son lo único que
 * existe de ese periodo.
 *
 * Resolver el solapamiento así, por decreto, evita tener que deduplicar entre
 * fuentes con heurísticas de coincidencia difusa que nunca son del todo fiables.
 *
 * Se llama **al terminar toda la tanda**, no archivo a archivo: si el import
 * falla a la mitad, no se pierden a la vez lo capturado y lo importado.
 *
 * Devuelve cuántas filas se borraron.
 */
export async function aplicarDumpManda(
  db: Db,
  desde: number | null,
  hasta: number | null,
): Promise<number> {
  if (desde === null || hasta === null) return 0;

  const borradas = await db
    .delete(streams)
    .where(
      and(
        eq(streams.source, "live"),
        gte(streams.ts, desde),
        lte(streams.ts, hasta),
      ),
    )
    .returning({ id: streams.id });

  return borradas.length;
}
