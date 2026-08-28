import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { habitAutomaticity, habits } from "@/modules/habitos/schema";
import { dayKey } from "./day";
import { daysSince, startOfWeek } from "./flow";

/*
  AUTOMATICIDAD, QUE NO ES FRECUENCIA.

  El SRBAI —Gardner, Abraham, Lally y de Bruijn (2012), IJBNPA 9:102— es una
  subescala validada de cuatro ítems. La racha cuenta días seguidos; esto
  pregunta otra cosa: si ya no tienes que querer hacerlo.

  Y sobre cuándo sugerir: Lally et al. (2010) encontraron que la automaticidad
  crece por una curva asintótica distinta en cada persona, con una meseta que
  llegó entre los 18 y los 254 días. Por eso aquí no hay un número de días fijo
  tras el cual algo «ya es un hábito»: se mira la forma de TU curva.

  Lo que este módulo NO hace es decidir. La escala no tiene punto de corte
  validado —Gardner ha escrito en contra de inventarse uno— así que esto
  produce una sugerencia para que la mires, nunca un veredicto. La decisión
  sigue siendo del usuario, por el motivo de 2.3: la causa de un abandono no
  predice si el resultado fue bueno.
*/

/** Los cuatro ítems, en el orden del instrumento. */
export const ITEMS = [
  "Lo hago automáticamente",
  "Lo hago sin tener que recordarlo conscientemente",
  "Lo hago sin pensar",
  "Empiezo a hacerlo antes de darme cuenta",
] as const;

/** La escala va de 1 a 7. Solo se nombran los extremos y el centro. */
export const ANCLAS: Record<number, string> = {
  1: "Nada de acuerdo",
  4: "Ni sí ni no",
  7: "Muy de acuerdo",
};

/** Antes de esto no se pregunta: el más rápido de Lally tardó 18 días. */
export const MIN_DIAS = 18;

/** Cuántas semanas hacen falta para que hablar de «curva» signifique algo. */
export const MEDIDAS_MINIMAS = 4;

/** Cuántas de las últimas se miran para decidir si hay meseta. */
export const VENTANA = 3;

/**
 * El listón de la meseta. No es un punto de corte de la escala —no existe tal
 * cosa validada— sino dónde ponemos NOSOTROS el aviso: por encima del centro
 * de un 1-7, con margen.
 */
export const SUELO_MESETA = 5;

/** Cuánto puede moverse la ventana y seguir llamándose meseta. */
export const MARGEN_MESETA = 1;

export type Medida = {
  week: Date;
  i1: number;
  i2: number;
  i3: number;
  i4: number;
};

/** La puntuación del SRBAI es la media de sus cuatro ítems. */
export function puntuacion(m: Medida): number {
  return (m.i1 + m.i2 + m.i3 + m.i4) / 4;
}

export type Sugerencia =
  | { tipo: "pronto"; faltan: number }
  | { tipo: "faltan-medidas"; faltan: number }
  | { tipo: "creciendo"; media: number }
  | { tipo: "meseta-baja"; media: number }
  | { tipo: "sugerir"; media: number; semanas: number };

/**
 * Si la curva se ha aplanado arriba, sugiere dar el hábito por interiorizado.
 *
 * `medidas` viene ordenada de la más vieja a la más reciente. `diasDeVida` son
 * los días desde que se creó el hábito.
 *
 * Los cinco resultados son distintos a propósito: «aún no hay datos» y «los
 * datos dicen que no» son cosas diferentes y la interfaz debe poder decirlas
 * de forma diferente.
 */
