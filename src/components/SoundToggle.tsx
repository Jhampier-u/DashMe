"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted, playClick } from "@/lib/sound";

export function SoundToggle() {
  const [muted, setMutedState] = useState(true);

  useEffect(() => {
    setMutedState(isMuted());
    function onChange(e: Event) {
      setMutedState((e as CustomEvent<{ muted: boolean }>).detail.muted);
    }
    window.addEventListener("untap:muteChange", onChange);
    return () => window.removeEventListener("untap:muteChange", onChange);
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) {
      // play feedback when unmuting
      window.setTimeout(() => playClick(), 30);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="pixel-button font-display text-[0.55rem] sm:text-[0.6rem] tracking-wider px-2 sm:px-3 py-2 flex items-center gap-1"
      style={{
        background: muted ? "var(--color-surface)" : "var(--color-mint)",
        color: muted ? "var(--color-ink)" : "var(--color-bg-deep)",
        boxShadow: "0 0 0 3px var(--color-border)",
      }}
      title={muted ? "Activar sonidos 8-bit" : "Silenciar"}
      aria-label={muted ? "Activar sonidos" : "Silenciar sonidos"}
    >
      <span className="text-base">{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
