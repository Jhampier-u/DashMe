import { describe, it, expect } from "vitest";
import { contraste, PALETA, ACENTOS_HABITO, separacionMinima } from "./contraste";

describe("la paleta cumple las reglas del sistema", () => {
  it("el texto principal sobre papel pasa AA", () => {
    expect(contraste(PALETA.ink, PALETA.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(PALETA.ink, PALETA.paper2)).toBeGreaterThanOrEqual(4.5);
  });

  it("el texto secundario sobre papel pasa AA para texto grande", () => {
    expect(contraste(PALETA.ink2, PALETA.paper)).toBeGreaterThanOrEqual(3);
  });

  it("el trazo se distingue del papel", () => {
    expect(contraste(PALETA.line, PALETA.paper)).toBeGreaterThanOrEqual(3);
  });

  it("cada pastel sirve de fondo para la tinta", () => {
    for (const [nombre, hex] of Object.entries(PALETA.acentos)) {
      expect(
        contraste(PALETA.ink, hex),
        `${nombre} no aguanta texto en tinta`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("los acentos de hábito se distinguen entre sí", () => {
  it("son siete", () => {
    // Fueron tres, y el comentario que había aquí decía que tres era «el máximo
    // que pasa la separación bajo daltonismo». Era falso: el límite estaba en
    // el inventario, no en el método. Con los trece colores disponibles, el
    // conjunto más grande que pasa los tres umbrales es de ocho; se ofrecen
    // siete porque el octavo se descartó por gusto.
    //
    // Lo que de verdad protege este bloque son las tres afirmaciones de abajo,
    // que miden. Esta solo fija el número para que ampliarlo sea una decisión
    // consciente y no un descuido.
    expect(Object.keys(ACENTOS_HABITO)).toHaveLength(7);
  });

  it("ningún par se confunde con visión normal", () => {
    expect(separacionMinima(ACENTOS_HABITO, "normal")).toBeGreaterThanOrEqual(20);
  });

  it("ningún par se confunde con deuteranopía", () => {
    expect(separacionMinima(ACENTOS_HABITO, "deutan")).toBeGreaterThanOrEqual(9);
  });

  it("ningún par se confunde con protanopía", () => {
    expect(separacionMinima(ACENTOS_HABITO, "protan")).toBeGreaterThanOrEqual(9);
  });
});
