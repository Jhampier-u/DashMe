"use client";

import { useState, useTransition } from "react";
import type { ProjectItemNode, ProjectItemStatus } from "@/lib/projects";
import {
  createProjectItem,
  updateProjectItemStatus,
  deleteProjectItem,
  renameProjectItem,
} from "@/app/actions";

const STATUS_CYCLE: Record<ProjectItemStatus, ProjectItemStatus> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "TODO",
};

const STATUS_LABEL: Record<ProjectItemStatus, string> = {
  TODO: "○",
  IN_PROGRESS: "◐",
  DONE: "●",
};

const STATUS_COLOR: Record<ProjectItemStatus, string> = {
  TODO: "var(--color-ink-dim)",
  IN_PROGRESS: "var(--color-peach)",
  DONE: "var(--color-mint)",
};

type Props = {
  node: ProjectItemNode;
  depth: number;
};

function dispatchXp(result: {
  xp: number;
  newLevel: number;
  progress: number;
  leveledUp: boolean;
}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("untap:xp", { detail: result }));
  if (result.leveledUp) {
    window.dispatchEvent(
      new CustomEvent("untap:levelup", { detail: { newLevel: result.newLevel } }),
    );
  }
}

export function ProjectTreeItem({ node, depth }: Props) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(node.title);
  const [newChildTitle, setNewChildTitle] = useState("");
  const [pending, startTransition] = useTransition();

  const hasChildren = node.children.length > 0;

  function cycleStatus() {
    const next = STATUS_CYCLE[node.status];
    startTransition(async () => {
      const result = await updateProjectItemStatus(node.id, next);
      dispatchXp(result);
    });
  }

  function remove() {
    if (!confirm(`¿Borrar "${node.title}" y sus subtareas?`)) return;
    startTransition(() => deleteProjectItem(node.id));
  }

  function saveRename() {
    const t = draftTitle.trim();
    if (!t || t === node.title) {
      setEditing(false);
      setDraftTitle(node.title);
      return;
    }
    startTransition(async () => {
      await renameProjectItem(node.id, t);
      setEditing(false);
    });
  }

  function submitChild(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = newChildTitle.trim();
    if (!t) return;
    startTransition(async () => {
      await createProjectItem(node.projectId, node.id, t);
      setNewChildTitle("");
      setAdding(false);
    });
  }

  const indent = depth * 1.25;

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center gap-2 py-2"
        style={{
          paddingLeft: `${indent}rem`,
          opacity: pending ? 0.5 : 1,
          borderLeft: depth > 0 ? "2px solid var(--color-border)" : "none",
          marginLeft: depth > 0 ? "0.5rem" : 0,
        }}
      >
        {/* expand/collapse */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={!hasChildren}
          className="pixel-button font-display text-[0.55rem] w-7 h-7 flex items-center justify-center"
          style={{
            background: hasChildren ? "var(--color-surface)" : "transparent",
            color: "var(--color-ink-soft)",
            boxShadow: hasChildren ? "0 0 0 2px var(--color-border)" : "none",
            visibility: hasChildren ? "visible" : "hidden",
          }}
          aria-label={open ? "Contraer" : "Expandir"}
        >
          {open ? "▼" : "▶"}
        </button>

        {/* status */}
        <button
          type="button"
          onClick={cycleStatus}
          disabled={pending}
          className="pixel-button font-display text-base w-7 h-7 flex items-center justify-center"
          style={{
            background: "var(--color-bg-deep)",
            color: STATUS_COLOR[node.status],
            boxShadow: "0 0 0 2px var(--color-border)",
          }}
          aria-label={`Cambiar estado (actual: ${node.status})`}
          title={node.status}
        >
          {STATUS_LABEL[node.status]}
        </button>

        {/* title */}
        {editing ? (
          <input
            autoFocus
            className="pixel-input flex-1"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setEditing(false);
                setDraftTitle(node.title);
              }
            }}
            maxLength={200}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-left flex-1 text-lg pixel-button px-2 py-1"
            style={{
              background: "transparent",
              color: "var(--color-ink)",
              textDecoration: node.status === "DONE" ? "line-through" : "none",
              opacity: node.status === "DONE" ? 0.7 : 1,
            }}
          >
            {node.title}
            {hasChildren ? (
              <span className="ml-2 text-[var(--color-ink-dim)] text-sm">
                ({node.children.filter((c) => c.status === "DONE").length}/
                {node.children.length})
              </span>
            ) : null}
          </button>
        )}

        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={pending}
          className="pixel-button font-display text-[0.55rem] px-2 py-1"
          style={{
            background: "var(--color-mint-dark)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 2px var(--color-border)",
          }}
          title="Añadir subtarea"
        >
          +
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="pixel-button font-display text-[0.55rem] px-2 py-1"
          style={{
            background: "var(--color-pink-dark)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 2px var(--color-border)",
          }}
          title="Borrar"
        >
          ✕
        </button>
      </div>

      {open && (hasChildren || adding) ? (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <ProjectTreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
          {adding ? (
            <form
              onSubmit={submitChild}
              className="flex gap-2 py-2"
              style={{
                paddingLeft: `${(depth + 1) * 1.25}rem`,
                borderLeft: "2px solid var(--color-border)",
                marginLeft: "0.5rem",
              }}
            >
              <input
                autoFocus
                className="pixel-input flex-1"
                placeholder="Nueva subtarea…"
                value={newChildTitle}
                onChange={(e) => setNewChildTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewChildTitle("");
                  }
                }}
                maxLength={200}
              />
              <button
                type="submit"
                disabled={pending || !newChildTitle.trim()}
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
                  setNewChildTitle("");
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
