import { describe, expect, it } from "vitest";
import { getStreaks } from "@/lib/stats/streaks";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const HOY = "2026-03-15";

describe("getStreaks", () => {
  it("sin datos, ambas rachas son cero", async () => {
    const { db } = createTestDb();
    expect(await getStreaks(db, HOY)).toEqual({
      actual: 0,
      maxima: 0,
      maximaDesde: null,
      maximaHasta: null,
    });
  });

  it("un solo día es una racha de uno", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ localDate: "2026-03-01" })]);

    const r = await getStreaks(db, HOY);
    expect(r.maxima).toBe(1);
    expect(r.maximaDesde).toBe("2026-03-01");
    expect(r.maximaHasta).toBe("2026-03-01");
  });

  it("varias escuchas el mismo día siguen siendo un día", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-01" }),
    ]);

    expect((await getStreaks(db, HOY)).maxima).toBe(1);
  });

  it("cuenta días consecutivos", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-02" }),
      stream({ localDate: "2026-03-03" }),
    ]);

    const r = await getStreaks(db, HOY);
    expect(r.maxima).toBe(3);
    expect(r.maximaDesde).toBe("2026-03-01");
    expect(r.maximaHasta).toBe("2026-03-03");
  });

  it("un hueco parte la racha", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-02" }),
      // falta el 3
      stream({ localDate: "2026-03-04" }),
    ]);

    expect((await getStreaks(db, HOY)).maxima).toBe(2);
  });

  it("se queda con la racha más larga cuando hay varias", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-01" }),
      stream({ localDate: "2026-03-02" }),
      stream({ localDate: "2026-03-05" }),
      stream({ localDate: "2026-03-06" }),
      stream({ localDate: "2026-03-07" }),
      stream({ localDate: "2026-03-08" }),
    ]);

    const r = await getStreaks(db, HOY);
    expect(r.maxima).toBe(4);
    expect(r.maximaDesde).toBe("2026-03-05");
  });

  it("cruza el cambio de mes", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-01-30" }),
      stream({ localDate: "2026-01-31" }),
      stream({ localDate: "2026-02-01" }),
    ]);

    expect((await getStreaks(db, HOY)).maxima).toBe(3);
  });

  it("cruza el 29 de febrero de un año bisiesto", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2024-02-28" }),
      stream({ localDate: "2024-02-29" }),
      stream({ localDate: "2024-03-01" }),
    ]);

    expect((await getStreaks(db, "2024-03-05")).maxima).toBe(3);
  });

  it("la racha actual llega hasta hoy", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-13" }),
      stream({ localDate: "2026-03-14" }),
      stream({ localDate: "2026-03-15" }),
    ]);

    expect((await getStreaks(db, "2026-03-15")).actual).toBe(3);
  });

  it("la racha actual sigue viva si se escuchó ayer pero aún no hoy", async () => {
    // A las 9 de la mañana todavía no has puesto nada; la racha no está rota.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-13" }),
      stream({ localDate: "2026-03-14" }),
    ]);

    expect((await getStreaks(db, "2026-03-15")).actual).toBe(2);
  });

  it("la racha actual es cero si la última escucha fue anteayer", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-03-12" }),
      stream({ localDate: "2026-03-13" }),
    ]);

    expect((await getStreaks(db, "2026-03-15")).actual).toBe(0);
  });

  it("una racha pasada no cuenta como actual", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ localDate: "2026-01-01" }),
      stream({ localDate: "2026-01-02" }),
      stream({ localDate: "2026-01-03" }),
    ]);

    const r = await getStreaks(db, HOY);
    expect(r.maxima).toBe(3);
    expect(r.actual).toBe(0);
  });
});
