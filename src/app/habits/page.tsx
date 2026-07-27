import { PixelWindow } from "@/components/PixelWindow";
import { PixelCard } from "@/components/PixelCard";
import { HabitToggle } from "@/components/HabitToggle";
import { NewHabitForm } from "@/components/NewHabitForm";
import { PlayerStatus } from "@/components/PlayerStatus";
import { StatsPanel } from "@/components/StatsPanel";
import { SectionHeader } from "@/components/SectionHeader";
import { PageShell } from "@/components/PageShell";
import { DailyQuestsPanel } from "@/components/DailyQuestsPanel";
import { CriticalDayBanner } from "@/components/CriticalDayBanner";
import Link from "next/link";
import { getHabitsWithTodayStatus, getPlayerLevelInfo } from "@/lib/habits";
import { getGlobalStats } from "@/lib/stats";
import { getTodayQuests } from "@/lib/quests";

export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const [habits, levelInfo, globalStats, quests] = await Promise.all([
    getHabitsWithTodayStatus(),
    getPlayerLevelInfo(),
    getGlobalStats(),
    getTodayQuests(),
  ]);

  const completedToday = habits.filter((h) => h.doneToday).length;
  const maxStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);

  return (
    <PageShell accent="var(--color-mint)">
      <SectionHeader
        title="Hábitos"
        subtitle="Construye rachas, riega tu jardín, sube de nivel"
        emoji="🌱"
        accent="var(--color-mint)"
      />

      <CriticalDayBanner habits={habits} />

      <section>
        <PixelWindow title="Tu aventurero">
          <PlayerStatus
            initial={levelInfo}
            completedToday={completedToday}
            totalHabits={habits.length}
          />
        </PixelWindow>
      </section>

      <section>
        <DailyQuestsPanel quests={quests} />
      </section>

      <section className="grid grid-cols-3 gap-4">
        <PixelCard tone="mint" className="text-center hover-lift">
          <div className="font-display text-xl">{completedToday}</div>
          <div className="text-base mt-1 opacity-80">hoy</div>
        </PixelCard>
        <PixelCard tone="peach" className="text-center hover-lift">
          <div className="font-display text-xl">{maxStreak}</div>
          <div className="text-base mt-1 opacity-80">racha máx</div>
        </PixelCard>
        <PixelCard tone="sky" className="text-center hover-lift">
          <div className="font-display text-xl">{habits.length}</div>
          <div className="text-base mt-1 opacity-80">hábitos</div>
        </PixelCard>
      </section>

      {habits.length > 0 ? (
        <Link
          href="/garden"
          className="flex items-center gap-3 p-3 pixel-edge-tight hover-lift"
          style={{ background: "var(--color-bg)" }}
        >
          <span className="text-3xl untap-bobble">🌳</span>
          <div className="flex-1">
            <div className="font-display text-[0.65rem] tracking-wider text-[var(--color-mint)]">
              VER TU JARDÍN
            </div>
            <div className="text-base text-[var(--color-ink-soft)]">
              Escena completa con plantas, mariposas y ciclo día/noche
            </div>
          </div>
          <span className="font-display text-[0.6rem] text-[var(--color-peach)]">→</span>
        </Link>
      ) : null}

      <section>
        <PixelWindow title="Hábitos de hoy">
          {habits.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3 untap-bobble inline-block">🌱</div>
              <p className="text-[var(--color-ink-soft)] text-lg mb-1">
                Aún no tienes hábitos.
              </p>
              <p className="text-[var(--color-ink-dim)] text-base">
                Crea el primero abajo y planta tu primera semilla.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {habits.map((h) => (
                <HabitToggle
                  key={h.id}
                  id={h.id}
                  name={h.name}
                  icon={h.icon}
                  color={h.color}
                  streak={h.streak}
                  doneToday={h.doneToday}
                  partialToday={h.partialToday}
                  scheduledToday={h.scheduledToday}
                  criticalToday={h.criticalToday}
                  isAnchor={h.isAnchor}
                  schedule={h.schedule}
                  intention={h.intention}
                  plantSpecies={h.plantSpecies}
                  hasEverBeenDone={h.hasEverBeenDone}
                  minimalGoal={h.minimalGoal}
                />
              ))}
            </ul>
          )}
          <div className="flex justify-center mt-4">
            <NewHabitForm />
          </div>
        </PixelWindow>
      </section>

      <section>
        <StatsPanel stats={globalStats} />
      </section>
    </PageShell>
  );
}
