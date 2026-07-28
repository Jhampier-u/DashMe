import { listProjects, getProjectMetrics } from "@/lib/projects";
import { Card } from "@/components/ui/Card";
import { ProjectsHeader } from "@/components/projects/ProjectsHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { AdvancePanel } from "@/components/projects/AdvancePanel";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, metrics] = await Promise.all([
    listProjects(),
    getProjectMetrics(),
  ]);

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
        <ProjectsHeader total={projects.length} />

        {projects.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 15, marginBottom: 6 }}>Aún no tienes proyectos.</p>
            <p style={{ fontSize: 13, color: "var(--m-ink-2)" }}>
              Crea el primero para descomponerlo en subtareas anidadas.
            </p>
          </Card>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
                alignItems: "start",
              }}
            >
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
            <AdvancePanel metrics={metrics} />
          </>
        )}
      </div>
    </main>
  );
}
