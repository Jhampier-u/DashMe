import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/modules/core/db";
import { topSnapshots } from "@/modules/musica/schema";
import { spotifyFetchHeadless } from "@/modules/musica/lib/spotify-headless";

const RANGOS = ["short_term", "medium_term", "long_term"] as const;
const ENTIDADES = ["artists", "tracks"] as const;

const UN_DIA_MS = 24 * 60 * 60 * 1000;

async function ultimoSnapshot(): Promise<number | null> {
  const filas = await db
    .select({ takenAt: topSnapshots.takenAt })
    .from(topSnapshots)
    .orderBy(desc(topSnapshots.takenAt))
    .limit(1);
  return filas[0]?.takenAt ?? null;
}

/**
 * Guarda una foto de los seis tops si ha pasado más de un día desde la última.
 *
 * Se llama desde `runCapture` en lugar de tener su propia tarea programada:
 * dos crons que mantener en vez de uno no aporta nada.
 *
 * Devuelve cuántos snapshots escribió (0 si no tocaba).
 */
export async function capturarTopsSiToca(): Promise<number> {
  const ultimo = await ultimoSnapshot();
  if (ultimo && Date.now() - ultimo < UN_DIA_MS) return 0;

  const takenAt = Date.now();
  const filas: (typeof topSnapshots.$inferInsert)[] = [];

  for (const entity of ENTIDADES) {
    for (const timeRange of RANGOS) {
      const payload = await spotifyFetchHeadless<unknown>(
        `/me/top/${entity}?time_range=${timeRange}&limit=50`,
        { cache: "no-store" },
      );
      filas.push({
        takenAt,
        timeRange,
        entity,
        payloadJson: JSON.stringify(payload),
      });
    }
  }

  await db.insert(topSnapshots).values(filas);
  return filas.length;
}
