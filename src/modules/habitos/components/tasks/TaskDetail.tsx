"use client";

import { useState, useTransition } from "react";
import { Card } from "@/modules/core/ui/Card";
import { varColor } from "@/modules/core/ui/paleta";
import {
  cambiarCategoriaTarea,
  cambiarDescripcionTarea,
  cambiarPrioridadTarea,
  renameTask,
  updateTaskStatus,
} from "@/modules/habitos/actions";
import { emitStatusChange } from "@/modules/habitos/lib/events";
import type { Adjunto } from "@/modules/habitos/lib/adjuntos";
import type { Categoria } from "@/modules/habitos/lib/categorias";
import {
  PRIORIDADES,
  PRIORIDAD_DEFS,
  prioridadColorVar,
  type Prioridad,
} from "@/modules/habitos/lib/prioridad";
import {
  STATUS_LABEL,
  TASK_STATUSES,
  type TaskDetalle,
  type TaskStatus,
} from "@/modules/habitos/lib/tasks";
import { AttachmentList } from "./AttachmentList";
import { TaskTree } from "./TaskTree";

/** La cápsula de los selectores: la misma forma en los tres. */
const OPCION =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control " +
  "border-3 border-line text-tinta font-cuerpo text-xs cursor-pointer " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line";

const ROTULO = "block text-xs font-semibold text-tinta font-cuerpo mb-1.5";

const CAMPO =
  "w-full bg-paper-2 text-tinta font-cuerpo border-3 border-line " +
  "rounded-control px-2.5 py-2 outline-none " +
  "focus:outline-3 focus:outline-offset-2 focus:outline-line";

export function TaskDetail({
  tarea,
  categorias,
  adjuntos,
}: {
  tarea: TaskDetalle;
  categorias: Categoria[];
  adjuntos: Adjunto[];
}) {
  const [titulo, setTitulo] = useState(tarea.title);
  const [desc, setDesc] = useState(tarea.description ?? "");
  const [pending, startTransition] = useTransition();

  /*
    El título y la descripción se guardan al SALIR del campo, no con un botón.
    Es una pantalla de un solo objeto: un botón «guardar» por campo sobra, y uno
    global obligaría a mantener un estado de «sin guardar» que aquí no aporta.
  */
  function guardarTitulo() {
    const t = titulo.trim();
    if (!t || t === tarea.title) {
      setTitulo(tarea.title);
      return;
    }
    startTransition(() => renameTask(tarea.id, t));
  }

  function guardarDesc() {
    if (desc === (tarea.description ?? "")) return;
    startTransition(() => cambiarDescripcionTarea(tarea.id, desc));
  }

  function mover(s: TaskStatus) {
    startTransition(async () => {
      emitStatusChange(await updateTaskStatus(tarea.id, s));
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        opacity: pending ? 0.6 : 1,
      }}
    >
      <Card>
        <label className={ROTULO} htmlFor="titulo">
          Título
        </label>
        <input
          id="titulo"
          value={titulo}
          maxLength={120}
          onChange={(e) => setTitulo(e.target.value)}
          onBlur={guardarTitulo}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setTitulo(tarea.title);
          }}
          className={`${CAMPO} text-[15px] font-bold`}
        />

        <div style={{ marginTop: 14 }}>
          <label className={ROTULO} htmlFor="desc">
            Descripción
          </label>
          <textarea
            id="desc"
            value={desc}
            rows={4}
            maxLength={500}
            placeholder="Detalles…"
            onChange={(e) => setDesc(e.target.value)}
            onBlur={guardarDesc}
            className={`${CAMPO} text-[13.5px] resize-y placeholder:text-tinta-2`}
          />
        </div>
      </Card>

      <Card>
        <span className={ROTULO}>Estado</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TASK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => mover(s)}
              aria-pressed={tarea.status === s}
              className={OPCION}
              style={{
                background:
                  tarea.status === s ? "var(--color-pink)" : "var(--color-paper)",
                boxShadow: tarea.status === s ? "var(--shadow-hard)" : "none",
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <span className={ROTULO}>Prioridad</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRIORIDADES.map((p: Prioridad) => (
              <button
                key={p}
                type="button"
                onClick={() =>
                  startTransition(() =>
                    cambiarPrioridadTarea(
                      tarea.id,
                      tarea.priority === p ? null : p,
                    ),
                  )
                }
                aria-pressed={tarea.priority === p}
                className={OPCION}
                style={{
                  background:
                    tarea.priority === p
                      ? prioridadColorVar(p)
                      : "var(--color-paper)",
                  boxShadow: tarea.priority === p ? "var(--shadow-hard)" : "none",
                }}
              >
                <span
                  style={{
                    width: PRIORIDAD_DEFS[p].punto,
                    height: PRIORIDAD_DEFS[p].punto,
                    borderRadius: 999,
                    background: prioridadColorVar(p),
                    border: "2px solid var(--color-line)",
                    flexShrink: 0,
                  }}
                />
                {PRIORIDAD_DEFS[p].label}
              </button>
            ))}
          </div>
        </div>

        {categorias.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <span className={ROTULO}>Categoría</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    startTransition(() =>
                      cambiarCategoriaTarea(
                        tarea.id,
                        tarea.categoryId === c.id ? null : c.id,
                      ),
                    )
                  }
                  aria-pressed={tarea.categoryId === c.id}
                  className={OPCION}
                  style={{
                    background:
                      tarea.categoryId === c.id
                        ? varColor(c.color)
                        : "var(--color-paper)",
                    borderBottom: `3px solid ${varColor(c.color)}`,
                    boxShadow:
                      tarea.categoryId === c.id ? "var(--shadow-hard)" : "none",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <span className={ROTULO}>Subtareas</span>
        <TaskTree roots={tarea.arbol} parentId={tarea.id} />
      </Card>

      <Card>
        <span className={ROTULO}>Adjuntos</span>
        <AttachmentList taskId={tarea.id} adjuntos={adjuntos} />
      </Card>
    </div>
  );
}
