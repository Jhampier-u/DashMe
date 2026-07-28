import { describe, expect, it } from "vitest";
import { isPlantWilted, plantStateLabel, stageFor } from "./garden";

describe("isPlantWilted", () => {
  it("marchita: hoy sin cumplir, racha a cero y se cumplió alguna vez", () => {
    expect(isPlantWilted(0, false, true)).toBe(true);
  });

  it("no marchita si nunca se ha cumplido: eso es una semilla", () => {
    expect(isPlantWilted(0, false, false)).toBe(false);
  });

  it("no marchita si hoy ya está hecho", () => {
    expect(isPlantWilted(0, true, true)).toBe(false);
  });

  it("no marchita mientras quede racha viva", () => {
    expect(isPlantWilted(3, false, true)).toBe(false);
  });
});

describe("plantStateLabel", () => {
  it("dice Marchita cuando la planta se pinta marchita", () => {
    // Este era el fallo: el cartel decía «Semilla» junto a un 🥀.
    expect(plantStateLabel(0, false, true)).toBe("Marchita");
  });

  it("distingue la semilla que nunca brotó de la planta marchita", () => {
    expect(plantStateLabel(0, false, false)).toBe("Semilla");
  });

  it("nombra la etapa que corresponde a la racha", () => {
    expect(plantStateLabel(1, true, true)).toBe("Brote");
    expect(plantStateLabel(4, true, true)).toBe("Joven");
    expect(plantStateLabel(9, true, true)).toBe("Madura");
    expect(plantStateLabel(20, true, true)).toBe("Floreciente");
  });

  it("una racha viva manda sobre el hoy sin cumplir", () => {
    // Con racha, la planta sigue viva hasta que el día se cierre.
    expect(plantStateLabel(8, false, true)).toBe("Madura");
  });
});

describe("stageFor", () => {
  it("reparte las cinco etapas por los umbrales de racha", () => {
    expect(stageFor(0)).toBe(0);
    expect(stageFor(1)).toBe(1);
    expect(stageFor(2)).toBe(1);
    expect(stageFor(3)).toBe(2);
    expect(stageFor(6)).toBe(2);
    expect(stageFor(7)).toBe(3);
    expect(stageFor(13)).toBe(3);
    expect(stageFor(14)).toBe(4);
    expect(stageFor(100)).toBe(4);
  });
});
