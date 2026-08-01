import { describe, expect, it } from "vitest";
import { cal } from "./calendario";
import {
  jardinEn,
  primerDiaConDatos,
  rachaEn,
  semanaEn,
  type HabitoHistorico,
} from "./historia";

/** Julio de 2026 en claves de día UTC. El 1 fue miércoles. */
const D = (n: number) => new Date(Date.UTC(2026, 6, n));
const T = (n: number) => D(n).getTime();

function habito(over: Partial<HabitoHistorico> = {}): HabitoHistorico {
  return {
    id: "h1",
    name: "Leer",
    color: "aqua",
    plantSpecies: "flower",
    isAnchor: false,
    schedule: "1111111",
    creado: D(1),
    pausas: [],
    cumplidos: [],
    plenos: [],
    ...over,
  };
}

const TODOS_LOS_DIAS = cal("1111111", []);

describe("rachaEn", () => {
  it("cuenta los días seguidos cumplidos hasta ese día", () => {
    const hechos = new Set([T(8), T(9), T(10)]);
    expect(rachaEn(TODOS_LOS_DIAS, hechos, D(10), D(20))).toBe(3);
  });

  it("un día pasado y fallado deja la racha a cero, sin la gracia de hoy", () => {
    /*
      ESTA ES LA DECISIÓN DEL BLOQUE. `computeStreak` perdona el día en curso
      porque tienes hasta medianoche, y eso es correcto para hoy. Para el 10 de
      julio visto desde el 20 no lo es: ese día ya se cerró fallado, y pintar
      una racha de 2 sería contar una versión favorable del pasado.
    */
    const hechos = new Set([T(8), T(9)]);
    expect(rachaEn(TODOS_LOS_DIAS, hechos, D(10), D(20))).toBe(0);
  });

  it("y en cambio HOY sí se perdona: aún queda día por delante", () => {
    const hechos = new Set([T(8), T(9)]);
    expect(rachaEn(TODOS_LOS_DIAS, hechos, D(10), D(10))).toBe(2);
  });

  it("un día no programado no rompe nada al pasar por encima", () => {
    // Domingo a sábado. Sin domingos: el 5 y el 12 de julio de 2026.
    const entreSemana = cal("0111111", []);
    const hechos = new Set([T(3), T(4), T(6)]);
    expect(rachaEn(entreSemana, hechos, D(6), D(20))).toBe(3);
  });

  it("un día en pausa tampoco", () => {
    const conPausa = cal("1111111", [{ desde: D(5), hasta: D(5) }]);
    const hechos = new Set([T(3), T(4), T(6)]);
    expect(rachaEn(conPausa, hechos, D(6), D(20))).toBe(3);
  });
});

