"use client";

import { useSyncExternalStore } from "react";
import { isMuted, setMuted, playClick } from "@/lib/sound";
import { on } from "@/lib/events";

// El ajuste vive en localStorage (sistema externo), así que se lee con
// useSyncExternalStore: sin efecto de arranque y sin parpadeo del icono.
const subscribe = (onChange: () => void) => on("untap:muteChange", onChange);
const mutedOnServer = () => true;

export function SoundToggle() {
  const muted = useSyncExternalStore(subscribe, isMuted, mutedOnServer);

  function toggle() {
    const next = !muted;
    setMuted(next);
    // Feedback al desmutear: el gesto del click también desbloquea el audio.
    if (!next) window.setTimeout(() => playClick(), 30);
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
      aria-pressed={!muted}
    >
      <span className="text-base">{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
