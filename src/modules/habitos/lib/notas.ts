import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { habitNotes } from "@/modules/habitos/schema";
import { normalizeDayKey } from "./day";

export const LIMITE_NOTA = 500;

export type Nota = { date: Date; text: string };

export async function getNota(
  db: Db,
  habitId: string,
  date: Date,
): Promise<string | null> {
  const dia = normalizeDayKey(date);
  const [fila] = await db
    .select({ text: habitNotes.text })
    .from(habitNotes)
    .where(and(eq(habitNotes.habitId, habitId), eq(habitNotes.date, dia)))
    .limit(1);
  return fila?.text ?? null;
}

export async function notasDeHabito(db: Db, habitId: string): Promise<Nota[]> {
  const filas = await db
    .select({ date: habitNotes.date, text: habitNotes.text })
    .from(habitNotes)
    .where(eq(habitNotes.habitId, habitId))
    .orderBy(asc(habitNotes.date));
  return filas.map((f) => ({ date: f.date, text: f.text }));
}

/**
 * Guarda la nota de un día. **Vacío borra.**
 *
 * Que vacío borre deja un solo estado para «sin nota», en vez de dos —fila
 * ausente o fila con cadena vacía—, que es la clase de duplicidad que después se
 * olvida en un `if` y pinta un punto de nota donde no hay nada.
 */
export async function setNota(
  db: Db,
  habitId: string,
  date: Date,
  text: string,
): Promise<void> {
  if (!habitId) return;
  const dia = normalizeDayKey(date);
  const limpio = text.trim().slice(0, LIMITE_NOTA);
  const donde = and(eq(habitNotes.habitId, habitId), eq(habitNotes.date, dia));

  if (!limpio) {
    await db.delete(habitNotes).where(donde);
    return;
  }

  const ahora = new Date();
  const [existente] = await db
    .select({ id: habitNotes.id })
    .from(habitNotes)
    .where(donde)
    .limit(1);

  if (existente) {
    await db
      .update(habitNotes)
      .set({ text: limpio, updatedAt: ahora })
      .where(eq(habitNotes.id, existente.id));
    return;
  }

  await db.insert(habitNotes).values({
    id: crypto.randomUUID(),
    habitId,
    date: dia,
    text: limpio,
    createdAt: ahora,
    updatedAt: ahora,
  });
}
