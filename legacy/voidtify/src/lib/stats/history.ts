import { sql, type SQL } from "drizzle-orm";
import { streams } from "@/db/schema";
import { normalizeName } from "./normalize";
import type { StatsRange } from "./range";
import { enRango, type Db } from "./shared";

export type HistoryRow = {
  id: number;
  ts: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  msPlayed: number;
  localDate: string;
  localHour: number;
  source: string;
};

export type HistoryPage = { rows: HistoryRow[]; total: number };

export type HistoryOptions = {
  limite?: number;
  desplazamiento?: number;
  busqueda?: string;
};

const LIMITE_POR_DEFECTO = 100;

/**
 * Filtro de búsqueda sobre las claves normalizadas.
 *
 * Se busca en `artist_key` y `track_key`, no en los nombres visibles, porque
 * esas columnas ya están en minúsculas y sin acentos: así "SIGUR ROS" encuentra
 * "Sigur Rós" sin necesitar `COLLATE` ni normalizar en SQL.
 *
 * Es un `LIKE` con comodín inicial, que no puede usar índice. Con cientos de
 * miles de filas seguirá siendo un escaneo completo; si algún día molesta, la
 * respuesta es FTS5, no otro índice.
 */
function filtroBusqueda(busqueda: string): SQL {
  const patron = `%${normalizeName(busqueda)}%`;
  return sql`(${streams.artistKey} LIKE ${patron} OR ${streams.trackKey} LIKE ${patron})`;
}

export async function getHistory(
  db: Db,
  range: StatsRange,
  opciones: HistoryOptions = {},
): Promise<HistoryPage> {
  const limite = opciones.limite ?? LIMITE_POR_DEFECTO;
  const desplazamiento = opciones.desplazamiento ?? 0;

  const busqueda = opciones.busqueda?.trim();
  const filtro = busqueda
    ? sql`${enRango(range)} AND ${filtroBusqueda(busqueda)}`
    : enRango(range);

  const total = db.all<{ n: number }>(sql`
    SELECT COUNT(*) AS n FROM ${streams} WHERE ${filtro}
  `)[0]?.n ?? 0;

  const rows = db.all<HistoryRow>(sql`
    SELECT
      ${streams.id}          AS id,
      ${streams.ts}          AS ts,
      ${streams.trackName}   AS trackName,
      ${streams.artistName}  AS artistName,
      ${streams.albumName}   AS albumName,
      ${streams.msPlayed}    AS msPlayed,
      ${streams.localDate}   AS localDate,
      ${streams.localHour}   AS localHour,
      ${streams.source}      AS source
    FROM ${streams}
    WHERE ${filtro}
    ORDER BY ${streams.ts} DESC
    LIMIT ${limite} OFFSET ${desplazamiento}
  `);

  return { rows, total };
}
