import Link from "next/link";
import { getHomeMetrics } from "@/lib/home";
import { getPlayerLevelInfo } from "@/lib/habits";
import { getTodayQuests } from "@/lib/quests";
import { MAX_SHIELDS } from "@/lib/level";
import { TodayCard } from "@/components/home/TodayCard";
import { TrendCard } from "@/components/home/TrendCard";
import { MetricTiles } from "@/components/home/MetricTiles";
import { QuestList } from "@/components/home/QuestList";
import type { ChartPoint } from "@/components/charts/ComplianceChart";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default async function Home() {
  const [metrics, player, quests] = await Promise.all([
    getHomeMetrics(),
    getPlayerLevelInfo(),
    getTodayQuests(),
  ]);

  const points: ChartPoint[] = metrics.series.map((day, i) => ({
    date: day.date,
    rate: day.rate,
    mean: metrics.mean[i],
    done: day.done,
    scheduled: day.scheduled,
    shielded: day.shielded,
  }));

  // Intl devuelve "lunes, 27 de julio". Solo se sube la primera letra: con
  // `text-transform: capitalize` saldría "Lunes, 27 De Julio".
  const formatted = DATE_FORMAT.format(new Date());
  const today = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  return (
    <main className="m-root" style={{ minHeight: "100%", padding: "20px 16px 48px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Untap</span>
          <span style={{ fontSize: 13, color: "var(--m-ink-3)" }}>{today}</span>
        </div>

        {metrics.habitCount === 0 ? (
          <div className="m-card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 16, marginBottom: 6 }}>Aún no tienes hábitos.</p>
            <p style={{ fontSize: 13, color: "var(--m-ink-2)", marginBottom: 20 }}>
              Crea el primero y esta pantalla empezará a medirte.
            </p>
            <Link
              href="/habits"
              style={{
                display: "inline-block",
                background: "var(--m-series-strong)",
                color: "#fff",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13.5,
                fontWeight: 550,
              }}
            >
              Crear un hábito
            </Link>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 14,
                alignItems: "start",
              }}
            >
              <TodayCard
                done={metrics.today.done}
                scheduled={metrics.today.scheduled}
                partial={metrics.today.partial}
                pending={metrics.today.pending}
              />
              <div style={{ gridColumn: "span 1", minWidth: 0 }}>
                <TrendCard points={points} delta={metrics.delta} />
              </div>
            </div>

            <MetricTiles
              streak={metrics.longestStreak}
              best={metrics.best}
              level={player.level}
              xp={player.xp}
              xpToNext={player.xpForNextLevel - player.xpIntoLevel}
              shields={player.shields}
              maxShields={MAX_SHIELDS}
            />

            <QuestList quests={quests} />
          </>
        )}
      </div>
    </main>
  );
}
