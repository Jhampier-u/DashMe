"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteProject } from "@/modules/habitos/actions";
import { useConfirm } from "@/modules/habitos/components/ConfirmDialog";
import { ProgressBar } from "@/modules/core/ui/ProgressBar";
import type { ProjectSummary } from "@/modules/habitos/lib/projects";

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
      style={{
        background: "var(--color-paper)",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-hard)",
        padding: 16,
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        opacity: pending ? 0.5 : 1,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ fontSize: 20 }} aria-hidden>
          {project.icon}
        </span>
        <Link
          href={`/proyectos/${project.id}`}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {project.name}
        </Link>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className={
            "w-[26px] h-[26px] shrink-0 inline-flex items-center justify-center " +
            "rounded-control border-3 border-line bg-peach text-tinta text-[11px] leading-none " +
            "cursor-pointer font-cuerpo " +
            "transition-transform duration-75 ease-out active:translate-x-px active:translate-y-px " +
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
            "disabled:opacity-40"
          }
          aria-label={`Borrar el proyecto ${project.name}`}
        >
          ✕
        </button>
      </div>

      <p style={{ fontSize: 12.5, marginTop: 8, minHeight: 18 }}>
        {project.description ?? "Sin descripción"}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: "var(--font-vt)",
          fontSize: 16,
          fontVariantNumeric: "tabular-nums",
          marginTop: 12,
          marginBottom: 8,
        }}
      >
        {/*
          Dice de QUÉ son los números. El tablero de `/tareas` enseña solo las
          raíces, así que un proyecto puede decir «de 3» mientras allí se ve una
          sola tarjeta. No es un fallo —cuentan cosas distintas— pero sin la
          palabra parecía que una de las dos pantallas mentía.
        */}
        <span>
          {project.doneItems} de {project.totalItems}{" "}
          <span style={{ fontFamily: "var(--font-cuerpo)", fontSize: 11.5 }}>
            tareas y subtareas
          </span>
        </span>
        <span>{Math.round(percent * 100)}%</span>
      </div>

      <ProgressBar
        value={percent}
        label={`${project.name}: ${project.doneItems} de ${project.totalItems} tareas y subtareas`}
      />

      {/* El aviso iba en ámbar. Ahora lo dicen el ▲ que ya llevaba y el grosor:
          el pastel es fondo, nunca texto. */}
      <div
        style={{
          fontSize: 11.5,
          fontWeight: stale ? 700 : 400,
          marginTop: 12,
        }}
      >
        {stale ? "▲ " : ""}
        {movement}
      </div>
      {dialog}
    </div>
  );
}
