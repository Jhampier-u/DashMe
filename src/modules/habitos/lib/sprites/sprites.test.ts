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

/*
  LAS TRES DUDAS DE LOS SPRITES, CONVERTIDAS EN GUARDAS.

  Eran tres pegas de aspecto —«el hongo no tiene verde», «las marchitas se
  parecen», «la hierba no se ve»— y una pega de aspecto no se puede discutir a
  ojo dos veces seguidas sin acabar donde empezaste. Medidas, se arreglan una
  vez y ya no vuelven.
*/
describe("lo que no puede volver a torcerse", () => {
  const celdas = (s: string) => {
    const m: Record<string, number> = {};
    for (const f of parseSprite(s).celdas)
      for (const c of f) if (c) m[c] = (m[c] ?? 0) + 1;
    return m;
  };
  const verde = (s: string) => {
    const c = celdas(s);
    return (c.g ?? 0) + (c.t ?? 0);
  };
  const sinSuelo = (s: string) => {
    const c = celdas(s);
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    return total - (c.m ?? 0) - (c.M ?? 0);
  };
  const distancia = (a: string, b: string) => {
    const A = parseSprite(a).celdas;
    const B = parseSprite(b).celdas;
    let d = 0;
    for (let y = 0; y < Math.max(A.length, B.length); y++)
      for (let x = 0; x < 16; x++)
        if ((A[y]?.[x] ?? null) !== (B[y]?.[x] ?? null)) d++;
    return d;
  };

  it("ninguna especie se queda sin nada de verde", () => {
    // El hongo tenía CERO en las cinco etapas. Ahora lleva musgo al pie: sigue
    // siendo el único sin verde en el cuerpo —que es lo que lo distingue de
    // lejos— pero ya no es lo único del jardín ajeno al verde.
    // Desde la etapa 1: la 0 es la semilla y ahí no ha brotado nada en
    // ninguna especie, que es justo lo que debe pasar.
    for (const [especie, s] of Object.entries(SPRITES)) {
      expect(verde(s.etapas[0]), `${especie} semilla`).toBe(0);
      for (let i = 1; i < s.etapas.length; i++) {
        expect(verde(s.etapas[i]), `${especie} etapa ${i}`).toBeGreaterThan(0);
      }
    }
  });

  it("dos marchitas nunca se confunden", () => {
    /*
      Hierba, cactus y hongo marchitos eran el MISMO garabato coral en diagonal:
      hierba contra hongo difería en 14 celdas de 256, y casi todo lo que
      compartían era el suelo. Marchitarse cambia la postura y el color, no la
      identidad, así que cada una conserva ahora su silueta.
    */
    const especies = Object.keys(SPRITES) as (keyof typeof SPRITES)[];
    for (let i = 0; i < especies.length; i++) {
      for (let j = i + 1; j < especies.length; j++) {
        const d = distancia(
          SPRITES[especies[i]].marchita,
          SPRITES[especies[j]].marchita,
        );
        expect(d, `${especies[i]} contra ${especies[j]}`).toBeGreaterThanOrEqual(
          25,
        );
      }
    }
  });

  it("ninguna etapa 1 desaparece a tamaño pequeño", () => {
    // La hierba eran tres briznas de UN píxel de ancho: 6 celdas. Y el hongo,
    // 4 — peor que la hierba, aunque la duda solo nombrara a la hierba.
    for (const especie of Object.keys(SPRITES) as (keyof typeof SPRITES)[]) {
      expect(sinSuelo(spriteDe(especie, 1, false)), especie).toBeGreaterThanOrEqual(10);
    }
  });

  it("cada etapa dibuja más que la anterior", () => {
    // El crecimiento tiene que verse. Si una etapa encoge, la planta parece
    // marchitarse justo cuando avanza.
    for (const [especie, s] of Object.entries(SPRITES)) {
      for (let i = 1; i < s.etapas.length; i++) {
        expect(
          sinSuelo(s.etapas[i]),
          `${especie}: etapa ${i} contra ${i - 1}`,
        ).toBeGreaterThanOrEqual(sinSuelo(s.etapas[i - 1]));
      }
    }
  });
});
