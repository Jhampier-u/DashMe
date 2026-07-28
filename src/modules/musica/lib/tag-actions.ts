"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/modules/core/db";
import { tags as tagsTable, trackTags } from "@/modules/musica/schema";
import { isValidTagColor, type Tag } from "./tags";
import { requireSession } from "./require-session";

/** Returns all tags with their track counts, ordered by most used first. */
export async function listTags(): Promise<Tag[]> {
  await requireSession();
  const rows = await db
    .select({
      id: tagsTable.id,
      name: tagsTable.name,
      color: tagsTable.color,
      trackCount: sql<number>`coalesce(count(${trackTags.tagId}), 0)`,
    })
    .from(tagsTable)
    .leftJoin(trackTags, eq(tagsTable.id, trackTags.tagId))
    .groupBy(tagsTable.id)
    .orderBy(sql`count(${trackTags.tagId}) desc`, tagsTable.name);
  return rows;
}

export async function createTag(name: string, color = "acid"): Promise<Tag> {
  await requireSession();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío");
  if (trimmed.length > 40) throw new Error("Máximo 40 caracteres");
  const c = isValidTagColor(color) ? color : "acid";

  const existing = await db
    .select()
    .from(tagsTable)
    .where(eq(tagsTable.name, trimmed));
  if (existing.length > 0) {
    throw new Error("Ya existe un tag con ese nombre");
  }

  const result = await db
    .insert(tagsTable)
    .values({
      name: trimmed,
      color: c,
      createdAt: Date.now(),
    })
    .returning();
  return { ...result[0], trackCount: 0 };
}

export async function renameTag(id: number, name: string): Promise<void> {
  await requireSession();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre no puede estar vacío");
  if (trimmed.length > 40) throw new Error("Máximo 40 caracteres");
  const clash = await db
    .select()
    .from(tagsTable)
    .where(and(eq(tagsTable.name, trimmed), ne(tagsTable.id, id)));
  if (clash.length > 0) throw new Error("Ya existe un tag con ese nombre");
  await db
    .update(tagsTable)
    .set({ name: trimmed })
    .where(eq(tagsTable.id, id));
}

export async function setTagColor(id: number, color: string): Promise<void> {
  await requireSession();
  if (!isValidTagColor(color)) throw new Error("Color inválido");
  await db.update(tagsTable).set({ color }).where(eq(tagsTable.id, id));
}

export async function deleteTag(id: number): Promise<void> {
  await requireSession();
  // ON DELETE CASCADE handles track_tags, but be explicit just in case.
  await db.delete(trackTags).where(eq(trackTags.tagId, id));
  await db.delete(tagsTable).where(eq(tagsTable.id, id));
}

/** Returns a map of trackUri -> tags applied to it. */
export async function getTagsForTracks(
  uris: string[],
): Promise<Record<string, Tag[]>> {
  await requireSession();
  const out: Record<string, Tag[]> = {};
  if (uris.length === 0) return out;

  // Chunk del IN(...) para no superar el límite de parámetros de SQLite.
  const CHUNK = 500;
  for (let i = 0; i < uris.length; i += CHUNK) {
    const rows = await db
      .select({
        uri: trackTags.trackUri,
        id: tagsTable.id,
        name: tagsTable.name,
        color: tagsTable.color,
      })
      .from(trackTags)
      .innerJoin(tagsTable, eq(trackTags.tagId, tagsTable.id))
      .where(inArray(trackTags.trackUri, uris.slice(i, i + CHUNK)));

    for (const r of rows) {
      if (!out[r.uri]) out[r.uri] = [];
      out[r.uri].push({
        id: r.id,
        name: r.name,
        color: r.color,
        trackCount: 0,
      });
    }
  }
  return out;
}

export async function applyTagToTracks(
  tagId: number,
  uris: string[],
): Promise<{ added: number }> {
  await requireSession();
  if (uris.length === 0) return { added: 0 };
  const now = Date.now();
  const values = uris.map((uri) => ({
    trackUri: uri,
    tagId,
    addedAt: now,
  }));
  // Insert in chunks to avoid overly large statements.
  const CHUNK = 200;
  let added = 0;
  for (let i = 0; i < values.length; i += CHUNK) {
    const slice = values.slice(i, i + CHUNK);
    const result = await db
      .insert(trackTags)
      .values(slice)
      .onConflictDoNothing()
      .returning();
    added += result.length;
  }
  return { added };
}

export async function removeTagFromTracks(
  tagId: number,
  uris: string[],
): Promise<void> {
  await requireSession();
  if (uris.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < uris.length; i += CHUNK) {
    await db
      .delete(trackTags)
      .where(
        and(
          eq(trackTags.tagId, tagId),
          inArray(trackTags.trackUri, uris.slice(i, i + CHUNK)),
        ),
      );
  }
}

/** Sets the exact tag set for a single track (toggle UX). */
export async function setTagsForTrack(
  uri: string,
  tagIds: number[],
): Promise<void> {
  await requireSession();
  const now = Date.now();
  // Atómico: si el insert fallara tras el delete, la canción quedaría sin tags.
  db.transaction((tx) => {
    tx.delete(trackTags).where(eq(trackTags.trackUri, uri)).run();
    if (tagIds.length > 0) {
      tx.insert(trackTags)
        .values(tagIds.map((tagId) => ({ trackUri: uri, tagId, addedAt: now })))
        .run();
    }
  });
}
