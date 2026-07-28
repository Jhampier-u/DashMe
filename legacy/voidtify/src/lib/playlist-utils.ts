/**
 * Helpers puros de playlists — SIN `server-only` ni dependencias de red/DB.
 * Vive aparte de `spotify.ts` para poder usarse desde componentes cliente
 * (`"use client"`) sin arrastrar `spotify.ts` → `rate-limiter.ts` (server-only)
 * al bundle del navegador.
 */

/** Conteo de tracks tolerante al rename `tracks`→`items` de Spotify (Feb 2026). */
export function playlistTrackTotal(p: {
  items?: { total: number };
  tracks?: { total: number };
}): number {
  return (p.items ?? p.tracks)?.total ?? 0;
}
