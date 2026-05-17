"use client";

import { useState, useTransition } from "react";
import { createProjectItem } from "@/app/actions";
import type { ProjectItemNode } from "@/lib/projects";
import { ProjectTreeItem } from "./ProjectTreeItem";

type Props = {
  projectId: string;
  roots: ProjectItemNode[];
};

export function ProjectTreeRoot({ projectId, roots }: Props) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      await createProjectItem(projectId, null, t);
      setTitle("");
      setAdding(false);
    });
  }

  return (
    <div className="flex flex-col">
      {roots.length === 0 && !adding ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3 untap-bobble inline-block">🌳</div>
          <p className="text-[var(--color-ink-soft)] text-lg mb-1">
            Sin tareas todavía
          </p>
          <p className="text-[var(--color-ink-dim)] text-base">
            Añade la primera y empieza a anidar
          </p>
        </div>
      ) : (
        roots.map((node) => (
          <ProjectTreeItem key={node.id} node={node} depth={0} />
        ))
      )}

      {adding ? (
        <form onSubmit={submit} className="flex gap-2 py-2 mt-2">
          <input
            autoFocus
            className="pixel-input flex-1"
            placeholder="Nueva tarea raíz…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(false);
                setTitle("");
              }
            }}
            maxLength={200}
          />
          <button
            type="submit"
            disabled={pending || !title.trim()}
            className="pixel-button font-display text-[0.55rem] px-3"
            style={{
              background: "var(--color-mint)",
              color: "var(--color-bg-deep)",
              boxShadow: "0 0 0 2px var(--color-border)",
            }}
          >
            AÑADIR
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setTitle("");
            }}
            className="pixel-button font-display text-[0.55rem] px-3"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              boxShadow: "0 0 0 2px var(--color-border)",
            }}
          >
            ✕
          </button>
        </form>
      ) : (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="pixel-button pixel-edge font-display text-[0.65rem] tracking-wider px-4 py-3"
            style={{
              background: "var(--color-mint)",
              color: "var(--color-bg-deep)",
            }}
          >
            + Nueva tarea
          </button>
        </div>
      )}
    </div>
  );
}
