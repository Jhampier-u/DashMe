"use client";

import { useEffect, useState, useTransition } from "react";
import type { MonthDay } from "@/modules/habitos/lib/habits";
import { fetchHabitMonth, toggleHabitOnDay } from "@/modules/habitos/actions";
import { emitToggleResult } from "@/modules/habitos/lib/events";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];

const NAV_BUTTON = {
  width: 26,
  height: 26,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  border: "1px solid var(--m-line)",
  background: "var(--m-elevated)",
  color: "var(--m-ink-2)",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

export function MonthCalendar({
  habitId,
  habitName,
}: {
  habitId: string;
  habitName: string;
}) {
  const [now] = useState(() => new Date());
  const [year, setYear] = useState(() => now.getFullYear());
  const [month, setMonth] = useState(() => now.getMonth());
  // El mes cargado viaja con sus datos, así que "cargando" es un valor derivado.
  const [loaded, setLoaded] = useState<{ key: string; days: MonthDay[] } | null>(null);
  const [token, setToken] = useState(0);
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
  }, [habitId, year, month, token]);

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }

  function toggle(day: MonthDay) {
    if (!day.editable || pending) return;
    setLoaded((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            days: prev.days.map((d) =>
              d.date === day.date ? { ...d, done: !d.done } : d,
            ),
          },
    );
    startTransition(async () => {
      emitToggleResult(await toggleHabitOnDay(habitId, day.date));
      setToken((t) => t + 1);
    });
  }

  function describe(day: MonthDay): string {
    if (day.shielded) return `${day.date}: cubierto por un escudo`;
    if (day.isFuture) return `${day.date}: aún no llega`;
    if (!day.scheduled) return `${day.date}: no toca`;
    if (!day.editable) return `${day.date}: fuera del rango editable`;
    return `${day.date}: ${day.done ? "cumplido" : "pendiente"}`;
  }

  function colors(day: MonthDay) {
    if (day.shielded) return { bg: "rgba(250, 178, 25, 0.22)", fg: "var(--m-ink)" };
    if (day.partial) return { bg: "rgba(250, 178, 25, 0.35)", fg: "var(--m-ink)" };
    if (day.done) return { bg: "var(--m-series)", fg: "#fff" };
    if (!day.scheduled) return { bg: "transparent", fg: "var(--m-ink-3)" };
    return { bg: "var(--m-elevated)", fg: "var(--m-ink-2)" };
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <button type="button" onClick={() => shift(-1)} style={NAV_BUTTON} aria-label="Mes anterior">
          ←
        </button>
        <span style={{ fontSize: 13, fontWeight: 550 }}>
          {MONTHS[month]} {year}
        </span>
        <button type="button" onClick={() => shift(1)} style={NAV_BUTTON} aria-label="Mes siguiente">
          →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            style={{ textAlign: "center", fontSize: 10, color: "var(--m-ink-3)", paddingBottom: 2 }}
          >
            {w}
          </div>
        ))}

        {loading
          ? Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                style={{ aspectRatio: "1", borderRadius: 5, background: "var(--m-elevated)" }}
              />
            ))
          : days.map((day) => {
              const { bg, fg } = colors(day);
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => toggle(day)}
                  disabled={!day.editable || pending}
                  title={describe(day)}
                  aria-label={`${habitName}, ${describe(day)}`}
                  style={{
                    aspectRatio: "1",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 5,
                    fontSize: 11,
                    fontFamily: "inherit",
                    background: bg,
                    color: fg,
                    border: day.isToday ? "1px solid var(--m-ink-2)" : "1px solid transparent",
                    opacity: day.inMonth ? (day.isFuture ? 0.35 : 1) : 0.3,
                    cursor: day.editable ? "pointer" : "default",
                  }}
                >
                  {day.shielded ? "🛡" : day.day}
                </button>
              );
            })}
      </div>

      <div style={{ fontSize: 11, color: "var(--m-ink-3)", marginTop: 8 }}>
        Solo los días que tocan, hasta 60 días atrás. 🛡 escudo · tono suave, modo mínimo.
      </div>
    </div>
  );
}
