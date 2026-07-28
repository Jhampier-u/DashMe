import { describe, expect, it } from "vitest";
import { aplicarDumpManda } from "@/lib/import/dump-wins";
import { createTestDb } from "./helpers/test-db";
import { seedStreams, stream } from "./helpers/seed-streams";

const DIA = 86_400_000;
const T = (n: number) => 1_700_000_000_000 + n * DIA;

function contarPorFuente(sqlite: ReturnType<typeof createTestDb>["sqlite"]) {
  return Object.fromEntries(
    (
      sqlite
        .prepare("SELECT source, COUNT(*) AS n FROM streams GROUP BY source")
        .all() as { source: string; n: number }[]
    ).map((f) => [f.source, f.n]),
  );
}

describe("aplicarDumpManda", () => {
  it("no borra nada si no hay rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ ts: T(1), source: "live" })]);

    expect(await aplicarDumpManda(db, null, null)).toBe(0);
    expect(contarPorFuente(sqlite).live).toBe(1);
  });

  it("borra las filas live dentro del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: T(5), source: "live" }),
      stream({ ts: T(6), source: "live" }),
    ]);

    expect(await aplicarDumpManda(db, T(1), T(10))).toBe(2);
    expect(contarPorFuente(sqlite).live).toBeUndefined();
  });

  it("no toca las filas live posteriores al dump", async () => {
    // Lo capturado después de que Spotify generara el dump es lo único que
    // existe de ese periodo: borrarlo sería perderlo para siempre.
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: T(5), source: "live" }),
      stream({ ts: T(20), source: "live" }),
    ]);

    expect(await aplicarDumpManda(db, T(1), T(10))).toBe(1);
    expect(contarPorFuente(sqlite).live).toBe(1);
  });

  it("no toca las filas live anteriores al rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: T(1), source: "live" }),
      stream({ ts: T(5), source: "live" }),
    ]);

    expect(await aplicarDumpManda(db, T(3), T(10))).toBe(1);
    expect(contarPorFuente(sqlite).live).toBe(1);
  });

  it("incluye los extremos del rango", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: T(3), source: "live" }),
      stream({ ts: T(10), source: "live" }),
    ]);

    expect(await aplicarDumpManda(db, T(3), T(10))).toBe(2);
  });

  it("nunca borra filas importadas", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [
      stream({ ts: T(5), source: "import" }),
      stream({ ts: T(6), source: "live" }),
    ]);

    expect(await aplicarDumpManda(db, T(1), T(10))).toBe(1);
    expect(contarPorFuente(sqlite).import).toBe(1);
  });

  it("deja la tabla intacta si no hay ninguna fila live", async () => {
    const { db, sqlite } = createTestDb();
    seedStreams(sqlite, [stream({ ts: T(5), source: "import" })]);

    expect(await aplicarDumpManda(db, T(1), T(10))).toBe(0);
    expect(
      (sqlite.prepare("SELECT COUNT(*) AS n FROM streams").get() as { n: number })
        .n,
    ).toBe(1);
  });
});
