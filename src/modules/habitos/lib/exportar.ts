import { count, getTableName, is } from "drizzle-orm";
import { SQLiteTable, getTableConfig } from "drizzle-orm/sqlite-core";
import type { Db } from "@/modules/core/db";
import * as esquema from "@/modules/core/db/schema";

/*
  LA EXPORTACIÓN HONESTA.

  El hallazgo que la motiva no es de formato, es de retención. Habitica promedia
  tu historial antiguo para ahorrar almacenamiento, y lo dice en su propia
  documentación: los datos viejos se sustituyen por su media y es la media lo
  que acaba en la exportación. Ningún formato recupera lo que la base ya tiró.

  Este proyecto conserva todo y nunca promedia. La ventaja ya existía; esto es
  solo la puerta.

  Y no es teórico: la base de este dashboard se perdió una vez y se recuperó
  entera de un volcado con esta misma forma —esquema y filas—. Un export que
  nunca se ha vuelto a importar es una promesa, no una salida.

  QUÉ NO LLEVA, y por qué: nada derivado. Ni rachas, ni nivel, ni sugerencias de
  automaticidad. Todo eso se recalcula al leer y exportarlo sería exportar una
  opinión de hoy con aspecto de dato. Lo que se guarda es lo que se guarda.
*/

export const FORMATO = "dashme-export";
export const VERSION = 1;

/**
 * Las tablas, con los padres antes que los hijos.
 *
 * Es una lista a mano y no un orden deducido a propósito: se lee, se discute y
 * un test comprueba que están TODAS las del esquema. Sin esa guarda, añadir una
 * tabla la dejaría fuera del export en silencio — que es justo lo que la
 * propuesta le reprocha al resto del sector.
 */
export const ORDEN = [
  "habits",
  "habit_logs",
  "habit_notes",
  "habit_pauses",
  "habit_automaticity",
  "player",
  "daily_quests",
  "garden_decorations",
  "projects",
  "task_categories",
  "tasks",
  "task_attachments",
] as const;

export type Fila = Record<string, unknown>;

export type Exportacion = {
  formato: typeof FORMATO;
  version: number;
  /** ISO del momento del volcado. */
  generado: string;
  /** Filas por tabla, para poder comprobar de un vistazo que no falta nada. */
  recuento: Record<string, number>;
  tablas: Record<string, Fila[]>;
};

/** Las tablas del esquema, por nombre. */
function tablasPorNombre(): Map<string, SQLiteTable> {
  const m = new Map<string, SQLiteTable>();
  for (const v of Object.values(esquema)) {
    if (is(v, SQLiteTable)) m.set(getTableName(v), v);
  }
  return m;
}

function tablaDe(nombre: string): SQLiteTable {
  const t = tablasPorNombre().get(nombre);
  if (!t) throw new Error(`El esquema no tiene la tabla "${nombre}"`);
  return t;
}

/*
  LAS FECHAS CRUZAN EL FICHERO COMO NÚMEROS.

  `JSON.stringify` convierte un `Date` en texto ISO, y al volver, Drizzle espera
  un `Date` y revienta con «value.getTime is not a function». O sea que la ida y
  vuelta funcionaba en memoria y estaba ROTA en cuanto pasaba por un fichero,
  que es el único camino que le importa a nadie.

  Se descubrió descargando el fichero de verdad. El test de ida y vuelta pasaba
  porque le daba el objeto en memoria y nunca cruzaba JSON: exactamente «una
  promesa, no una salida». Ahora hay un test que sí cruza.

  Qué columnas son fechas no se decide por el nombre —`createdAt`, `week`,
  `fromDay` no se parecen en nada— sino preguntándoselo a la tabla.
*/
function columnasDeFecha(tabla: SQLiteTable): Set<string> {
  const nombres = new Set<string>();
  for (const [prop, col] of Object.entries(getTableConfig(tabla).columns)) {
    void prop;
    if (col.dataType === "date") nombres.add(col.name);
  }
  return nombres;
}

/** Nombre SQL de cada propiedad TypeScript, para casarlas con las columnas. */
function propsDeFecha(tabla: SQLiteTable): Set<string> {
  const props = new Set<string>();
  const cols = columnasDeFecha(tabla);
  for (const [prop, col] of Object.entries(
    tabla as unknown as Record<string, { name?: string }>,
  )) {
    if (col && typeof col === "object" && col.name && cols.has(col.name)) {
      props.add(prop);
    }
  }
  return props;
}

