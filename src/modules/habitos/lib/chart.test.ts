import { describe, it, expect } from "vitest";
import {
  areaPath,
  invertLinear,
  linePath,
  scaleLinear,
  segments,
} from "./chart";

describe("scaleLinear", () => {
  it("mapea el dominio al rango", () => {
    const s = scaleLinear([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
  });

  it("admite rangos invertidos, como el eje Y del SVG", () => {
    const s = scaleLinear([0, 1], [100, 0]);
    expect(s(0)).toBe(100);
    expect(s(1)).toBe(0);
  });

  it("no divide por cero con dominio degenerado", () => {
    const s = scaleLinear([5, 5], [0, 100]);
    expect(s(5)).toBe(0);
  });
});

describe("invertLinear", () => {
  it("deshace scaleLinear", () => {
    const s = scaleLinear([0, 27], [32, 546]);
    const inv = invertLinear([0, 27], [32, 546]);
    for (const i of [0, 7, 13, 27]) expect(inv(s(i))).toBeCloseTo(i, 6);
  });

  it("no divide por cero con rango degenerado", () => {
    expect(invertLinear([0, 10], [5, 5])(5)).toBe(0);
  });
});

describe("linePath", () => {
  it("traza una polilínea", () => {
    expect(
      linePath([
        { x: 0, y: 10 },
        { x: 5, y: 0 },
      ]),
    ).toBe("M0 10 L5 0");
  });

  it("devuelve cadena vacía sin puntos", () => {
    expect(linePath([])).toBe("");
  });
});

describe("areaPath", () => {
  it("cierra la línea contra la base", () => {
    expect(
      areaPath(
        [
          { x: 0, y: 10 },
          { x: 5, y: 0 },
        ],
        20,
      ),
    ).toBe("M0 10 L5 0 L5 20 L0 20 Z");
  });
});

describe("segments", () => {
  it("parte la serie en tramos continuos, saltando los huecos", () => {
    expect(segments([1, 2, null, 4])).toEqual([
      { start: 0, values: [1, 2] },
      { start: 3, values: [4] },
    ]);
  });

  it("devuelve un solo tramo si no hay huecos", () => {
    expect(segments([1, 2])).toEqual([{ start: 0, values: [1, 2] }]);
  });

  it("devuelve vacío si todo son huecos", () => {
    expect(segments([null, null])).toEqual([]);
  });
});
