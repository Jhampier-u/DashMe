import { describe, expect, it } from "vitest";
import { rachaGlobal, type EspecieDia } from "./racha-global";

const DIA = 86_400_000;
/** Días absolutos desde epoch. El 0 es jueves; el 4, lunes. */
const d = (n: number) => new Date(n * DIA);

const TODOS = "1111111";
/** Solo lunes: el calendario es dom→sáb, así que el 1 es el lunes. */
const LUNES = "0100000";

function spec(id: string, schedule = TODOS, desde = 0): EspecieDia {
  return { id, schedule, since: d(desde) };
}

/** Día absoluto -> ids cumplidos DEL TODO ese día. */
function hechos(m: Record<number, string[]>): Map<number, Set<string>> {
  return new Map(
    Object.entries(m).map(([n, ids]) => [d(Number(n)).getTime(), new Set(ids)]),
  );
}

describe("rachaGlobal", () => {
  it("sin hábitos es cero", () => {
    expect(rachaGlobal([], hechos({}), d(10))).toBe(0);
  });

  it("cuenta los días seguidos con todo hecho", () => {
    const r = rachaGlobal(
      [spec("a"), spec("b")],
      hechos({ 10: ["a", "b"], 9: ["a", "b"], 8: ["a", "b"] }),
      d(10),
    );
    expect(r).toBe(3);
  });

  it("un día al que le falta un hábito corta", () => {
    const r = rachaGlobal(
      [spec("a"), spec("b")],
      hechos({ 10: ["a", "b"], 9: ["a"], 8: ["a", "b"] }),
      d(10),
    );
    expect(r).toBe(1);
  });

  /*
    Hoy sin cumplir no rompe la racha de ayer: aún queda día. Es la misma regla
    que `computeStreak` aplica a un hábito, y tenerla distinta aquí sería una
    sorpresa.
  */
  it("hoy a medio hacer no borra lo de ayer", () => {
    const r = rachaGlobal([spec("a")], hechos({ 9: ["a"], 8: ["a"] }), d(10));
    expect(r).toBe(2);
  });

  /*
    Los días sin nada programado se saltan: no suman y no rompen. Otra vez, lo
    mismo que hace la racha de un hábito con su calendario.
  */
  it("los días sin nada programado se saltan", () => {
    // Solo lunes: el 4 y el 11 son lunes; del 5 al 10 no toca nada.
    const r = rachaGlobal(
      [spec("a", LUNES)],
      hechos({ 11: ["a"], 4: ["a"] }),
      d(11),
    );
    expect(r).toBe(2);
  });

  /*
    EL CASO QUE HARÍA INÚTIL LA CIFRA. Sin respetar `since`, un hábito creado
    ayer haría que todos los días anteriores contaran como incumplidos y la
    racha global sería cero para siempre.
  */
  it("un hábito no cuenta antes de existir", () => {
    const r = rachaGlobal(
      [spec("viejo", TODOS, 0), spec("nuevo", TODOS, 10)],
      hechos({ 10: ["viejo", "nuevo"], 9: ["viejo"], 8: ["viejo"] }),
      d(10),
    );
    expect(r).toBe(3);
  });

  it("un día con hábitos vigentes pero ninguno cumplido corta", () => {
    const r = rachaGlobal([spec("a")], hechos({ 10: ["a"], 8: ["a"] }), d(10));
    expect(r).toBe(1);
  });

  it("no mira más atrás del tope", () => {
    const todos: Record<number, string[]> = {};
    for (let i = 0; i <= 500; i++) todos[i] = ["a"];
    const r = rachaGlobal([spec("a")], hechos(todos), d(500), 30);
    expect(r).toBe(30);
  });
});
