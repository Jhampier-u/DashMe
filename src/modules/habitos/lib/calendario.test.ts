import { describe, expect, it } from "vitest";
import {
  cal,
  corregirRango,
  enPausa,
  estaProgramado,
  type Rango,
} from "./calendario";

const DIA = 86_400_000;
/** El 0 es jueves 1970-01-01; el 4, lunes. */
const d = (n: number) => new Date(n * DIA);

const TODOS = "1111111";
const LUNES = "0100000";
const rango = (a: number, b: number): Rango => ({ desde: d(a), hasta: d(b) });

describe("enPausa", () => {
  it("sin pausas, nunca", () => {
    expect(enPausa([], d(5))).toBe(false);
  });

  /*
    Los dos extremos ENTRAN. «Del 1 al 15» incluye el 1 y el 15: es como lo dice
    cualquiera, y dejar fuera un extremo es el clásico error de un día que nadie
    nota hasta que le rompe una racha.
  */
  it("los dos extremos entran", () => {
    const p = [rango(10, 12)];
    expect(enPausa(p, d(10))).toBe(true);
    expect(enPausa(p, d(11))).toBe(true);
    expect(enPausa(p, d(12))).toBe(true);
  });

  it("fuera del rango, no", () => {
    const p = [rango(10, 12)];
    expect(enPausa(p, d(9))).toBe(false);
    expect(enPausa(p, d(13))).toBe(false);
  });

  it("con varios rangos vale estar en cualquiera", () => {
    const p = [rango(1, 2), rango(10, 12)];
    expect(enPausa(p, d(11))).toBe(true);
    expect(enPausa(p, d(5))).toBe(false);
  });

  /*
    Solapar es inofensivo —la pregunta es si está en ALGUNA— y por eso no se
    prohíbe: validar contra todas las demás en cada guardado sería trabajo para
    evitar un problema que no existe.
  */
  it("los rangos solapados no molestan", () => {
    const p = [rango(10, 15), rango(12, 20)];
    expect(enPausa(p, d(13))).toBe(true);
    expect(enPausa(p, d(18))).toBe(true);
    expect(enPausa(p, d(21))).toBe(false);
  });

  it("un rango de un solo día funciona", () => {
    expect(enPausa([rango(7, 7)], d(7))).toBe(true);
    expect(enPausa([rango(7, 7)], d(8))).toBe(false);
  });

  it("normaliza al día: una hora dentro del rango cuenta", () => {
    expect(
      enPausa([rango(10, 10)], new Date(d(10).getTime() + 3_600_000)),
    ).toBe(true);
  });
});

describe("estaProgramado", () => {
  /*
    LA GARANTÍA DE QUE NADA CAMBIA para quien no use pausas: sin pausas,
    `estaProgramado` es exactamente `isScheduledOn`.
  */
  it("sin pausas es el calendario de siempre", () => {
    expect(estaProgramado(cal(TODOS), d(5))).toBe(true);
    // El 5 es viernes, no lunes.
    expect(estaProgramado(cal(LUNES), d(5))).toBe(false);
    // El 4 es lunes.
    expect(estaProgramado(cal(LUNES), d(4))).toBe(true);
  });

  it("un día en pausa no está programado aunque toque", () => {
    expect(estaProgramado(cal(TODOS, [rango(5, 6)]), d(5))).toBe(false);
  });

  it("fuera de la pausa vuelve a estar programado", () => {
    expect(estaProgramado(cal(TODOS, [rango(5, 6)]), d(7))).toBe(true);
  });

  it("una pausa sobre un día que ya no tocaba no cambia nada", () => {
    expect(estaProgramado(cal(LUNES, [rango(5, 5)]), d(5))).toBe(false);
  });
});

describe("corregirRango", () => {
  /*
    Un rango al revés es un error de dedo, no una intención: se intercambia en
    vez de rechazarse. Rechazarlo obligaría al usuario a adivinar qué escribió
    mal cuando el problema es evidente.
  */
  it("intercambia si viene al revés", () => {
    const r = corregirRango(d(12), d(10));
    expect(r.desde.getTime()).toBe(d(10).getTime());
    expect(r.hasta.getTime()).toBe(d(12).getTime());
  });

  it("deja en paz uno correcto", () => {
    const r = corregirRango(d(10), d(12));
    expect(r.desde.getTime()).toBe(d(10).getTime());
  });

  it("normaliza los dos extremos al día", () => {
    const r = corregirRango(
      new Date(d(10).getTime() + 3_600_000),
      new Date(d(12).getTime() + 7_200_000),
    );
    expect(r.desde.getTime()).toBe(d(10).getTime());
    expect(r.hasta.getTime()).toBe(d(12).getTime());
  });
});
