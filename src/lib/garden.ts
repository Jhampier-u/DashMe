export type PlantSpecies = "flower" | "tree" | "mushroom" | "cactus" | "herb";

export const PLANT_SPECIES: { key: PlantSpecies; label: string; sample: string }[] = [
  { key: "flower", label: "Flor", sample: "🌻" },
  { key: "tree", label: "Árbol", sample: "🌳" },
  { key: "mushroom", label: "Hongo", sample: "🍄" },
  { key: "cactus", label: "Cactus", sample: "🌵" },
  { key: "herb", label: "Hierba", sample: "🌾" },
];

// Stage 0 (just planted) uses a small sprout that grows visually thanks to size scaling.
// Done-today vs not-done is conveyed via opacity in the renderer.
const STAGES: Record<PlantSpecies, string[]> = {
  flower:   ["🌱", "🌿", "🌷", "🌻", "💐"],
  tree:     ["🌱", "🪴", "🌳", "🌲", "🎄"],
  mushroom: ["🌱", "🍄", "🍄", "🍄", "🍄"],
  cactus:   ["🌱", "🌵", "🌵", "🌵", "🌵"],
  herb:     ["🌱", "🌿", "🌾", "🌾", "🌾"],
};

const WILTED = "🥀";

export function stageFor(streak: number): 0 | 1 | 2 | 3 | 4 {
  if (streak >= 14) return 4;
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}

/**
 * Una planta está marchita si hoy no se ha cumplido, la racha está a cero y el
 * hábito se cumplió alguna vez. Ese último requisito es lo que separa la planta
 * marchita de la semilla que nunca ha brotado.
 *
 * La regla estaba escrita tres veces —aquí dentro de `plantEmoji`, en la escena
 * y en la página del Jardín— y las tres copias tenían que decidir lo mismo. La
 * etiqueta del cartel se olvidó de consultarla y llamaba «Semilla» a una planta
 * que se pintaba 🥀.
 */
export function isPlantWilted(
  streak: number,
  doneToday: boolean,
  hasEverBeenDone: boolean,
): boolean {
  return !doneToday && streak === 0 && hasEverBeenDone;
}

// Choose plant emoji given habit state.
// - If today is done: alive at stageFor(streak)
// - If today not done AND has any streak: still alive at last stage (will reset tomorrow)
// - If today not done AND streak is 0 AND habit has at least 1 historical log: wilted
// - Otherwise: seed
export function plantEmoji(
  species: PlantSpecies,
  streak: number,
  doneToday: boolean,
  hasEverBeenDone: boolean,
): string {
  const set = STAGES[species] ?? STAGES.flower;
  if (isPlantWilted(streak, doneToday, hasEverBeenDone)) return WILTED;
  return set[stageFor(streak)];
}

export function stageLabel(stage: number): string {
  switch (stage) {
    case 0: return "Semilla";
    case 1: return "Brote";
    case 2: return "Joven";
    case 3: return "Madura";
    case 4: return "Floreciente";
    default: return "";
  }
}

/**
 * Lo que dice el cartel de la planta. «Marchita» gana a la etapa: si la planta
 * se pinta 🥀, llamarla «Semilla» contradice lo que se ve.
 */
export function plantStateLabel(
  streak: number,
  doneToday: boolean,
  hasEverBeenDone: boolean,
): string {
  return isPlantWilted(streak, doneToday, hasEverBeenDone)
    ? "Marchita"
    : stageLabel(stageFor(streak));
}
