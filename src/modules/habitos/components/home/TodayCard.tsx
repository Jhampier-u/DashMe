"use client";

import { useTransition } from "react";
import { toggleToday } from "@/modules/habitos/actions";
import { emitToggleResult } from "@/modules/habitos/lib/events";
import { Card } from "@/modules/core/ui/Card";
import { ProgressRing } from "@/modules/habitos/components/charts/ProgressRing";
import type { PendingHabit } from "@/modules/habitos/lib/home";

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
    <Card title="Hoy" style={{ opacity: busy ? 0.7 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Arco de tinta sobre pista de paper-2: pista clara y relleno oscuro
            es la convención que se lee sin pensar. */}
        <ProgressRing
          value={done}
          max={scheduled}
          track="var(--color-paper-2)"
          fill="var(--color-tinta)"
        />
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span
              style={{
                fontFamily: "var(--font-vt)",
                fontSize: 46,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {done}
            </span>
            <span
              style={{
                fontFamily: "var(--font-vt)",
                fontSize: 24,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              /{scheduled}
            </span>
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6 }}>
            {scheduled === 0 ? "hoy no toca ningún hábito" : "hábitos de hoy"}
          </div>
          {partial > 0 ? (
            <div style={{ fontSize: 11.5, marginTop: 4 }}>
              {partial === 1 ? "1 en modo mínimo" : `${partial} en modo mínimo`}
            </div>
          ) : null}
        </div>
      </div>

      {pending.length > 0 ? (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "3px dashed var(--color-line)" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 10 }}>
            {pending.length === 1 ? "Falta 1 antes de medianoche" : `Faltan ${pending.length} antes de medianoche`}
          </div>
          {/* Se pulsan para marcar, así que tienen que parecer pulsables. */}
          {pending.map((habit) => (
            <button
              key={habit.id}
              type="button"
              onClick={() => mark(habit.id)}
              disabled={busy}
              className={
                "inline-flex items-center gap-2 mr-1.5 mb-1.5 px-3 py-1.5 " +
                "rounded-full border-3 border-line bg-paper text-tinta font-cuerpo text-[12.5px] " +
                "cursor-pointer shadow-hard " +
                "transition-[transform,box-shadow] duration-75 ease-out " +
                "active:translate-x-0.5 active:translate-y-0.5 " +
                "active:shadow-[2px_2px_0_var(--color-line)] " +
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
                "disabled:opacity-50 disabled:shadow-none"
              }
              aria-label={`Marcar ${habit.name} como hecho`}
            >
              {/* El punto SÍ puede llevar color: es un punto, no texto. */}
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  border: "2px solid var(--color-tinta)",
                  background: habit.critical ? "var(--color-peach)" : "var(--color-sky)",
                }}
              />
              {habit.name}
            </button>
          ))}
          {critical.length > 0 ? (
            // Iba en rojo. El rojo como color de texto está prohibido, así que
            // lo que avisa ahora son el ▲ y el grosor.
            <div
              style={{
                display: "flex",
                gap: 7,
                alignItems: "center",
                fontSize: 12,
                fontWeight: 700,
                marginTop: 6,
              }}
            >
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
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "3px dashed var(--color-line)",
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          {partial > 0 ? "Día completo, con mínimos." : "Día completo."}
        </div>
      ) : null}
    </Card>
  );
}