/** Date -> milisegundos. Lo que dice el documento del formato. */
function aFichero(filas: Fila[], tabla: SQLiteTable): Fila[] {
  const fechas = propsDeFecha(tabla);
  if (fechas.size === 0) return filas;
  return filas.map((f) => {
    const salida: Fila = { ...f };
    for (const p of fechas) {
      const v = salida[p];
      if (v instanceof Date) salida[p] = v.getTime();
    }
    return salida;
  });
}

/**
 * Milisegundos -> Date. Acepta también texto ISO, para poder leer los volcados
 * que salieron antes de que esto existiera.
 */
function deFichero(filas: Fila[], tabla: SQLiteTable): Fila[] {
  const fechas = propsDeFecha(tabla);
  if (fechas.size === 0) return filas;
  return filas.map((f) => {
    const salida: Fila = { ...f };
    for (const p of fechas) {
      const v = salida[p];
      if (typeof v === "number" || typeof v === "string") {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) {
          throw new Error(`Fecha ilegible en ${p}: ${JSON.stringify(v)}`);
        }
        salida[p] = d;
      }
    }
    return salida;
  });
}

/** Todo lo que hay guardado, tal cual está. */
export async function exportarTodo(db: Db): Promise<Exportacion> {
  const tablas: Record<string, Fila[]> = {};
  const recuento: Record<string, number> = {};
  for (const nombre of ORDEN) {
    const tabla = tablaDe(nombre);
    const filas = aFichero((await db.select().from(tabla)) as Fila[], tabla);
    tablas[nombre] = filas;
    recuento[nombre] = filas.length;
  }
  return {
    formato: FORMATO,
    version: VERSION,
    generado: new Date().toISOString(),
    recuento,
    tablas,
  };
}

/**
 * Vuelve a meter un volcado.
 *
 * Se niega a escribir sobre una base con datos salvo que se le diga
 * `reemplazar`. Importar encima mezclaría dos historiales sin decirlo, y una
 * mezcla silenciosa es peor que un error.
 *
 * El borrado va en orden inverso —hijos antes que padres— para no depender de
 * los ON DELETE, y la carga en el orden de ORDEN.
 */
export async function importarTodo(
  db: Db,
  datos: Exportacion,
  opciones: { reemplazar?: boolean } = {},
): Promise<void> {
  if (datos?.formato !== FORMATO) {
    throw new Error(
      `Este fichero no es del formato "${FORMATO}" (dice "${datos?.formato}")`,
    );
  }
  if (datos.version > VERSION) {
    throw new Error(
      `Versión ${datos.version} del formato: esta copia solo sabe leer hasta la ${VERSION}`,
    );
  }

  if (!opciones.reemplazar) {
    for (const nombre of ORDEN) {
      const hay = await db.select().from(tablaDe(nombre)).limit(1);
      if (hay.length > 0) {
        throw new Error(
          `La base no está vacía ("${nombre}" tiene datos). Usa reemplazar si quieres sustituirla.`,
        );
      }
    }
  } else {
    for (const nombre of [...ORDEN].reverse()) {
      await db.delete(tablaDe(nombre));
    }
  }

  for (const nombre of ORDEN) {
    const filas = datos.tablas[nombre];
    // Una tabla ausente no es un error: un volcado de una versión anterior no
    // conoce las tablas que se añadieron después.
    if (!filas || filas.length === 0) continue;
    const tabla = tablaDe(nombre);
    await db.insert(tabla).values(deFichero(filas, tabla));
  }
}

/**
 * Cuántas filas hay, sin traérselas.
 *
 * Existe porque la pantalla solo quiere enseñar un número, y llamar a
 * `exportarTodo` para eso leería la base entera en cada carga.
 */
export async function contarTodo(db: Db): Promise<Record<string, number>> {
  const recuento: Record<string, number> = {};
  for (const nombre of ORDEN) {
    const [fila] = await db
      .select({ n: count() })
      .from(tablaDe(nombre));
    recuento[nombre] = fila?.n ?? 0;
  }
  return recuento;
}
