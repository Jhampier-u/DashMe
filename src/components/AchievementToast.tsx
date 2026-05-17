"use client";

import { useEffect, useState } from "react";

type Toast =
  | { kind: "levelup"; key: number; level: number }
  | { kind: "milestone"; key: number; habit: string; days: number; bonus: number }
  | { kind: "shield"; key: number }
  | { kind: "quest"; key: number; label: string; xp: number; emoji: string }
  | { kind: "anchor"; key: number };

let nextKey = 0;

export function AchievementToast() {
  const [queue, setQueue] = useState<Toast[]>([]);

  useEffect(() => {
    function onLevel(e: Event) {
      const d = (e as CustomEvent<{ newLevel: number }>).detail;
      setQueue((q) => [...q, { kind: "levelup", key: ++nextKey, level: d.newLevel }]);
    }
    function onMilestone(e: Event) {
      const d = (e as CustomEvent<{ habit: string; days: number; bonus: number }>).detail;
      setQueue((q) => [
        ...q,
        { kind: "milestone", key: ++nextKey, habit: d.habit, days: d.days, bonus: d.bonus },
      ]);
    }
    function onShield() {
      setQueue((q) => [...q, { kind: "shield", key: ++nextKey }]);
    }
    function onQuest(e: Event) {
      const d = (e as CustomEvent<{ label: string; xp: number; emoji: string }>).detail;
      setQueue((q) => [
        ...q,
        { kind: "quest", key: ++nextKey, label: d.label, xp: d.xp, emoji: d.emoji },
      ]);
    }
    function onAnchor() {
      setQueue((q) => [...q, { kind: "anchor", key: ++nextKey }]);
    }
    window.addEventListener("untap:levelup", onLevel);
    window.addEventListener("untap:milestone", onMilestone);
    window.addEventListener("untap:shield", onShield);
    window.addEventListener("untap:questComplete", onQuest);
    window.addEventListener("untap:anchor", onAnchor);
    return () => {
      window.removeEventListener("untap:levelup", onLevel);
      window.removeEventListener("untap:milestone", onMilestone);
      window.removeEventListener("untap:shield", onShield);
      window.removeEventListener("untap:questComplete", onQuest);
      window.removeEventListener("untap:anchor", onAnchor);
    };
  }, []);

  useEffect(() => {
    if (queue.length === 0) return;
    const k = queue[0].kind;
    const duration = k === "shield" || k === "anchor" ? 2200 : 3500;
    const t = window.setTimeout(() => setQueue((q) => q.slice(1)), duration);
    return () => window.clearTimeout(t);
  }, [queue]);

  const top = queue[0];
  if (!top) return null;

  return (
    <div
      key={top.key}
      className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
      aria-live="polite"
    >
      <div
        className="pixel-window animate-untap-popin"
        style={{ minWidth: "20rem", textAlign: "center", background: "var(--color-bg)" }}
      >
        {top.kind === "levelup" ? (
          <>
            <div className="font-display text-[0.7rem] tracking-widest text-[var(--color-peach)] mb-3">
              ¡SUBISTE DE NIVEL!
            </div>
            <div className="text-6xl mb-2">🎉</div>
            <div className="font-display text-2xl text-[var(--color-mint)]">
              Nv. {top.level}
            </div>
          </>
        ) : top.kind === "milestone" ? (
          <>
            <div className="font-display text-[0.7rem] tracking-widest text-[var(--color-peach)] mb-3">
              ¡RACHA DE {top.days} DÍAS!
            </div>
            <div className="text-6xl mb-2">🔥</div>
            <div className="font-display text-base text-[var(--color-mint)] mb-2">
              {top.habit}
            </div>
            <div className="text-lg text-[var(--color-ink)]">+{top.bonus} XP bonus</div>
          </>
        ) : top.kind === "shield" ? (
          <>
            <div className="font-display text-[0.7rem] tracking-widest text-[var(--color-sky)] mb-3">
              ESCUDO USADO
            </div>
            <div className="text-6xl mb-2">🛡️</div>
            <div className="text-lg text-[var(--color-ink)]">
              Tu racha está a salvo
            </div>
          </>
        ) : top.kind === "anchor" ? (
          <>
            <div className="font-display text-[0.7rem] tracking-widest text-[var(--color-peach)] mb-3">
              ¡HÁBITO ANCLA COMPLETO!
            </div>
            <div className="text-6xl mb-2">👑</div>
            <div className="text-lg text-[var(--color-ink)]">
              +10 XP bonus · tu pilar del día
            </div>
          </>
        ) : (
          <>
            <div className="font-display text-[0.7rem] tracking-widest text-[var(--color-peach)] mb-3">
              ¡MISIÓN COMPLETA!
            </div>
            <div className="text-6xl mb-2">{top.emoji}</div>
            <div className="font-display text-base text-[var(--color-mint)] mb-2">
              {top.label}
            </div>
            <div className="text-lg text-[var(--color-ink)]">+{top.xp} XP</div>
          </>
        )}
      </div>
      <style>{`
        @keyframes untap-popin {
          0% { transform: scale(0.6); opacity: 0; }
          15% { transform: scale(1.08); opacity: 1; }
          30% { transform: scale(1); }
          85% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0; }
        }
        .animate-untap-popin { animation: untap-popin 2200ms steps(20, jump-end); }
      `}</style>
    </div>
  );
}
