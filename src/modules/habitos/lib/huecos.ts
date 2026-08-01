/*
  Dónde va cada planta en el jardín.

  El jardín es una rejilla de HUECOS y no un lienzo con coordenadas. Es la
  decisión que evita la mitad de los problemas de colocar cosas a mano:

    · dos plantas NO pueden solaparse, porque un hueco es de una;
    · nada puede quedar fuera de la pantalla;
    · arrastrar es intercambiar dos números, que se guarda y se deshace solo;
    · en móvil funciona igual, porque no hay precisión que acertar.

  Todo esto es puro: recibe qué hueco tiene guardado cada hábito y devuelve dónde
  va cada uno. No toca la base.
*/

export type ConHueco = { id: string; slot: number | null };

/**
 * El hueco definitivo de cada hábito.
 *
 * Los que ya tienen uno válido y libre se lo quedan. Los que no —recién creados,
 * o con un valor repetido o roto en la base— caen en el primer hueco libre.
 *
 * ES ESTABLE: la misma entrada da la misma salida. Si el orden dependiera del
 * recorrido de un objeto, las plantas bailarían entre recargas.
 */
export function asignarHuecos(habitos: ConHueco[]): Map<string, number> {
  const asignado = new Map<string, number>();
  const ocupados = new Set<number>();

  // Primera pasada: los que traen un hueco utilizable se lo quedan. En orden de
  // entrada, así que ante un repetido gana el primero y el segundo se recoloca.
  for (const h of habitos) {
    const s = h.slot;
    if (s === null || !Number.isInteger(s) || s < 0) continue;
    if (ocupados.has(s)) continue;
    ocupados.add(s);
    asignado.set(h.id, s);
  }

  // Segunda: el resto, al primer hueco libre.
  let siguiente = 0;
  for (const h of habitos) {
    if (asignado.has(h.id)) continue;
    while (ocupados.has(siguiente)) siguiente += 1;
    ocupados.add(siguiente);
    asignado.set(h.id, siguiente);
  }

  return asignado;
}

/**
 * Intercambia el hueco de dos plantas.
 *
 * Devuelve un mapa NUEVO en vez de mutar el que recibe: el que recibe viene del
 * servidor, y mutarlo dejaría la pantalla y la base diciendo cosas distintas si
 * el guardado falla.
 */
export function intercambiar(
  huecos: Map<string, number>,
  a: string,
  b: string,
): Map<string, number> {
  const copia = new Map(huecos);
  const ha = copia.get(a);
  const hb = copia.get(b);
  if (ha === undefined || hb === undefined) return copia;
  copia.set(a, hb);
  copia.set(b, ha);
  return copia;
}
