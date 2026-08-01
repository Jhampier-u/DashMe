import { describe, expect, it } from "vitest";
import { parseSprite, rectsDe } from "@/modules/core/ui/pixel/rejilla";
import { PLANT_SPECIES } from "../garden";
import { SPRITES, spriteDe } from "./index";

/** Cuántos píxeles pinta un sprite. Sirve para comparar siluetas. */
const pintados = (g: string) =>
  rectsDe(parseSprite(g)).reduce((n, r) => n + r.ancho, 0);

const firma = (g: string) => JSON.stringify(rectsDe(parseSprite(g)));

describe.each(PLANT_SPECIES.map((s) => s.key))("la especie %s", (key) => {
  const { etapas, marchita } = SPRITES[key];

  it("tiene cinco etapas", () => {
    expect(etapas).toHaveLength(5);
  });

  it("todas sus rejillas se leen sin error y miden 16 de ancho", () => {
    for (const g of [...etapas, marchita]) {
      expect(() => parseSprite(g)).not.toThrow();
      expect(parseSprite(g).ancho).toBe(16);
    }
  });

  /*
    EL CRITERIO QUE ESTE BLOQUE VENÍA A ARREGLAR. Con emoji, tres especies
    repetían el mismo dibujo en las etapas 1 a 4: elegir cactus significaba que
    tu planta no cambiaba nunca. Aquí es imposible sin que salte este test.
  */
  it("sus cinco etapas son dibujos DISTINTOS", () => {
    expect(new Set(etapas.map(firma)).size).toBe(5);
  });

  it("cada etapa pinta más que la anterior", () => {
    for (let i = 1; i < etapas.length; i++) {
      expect(pintados(etapas[i]), `etapa ${i}`).toBeGreaterThan(
        pintados(etapas[i - 1]),
      );
    }
  });

  /*
    Marchita se distingue por FORMA y no solo por color: si su silueta coincidiera
    con alguna etapa, quien no perciba bien el tono vería una planta sana.
  */
  it("marchita no coincide con ninguna etapa", () => {
    expect(etapas.map(firma)).not.toContain(firma(marchita));
  });
});

describe("spriteDe", () => {
  it("devuelve la etapa que se le pide", () => {
    expect(spriteDe("flower", 3, false)).toBe(SPRITES.flower.etapas[3]);
  });

  it("marchita gana a la etapa", () => {
    expect(spriteDe("flower", 4, true)).toBe(SPRITES.flower.marchita);
  });

  /*
    Una etapa fuera de rango no debe dejar la planta en blanco: se recorta a los
    extremos. Es defensa contra una racha corrupta, no un caso normal.
  */
  it("recorta una etapa fuera de rango en vez de no pintar nada", () => {
    expect(spriteDe("flower", 99, false)).toBe(SPRITES.flower.etapas[4]);
    expect(spriteDe("flower", -3, false)).toBe(SPRITES.flower.etapas[0]);
  });

  it("las cinco especies se dibujan distinto entre sí en su etapa madura", () => {
    const maduras = PLANT_SPECIES.map((s) => firma(spriteDe(s.key, 3, false)));
    expect(new Set(maduras).size).toBe(PLANT_SPECIES.length);
  });
});
