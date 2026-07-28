import { describe, expect, it } from "vitest";
import { getTopArtists, getTopTracks, getTopAlbums } from "@/modules/musica/lib/stats/tops";
import type { StatsRange } from "@/modules/musica/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const MARZO: StatsRange = {
  fromDate: "2026-03-01",
  toDate: "2026-03-31",
  label: "Marzo",
  preset: "custom",
};

const d = "2026-03-10";

describe("getTopArtists", () => {
  it("devuelve lista vacía sin datos", async () => {
    const { db } = createTestDb();
    expect(await getTopArtists(db, MARZO)).toEqual([]);
  });

  it("ordena por reproducciones de mayor a menor", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster" }),
      stream({ localDate: d, artistName: "Duster" }),
      stream({ localDate: d, artistName: "Duster" }),
      stream({ localDate: d, artistName: "Slowdive" }),
      stream({ localDate: d, artistName: "Slowdive" }),
      stream({ localDate: d, artistName: "Grouper" }),
    ]);

    const top = await getTopArtists(db, MARZO);
    expect(top.map((a) => a.name)).toEqual(["Duster", "Slowdive", "Grouper"]);
    expect(top.map((a) => a.plays)).toEqual([3, 2, 1]);
  });

  it("agrupa variantes del mismo nombre", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Beyoncé" }),
      stream({ localDate: d, artistName: "beyonce" }),
    ]);

    const top = await getTopArtists(db, MARZO);
    expect(top).toHaveLength(1);
    expect(top[0].plays).toBe(2);
  });

  it("devuelve también los milisegundos de cada uno", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", msPlayed: 100_000 }),
      stream({ localDate: d, artistName: "Duster", msPlayed: 50_000 }),
    ]);

    expect((await getTopArtists(db, MARZO))[0].ms).toBe(150_000);
  });

  it("puede ordenar por tiempo en vez de por reproducciones", async () => {
    // Un artista de temas largos pierde por reproducciones y gana por tiempo.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Godspeed", msPlayed: 1_200_000 }),
      stream({ localDate: d, artistName: "Ramones", msPlayed: 90_000 }),
      stream({ localDate: d, artistName: "Ramones", msPlayed: 90_000 }),
    ]);

    expect((await getTopArtists(db, MARZO, "plays"))[0].name).toBe("Ramones");
    expect((await getTopArtists(db, MARZO, "ms"))[0].name).toBe("Godspeed");
  });

  it("ignora reproducciones por debajo del umbral", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", msPlayed: 5_000 }),
      stream({ localDate: d, artistName: "Slowdive", msPlayed: 200_000 }),
    ]);

    const top = await getTopArtists(db, MARZO);
    expect(top).toHaveLength(1);
    expect(top[0].name).toBe("Slowdive");
  });

  it("respeta el límite", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(
      sqlite,
      Array.from({ length: 30 }, (_, i) =>
        stream({ localDate: d, artistName: `Artista ${i}` }),
      ),
    );

    expect(await getTopArtists(db, MARZO, "plays", 10)).toHaveLength(10);
  });

  it("muestra el nombre tal como se escribió, no la clave", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Sigur Rós" }),
    ]);

    expect((await getTopArtists(db, MARZO))[0].name).toBe("Sigur Rós");
  });

  it("excluye lo que cae fuera del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-02-01", artistName: "Fuera" }),
      stream({ localDate: d, artistName: "Dentro" }),
    ]);

    const top = await getTopArtists(db, MARZO);
    expect(top.map((a) => a.name)).toEqual(["Dentro"]);
  });
});

describe("getTopTracks", () => {
  it("agrupa por canción, no por artista", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", trackName: "Inside Out" }),
      stream({ localDate: d, artistName: "Duster", trackName: "Inside Out" }),
      stream({ localDate: d, artistName: "Duster", trackName: "Gold Dust" }),
    ]);

    const top = await getTopTracks(db, MARZO);
    expect(top).toHaveLength(2);
    expect(top[0].name).toBe("Inside Out");
    expect(top[0].plays).toBe(2);
  });

  it("incluye el artista de cada canción", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", trackName: "Inside Out" }),
    ]);

    expect((await getTopTracks(db, MARZO))[0].artistName).toBe("Duster");
  });

  it("distingue canciones con el mismo título de artistas distintos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", trackName: "Constellations" }),
      stream({ localDate: d, artistName: "Jack Johnson", trackName: "Constellations" }),
    ]);

    expect(await getTopTracks(db, MARZO)).toHaveLength(2);
  });
});

describe("getTopAlbums", () => {
  it("agrupa por álbum e incluye el artista", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, artistName: "Duster", albumName: "Stratosphere" }),
      stream({ localDate: d, artistName: "Duster", albumName: "Stratosphere" }),
      stream({ localDate: d, artistName: "Duster", albumName: "Contemporary Movement" }),
    ]);

    const top = await getTopAlbums(db, MARZO);
    expect(top).toHaveLength(2);
    expect(top[0].name).toBe("Stratosphere");
    expect(top[0].artistName).toBe("Duster");
  });

  it("ignora filas sin álbum", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: d, albumName: null }),
      stream({ localDate: d, albumName: "Souvlaki" }),
    ]);

    expect(await getTopAlbums(db, MARZO)).toHaveLength(1);
  });
});
