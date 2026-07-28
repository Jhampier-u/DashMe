import { sql, type SQL } from "drizzle-orm";
import { streams } from "@/modules/musica/schema";
import type { db as ProductionDb } from "@/modules/core/db";
import type { StatsRange } from "./range";

/**
 * La base se pasa como argumento en vez de importar el singleton de `@/db`.
 *
 * `src/db/index.ts` abre y escribe el archivo real al importarse, así que un
 * test que lo tocara escribiría en los datos del usuario. Mismo patrón que
 * `insertStreams` en `src/lib/streams.ts`.
 */
export type Db = typeof ProductionDb;

/**
 * Umbral de "reproducción contada": el mismo que usa Spotify.
 *
 * Se aplica a los conteos de reproducciones y a los rankings, pero **no** a la
 * suma de minutos — si algo sonó doce segundos, esos doce segundos se
 * escucharon y cuentan como tiempo.
 */
export const MS_MINIMO_CONTADO = 30_000;

/** Por qué se ordena un ranking. */
export type Metric = "plays" | "ms";

/**
 * Filtro de rango sobre `local_date`.
 *
 * Nunca sobre `ts`: los límites del rango son días locales del usuario, y
 * comparar epochs UTC desplazaría cada extremo tantas horas como diga su zona
 * horaria (ver D9 en el documento de diseño). El formato `YYYY-MM-DD` ordena
 * lexicográficamente igual que cronológicamente, y `streams_local_date_idx`
 * hace que la comparación use índice.
 */
export function enRango(range: StatsRange): SQL {
  return sql`${streams.localDate} BETWEEN ${range.fromDate} AND ${range.toDate}`;
}

/** Filtro adicional para contar solo reproducciones que superaron el umbral. */
export function contadas(): SQL {
  return sql`${streams.msPlayed} >= ${MS_MINIMO_CONTADO}`;
}
