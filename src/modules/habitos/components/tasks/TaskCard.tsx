"use client";

import { useState, useTransition } from "react";
import type { TaskRow, TaskStatus } from "@/modules/habitos/lib/tasks";
import { updateTaskStatus, deleteTask } from "@/modules/habitos/actions";
import { emitStatusChange } from "@/modules/habitos/lib/events";
import { useConfirm } from "@/modules/habitos/components/ConfirmDialog";
import { varColor, type ColorCategorico } from "@/modules/core/ui/paleta";
import { PriorityDot } from "./PriorityDot";
import { TaskTree } from "./TaskTree";

const NEXT: Record<TaskStatus, TaskStatus | null> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: null,
};
const PREV: Record<TaskStatus, TaskStatus | null> = {
  TODO: null,
  IN_PROGRESS: "TODO",
  DONE: "IN_PROGRESS",
};

/*
  Los tres botones son teclas del sistema. Van en clases y no en un objeto de
  estilo porque llevan `:active`, `:focus-visible` y `:disabled`, y nada de eso
  se puede escribir en línea.

  `disabled:opacity-40` sustituye al `opacity` que se calculaba a mano en cada
  uno, y de paso cubre el caso de `pending`, que antes se quedaba fuera.
*/
const MOVE_BUTTON =
  "w-[28px] h-[28px] shrink-0 inline-flex items-center justify-center " +
  "rounded-control border-3 border-line text-tinta text-xs leading-none " +
  "cursor-pointer shadow-hard font-cuerpo " +
  "transition-[transform,box-shadow] duration-75 ease-out " +
  "active:translate-x-0.5 active:translate-y-0.5 " +
  "active:shadow-[2px_2px_0_var(--color-line)] " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
  "disabled:opacity-40 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0";

export function TaskCard({
  task,
  categoria,
}: {
  task: TaskRow;
  categoria?: { name: string; color: ColorCategorico };
}) {
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const { confirm, dialog } = useConfirm();

  function move(target: TaskStatus | null) {
    if (!target) return;
    startTransition(async () => {
      emitStatusChange(await updateTaskStatus(task.id, target));
    });
  }

  async function remove() {
    const ok = await confirm({
      title: "Borrar tarea",
      message: `Se borrará "${task.title}".`,
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", task.id);
    startTransition(() => deleteTask(fd));
  }

  const next = NEXT[task.status];
  const prev = PREV[task.status];
  const done = task.status === "DONE";

  return (
    <div
      style={{
        background: "var(--color-paper)",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-hard)",
        padding: 14,
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        opacity: pending ? 0.5 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {task.priority ? <PriorityDot prioridad={task.priority} /> : null}
        <div style={{ minWidth: 0 }}>
          {/* Lo hecho se tacha en vez de apagarse de color: sobre papel, bajar
              el tono se come el contraste, y el tachado se ve sin distinguir
              tonos. */}
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              textDecoration: done ? "line-through" : "none",
              // El subrayado de categoría es un BORDE y no `text-decoration`,
              // que ya la usa el tachado. Las dos cosas no caben en la misma
              // propiedad.
              borderBottom: categoria
                ? `3px solid ${varColor(categoria.color)}`
                : "none",
              paddingBottom: categoria ? 2 : 0,
              display: "inline-block",
              overflowWrap: "anywhere",
            }}
          >
            {task.title}
          </div>
          {categoria ? (
            <div style={{ fontSize: 11, marginTop: 3 }}>{categoria.name}</div>
          ) : null}
        </div>
      </div>
      {task.description ? (
        <div style={{ fontSize: 12, marginTop: 6 }}>{task.description}</div>
      ) : null}
      {/*
        El resumen que había aquí pasa a ser el rótulo del botón: plegada, la
        tarjeta dice exactamente lo mismo que decía antes.
      */}
      {task.hijos.total > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
            className="mt-1.5 text-[11.5px] text-tinta font-cuerpo underline cursor-pointer bg-transparent border-0 p-0 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line"
          >
            {abierto ? "▾" : "▸"} {task.hijos.total} subtarea
            {task.hijos.total === 1 ? "" : "s"} · {task.hijos.hechos} hecha
            {task.hijos.hechos === 1 ? "" : "s"}
          </button>
          {abierto ? (
            <div style={{ marginTop: 8 }}>
              <TaskTree roots={task.arbol} />
            </div>
          ) : null}
        </>
      ) : null}

      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => move(prev)}
          disabled={!prev || pending}
          className={`${MOVE_BUTTON} bg-paper`}
          aria-label={`Mover ${task.title} hacia atrás`}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => move(next)}
          disabled={!next || pending}
          className={`${MOVE_BUTTON} bg-paper`}
          aria-label={`Mover ${task.title} hacia adelante`}
        >
          →
        </button>
        <span style={{ flex: 1 }} />
        {/* Peach es el acento destructivo del armazón, el mismo que en la fila
            de hábito y que la variante `danger` de <Button>. */}
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className={`${MOVE_BUTTON} bg-peach`}
          aria-label={`Borrar ${task.title}`}
        >
          ✕
        </button>
      </div>
      {dialog}
    </div>
  );
}
