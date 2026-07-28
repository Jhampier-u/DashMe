import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonStyle } from "@/components/ui/Button";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { GardenScene } from "@/components/GardenScene";
import { getHabitsWithTodayStatus } from "@/lib/habits";
import { isPlantWilted, stageFor } from "@/lib/garden";

export const dynamic = "force-dynamic";

const STAGES = [
  { emoji: "🟫", label: "Semilla", days: "0 d" },
  { emoji: "🌱", label: "Brote", days: "1-2 d" },
  { emoji: "🌿", label: "Joven", days: "3-6 d" },
  { emoji: "🌷", label: "Madura", days: "7-13 d" },
  { emoji: "🌻", label: "Floreciente", days: "14 d o más" },
];

export default async function GardenPage() {
  const habits = await getHabitsWithTodayStatus();

  const total = habits.length;
  const wateredToday = habits.filter((h) => h.doneToday).length;
  const mature = habits.filter((h) => stageFor(h.streak) >= 3).length;
  const blooming = habits.filter((h) => stageFor(h.streak) >= 4).length;
  const wilted = habits.filter((h) =>
    isPlantWilted(h.streak, h.doneToday, h.hasEverBeenDone),
  ).length;

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PageHeader
        title="Tu jardín"
        subtitle="Cada hábito es una planta. Riégalas para que crezcan."
      />

      {total === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "36px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden>
              🌱
            </div>
            <p style={{ fontSize: 15, color: "var(--m-ink)", marginBottom: 6 }}>
              Tu jardín está esperando su primera semilla.
            </p>
            <p style={{ fontSize: 13, color: "var(--m-ink-2)", marginBottom: 20 }}>
              Crea un hábito para plantar y empezar a regar.
            </p>
            <Link href="/habits" style={buttonStyle("primary")}>
              Ir a hábitos
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <StatGrid>
            <Stat label="Plantas" value={String(total)} meta="en el jardín" />
            <Stat
              label="Regadas hoy"
              value={`${wateredToday} / ${total}`}
              meta={wateredToday === total ? "el jardín está al día" : "aún queda riego"}
            />
            <Stat label="Maduras" value={String(mature)} meta="racha de 7 días o más" />
            <Stat label="Florecientes" value={String(blooming)} meta="racha de 14 días o más" />
          </StatGrid>

          {wilted > 0 ? (
            <Card>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>
                  🥀
                </span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 550, color: "var(--m-crit)" }}>
                    {wilted === 1 ? "Una planta marchita" : `${wilted} plantas marchitas`}
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 4 }}>
                    {wilted === 1
                      ? "Riégala hoy, desde aquí o desde Hábitos, y revive."
                      : "Riégalas hoy, desde aquí o desde Hábitos, y revivirán."}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <GardenScene habits={habits} />
            <p style={{ fontSize: 12, color: "var(--m-ink-3)", marginTop: 10 }}>
              Click en una planta para regarla. La corona marca el hábito ancla y el
              destello, una racha de 7 días o más.
            </p>
          </Card>

          <Card title="Etapas de crecimiento">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
                gap: 10,
              }}
            >
              {STAGES.map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24 }} aria-hidden>
                    {s.emoji}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--m-ink)", marginTop: 4 }}>
                    {s.label}
                  </div>
                  <div className="m-num" style={{ fontSize: 11, color: "var(--m-ink-3)" }}>
                    {s.days}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--m-ink-2)", marginTop: 12 }}>
              Mantén la racha y la planta crece. Si la rompes se marchita, pero revive
              en cuanto retomes el hábito.
            </p>
          </Card>
        </>
      )}
    </main>
  );
}
