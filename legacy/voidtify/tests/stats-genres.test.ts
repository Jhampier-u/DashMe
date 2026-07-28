import { describe, expect, it } from "vitest";
import {
  getGenreBreakdown,
  getArtistasSinGeneros,
  guardarGeneros,
} from "@/lib/stats/genres";
import type { StatsRange } from "@/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const HISTORICO: StatsRange = {
  fromDate: "1970-01-01",
  toDate: "2099-12-31",
  label: "Histórico",
  preset: "all",
};

const d = "2026-03-10";

/** Siembra n escuchas de un artista. */
function escuchas(artista: string, n: number) {
  return Array.from({ length: n }, () =>
    stream({ localDate: d, artistName: artista }),
  );
}

describe("guardarGeneros", () => {
  it("guarda y recupera los géneros de un artista", async () => {
    const { db } = createTestDb();
    await guardarGeneros(db, "duster", ["slowcore", "indie rock"]);

    const { generos } = await getGenreBreakdown(db, HISTORICO);
    expect(generos).toEqual([]); // sin escuchas, no hay nada que ponderar
  });

  it("sobrescribe si se vuelve a guardar", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, escuchas("Duster", 3));

    await guardarGeneros(db, "duster", ["viejo"]);
    await guardarGeneros(db, "duster", ["nuevo"]);

    const { generos } = await getGenreBreakdown(db, HISTORICO);
    expect(generos.map((g) => g.name)).toEqual(["nuevo"]);
  });

  it("acepta una lista vacía, para no reintentar eternamente", async () => {
    // Un artista que Last.fm no conoce debe quedar cacheado igualmente.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, escuchas("Desconocido", 2));

    await guardarGeneros(db, "desconocido", []);

    expect(await getArtistasSinGeneros(db, HISTORICO)).toEqual([]);
  });
});

describe("getArtistasSinGeneros", () => {
  it("devuelve vacío cuando no hay escuchas", async () => {
    const { db } = createTestDb();
    expect(await getArtistasSinGeneros(db, HISTORICO)).toEqual([]);
  });

  it("lista los artistas que aún no tienen caché", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [...escuchas("Duster", 2), ...escuchas("Slowdive", 1)]);

    const p = await getArtistasSinGeneros(db, HISTORICO);
    expect(p.map((x) => x.name).sort()).toEqual(["Duster", "Slowdive"]);
  });

  it("excluye a los ya cacheados", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [...escuchas("Duster", 2), ...escuchas("Slowdive", 1)]);
    await guardarGeneros(db, "duster", ["slowcore"]);

    const p = await getArtistasSinGeneros(db, HISTORICO);
    expect(p.map((x) => x.name)).toEqual(["Slowdive"]);
  });

  it("los ordena por escuchas, para resolver primero lo que más pesa", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      ...escuchas("Poco", 1),
      ...escuchas("Mucho", 5),
      ...escuchas("Medio", 3),
    ]);

    expect((await getArtistasSinGeneros(db, HISTORICO)).map((x) => x.name)).toEqual([
      "Mucho",
      "Medio",
      "Poco",
    ]);
  });

  it("devuelve el nombre legible, no la clave", async () => {
    // Last.fm se consulta por nombre, así que la clave normalizada no sirve.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, escuchas("Sigur Rós", 2));

    const p = await getArtistasSinGeneros(db, HISTORICO);
    expect(p[0]).toEqual({ key: "sigur ros", name: "Sigur Rós" });
  });

  it("respeta el límite", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(
      sqlite,
      Array.from({ length: 10 }, (_, i) => escuchas(`Artista ${i}`, 1)).flat(),
    );

    expect(await getArtistasSinGeneros(db, HISTORICO, 4)).toHaveLength(4);
  });
});

