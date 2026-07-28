/**
 * Conversión de la respuesta de /me/player/recently-played a filas `streams`.
 *
 * Módulo puro: sin red, sin base de datos, sin `server-only`.
 */
import type { NewStreamRow } from "@/modules/musica/schema";
import { albumKey, artistKey, trackKey } from "@/modules/musica/lib/stats/normalize";
import { localParts } from "@/modules/musica/lib/stats/local-time";

export type RecentlyPlayedTrack = {
  uri: string;
  name: string;
  duration_ms: number;
  artists: { id: string; name: string }[];
  album: { id: string; name: string } | null;
};

export type RecentlyPlayedItem = {
  played_at: string;
  /** El fork de feb 2026 renombró `track` a `item` en playlists. */
  track?: RecentlyPlayedTrack | null;
  item?: RecentlyPlayedTrack | null;
};

export type RecentlyPlayedResponse = {
  items: RecentlyPlayedItem[];
  cursors?: { after?: string; before?: string } | null;
};

export function mapRecentlyPlayed(
  items: RecentlyPlayedItem[],
  timeZone: string,
): NewStreamRow[] {
  const filas: NewStreamRow[] = [];

  for (const entrada of items) {
    const pista = entrada.item ?? entrada.track;
    if (!pista) continue;

    const artista = pista.artists?.[0]?.name;
    if (!artista || !pista.name) continue;

    const ts = Date.parse(entrada.played_at);
    if (Number.isNaN(ts)) continue;

    const uri = pista.uri?.trim() ? pista.uri : null;
    const album = pista.album?.name ?? null;
    const claveTrack = trackKey(artista, pista.name);
    const { localDate, localHour } = localParts(ts, timeZone);

    filas.push({
      ts,
      // recently-played no informa de cuánto sonó realmente. La duración
      // completa es una sobreestimación acotada (Spotify solo lista lo que
      // superó ~30 s) y temporal: el dump reemplazará este rango.
      msPlayed: pista.duration_ms ?? 0,
      trackUri: uri,
      trackName: pista.name,
      artistName: artista,
      albumName: album,
      trackKey: claveTrack,
      artistKey: artistKey(artista),
      albumKey: album ? albumKey(artista, album) : null,
      localDate,
      localHour,
      reasonStart: null,
      reasonEnd: null,
      shuffle: null,
      skipped: null,
      platform: null,
      source: "live",
      dedupKey: `${ts}:${uri ?? claveTrack}`,
    });
  }

  return filas;
}
