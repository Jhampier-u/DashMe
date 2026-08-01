import {
  ARCOIRIS,
  BANCO,
  ESPANTAPAJAROS,
  ESTANQUE,
  FAROL,
  GATO,
  PIEDRA,
  VALLA,
} from "./sprites/decoraciones";

/*
  El catálogo de la tienda del jardín.

  Cada decoración es ÚNICA: o la tienes o no. Nada de comprar tres bancos, y por
  eso tampoco hace falta un sistema para colocarlas — cada una declara dónde
  vive. Las plantas van en huecos porque son muchas y cambian; los adornos son
  ocho y fijos, y darles arrastre sería inventar un problema para resolverlo.
*/

export type Decoracion =
  | "piedra"
  | "valla"
  | "farol"
  | "banco"
  | "estanque"
  | "espantapajaros"
  | "gato"
  | "arcoiris";

/** Dónde se planta un adorno dentro de la escena, en porcentaje. */
export type Sitio = {
  left: string;
  /** Desde arriba. Los del suelo van por debajo del horizonte, que está al 62%. */
  top: string;
  /** Ancho del dibujo en píxeles de pantalla. */
  tamano: number;
};

export type EnLaTienda = {
  kind: Decoracion;
  label: string;
  /** Qué es, en una frase. Va en la tienda, no en la escena. */
  descripcion: string;
  precio: number;
  grid: string;
  sitio: Sitio;
};

/**
 * Las ocho, en orden de precio.
 *
 * Es un `Record` y no una lista suelta: añadir una clave al tipo `Decoracion`
 * sin dibujarla no compila. Es el mismo truco que obliga a que las cinco
 * especies de planta tengan sprite.
 */
export const TIENDA: Record<Decoracion, EnLaTienda> = {
  piedra: {
    kind: "piedra",
    label: "Piedra",
    descripcion: "Una roca en la esquina. Lo primero que cabe en el jardín.",
    precio: 50,
    grid: PIEDRA,
    sitio: { left: "4%", top: "80%", tamano: 44 },
  },
  valla: {
    kind: "valla",
    label: "Valla",
    descripcion: "Una cerca de madera que cierra el fondo.",
    precio: 120,
    grid: VALLA,
    sitio: { left: "8%", top: "64%", tamano: 190 },
  },
  farol: {
    kind: "farol",
    label: "Farol",
    descripcion: "Alumbra la esquina derecha, también de noche.",
    precio: 200,
    grid: FAROL,
    sitio: { left: "88%", top: "68%", tamano: 52 },
  },
  banco: {
    kind: "banco",
    label: "Banco",
    descripcion: "Para sentarse a mirar cómo crecen.",
    precio: 260,
    grid: BANCO,
    sitio: { left: "74%", top: "80%", tamano: 60 },
  },
  estanque: {
    kind: "estanque",
    label: "Estanque",
    descripcion: "Un charco con el cielo dentro.",
    precio: 350,
    grid: ESTANQUE,
    sitio: { left: "20%", top: "84%", tamano: 66 },
  },
  espantapajaros: {
    kind: "espantapajaros",
    label: "Espantapájaros",
    descripcion: "Vigila el jardín cuando no estás.",
    precio: 450,
    grid: ESPANTAPAJAROS,
    sitio: { left: "12%", top: "66%", tamano: 62 },
  },
  gato: {
    kind: "gato",
    label: "Gato",
    descripcion: "Se sienta en el banco y no hace absolutamente nada.",
    precio: 600,
    grid: GATO,
    sitio: { left: "66%", top: "72%", tamano: 46 },
  },
  arcoiris: {
    kind: "arcoiris",
    label: "Arcoíris",
    descripcion: "Cruza el cielo entero. La última y la más cara.",
    precio: 900,
    grid: ARCOIRIS,
    sitio: { left: "50%", top: "14%", tamano: 150 },
  },
};

/** El catálogo en orden de precio, que es como se enseña. */
export const CATALOGO: EnLaTienda[] = Object.values(TIENDA).sort(
  (a, b) => a.precio - b.precio,
);

export type Compra =
  | { puede: true; precio: number }
  | { puede: false; motivo: "ya-es-tuya" }
  | { puede: false; motivo: "sin-saldo"; faltan: number }
  /** Lo pedido no está en el catálogo. Solo llega si alguien salta la pantalla. */
  | { puede: false; motivo: "no-existe" };

/** Solo los casos en que NO se puede, para que quien recibe un no sepa por qué. */
export type Rechazo = Extract<Compra, { puede: false }>;

/**
 * Si se puede comprar, y si no, por qué.
 *
 * Devuelve CUÁNTO falta y no solo que falta. Un botón apagado sin explicación
 * obliga a restar de cabeza para saber si te faltan diez o seiscientos.
 */
export function puedeComprar(
  kind: Decoracion,
  saldo: number,
  tuyas: Iterable<Decoracion>,
): Compra {
  const item = TIENDA[kind];
  for (const t of tuyas) {
    if (t === kind) return { puede: false, motivo: "ya-es-tuya" };
  }
  if (saldo < item.precio) {
    return { puede: false, motivo: "sin-saldo", faltan: item.precio - saldo };
  }
  return { puede: true, precio: item.precio };
}

/** Si el texto que viene de la base es una decoración que exista hoy. */
export function esDecoracion(v: string): v is Decoracion {
  return Object.hasOwn(TIENDA, v);
}
