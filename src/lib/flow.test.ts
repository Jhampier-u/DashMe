import { describe, it, expect } from "vitest";
import { dayKeyFromISO } from "./day";
import { startOfWeek, weeklyCounts } from "./flow";

const key = (iso: string) => dayKeyFromISO(iso)!;
// Calendario: 2026-07-20 lun · 22 mié · 25 sáb · 26 dom · 27 lun

describe("startOfWeek", () => {
  it("el lunes es su propio inicio de semana", () => {
    expect(startOfWeek(key("2026-07-20"))).toEqual(key("2026-07-20"));
  });

  it("el miércoles cae en la semana de su lunes", () => {
    expect(startOfWeek(key("2026-07-22"))).toEqual(key("2026-07-20"));
  });

  it("el domingo cae en la semana que empezó el lunes anterior", () => {
    expect(startOfWeek(key("2026-07-26"))).toEqual(key("2026-07-20"));
  });
});

describe("weeklyCounts", () => {
  const hoy = key("2026-07-27"); // lunes

  it("agrupa por semana y devuelve una entrada por semana pedida", () => {
    const fechas = [
      new Date("2026-07-27T12:00:00Z"),
      new Date("2026-07-22T12:00:00Z"),
      new Date("2026-07-26T12:00:00Z"),
    ];
    const out = weeklyCounts(fechas, 2, hoy);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ week: "2026-07-20", count: 2 });
    expect(out[1]).toEqual({ week: "2026-07-27", count: 1 });
  });

  it("una semana sin sucesos vale cero, no desaparece", () => {
    const out = weeklyCounts([new Date("2026-07-27T12:00:00Z")], 3, hoy);
    expect(out.map((b) => b.count)).toEqual([0, 0, 1]);
    expect(out.map((b) => b.week)).toEqual([
      "2026-07-13", "2026-07-20", "2026-07-27",
    ]);
  });

  it("descarta lo que cae fuera de la ventana", () => {
    const out = weeklyCounts([new Date("2026-01-01T12:00:00Z")], 2, hoy);
    expect(out.every((b) => b.count === 0)).toBe(true);
  });

  it("sin fechas devuelve todas las semanas a cero", () => {
    expect(weeklyCounts([], 2, hoy).map((b) => b.count)).toEqual([0, 0]);
  });
});
