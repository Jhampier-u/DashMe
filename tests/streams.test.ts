import { describe, expect, it } from "vitest";
import type { NewStreamRow } from "@/db/schema";
import { streams } from "@/db/schema";
import { insertStreams } from "@/lib/streams";
import { createTestDb } from "./helpers/test-db";

function fila(over: Partial<NewStreamRow> = {}): NewStreamRow {
  const ts = over.ts ?? 1_700_000_000_000;
  return {
    ts,
    msPlayed: 210_000,
    trackUri: "spotify:track:abc",
    trackName: "Alison",
    artistName: "Slowdive",
    albumName: "Souvlaki",
    trackKey: "slowdive\u001Falison",
    artistKey: "slowdive",
    albumKey: "slowdive\u001Fsouvlaki",
    localDate: "2023-11-14",
    localHour: 15,
    reasonStart: null,
    reasonEnd: null,
    shuffle: null,
    skipped: null,
    platform: null,
    source: "live",
    dedupKey: `${ts}:spotify:track:abc`,
    ...over,
  };
}

describe("insertStreams", () => {
  it("inserta filas nuevas", async () => {
    const { db } = createTestDb();
    const insertadas = await insertStreams(db, [fila(), fila({ ts: 1_700_000_100_000, dedupKey: "otra" })]);
    expect(insertadas).toBe(2);
    expect(await db.select().from(streams)).toHaveLength(2);
  });

  it("ignora duplicados por dedup_key", async () => {
    const { db } = createTestDb();
    await insertStreams(db, [fila()]);
    const insertadas = await insertStreams(db, [fila()]);

    expect(insertadas).toBe(0);
    expect(await db.select().from(streams)).toHaveLength(1);
  });

  it("deduplica dentro del mismo lote", async () => {
    const { db } = createTestDb();
    const insertadas = await insertStreams(db, [fila(), fila()]);

    expect(insertadas).toBe(1);
    expect(await db.select().from(streams)).toHaveLength(1);
  });

  it("no falla con un lote vacío", async () => {
    const { db } = createTestDb();
    expect(await insertStreams(db, [])).toBe(0);
  });

  it("inserta lotes mayores que el tamaño de chunk", async () => {
    const { db } = createTestDb();
    const muchas = Array.from({ length: 1200 }, (_, i) =>
      fila({ ts: 1_700_000_000_000 + i * 1000, dedupKey: `clave-${i}` }),
    );

    expect(await insertStreams(db, muchas)).toBe(1200);
    expect(await db.select().from(streams)).toHaveLength(1200);
  });
});
