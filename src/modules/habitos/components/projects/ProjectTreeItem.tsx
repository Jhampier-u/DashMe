"use client";

import { useState, useTransition } from "react";
import type { ProjectItemNode, ProjectItemStatus } from "@/modules/habitos/lib/projects";
import {
  createProjectItem,
  updateProjectItemStatus,
  deleteProjectItem,
  renameProjectItem,
} from "@/app/actions";
import { emitStatusChange } from "@/modules/habitos/lib/events";
import { useConfirm } from "@/modules/habitos/components/ConfirmDialog";
import { Button } from "@/modules/core/ui/Button";

const STATUS_CYCLE: Record<ProjectItemStatus, ProjectItemStatus> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "TODO",
};

const STATUS_MARK: Record<ProjectItemStatus, string> = {
  TODO: "○",
  IN_PROGRESS: "◐",
  DONE: "●",
};

const STATUS_COLOR: Record<ProjectItemStatus, string> = {
  TODO: "var(--m-ink-3)",
  IN_PROGRESS: "var(--m-warn)",
  DONE: "var(--m-good)",
};

const STATUS_NAME: Record<ProjectItemStatus, string> = {
  TODO: "por hacer",
  IN_PROGRESS: "en proceso",
  DONE: "hecha",
};

const ICON_BUTTON = {
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  border: "1px solid var(--m-line)",
  background: "transparent",
  color: "var(--m-ink-3)",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

export function ProjectTreeItem({
  node,
  depth,
}: {
  node: ProjectItemNode;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.title);
  const [childTitle, setChildTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  // Si el título cambia en el servidor, el borrador lo sigue mientras no
  // estemos editando.
  const [lastTitle, setLastTitle] = useState(node.title);
  if (lastTitle !== node.title) {
    setLastTitle(node.title);
    if (!editing) setDraft(node.title);
  }

  const hasChildren = node.children.length > 0;

  function cycle() {
    startTransition(async () => {
      emitStatusChange(
        await updateProjectItemStatus(node.id, STATUS_CYCLE[node.status]),
      );
    });
  }

  async function remove() {
    const ok = await confirm({
      title: "Borrar subtarea",
      message: hasChildren
        ? `Se borrará "${node.title}" y todas sus subtareas.`
        : `Se borrará "${node.title}".`,
    });
    if (!ok) return;
    startTransition(() => deleteProjectItem(node.id));
  }

  function saveRename() {
    const t = draft.trim();
    if (!t || t === node.title) {
      setEditing(false);
      setDraft(node.title);
      return;
    }
    startTransition(async () => {
      await renameProjectItem(node.id, t);
      setEditing(false);
    });
  }

  function submitChild(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = childTitle.trim();
    if (!t) return;
    startTransition(async () => {
      await createProjectItem(node.projectId, node.id, t);
      setChildTitle("");
      setAdding(false);
    });
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 0",
          paddingLeft: depth * 20,
          opacity: pending ? 0.5 : 1,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{ ...ICON_BUTTON, visibility: hasChildren ? "visible" : "hidden" }}
          aria-label={open ? `Contraer ${node.title}` : `Expandir ${node.title}`}
          aria-expanded={open}
        >
          {open ? "▾" : "▸"}
        </button>

        <button
          type="button"
          onClick={cycle}
          disabled={pending}
          style={{ ...ICON_BUTTON, color: STATUS_COLOR[node.status], fontSize: 13 }}
          aria-label={`${node.title}: ${STATUS_NAME[node.status]}. Pulsa para cambiar de estado`}
        >
          {STATUS_MARK[node.status]}
        </button>

        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(node.title);
              }
            }}
            style={{
              flex: 1,
              background: "var(--m-page)",
              border: "1px solid var(--m-series)",
              borderRadius: 6,
              padding: "5px 9px",
              fontFamily: "inherit",
              fontSize: 13.5,
              color: "var(--m-ink)",
              outline: "none",
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              flex: 1,
              textAlign: "left",
              background: "transparent",
              border: 0,
              padding: "5px 0",
              fontFamily: "inherit",
              fontSize: 13.5,
              cursor: "pointer",
              color: node.status === "DONE" ? "var(--m-ink-2)" : "var(--m-ink)",
              textDecoration: node.status === "DONE" ? "line-through" : "none",
            }}
            aria-label={`Renombrar ${node.title}`}
          >
            {node.title}
            {hasChildren ? (
              <span className="m-num" style={{ color: "var(--m-ink-3)", marginLeft: 8 }}>
                {node.children.filter((c) => c.status === "DONE").length}/
                {node.children.length}
              </span>
            ) : null}
          </button>
        )}

        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={pending}
          style={ICON_BUTTON}
          aria-label={`Añadir subtarea dentro de ${node.title}`}
        >
          +
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          style={{ ...ICON_BUTTON, color: "var(--m-crit)" }}
          aria-label={`Borrar ${node.title}`}
        >
          ✕
        </button>
      </div>

      {open && (hasChildren || adding) ? (
        <div>
          {node.children.map((child) => (
            <ProjectTreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
          {adding ? (
            <form
              onSubmit={submitChild}
              style={{ display: "flex", gap: 8, padding: "6px 0", paddingLeft: (depth + 1) * 20 }}
            >
              <input
                autoFocus
                value={childTitle}
                maxLength={200}
                placeholder="Nueva subtarea…"
                onChange={(e) => setChildTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setAdding(false);
                    setChildTitle("");
                  }
                }}
                style={{
                  flex: 1,
                  background: "var(--m-page)",
                  border: "1px solid var(--m-line)",
                  borderRadius: 6,
                  padding: "5px 9px",
                  fontFamily: "inherit",
                  fontSize: 13.5,
                  color: "var(--m-ink)",
                  outline: "none",
                }}
              />
              <Button type="submit" size="sm" variant="primary" disabled={!childTitle.trim()}>
                Añadir
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setAdding(false);
                  setChildTitle("");
                }}
              >
                Cancelar
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      {dialog}
    </div>
  );
}
