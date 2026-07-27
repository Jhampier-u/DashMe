"use client";

import { useEffect, useState } from "react";
import { on } from "@/lib/events";

type Toast =
  | { kind: "levelup"; key: number; level: number }
  | { kind: "milestone"; key: number; habit: string; days: number; bonus: number }
  | { kind: "shield"; key: number }
  | { kind: "quest"; key: number; label: string; xp: number; emoji: string }
  | { kind: "anchor"; key: number };

// Omit sobre una unión hay que distribuirlo a mano, si no colapsa a las
// propiedades comunes y no deja construir ninguna variante.
type NewToast = Toast extends infer T
  ? T extends Toast
    ? Omit<T, "key">
    : never
  : never;

let nextKey = 0;

// La animación y el tiempo en pantalla deben coincidir: antes el pop-in duraba
// 2200ms sin `forwards`, así que el toast se desvanecía y volvía a aparecer
// durante los 1300ms que le quedaban de vida.
const SHORT_MS = 2200;
const LONG_MS = 3500;

export function AchievementToast() {
  const [queue, setQueue] = useState<Toast[]>([]);

  useEffect(() => {
    const push = (t: NewToast) =>
      setQueue((q) => [...q, { ...t, key: ++nextKey } as Toast]);

    const offs = [
      on("untap:levelup", (d) => push({ kind: "levelup", level: d.level })),
      on("untap:milestone", (d) =>
        push({ kind: "milestone", habit: d.habit, days: d.days, bonus: d.bonus }),
      ),
      on("untap:shield", () => push({ kind: "shield" })),
      on("untap:anchor", () => push({ kind: "anchor" })),
      on("untap:quest", (d) =>
        push({ kind: "quest", label: d.label, xp: d.xp, emoji: d.emoji }),
      ),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const top = queue[0];
  const duration =
    top?.kind === "shield" || top?.kind === "anchor" ? SHORT_MS : LONG_MS;

  useEffect(() => {
    if (!top) return;
    const t = window.setTimeout(() => setQueue((q) => q.slice(1)), duration);
    return () => window.clearTimeout(t);
    // Solo el toast visible marca el reloj: si llegan más mientras tanto,
    // esperan su turno sin reiniciar el temporizador del actual.
  }, [top, duration]);

  if (!top) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none flex items-center justify-center z-50"
      aria-live="polite"
    >
      <div
        key={top.key}
        className="pixel-window untap-popin"
        style={{
          minWidth: "20rem",
          textAlign: "center",
          background: "var(--color-bg)",
          animationDuration: `${duration}ms`,
        }}
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
              Bonus extra · tu pilar del día
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
    </div>
  );
}
