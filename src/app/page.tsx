import Link from "next/link";
import { db } from "@/modules/core/db";
import {
  getHomeMetrics,
  getPlayerLevelInfo,
  getTodayQuests,
  MAX_SHIELDS,
} from "@/modules/habitos";
import { TodayCard } from "@/modules/habitos/components/home/TodayCard";
import { TrendCard } from "@/modules/habitos/components/home/TrendCard";
import { MetricTiles } from "@/modules/habitos/components/home/MetricTiles";
import { QuestList } from "@/modules/habitos/components/home/QuestList";
import type { ChartPoint } from "@/modules/habitos/components/charts/ComplianceChart";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const seccion: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const tituloSeccion: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--m-ink-3)",
};

export default async function DashboardPage() {
  const [metrics, player, quests] = await Promise.all([
    getHomeMetrics(db),
    getPlayerLevelInfo(db),
    getTodayQuests(db),
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
    <main
      className="m-root"
      style={{ minHeight: "100%", padding: "20px 16px 48px" }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span
            style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}
          >
            Hoy
          </span>
          <span style={{ fontSize: 13, color: "var(--m-ink-3)" }}>{today}</span>
        </div>

        <section style={seccion}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <h2 style={tituloSeccion}>Hábitos</h2>
            <Link
              href="/habitos"
              style={{ fontSize: 13, color: "var(--m-ink-3)" }}
            >
              Ver todo
            </Link>
          </div>

          {metrics.habitCount === 0 ? (
            <div className="m-card" style={{ textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 16, marginBottom: 6 }}>
                Aún no tienes hábitos.
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--m-ink-2)",
                  marginBottom: 20,
                }}
              >
                Crea el primero y esta pantalla empezará a medirte.
              </p>
              <Link
                href="/habitos"
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
        </section>

        {/*
          El hueco es literal a propósito: deja visible qué falta en vez de
          fingir que la portada está terminada. Se llena en el sub-proyecto 2,
          cuando Voidtify entre en la app.
        */}
        <section style={seccion}>
          <h2 style={tituloSeccion}>Música</h2>
          <div
            className="m-card"
            style={{
              padding: 28,
              textAlign: "center",
              borderStyle: "dashed",
            }}
          >
            <p style={{ fontSize: 14, color: "var(--m-ink-2)" }}>
              Llega en el siguiente paso, cuando Voidtify entre en la app.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
