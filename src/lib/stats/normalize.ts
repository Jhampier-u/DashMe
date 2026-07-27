/**
 * Normalización de nombres a claves de agrupación.
 *
 * Módulo puro: sin `server-only`, sin acceso a base de datos. Se importa tanto
 * desde el servidor como desde los tests.
 */

/**
 * Separador de campos ASCII (unit separator). No imprimible, así que no puede
 * aparecer en un nombre de artista o título y falsear una clave compuesta.
 */
export const KEY_SEP = "\u001F";

/**
 * Minúsculas, sin diacríticos, espacios colapsados.
 *
 * La descomposición NFD separa las marcas diacríticas del carácter base, de
 * modo que `\p{M}` puede eliminarlas: así "Beyoncé" y "Beyonce" —y también las
 * formas compuesta y descompuesta del mismo texto— producen la misma clave.
 */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function artistKey(artist: string): string {
  return normalizeName(artist);
}

export function trackKey(artist: string, title: string): string {
  return `${artistKey(artist)}${KEY_SEP}${normalizeName(title)}`;
}

export function albumKey(artist: string, album: string): string {
  return `${artistKey(artist)}${KEY_SEP}${normalizeName(album)}`;
}
