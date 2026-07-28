"use client";

import { useSyncExternalStore } from "react";
import { isMuted, setMuted, playClick } from "@/modules/habitos/lib/sound";
import { on } from "@/modules/habitos/lib/events";

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
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 7,
        background: "transparent",
        border: "1px solid var(--m-line)",
        color: "var(--m-ink-2)",
        fontSize: 13,
        cursor: "pointer",
      }}
      title={muted ? "Activar sonidos" : "Silenciar"}
      aria-label={muted ? "Activar sonidos" : "Silenciar sonidos"}
      aria-pressed={!muted}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
