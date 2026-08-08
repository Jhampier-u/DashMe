import { asc, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { habitPauses, habits as habitsTable } from "@/modules/habitos/schema";
import { corregirRango, type Rango } from "./calendario";
import { normalizeDayKey } from "./day";

export const LIMITE_MOTIVO = 120;

export type Pausa = Rango & { id: string; reason: string | null };

export async function pausasDeHabito(
  db: Db,
  habitId: string,
): Promise<Pausa[]> {
  const filas = await db
    .select()
    .from(habitPauses)
    .where(eq(habitPauses.habitId, habitId))
    .orderBy(asc(habitPauses.fromDay));
  const propias = filas.map(aPausa);

  // La misma pausa sintética que en `pausasPorHabito`. Va aquí también porque
  // esta es la que consultan las mutaciones: sin ella se podría marcar un hábito
  // ya interiorizado y volvería a la vida por la puerta de atrás.
  const [h] = await db
    .select({ desde: habitsTable.internalizedAt })
    .from(habitsTable)
    .where(eq(habitsTable.id, habitId))
    .limit(1);
  if (h?.desde) propias.push(pausaDeInteriorizado(h.desde));
  return propias;
}

/**
 * Todas las pausas, agrupadas por hábito.
 *
 * Una consulta y agrupación en memoria, como `listProjects` y `listCategorias`:
 * las pantallas que pintan varios hábitos necesitan las de todos, y una consulta
 * por hábito sería un N+1.
 */
export async function pausasPorHabito(db: Db): Promise<Map<string, Pausa[]>> {
  const [filas, interiorizados] = await Promise.all([
    db.select().from(habitPauses).orderBy(asc(habitPauses.fromDay)),
    db
      .select({ id: habitsTable.id, desde: habitsTable.internalizedAt })
      .from(habitsTable)
      .where(isNotNull(habitsTable.internalizedAt)),
  ]);
  const mapa = new Map<string, Pausa[]>();
  const meter = (id: string, p: Pausa) => {
    const lista = mapa.get(id);
    if (lista) lista.push(p);
    else mapa.set(id, [p]);
  };
  for (const f of filas) meter(f.habitId, aPausa(f));
  for (const h of interiorizados) meter(h.id, pausaDeInteriorizado(h.desde!));
  return mapa;
}

/**
 * Un hábito interiorizado se modela como UNA PAUSA QUE NO TERMINA.
 *
 * Es la misma puerta por la que ya entran las vacaciones: «una pausa no es un
 * estado nuevo, es otra razón para que un día no esté programado», y los catorce
 * sitios que consultan el calendario ya saben tratar un día no programado —lo
 * saltan, no lo cuentan y no lo consideran un fallo—.
 *
 * De regalo salen tres cosas que habría habido que programar a mano:
 *   · deja de aparecer en pendientes y no rompe ninguna racha;
 *   · no cuenta para el clima ni para la misión del día perfecto;
 *   · y EN EL JARDÍN LA PLANTA NO SE MARCHITA, porque `computeStreak` salta los
 *     días no programados y sigue contando la racha que tenía el día que lo
 *     diste por hecho. La planta se queda como estaba.
 *
 * Y el pasado no se toca: los días ANTERIORES siguen programados, así que la
 * memoria del jardín sigue enseñando el hábito tal y como fue.
 */
function pausaDeInteriorizado(desde: Date): Pausa {
  // Un final lo bastante lejos como para no llegar nunca, sin usar Infinity:
  // las comparaciones son sobre `getTime()` y un infinito se colaría en sitios
  // que esperan una fecha de verdad.
  return {
    id: "interiorizado",
    reason: null,
    desde: normalizeDayKey(desde),
    hasta: new Date(8.64e15),
  };
}

export async function addPausa(
  db: Db,
  habitId: string,
  desde: Date,
  hasta: Date,
  reason: string | null,
): Promise<void> {
  if (!habitId) return;
  // Endereza y normaliza: un rango al revés es un error de dedo, no una
  // intención, y rechazarlo obligaría al usuario a adivinar qué escribió mal.
  const r = corregirRango(desde, hasta);
  const motivo = reason?.trim().slice(0, LIMITE_MOTIVO) || null;
  await db.insert(habitPauses).values({
    id: crypto.randomUUID(),
    habitId,
    fromDay: r.desde,
    toDay: r.hasta,
    reason: motivo,
    createdAt: new Date(),
  });
}

/**
 * Quita una pausa.
 *
 * No toca ningún registro: los días que estaban dentro vuelven a contar tal como
 * estaban, porque nunca se borró nada.
 */
export async function borrarPausa(db: Db, id: string): Promise<void> {
  if (!id) return;
  await db.delete(habitPauses).where(eq(habitPauses.id, id));
}

function aPausa(f: {
  id: string;
  fromDay: Date;
  toDay: Date;
  reason: string | null;
}): Pausa {
  return { id: f.id, desde: f.fromDay, hasta: f.toDay, reason: f.reason };
}
