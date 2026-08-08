/*
  La fauna del jardín: lo que hiciste ese día y no es un hábito.

  Las plantas son los hábitos. Los pájaros son la música y las mariposas las
  tareas cerradas.

  QUÉ NO ES ESTO, porque se confunde fácil: no afirma ninguna relación entre la
  música y los hábitos. Esa pregunta ya tiene su sitio —`compararGrupos`, en la
  portada— y su regla de negarse a contestar con pocos datos. Un pájaro no dice
  que escuchar te ayude a cumplir; dice que ese día escuchaste.

  Todo esto es puro: recibe números y devuelve números.
*/

/** Lo que se sabe de un día que no venga de los hábitos. */
export type DiaDeFauna = {
  /** `getTime()` de la clave de día. */
  dia: number;
  minutos: number;
  tareas: number;
};

export type Fauna = { pajaros: number; mariposas: number };

/**
 * Los tramos de los pájaros, por minutos escuchados.
 *
 * Tramos y no una división: con «un pájaro por cada 30 minutos» una tarde larga
 * llenaría el cielo, y la diferencia entre nueve y diez pájaros no la ve nadie.
 * Cuatro estados se distinguen; veinte no.
 */
const TRAMOS: { hasta: number; pajaros: number }[] = [
  { hasta: 30, pajaros: 1 },
  { hasta: 90, pajaros: 2 },
  { hasta: 180, pajaros: 3 },
];

export const MAX_PAJAROS = 4;
export const MAX_MARIPOSAS = 5;

/**
 * Cuántos pájaros para esos minutos.
 *
 * Cero minutos son CERO pájaros, y eso es deliberado: un día sin música no se
 * rellena con un pájaro suelto para que el cielo no parezca vacío. Si el día
 * estuvo vacío, la escena lo dice.
 */
export function pajarosPara(minutos: number): number {
  if (!Number.isFinite(minutos) || minutos <= 0) return 0;
  for (const t of TRAMOS) {
    if (minutos < t.hasta) return t.pajaros;
  }
  return MAX_PAJAROS;
}

/** Una mariposa por tarea cerrada, con techo: veinte mariposas tapan el jardín. */
export function mariposasPara(tareas: number): number {
  if (!Number.isFinite(tareas) || tareas <= 0) return 0;
  return Math.min(MAX_MARIPOSAS, Math.floor(tareas));
}

/** La fauna de un día. Un día del que no se sabe nada no tiene ninguna. */
export function faunaEn(dias: DiaDeFauna[], dia: Date): Fauna {
  const t = dia.getTime();
  const encontrado = dias.find((d) => d.dia === t);
  if (!encontrado) return { pajaros: 0, mariposas: 0 };
  return {
    pajaros: pajarosPara(encontrado.minutos),
    mariposas: mariposasPara(encontrado.tareas),
  };
}

/**
 * Si la fuente de música ha traído algo en todo el tramo.
 *
 * Sirve para distinguir «ese día no escuchaste» de «no lo sé». Si no hay ni un
 * minuto en semanas de historial, lo que falla es la conexión con Spotify, no tu
 * semana — y pintar cero pájaros en silencio afirmaría lo segundo.
 */
export function haySeñalDeMusica(dias: DiaDeFauna[]): boolean {
  return dias.some((d) => d.minutos > 0);
}

/** Lo que hiciste ese día, en una frase. Es lo que se lee cuando no se ven los bichos. */
export function fraseDeFauna(
  dias: DiaDeFauna[],
  dia: Date,
  sinSeñal = false,
): string {
  const d = dias.find((x) => x.dia === dia.getTime());
  const minutos = d?.minutos ?? 0;
  const tareas = d?.tareas ?? 0;

  const partes: string[] = [];
  if (minutos > 0) partes.push(`${Math.round(minutos)} min de música`);
  if (tareas > 0) {
    partes.push(tareas === 1 ? "1 tarea cerrada" : `${tareas} tareas cerradas`);
  }
  /*
    «Registradas», no «hubo». Es una afirmación sobre el REGISTRO, no sobre tu
    día, y es lo único que el dashboard puede saber.

    Skog et al. (InfoVis 2003) rompían su plantilla artística a propósito
    —cuadrados en negro— cuando el servidor caía, para que se notara. Aquí el
    equivalente es no dejar que «cero pájaros» signifique dos cosas distintas:
    «no escuchaste» y «no tengo datos» se veían idénticos.
  */
  if (partes.length === 0) {
    return sinSeñal
      ? "Sin datos de música. Puede que Spotify no esté conectado."
      : "Sin música ni tareas registradas.";
  }
  return partes.join(" · ");
}

/** Un día de escuchas tal y como lo da el módulo de música. */
export type EscuchasDeUnDia = { dia: number; ms: number };

/**
 * Junta las escuchas y las tareas en un día por fila.
 *
 * Vive aquí y no en una consulta A PROPÓSITO. La música y los hábitos son dos
 * módulos que no se conocen —y no deben: lo dice el comentario de la portada,
 * donde se compone el otro cruce—. Lo que cruza la frontera es esta función,
 * que no sabe de dónde salen los números.
 */
export function mezclarFauna(
  escuchas: EscuchasDeUnDia[],
  diasConTarea: number[],
): DiaDeFauna[] {
  const porDia = new Map<number, DiaDeFauna>();
  const slot = (t: number): DiaDeFauna => {
    const ya = porDia.get(t);
    if (ya) return ya;
    const nuevo = { dia: t, minutos: 0, tareas: 0 };
    porDia.set(t, nuevo);
    return nuevo;
  };

  for (const e of escuchas) slot(e.dia).minutos += Math.max(0, e.ms) / 60_000;
  for (const t of diasConTarea) slot(t).tareas += 1;

  return [...porDia.values()].sort((a, b) => a.dia - b.dia);
}