export function sugerirInteriorizado(
  medidas: Medida[],
  diasDeVida: number,
): Sugerencia {
  if (diasDeVida < MIN_DIAS) {
    return { tipo: "pronto", faltan: MIN_DIAS - diasDeVida };
  }
  if (medidas.length < MEDIDAS_MINIMAS) {
    return { tipo: "faltan-medidas", faltan: MEDIDAS_MINIMAS - medidas.length };
  }

  // La meseta se mide sobre las ÚLTIMAS, no sobre el mejor momento: si hubo
  // una recaída, la sugerencia tiene que retirarse sola.
  const ventana = medidas.slice(-VENTANA).map(puntuacion);
  const media = ventana.reduce((a, b) => a + b, 0) / ventana.length;
  const recorrido = Math.max(...ventana) - Math.min(...ventana);

  if (recorrido > MARGEN_MESETA) return { tipo: "creciendo", media };
  if (media < SUELO_MESETA) return { tipo: "meseta-baja", media };
  return { tipo: "sugerir", media, semanas: medidas.length };
}

// ─── contra la base ────────────────────────────────────────────────────────

/** El estado del SRBAI para un hábito: qué sugiere y si toca preguntar. */
export type EstadoSrbai = {
  habitId: string;
  sugerencia: Sugerencia;
  /** Falso si ya contestaste esta semana, o si el hábito es demasiado joven. */
  tocaPreguntar: boolean;
  medidas: number;
};

/**
 * Estado del SRBAI de todos los hábitos, de una consulta.
 *
 * Una por tabla y agrupación en memoria, como `listProjects`: pedir las medidas
 * por hábito sería un N+1 sobre una tabla que crece una fila por semana.
 */
export async function estadoSrbai(
  db: Db,
  hoy: Date = dayKey(),
): Promise<Map<string, EstadoSrbai>> {
  const [filas, medidas] = await Promise.all([
    db.select({ id: habits.id, createdAt: habits.createdAt }).from(habits),
    db
      .select()
      .from(habitAutomaticity)
      .orderBy(asc(habitAutomaticity.week)),
  ]);

  const porHabito = new Map<string, Medida[]>();
  for (const m of medidas) {
    const lista = porHabito.get(m.habitId);
    if (lista) lista.push(m);
    else porHabito.set(m.habitId, [m]);
  }

  const lunes = startOfWeek(hoy).getTime();
  const salida = new Map<string, EstadoSrbai>();
  for (const h of filas) {
    const suyas = porHabito.get(h.id) ?? [];
    const dias = daysSince(h.createdAt, hoy);
    salida.set(h.id, {
      habitId: h.id,
      sugerencia: sugerirInteriorizado(suyas, dias),
      // Una vez por semana y no más: repetir el mismo día falsearía la curva.
      tocaPreguntar:
        dias >= MIN_DIAS && !suyas.some((m) => m.week.getTime() === lunes),
      medidas: suyas.length,
    });
  }
  return salida;
}

/**
 * Guarda la medida de ESTA semana. Vuelve a escribir si ya había una.
 *
 * Se permite corregir dentro de la misma semana —contestar mal y rehacerlo es
 * normal— pero no acumular dos medidas de la misma, que es lo que inflaría el
 * número de semanas y adelantaría la sugerencia sin que nada haya cambiado.
 */
export async function guardarMedida(
  db: Db,
  habitId: string,
  respuestas: [number, number, number, number],
  hoy: Date = dayKey(),
): Promise<void> {
  for (const r of respuestas) {
    if (!Number.isInteger(r) || r < 1 || r > 7) {
      throw new Error(`Respuesta fuera de la escala 1-7: ${r}`);
    }
  }
  const week = startOfWeek(hoy);
  const [i1, i2, i3, i4] = respuestas;
  const existente = await db
    .select({ id: habitAutomaticity.id })
    .from(habitAutomaticity)
    .where(
      and(
        eq(habitAutomaticity.habitId, habitId),
        eq(habitAutomaticity.week, week),
      ),
    )
    .limit(1);

  if (existente.length > 0) {
    await db
      .update(habitAutomaticity)
      .set({ i1, i2, i3, i4 })
      .where(eq(habitAutomaticity.id, existente[0].id));
    return;
  }
  await db.insert(habitAutomaticity).values({
    id: crypto.randomUUID(),
    habitId,
    week,
    i1,
    i2,
    i3,
    i4,
    createdAt: new Date(),
  });
}
