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
 * La descomposición NFKD (de compatibilidad, no solo canónica) separa las
 * marcas diacríticas del carácter base y además pliega variantes de
 * compatibilidad —como las letras fullwidth ("ＡＢＣ") o ligaduras
 * tipográficas ("ﬁ")— a su forma básica, de modo que `\p{M}` puede
 * eliminar las marcas resultantes: así "Beyoncé" y "Beyonce" —y también
 * las formas compuesta y descompuesta del mismo texto— producen la misma
 * clave. También se eliminan los caracteres de formato invisibles
 * (categoría `\p{Cf}`, p. ej. espacios de ancho cero) que de otro modo
 * pasarían desapercibidos y falsearían la clave. Letras sin descomposición
 * de compatibilidad —como "ß", "Æ", "Ø" o "Ł"— no tienen un
 * equivalente ASCII y se conservan tal cual, solo con el cambio de
 * mayúsculas a minúsculas: esto es intencional, no un defecto pendiente.
 */
export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\p{M}\p{Cf}]/gu, "")
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
