import { describe, expect, it } from "vitest";
import {
  ALTO_MINIMO,
  HORIZONTE,
  cabenBajoElHorizonte,
  disposicionDelJardin,
  pieDeLasPlantas,
} from "./disposicion";

describe("disposicionDelJardin", () => {
  it("mete tres plantas en UNA fila", () => {
    /*
      El caso que reventaba. Con columnas = raíz cuadrada, tres plantas daban
      dos columnas y por tanto dos filas, que no cabían bajo el horizonte. Tres
      caben de sobra en una fila.
    */
    const d = disposicionDelJardin(3);
    expect(d.columnas).toBe(3);
    expect(d.filas).toBe(1);
    expect(d.minAlto).toBe(ALTO_MINIMO);
  });

  it("nunca baja de dos columnas ni sube de cuatro", () => {
    expect(disposicionDelJardin(1).columnas).toBe(2);
    expect(disposicionDelJardin(2).columnas).toBe(2);
    expect(disposicionDelJardin(9).columnas).toBe(4);
    expect(disposicionDelJardin(50).columnas).toBe(4);
  });

  it("la escena crece cuando hacen falta más filas", () => {
    const una = disposicionDelJardin(4);
    const dos = disposicionDelJardin(8);
    expect(una.filas).toBe(1);
    expect(dos.filas).toBe(2);
    expect(dos.minAlto).toBeGreaterThan(una.minAlto);
  });

  it("un jardín vacío no pide altura de más", () => {
    const d = disposicionDelJardin(0);
    expect(d.filas).toBe(0);
    expect(d.minAlto).toBe(ALTO_MINIMO);
  });

  it("aguanta un número imposible", () => {
    expect(disposicionDelJardin(-3).filas).toBe(0);
    expect(disposicionDelJardin(2.7).columnas).toBe(2);
  });
});

describe("cabenBajoElHorizonte", () => {
  it("se cumple para cualquier número de plantas con su altura calculada", () => {
    /*
      LA GARANTÍA DEL MÓDULO. Cuando no se cumplía, el sobrante NO se recortaba:
      `alignContent: end` lo empuja hacia arriba y las plantas salían plantadas
      en el cielo. Este bucle es la afirmación que antes hacía falta un ojo
      humano para comprobar.
    */
    for (let n = 0; n <= 40; n += 1) {
      const { minAlto } = disposicionDelJardin(n);
      expect(cabenBajoElHorizonte(n, minAlto)).toBe(true);
    }
  });

  it("detecta el caso real que se vio en pantalla", () => {
    // Tres plantas en una escena de 480 px, repartidas en DOS filas como hacía
    // el cálculo viejo: no caben. Con la disposición nueva son una fila y sí.
    const dosFilas = 62 * 4.8 + 2 * 148 + 12 + 20;
    expect(dosFilas).toBeGreaterThan(480);
    expect(cabenBajoElHorizonte(3, 480)).toBe(true);
  });

  it("las plantas empiezan en el horizonte, nunca por encima", () => {
    const alto = disposicionDelJardin(6).minAlto;
    expect(pieDeLasPlantas(6, alto)).toBeGreaterThan((alto * HORIZONTE) / 100);
  });
});
