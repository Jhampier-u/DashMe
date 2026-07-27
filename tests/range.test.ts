import { describe, expect, it } from "vitest";
import { parseRange, PRESETS, type StatsRange } from "@/lib/stats/range";

const AHORA = Date.UTC(2026, 6, 27, 12, 0, 0); // 2026-07-27T12:00:00Z

describe("parseRange", () => {
  it("por defecto devuelve las últimas 4 semanas", () => {
    const r = parseRange({}, AHORA);
    expect(r.to).toBe(AHORA);
    expect(r.from).toBe(AHORA - 28 * 24 * 60 * 60 * 1000);
    expect(r.preset).toBe("4w");
  });

  it("resuelve el preset de 6 meses", () => {
    const r = parseRange({ preset: "6m" }, AHORA);
    expect(r.from).toBe(AHORA - 182 * 24 * 60 * 60 * 1000);
    expect(r.preset).toBe("6m");
  });

  it("el preset histórico empieza en el epoch", () => {
    const r = parseRange({ preset: "all" }, AHORA);
    expect(r.from).toBe(0);
    expect(r.to).toBe(AHORA);
  });

  it("acepta un rango explícito", () => {
    const r = parseRange({ desde: "2019-03-01", hasta: "2019-07-31" }, AHORA);
    expect(r.from).toBe(Date.UTC(2019, 2, 1, 0, 0, 0, 0));
    // `hasta` es inclusivo: cubre hasta el último milisegundo del día.
    expect(r.to).toBe(Date.UTC(2019, 6, 31, 23, 59, 59, 999));
    expect(r.preset).toBe("custom");
  });

  it("un rango explícito tiene prioridad sobre el preset", () => {
    const r = parseRange(
      { preset: "6m", desde: "2019-03-01", hasta: "2019-03-31" },
      AHORA,
    );
    expect(r.preset).toBe("custom");
  });

  it("intercambia las fechas si vienen al revés", () => {
    const r = parseRange({ desde: "2019-07-31", hasta: "2019-03-01" }, AHORA);
    expect(r.from).toBeLessThan(r.to);
  });

  it("cae al preset por defecto si las fechas son inválidas", () => {
    const r = parseRange({ desde: "no-es-fecha", hasta: "tampoco" }, AHORA);
    expect(r.preset).toBe("4w");
  });

  it("cae al preset por defecto si el preset no existe", () => {
    const r = parseRange({ preset: "inventado" }, AHORA);
    expect(r.preset).toBe("4w");
  });

  it("ignora un rango con solo una de las dos fechas", () => {
    const r = parseRange({ desde: "2019-03-01" }, AHORA);
    expect(r.preset).toBe("4w");
  });

  it("produce una etiqueta legible", () => {
    const r: StatsRange = parseRange({ preset: "6m" }, AHORA);
    expect(r.label).toBe(PRESETS["6m"].label);
  });
});
