import { describe, expect, it } from "vitest";
import { getArtistDetail } from "@/lib/stats/detail";
import type { StatsRange } from "@/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const HISTORICO: StatsRange = {
  fromDate: "1970-01-01",
  toDate: "2099-12-31",
  label: "Histórico",
  preset: "all",
};

describe("getArtistDetail", () => {
  it("devuelve null para un artista que no existe", async () => {
    const { db } = createTestDb();
    expect(await getArtistDetail(db, HISTORICO, "inexistente")).toBeNull();
  });

  it("cuenta veces y suma tiempo", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", msPlayed: 100_000, ts: 1000 }),
      stream({ artistName: "Duster", msPlayed: 200_000, ts: 2000 }),
    ]);

    const f = await getArtistDetail(db, HISTORICO, "duster");
    expect(f?.plays).toBe(2);
    expect(f?.ms).toBe(300_000);
  });

  it("da la primera y la última vez", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", ts: 5000, localDate: "2026-03-05" }),
      stream({ artistName: "Duster", ts: 1000, localDate: "2026-01-01" }),
      stream({ artistName: "Duster", ts: 9000, localDate: "2026-06-30" }),
    ]);

    const f = await getArtistDetail(db, HISTORICO, "duster");
    expect(f?.primeraVez).toBe(1000);
    expect(f?.ultimaVez).toBe(9000);
  });

  it("devuelve el nombre tal como se escribió", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ artistName: "Sigur Rós" })]);
    expect((await getArtistDetail(db, HISTORICO, "sigur ros"))?.name).toBe(
      "Sigur Rós",
    );
  });

  it("da la posición en el ranking del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Primero" }),
      stream({ artistName: "Primero" }),
      stream({ artistName: "Primero" }),
      stream({ artistName: "Segundo" }),
      stream({ artistName: "Segundo" }),
      stream({ artistName: "Tercero" }),
    ]);

    expect((await getArtistDetail(db, HISTORICO, "segundo"))?.posicion).toBe(2);
    expect((await getArtistDetail(db, HISTORICO, "tercero"))?.posicion).toBe(3);
  });

  it("incluye las canciones más escuchadas de ese artista", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", trackName: "Inside Out" }),
      stream({ artistName: "Duster", trackName: "Inside Out" }),
      stream({ artistName: "Duster", trackName: "Gold Dust" }),
      stream({ artistName: "Slowdive", trackName: "Alison" }),
    ]);

    const f = await getArtistDetail(db, HISTORICO, "duster");
    expect(f?.topTracks.map((t) => t.name)).toEqual(["Inside Out", "Gold Dust"]);
    expect(f?.topTracks[0].plays).toBe(2);
  });

  it("respeta el rango en las cifras", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", localDate: "2026-01-15" }),
      stream({ artistName: "Duster", localDate: "2026-06-15" }),
    ]);

    const enero: StatsRange = {
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      label: "",
      preset: "custom",
    };

    expect((await getArtistDetail(db, enero, "duster"))?.plays).toBe(1);
  });

  it("no cuenta reproducciones por debajo del umbral", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", msPlayed: 5_000 }),
      stream({ artistName: "Duster", msPlayed: 200_000 }),
    ]);

    expect((await getArtistDetail(db, HISTORICO, "duster"))?.plays).toBe(1);
  });
});
