import path from "node:path";

/*
  Todo lo delicado de los adjuntos, sin base de datos y sin disco.

  Está aparte porque es la única parte del repo donde un fallo no da un dato
  mal: da acceso a archivos que no son del usuario. Como funciones puras se
  prueba cada caso, incluidos los que nunca deberían llegar.
*/

/** La carpeta de los adjuntos, hermana de la base. */
export const DIR_ADJUNTOS = path.join(process.cwd(), "data", "adjuntos");

/**
 * 50 MB.
 *
 * Tiene que cuadrar con `serverActions.bodySizeLimit` de `next.config.ts`, que
 * va en 51: la documentación de Next advierte que `multipart/form-data` añade de
 * 10 a 20 KB de bordes y metadatos, así que apurar el límite exacto rompería
 * justo en los archivos grandes.
 */
export const LIMITE_BYTES = 50 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * ¿Tiene forma de nombre en disco?
 *
 * Es una LISTA BLANCA, y por eso es fuerte. Buscar `..` siempre se queda corto
 * —codificaciones, barras de Windows, nombres raros de NTFS—; exigir la forma
 * exacta de un UUID en minúsculas no deja nada por fuera.
 */
export function esNombreEnDisco(nombre: string): boolean {
  return UUID.test(nombre);
}

/**
 * El nombre con el que se guarda un archivo.
 *
 * NO es el que subió el usuario, y no lleva su extensión pegada. El nombre real
 * vive en la columna `name` de la base, solo para mostrarlo y para nombrar la
 * descarga.
 *
 * Así: dos archivos con el mismo nombre no se pisan, un nombre con `../` no
 * llega nunca a una ruta, y el contenido de la carpeta no cuenta de qué van tus
 * tareas.
 */
export function nuevoNombreEnDisco(): string {
  return crypto.randomUUID();
}

/**
 * La ruta en disco de un adjunto, o `null` si el nombre no es de fiar.
 *
 * Dos comprobaciones y no una: la forma del nombre, y que la ruta resuelta caiga
 * dentro de la carpeta. La segunda sobra si la primera está bien, y va de todos
 * modos — es lo único que separa `/api/adjunto/<id>` de servir la base entera.
 */
export function rutaDeAdjunto(
  nombre: string,
  base: string = DIR_ADJUNTOS,
): string | null {
  if (!esNombreEnDisco(nombre)) return null;
  const raiz = path.resolve(base);
  const completa = path.resolve(raiz, nombre);
  if (completa !== path.join(raiz, nombre)) return null;
  if (!completa.startsWith(raiz + path.sep)) return null;
  return completa;
}

export type Rechazo = { ok: false; motivo: string };
export type Veredicto = { ok: true } | Rechazo;

export function validarSubida(f: { name: string; size: number }): Veredicto {
  if (!f.name.trim()) return { ok: false, motivo: "sin-nombre" };
  if (f.size <= 0) return { ok: false, motivo: "vacio" };
  if (f.size > LIMITE_BYTES) return { ok: false, motivo: "grande" };
  return { ok: true };
}

/**
 * Solo `http:` y `https:`.
 *
 * Un `javascript:` guardado y pintado en un `href` es ejecución de código en la
 * sesión del usuario, y basta con pegarlo en el campo. Se filtra por esquema
 * PERMITIDO y no por lo que parezca sospechoso: la lista de lo malo nunca está
 * completa.
 */
export function validarEnlace(url: string): Veredicto {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return { ok: false, motivo: "no-es-url" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, motivo: "esquema" };
  }
  return { ok: true };
}
