import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { MS_MINIMO_CONTADO, enRango } from "@/lib/stats/shared";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

describe("MS_MINIMO_CONTADO", () => {
  it("son 30 segundos, el umbral de Spotify", () => {
    expect(MS_MINIMO_CONTADO).toBe(30_000);
  });
});

describe("enRango", () => {
  it("incluye los dos extremos", () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-02-28" }),
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-15" }),
      stream({ localDate: "2026-03-31" }),
      stream({ localDate: "2026-04-01" }),
    ]);

    const filtro = enRango({
      fromDate: "2026-03-01",
      toDate: "2026-03-31",
      label: "",
      preset: "custom",
    });

    const filas = db.all<{ n: number }>(
      sql`SELECT COUNT(*) AS n FROM streams WHERE ${filtro}`,
    );
    expect(filas[0].n).toBe(3);
  });

  it("cruza el cambio de año sin problemas", () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2025-12-31" }),
      stream({ localDate: "2026-01-01" }),
    ]);

    const filtro = enRango({
      fromDate: "2025-12-01",
      toDate: "2026-01-31",
      label: "",
      preset: "custom",
    });

    const filas = db.all<{ n: number }>(
      sql`SELECT COUNT(*) AS n FROM streams WHERE ${filtro}`,
    );
    expect(filas[0].n).toBe(2);
  });
});

describe("seedStreams", () => {
  it("inserta las filas que se le dan", () => {
    const { sqlite } = createTestDb();
    seedStreams(sqlite, [stream({}), stream({}), stream({})]);
    const n = sqlite.prepare("SELECT COUNT(*) AS n FROM streams").get() as {
      n: number;
    };
    expect(n.n).toBe(3);
  });

  it("genera dedup_key únicos sin que haya que darlos", () => {
    const { sqlite } = createTestDb();
    expect(() =>
      seedStreams(sqlite, [stream({}), stream({}), stream({})]),
    ).not.toThrow();
  });

  it("respeta los valores que se le pasan", () => {
    const { sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", msPlayed: 12345, localHour: 3 }),
    ]);
    const f = sqlite
      .prepare("SELECT artist_name, ms_played, local_hour FROM streams")
      .get() as { artist_name: string; ms_played: number; local_hour: number };
    expect(f.artist_name).toBe("Duster");
    expect(f.ms_played).toBe(12345);
    expect(f.local_hour).toBe(3);
  });

  it("deriva las claves normalizadas del nombre", () => {
    const { sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Beyoncé", trackName: "Halo" }),
    ]);
    const f = sqlite
      .prepare("SELECT artist_key, track_key FROM streams")
      .get() as { artist_key: string; track_key: string };
    expect(f.artist_key).toBe("beyonce");
    expect(f.track_key).toBe("beyonce\u001Fhalo");
  });

  it("respeta un null explícito en vez de aplicar el valor por defecto", () => {
    const { sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ albumName: null, trackUri: null })]);
    const f = sqlite
      .prepare("SELECT album_name, album_key, track_uri FROM streams")
      .get() as {
      album_name: string | null;
      album_key: string | null;
      track_uri: string | null;
    };
    expect(f.album_name).toBeNull();
    expect(f.album_key).toBeNull();
    expect(f.track_uri).toBeNull();
  });

  it("usa track_key en el dedup_key cuando no hay uri", () => {
    const { sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: 4242, trackUri: null, artistName: "Duster", trackName: "Gold Dust" }),
    ]);
    const f = sqlite.prepare("SELECT dedup_key FROM streams").get() as {
      dedup_key: string;
    };
    expect(f.dedup_key).toBe("4242:duster\u001Fgold dust");
  });
});
