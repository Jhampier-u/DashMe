import { getHabitsWithTodayStatus, getPlayerLevelInfo, getHabitDiagnosis } from "@/lib/habits";
import { getTodayQuests } from "@/lib/quests";
import { Card } from "@/components/ui/Card";
import { QuestList } from "@/components/home/QuestList";
import { HabitsHeader } from "@/components/habits/HabitsHeader";
import { DayStatus } from "@/components/habits/DayStatus";
import { CriticalBanner } from "@/components/habits/CriticalBanner";
import { HabitRow } from "@/components/habits/HabitRow";
import { DiagnosisPanel } from "@/components/habits/DiagnosisPanel";

export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const [habits, player, quests, diagnosis] = await Promise.all([
    getHabitsWithTodayStatus(),
    getPlayerLevelInfo(),
    getTodayQuests(),
    getHabitDiagnosis(),
  ]);

  const scheduled = habits.filter((h) => h.scheduledToday);
  const done = scheduled.filter((h) => h.doneToday).length;

  return (
    <main className="m-root" style={{ minHeight: "100%", padding: "20px 16px 48px" }}>
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <HabitsHeader total={habits.length} />

        {habits.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 15, marginBottom: 6 }}>Aún no tienes hábitos.</p>
            <p style={{ fontSize: 13, color: "var(--m-ink-2)" }}>
              Crea el primero y empieza a construir una racha.
            </p>
          </Card>
        ) : (
          <>
            <CriticalBanner habits={habits} />
            <DayStatus initial={player} done={done} scheduled={scheduled.length} />
            <QuestList quests={quests} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  id={habit.id}
                  name={habit.name}
                  icon={habit.icon}
                  streak={habit.streak}
                  doneToday={habit.doneToday}
                  partialToday={habit.partialToday}
                  scheduledToday={habit.scheduledToday}
                  criticalToday={habit.criticalToday}
                  isAnchor={habit.isAnchor}
                  schedule={habit.schedule}
                  intention={habit.intention}
                  plantSpecies={habit.plantSpecies}
                  hasEverBeenDone={habit.hasEverBeenDone}
                  minimalGoal={habit.minimalGoal}
                />
              ))}
            </div>

            <DiagnosisPanel diagnosis={diagnosis} />
          </>
        )}
      </div>
    </main>
  );
}
