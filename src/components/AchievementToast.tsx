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
        className="untap-popin"
        style={{
          minWidth: "17rem",
          maxWidth: "22rem",
          textAlign: "center",
          background: "var(--m-surface)",
          border: "1px solid var(--m-line)",
          borderRadius: 14,
          padding: "26px 24px",
          boxShadow: "0 22px 60px rgba(0, 0, 0, 0.55)",
          animationDuration: `${duration}ms`,
        }}
      >
        {top.kind === "levelup" ? (
          <>
            <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--m-ink-3)", marginBottom: 10 }}>
              Has subido de nivel
            </div>
            <div className="m-num" style={{ fontSize: 46, fontWeight: 650, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {top.level}
            </div>
          </>
        ) : top.kind === "milestone" ? (
          <>
            <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--m-ink-3)", marginBottom: 10 }}>
              Racha de {top.days} días
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 8 }}>{top.habit}</div>
            <div style={{ fontSize: 13.5, color: "var(--m-good)" }}>+{top.bonus} XP</div>
          </>
        ) : top.kind === "shield" ? (
          <>
            <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--m-ink-3)", marginBottom: 10 }}>
              Escudo usado
            </div>
            <div style={{ fontSize: 15, color: "var(--m-ink)" }}>Tu racha sigue viva</div>
          </>
        ) : top.kind === "anchor" ? (
          <>
            <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--m-ink-3)", marginBottom: 10 }}>
              Hábito ancla
            </div>
            <div style={{ fontSize: 15, color: "var(--m-ink)" }}>Cumplido · bonus extra</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--m-ink-3)", marginBottom: 10 }}>
              Objetivo cumplido
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 8 }}>{top.label}</div>
            <div style={{ fontSize: 13.5, color: "var(--m-good)" }}>+{top.xp} XP</div>
          </>
        )}
      </div>
    </div>
  );
}
