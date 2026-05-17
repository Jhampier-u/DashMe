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
} from "@/lib/sound";

// Listens to global untap:* events and plays matching sounds.
// Mounted once in root layout.
export function SoundEffects() {
  useEffect(() => {
    function onXp(e: Event) {
      const d = (e as CustomEvent<{ xpDelta?: number; partial?: boolean }>).detail;
      if (!d) return;
      if ((d.xpDelta ?? 0) > 0) {
        if (d.partial) playMinimalChime();
        else playChime();
      } else if ((d.xpDelta ?? 0) < 0) {
        playUndo();
      }
    }
    function onLevel() { playFanfare(); }
    function onMilestone() { playMilestone(); }
    function onShield() { playShield(); }
    function onQuest() { playQuestComplete(); }
    function onAnchor() { playAnchor(); }

    window.addEventListener("untap:xp", onXp);
    window.addEventListener("untap:levelup", onLevel);
    window.addEventListener("untap:milestone", onMilestone);
    window.addEventListener("untap:shield", onShield);
    window.addEventListener("untap:questComplete", onQuest);
    window.addEventListener("untap:anchor", onAnchor);
    return () => {
      window.removeEventListener("untap:xp", onXp);
      window.removeEventListener("untap:levelup", onLevel);
      window.removeEventListener("untap:milestone", onMilestone);
      window.removeEventListener("untap:shield", onShield);
      window.removeEventListener("untap:questComplete", onQuest);
      window.removeEventListener("untap:anchor", onAnchor);
    };
  }, []);

  return null;
}
