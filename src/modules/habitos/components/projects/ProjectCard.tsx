"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteProject } from "@/modules/habitos/actions";
import { useConfirm } from "@/modules/habitos/components/ConfirmDialog";
import { ProgressBar } from "@/modules/core/ui/ProgressBar";
import {
  fraseDeMovimiento,
  progresoDe,
  type ProjectSummary,
} from "@/modules/habitos/lib/projects";

/** Cuánto tiempo parado empieza a ser señal de aviso. */
const STALE_DAYS = 14;

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const percent = progresoDe(project.doneItems, project.totalItems);
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

  const movement = fraseDeMovimiento(project.lastMovement);

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
        {/*
          El enlace se estira sobre toda la tarjeta con `after:inset-0`. Antes
          solo el título llevaba, así que la tarjeta parecía pulsable y no lo
          era: pinchar en la descripción o en la barra no hacía nada.

          Se hace con un pseudoelemento y no metiendo la tarjeta dentro de un
          `<a>` porque dentro hay un botón, y un botón dentro de un enlace es
          HTML inválido. Así el enlace sigue siendo un enlace —abrir en otra
          pestaña, copiar dirección— y el botón se queda por encima con `z-10`.
        */}
        <Link
          href={`/proyectos/${project.id}`}
          className="after:absolute after:inset-0 after:content-['']"
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
            "relative z-10 " +
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

      {/*
        Sin `label`, igual que en DiagnosisPanel, QuestList y el detalle: el
        recuento y el porcentaje van escritos justo encima, así que con rol de
        `progressbar` un lector de pantalla los decía dos veces seguidas.

        Se lo puse en la pasada anterior y contradecía la regla escrita en el
        propio componente. Aquí la barra es refuerzo, no información.
      */}
      <ProgressBar value={percent} />

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
