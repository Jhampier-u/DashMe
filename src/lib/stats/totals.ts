import { sql } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { StatsRange } from "./range";
import { MS_MINIMO_CONTADO, enRango, type Db } from "./shared";

export type Totals = {
  /** Suma de `ms_played` de todas las filas, incluidas las cortas. */
  msTotal: number;
  /** Filas que superaron el umbral de reproducción contada. */
  reproducciones: number;
  /** Días locales distintos con al menos una escucha. */
  diasActivos: number;
  artistas: number;
  canciones: number;
  albumes: number;
};

export async function getTotals(
  db: Db,
  range: StatsRange,
): Promise<Totals> {
  const filas = db.all<{
    ms_total: number | null;
    reproducciones: number;
    dias_activos: number;
    artistas: number;
    canciones: number;
    albumes: number;
  }>(sql`
    SELECT
      SUM(${streams.msPlayed})                                        AS ms_total,
      SUM(CASE WHEN ${streams.msPlayed} >= ${MS_MINIMO_CONTADO}
               THEN 1 ELSE 0 END)                                     AS reproducciones,
      COUNT(DISTINCT ${streams.localDate})                            AS dias_activos,
      COUNT(DISTINCT ${streams.artistKey})                            AS artistas,
      COUNT(DISTINCT ${streams.trackKey})                             AS canciones,
      COUNT(DISTINCT ${streams.albumKey})                             AS albumes
    FROM ${streams}
    WHERE ${enRango(range)}
  `);

  const f = filas[0];

  return {
    // SUM sobre cero filas devuelve NULL, no 0.
    msTotal: f?.ms_total ?? 0,
    reproducciones: f?.reproducciones ?? 0,
    diasActivos: f?.dias_activos ?? 0,
    artistas: f?.artistas ?? 0,
    canciones: f?.canciones ?? 0,
    albumes: f?.albumes ?? 0,
  };
}
