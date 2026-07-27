"use client";

import { useEffect, useState, useTransition } from "react";
import type { MonthDay } from "@/lib/habits";
import { fetchHabitMonth, toggleHabitOnDay } from "@/app/actions";
import { emitToggleResult } from "@/lib/events";

type Props = {
  habitId: string;
  habitName: string;
};

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const WEEKDAYS_ES = ["D", "L", "M", "M", "J", "V", "S"];

export function MonthCalendar({ habitId, habitName }: Props) {
  // Mes actual según el calendario LOCAL del usuario.
  const [now] = useState(() => new Date());
  const [year, setYear] = useState(() => now.getFullYear());
  const [month, setMonth] = useState(() => now.getMonth());
  // El mes cargado viaja junto a sus datos, así que "cargando" es un valor
  // derivado y no hace falta un setState de arranque en el efecto.
  const [loaded, setLoaded] = useState<{ key: string; days: MonthDay[] } | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [pending, startTransition] = useTransition();

  const monthKey = `${year}-${month}`;
  const loading = loaded?.key !== monthKey;
  const days = loaded?.key === monthKey ? loaded.days : [];

  useEffect(() => {
    let alive = true;
    fetchHabitMonth(habitId, year, month).then((result) => {
      if (alive) setLoaded({ key: `${year}-${month}`, days: result });
    });
    return () => {
      alive = false;
    };
  }, [habitId, year, month, reloadToken]);

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }

  function toggle(d: MonthDay) {
    if (!d.editable || pending) return;
    // Optimista: se corrige al recargar si el servidor dice otra cosa.
    setLoaded((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            days: prev.days.map((x) =>
              x.date === d.date ? { ...x, done: !x.done } : x,
            ),
          },
    );
    startTransition(async () => {
      emitToggleResult(await toggleHabitOnDay(habitId, d.date));
      setReloadToken((t) => t + 1);
    });
  }

  function cellStyle(d: MonthDay) {
    if (d.shielded) return { bg: "var(--color-sky)", ink: "var(--color-bg-deep)" };
    if (d.partial) return { bg: "var(--color-peach)", ink: "var(--color-bg-deep)" };
    if (d.done) return { bg: "var(--color-mint)", ink: "var(--color-bg-deep)" };
    if (!d.scheduled) return { bg: "var(--color-bg)", ink: "var(--color-ink-dim)" };
    return { bg: "var(--color-surface)", ink: "var(--color-ink-soft)" };
  }

  function cellTitle(d: MonthDay) {
    if (d.shielded) return `${d.date} · cubierto por un escudo`;
    if (d.isFuture) return `${d.date} · aún no llega`;
    if (!d.scheduled) return `${d.date} · no toca`;
    if (!d.editable) return `${d.date} · fuera del rango editable`;
    return `${d.date} · ${d.done ? "cumplido" : "pendiente"}`;
  }

  return (
    <div className="mt-3 p-3" style={{ background: "var(--color-bg-deep)" }}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="pixel-button font-display text-[0.6rem] px-2 py-1"
          style={{
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 2px var(--color-border)",
          }}
          aria-label="Mes anterior"
        >
          ◄
        </button>
        <span className="font-display text-[0.7rem] tracking-wider text-[var(--color-peach)]">
          {MONTHS_ES[month]} {year}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="pixel-button font-display text-[0.6rem] px-2 py-1"
          style={{
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 2px var(--color-border)",
          }}
          aria-label="Mes siguiente"
        >
          ►
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS_ES.map((w, i) => (
          <div
            key={i}
            className="text-center font-display text-[0.55rem] text-[var(--color-ink-dim)]"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {loading
          ? Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square"
                style={{ background: "var(--color-surface)" }}
              />
            ))
          : days.map((d) => {
              const { bg, ink } = cellStyle(d);
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => toggle(d)}
                  disabled={!d.editable || pending}
                  title={cellTitle(d)}
                  className="aspect-square flex items-center justify-center text-sm pixel-button"
                  style={{
                    background: bg,
                    color: ink,
                    opacity: d.inMonth ? (d.isFuture ? 0.3 : 1) : 0.4,
                    boxShadow: d.isToday
                      ? "inset 0 0 0 2px var(--color-peach)"
                      : "0 0 0 1px var(--color-border)",
                  }}
                  aria-label={`${habitName} · ${cellTitle(d)}`}
                >
                  {d.shielded ? "🛡" : d.day}
                </button>
              );
            })}
      </div>

      <div className="text-[0.6rem] font-display tracking-wider text-[var(--color-ink-dim)] text-center mt-3 leading-relaxed">
        SOLO DÍAS QUE TOCAN · HASTA 60 DÍAS ATRÁS
        <br />
        <span className="text-[var(--color-sky)]">🛡 ESCUDO</span> ·{" "}
        <span className="text-[var(--color-peach)]">◐ MÍNIMO</span>
      </div>
    </div>
  );
}
