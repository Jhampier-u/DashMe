"use client";

import { useEffect, useState } from "react";

type LevelUpDetail = { newLevel: number };

export function LevelUpToast() {
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<LevelUpDetail>).detail;
      setLevel(detail.newLevel);
      window.setTimeout(() => setLevel(null), 3500);
    }
    window.addEventListener("untap:levelup", handler);
    return () => window.removeEventListener("untap:levelup", handler);
  }, []);

  if (level === null) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
      aria-live="polite"
    >
      <div
        className="pixel-window animate-untap-popin"
        style={{
          minWidth: "20rem",
          textAlign: "center",
          background: "var(--color-bg)",
        }}
      >
        <div className="font-display text-[0.7rem] tracking-widest text-[var(--color-peach)] mb-3">
          ¡SUBISTE DE NIVEL!
        </div>
        <div className="text-6xl mb-2">🎉</div>
        <div className="font-display text-2xl text-[var(--color-mint)]">
          Nv. {level}
        </div>
      </div>
      <style>{`
        @keyframes untap-popin {
          0% { transform: scale(0.6); opacity: 0; }
          15% { transform: scale(1.08); opacity: 1; }
          30% { transform: scale(1); }
          85% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        .animate-untap-popin {
          animation: untap-popin 3500ms steps(20, jump-end);
        }
      `}</style>
    </div>
  );
}