describe("jardinEn", () => {
  it("no enseña un hábito que todavía no existía", () => {
    // Criterio 1: un hábito creado el 10 no sale al mirar el 5.
    const h = habito({ creado: D(10), cumplidos: [T(10), T(11)] });
    expect(jardinEn([h], D(5), D(20))).toHaveLength(0);
    expect(jardinEn([h], D(10), D(20))).toHaveLength(1);
  });

  it("no deja que el pasado sepa el futuro", () => {
    /*
      Lo cumplido DESPUÉS del día que se mira no cuenta. Si colara, el 10 de
      julio se pintaría con una racha que no se ganó hasta el 15.
    */
    const h = habito({ cumplidos: [T(9), T(10), T(11), T(12)] });
    expect(jardinEn([h], D(10), D(20))[0].streak).toBe(2);
  });

  it("marchita la planta de un día programado y fallado", () => {
    // Criterio 2.
    const h = habito({ cumplidos: [T(8), T(9)] });
    const p = jardinEn([h], D(10), D(20))[0];
    expect(p.streak).toBe(0);
    expect(p.marchita).toBe(true);
    expect(p.stage).toBe(0);
  });

  it("no marchita lo que nunca llegó a brotar", () => {
    // Sin un solo cumplido no es una planta marchita: es una semilla. Es la
    // misma distinción que hace `isPlantWilted` en el presente.
    const h = habito({ cumplidos: [] });
    const p = jardinEn([h], D(10), D(20))[0];
    expect(p.marchita).toBe(false);
    expect(p.stage).toBe(0);
  });

  it("dice si ese día tocaba y si se cumplió", () => {
    const h = habito({ schedule: "0111111", cumplidos: [T(6)] });
    const lunes = jardinEn([h], D(6), D(20))[0];
    expect(lunes).toMatchObject({
      cumplidoEseDia: true,
      programadoEseDia: true,
    });
    const domingo = jardinEn([h], D(5), D(20))[0];
    expect(domingo.programadoEseDia).toBe(false);
  });

  it("un día en pausa no cuenta como programado", () => {
    const h = habito({ pausas: [{ desde: D(9), hasta: D(11) }] });
    expect(jardinEn([h], D(10), D(20))[0].programadoEseDia).toBe(false);
  });

  it("el día de hoy se reconstruye igual que lo pinta el jardín normal", () => {
    // Criterio 3: si la memoria y el presente discreparan en el mismo día, uno
    // de los dos estaría mintiendo y no habría forma de saber cuál.
    const cumplidos = [T(17), T(18), T(19), T(20)];
    const h = habito({ cumplidos });
    const p = jardinEn([h], D(20), D(20))[0];
    expect(p.streak).toBe(4);
    expect(p.cumplidoEseDia).toBe(true);
    expect(p.marchita).toBe(false);
  });

  it("conserva la identidad de la planta: especie, color y ancla", () => {
    const h = habito({ plantSpecies: "cactus", color: "pink", isAnchor: true });
    expect(jardinEn([h], D(10), D(20))[0]).toMatchObject({
      plantSpecies: "cactus",
      color: "pink",
      isAnchor: true,
      name: "Leer",
    });
  });

  it("reconstruye varios hábitos a la vez, cada uno con su calendario", () => {
    const a = habito({
      id: "a",
      schedule: "1111111",
      cumplidos: [T(9), T(10)],
    });
    const b = habito({ id: "b", schedule: "0111111", cumplidos: [T(10)] });
    const jardin = jardinEn([a, b], D(10), D(20));
    expect(jardin.map((p) => [p.id, p.streak])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
  });
});

describe("primerDiaConDatos", () => {
  it("devuelve el registro más antiguo de todos los hábitos", () => {
    const a = habito({ id: "a", cumplidos: [T(10), T(11)] });
    const b = habito({ id: "b", cumplidos: [T(4), T(20)] });
    expect(primerDiaConDatos([a, b])).toEqual(D(4));
  });

  it("es nulo sin ningún registro", () => {
    // Criterio 7: sin memoria, la barra de tiempo no se pinta.
    expect(primerDiaConDatos([habito()])).toBeNull();
    expect(primerDiaConDatos([])).toBeNull();
  });
});

describe("semanaEn", () => {
  it("cuenta un día como cumplido solo si TODOS los vigentes lo cumplieron", () => {
    const a = habito({ id: "a", plenos: [T(10)] });
    const b = habito({ id: "b", plenos: [] });
    // Del 4 al 10: siete días programados para los dos, y solo `a` cumplió uno.
    expect(semanaEn([a, b], D(10))).toEqual({ cumplidos: 0, fallados: 7 });
  });

  it("con uno solo, sus días cumplidos salen como cumplidos", () => {
    const a = habito({ id: "a", plenos: [T(8), T(9), T(10)] });
    expect(semanaEn([a], D(10))).toEqual({ cumplidos: 3, fallados: 4 });
  });

  it("una semana entera en pausa llega como cero y cero", () => {
    /*
      Es la garantía que ya daba `getDiasCumplidos` y que este bloque no puede
      perder: unas vacaciones no son una semana de fallos, y el clima no debe
      convertirlas en lluvia.
    */
    const a = habito({ id: "a", pausas: [{ desde: D(4), hasta: D(10) }] });
    expect(semanaEn([a], D(10))).toEqual({ cumplidos: 0, fallados: 0 });
  });

  it("los días anteriores a crear el hábito no cuentan", () => {
    const a = habito({ id: "a", creado: D(9), plenos: [T(9), T(10)] });
    expect(semanaEn([a], D(10))).toEqual({ cumplidos: 2, fallados: 0 });
  });

  it("sin hábitos no hay semana que juzgar", () => {
    expect(semanaEn([], D(10))).toEqual({ cumplidos: 0, fallados: 0 });
  });
});
