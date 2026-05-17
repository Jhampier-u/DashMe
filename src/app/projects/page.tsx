import { SectionHeader } from "@/components/SectionHeader";
import { PageShell } from "@/components/PageShell";
import { PixelWindow } from "@/components/PixelWindow";
import { ProjectCard } from "@/components/ProjectCard";
import { NewProjectForm } from "@/components/NewProjectForm";
import { listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <PageShell accent="var(--color-lavender)">
      <SectionHeader
        title="Proyectos"
        subtitle="Cada gran misión empieza con una pequeña tarea"
        emoji="📁"
        accent="var(--color-lavender)"
      />

      {projects.length === 0 ? (
        <PixelWindow title="Sin proyectos">
          <div className="text-center py-8">
            <div className="text-5xl mb-3 untap-bobble inline-block">🚀</div>
            <p className="text-[var(--color-ink-soft)] text-lg mb-1">
              Aún no tienes proyectos.
            </p>
            <p className="text-[var(--color-ink-dim)] text-base mb-4">
              Crea uno para descomponerlo en tareas y subtareas anidadas.
            </p>
            <div className="flex justify-center">
              <NewProjectForm />
            </div>
          </div>
        </PixelWindow>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </section>
          <div className="flex justify-center">
            <NewProjectForm />
          </div>
        </>
      )}
    </PageShell>
  );
}
