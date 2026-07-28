import { describe, expect, it } from "vitest";
import { getTrackDetail, getAlbumDetail } from "@/modules/musica/lib/stats/detail";
import type { StatsRange } from "@/modules/musica/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const HISTORICO: StatsRange = {
  fromDate: "1970-01-01",
  toDate: "2099-12-31",
  label: "Histórico",
  preset: "all",
};

describe("getTrackDetail", () => {
  it("devuelve null para una canción que no existe", async () => {
    const { db } = createTestDb();
    expect(await getTrackDetail(db, HISTORICO, "inexistente")).toBeNull();
  });

  it("cuenta veces, tiempo y primera y última escucha", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", trackName: "Inside Out", ts: 5000, msPlayed: 100_000 }),
      stream({ artistName: "Duster", trackName: "Inside Out", ts: 1000, msPlayed: 200_000 }),
    ]);

    const f = await getTrackDetail(db, HISTORICO, "duster\u001Finside out");
    expect(f?.plays).toBe(2);
    expect(f?.ms).toBe(300_000);
    expect(f?.primeraVez).toBe(1000);
    expect(f?.ultimaVez).toBe(5000);
  });

  it("incluye el artista y su clave, para poder enlazar", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Sigur Rós", trackName: "Hoppípolla" }),
    ]);

    const f = await getTrackDetail(db, HISTORICO, "sigur ros\u001Fhoppipolla");
    expect(f?.artistName).toBe("Sigur Rós");
    expect(f?.artistKey).toBe("sigur ros");
  });

  it("da la posición dentro del ranking de canciones", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ trackName: "Primera" }),
      stream({ trackName: "Primera" }),
      stream({ trackName: "Segunda" }),
    ]);

    const f = await getTrackDetail(db, HISTORICO, "slowdive\u001Fsegunda");
    expect(f?.posicion).toBe(2);
  });

  it("devuelve la evolución mensual de esa canción", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ trackName: "Obsesión", localDate: "2024-03-01" }),
      stream({ trackName: "Obsesión", localDate: "2024-03-15" }),
      stream({ trackName: "Obsesión", localDate: "2024-07-01" }),
      stream({ trackName: "Otra", localDate: "2024-03-01" }),
    ]);

    const f = await getTrackDetail(db, HISTORICO, "slowdive\u001Fobsesion");
    expect(f?.porMes).toEqual([
      { month: "2024-03", plays: 2 },
      { month: "2024-07", plays: 1 },
    ]);
  });

  it("no cuenta reproducciones por debajo del umbral", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ trackName: "Corta", msPlayed: 5_000 }),
      stream({ trackName: "Corta", msPlayed: 200_000 }),
    ]);

    expect((await getTrackDetail(db, HISTORICO, "slowdive\u001Fcorta"))?.plays).toBe(1);
  });
});

describe("getAlbumDetail", () => {
  it("devuelve null para un álbum que no existe", async () => {
    const { db } = createTestDb();
    expect(await getAlbumDetail(db, HISTORICO, "inexistente")).toBeNull();
  });

  it("agrega las escuchas de todas sus canciones", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", albumName: "Stratosphere", trackName: "Gold Dust" }),
      stream({ artistName: "Duster", albumName: "Stratosphere", trackName: "Inside Out" }),
      stream({ artistName: "Duster", albumName: "Stratosphere", trackName: "Inside Out" }),
    ]);

    const f = await getAlbumDetail(db, HISTORICO, "duster\u001Fstratosphere");
    expect(f?.plays).toBe(3);
  });

  it("lista sus canciones ordenadas por escuchas", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", albumName: "Stratosphere", trackName: "Gold Dust" }),
      stream({ artistName: "Duster", albumName: "Stratosphere", trackName: "Inside Out" }),
      stream({ artistName: "Duster", albumName: "Stratosphere", trackName: "Inside Out" }),
    ]);

    const f = await getAlbumDetail(db, HISTORICO, "duster\u001Fstratosphere");
    expect(f?.tracks.map((t) => t.name)).toEqual(["Inside Out", "Gold Dust"]);
    expect(f?.tracks[0].plays).toBe(2);
  });

  it("no mezcla canciones de otros álbumes del mismo artista", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ artistName: "Duster", albumName: "Stratosphere", trackName: "Gold Dust" }),
      stream({ artistName: "Duster", albumName: "Contemporary Movement", trackName: "Diamond" }),
    ]);

    const f = await getAlbumDetail(db, HISTORICO, "duster\u001Fstratosphere");
    expect(f?.tracks).toHaveLength(1);
    expect(f?.plays).toBe(1);
  });

  it("da la posición dentro del ranking de álbumes", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ albumName: "Primero" }),
      stream({ albumName: "Primero" }),
      stream({ albumName: "Segundo" }),
    ]);

    expect(
      (await getAlbumDetail(db, HISTORICO, "slowdive\u001Fsegundo"))?.posicion,
    ).toBe(2);
  });
});
