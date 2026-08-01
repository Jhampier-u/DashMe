import { describe, expect, it } from "vitest";
import { asignarHuecos, intercambiar } from "./huecos";

/** `id:slot` — un guion bajo significa que aún no tiene sitio. */
function entrada(...defs: string[]) {
  return defs.map((d) => {
    const [id, s] = d.split(":");
    return { id, slot: s === "_" ? null : Number(s) };
  });
}

const plano = (m: Map<string, number>) =>
  Object.fromEntries([...m.entries()].sort());

describe("asignarHuecos", () => {
  it("respeta los huecos que ya tienen", () => {
    expect(plano(asignarHuecos(entrada("a:2", "b:0")))).toEqual({ a: 2, b: 0 });
  });

  it("a los que no tienen les da el primer hueco libre", () => {
    expect(plano(asignarHuecos(entrada("a:0", "b:_", "c:_")))).toEqual({
      a: 0,
      b: 1,
      c: 2,
    });
  });

  it("rellena los agujeros que dejan los huecos ocupados", () => {
    // El 0 y el 2 están cogidos: el nuevo va al 1, no al 3.
    expect(plano(asignarHuecos(entrada("a:0", "c:2", "b:_")))).toEqual({
      a: 0,
      c: 2,
      b: 1,
    });
  });

  it("sin hábitos devuelve un mapa vacío", () => {
    expect(asignarHuecos([]).size).toBe(0);
  });

  /*
    LA GARANTÍA QUE JUSTIFICA LOS HUECOS. Dos plantas en el mismo sitio se
    taparían, y con coordenadas libres eso es un estado alcanzable. Aquí es
    imposible por construcción, y este test lo afirma también cuando la base
    llega corrupta.
  */
  it("nunca asigna el mismo hueco dos veces", () => {
    const m = asignarHuecos(entrada("a:1", "b:1", "c:1", "d:_"));
    const usados = [...m.values()];
    expect(new Set(usados).size).toBe(usados.length);
  });

  it("con huecos repetidos en la base, el primero se queda el suyo", () => {
    const m = asignarHuecos(entrada("a:1", "b:1"));
    expect(m.get("a")).toBe(1);
    expect(m.get("b")).not.toBe(1);
  });

  it("un hueco negativo o roto se trata como si no tuviera", () => {
    const m = asignarHuecos([
      { id: "a", slot: -5 },
      { id: "b", slot: 0 },
    ]);
    expect(m.get("b")).toBe(0);
    expect(m.get("a")).toBeGreaterThanOrEqual(0);
    expect(m.get("a")).not.toBe(0);
  });

  /*
    El mismo jardín tiene que verse igual cada vez que se carga. Si el orden
    dependiera del recorrido de un objeto, las plantas bailarían entre recargas.
  */
  it("es estable: la misma entrada da la misma salida", () => {
    const e = entrada("a:_", "b:_", "c:_");
    expect(plano(asignarHuecos(e))).toEqual(plano(asignarHuecos(e)));
  });
});

describe("intercambiar", () => {
  it("cambia los huecos de dos plantas", () => {
    const m = asignarHuecos(entrada("a:0", "b:1"));
    const r = intercambiar(m, "a", "b");
    expect(r.get("a")).toBe(1);
    expect(r.get("b")).toBe(0);
  });

  it("no toca a las demás", () => {
    const m = asignarHuecos(entrada("a:0", "b:1", "c:2"));
    expect(intercambiar(m, "a", "b").get("c")).toBe(2);
  });

  /*
    Devuelve un mapa NUEVO en vez de mutar el que recibe: el que recibe viene del
    servidor y mutarlo dejaría la pantalla y la base diciendo cosas distintas si
    el guardado falla.
  */
  it("no muta el mapa que recibe", () => {
    const m = asignarHuecos(entrada("a:0", "b:1"));
    intercambiar(m, "a", "b");
    expect(m.get("a")).toBe(0);
  });

  it("intercambiar una consigo misma no cambia nada", () => {
    const m = asignarHuecos(entrada("a:0", "b:1"));
    expect(plano(intercambiar(m, "a", "a"))).toEqual(plano(m));
  });

  it("con un id que no existe devuelve lo mismo", () => {
    const m = asignarHuecos(entrada("a:0"));
    expect(plano(intercambiar(m, "a", "fantasma"))).toEqual(plano(m));
  });
});
