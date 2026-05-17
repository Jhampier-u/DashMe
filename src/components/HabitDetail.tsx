"use client";

import { useEffect, useState } from "react";
import { MonthCalendar } from "./MonthCalendar";
import type { HabitDetailStats } from "@/lib/stats";

type Props = {
  habitId: string;
  habitName: string;
};

async function fetchStats(id: string) {
  const res = await fetch(`/api/habit-stats?id=${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as HabitDetailStats;
}

export function HabitDetail({ habitId, habitName }: Props) {
  const [stats, setStats] = useState<HabitDetailStats | null>(null);

  useEffect(() => {
    fetchStats(habitId).then(setStats);
  }, [habitId]);

  return (
    <div className="mt-3 flex flex-col gap-3">
      {stats ? (
        <div className="grid grid-cols-4 gap-2">
          <Stat label="HOY" value={stats.currentStreak} suffix="d racha" />
          <Stat label="MEJOR" value={stats.bestStreak} suffix="d racha" />
          <Stat
            label="30D"
            value={`${Math.round(stats.completionRate30 * 100)}%`}
            suffix="cumplido"
          />
          <Stat label="TOTAL" value={stats.totalDone} suffix="veces" />
        </div>
      ) : (
        <div className="text-center text-[var(--color-ink-dim)] text-sm">
          Cargando estadísticas…
        </div>
      )}
      <MonthCalendar habitId={habitId} habitName={habitName} />
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div
      className="p-2 text-center"
      style={{
        background: "var(--color-bg-deep)",
        boxShadow: "0 0 0 2px var(--color-border)",
        color: "var(--color-ink)",
      }}
    >
      <div className="font-display text-[0.5rem] text-[var(--color-ink-dim)] mb-1 tracking-wider">
        {label}
      </div>
      <div className="font-display text-base text-[var(--color-mint)]">{value}</div>
      {suffix ? (
        <div className="text-[0.65rem] text-[var(--color-ink-soft)] mt-1">{suffix}</div>
      ) : null}
    </div>
  );
}
