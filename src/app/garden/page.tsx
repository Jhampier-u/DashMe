import Link from "next/link";
import { PixelWindow } from "@/components/PixelWindow";
import { PageShell } from "@/components/PageShell";
import { SectionHeader } from "@/components/SectionHeader";
import { GardenScene } from "@/components/GardenScene";
import { getHabitsWithTodayStatus } from "@/lib/habits";
import { stageFor, PLANT_SPECIES } from "@/lib/garden";

export const dynamic = "force-dynamic";

export default async function GardenPage() {
  const habits = await getHabitsWithTodayStatus();

  const totalPlants = habits.length;
  const blooming = habits.filter((h) => stageFor(h.streak) >= 4).length;
  const mature = habits.filter((h) => stageFor(h.streak) >= 3).length;
  const wilted = habits.filter(
    (h) => !h.doneToday && h.streak === 0 && h.hasEverBeenDone,
  ).length;
  const wateredToday = habits.filter((h) => h.doneToday).length;
  const oldestStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);

  // species breakdown
  const speciesCounts = new Map<string, number>();
  for (const h of habits) {
    speciesCounts.set(h.plantSpecies, (speciesCounts.get(h.plantSpecies) ?? 0) + 1);
  }

  return (
    <PageShell accent="var(--color-mint)">
      <SectionHeader
        title="Tu jardín"
        subtitle="Cada hábito es una planta. Riégalas todos los días para que crezcan."
        emoji="🌳"
        accent="var(--color-mint)"
      />

      {totalPlants === 0 ? (
        <PixelWindow title="Jardín vacío">
          <div className="text-center py-12">
            <div className="text-7xl mb-4 untap-bobble inline-block">🌱</div>
            <p className="text-[var(--color-ink-soft)] text-lg mb-2">
              Tu jardín está esperando su primera semilla.
            </p>
            <p className="text-[var(--color-ink-dim)] text-base mb-6">
              Crea un hábito para plantar y empezar a regar.
            </p>
            <Link
              href="/habits"
              className="pixel-button pixel-edge font-display uppercase text-[0.65rem] tracking-wider px-4 py-3 inline-block"
              style={{
                background: "var(--color-mint)",
                color: "var(--color-bg-deep)",
              }}
            >
              Ir a hábitos →
            </Link>
          </div>
        </PixelWindow>
      ) : (
        <>
          {/* Stats row */}
          <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard
              value={totalPlants}
              label="plantas"
              accent="var(--color-mint)"
            />
            <StatCard
              value={wateredToday}
              label="regadas hoy"
              accent="var(--color-sky)"
            />
            <StatCard
              value={mature}
              label="maduras"
              accent="var(--color-peach)"
            />
            <StatCard
              value={blooming}
              label="florecientes"
              accent="var(--color-pink)"
            />
            <StatCard
              value={oldestStreak}
              suffix="d"
              label="planta más vieja"
              accent="var(--color-lavender)"
            />
          </section>

          {/* The garden scene */}
          <section>
            <PixelWindow title={`El jardín · ${wateredToday}/${totalPlants} regadas`}>
              <GardenScene habits={habits} />
              <div className="text-center mt-3 text-base text-[var(--color-ink-soft)]">
                💡 Click en una planta para regarla · 👑 corona = hábito ancla ·
                ✨ aura = floreciente
              </div>
            </PixelWindow>
          </section>

          {/* Plant catalog */}
          <section>
            <PixelWindow title="Especies en tu jardín">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {PLANT_SPECIES.map((sp) => {
                  const count = speciesCounts.get(sp.key) ?? 0;
                  const active = count > 0;
                  return (
                    <div
                      key={sp.key}
                      className="p-3 pixel-edge-tight flex flex-col items-center gap-1"
                      style={{
                        background: active
                          ? "var(--color-bg-deep)"
                          : "var(--color-surface)",
                        opacity: active ? 1 : 0.45,
                      }}
                    >
                      <div className="text-3xl">{sp.sample}</div>
                      <div className="font-display text-[0.55rem] tracking-wider text-[var(--color-ink)]">
                        {sp.label.toUpperCase()}
                      </div>
                      <div className="font-display text-xs text-[var(--color-mint)]">
                        ×{count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </PixelWindow>
          </section>

          {/* Health alerts */}
          {wilted > 0 ? (
            <section>
              <div
                className="p-4 pixel-edge-tight flex items-center gap-3"
                style={{
                  background: "var(--color-pink-dark)",
                  color: "var(--color-ink)",
                }}
              >
                <span className="text-3xl">🥀</span>
                <div className="flex-1">
                  <div className="font-display text-[0.7rem] tracking-widest mb-1 text-[var(--color-pink)]">
                    PLANTAS MARCHITAS
                  </div>
                  <div className="text-base">
                    Tienes <strong>{wilted}</strong> planta{wilted === 1 ? "" : "s"} marchita{wilted === 1 ? "" : "s"}.
                    Riégala{wilted === 1 ? "" : "s"} hoy desde el jardín o desde la sección de hábitos para
                    revivirla{wilted === 1 ? "" : "s"}.
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {/* Growth guide */}
          <section>
            <PixelWindow title="Etapas de crecimiento">
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { stage: 0, label: "Semilla", days: "0d", emoji: "🟫" },
                  { stage: 1, label: "Brote", days: "1-2d", emoji: "🌱" },
                  { stage: 2, label: "Joven", days: "3-6d", emoji: "🌿" },
                  { stage: 3, label: "Madura", days: "7-13d", emoji: "🌷" },
                  { stage: 4, label: "Floreciente", days: "14d+", emoji: "🌻" },
                ].map((s) => (
                  <div
                    key={s.stage}
                    className="p-3 pixel-edge-tight flex flex-col items-center gap-1"
                    style={{ background: "var(--color-bg-deep)" }}
                  >
                    <div className="text-3xl">{s.emoji}</div>
                    <div className="font-display text-[0.55rem] tracking-wider text-[var(--color-mint)]">
                      {s.label.toUpperCase()}
                    </div>
                    <div className="text-[0.65rem] text-[var(--color-ink-dim)]">
                      {s.days}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-base text-[var(--color-ink-soft)] text-center mt-4 italic">
                Mantén la racha para que tu planta crezca. Si la rompes, se
                marchita 🥀 pero puedes revivirla retomando el hábito.
              </p>
            </PixelWindow>
          </section>
        </>
      )}
    </PageShell>
  );
}

function StatCard({
  value,
  label,
  accent,
  suffix,
}: {
  value: number;
  label: string;
  accent: string;
  suffix?: string;
}) {
  return (
    <div
      className="p-4 text-center pixel-edge-tight hover-lift"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="font-display text-xl" style={{ color: accent }}>
        {value}
        {suffix ?? ""}
      </div>
      <div className="text-sm mt-1 text-[var(--color-ink-soft)]">{label}</div>
    </div>
  );
}
