"use client";

import { useEffect } from "react";
import {
  playChime,
  playMinimalChime,
  playFanfare,
  playMilestone,
  playShield,
  playQuestComplete,
  playUndo,
  playAnchor,
} from "@/modules/habitos/lib/sound";
import { on } from "@/modules/habitos/lib/events";

// Escucha los eventos untap:* y toca el sonido que toca.
// Se monta una sola vez en el layout raíz.
export function SoundEffects() {
  useEffect(() => {
    const offs = [
      on("untap:xp", ({ xpDelta, partial }) => {
        if (xpDelta > 0) (partial ? playMinimalChime : playChime)();
        else if (xpDelta < 0) playUndo();
      }),
      on("untap:levelup", playFanfare),
      on("untap:milestone", playMilestone),
      on("untap:shield", playShield),
      on("untap:quest", playQuestComplete),
      on("untap:anchor", playAnchor),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  return null;
}
