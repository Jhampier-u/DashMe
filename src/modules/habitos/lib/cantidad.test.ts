import { describe, expect, it } from "vitest";
import { diasQueCuentan, esCompleto, type LogParaRacha } from "./cantidad";

/** Múltiplos de un día en epoch: `normalizeDayKey` trabaja en UTC y los deja igual. */
const DIA = 86_400_000;
const d = (n: number) => new Date(n * DIA);

function log(n: number, extra: Partial<LogParaRacha> = {}): LogParaRacha {
  return { date: d(n), partial: false, count: null, ...extra };
}

describe("esCompleto", () => {
  it("sin objetivo, lo manda el botón", () => {
    expect(esCompleto(null, null, false)).toBe(true);
    expect(esCompleto(null, null, true)).toBe(false);
  });

  it("con objetivo, lo manda la cantidad", () => {
    expect(esCompleto(8, 8, false)).toBe(true);
    expect(esCompleto(8, 9, false)).toBe(true);
    expect(esCompleto(8, 7, false)).toBe(false);
    expect(esCompleto(8, 0, false)).toBe(false);
  });

  /*
    Con objetivo, la cantidad manda SOBRE el botón: si no, apuntar 3 de 8 y
    pulsar «hecho» daría un día completo con tres vasos.
  */
  it("con objetivo, el botón no puede saltarse la cantidad", () => {
    expect(esCompleto(8, 3, false)).toBe(false);
  });

  it("con objetivo pero sin cantidad apuntada, vale el botón", () => {
    expect(esCompleto(8, null, false)).toBe(true);
    expect(esCompleto(8, null, true)).toBe(false);
  });
});

describe("diasQueCuentan sin objetivo", () => {
  /*
    Esta es la garantía de que ningún hábito existente cambia: sin objetivo,
    TODO registro cuenta, igual que hoy, incluidos los de modo mínimo.
  */
  it("cuenta todos los registros, también los de modo mínimo", () => {
    const set = diasQueCuentan([log(1), log(2, { partial: true })], null);
    expect(set.size).toBe(2);
    expect(set.has(d(2).getTime())).toBe(true);
  });
});

describe("diasQueCuentan con objetivo", () => {
  it("cuenta el día que llega al objetivo", () => {
    const set = diasQueCuentan([log(1, { count: 8 })], 8);
    expect(set.has(d(1).getTime())).toBe(true);
  });

  it("no cuenta el día que se queda corto", () => {
    const set = diasQueCuentan([log(1, { count: 7, partial: true })], 8);
    expect(set.size).toBe(0);
  });

  it("pasarse del objetivo también cuenta", () => {
    expect(diasQueCuentan([log(1, { count: 12 })], 8).size).toBe(1);
  });

  /*
    Los registros de antes de este bloque tienen `count` nulo: nunca se apuntó
    una cantidad. Se interpretan por su `partial`, que es la única información
    que hay. Inventarles una cantidad sería peor.
  */
  it("los registros viejos se leen por su partial", () => {
    const set = diasQueCuentan([log(1), log(2, { partial: true })], 8);
    expect(set.has(d(1).getTime())).toBe(true);
    expect(set.has(d(2).getTime())).toBe(false);
  });

  it("normaliza al día, así que dos horas del mismo día son un día", () => {
    const set = diasQueCuentan(
      [
        {
          date: new Date(d(5).getTime() + 3_600_000),
          partial: false,
          count: 8,
        },
      ],
      8,
    );
    expect(set.size).toBe(1);
    expect(set.has(d(5).getTime())).toBe(true);
  });

  it("con la lista vacía devuelve un conjunto vacío", () => {
    expect(diasQueCuentan([], 8).size).toBe(0);
  });
});
