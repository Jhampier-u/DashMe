"use client";

import { useState, useTransition } from "react";
import { toggleToday, deleteHabit, setHabitAnchor } from "@/app/actions";
import { emitToggleResult } from "@/lib/events";
import { useConfirm } from "@/components/PixelConfirm";
import { habitColorVar, resolveHabitColor } from "@/lib/color";
import { plantEmoji, type PlantSpecies } from "@/lib/garden";
import { DEFAULT_SCHEDULE } from "@/lib/streak";
import { HabitDetail } from "./HabitDetail";

type Props = {
  id: string;
  name: string;
  icon: string;
  color: string;
  streak: number;
  doneToday: boolean;
  partialToday: boolean;
  scheduledToday: boolean;
  criticalToday: boolean;
  isAnchor: boolean;
  schedule: string;
  intention: string | null;
  plantSpecies: PlantSpecies;
  hasEverBeenDone: boolean;
  minimalGoal: string | null;
};

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const ICON_BUTTON = {
  width: 28,
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 7,
  border: "1px solid var(--m-line)",
  background: "var(--m-elevated)",
  color: "var(--m-ink-2)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

export function HabitRow(p: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const { confirm, dialog } = useConfirm();

  function mark(partial: boolean) {
    if (!p.scheduledToday || pending) return;
    startTransition(async () => {
      emitToggleResult(await toggleToday(p.id, partial));
    });
  }

  async function remove() {
    const ok = await confirm({
      title: "Borrar hábito",
      message: `Se borrará "${p.name}" y todo su historial. Esto no se puede deshacer.`,
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", p.id);
    startTransition(() => deleteHabit(fd));
  }

  const plant = plantEmoji(p.plantSpecies, p.streak, p.doneToday, p.hasEverBeenDone);
  const accent = habitColorVar(resolveHabitColor(p.color));
  const schedule = (p.schedule || DEFAULT_SCHEDULE).padEnd(7, "0");
  const custom = schedule !== DEFAULT_SCHEDULE;

  const state = !p.scheduledToday
    ? { text: "Hoy no toca", color: "var(--m-ink-3)" }
    : p.doneToday && p.partialToday
      ? { text: "Mínimo", color: "var(--m-warn)" }
      : p.doneToday
        ? { text: "Hecho", color: "var(--m-good)" }
        : { text: "Pendiente", color: "var(--m-ink-2)" };

  return (
    <div
      style={{
        background: "var(--m-surface)",
        border: `1px solid ${p.criticalToday ? "rgba(226, 96, 96, 0.45)" : "var(--m-line)"}`,
        borderRadius: 10,
        // La franja de identidad va por dentro para no desplazar el contenido
        // ni romper el radio, que es lo que pasaria subiendo el borde a 3px.
        boxShadow: `inset 3px 0 0 ${accent}`,
        padding: 14,
        paddingLeft: 17,
        opacity: pending ? 0.5 : p.scheduledToday ? 1 : 0.65,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={() => mark(false)}
          disabled={pending || !p.scheduledToday}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: 0,
            padding: 0,
            textAlign: "left",
            cursor: p.scheduledToday ? "pointer" : "default",
            fontFamily: "inherit",
          }}
          aria-label={
            p.doneToday ? `Desmarcar ${p.name}` : `Marcar ${p.name} como hecho`
          }
        >
          <span style={{ fontSize: 22 }} aria-hidden>
            {plant}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 550,
                color: "var(--m-ink)",
              }}
            >
              {p.isAnchor ? "👑 " : ""}
              {p.icon} {p.name}
            </span>
            <span
              className="m-num"
              style={{ display: "block", fontSize: 12, color: "var(--m-ink-3)", marginTop: 3 }}
            >
              {p.streak === 1 ? "1 día de racha" : `${p.streak} días de racha`}
            </span>
          </span>
          <span style={{ fontSize: 12.5, color: state.color, whiteSpace: "nowrap" }}>
            {state.text}
          </span>
        </button>

        {p.scheduledToday && p.minimalGoal && !p.doneToday ? (
          <button
            type="button"
            onClick={() => mark(true)}
            disabled={pending}
            style={{ ...ICON_BUTTON, color: "var(--m-warn)" }}
            title={`Modo mínimo: ${p.minimalGoal}`}
            aria-label={`Marcar ${p.name} en modo mínimo: ${p.minimalGoal}`}
          >
            ◐
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => startTransition(() => setHabitAnchor(p.id, !p.isAnchor))}
          disabled={pending}
          style={{ ...ICON_BUTTON, color: p.isAnchor ? "var(--m-warn)" : "var(--m-ink-3)" }}
          aria-pressed={p.isAnchor}
          aria-label={
            p.isAnchor
              ? `Quitar ${p.name} como hábito ancla`
              : `Designar ${p.name} como hábito ancla`
          }
        >
          👑
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={pending}
          style={ICON_BUTTON}
          aria-expanded={open}
          aria-label={open ? `Ocultar detalles de ${p.name}` : `Ver detalles de ${p.name}`}
        >
          {open ? "▴" : "▾"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          style={{ ...ICON_BUTTON, color: "var(--m-crit)" }}
          aria-label={`Borrar ${p.name}`}
        >
          ✕
        </button>
      </div>

      {p.intention ? (
        <div style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 10, fontStyle: "italic" }}>
          {p.intention}
        </div>
      ) : null}

      {p.minimalGoal ? (
        <div style={{ fontSize: 12, color: "var(--m-ink-3)", marginTop: 6 }}>
          Modo mínimo: {p.minimalGoal}
        </div>
      ) : null}

      {custom ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10 }}>
          {WEEKDAY_ORDER.map((weekday) => {
            const on = schedule[weekday] === "1";
            return (
              <span
                key={weekday}
                title={on ? "Toca" : "No toca"}
                style={{
                  width: 20,
                  height: 20,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 5,
                  fontSize: 10.5,
                  background: on ? "rgba(57, 135, 229, 0.18)" : "transparent",
                  border: `1px solid ${on ? "transparent" : "var(--m-line)"}`,
                  color: on ? "var(--m-ink)" : "var(--m-ink-3)",
                }}
              >
                {WEEKDAY_LABELS[weekday]}
              </span>
            );
          })}
        </div>
      ) : null}

      {open ? <HabitDetail habitId={p.id} habitName={p.name} /> : null}
      {dialog}
    </div>
  );
}
