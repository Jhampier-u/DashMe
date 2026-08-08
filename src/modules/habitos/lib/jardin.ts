import { and, asc, desc, eq, gte } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { habits as habitsTable, habitLogs, tasks } from "../schema";
import { asignarHuecos, intercambiar, type ConHueco } from "./huecos";
import { pausasPorHabito } from "./pausas";
import { sanitizeSchedule } from "./calendario";
import { normalizeDayKey } from "./day";
import { diasQueCuentan } from "./cantidad";
import type { PlantSpecies } from "./garden";
import type { HabitoHistorico } from "./historia";

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

/**
 * Todo lo que hace falta para reconstruir cualquier día del jardín.
 *
 * Se trae de una vez y el recorrido pasa entero en el navegador. La alternativa
 * era pedir cada día al servidor, y entonces arrastrar el deslizador dispararía
 * una petición por día: el timelapse iría a tirones.
 *
 * Lo que viaja son CLAVES DE DÍA, no filas de registro. Un año de cinco hábitos
 * son unos pocos miles de números, y ni el XP ni los escudos ni las notas hacen
 * falta para saber de qué tamaño estaba una planta.
 */
export async function getJardinHistorico(db: Db): Promise<HabitoHistorico[]> {
  const [filas, logs, pausas] = await Promise.all([
    db
      .select()
      .from(habitsTable)
      .orderBy(desc(habitsTable.isAnchor), asc(habitsTable.createdAt)),
    db
      .select({
        habitId: habitLogs.habitId,
        date: habitLogs.date,
        partial: habitLogs.partial,
        count: habitLogs.count,
      })
      .from(habitLogs),
    pausasPorHabito(db),
  ]);

  const porId = new Map<string, typeof logs>();
  for (const l of logs) {
    const lista = porId.get(l.habitId);
    if (lista) lista.push(l);
    else porId.set(l.habitId, [l]);
  }

  return filas.map((h) => ({
    id: h.id,
    name: h.name,
    color: h.color,
    plantSpecies: (h.plantSpecies as PlantSpecies) ?? "flower",
    isAnchor: h.isAnchor,
    schedule: sanitizeSchedule(h.schedule),
    creado: normalizeDayKey(h.createdAt),
    pausas: (pausas.get(h.id) ?? []).map((p) => ({
      desde: p.desde,
      hasta: p.hasta,
    })),
    /*
      Los mismos días que cuentan para el jardín vivo —`diasQueCuentan` respeta
      lo parcial y el objetivo numérico—. Si aquí se contara cualquier registro,
      HOY se vería distinto según lo miraras desde el jardín o desde su memoria,
      y no habría forma de saber cuál de los dos miente. Desde que el clima usa
      esta misma regla, esta lista sirve también para él.
    */
    cumplidos: [
      ...diasQueCuentan(
        (porId.get(h.id) ?? []).map((l) => ({
          date: l.date,
          partial: !!l.partial,
          count: l.count,
        })),
        h.targetCount,
      ),
    ],
  }));
}

/**
 * El día del registro de hábito más antiguo. Nulo si no hay ninguno.
 *
 * Es donde empieza la barra de tiempo, y por tanto hasta dónde hay que traer
 * datos de fuera. Sin él no hay pasado que enseñar.
 */
export async function primerDiaDeRegistro(db: Db): Promise<Date | null> {
  const [fila] = await db
    .select({ dia: habitLogs.date })
    .from(habitLogs)
    .orderBy(asc(habitLogs.date))
    .limit(1);
  return fila ? normalizeDayKey(fila.dia) : null;
}

/**
 * Cuántas tareas se cerraron cada día, desde `desde`.
 *
 * Devuelve una lista de claves de día en bruto —una por tarea— y no un recuento
 * ya hecho: quien las cuenta es `mezclarFauna`, que es puro y se prueba sin
 * base.
 */
export async function diasConTareaCerrada(
  db: Db,
  desde: Date,
): Promise<number[]> {
  const filas = await db
    .select({ cerrada: tasks.completedAt })
    .from(tasks)
    .where(and(eq(tasks.status, "DONE"), gte(tasks.completedAt, desde)));
  return filas
    .filter((f) => f.cerrada !== null)
    .map((f) => normalizeDayKey(f.cerrada as Date).getTime());
}
