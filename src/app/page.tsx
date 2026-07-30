import Link from "next/link";
import { db } from "@/modules/core/db";
import {
  getDiasCumplidos,
  getHomeMetrics,
  getPlayerLevelInfo,
  getTodayQuests,
  MAX_SHIELDS,
} from "@/modules/habitos";
import { getByDate } from "@/modules/musica";
import { compararGrupos } from "@/modules/core/analisis/comparar-dias";
import { MusicaPanel } from "@/modules/habitos/components/home/MusicaPanel";
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

/*
  Los rótulos de sección van sellados en rosa, no sueltos sobre el papel. Son
  las dos únicas divisiones de la portada, así que marcarlas es lo que le da
  ritmo a la página en vez de dejarla como una lista de tarjetas.

  16px es el suelo de VT323, y la tinta sobre rosa da 5,43:1.
*/
const tituloSeccion: React.CSSProperties = {
  display: "inline-block",
  fontFamily: "var(--font-vt)",
  fontSize: 16,
  lineHeight: 1,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-tinta)",
  background: "var(--color-pink)",
  border: "2px solid var(--color-line)",
  borderRadius: "var(--radius-control)",
  padding: "5px 10px",
};

export default async function DashboardPage() {
  /*
    El cruce entre música y hábitos se compone AQUÍ y no dentro de un módulo.

    La pregunta —«¿escucho distinto los días que cumplo?»— no es de hábitos ni de
    música, y ponerla en uno obligaría a ese a importar el otro. Esta página es el
    único sitio que conoce legítimamente las dos interfaces públicas.
  */
  const hoy = new Date();
  const haceUnAno = new Date(hoy);
  haceUnAno.setUTCDate(haceUnAno.getUTCDate() - 365);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [metrics, player, quests, dias, porDia] = await Promise.all([
    getHomeMetrics(db),
    getPlayerLevelInfo(db),
    getTodayQuests(db),
    getDiasCumplidos(db, haceUnAno, hoy),
    getByDate(db, {
      fromDate: iso(haceUnAno),
      toDate: iso(hoy),
      label: "último año",
      preset: "custom",
    }),
  ]);

  // `getByDate` da la fecha como "YYYY-MM-DD" y los conjuntos de días son claves
  // numéricas: hay que pasarlos a la misma moneda antes de comparar.
  const msPorDia = new Map<number, number>();
  for (const d of porDia) {
    const [y, m, dd] = d.date.split("-").map(Number);
    msPorDia.set(Date.UTC(y, m - 1, dd), d.ms);
  }
  const cruce = compararGrupos(msPorDia, dias.cumplidos, dias.fallados);

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
                globalStreak={metrics.globalStreak}
                best={metrics.best}
                level={player.level}
                xp={player.xp}
                xpToNext={player.xpForNextLevel - player.xpIntoLevel}
                shields={player.shields}
                maxShields={MAX_SHIELDS}
              />

              <MusicaPanel c={cruce} />

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
