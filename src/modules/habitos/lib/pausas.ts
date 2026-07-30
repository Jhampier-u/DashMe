import { asc, eq } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { habitPauses } from "@/modules/habitos/schema";
import { corregirRango, type Rango } from "./calendario";

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
  return filas.map(aPausa);
}

/**
 * Todas las pausas, agrupadas por hábito.
 *
 * Una consulta y agrupación en memoria, como `listProjects` y `listCategorias`:
 * las pantallas que pintan varios hábitos necesitan las de todos, y una consulta
 * por hábito sería un N+1.
 */
export async function pausasPorHabito(db: Db): Promise<Map<string, Pausa[]>> {
  const filas = await db
    .select()
    .from(habitPauses)
    .orderBy(asc(habitPauses.fromDay));
  const mapa = new Map<string, Pausa[]>();
  for (const f of filas) {
    const lista = mapa.get(f.habitId);
    if (lista) lista.push(aPausa(f));
    else mapa.set(f.habitId, [aPausa(f)]);
  }
  return mapa;
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
