import { MS_PER_DAY, normalizeDayKey } from "./day";
import { startOfWeek } from "./flow";

/*
  La fauna del jardín: las tareas que cerraste ese día, en mariposas.

  Las plantas son los hábitos. Las mariposas son las tareas.

  ANTES HABÍA TAMBIÉN PÁJAROS, por los minutos de música escuchada, y se han
  quitado enteros: el módulo de música vive aparte y no se cruza con el resto del
  dashboard. Esta parte ya no sabe que Spotify existe.

  Todo esto es puro: recibe números y devuelve números.
*/

/** Lo que se sabe de un día que no venga de los hábitos. */
export type DiaDeFauna = {
  /** `getTime()` de la clave de día. */
  dia: number;
  tareas: number;
};

export type Fauna = { mariposas: number };

export const MAX_MARIPOSAS = 5;

/** Una mariposa por tarea cerrada, con techo: veinte mariposas tapan el jardín. */
export function mariposasPara(tareas: number): number {
  if (!Number.isFinite(tareas) || tareas <= 0) return 0;
  return Math.min(MAX_MARIPOSAS, Math.floor(tareas));
}

/** La fauna de un día. Un día del que no se sabe nada no tiene ninguna. */
export function faunaEn(dias: DiaDeFauna[], dia: Date): Fauna {
  const encontrado = dias.find((d) => d.dia === dia.getTime());
  return { mariposas: mariposasPara(encontrado?.tareas ?? 0) };
}

/**
 * Lo que cerraste ese día, en una frase.
 *
 * Habla del REGISTRO y no de tu día —«registradas»—, que es lo único que el
 * dashboard puede saber.
 */
export function fraseDeFauna(dias: DiaDeFauna[], dia: Date): string {
  const tareas = dias.find((x) => x.dia === dia.getTime())?.tareas ?? 0;
  if (tareas === 0) return "Sin tareas cerradas registradas.";
  return tareas === 1 ? "1 tarea cerrada" : `${tareas} tareas cerradas`;
}

/**
 * Agrupa las tareas cerradas por día.
 *
 * Recibe claves de día en bruto —una por tarea— porque quien las cuenta debe ser
 * una función pura y no una consulta.
 */
export function mezclarFauna(diasConTarea: number[]): DiaDeFauna[] {
  const porDia = new Map<number, number>();
  for (const t of diasConTarea) porDia.set(t, (porDia.get(t) ?? 0) + 1);
  return [...porDia.entries()]
    .map(([dia, tareas]) => ({ dia, tareas }))
    .sort((a, b) => a.dia - b.dia);
}

/*
  LA MEMORIA, DE UBIFIT GARDEN (Consolvo et al., CHI 2008).

  Mariposa grande, la semana en curso; pequeñas, las tres anteriores. Un mes de
  historia dentro de la misma escena y sin ejes.

  El reinicio semanal es lo que la hace amable: una mala semana no arrastra,
  porque el lunes el recuento grande vuelve a cero y lo de antes se encoge. En
  el estudio lo dijeron así — «veía la mariposa y pensaba: lo conseguí la
  semana pasada, puedes hacerlo otra vez».

  El techo pequeño es una decisión de dibujo y no una afirmación sobre ti: tres
  semanas pasadas no deben tapar la semana que estás viviendo.
*/

/** Cuántas semanas se recuerdan. Con las de UbiFit: tres. */
export const SEMANAS_DE_MEMORIA = 3;

/** Techo de las pequeñas. Por debajo de MAX_MARIPOSAS a propósito. */
export const MAX_MARIPOSAS_MEMORIA = 3;

export type SemanaRecordada = {
  /** `getTime()` del lunes de esa semana. */
  lunes: number;
  tareas: number;
  mariposas: number;
};

/**
 * Las tres semanas ANTERIORES a la del día que miras, de la más vieja a la más
 * reciente.
 *
 * Relativa al día y no a hoy: así el timelapse del jardín enseña también la
 * memoria que había entonces, en vez de pegar la de esta semana sobre una
 * escena de hace un mes.
 *
 * Una semana sin nada se devuelve vacía y no se salta. Saltarla haría que tres
 * mariposas seguidas pudieran ser semanas no consecutivas, y la memoria
 * mentiría sobre el hueco.
 */
export function memoriaDeFauna(
  dias: DiaDeFauna[],
  dia: Date,
): SemanaRecordada[] {
  const lunesActual = startOfWeek(normalizeDayKey(dia)).getTime();
  const salida: SemanaRecordada[] = [];
  for (let k = SEMANAS_DE_MEMORIA; k >= 1; k--) {
    const lunes = lunesActual - k * 7 * MS_PER_DAY;
    const fin = lunes + 7 * MS_PER_DAY;
    let tareas = 0;
    for (const d of dias) if (d.dia >= lunes && d.dia < fin) tareas += d.tareas;
    salida.push({
      lunes,
      tareas,
      mariposas: Math.min(MAX_MARIPOSAS_MEMORIA, Math.max(0, Math.floor(tareas))),
    });
  }
  return salida;
}

/** Cómo se dice la franja entera. Toda vacía, no se dice nada. */
export function fraseDeMemoria(
  memoria: SemanaRecordada[],
  actual: SemanaRecordada,
): string | null {
  if (actual.tareas === 0 && memoria.every((s) => s.tareas === 0)) return null;
  const di = (n: number) => (n === 1 ? "1 tarea" : n + " tareas");
  const antes = memoria.map((s, i) =>
    i === memoria.length - 1
      ? `la semana pasada, ${di(s.tareas)}`
      : `hace ${memoria.length - i} semanas, ${di(s.tareas)}`,
  );
  return `Esta semana, ${di(actual.tareas)}. Antes: ${antes.join("; ")}.`;
}

/**
 * La semana EN CURSO del día que miras, con el techo grande.
 *
 * Es la mitad que le faltaba a la memoria. Las mariposas que revolotean son de
 * ese DÍA, y contra un día no se puede contrastar un mes: sin una semana en
 * curso al lado, las tres pequeñas hablaban de semanas sin tener a qué
 * compararse, que es justo el mecanismo que hace funcionar el de UbiFit.
 *
 * El reinicio del lunes sale solo de contar por semana: lo de antes se encoge
 * y esto vuelve a cero.
 */
export function semanaDeFauna(dias: DiaDeFauna[], dia: Date): SemanaRecordada {
  const lunes = startOfWeek(normalizeDayKey(dia)).getTime();
  const fin = lunes + 7 * MS_PER_DAY;
  let tareas = 0;
  for (const d of dias) if (d.dia >= lunes && d.dia < fin) tareas += d.tareas;
  return { lunes, tareas, mariposas: mariposasPara(tareas) };
}
