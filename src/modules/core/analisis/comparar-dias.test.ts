import { describe, expect, it } from "vitest";
import { compararGrupos, mediana, MINIMO_POR_GRUPO } from "./comparar-dias";

/** Días como números sueltos: esta función no sabe qué es una fecha. */
const dias = (...ns: number[]) => new Set(ns);

function valores(m: Record<number, number>): Map<number, number> {
  return new Map(Object.entries(m).map(([k, v]) => [Number(k), v]));
}

/** n días seguidos desde `desde`, todos con el mismo valor. */
function serie(desde: number, n: number, valor: number) {
  const m: Record<number, number> = {};
  for (let i = 0; i < n; i++) m[desde + i] = valor;
  return m;
}

const rango = (desde: number, n: number) =>
  dias(...Array.from({ length: n }, (_, i) => desde + i));

describe("mediana", () => {
  it("con impares es el de en medio", () => {
    expect(mediana([3, 1, 2])).toBe(2);
  });

  it("con pares es la media de los dos centrales", () => {
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });

  it("sin nada es null", () => {
    expect(mediana([])).toBeNull();
  });

  /*
    Por esto es mediana y no media: un solo día raro —ocho horas de música de
    fondo trabajando— arrastra la media y fabrica una diferencia que no existe.
  */
  it("un valor extremo no la mueve", () => {
    expect(mediana([10, 10, 10, 10, 5000])).toBe(10);
  });
});

describe("compararGrupos se niega sin datos suficientes", () => {
  /*
    LA DECISIÓN CENTRAL DEL BLOQUE. Hoy hay un día de solapamiento; decir un
    porcentaje con eso sería inventar, y eso es peor que no tener panel.
  */
  it("con un día en cada grupo no compara", () => {
    const r = compararGrupos(valores({ 1: 30, 2: 40 }), dias(1), dias(2));
    expect(r.suficiente).toBe(false);
  });

  it("dice cuántos faltan en cada grupo", () => {
    const r = compararGrupos(
      valores({ ...serie(1, 3, 30), ...serie(100, 1, 40) }),
      rango(1, 3),
      rango(100, 1),
    );
    expect(r.suficiente).toBe(false);
    expect(r.faltanA).toBe(MINIMO_POR_GRUPO - 3);
    expect(r.faltanB).toBe(MINIMO_POR_GRUPO - 1);
  });

  it("con uno de los dos grupos completo tampoco basta", () => {
    const r = compararGrupos(
      valores({ ...serie(1, 20, 30), ...serie(100, 2, 40) }),
      rango(1, 20),
      rango(100, 2),
    );
    expect(r.suficiente).toBe(false);
    expect(r.faltanA).toBe(0);
    expect(r.faltanB).toBe(MINIMO_POR_GRUPO - 2);
  });

  it("justo en el mínimo ya compara", () => {
    const n = MINIMO_POR_GRUPO;
    const r = compararGrupos(
      valores({ ...serie(1, n, 30), ...serie(100, n, 50) }),
      rango(1, n),
      rango(100, n),
    );
    expect(r.suficiente).toBe(true);
  });
});

describe("compararGrupos con datos suficientes", () => {
  const n = MINIMO_POR_GRUPO;
  const gA = rango(1, n);
  const gB = rango(100, n);

  it("devuelve las dos medianas y los dos tamaños", () => {
    const r = compararGrupos(
      valores({ ...serie(1, n, 30), ...serie(100, n, 50) }),
      gA,
      gB,
    );
    expect(r.suficiente).toBe(true);
    expect(r.medianaA).toBe(30);
    expect(r.medianaB).toBe(50);
    expect(r.nA).toBe(n);
    expect(r.nB).toBe(n);
  });

  /*
    Un día del grupo sin valor cuenta como CERO y no se descarta: no haber
    escuchado nada es un dato, y descartarlo subiría la mediana del grupo que
    menos escucha.
  */
  it("un día sin valor cuenta como cero", () => {
    const r = compararGrupos(
      valores({ ...serie(1, n - 1, 30), ...serie(100, n, 50) }),
      gA,
      gB,
    );
    expect(r.nA).toBe(n);
    expect(r.medianaA).toBe(30);
  });

  /*
    Los días que no están en ninguno de los dos conjuntos se ignoran, incluso si
    tienen valor. Ahí van los días en pausa y los que no tocaba nada.
  */
  it("los días fuera de los dos grupos se ignoran", () => {
    const conRuido = valores({
      ...serie(1, n, 30),
      ...serie(100, n, 50),
      ...serie(500, 50, 9999),
    });
    const r = compararGrupos(conRuido, gA, gB);
    expect(r.medianaA).toBe(30);
    expect(r.medianaB).toBe(50);
    expect(r.nA + r.nB).toBe(n * 2);
  });

  it("el mismo conjunto en los dos lados no revienta ni cuenta el doble", () => {
    const solapado = rango(1, n);
    const r = compararGrupos(valores(serie(1, n, 30)), solapado, solapado);
    expect(r.nA).toBe(n);
    expect(r.nB).toBe(n);
  });
});
