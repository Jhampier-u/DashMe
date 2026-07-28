import { describe, expect, it } from "vitest";
import { getTotals } from "@/lib/stats/totals";
import type { StatsRange } from "@/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const MARZO: StatsRange = {
  fromDate: "2026-03-01",
  toDate: "2026-03-31",
  label: "Marzo",
  preset: "custom",
};

describe("getTotals", () => {
  it("devuelve ceros cuando no hay nada en el rango", async () => {
    const { db } = createTestDb();
    const t = await getTotals(db, MARZO);

    expect(t).toEqual({
      msTotal: 0,
      reproducciones: 0,
      diasActivos: 0,
      artistas: 0,
      canciones: 0,
      albumes: 0,
    });
  });

  it("suma los milisegundos de todas las filas del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", msPlayed: 200_000 }),
      stream({ localDate: "2026-03-11", msPlayed: 100_000 }),
    ]);

    expect((await getTotals(db, MARZO)).msTotal).toBe(300_000);
  });

  it("incluye en los minutos las reproducciones cortas", async () => {
    // Doce segundos escuchados son doce segundos, aunque no cuenten como
    // reproducción para el ranking.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", msPlayed: 12_000 }),
    ]);

    const t = await getTotals(db, MARZO);
    expect(t.msTotal).toBe(12_000);
    expect(t.reproducciones).toBe(0);
  });

  it("cuenta como reproducción solo lo que supera 30 segundos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", msPlayed: 29_999 }),
      stream({ localDate: "2026-03-10", msPlayed: 30_000 }),
      stream({ localDate: "2026-03-10", msPlayed: 200_000 }),
    ]);

    expect((await getTotals(db, MARZO)).reproducciones).toBe(2);
  });

  it("cuenta días activos distintos, no filas", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10" }),
      stream({ localDate: "2026-03-10" }),
      stream({ localDate: "2026-03-10" }),
      stream({ localDate: "2026-03-11" }),
    ]);

    expect((await getTotals(db, MARZO)).diasActivos).toBe(2);
  });

  it("cuenta entidades distintas por clave normalizada", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", artistName: "Slowdive", trackName: "Alison", albumName: "Souvlaki" }),
      stream({ localDate: "2026-03-10", artistName: "slowdive", trackName: "alison", albumName: "souvlaki" }),
      stream({ localDate: "2026-03-10", artistName: "Duster", trackName: "Inside Out", albumName: "Stratosphere" }),
    ]);

    const t = await getTotals(db, MARZO);
    expect(t.artistas).toBe(2);
    expect(t.canciones).toBe(2);
    expect(t.albumes).toBe(2);
  });

  it("excluye lo que cae fuera del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-02-28", msPlayed: 999_999 }),
      stream({ localDate: "2026-04-01", msPlayed: 999_999 }),
      stream({ localDate: "2026-03-15", msPlayed: 100_000 }),
    ]);

    expect((await getTotals(db, MARZO)).msTotal).toBe(100_000);
  });

  it("no cuenta álbumes nulos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", albumName: null }),
    ]);

    expect((await getTotals(db, MARZO)).albumes).toBe(0);
  });
});
