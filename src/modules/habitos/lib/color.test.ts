import { describe, expect, it } from "vitest";
import {
  DEFAULT_HABIT_COLOR,
  HABIT_COLORS,
  habitColorVar,
  resolveHabitColor,
} from "./color";

describe("resolveHabitColor", () => {
  it("deja intactas las tres claves válidas", () => {
    expect(resolveHabitColor("aqua")).toBe("aqua");
    expect(resolveHabitColor("violet")).toBe("violet");
    expect(resolveHabitColor("orange")).toBe("orange");
  });

  it("traduce las claves de la era pixel por tono más cercano", () => {
    expect(resolveHabitColor("mint")).toBe("aqua");
    expect(resolveHabitColor("sky")).toBe("violet");
    expect(resolveHabitColor("lavender")).toBe("violet");
    expect(resolveHabitColor("peach")).toBe("orange");
    expect(resolveHabitColor("pink")).toBe("orange");
  });

  it("traduce 'moss', que era el defecto del esquema y no existía", () => {
    expect(resolveHabitColor("moss")).toBe("aqua");
  });

  it("cae en el color por defecto ante cualquier valor desconocido", () => {
    expect(resolveHabitColor("")).toBe(DEFAULT_HABIT_COLOR);
    expect(resolveHabitColor("chartreuse")).toBe(DEFAULT_HABIT_COLOR);
    expect(resolveHabitColor("AQUA")).toBe(DEFAULT_HABIT_COLOR);
  });
});

describe("HABIT_COLORS", () => {
  it("tiene exactamente tres colores, que es el máximo distinguible", () => {
    expect(HABIT_COLORS).toHaveLength(3);
  });

  it("todas sus claves se resuelven a sí mismas", () => {
    for (const c of HABIT_COLORS) {
      expect(resolveHabitColor(c.key)).toBe(c.key);
    }
  });

  it("incluye el color por defecto", () => {
    expect(HABIT_COLORS.map((c) => c.key)).toContain(DEFAULT_HABIT_COLOR);
  });
});

describe("habitColorVar", () => {
  it("devuelve la referencia al token CSS", () => {
    expect(habitColorVar("aqua")).toBe("var(--h-aqua)");
    expect(habitColorVar("violet")).toBe("var(--h-violet)");
  });
});
