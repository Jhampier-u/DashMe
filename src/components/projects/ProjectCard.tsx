"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteProject } from "@/app/actions";
import { useConfirm } from "@/components/PixelConfirm";
import type { ProjectSummary } from "@/lib/projects";

/** Cuánto tiempo parado empieza a ser señal de aviso. */
const STALE_DAYS = 14;

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const percent =
    project.totalItems === 0 ? 0 : project.doneItems / project.totalItems;
  const stale = project.lastMovement.days >= STALE_DAYS;

  async function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirm({
      title: "Borrar proyecto",
      message: `Se borrará "${project.name}" y todas sus subtareas.`,
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", project.id);
    startTransition(() => deleteProject(fd));
  }

  const movement =
    project.lastMovement.from === "creation"
      ? project.lastMovement.days === 0
        ? "creado hoy, sin avances"
        : `sin avances desde que se creó, hace ${project.lastMovement.days} días`
      : project.lastMovement.days === 0
        ? "avanzaste hoy"
        : `último avance hace ${project.lastMovement.days} días`;

  return (
    <div
      className="m-card"
      style={{ padding: 16, opacity: pending ? 0.5 : 1, position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 20 }} aria-hidden>
          {project.icon}
        </span>
        <Link
          href={`/projects/${project.id}`}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 15,
            fontWeight: 600,
            color: "var(--m-ink)",
            textDecoration: "none",
          }}
        >
          {project.name}
        </Link>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          style={{
            width: 24,
            height: 24,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            border: "1px solid var(--m-line)",
            background: "transparent",
            color: "var(--m-crit)",
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          aria-label={`Borrar el proyecto ${project.name}`}
        >
          ✕
        </button>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 8, minHeight: 18 }}>
        {project.description ?? "Sin descripción"}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--m-ink-3)",
          marginTop: 12,
          marginBottom: 6,
        }}
      >
        <span className="m-num">
          {project.doneItems} de {project.totalItems}
        </span>
        <span className="m-num">{Math.round(percent * 100)}%</span>
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

      <div
        style={{
          fontSize: 11.5,
          color: stale ? "var(--m-warn)" : "var(--m-ink-3)",
          marginTop: 10,
        }}
      >
        {stale ? "▲ " : ""}
        {movement}
      </div>
      {dialog}
    </div>
  );
}
