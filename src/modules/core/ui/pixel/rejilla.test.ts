import { describe, expect, it } from "vitest";
import { PALETA_PIXEL, parseSprite, rectsDe } from "./rejilla";

describe("parseSprite", () => {
  it("lee una rejilla y devuelve sus dimensiones", () => {
    const s = parseSprite(`
      . . .
      . g .
      . . .
    `);
    expect(s.ancho).toBe(3);
    expect(s.alto).toBe(3);
  });

  it("el punto es transparente y no genera nada", () => {
    const s = parseSprite(`
      . .
      . .
    `);
    expect(rectsDe(s)).toEqual([]);
  });

  /*
    Los espacios entre celdas son para que la rejilla se lea; no significan nada.
    Sin esto, un sprite legible y uno apretado darían dibujos distintos.
  */
  it("da igual escribirla apretada o con espacios", () => {
    const conEspacios = parseSprite(`
      . g .
      g g g
    `);
    const apretada = parseSprite(`
      .g.
      ggg
    `);
    expect(rectsDe(conEspacios)).toEqual(rectsDe(apretada));
  });

  it("las líneas vacías del principio y del final no cuentan", () => {
    const s = parseSprite(`

      . g .

    `);
    expect(s.alto).toBe(1);
  });

  /*
    Una fila más corta que las demás sería un sprite torcido, y es el error más
    fácil de cometer editando a mano: se detecta al cargar, no al mirar.
  */
  it("rechaza una rejilla con filas de distinto ancho", () => {
    expect(() =>
      parseSprite(`
        . g .
        . g
      `),
    ).toThrow(/ancho/i);
  });

  it("rechaza una letra que no está en la paleta", () => {
    expect(() => parseSprite(". ? .")).toThrow(/\?/);
  });
});

describe("rectsDe", () => {
  it("un píxel suelto es un rectángulo de una celda", () => {
    const r = rectsDe(parseSprite(". g ."));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ x: 1, y: 0, ancho: 1, color: PALETA_PIXEL.g });
  });

  /*
    Los píxeles seguidos del mismo color se funden en UN rectángulo. Con
    veinticinco sprites de 16x16, esto es la diferencia entre cientos de nodos y
    unas decenas — y el jardín pinta varias plantas a la vez.
  */
  it("funde los píxeles seguidos del mismo color", () => {
    const r = rectsDe(parseSprite("g g g"));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ x: 0, ancho: 3 });
  });

  it("no funde colores distintos", () => {
    const r = rectsDe(parseSprite("g t g"));
    expect(r).toHaveLength(3);
  });

  it("no funde a través de un hueco", () => {
    const r = rectsDe(parseSprite("g . g"));
    expect(r).toHaveLength(2);
    expect(r[1].x).toBe(2);
  });

  it("no funde entre filas distintas", () => {
    const r = rectsDe(
      parseSprite(`
        g
        g
      `),
    );
    expect(r).toHaveLength(2);
    expect(r[0].y).toBe(0);
    expect(r[1].y).toBe(1);
  });
});

describe("la paleta", () => {
  /*
    Los sprites NO inventan colores: salen de los tokens que ya existen. Si algún
    día cambia la paleta del dashboard, cambian los dibujos.
  */
  it("todos sus valores son variables CSS del sistema", () => {
    for (const [letra, color] of Object.entries(PALETA_PIXEL)) {
      expect(color, letra).toMatch(/^var\(--/);
    }
  });

  it("cada letra tiene su versión oscura en mayúscula", () => {
    for (const letra of Object.keys(PALETA_PIXEL)) {
      if (letra === letra.toUpperCase()) continue;
      expect(PALETA_PIXEL, letra).toHaveProperty(letra.toUpperCase());
    }
  });
});
