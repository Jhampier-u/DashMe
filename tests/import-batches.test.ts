import { describe, expect, it } from "vitest";
import {
  registrarTanda,
  tandaPorHash,
  listarTandas,
} from "@/modules/musica/lib/import/batches";
import { createTestDb } from "./helpers/test-db";

const base = {
  filename: "Streaming_History_Audio_2019.json",
  fileHash: "abc123",
  format: "extended",
  rowsRead: 100,
  rowsInserted: 95,
  rowsSkipped: 3,
  rowsInvalid: 2,
  rangeStart: 1_500_000_000_000,
  rangeEnd: 1_600_000_000_000,
  status: "ok",
};

describe("registrarTanda", () => {
  it("guarda una tanda y le pone la fecha", async () => {
    const { db } = createTestDb();
    await registrarTanda(db, base);

    const tandas = await listarTandas(db);
    expect(tandas).toHaveLength(1);
    expect(tandas[0].filename).toBe(base.filename);
    expect(tandas[0].rowsInserted).toBe(95);
    expect(tandas[0].importedAt).toBeGreaterThan(0);
  });

  it("permite varias tandas del mismo archivo", async () => {
    // Reimportar es legítimo: la deduplicación garantiza que no duplica filas.
    const { db } = createTestDb();
    await registrarTanda(db, base);
    await registrarTanda(db, { ...base, rowsInserted: 0 });

    expect(await listarTandas(db)).toHaveLength(2);
  });

  it("las lista de más reciente a más antigua", async () => {
    const { db } = createTestDb();
    await registrarTanda(db, { ...base, filename: "primero.json" });
    await registrarTanda(db, { ...base, filename: "segundo.json" });

    const tandas = await listarTandas(db);
    expect(tandas[0].filename).toBe("segundo.json");
  });
});

describe("tandaPorHash", () => {
  it("devuelve null si el archivo nunca se importó", async () => {
    const { db } = createTestDb();
    expect(await tandaPorHash(db, "nunca-visto")).toBeNull();
  });

  it("encuentra una tanda anterior por su hash", async () => {
    const { db } = createTestDb();
    await registrarTanda(db, base);

    const previa = await tandaPorHash(db, "abc123");
    expect(previa?.filename).toBe(base.filename);
  });

  it("devuelve la más reciente si el hash se repite", async () => {
    const { db } = createTestDb();
    await registrarTanda(db, { ...base, rowsInserted: 95 });
    await registrarTanda(db, { ...base, rowsInserted: 0 });

    expect((await tandaPorHash(db, "abc123"))?.rowsInserted).toBe(0);
  });
});
