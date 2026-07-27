import type Database from "better-sqlite3";
import { artistKey, albumKey, trackKey } from "@/lib/stats/normalize";

/**
 * Constructor de filas de `streams` para tests.
 *
 * Todo tiene un valor por defecto razonable y `dedup_key` se genera solo, para
 * que cada test declare únicamente lo que le importa. Sin esto, cada caso
 * tendría que repetir diecinueve columnas y lo relevante quedaría escondido.
 */
export type SeedStream = {
  ts?: number;
  msPlayed?: number;
  trackUri?: string | null;
  trackName?: string;
  artistName?: string;
  albumName?: string | null;
  localDate?: string;
  localHour?: number;
  skipped?: number | null;
  source?: string;
};

let contador = 0;

export function stream(over: SeedStream = {}): Required<SeedStream> {
  contador += 1;
  return {
    ts: over.ts ?? 1_700_000_000_000 + contador * 1000,
    msPlayed: over.msPlayed ?? 210_000,
    trackUri: over.trackUri ?? `spotify:track:seed${contador}`,
    trackName: over.trackName ?? "Alison",
    artistName: over.artistName ?? "Slowdive",
    albumName: over.albumName ?? "Souvlaki",
    localDate: over.localDate ?? "2026-03-15",
    localHour: over.localHour ?? 15,
    skipped: over.skipped ?? null,
    source: over.source ?? "live",
  };
}

export function seedStreams(
  sqlite: Database.Database,
  filas: Required<SeedStream>[],
): void {
  const insertar = sqlite.prepare(`
    INSERT INTO streams
      (ts, ms_played, track_uri, track_name, artist_name, album_name,
       track_key, artist_key, album_key, local_date, local_hour,
       skipped, source, dedup_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = sqlite.transaction((rows: Required<SeedStream>[]) => {
    for (const f of rows) {
      insertar.run(
        f.ts,
        f.msPlayed,
        f.trackUri,
        f.trackName,
        f.artistName,
        f.albumName,
        trackKey(f.artistName, f.trackName),
        artistKey(f.artistName),
        f.albumName ? albumKey(f.artistName, f.albumName) : null,
        f.localDate,
        f.localHour,
        f.skipped,
        f.source,
        `${f.ts}:${f.trackUri ?? trackKey(f.artistName, f.trackName)}`,
      );
    }
  });

  tx(filas);
}
