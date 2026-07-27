import { sql } from "drizzle-orm";
import { streams } from "@/db/schema";
import type { StatsRange } from "./range";
import { contadas, enRango, type Db, type Metric } from "./shared";

export type TopEntry = {
  /** Clave normalizada — para enlazar a la ficha. */
  key: string;
  /** Nombre tal como aparece en los datos. */
  name: string;
  plays: number;
  ms: number;
};

export type TopTrackEntry = TopEntry & { artistName: string };
export type TopAlbumEntry = TopEntry & { artistName: string };

const LIMITE_POR_DEFECTO = 50;

/**
 * `MAX(name)` en lugar de un `GROUP BY` sobre el nombre: se agrupa por la clave
 * normalizada, así que dentro de un grupo puede haber varias grafías del mismo
 * nombre. Se muestra una cualquiera de ellas — la alternativa sería elegir la
 * más frecuente, que cuesta una subconsulta y no aporta nada perceptible.
 */
function ordenPor(metric: Metric) {
  return metric === "ms" ? sql`ms DESC, plays DESC` : sql`plays DESC, ms DESC`;
}

export async function getTopArtists(
  db: Db,
  range: StatsRange,
  metric: Metric = "plays",
  limite = LIMITE_POR_DEFECTO,
): Promise<TopEntry[]> {
  return db.all<TopEntry>(sql`
    SELECT
      ${streams.artistKey}          AS key,
      MAX(${streams.artistName})    AS name,
      COUNT(*)                      AS plays,
      SUM(${streams.msPlayed})      AS ms
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
    GROUP BY ${streams.artistKey}
    ORDER BY ${ordenPor(metric)}
    LIMIT ${limite}
  `);
}

export async function getTopTracks(
  db: Db,
  range: StatsRange,
  metric: Metric = "plays",
  limite = LIMITE_POR_DEFECTO,
): Promise<TopTrackEntry[]> {
  return db.all<TopTrackEntry>(sql`
    SELECT
      ${streams.trackKey}           AS key,
      MAX(${streams.trackName})     AS name,
      MAX(${streams.artistName})    AS artistName,
      COUNT(*)                      AS plays,
      SUM(${streams.msPlayed})      AS ms
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
    GROUP BY ${streams.trackKey}
    ORDER BY ${ordenPor(metric)}
    LIMIT ${limite}
  `);
}

export async function getTopAlbums(
  db: Db,
  range: StatsRange,
  metric: Metric = "plays",
  limite = LIMITE_POR_DEFECTO,
): Promise<TopAlbumEntry[]> {
  return db.all<TopAlbumEntry>(sql`
    SELECT
      ${streams.albumKey}           AS key,
      MAX(${streams.albumName})     AS name,
      MAX(${streams.artistName})    AS artistName,
      COUNT(*)                      AS plays,
      SUM(${streams.msPlayed})      AS ms
    FROM ${streams}
    WHERE ${enRango(range)} AND ${contadas()}
      AND ${streams.albumKey} IS NOT NULL
    GROUP BY ${streams.albumKey}
    ORDER BY ${ordenPor(metric)}
    LIMIT ${limite}
  `);
}
