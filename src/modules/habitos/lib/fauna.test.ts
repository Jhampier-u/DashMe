import { describe, expect, it } from "vitest";
import { parseSprite } from "@/modules/core/ui/pixel/rejilla";
import { MARIPOSA } from "./sprites/fauna";
import {
  MAX_MARIPOSAS,
  MAX_MARIPOSAS_MEMORIA,
  SEMANAS_DE_MEMORIA,
  memoriaDeFauna,
  semanaDeFauna,
  faunaEn,
  fraseDeFauna,
  mariposasPara,
  mezclarFauna,
} from "./fauna";

/*
  La fauna es SOLO las tareas cerradas. Los pájaros por música se quitaron
  enteros: el módulo de música vive aparte y no se cruza con el resto.
*/
const D = (n: number) => new Date(Date.UTC(2026, 7, n));
const T = (n: number) => D(n).getTime();

describe("mariposasPara", () => {
  it("sin tareas cerradas no hay ninguna", () => {
    // Cero es cero: un día vacío no se rellena para que la escena no lo parezca.
    expect(mariposasPara(0)).toBe(0);
  });

  it("una por tarea", () => {
    expect(mariposasPara(3)).toBe(3);
  });

  it("se para en el tope aunque cierres veinte", () => {
    // Veinte mariposas taparían las plantas, que es lo que importa.
    expect(mariposasPara(20)).toBe(MAX_MARIPOSAS);
  });

  it("aguanta un número imposible", () => {
    expect(mariposasPara(-3)).toBe(0);
    expect(mariposasPara(Number.NaN)).toBe(0);
  });
});

describe("faunaEn", () => {
  const dias = [
    { dia: T(1), tareas: 2 },
    { dia: T(3), tareas: 9 },
  ];

  it("da la fauna del día que se le pide", () => {
    expect(faunaEn(dias, D(1))).toEqual({ mariposas: 2 });
    expect(faunaEn(dias, D(3))).toEqual({ mariposas: MAX_MARIPOSAS });
  });

  it("un día del que no se sabe nada no tiene fauna", () => {
    expect(faunaEn(dias, D(9))).toEqual({ mariposas: 0 });
    expect(faunaEn([], D(1))).toEqual({ mariposas: 0 });
  });
});

describe("fraseDeFauna", () => {
  it("cuenta las tareas, en singular y en plural", () => {
    expect(fraseDeFauna([{ dia: T(1), tareas: 1 }], D(1))).toBe(
      "1 tarea cerrada",
    );
    expect(fraseDeFauna([{ dia: T(1), tareas: 4 }], D(1))).toBe(
      "4 tareas cerradas",
    );
  });

  it("habla del REGISTRO, no de tu día", () => {
    // «Registradas» y no «hubo»: es lo único que el dashboard puede saber.
    expect(fraseDeFauna([], D(5))).toBe("Sin tareas cerradas registradas.");
  });
});

describe("mezclarFauna", () => {
  it("agrupa las tareas por día", () => {
    expect(mezclarFauna([T(1), T(1), T(3)])).toEqual([
      { dia: T(1), tareas: 2 },
      { dia: T(3), tareas: 1 },
    ]);
  });

  it("los devuelve en orden de día", () => {
    expect(mezclarFauna([T(5), T(1), T(3)]).map((x) => x.dia)).toEqual([
      T(1),
      T(3),
      T(5),
    ]);
  });

  it("sin tareas devuelve una lista vacía", () => {
    expect(mezclarFauna([])).toEqual([]);
  });
});

describe("el sprite de la mariposa", () => {
  it("se puede dibujar, y sin letras inventadas", () => {
    expect(() => parseSprite(MARIPOSA)).not.toThrow();
  });
});

