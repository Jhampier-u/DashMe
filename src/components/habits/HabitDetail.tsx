"use client";

import { useEffect, useState } from "react";
import { fetchHabitStats } from "@/app/actions";
import { on } from "@/lib/events";
import type { HabitDetailStats } from "@/lib/stats";
import { MonthCalendar } from "./MonthCalendar";

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="m-label">{label}</div>
      <div className="m-num" style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--m-ink-3)", marginTop: 2 }}>{hint}</div>
    </div>
  );
}

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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 12,
          }}
        >
          <Stat label="Racha" value={`${stats.currentStreak} días`} hint="actual" />
          <Stat label="Mejor" value={`${stats.bestStreak} días`} hint="histórica" />
          <Stat
            label="30 días"
            value={`${Math.round(stats.completionRate30 * 100)}%`}
            hint={`${stats.doneIn30} de ${stats.scheduledIn30} que tocaban`}
          />
          <Stat label="Total" value={String(stats.totalDone)} hint="veces cumplido" />
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: "var(--m-ink-3)" }}>
          Cargando estadísticas…
        </div>
      )}
      <MonthCalendar habitId={habitId} habitName={habitName} />
    </div>
  );
}
