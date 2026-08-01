import { describe, expect, it } from "vitest";
import { parseSprite, rectsDe } from "@/modules/core/ui/pixel/sprite";
import { FLOR, FLOR_MARCHITA } from "@/modules/habitos/lib/sprites/flor";

describe("los sprites de la flor", () => {
  it("las cinco etapas y la marchita se leen sin error", () => {
    for (const [i, s] of [...FLOR, FLOR_MARCHITA].entries()) {
      expect(() => parseSprite(s), `sprite ${i}`).not.toThrow();
    }
  });

  it("todas miden 16 de ancho", () => {
    for (const s of [...FLOR, FLOR_MARCHITA]) {
      expect(parseSprite(s).ancho).toBe(16);
    }
  });

  /*
    La silueta tiene que CRECER de verdad: si dos etapas pintaran lo mismo,
    estariamos repitiendo el fallo de los emoji.
  */
  it("cada etapa dibuja mas que la anterior", () => {
    const pintados = FLOR.map(
      (s) => rectsDe(parseSprite(s)).reduce((n, r) => n + r.ancho, 0),
    );
    for (let i = 1; i < pintados.length; i++) {
      expect(pintados[i], `etapa ${i} vs ${i - 1}`).toBeGreaterThan(pintados[i - 1]);
    }
  });

  it("las cinco etapas son dibujos distintos", () => {
    const firmas = FLOR.map((s) => JSON.stringify(rectsDe(parseSprite(s))));
    expect(new Set(firmas).size).toBe(5);
  });

  it("la marchita no es igual a ninguna etapa", () => {
    const m = JSON.stringify(rectsDe(parseSprite(FLOR_MARCHITA)));
    const etapas = FLOR.map((s) => JSON.stringify(rectsDe(parseSprite(s))));
    expect(etapas).not.toContain(m);
  });
});
