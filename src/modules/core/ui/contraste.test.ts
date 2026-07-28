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
  it("son exactamente tres", () => {
    expect(Object.keys(ACENTOS_HABITO)).toHaveLength(3);
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
