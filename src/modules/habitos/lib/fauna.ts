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