describe("getGenreBreakdown", () => {
  it("sin escuchas devuelve todo a cero", async () => {
    const { db } = createTestDb();
    expect(await getGenreBreakdown(db, HISTORICO)).toEqual({
      generos: [],
      conGeneros: 0,
      sinGeneros: 0,
    });
  });

  it("cuenta cuántos artistas tienen géneros y cuántos no", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [...escuchas("Con", 2), ...escuchas("Sin", 1)]);
    await guardarGeneros(db, "con", ["shoegaze"]);

    const r = await getGenreBreakdown(db, HISTORICO);
    expect(r.conGeneros).toBe(1);
    expect(r.sinGeneros).toBe(1);
  });

  it("un artista sin etiquetas no cuenta como resuelto", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, escuchas("Vacío", 2));
    await guardarGeneros(db, "vacio", []);

    const r = await getGenreBreakdown(db, HISTORICO);
    expect(r.conGeneros).toBe(0);
    expect(r.generos).toEqual([]);
  });

  it("pondera cada género por las reproducciones de sus artistas", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [...escuchas("Mucho", 10), ...escuchas("Poco", 2)]);
    await guardarGeneros(db, "mucho", ["shoegaze"]);
    await guardarGeneros(db, "poco", ["punk"]);

    const { generos } = await getGenreBreakdown(db, HISTORICO);
    expect(generos.map((g) => [g.name, g.plays])).toEqual([
      ["shoegaze", 10],
      ["punk", 2],
    ]);
  });

  it("suma artistas que comparten género", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [...escuchas("Uno", 3), ...escuchas("Otro", 4)]);
    await guardarGeneros(db, "uno", ["shoegaze"]);
    await guardarGeneros(db, "otro", ["shoegaze"]);

    const { generos } = await getGenreBreakdown(db, HISTORICO);
    expect(generos).toHaveLength(1);
    expect(generos[0].plays).toBe(7);
    expect(generos[0].artistas).toBe(2);
  });

  it("atribuye a un artista solo sus tres primeros géneros", async () => {
    // Last.fm devuelve hasta seis etiquetas y las últimas son ruido.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, escuchas("Etiquetado", 5));
    await guardarGeneros(db, "etiquetado", ["a", "b", "c", "d", "e"]);

    const { generos } = await getGenreBreakdown(db, HISTORICO);
    expect(generos.map((g) => g.name)).toEqual(["a", "b", "c"]);
  });

  it("share suma 1 sobre el total atribuido", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [...escuchas("Uno", 3), ...escuchas("Otro", 1)]);
    await guardarGeneros(db, "uno", ["x"]);
    await guardarGeneros(db, "otro", ["y"]);

    const { generos } = await getGenreBreakdown(db, HISTORICO);
    const suma = generos.reduce((n, g) => n + g.share, 0);
    expect(suma).toBeCloseTo(1);
    expect(generos[0].share).toBeCloseTo(0.75);
  });

  it("respeta el límite de géneros devueltos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, escuchas("Uno", 5));
    await guardarGeneros(db, "uno", ["a", "b", "c"]);

    expect((await getGenreBreakdown(db, HISTORICO, 2)).generos).toHaveLength(2);
  });

  it("respeta el rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-01-15", artistName: "Enero" }),
      stream({ localDate: "2026-06-15", artistName: "Junio" }),
    ]);
    await guardarGeneros(db, "enero", ["invierno"]);
    await guardarGeneros(db, "junio", ["verano"]);

    const enero: StatsRange = {
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      label: "",
      preset: "custom",
    };

    const { generos } = await getGenreBreakdown(db, enero);
    expect(generos.map((g) => g.name)).toEqual(["invierno"]);
  });

  it("ignora un JSON de géneros corrupto sin romperse", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, escuchas("Roto", 2));
    sqlite
      .prepare(
        "INSERT INTO artist_genres (artist_key, genres, fetched_at) VALUES (?, ?, ?)",
      )
      .run("roto", "{no es json", Date.now());

    const r = await getGenreBreakdown(db, HISTORICO);
    expect(r.generos).toEqual([]);
    expect(r.conGeneros).toBe(0);
  });
});
