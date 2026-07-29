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
import { Card } from "@/modules/core/ui/Card";
import { buttonStyle } from "@/modules/core/ui/Button";
import type { ChartPoint } from "@/modules/habitos/components/charts/ComplianceChart";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

// El aire crece: con trazo de 3px y sombra dura en cada pieza, el espaciado
// anterior se queda corto y las sombras se muerden con el bloque siguiente.
const seccion: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

// 16px es el suelo de VT323.
const tituloSeccion: React.CSSProperties = {
  fontFamily: "var(--font-vt)",
  fontSize: 16,
  lineHeight: 1,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-tinta)",
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
    // Se cae `.m-root`: la portada pone ya su propio papel.
    <main
      style={{
        minHeight: "100%",
        padding: "24px 16px 56px",
        background: "var(--color-paper)",
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700 }}>Hoy</span>
          <span style={{ fontFamily: "var(--font-vt)", fontSize: 16 }}>{today}</span>
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
            <Link href="/habitos" style={{ fontSize: 13, fontWeight: 700 }}>
              Ver todo
            </Link>
          </div>

          {metrics.habitCount === 0 ? (
            <Card style={{ textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                Aún no tienes hábitos.
              </p>
              <p style={{ fontSize: 13, marginBottom: 20 }}>
                Crea el primero y esta pantalla empezará a medirte.
              </p>
              {/* Llevaba su propio azul a mano; ahora usa el botón del sistema. */}
              <Link href="/habitos" style={buttonStyle("primary")}>
                Crear un hábito
              </Link>
            </Card>
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
          La puerta ya está abierta: música tiene su propia sección. Los datos
          cruzados con hábitos —lo que de verdad justifica un widget aquí—
          llegan más adelante.
        */}
        <section style={seccion}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <h2 style={tituloSeccion}>Música</h2>
            <Link href="/musica" style={{ fontSize: 13, fontWeight: 700 }}>
              Ver todo
            </Link>
          </div>

          <p style={{ fontSize: 14 }}>
            Tu biblioteca y tu historial de escucha, en su propia sección. Los
            datos cruzados con el resto del dashboard llegan más adelante.
          </p>
        </section>
      </div>
    </main>
  );
}
