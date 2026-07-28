import { sql } from "drizzle-orm";
import { streams } from "@/modules/musica/schema";
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

export type TopTrackUri = { key: string; name: string; artistName: string; uri: string };

/**
 * Top canciones con su URI de Spotify, para materializar playlists.
 *
 * Una misma canción puede aparecer con varios URIs a lo largo de los años
 * —reediciones, cambios de catálogo, versiones por país—, así que se toma el
 * más frecuente en vez de uno cualquiera: es el que más probablemente siga
 * vivo hoy.
 *
 * Las filas sin URI quedan fuera. Vienen del dump básico o de pistas locales, y
 * no hay nada que añadir a una playlist sin identificador.
 */
export async function getTopTrackUris(
  db: Db,
  range: StatsRange,
  limite = 50,
): Promise<TopTrackUri[]> {
  return db.all<TopTrackUri>(sql`
    WITH contadas_por_uri AS (
      SELECT
        ${streams.trackKey}   AS key,
        ${streams.trackUri}   AS uri,
        COUNT(*)              AS veces
      FROM ${streams}
      WHERE ${enRango(range)} AND ${contadas()}
        AND ${streams.trackUri} IS NOT NULL
      GROUP BY ${streams.trackKey}, ${streams.trackUri}
    ),
    mejor_uri AS (
      SELECT key, uri, veces,
             ROW_NUMBER() OVER (PARTITION BY key ORDER BY veces DESC) AS puesto
      FROM contadas_por_uri
    ),
    totales AS (
      SELECT
        ${streams.trackKey}        AS key,
        MAX(${streams.trackName})  AS name,
        MAX(${streams.artistName}) AS artistName,
        COUNT(*)                   AS plays
      FROM ${streams}
      WHERE ${enRango(range)} AND ${contadas()}
        AND ${streams.trackUri} IS NOT NULL
      GROUP BY ${streams.trackKey}
    )
    SELECT t.key AS key, t.name AS name, t.artistName AS artistName, m.uri AS uri
    FROM totales t
    JOIN mejor_uri m ON m.key = t.key AND m.puesto = 1
    ORDER BY t.plays DESC
    LIMIT ${limite}
  `);
}
