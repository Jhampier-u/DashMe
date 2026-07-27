import { sql } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { StatsRange } from "./range";
import { contadas, enRango, type Db } from "./shared";
import { getTopArtists } from "./tops";

export type ArtistTrack = { key: string; name: string; plays: number };

export type ArtistDetail = {
  key: string;
  name: string;
  plays: number;
  ms: number;
  /** Epoch ms de la primera y la última escucha dentro del rango. */
  primeraVez: number;
  ultimaVez: number;
  /**
   * Puesto dentro del propio ranking del usuario, empezando en 1.
   * `null` si el artista queda fuera de los que se consultaron.
   */
  posicion: number | null;
  topTracks: ArtistTrack[];
};

/** Cuántos artistas se miran para calcular la posición. */
const PROFUNDIDAD_RANKING = 1000;

export async function getArtistDetail(
  db: Db,
  range: StatsRange,
  artistKey: string,
): Promise<ArtistDetail | null> {
  const resumen = db.all<{
    name: string | null;
    plays: number;
    ms: number | null;
    primera: number | null;
    ultima: number | null;
  }>(sql`
    SELECT
      MAX(${streams.artistName})  AS name,
      COUNT(*)                    AS plays,
      SUM(${streams.msPlayed})    AS ms,
      MIN(${streams.ts})          AS primera,
      MAX(${streams.ts})          AS ultima
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
      AND ${streams.artistKey} = ${artistKey}
  `)[0];

  // Con cero filas, los agregados devuelven NULL y COUNT devuelve 0.
  if (!resumen || resumen.plays === 0) return null;

  const topTracks = db.all<ArtistTrack>(sql`
    SELECT
      ${streams.trackKey}       AS key,
      MAX(${streams.trackName}) AS name,
      COUNT(*)                  AS plays
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
      AND ${streams.artistKey} = ${artistKey}
    GROUP BY ${streams.trackKey}
    ORDER BY plays DESC, name ASC
    LIMIT 10
  `);

  const ranking = await getTopArtists(db, range, "plays", PROFUNDIDAD_RANKING);
  const indice = ranking.findIndex((a) => a.key === artistKey);

  return {
    key: artistKey,
    name: resumen.name ?? artistKey,
    plays: resumen.plays,
    ms: resumen.ms ?? 0,
    primeraVez: resumen.primera ?? 0,
    ultimaVez: resumen.ultima ?? 0,
    posicion: indice >= 0 ? indice + 1 : null,
    topTracks,
  };
}
