import { describe, expect, it } from "vitest";
import { parseSprite } from "@/modules/core/ui/pixel/rejilla";
import { MARIPOSA } from "./sprites/fauna";
import {
  MAX_MARIPOSAS,
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
