import { describe, expect, it } from "vitest";
import {
  PRIORIDADES,
  PRIORIDAD_DEFS,
  prioridadColorVar,
  resolvePrioridad,
} from "./prioridad";
import { PALETA_CATEGORICA } from "@/modules/core/ui/paleta";

describe("PRIORIDAD_DEFS", () => {
  it("son cuatro", () => {
    expect(PRIORIDADES).toHaveLength(4);
  });

  it("sus colores salen de la paleta compartida", () => {
    for (const p of PRIORIDADES) {
      expect(PALETA_CATEGORICA).toHaveProperty(PRIORIDAD_DEFS[p].color);
    }
  });

  it("no repiten color", () => {
    const colores = PRIORIDADES.map((p) => PRIORIDAD_DEFS[p].color);
    expect(new Set(colores).size).toBe(4);
  });

  /*
    El tamaño es la SEGUNDA señal, la que funciona para quien no distingue
    lavanda de coral —que son justamente Urgente y Alto—. Si algún día los
    cuatro puntos midieran lo mismo, la prioridad pasaría a ser solo color y
    rompería la regla que sostiene el sistema visual entero.
  */
  it("el punto crece con la prioridad, estrictamente", () => {
    const tam = PRIORIDADES.map((p) => PRIORIDAD_DEFS[p].punto);
    expect(tam).toEqual([...tam].sort((a, b) => b - a));
    expect(new Set(tam).size).toBe(4);
  });

  it("los tamaños caen en la rejilla de 3px del sistema pixel", () => {
    for (const p of PRIORIDADES) {
      expect(PRIORIDAD_DEFS[p].punto % 3).toBe(0);
    }
  });

  it("el mayor dobla al menor, para que la diferencia se vea", () => {
    const tam = PRIORIDADES.map((p) => PRIORIDAD_DEFS[p].punto);
    expect(Math.max(...tam) / Math.min(...tam)).toBeGreaterThanOrEqual(2);
  });
});

describe("resolvePrioridad", () => {
  it("deja pasar las cuatro válidas", () => {
    for (const p of PRIORIDADES) expect(resolvePrioridad(p)).toBe(p);
  });

  it("una tarea sin prioridad no tiene prioridad", () => {
    expect(resolvePrioridad(null)).toBeNull();
  });

  /*
    Cae a null y no a MEDIUM: un valor corrupto no debe inventarse una urgencia
    que el usuario nunca puso.
  */
  it("cualquier otra cosa es no tener prioridad", () => {
    expect(resolvePrioridad("")).toBeNull();
    expect(resolvePrioridad("urgent")).toBeNull();
    expect(resolvePrioridad("CRITICAL")).toBeNull();
  });
});

describe("prioridadColorVar", () => {
  it("devuelve la referencia al token de la paleta", () => {
    expect(prioridadColorVar("URGENT")).toBe("var(--c-lav)");
    expect(prioridadColorVar("LOW")).toBe("var(--c-mint)");
  });
});
