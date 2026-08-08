import { db } from "@/modules/core/db";
import {
  getHabitsWithTodayStatus,
  getPlayerLevelInfo,
  getHabitDiagnosis,
  getTodayQuests,
  dayKey,
} from "@/modules/habitos";
import { Card } from "@/modules/core/ui/Card";
import { QuestList } from "@/modules/habitos/components/home/QuestList";
import { HabitsHeader } from "@/modules/habitos/components/habits/HabitsHeader";
import { DayStatus } from "@/modules/habitos/components/habits/DayStatus";
import { CriticalBanner } from "@/modules/habitos/components/habits/CriticalBanner";
import { HabitRow } from "@/modules/habitos/components/habits/HabitRow";
import { DiagnosisPanel } from "@/modules/habitos/components/habits/DiagnosisPanel";

export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const [habits, player, quests, diagnosis] = await Promise.all([
    getHabitsWithTodayStatus(db),
    getPlayerLevelInfo(db),
    getTodayQuests(db),
    getHabitDiagnosis(db),
  ]);

  // El día se calcula AQUÍ, en el servidor, y viaja a las filas. La fecha del
  // navegador puede diferir y la nota acabaría guardada en otro día.
  const hoyISO = dayKey().toISOString().slice(0, 10);

  const scheduled = habits.filter((h) => h.scheduledToday);
  const done = scheduled.filter((h) => h.doneToday).length;

  return (
    /*
      Se cae la clase `.m-root`. Era lo que imponía fondo oscuro, tinta casi
      blanca y system-ui a todo lo de dentro, y con ella puesta las piezas ya
      repintadas seguían heredando la fuente equivocada. Ahora la pantalla pone
      su propio papel.

      Las secciones que aún no han llegado a su turno conservan `.m-root` en sus
      propias páginas, así que esto no las roza.

      El aire crece: 16px entre bloques se quedaba corto en cuanto cada uno pasó
      a llevar trazo de 3px y sombra dura. Con más peso alrededor hace falta más
      sitio entre medias, y la sombra necesita margen por abajo y por la derecha
      para no morderse con el bloque siguiente.
    */
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
          gap: 20,
        }}
      >
        <HabitsHeader total={habits.length} />

        {habits.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              Aún no tienes hábitos.
            </p>
            <p style={{ fontSize: 13 }}>
              Crea el primero y empieza a construir una racha.
            </p>
          </Card>
        ) : (
          <>
            <CriticalBanner habits={habits} />
            <DayStatus
              initial={player}
              done={done}
              scheduled={scheduled.length}
            />
            <QuestList quests={quests} />

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  id={habit.id}
                  name={habit.name}
                  icon={habit.icon}
                  color={habit.color}
                  streak={habit.streak}
                  doneToday={habit.doneToday}
                  registradoHoy={habit.registradoHoy}
                  rachaPerdonados={habit.rachaPerdonados}
                  partialToday={habit.partialToday}
                  targetCount={habit.targetCount}
                  countToday={habit.countToday}
                  notaHoy={habit.notaHoy}
                  hoyISO={hoyISO}
                  enPausaHoy={habit.enPausaHoy}
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
