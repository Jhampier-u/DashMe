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
  if (!doneToday && streak === 0 && hasEverBeenDone) return WILTED;
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
