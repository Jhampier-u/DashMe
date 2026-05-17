"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteProject } from "@/app/actions";
import type { ProjectSummary } from "@/lib/projects";

const TONE_BG: Record<string, string> = {
  lavender: "var(--color-lavender)",
  mint: "var(--color-mint)",
  peach: "var(--color-peach)",
  sky: "var(--color-sky)",
  pink: "var(--color-pink)",
};

type Props = { project: ProjectSummary };

export function ProjectCard({ project }: Props) {
  const [pending, startTransition] = useTransition();
  const accent = TONE_BG[project.color] ?? TONE_BG.lavender;
  const percent =
    project.totalItems === 0 ? 0 : project.doneItems / project.totalItems;

  function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`¿Borrar el proyecto "${project.name}" y todas sus tareas?`)) return;
    const fd = new FormData();
    fd.set("id", project.id);
    startTransition(() => deleteProject(fd));
  }

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block hover-lift relative pixel-edge-tight"
      style={{
        background: "var(--color-bg)",
        opacity: pending ? 0.4 : 1,
      }}
    >
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ background: accent, color: "var(--color-bg-deep)" }}
      >
        <span className="text-3xl">{project.icon}</span>
        <span className="font-display text-sm tracking-wider flex-1 truncate">
          {project.name}
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="pixel-button font-display text-[0.5rem] px-2 py-1"
          style={{
            background: "var(--color-pink-dark)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 2px var(--color-bg-deep)",
          }}
          aria-label="Borrar proyecto"
        >
          ✕
        </button>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {project.description ? (
          <p className="text-base text-[var(--color-ink-soft)] line-clamp-2">
            {project.description}
          </p>
        ) : (
          <p className="text-base text-[var(--color-ink-dim)] italic">
            Sin descripción
          </p>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-ink-soft)]">
            {project.doneItems} / {project.totalItems} tareas
          </span>
          <span className="font-display text-[0.65rem]" style={{ color: accent }}>
            {Math.round(percent * 100)}%
          </span>
        </div>
        <div
          className="h-3 pixel-edge-tight"
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
      </div>
    </Link>
  );
}
