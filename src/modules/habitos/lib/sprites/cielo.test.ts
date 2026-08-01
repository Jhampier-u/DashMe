import { describe, expect, it } from "vitest";
import { parseSprite, rectsDe } from "@/modules/core/ui/pixel/rejilla";
import { AURORA, LUNA, NUBE, NUBE_LLUVIA, SOL } from "./cielo";

const TODOS = { SOL, LUNA, AURORA, NUBE, NUBE_LLUVIA };
const firma = (g: string) => JSON.stringify(rectsDe(parseSprite(g)));

describe("los sprites del cielo", () => {
  it("todos se leen sin error y miden 12 de ancho", () => {
    for (const [nombre, g] of Object.entries(TODOS)) {
      expect(() => parseSprite(g), nombre).not.toThrow();
      expect(parseSprite(g).ancho, nombre).toBe(12);
    }
  });

  it("ninguno está vacío", () => {
    for (const [nombre, g] of Object.entries(TODOS)) {
      expect(rectsDe(parseSprite(g)).length, nombre).toBeGreaterThan(0);
    }
  });

  it("los cinco son dibujos distintos entre sí", () => {
    expect(new Set(Object.values(TODOS).map(firma)).size).toBe(5);
  });

  /*
    La nube de lluvia se distingue de la normal por la FORMA —las gotas—, no solo
    por el tono. Es la regla del rediseño: nunca una sola señal.
  */
  it("la nube de lluvia pinta más que la normal", () => {
    const px = (g: string) =>
      rectsDe(parseSprite(g)).reduce((n, r) => n + r.ancho, 0);
    expect(px(NUBE_LLUVIA)).toBeGreaterThan(px(NUBE));
  });
});
