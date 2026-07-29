import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/modules/core/db";
import { getProjectWithTree } from "@/modules/habitos";
import { Card } from "@/modules/core/ui/Card";
import { ProgressBar } from "@/modules/core/ui/ProgressBar";
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
          maxWidth: 820,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <Link
          href="/proyectos"
          style={{ fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}
        >
          ← Proyectos
        </Link>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }} aria-hidden>
              {project.icon}
            </span>
            {/* El nombre lo escribe el usuario, así que parte de línea en vez de
                desbordar. 14px es el suelo de Press Start 2P. */}
            <h1
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 14,
                lineHeight: 1.6,
                overflowWrap: "anywhere",
              }}
            >
              {project.name}
            </h1>
          </div>
          {project.description ? (
            <p style={{ fontSize: 13.5, marginTop: 8 }}>
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
            <span
              style={{
                fontFamily: "var(--font-vt)",
                fontSize: 18,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {doneItems} de {totalItems} · {Math.round(percent * 100)}%
            </span>
            <span style={{ fontSize: 11.5 }}>{movement}</span>
          </div>
          <ProgressBar value={percent} />
        </Card>

        <Card title="Subtareas">
          <ProjectTree projectId={project.id} roots={roots} />
        </Card>
      </div>
    </main>
  );
}
