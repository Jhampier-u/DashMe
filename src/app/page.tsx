import Link from "next/link";
import { PixelWindow } from "@/components/PixelWindow";
import { PixelCard } from "@/components/PixelCard";
import { PageShell } from "@/components/PageShell";
import { Greeting } from "@/components/Greeting";
import { PlayerStatus } from "@/components/PlayerStatus";
import { HabitToggle } from "@/components/HabitToggle";
import { DailyQuestsPanel } from "@/components/DailyQuestsPanel";
import { CriticalDayBanner } from "@/components/CriticalDayBanner";
import { getHabitsWithTodayStatus, getPlayerLevelInfo } from "@/lib/habits";
import { getGlobalStats } from "@/lib/stats";
import { getTasksGrouped } from "@/lib/tasks";
import { listProjects } from "@/lib/projects";
import { getTodayQuests } from "@/lib/quests";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [habits, levelInfo, globalStats, tasksGrouped, projects, quests] =
    await Promise.all([
      getHabitsWithTodayStatus(),
      getPlayerLevelInfo(),
      getGlobalStats(),
      getTasksGrouped(),
      listProjects(),
      getTodayQuests(),
    ]);

  const completedToday = habits.filter((h) => h.doneToday).length;
  const tasksOpen = tasksGrouped.TODO.length + tasksGrouped.IN_PROGRESS.length;
  const projectsActive = projects.length;
  const questsDone = quests.filter((q) => q.completed).length;

  return (
    <PageShell accent="var(--color-peach)">
      <Greeting />

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

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/habits" className="hover-lift">
          <PixelCard tone="mint" className="text-center h-full">
            <div className="font-display text-lg">
              {completedToday}/{habits.length}
            </div>
            <div className="text-base mt-1 opacity-80">hábitos hoy</div>
          </PixelCard>
        </Link>
        <Link href="/tasks" className="hover-lift">
          <PixelCard tone="sky" className="text-center h-full">
            <div className="font-display text-lg">{tasksOpen}</div>
            <div className="text-base mt-1 opacity-80">tareas abiertas</div>
          </PixelCard>
        </Link>
        <Link href="/projects" className="hover-lift">
          <PixelCard tone="lavender" className="text-center h-full">
            <div className="font-display text-lg">{projectsActive}</div>
            <div className="text-base mt-1 opacity-80">proyectos</div>
          </PixelCard>
        </Link>
        <PixelCard tone="peach" className="text-center hover-lift">
          <div className="font-display text-lg">
            {questsDone}/{quests.length}
          </div>
          <div className="text-base mt-1 opacity-80">misiones</div>
        </PixelCard>
      </section>

      {habits.length > 0 ? (
        <>
          <section>
            <Link
              href="/garden"
              className="flex items-center gap-3 p-3 pixel-edge-tight hover-lift"
              style={{ background: "var(--color-bg)" }}
            >
              <span className="text-3xl untap-bobble">🌳</span>
              <div className="flex-1">
                <div className="font-display text-[0.65rem] tracking-wider text-[var(--color-mint)]">
                  TU JARDÍN
                </div>
                <div className="text-base text-[var(--color-ink-soft)]">
                  {habits.filter((h) => h.doneToday).length}/{habits.length} plantas regadas hoy · entra a regar
                </div>
              </div>
              <span className="font-display text-[0.6rem] text-[var(--color-peach)]">→</span>
            </Link>
          </section>
          <section>
            <PixelWindow title="Hábitos rápidos · hoy">
              <ul className="flex flex-col gap-2">
                {habits.slice(0, 5).map((h) => (
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
              {habits.length > 5 ? (
                <div className="text-center mt-3">
                  <Link
                    href="/habits"
                    className="font-display text-[0.6rem] tracking-wider text-[var(--color-mint)] hover:text-[var(--color-peach)] underline"
                  >
                    VER TODOS ({habits.length}) →
                  </Link>
                </div>
              ) : null}
            </PixelWindow>
          </section>
        </>
      ) : (
        <section>
          <PixelWindow title="¿Por dónde empezamos?">
            <div className="text-center py-6">
              <div className="text-5xl mb-3 untap-bobble inline-block">🌱</div>
              <p className="text-[var(--color-ink-soft)] text-lg mb-4">
                Crea tu primer hábito y planta tu primera semilla
              </p>
              <Link
                href="/habits"
                className="pixel-button pixel-edge font-display uppercase text-[0.65rem] tracking-wider px-4 py-3 inline-block"
                style={{
                  background: "var(--color-mint)",
                  color: "var(--color-bg-deep)",
                }}
              >
                Ir a hábitos
              </Link>
            </div>
          </PixelWindow>
        </section>
      )}

      {projects.length > 0 ? (
        <section>
          <PixelWindow title="Proyectos en marcha">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects.slice(0, 4).map((p) => {
                const pct =
                  p.totalItems === 0 ? 0 : p.doneItems / p.totalItems;
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 p-3 pixel-edge-tight hover-lift"
                    style={{ background: "var(--color-bg-deep)" }}
                  >
                    <span className="text-2xl">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-[var(--color-ink)] truncate">
                        {p.name}
                      </div>
                      <div className="text-sm text-[var(--color-ink-dim)]">
                        {p.doneItems}/{p.totalItems} · {Math.round(pct * 100)}%
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="text-center mt-3">
              <Link
                href="/projects"
                className="font-display text-[0.6rem] tracking-wider text-[var(--color-lavender)] hover:text-[var(--color-peach)] underline"
              >
                VER TODOS LOS PROYECTOS →
              </Link>
            </div>
          </PixelWindow>
        </section>
      ) : null}

      <footer className="text-center text-base text-[var(--color-ink-dim)]">
        Esta semana: {globalStats.weekCompletions} cumplimientos · Sigue
        construyendo tu mundo ✨
      </footer>
    </PageShell>
  );
}
