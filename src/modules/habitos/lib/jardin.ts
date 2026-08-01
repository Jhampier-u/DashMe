import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { habits as habitsTable } from "../schema";
import { asignarHuecos, intercambiar, type ConHueco } from "./huecos";

/*
  Guardar la colocación del jardín.

  `huecos.ts` decide dónde va cada planta y no toca la base; esto es lo único que
  escribe. Van separados porque la parte delicada —que no se solapen, que el
  orden sea estable— se puede probar entera sin base de datos.
*/

/**
 * Intercambia el sitio de dos plantas y lo deja guardado.
 *
 * Escribe el hueco de TODAS, no solo el de las dos. Los hábitos recién creados
 * llegan con `garden_slot` nulo y la colocación se resuelve al pintar, así que
 * si guardara solo el par, el resto seguiría dependiendo de un cálculo que
 * cambia en cuanto se crea o se borra un hábito: las plantas se moverían solas.
 * Guardando todas, lo que ves queda grabado tal cual.
 *
 * El orden de lectura es el MISMO que usa la pantalla (ancla primero, luego por
 * antigüedad). De eso depende que `asignarHuecos` reparta igual aquí que allí.
 */
export async function intercambiarHuecos(
  db: Db,
  a: string,
  b: string,
): Promise<void> {
  // Intercambiar una planta consigo misma es lo que pasa al soltar donde
  // estaba. No es un error, simplemente no hay nada que guardar.
  if (a === b) return;

  const filas = await db
    .select({ id: habitsTable.id, slot: habitsTable.gardenSlot })
    .from(habitsTable)
    .orderBy(desc(habitsTable.isAnchor), asc(habitsTable.createdAt));

  const conocidos = new Set(filas.map((f) => f.id));
  // Un id que ya no existe —la planta se borró en otra pestaña— no debe
  // reordenar el jardín entero por accidente.
  if (!conocidos.has(a) || !conocidos.has(b)) return;

  const antes = asignarHuecos(filas as ConHueco[]);
  const despues = intercambiar(antes, a, b);

  for (const [id, slot] of despues) {
    await db
      .update(habitsTable)
      .set({ gardenSlot: slot })
      .where(eq(habitsTable.id, id));
  }
}
