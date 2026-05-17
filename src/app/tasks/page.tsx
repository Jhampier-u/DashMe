import { TasksBoard } from "@/components/TasksBoard";
import { SectionHeader } from "@/components/SectionHeader";
import { PageShell } from "@/components/PageShell";
import { PixelCard } from "@/components/PixelCard";
import { getTasksGrouped } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const grouped = await getTasksGrouped();
  const todo = grouped.TODO.length;
  const inProgress = grouped.IN_PROGRESS.length;
  const done = grouped.DONE.length;
  const total = todo + inProgress + done;

  return (
    <PageShell accent="var(--color-sky)">
      <SectionHeader
        title="Tareas"
        subtitle="Mueve tarjetas hacia la derecha y gana XP"
        emoji="📝"
        accent="var(--color-sky)"
      />

      <section className="grid grid-cols-4 gap-3">
        <PixelCard tone="surface" className="text-center hover-lift">
          <div className="font-display text-xl">{total}</div>
          <div className="text-base mt-1 opacity-80">total</div>
        </PixelCard>
        <PixelCard tone="sky" className="text-center hover-lift">
          <div className="font-display text-xl">{todo}</div>
          <div className="text-base mt-1 opacity-80">por iniciar</div>
        </PixelCard>
        <PixelCard tone="peach" className="text-center hover-lift">
          <div className="font-display text-xl">{inProgress}</div>
          <div className="text-base mt-1 opacity-80">en proceso</div>
        </PixelCard>
        <PixelCard tone="mint" className="text-center hover-lift">
          <div className="font-display text-xl">{done}</div>
          <div className="text-base mt-1 opacity-80">hechas</div>
        </PixelCard>
      </section>

      <section>
        <TasksBoard grouped={grouped} />
      </section>
    </PageShell>
  );
}
