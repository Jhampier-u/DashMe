import { describe, expect, it } from "vitest";
import {
  DEFAULT_HABIT_COLOR,
  HABIT_COLORS,
  habitColorVar,
  resolveHabitColor,
} from "./color";

describe("resolveHabitColor", () => {
  it("deja pasar las claves válidas", () => {
    expect(resolveHabitColor("mint")).toBe("mint");
    expect(resolveHabitColor("lav")).toBe("lav");
    expect(resolveHabitColor("pink")).toBe("pink");
  });

  it("traduce las claves del sistema oscuro", () => {
    expect(resolveHabitColor("aqua")).toBe("mint");
    expect(resolveHabitColor("violet")).toBe("lav");
    expect(resolveHabitColor("orange")).toBe("pink");
  });

  /*
    `mint`, `sky`, `peach` y `pink` eran claves de la era pixel que este mapa
    traducía a otra cosa: `sky` acababa en lavanda y `peach` en naranja, porque
    entonces no había un color propio para ellas.

    Ahora sí lo hay, y se resuelven a sí mismas. Para una fila guardada con
    `sky` eso es un cambio de color visible —de lavanda a cielo—, y es el
    correcto: pasa a mostrar lo que su nombre decía desde el principio.
  */
  it("las claves de la era pixel que hoy existen se resuelven a sí mismas", () => {
    expect(resolveHabitColor("sky")).toBe("sky");
    expect(resolveHabitColor("peach")).toBe("peach");
  });

  it("traduce 'moss', que era el defecto del esquema y no existía", () => {
    expect(resolveHabitColor("moss")).toBe("mint");
  });

  it("traduce 'lavender', que tampoco llegó a existir como token", () => {
    expect(resolveHabitColor("lavender")).toBe("lav");
  });

  it("cae en el color por defecto ante cualquier valor desconocido", () => {
    expect(resolveHabitColor("")).toBe(DEFAULT_HABIT_COLOR);
    expect(resolveHabitColor("chartreuse")).toBe(DEFAULT_HABIT_COLOR);
    expect(resolveHabitColor("AQUA")).toBe(DEFAULT_HABIT_COLOR);
  });

  /*
    `acid` está en la paleta pero no se ofrece como hábito, así que la guarda de
    `resolveHabitColor` tiene que excluirlo a mano. Sin esta afirmación, cambiar
    la comprobación por un simple `stored in PALETA_CATEGORICA` lo dejaría pasar
    y devolvería un valor que el tipo `HabitColor` no admite.
  */
  it("no deja pasar el color descartado", () => {
    expect(resolveHabitColor("acid")).toBe(DEFAULT_HABIT_COLOR);
  });
});

describe("HABIT_COLORS", () => {
  it("tiene siete colores, el máximo distinguible menos el descartado", () => {
    expect(HABIT_COLORS).toHaveLength(7);
  });

  it("no ofrece el color descartado", () => {
    expect(HABIT_COLORS.map((c) => c.key)).not.toContain("acid");
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
    expect(habitColorVar("mint")).toBe("var(--c-mint)");
    expect(habitColorVar("lav")).toBe("var(--c-lav)");
  });
});
