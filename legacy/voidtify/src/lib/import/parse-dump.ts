/**
 * Conversión de registros del Extended Streaming History a filas de `streams`.
 *
 * Módulo puro: sin red, sin base de datos, sin `server-only`. Recibe los
 * objetos ya parseados del JSON y devuelve filas listas para insertar, junto
 * con el recuento de lo que se descartó y por qué.
 *
 * Deliberadamente **no** se almacenan `ip_addr`, `conn_country`,
 * `incognito_mode` ni `offline_timestamp`. La IP es el dato más sensible del
 * paquete y ninguno de los cuatro aporta nada a unas estadísticas de escucha.
 */
import type { NewStreamRow } from "@/db/schema";
import { albumKey, artistKey, trackKey } from "@/lib/stats/normalize";
import { localParts } from "@/lib/stats/local-time";

/** Solo los campos que se leen. El dump trae más, y se ignoran a propósito. */
export type DumpRecord = {
  ts: string;
  platform?: string | null;
  ms_played: number;
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
  master_metadata_album_album_name?: string | null;
  spotify_track_uri?: string | null;
  episode_name?: string | null;
  spotify_episode_uri?: string | null;
  audiobook_title?: string | null;
  audiobook_uri?: string | null;
  reason_start?: string | null;
  reason_end?: string | null;
  shuffle?: boolean | null;
  skipped?: boolean | null;
};

export type ParseResult = {
  filas: NewStreamRow[];
  /** Registros que no son música: podcasts, vídeo, audiolibros. */
  descartados: number;
  /** Subconjunto de los descartados que son audiolibros. */
  audiolibros: number;
  /** Registros con datos imposibles de interpretar. */
  invalidos: number;
  /** Rango temporal de las filas válidas, en epoch ms. */
  desde: number | null;
  hasta: number | null;
};

/**
 * Normaliza un booleano opcional del dump.
 *
 * No hay conversión a 0/1 que hacer aquí: la columna es `INTEGER` en SQL, pero
 * Drizzle la declara con `{ mode: "boolean" }` y traduce al escribir. Lo único
 * que falta es que un campo ausente quede como `null` explícito y no como
 * `undefined`, que al insertar significaría "usa el valor por defecto".
 */
function booleano(v: boolean | null | undefined): boolean | null {
  return v ?? null;
}

export function parseDumpRecords(
  registros: DumpRecord[],
  timeZone: string,
): ParseResult {
  const filas: NewStreamRow[] = [];
  let descartados = 0;
  let audiolibros = 0;
  let invalidos = 0;
  let desde: number | null = null;
  let hasta: number | null = null;

  for (const r of registros) {
    const nombre = r.master_metadata_track_name;
    const artista = r.master_metadata_album_artist_name;

    // Sin título de canción no es música: es podcast, vídeo o audiolibro.
    if (!nombre || !artista) {
      descartados += 1;
      if (r.audiobook_title || r.audiobook_uri) audiolibros += 1;
      continue;
    }

    const ts = Date.parse(r.ts);
    if (Number.isNaN(ts)) {
      invalidos += 1;
      continue;
    }

    let local;
    try {
      local = localParts(ts, timeZone);
    } catch {
      invalidos += 1;
      continue;
    }

    const album = r.master_metadata_album_album_name ?? null;
    const uri = r.spotify_track_uri?.trim() ? r.spotify_track_uri : null;
    const claveTrack = trackKey(artista, nombre);

    filas.push({
      ts,
      msPlayed: r.ms_played ?? 0,
      trackUri: uri,
      trackName: nombre,
      artistName: artista,
      albumName: album,
      trackKey: claveTrack,
      artistKey: artistKey(artista),
      albumKey: album ? albumKey(artista, album) : null,
      localDate: local.localDate,
      localHour: local.localHour,
      reasonStart: r.reason_start ?? null,
      reasonEnd: r.reason_end ?? null,
      shuffle: booleano(r.shuffle),
      skipped: booleano(r.skipped),
      platform: r.platform ?? null,
      source: "import",
      dedupKey: `${ts}:${uri ?? claveTrack}`,
    });

    if (desde === null || ts < desde) desde = ts;
    if (hasta === null || ts > hasta) hasta = ts;
  }

  return { filas, descartados, audiolibros, invalidos, desde, hasta };
}
