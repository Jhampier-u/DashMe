"use client";

import { useEffect, useState, useTransition } from "react";
import type { MonthDay } from "@/lib/habits";
import { toggleHabitOnDay } from "@/app/actions";

type Props = {
  habitId: string;
  habitName: string;
};

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const WEEKDAYS_ES = ["D", "L", "M", "M", "J", "V", "S"];

async function fetchMonth(habitId: string, year: number, month: number) {
  const res = await fetch(
    `/api/habit-month?id=${habitId}&y=${year}&m=${month}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as MonthDay[];
}

export function MonthCalendar({ habitId, habitName }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [days, setDays] = useState<MonthDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  async function reload(y: number, m: number) {
    setLoading(true);
    const result = await fetchMonth(habitId, y, m);
    setDays(result);
    setLoading(false);
  }

  useEffect(() => {
    reload(year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitId, year, month]);

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }

  function toggle(d: MonthDay) {
    if (d.isFuture) return;
    // optimistic
    setDays((prev) =>
      prev.map((x) => (x.date === d.date ? { ...x, done: !x.done } : x)),
    );
    startTransition(async () => {
      const result = await toggleHabitOnDay(habitId, d.date);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("untap:xp", { detail: result }));
        if (result.leveledUp) {
          window.dispatchEvent(
            new CustomEvent("untap:levelup", { detail: { newLevel: result.newLevel } }),
          );
        }
      }
      // refresh from server in case of race
      reload(year, month);
    });
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
              const bg = d.done
                ? "var(--color-mint)"
                : d.inMonth
                  ? "var(--color-surface)"
                  : "var(--color-bg)";
              const ink = d.done ? "var(--color-bg-deep)" : "var(--color-ink-soft)";
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => toggle(d)}
                  disabled={d.isFuture || pending}
                  title={d.date + (d.isFuture ? " (futuro)" : "")}
                  className="aspect-square flex items-center justify-center text-sm pixel-button"
                  style={{
                    background: bg,
                    color: ink,
                    opacity: d.inMonth ? (d.isFuture ? 0.3 : 1) : 0.4,
                    boxShadow: d.isToday
                      ? "inset 0 0 0 2px var(--color-peach)"
                      : "0 0 0 1px var(--color-border)",
                  }}
                  aria-label={`${habitName} en ${d.date}`}
                >
                  {d.day}
                </button>
              );
            })}
      </div>

      <div className="text-[0.6rem] font-display tracking-wider text-[var(--color-ink-dim)] text-center mt-3">
        CLICK PARA MARCAR · HASTA 60 DÍAS ATRÁS
      </div>
    </div>
  );
}
