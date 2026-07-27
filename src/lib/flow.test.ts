import { describe, it, expect } from "vitest";
import { dayKeyFromISO } from "./day";
import {
  lifetimeDays,
  median,
  oldestOpenDays,
  periodChange,
  startOfWeek,
  weeklyCounts,
} from "./flow";

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

describe("median", () => {
  it("con un número impar toma el central", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("con un número par promedia los dos centrales", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("sobre lista vacía devuelve null, no cero", () => {
    expect(median([])).toBeNull();
  });

  it("no altera el array recibido", () => {
    const original = [3, 1, 2];
    median(original);
    expect(original).toEqual([3, 1, 2]);
  });
});

describe("lifetimeDays", () => {
  it("cuenta días de calendario, no horas", () => {
    // Creada de noche, cerrada a la mañana siguiente: un día, no cero.
    expect(
      lifetimeDays([
        {
          createdAt: new Date("2026-07-20T23:00:00-05:00"),
          completedAt: new Date("2026-07-21T08:00:00-05:00"),
        },
      ]),
    ).toEqual([1]);
  });

  it("una tarea abierta y cerrada el mismo día vale cero", () => {
    expect(
      lifetimeDays([
        {
          createdAt: new Date("2026-07-20T09:00:00-05:00"),
          completedAt: new Date("2026-07-20T18:00:00-05:00"),
        },
      ]),
    ).toEqual([0]);
  });
});

describe("oldestOpenDays", () => {
  const hoy = key("2026-07-27");

  it("devuelve los días de la más antigua", () => {
    expect(
      oldestOpenDays(
        [new Date("2026-07-25T10:00:00-05:00"), new Date("2026-07-20T10:00:00-05:00")],
        hoy,
      ),
    ).toBe(7);
  });

  it("sin nada abierto devuelve null", () => {
    expect(oldestOpenDays([], hoy)).toBeNull();
  });
});

describe("periodChange", () => {
  const semanas = (...counts: number[]) =>
    counts.map((count, i) => ({ week: `w${i}`, count }));

  it("compara la segunda mitad con la primera", () => {
    expect(periodChange(semanas(2, 2, 3, 3))).toEqual({
      previous: 4,
      current: 6,
      changePercent: 50,
    });
  });

  it("omite el porcentaje si el periodo anterior suma cero", () => {
    expect(periodChange(semanas(0, 0, 3, 3))).toEqual({
      previous: 0,
      current: 6,
      changePercent: null,
    });
  });

  it("una bajada da porcentaje negativo", () => {
    expect(periodChange(semanas(5, 5, 2, 3)).changePercent).toBe(-50);
  });
});
