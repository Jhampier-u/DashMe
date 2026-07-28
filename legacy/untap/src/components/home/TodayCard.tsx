"use client";

import { useTransition } from "react";
import { toggleToday } from "@/app/actions";
import { emitToggleResult } from "@/lib/events";
import { ProgressRing } from "@/components/charts/ProgressRing";
import type { PendingHabit } from "@/lib/home";

type Props = {
  done: number;
  scheduled: number;
  /** Cuántos de los cumplidos de hoy lo fueron en modo mínimo. */
  partial: number;
  pending: PendingHabit[];
};

export function TodayCard({ done, scheduled, partial, pending }: Props) {
  const [busy, startTransition] = useTransition();
  const critical = pending.filter((h) => h.critical);

  function mark(id: string) {
    startTransition(async () => {
      emitToggleResult(await toggleToday(id, false));
    });
  }

  return (
    <div className="m-card" style={{ opacity: busy ? 0.7 : 1 }}>
      <div className="m-label" style={{ marginBottom: 14 }}>
        Hoy
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ProgressRing value={done} max={scheduled} />
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span className="m-num" style={{ fontSize: 44, fontWeight: 650, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {done}
            </span>
            <span className="m-num" style={{ fontSize: 20, color: "var(--m-ink-3)", fontWeight: 500 }}>
              /{scheduled}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 6 }}>
            {scheduled === 0 ? "hoy no toca ningún hábito" : "hábitos de hoy"}
          </div>
          {partial > 0 ? (
            <div style={{ fontSize: 11.5, color: "var(--m-ink-2)", marginTop: 4 }}>
              {partial === 1 ? "1 en modo mínimo" : `${partial} en modo mínimo`}
            </div>
          ) : null}
        </div>
      </div>

      {pending.length > 0 ? (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--m-line)" }}>
          <div style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginBottom: 9 }}>
            {pending.length === 1 ? "Falta 1 antes de medianoche" : `Faltan ${pending.length} antes de medianoche`}
          </div>
          {pending.map((habit) => (
            <button
              key={habit.id}
              type="button"
              onClick={() => mark(habit.id)}
              disabled={busy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--m-elevated)",
                border: "1px solid var(--m-line)",
                borderRadius: 999,
                padding: "5px 11px 5px 8px",
                fontSize: 12.5,
                fontFamily: "inherit",
                color: "var(--m-ink)",
                margin: "0 6px 6px 0",
                cursor: busy ? "default" : "pointer",
              }}
              aria-label={`Marcar ${habit.name} como hecho`}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: habit.critical ? "var(--m-crit)" : "var(--m-series)",
                }}
              />
              {habit.name}
            </button>
          ))}
          {critical.length > 0 ? (
            <div style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, color: "var(--m-crit)", marginTop: 4 }}>
              <span aria-hidden="true">▲</span>
              <span>
                {critical.length === 1
                  ? `${critical[0].name} viene de fallar ayer`
                  : `${critical.length} hábitos vienen de fallar ayer`}
              </span>
            </div>
          ) : null}
        </div>
      ) : scheduled > 0 ? (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--m-line)", fontSize: 12.5, color: "var(--m-good)" }}>
          {partial > 0 ? "Día completo, con mínimos." : "Día completo."}
        </div>
      ) : null}
    </div>
  );
}
