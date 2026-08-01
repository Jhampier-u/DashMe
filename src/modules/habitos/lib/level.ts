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
  /** El SALDO: lo que queda por gastar. Sube y baja. */
  xp: number;
  /** Lo GANADO desde el principio. De aquí sale el nivel, y nunca baja. */
  ganado: number;
  /** Lo que se ha ido en la tienda. */
  gastado: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
};

/**
 * Lo que hace falta saber del jugador para situarlo en la curva.
 *
 * Recibe el objeto y no un número suelto A PROPÓSITO. Con un número, cualquier
 * sitio podía pasar `player.xp` —el saldo— y el nivel bajaría al comprar en la
 * tienda: gastar te degradaría, que es justo lo contrario de una recompensa.
 * Pidiendo los dos campos, el compilador obliga a decidir en cada sitio.
 */
export type XpDelJugador = { xp: number; xpSpent: number };

export function getLevelInfo(player: XpDelJugador): LevelInfo {
  const saldo = Math.max(0, player.xp);
  const gastado = Math.max(0, player.xpSpent);
  // El nivel sale de lo ganado, que es saldo más gastado y solo sube.
  const ganado = saldo + gastado;
  const level = levelFromXp(ganado);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - base;
  const xpIntoLevel = ganado - base;
  return {
    level,
    xp: saldo,
    ganado,
    gastado,
    xpIntoLevel,
    xpForNextLevel: span,
    progress: span === 0 ? 0 : xpIntoLevel / span,
  };
}
