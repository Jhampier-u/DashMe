import Link from "next/link";
import { Card } from "@/modules/core/ui/Card";
import { PageHeader } from "@/modules/core/ui/PageHeader";
import { buttonStyle } from "@/modules/core/ui/Button";
import { Stat, StatGrid } from "@/modules/core/ui/Stat";
import { GardenScene } from "@/modules/habitos/components/GardenScene";
import { db } from "@/modules/core/db";
import {
  getHabitsWithTodayStatus,
  isPlantWilted,
  stageFor,
} from "@/modules/habitos";

export const dynamic = "force-dynamic";

const STAGES = [
  { emoji: "🟫", label: "Semilla", days: "0 d" },
  { emoji: "🌱", label: "Brote", days: "1-2 d" },
  { emoji: "🌿", label: "Joven", days: "3-6 d" },
  { emoji: "🌷", label: "Madura", days: "7-13 d" },
  { emoji: "🌻", label: "Floreciente", days: "14 d o más" },
];

export default async function GardenPage() {
  const habits = await getHabitsWithTodayStatus(db);

  const total = habits.length;
  const wateredToday = habits.filter((h) => h.doneToday).length;
  const mature = habits.filter((h) => stageFor(h.streak) >= 3).length;
  const blooming = habits.filter((h) => stageFor(h.streak) >= 4).length;
  const wilted = habits.filter((h) =>
    isPlantWilted(h.streak, h.doneToday, h.hasEverBeenDone),
  ).length;

  // Le llegó su turno, así que el escudo `.m-root` se retira: la pantalla pone
  // ya su propio papel.
  return (
    <main
      style={{
        minHeight: "100%",
        padding: "24px 16px 56px",
        background: "var(--color-paper)",
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
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
            <p style={{ fontSize: 15, marginBottom: 6 }}>
              Tu jardín está esperando su primera semilla.
            </p>
            <p style={{ fontSize: 13, marginBottom: 20 }}>
              Crea un hábito para plantar y empezar a regar.
            </p>
            <Link href="/habitos" style={buttonStyle("primary")}>
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
                  {/* Iba en rojo. Lo que avisa ahora son el 🥀 de al lado y el
                      grosor: el aviso no puede depender del tono. */}
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {wilted === 1 ? "Una planta marchita" : `${wilted} plantas marchitas`}
                  </div>
                  <p style={{ fontSize: 12.5, marginTop: 4 }}>
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
            <p style={{ fontSize: 12, marginTop: 10 }}>
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
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                    {s.label}
                  </div>
                  {/* Los días son un dato: VT323 en su suelo de 16px. */}
                  <div
                    style={{
                      fontFamily: "var(--font-vt)",
                      fontSize: 16,
                      lineHeight: 1.1,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {s.days}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, marginTop: 12 }}>
              Mantén la racha y la planta crece. Si la rompes se marchita, pero revive
              en cuanto retomes el hábito.
            </p>
          </Card>
        </>
      )}
    </main>
  );
}
