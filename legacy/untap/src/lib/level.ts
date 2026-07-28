// Untap level curve.
// Each level requires progressively more XP. Cumulative XP needed for level N:
//   xpForLevel(N) = 100 * N * (N - 1) / 2  (i.e. 0, 100, 300, 600, 1000, 1500, ...)

export const XP_PER_HABIT = 25;
export const XP_PER_TASK = 15;
/** Extra por cumplir el hábito ancla (solo en su versión completa). */
export const ANCHOR_BONUS = 10;

export const MAX_SHIELDS = 2;
export const SHIELD_REGEN_DAYS = 15;

export const STREAK_MILESTONES: { days: number; bonus: number }[] = [
  { days: 7, bonus: 50 },
  { days: 14, bonus: 100 },
  { days: 30, bonus: 250 },
  { days: 60, bonus: 500 },
  { days: 100, bonus: 1000 },
];

export function milestoneFor(days: number) {
  return STREAK_MILESTONES.find((m) => m.days === days) ?? null;
}

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (100 * level * (level - 1)) / 2;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export type LevelInfo = {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
};

export function getLevelInfo(xp: number): LevelInfo {
  const safeXp = Math.max(0, xp);
  const level = levelFromXp(safeXp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - base;
  const xpIntoLevel = safeXp - base;
  return {
    level,
    xp: safeXp,
    xpIntoLevel,
    xpForNextLevel: span,
    progress: span === 0 ? 0 : xpIntoLevel / span,
  };
}
