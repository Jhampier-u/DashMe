"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { on } from "@/modules/habitos/lib/events";

type Toast =
  | { kind: "levelup"; key: number; level: number }
  | {
      kind: "milestone";
      key: number;
      habit: string;
      days: number;
      bonus: number;
    }
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

/*
  El rótulo de las cinco variantes era el mismo objeto copiado cinco veces.
  Ahora es uno. Va en tinta plena: a 12px, tinta-2 se queda en 4,00:1 y eso
  solo cubre texto grande.
*/
const ROTULO: CSSProperties = {
  fontFamily: "var(--font-cuerpo)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--color-tinta)",
  marginBottom: 10,
};

/*
  El premio en XP iba en verde. El verde como color de texto está prohibido por
  la regla dura, así que pasa a sello: fondo amarillo con la tinta encima
  (8,49:1). Celebra igual y además se lee sin distinguir tonos.
*/
const PREMIO: CSSProperties = {
  display: "inline-block",
  fontFamily: "var(--font-vt)",
  fontSize: 18,
  lineHeight: 1,
  color: "var(--color-tinta)",
  background: "var(--color-yellow)",
  border: "2px solid var(--color-line)",
  borderRadius: 999,
  padding: "4px 10px",
};

export function AchievementToast() {
  const [queue, setQueue] = useState<Toast[]>([]);

  useEffect(() => {
    const push = (t: NewToast) =>
      setQueue((q) => [...q, { ...t, key: ++nextKey } as Toast]);

    const offs = [
      on("untap:levelup", (d) => push({ kind: "levelup", level: d.level })),
      on("untap:milestone", (d) =>
        push({
          kind: "milestone",
          habit: d.habit,
          days: d.days,
          bonus: d.bonus,
        }),
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
          background: "var(--color-paper)",
          border: "3px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
          padding: "26px 24px",
          boxShadow: "var(--shadow-hard)",
          color: "var(--color-tinta)",
          fontFamily: "var(--font-cuerpo)",
          // No tocar: la animación cubre toda la vida del toast y su duración
          // se inyecta desde aquí. Sin esto se desvanece y vuelve a aparecer.
          animationDuration: `${duration}ms`,
        }}
      >
        {top.kind === "levelup" ? (
          <>
            <div style={ROTULO}>Has subido de nivel</div>
            <div
              style={{
                fontFamily: "var(--font-vt)",
                fontSize: 46,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {top.level}
            </div>
          </>
        ) : top.kind === "milestone" ? (
          <>
            <div style={ROTULO}>Racha de {top.days} días</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 12 }}>
              {top.habit}
            </div>
            <div style={PREMIO}>+{top.bonus} XP</div>
          </>
        ) : top.kind === "shield" ? (
          <>
            <div style={ROTULO}>Escudo usado</div>
            <div style={{ fontSize: 15 }}>Tu racha sigue viva</div>
          </>
        ) : top.kind === "anchor" ? (
          <>
            <div style={ROTULO}>Hábito ancla</div>
            <div style={{ fontSize: 15 }}>Cumplido · bonus extra</div>
          </>
        ) : (
          <>
            <div style={ROTULO}>Objetivo cumplido</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 12 }}>
              {top.label}
            </div>
            <div style={PREMIO}>+{top.xp} XP</div>
          </>
        )}
      </div>
    </div>
  );
}