describe("memoriaDeFauna", () => {
  // Lunes 3 de agosto de 2026. Las claves de día son medianoche UTC.
  const lunes = (n: number) => Date.UTC(2026, 7, 3 + n * 7);
  const dia = (semana: number, d: number) =>
    new Date(Date.UTC(2026, 7, 3 + semana * 7 + d));

  it("recuerda tres semanas, de la más vieja a la más reciente", () => {
    const dias = mezclarFauna([
      lunes(0), // hace 3 semanas: 1 tarea
      lunes(1), lunes(1), // hace 2 semanas: 2
      lunes(2), lunes(2), lunes(2), // hace 1 semana: 3
      lunes(3), // la semana en curso NO entra en la memoria
    ]);
    const m = memoriaDeFauna(dias, dia(3, 2));
    expect(m.map((s) => s.tareas)).toEqual([1, 2, 3]);
  });

  it("una semana sin nada se recuerda vacía, no se salta", () => {
    // Si se saltara, tres mariposas seguidas podrían ser semanas no
    // consecutivas y la memoria mentiría sobre el hueco.
    const dias = mezclarFauna([lunes(0), lunes(2)]);
    const m = memoriaDeFauna(dias, dia(3, 0));
    expect(m.map((s) => s.tareas)).toEqual([1, 0, 1]);
  });

  it("suma toda la semana, no solo el lunes", () => {
    const dias = mezclarFauna([lunes(2), lunes(2) + 3 * 86400000]);
    const m = memoriaDeFauna(dias, dia(3, 0));
    expect(m[2].tareas).toBe(2);
  });

  it("el pasado nunca pesa más que el presente", () => {
    const muchas = Array.from({ length: 40 }, () => lunes(2));
    const m = memoriaDeFauna(mezclarFauna(muchas), dia(3, 0));
    expect(m[2].mariposas).toBe(MAX_MARIPOSAS_MEMORIA);
    expect(MAX_MARIPOSAS_MEMORIA).toBeLessThan(MAX_MARIPOSAS);
  });

  it("es relativa al día que miras, no a hoy", () => {
    const dias = mezclarFauna([lunes(0), lunes(1), lunes(1)]);
    // Mirando la semana 2, la memoria son las semanas -1, 0 y 1.
    expect(memoriaDeFauna(dias, dia(2, 0)).map((s) => s.tareas)).toEqual([
      0, 1, 2,
    ]);
  });

  it("sin datos devuelve tres semanas vacías y no revienta", () => {
    const m = memoriaDeFauna([], dia(3, 0));
    expect(m).toHaveLength(SEMANAS_DE_MEMORIA);
    expect(m.every((s) => s.tareas === 0 && s.mariposas === 0)).toBe(true);
  });
});

describe("semanaDeFauna", () => {
  const lunes = (n: number) => Date.UTC(2026, 7, 3 + n * 7);
  const dia = (semana: number, d: number) =>
    new Date(Date.UTC(2026, 7, 3 + semana * 7 + d));

  it("suma la semana del día que miras, no el día", () => {
    const dias = mezclarFauna([lunes(3), lunes(3) + 2 * 86400000, lunes(2)]);
    // Miramos el jueves; la semana lleva 2 aunque ese jueves no tenga ninguna.
    expect(semanaDeFauna(dias, dia(3, 3)).tareas).toBe(2);
  });

  it("usa el techo grande, no el de la memoria", () => {
    const muchas = Array.from({ length: 40 }, () => lunes(3));
    expect(semanaDeFauna(mezclarFauna(muchas), dia(3, 0)).mariposas).toBe(
      MAX_MARIPOSAS,
    );
  });

  it("el lunes la semana en curso vuelve a cero", () => {
    // El reinicio semanal de UbiFit: una mala semana no arrastra.
    const dias = mezclarFauna([lunes(2), lunes(2), lunes(2)]);
    expect(semanaDeFauna(dias, dia(2, 6)).tareas).toBe(3);
    expect(semanaDeFauna(dias, dia(3, 0)).tareas).toBe(0);
  });
});
