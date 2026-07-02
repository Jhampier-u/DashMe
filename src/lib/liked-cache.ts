"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { likedTracks } from "@/db/schema";
import { requireSession } from "./require-session";

export type CachedTrack = {
  uri: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; image?: string };
  duration_ms: number;
  explicit: boolean;
  added_at: string;
};

export async function getCachedLikedTracks(): Promise<{
  tracks: CachedTrack[];
  scannedAt: number | null;
}> {
  await requireSession();
  const rows = await db
    .select()
    .from(likedTracks)
    .orderBy(sql`${likedTracks.addedAt} desc`);

  if (rows.length === 0) return { tracks: [], scannedAt: null };

  const tracks = rows.map<CachedTrack>((r) => ({
    uri: r.uri,
    name: r.name,
    artists: safeParseArtists(r.artistsJson),
    album: {
      id: r.albumId ?? "",
      name: r.albumName ?? "",
      image: r.albumImage ?? undefined,
    },
    duration_ms: r.durationMs,
    explicit: Boolean(r.explicit),
    added_at: r.addedAt ?? "",
  }));

  // The most recent scannedAt across the rows tells us when last refresh ran.
  let latestScan = 0;
  for (const r of rows) {
    if (r.scannedAt > latestScan) latestScan = r.scannedAt;
  }

  return { tracks, scannedAt: latestScan };
}

export async function saveLikedTracks(
  items: CachedTrack[],
): Promise<{ written: number }> {
  await requireSession();
  if (items.length === 0) return { written: 0 };
  const now = Date.now();
  const CHUNK = 200;
  let written = 0;
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    const values = slice.map((t) => ({
      uri: t.uri,
      name: t.name,
      artistsJson: JSON.stringify(t.artists),
      albumId: t.album.id || null,
      albumName: t.album.name || null,
      albumImage: t.album.image ?? null,
      durationMs: t.duration_ms,
      explicit: t.explicit ? 1 : 0,
      addedAt: t.added_at || null,
      scannedAt: now,
    }));
    const result = await db
      .insert(likedTracks)
      .values(values)
      .onConflictDoUpdate({
        target: likedTracks.uri,
        set: {
          name: sql`excluded.name`,
          artistsJson: sql`excluded.artists_json`,
          albumId: sql`excluded.album_id`,
          albumName: sql`excluded.album_name`,
          albumImage: sql`excluded.album_image`,
          durationMs: sql`excluded.duration_ms`,
          explicit: sql`excluded.explicit`,
          addedAt: sql`excluded.added_at`,
          scannedAt: sql`excluded.scanned_at`,
        },
      })
      .returning();
    written += result.length;
  }
  return { written };
}

export async function clearLikedCache(): Promise<void> {
  await requireSession();
  await db.delete(likedTracks);
}

/** Parseo defensivo: una fila corrupta no debe tumbar toda la lectura. */
function safeParseArtists(json: string): { id: string; name: string }[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
