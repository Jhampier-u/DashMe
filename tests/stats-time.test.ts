import { describe, expect, it } from "vitest";
import { getByHour, getByWeekday, getByMonth } from "@/modules/musica/lib/stats/time";
import type { StatsRange } from "@/modules/musica/lib/stats/range";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const ANIO: StatsRange = {
  fromDate: "2026-01-01",
  toDate: "2026-12-31",
  label: "2026",
  preset: "custom",
};

describe("getByHour", () => {
  it("devuelve siempre las 24 horas, con ceros donde no hubo nada", async () => {
    const { db } = createTestDb();
    const h = await getByHour(db, ANIO);

    expect(h).toHaveLength(24);
    expect(h.map((x) => x.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i));
    expect(h.every((x) => x.plays === 0)).toBe(true);
  });

  it("cuenta cada escucha en su hora local", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", localHour: 3 }),
      stream({ localDate: "2026-03-10", localHour: 22 }),
      stream({ localDate: "2026-03-11", localHour: 22 }),
    ]);

    const h = await getByHour(db, ANIO);
    expect(h[3].plays).toBe(1);
    expect(h[22].plays).toBe(2);
    expect(h[0].plays).toBe(0);
  });

  it("suma también los milisegundos por hora", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-10", localHour: 9, msPlayed: 100_000 }),
      stream({ localDate: "2026-03-10", localHour: 9, msPlayed: 50_000 }),
    ]);

    expect((await getByHour(db, ANIO))[9].ms).toBe(150_000);
  });

  it("incluye la medianoche como hora 0", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ localDate: "2026-03-10", localHour: 0 })]);
    expect((await getByHour(db, ANIO))[0].plays).toBe(1);
  });
});

describe("getByWeekday", () => {
  it("devuelve siempre siete días empezando en lunes", async () => {
    const { db } = createTestDb();
    const w = await getByWeekday(db, ANIO);

    expect(w).toHaveLength(7);
    expect(w.map((x) => x.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("sitúa cada fecha en su día de la semana", async () => {
    // 2026-03-09 es lunes; 2026-03-15 es domingo.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-09" }),
      stream({ localDate: "2026-03-15" }),
      stream({ localDate: "2026-03-15" }),
    ]);

    const w = await getByWeekday(db, ANIO);
    expect(w[0].plays).toBe(1); // lunes
    expect(w[6].plays).toBe(2); // domingo
  });
});

describe("getByMonth", () => {
  it("devuelve un punto por mes presente, en orden", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-01-15" }),
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-20" }),
    ]);

    const m = await getByMonth(db, ANIO);
    expect(m.map((x) => x.month)).toEqual(["2026-01", "2026-03"]);
    expect(m.map((x) => x.plays)).toEqual([1, 2]);
  });

  it("no inventa meses vacíos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ localDate: "2026-06-15" })]);
    expect(await getByMonth(db, ANIO)).toHaveLength(1);
  });

  it("ordena cronológicamente a través de años", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-01-05" }),
      stream({ localDate: "2025-12-20" }),
    ]);

    const rango: StatsRange = {
      fromDate: "2025-01-01",
      toDate: "2026-12-31",
      label: "",
      preset: "custom",
    };
    expect((await getByMonth(db, rango)).map((x) => x.month)).toEqual([
      "2025-12",
      "2026-01",
    ]);
  });
});
