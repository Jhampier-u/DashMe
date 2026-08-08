import { previousScheduledDay } from "./streak";
import type { Calendario } from "./calendario";
import { XP_PER_HABIT } from "./level";

/*
  Volver después de fallar.

  De todo el estudio del sector, esta es la mecánica con mejor respaldo: el
  megaestudio de Milkman et al. (Nature, dic 2021) probó 54 intervenciones sobre
  61.293 personas, y **la ganadora ofrecía micro-recompensas por volver al
  gimnasio tras una sesión perdida**.

  Nótese qué NO es: no es «dejar de castigar». Es premiar activamente el regreso.
  El resto del jardín ya tiene el castigo —la racha a cero, la planta marchita—;
  esto es lo único que mira hacia el otro lado.
*/

/**
 * El bonus por volver.
 *
 * EL NÚMERO NO ES ARBITRARIO Y NO SE PUEDE SUBIR SIN PENSAR. Tiene que ser menor
 * que lo que da el modo mínimo —`XP_PER_HABIT / 2`, o sea 12— para que fallar
 * nunca salga a cuenta:
 *
 *   · cumplir dos días seguidos en modo mínimo ... 12 + 12 = 24
 *   · fallar uno y volver al día siguiente ......  0 + 12 + 10 = 22
 *
 * Con un bonus de 15 el segundo caso daría 27 y **fallar pagaría mejor que
 * cumplir a medias**. `regreso.test.ts` lo comprueba con los valores reales, así
 * que si alguien sube esta constante, el test lo para.
 */
export const XP_REGRESO = 10;

/** El techo que no se puede pasar, escrito para que el test pueda afirmarlo. */
export const TECHO_REGRESO = Math.floor(XP_PER_HABIT / 2);

/**
 * ¿Este día es una vuelta tras haber fallado?
 *
 * Lo es cuando se cumplen tres cosas a la vez:
 *   1. ya se había cumplido alguna vez antes —si no, es el primer día del
 *      hábito, y estrenar no es volver—;
 *   2. hay un día programado anterior;
 *   3. ese día anterior NO se cumplió.
 *
 * Los días en pausa y los que no toca no cuentan como fallo: no aparecen como
 * «día programado anterior», que es la misma puerta por la que ya entran en el
 * resto del módulo. Y un día salvado por un escudo cuenta como cumplido, así que
 * tampoco dispara el regreso — el escudo ya hizo su trabajo.
 */
export function esRegreso(
  calendario: Calendario,
  cumplidos: Set<number>,
  dia: Date,
): boolean {
  const t = dia.getTime();

  let huboAlgunoAntes = false;
  for (const c of cumplidos) {
    if (c < t) {
      huboAlgunoAntes = true;
      break;
    }
  }
  if (!huboAlgunoAntes) return false;

  const anterior = previousScheduledDay(calendario, dia);
  if (anterior === null) return false;

  return !cumplidos.has(anterior.getTime());
}
