import type { PlantSpecies } from "../garden";
import { ARBOL, ARBOL_MARCHITA } from "./arbol";
import { CACTUS, CACTUS_MARCHITA } from "./cactus";
import { FLOR, FLOR_MARCHITA } from "./flor";
import { HIERBA, HIERBA_MARCHITA } from "./hierba";
import { HONGO, HONGO_MARCHITA } from "./hongo";

/**
 * Los dibujos de cada especie: cinco etapas y el estado marchita.
 *
 * Está escrito como un mapa desde `PlantSpecies` para que **añadir una especie
 * nueva al tipo obligue a dibujarla**: si falta, TypeScript se queja aquí en vez
 * de dejar un hueco que solo se ve en pantalla.
 */
export const SPRITES: Record<
  PlantSpecies,
  { etapas: readonly string[]; marchita: string }
> = {
  flower: { etapas: FLOR, marchita: FLOR_MARCHITA },
  tree: { etapas: ARBOL, marchita: ARBOL_MARCHITA },
  herb: { etapas: HIERBA, marchita: HIERBA_MARCHITA },
  cactus: { etapas: CACTUS, marchita: CACTUS_MARCHITA },
  mushroom: { etapas: HONGO, marchita: HONGO_MARCHITA },
};

/** El dibujo que le toca a una planta según su etapa y si está marchita. */
export function spriteDe(
  species: PlantSpecies,
  etapa: number,
  marchita: boolean,
): string {
  const s = SPRITES[species] ?? SPRITES.flower;
  if (marchita) return s.marchita;
  return s.etapas[Math.min(Math.max(etapa, 0), s.etapas.length - 1)];
}
