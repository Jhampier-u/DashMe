"use client";

import { useEffect, useState } from "react";
import { fetchHabitStats } from "@/app/actions";
import { on } from "@/modules/habitos/lib/events";
import { formatDays } from "@/modules/habitos/lib/day";
import { Stat, StatGrid } from "@/modules/core/ui/Stat";
import type { HabitDetailStats } from "@/modules/habitos/lib/stats";
import { MonthCalendar } from "./MonthCalendar";

export function HabitDetail({
  habitId,
  habitName,
}: {
  habitId: string;
  habitName: string;
}) {
  const [stats, setStats] = useState<HabitDetailStats | null>(null);
  // Marcar días desde el calendario cambia racha y porcentaje.
  const [version, setVersion] = useState(0);

  useEffect(() => on("untap:xp", () => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let alive = true;
    fetchHabitStats(habitId).then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, [habitId, version]);

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--m-line)" }}>
      {stats ? (
        <StatGrid min={110} gap={12}>
          <Stat size="sm" label="Racha" value={formatDays(stats.currentStreak)} meta="actual" />
          <Stat size="sm" label="Mejor" value={formatDays(stats.bestStreak)} meta="histórica" />
          <Stat
            size="sm"
            label="30 días"
            value={`${Math.round(stats.completionRate30 * 100)}%`}
            meta={`${stats.doneIn30} de ${stats.scheduledIn30} que tocaban`}
          />
          <Stat size="sm" label="Total" value={String(stats.totalDone)} meta="veces cumplido" />
        </StatGrid>
      ) : (
        <div style={{ fontSize: 12.5, color: "var(--m-ink-3)" }}>
          Cargando estadísticas…
        </div>
      )}
      <MonthCalendar habitId={habitId} habitName={habitName} />
    </div>
  );
}
