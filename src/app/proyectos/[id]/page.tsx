import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/modules/core/db";
import { getProjectWithTree } from "@/modules/habitos";
import { Card } from "@/modules/core/ui/Card";
import { ProjectTree } from "@/modules/habitos/components/projects/ProjectTree";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: PageProps<"/proyectos/[id]">) {
  const { id } = await params;
  const result = await getProjectWithTree(db, id);
  if (!result) notFound();

  const { project, roots, totalItems, doneItems, lastMovement } = result;
  const percent = totalItems === 0 ? 0 : doneItems / totalItems;

  const movement =
    lastMovement.from === "creation"
      ? "sin avances todavía"
      : lastMovement.days === 0
        ? "último avance hoy"
        : `último avance hace ${lastMovement.days} días`;

  return (
    <main className="m-root" style={{ minHeight: "100%", padding: "20px 16px 48px" }}>
      <div
        style={{
          maxWidth: 820,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Link
          href="/proyectos"
          style={{ fontSize: 12.5, color: "var(--m-ink-2)", textDecoration: "none" }}
        >
          ← Proyectos
        </Link>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }} aria-hidden>
              {project.icon}
            </span>
            <h1 style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-0.02em" }}>
              {project.name}
            </h1>
          </div>
          {project.description ? (
            <p style={{ fontSize: 13.5, color: "var(--m-ink-2)", marginTop: 6 }}>
              {project.description}
            </p>
          ) : null}
        </div>

        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <span className="m-num" style={{ fontSize: 15, fontWeight: 600 }}>
              {doneItems} de {totalItems} · {Math.round(percent * 100)}%
            </span>
            <span style={{ fontSize: 11.5, color: "var(--m-ink-3)" }}>{movement}</span>
          </div>
          <div style={{ height: 5, background: "var(--m-track)", borderRadius: 3 }}>
            <div
              style={{
                height: "100%",
                width: `${Math.round(percent * 100)}%`,
                background: "var(--m-series)",
                borderRadius: 3,
              }}
            />
          </div>
        </Card>

        <Card title="Subtareas">
          <ProjectTree projectId={project.id} roots={roots} />
        </Card>
      </div>
    </main>
  );
}
