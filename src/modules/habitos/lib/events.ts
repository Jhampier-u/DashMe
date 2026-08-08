// Bus de eventos del cliente.
//
// El estado de jugador (XP, nivel, escudos) se propaga desde las Server
// Actions a los componentes que lo pintan sin pasar por props. Antes cada
// componente construía sus propios CustomEvent y redeclaraba la forma del
// `detail`, así que era fácil que uno se quedara desactualizado — de hecho
// PlayerStatus pintaba "120/200 para Nv. 3" con números congelados porque
// nadie le mandaba `xpIntoLevel`.

import type {
  PlayerSnapshot,
  StatusChangeResult,
  ToggleResult,
} from "@/modules/habitos/actions";
import type { QuestCompletion } from "./quests";

export type XpDetail = {
  player: PlayerSnapshot;
  xpDelta: number;
  partial: boolean;
};

export type LevelUpDetail = { level: number };
export type MilestoneDetail = { habit: string; days: number; bonus: number };

export type UntapEvents = {
  "untap:xp": XpDetail;
  "untap:levelup": LevelUpDetail;
  "untap:milestone": MilestoneDetail;
  "untap:shield": null;
  "untap:anchor": null;
  "untap:quest": QuestCompletion;
  "untap:muteChange": { muted: boolean };
};

export function emit<K extends keyof UntapEvents>(
  name: K,
  detail: UntapEvents[K],
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on<K extends keyof UntapEvents>(
  name: K,
  handler: (detail: UntapEvents[K]) => void,
): () => void {
  const listener = (e: Event) =>
    handler((e as CustomEvent<UntapEvents[K]>).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

function emitPlayer(
  player: PlayerSnapshot,
  xpDelta: number,
  partial: boolean,
  leveledUp: boolean,
) {
  emit("untap:xp", { player, xpDelta, partial });
  if (leveledUp) emit("untap:levelup", { level: player.level });
}

/** Publica todo lo que devuelve un toggle de hábito. */
export function emitToggleResult(result: ToggleResult) {
  emitPlayer(result.player, result.xpDelta, result.partial, result.leveledUp);
  if (result.shieldUsed) emit("untap:shield", null);
  if (result.anchorTriggered) emit("untap:anchor", null);
  if (result.milestone) {
    emit("untap:milestone", {
      habit: result.milestone.habitName,
      days: result.milestone.days,
      bonus: result.milestone.bonus,
    });
  }
  for (const q of result.questsCompleted) emit("untap:quest", q);
}

/** Publica el resultado de completar/descompletar una tarea o subtarea. */
export function emitStatusChange(result: StatusChangeResult) {
  emitPlayer(result.player, result.xpDelta, false, result.leveledUp);
  for (const q of result.questsCompleted) emit("untap:quest", q);
}
