import { db } from "@/modules/core/db";
import { listProjects, getProjectMetrics } from "@/modules/habitos";
import { Card } from "@/modules/core/ui/Card";
import { ProjectsHeader } from "@/modules/habitos/components/projects/ProjectsHeader";
import { ProjectCard } from "@/modules/habitos/components/projects/ProjectCard";
import { AdvancePanel } from "@/modules/habitos/components/projects/AdvancePanel";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, metrics] = await Promise.all([
    listProjects(db),
    getProjectMetrics(db),
  ]);

  return (
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
        <ProjectsHeader total={projects.length} />

        {projects.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              Aún no tienes proyectos.
            </p>
            <p style={{ fontSize: 13 }}>
              Crea el primero para descomponerlo en subtareas anidadas.
            </p>
          </Card>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
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
