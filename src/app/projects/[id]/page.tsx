import { notFound } from "next/navigation";
import Link from "next/link";
import { PixelWindow } from "@/components/PixelWindow";
import { PageShell } from "@/components/PageShell";
import { ProjectTreeRoot } from "@/components/ProjectTreeRoot";
import { getProjectWithTree } from "@/lib/projects";

export const dynamic = "force-dynamic";

const TONE_BG: Record<string, string> = {
  lavender: "var(--color-lavender)",
  mint: "var(--color-mint)",
  peach: "var(--color-peach)",
  sky: "var(--color-sky)",
  pink: "var(--color-pink)",
};

export default async function ProjectDetailPage({
  params,
}: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const result = await getProjectWithTree(id);
  if (!result) notFound();
  const { project, roots, totalItems, doneItems } = result;
  const accent = TONE_BG[project.color] ?? TONE_BG.lavender;
  const percent = totalItems === 0 ? 0 : doneItems / totalItems;

  return (
    <PageShell accent={accent}>
      <div className="flex items-center gap-3 untap-slide-in">
        <Link
          href="/projects"
          className="pixel-button font-display text-[0.55rem] px-2 py-2"
          style={{
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 3px var(--color-border)",
          }}
        >
          ◄
        </Link>
        <div
          className="flex-1 pixel-edge-tight px-4 py-3 flex items-center gap-3"
          style={{ background: accent, color: "var(--color-bg-deep)" }}
        >
          <span className="text-3xl untap-bobble">{project.icon}</span>
          <div className="flex-1">
            <h1 className="font-display text-base sm:text-lg tracking-widest">
              {project.name.toUpperCase()}
            </h1>
            {project.description ? (
              <p className="text-base mt-1 opacity-80">{project.description}</p>
            ) : null}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-3 gap-4">
        <div
          className="p-4 text-center pixel-edge-tight hover-lift"
          style={{ background: "var(--color-bg)" }}
        >
          <div className="font-display text-xl" style={{ color: accent }}>
            {totalItems}
          </div>
          <div className="text-base mt-1 opacity-80">tareas</div>
        </div>
        <div
          className="p-4 text-center pixel-edge-tight hover-lift"
          style={{ background: "var(--color-bg)" }}
        >
          <div className="font-display text-xl text-[var(--color-mint)]">
            {doneItems}
          </div>
          <div className="text-base mt-1 opacity-80">completadas</div>
        </div>
        <div
          className="p-4 text-center pixel-edge-tight hover-lift"
          style={{ background: "var(--color-bg)" }}
        >
          <div className="font-display text-xl text-[var(--color-peach)]">
            {Math.round(percent * 100)}%
          </div>
          <div className="text-base mt-1 opacity-80">progreso</div>
        </div>
      </section>

      <div
        className="h-4 pixel-edge-tight"
        style={{ background: "var(--color-bg-deep)" }}
      >
        <div
          className="h-full"
          style={{
            width: `${Math.round(percent * 100)}%`,
            background: accent,
            transition: "width 300ms steps(8)",
          }}
        />
      </div>

      <section>
        <PixelWindow title="Árbol de tareas">
          <ProjectTreeRoot projectId={project.id} roots={roots} />
        </PixelWindow>
      </section>

      <div className="text-center text-[var(--color-ink-dim)] text-base">
        💡 Click en el círculo para cambiar estado · Click en el título para
        renombrar · <strong>+</strong> para anidar subtareas infinitamente
      </div>
    </PageShell>
  );
}
