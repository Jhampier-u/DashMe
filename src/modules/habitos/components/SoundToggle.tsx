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
      className={
        "w-[30px] h-[30px] inline-flex items-center justify-center " +
        "rounded-control border-3 border-line bg-paper text-tinta text-[13px] " +
        "cursor-pointer shadow-hard font-cuerpo " +
        "transition-[transform,box-shadow] duration-75 ease-out " +
        "active:translate-x-0.5 active:translate-y-0.5 " +
        "active:shadow-[2px_2px_0_var(--color-line)] " +
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line"
      }
      title={muted ? "Activar sonidos" : "Silenciar"}
      aria-label={muted ? "Activar sonidos" : "Silenciar sonidos"}
      aria-pressed={!muted}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
