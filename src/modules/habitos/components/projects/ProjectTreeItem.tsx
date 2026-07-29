"use client";

import { useState, useTransition } from "react";
import type { ProjectItemNode, ProjectItemStatus } from "@/modules/habitos/lib/projects";
import {
  createProjectItem,
  updateProjectItemStatus,
  deleteProjectItem,
  renameProjectItem,
} from "@/modules/habitos/actions";
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

/*
  La forma ya dice el estado —círculo vacío, medio y lleno—, así que el color
  era redundante. El glifo pasa a tinta y lo que marca el estado es el relleno
  del botón, con el mismo vocabulario que las columnas de tareas y el sello de
  la fila de hábito: tres pantallas diciendo «hecho» de la misma forma.
*/
const STATUS_FILL: Record<ProjectItemStatus, string> = {
  TODO: "var(--color-paper)",
  IN_PROGRESS: "var(--color-pink)",
  DONE: "var(--color-tinta)",
};

const STATUS_INK: Record<ProjectItemStatus, string> = {
  TODO: "var(--color-tinta)",
  IN_PROGRESS: "var(--color-tinta)",
  DONE: "var(--color-paper)",
};

const STATUS_NAME: Record<ProjectItemStatus, string> = {
  TODO: "por hacer",
  IN_PROGRESS: "en proceso",
  DONE: "hecha",
};

/*
  Van en clases y no en un objeto de estilo porque llevan `:active`,
  `:focus-visible` y `:disabled`, y nada de eso se puede escribir en línea.

  Sin sombra dura, al contrario que en tareas: el árbol pone cuatro botones por
  nodo y los nodos se anidan; la sombra lo convertiría en una pared. El hundido
  se queda en 1px.
*/
const ICON_BUTTON =
  "w-[26px] h-[26px] shrink-0 inline-flex items-center justify-center " +
  "rounded-control border-3 border-line text-tinta text-[11px] leading-none " +
  "cursor-pointer font-cuerpo " +
  "transition-transform duration-75 ease-out active:translate-x-px active:translate-y-px " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
  "disabled:opacity-40";

/*
  El campo de edición en línea. Está escrito igual aquí y en `ProjectTree`, así
  que se comparte desde un solo sitio.
*/
export const CAMPO_LINEA =
  "flex-1 min-w-0 bg-paper-2 text-tinta font-cuerpo text-[13.5px] " +
  "border-3 border-line rounded-control px-2.5 py-1.5 " +
  "placeholder:text-tinta-2 " +
  "outline-none focus:outline-3 focus:outline-offset-2 focus:outline-line";

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
          className={`${ICON_BUTTON} bg-paper`}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
          aria-label={open ? `Contraer ${node.title}` : `Expandir ${node.title}`}
          aria-expanded={open}
        >
          {open ? "▾" : "▸"}
        </button>

        <button
          type="button"
          onClick={cycle}
          disabled={pending}
          className={ICON_BUTTON}
          style={{
            background: STATUS_FILL[node.status],
            color: STATUS_INK[node.status],
            fontSize: 13,
          }}
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
            className={CAMPO_LINEA}
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
              fontFamily: "var(--font-cuerpo)",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              color: "var(--color-tinta)",
              textDecoration: node.status === "DONE" ? "line-through" : "none",
            }}
            aria-label={`Renombrar ${node.title}`}
          >
            {node.title}
            {hasChildren ? (
              // El contador es un dato: VT323 en su suelo de 16px.
              <span
                style={{
                  fontFamily: "var(--font-vt)",
                  fontSize: 16,
                  fontVariantNumeric: "tabular-nums",
                  marginLeft: 8,
                }}
              >
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
          className={`${ICON_BUTTON} bg-paper`}
          aria-label={`Añadir subtarea dentro de ${node.title}`}
        >
          +
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className={`${ICON_BUTTON} bg-peach`}
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
                className={CAMPO_LINEA}
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
