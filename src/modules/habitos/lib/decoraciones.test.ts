import { describe, expect, it } from "vitest";
import { parseSprite } from "@/modules/core/ui/pixel/rejilla";
import {
  CATALOGO,
  TIENDA,
  esDecoracion,
  puedeComprar,
  type Decoracion,
} from "./decoraciones";

describe("el catálogo", () => {
  it("dibuja las ocho, y ninguna con letras inventadas", () => {
    /*
      `parseSprite` revienta si una fila tiene otra longitud o si aparece una
      letra que no está en la paleta. Pasarlas todas por aquí es lo que impide
      que una decoración llegue a la escena y no se pinte nada.
    */
    for (const item of CATALOGO) {
      expect(() => parseSprite(item.grid)).not.toThrow();
    }
    expect(CATALOGO).toHaveLength(8);
  });

  it("las enseña de más barata a más cara", () => {
    const precios = CATALOGO.map((d) => d.precio);
    expect([...precios].sort((a, b) => a - b)).toEqual(precios);
  });

  it("cada una tiene precio positivo, nombre y descripción", () => {
    for (const d of CATALOGO) {
      expect(d.precio).toBeGreaterThan(0);
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.descripcion.length).toBeGreaterThan(0);
    }
  });

  it("ninguna comparte sitio con otra", () => {
    // Dos adornos en el mismo punto se taparían, y como no se pueden mover no
    // habría forma de arreglarlo desde la pantalla.
    const sitios = CATALOGO.map((d) => `${d.sitio.left}|${d.sitio.top}`);
    expect(new Set(sitios).size).toBe(sitios.length);
  });

  it("la clave del mapa coincide con el `kind` de dentro", () => {
    for (const [clave, item] of Object.entries(TIENDA)) {
      expect(item.kind).toBe(clave);
    }
  });
});

describe("puedeComprar", () => {
  const nada: Decoracion[] = [];

  it("deja comprar con saldo justo", () => {
    expect(puedeComprar("piedra", 50, nada)).toEqual({
      puede: true,
      precio: 50,
    });
  });

  it("dice CUÁNTO falta, no solo que falta", () => {
    // Un botón apagado sin número obliga a restar de cabeza para saber si te
    // faltan diez o seiscientos.
    expect(puedeComprar("valla", 70, nada)).toEqual({
      puede: false,
      motivo: "sin-saldo",
      faltan: 50,
    });
  });

  it("no deja comprar dos veces la misma", () => {
    expect(puedeComprar("piedra", 9999, ["piedra"])).toEqual({
      puede: false,
      motivo: "ya-es-tuya",
    });
  });

  it("tenerla ya pesa más que no tener saldo", () => {
    // Si contestara «sin saldo» sobre algo que ya es tuyo, el mensaje te
    // mandaría a ganar XP para comprar lo que ya tienes.
    expect(puedeComprar("arcoiris", 0, ["arcoiris"])).toMatchObject({
      motivo: "ya-es-tuya",
    });
  });

  it("tener otras no estorba", () => {
    expect(puedeComprar("valla", 120, ["piedra", "gato"])).toEqual({
      puede: true,
      precio: 120,
    });
  });
});

describe("esDecoracion", () => {
  it("reconoce las del catálogo", () => {
    expect(esDecoracion("gato")).toBe(true);
  });

  it("rechaza lo que no lo es", () => {
    // La base guarda texto. Una fila con un `kind` de una versión anterior no
    // debe colarse hasta la escena y buscar un sprite que no existe.
    expect(esDecoracion("dragon")).toBe(false);
    expect(esDecoracion("")).toBe(false);
    expect(esDecoracion("toString")).toBe(false);
  });
});
