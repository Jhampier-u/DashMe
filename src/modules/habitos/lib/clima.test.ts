import { describe, expect, it } from "vitest";
import { climaDe, NUBES, type Clima } from "./clima";

const estado = (cumplidos: number, fallados: number): Clima =>
  climaDe(cumplidos, fallados).estado;

describe("climaDe", () => {
  it("con 6 de 7 está despejado", () => {
    expect(estado(6, 1)).toBe("despejado");
  });

  it("con 7 de 7 también", () => {
    expect(estado(7, 0)).toBe("despejado");
  });

  it("con 3 de 7 está algo nublado", () => {
    expect(estado(3, 4)).toBe("nublado");
  });

  it("con 2 de 7 llueve", () => {
    expect(estado(2, 5)).toBe("lluvia");
  });

  it("con 0 de 7 llueve", () => {
    expect(estado(0, 7)).toBe("lluvia");
  });

  /*
    EL CASO QUE IMPORTA. Sin días evaluables no se inventa un tiempo: es la misma
    regla que en el panel de música, antes callar que inventar.
  */
  it("sin días evaluables no hay dato", () => {
    expect(estado(0, 0)).toBe("sin-dato");
  });

  /*
    Una semana entera de vacaciones llega aquí como cero y cero, porque
    `getDiasCumplidos` deja fuera los días en pausa. No debe traer lluvia.
  */
  it("una semana en pausa no da lluvia", () => {
    const r = climaDe(0, 0);
    expect(r.estado).toBe("sin-dato");
    expect(r.nubes).toBe(NUBES["sin-dato"]);
  });

  it("los umbrales caen del lado de no castigar", () => {
    // 80% justo: 4 de 5.
    expect(estado(4, 1)).toBe("despejado");
    // 40% justo: 2 de 5.
    expect(estado(2, 3)).toBe("nublado");
    // Por debajo del 40%.
    expect(estado(1, 4)).toBe("lluvia");
  });

  it("trae el recuento para poder explicarlo", () => {
    const r = climaDe(5, 2);
    expect(r.cumplidos).toBe(5);
    expect(r.evaluables).toBe(7);
  });

  /*
    El número de nubes es la segunda señal: cantidad además de forma, para que el
    estado no dependa de distinguir un emoji pequeño.
  */
  it("cada estado tiene su número de nubes, y son distintos", () => {
    const n = [
      NUBES.despejado,
      NUBES.nublado,
      NUBES.lluvia,
      NUBES["sin-dato"],
    ];
    expect(new Set(n).size).toBe(4);
  });

  it("no revienta con números negativos", () => {
    expect(estado(-1, -1)).toBe("sin-dato");
  });
});
