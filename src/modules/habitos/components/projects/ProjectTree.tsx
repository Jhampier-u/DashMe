"use client";

import { useState, useTransition } from "react";
import { createProjectItem } from "@/app/actions";
import type { ProjectItemNode } from "@/modules/habitos/lib/projects";
import { Button } from "@/modules/core/ui/Button";
import { ProjectTreeItem } from "./ProjectTreeItem";

export function ProjectTree({
  projectId,
  roots,
}: {
  projectId: string;
  roots: ProjectItemNode[];
}) {
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
    <div>
      {roots.length === 0 && !adding ? (
        <p style={{ fontSize: 13, color: "var(--m-ink-2)", padding: "12px 0" }}>
          Sin subtareas todavía. Añade la primera y empieza a anidar.
        </p>
      ) : (
        roots.map((node) => (
          <ProjectTreeItem key={node.id} node={node} depth={0} />
        ))
      )}

      {adding ? (
        <form onSubmit={submit} style={{ display: "flex", gap: 8, paddingTop: 8 }}>
          <input
            autoFocus
            value={title}
            maxLength={200}
            placeholder="Nueva subtarea…"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(false);
                setTitle("");
              }
            }}
            style={{
              flex: 1,
              background: "var(--m-page)",
              border: "1px solid var(--m-line)",
              borderRadius: 6,
              padding: "7px 10px",
              fontFamily: "inherit",
              fontSize: 13.5,
              color: "var(--m-ink)",
              outline: "none",
            }}
          />
          <Button type="submit" variant="primary" size="sm" disabled={pending || !title.trim()}>
            Añadir
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setAdding(false);
              setTitle("");
            }}
          >
            Cancelar
          </Button>
        </form>
      ) : (
        <div style={{ paddingTop: 12 }}>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            Añadir subtarea
          </Button>
        </div>
      )}
    </div>
  );
}
