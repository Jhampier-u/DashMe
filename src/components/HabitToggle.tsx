"use client";

import { useState, useTransition } from "react";
import {
  toggleToday,
  deleteHabit,
  setHabitAnchor,
  type ToggleResult,
} from "@/app/actions";
import { HabitDetail } from "./HabitDetail";
import { useSparkleBurst, SparkleLayer } from "./Sparkle";
import { plantEmoji, type PlantSpecies } from "@/lib/garden";

type Props = {
  id: string;
  name: string;
  icon: string;
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

function bg(doneToday: boolean, partial: boolean, scheduledToday: boolean) {
  if (!scheduledToday) return "var(--color-bg-deep)";
  if (doneToday && partial) return "var(--color-peach)";
  if (doneToday) return "var(--color-mint)";
  return "var(--color-surface)";
}

function ink(doneToday: boolean, scheduledToday: boolean) {
  if (!scheduledToday) return "var(--color-ink-dim)";
  return doneToday ? "var(--color-bg-deep)" : "var(--color-ink)";
}

function dispatchResult(result: ToggleResult) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("untap:xp", { detail: result }));
  if (result.shieldUsed) {
    window.dispatchEvent(new CustomEvent("untap:shield"));
  }
  if (result.anchorTriggered) {
    window.dispatchEvent(new CustomEvent("untap:anchor"));
  }
  if (result.leveledUp) {
    window.dispatchEvent(
      new CustomEvent("untap:levelup", { detail: { newLevel: result.newLevel } }),
    );
  }
  if (result.milestone) {
    window.dispatchEvent(
      new CustomEvent("untap:milestone", {
        detail: {
          habit: result.milestone.habitName,
          days: result.milestone.days,
          bonus: result.milestone.bonus,
        },
      }),
    );
  }
  for (const q of result.questsCompleted) {
    window.dispatchEvent(new CustomEvent("untap:questComplete", { detail: q }));
  }
}

export function HabitToggle(p: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const sparkle = useSparkleBurst("spark");
  const drops = useSparkleBurst("drop");

  function handleToggle(partial: boolean) {
    if (!p.scheduledToday) return;
    const willComplete = !p.doneToday;
    startTransition(async () => {
      const result = await toggleToday(p.id, partial);
      dispatchResult(result);
    });
    if (willComplete) {
      sparkle.burst();
      drops.burst();
    }
  }

  function handleDelete() {
    if (!confirm(`¿Borrar "${p.name}"?`)) return;
    const fd = new FormData();
    fd.set("id", p.id);
    startTransition(() => deleteHabit(fd));
  }

  function handleAnchorToggle() {
    startTransition(() => setHabitAnchor(p.id, !p.isAnchor));
  }

  const plant = plantEmoji(p.plantSpecies, p.streak, p.doneToday, p.hasEverBeenDone);
  const sched = (p.schedule ?? "1111111").padEnd(7, "0");

  return (
    <li
      className="flex flex-col p-3 pixel-edge-tight relative"
      style={{
        background: bg(p.doneToday, p.partialToday, p.scheduledToday),
        color: ink(p.doneToday, p.scheduledToday),
        opacity: pending ? 0.6 : !p.scheduledToday ? 0.55 : 1,
        boxShadow: p.criticalToday
          ? "0 0 0 3px var(--color-pink), 0 0 12px rgba(240, 168, 196, 0.5)"
          : p.isAnchor && !p.doneToday
            ? "0 0 0 3px var(--color-peach)"
            : "0 0 0 3px var(--color-border)",
      }}
    >
      {p.criticalToday ? (
        <div
          className="absolute -top-3 right-3 font-display text-[0.5rem] tracking-widest px-2 py-1 untap-pulse"
          style={{
            background: "var(--color-pink)",
            color: "var(--color-bg-deep)",
            boxShadow: "0 0 0 2px var(--color-bg-deep)",
          }}
        >
          ⚠ DÍA CRÍTICO
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => handleToggle(false)}
          disabled={pending || !p.scheduledToday}
          className="relative flex items-center gap-3 flex-1 text-left pixel-button"
          aria-label={p.doneToday ? `Desmarcar ${p.name}` : `Marcar ${p.name} como hecho`}
        >
          <span className="relative text-2xl">
            {icon(p.icon)}
            <SparkleLayer particles={sparkle.particles} />
          </span>
          <span
            className="relative text-3xl untap-bobble"
            title={`${plant} planta`}
          >
            {plant}
            <SparkleLayer particles={drops.particles} />
          </span>
          <span className="flex-1 text-xl flex items-center gap-2">
            {p.isAnchor ? (
              <span title="Hábito ancla" className="text-base">
                👑
              </span>
            ) : null}
            {p.name}
          </span>
          <span className="text-base opacity-90 whitespace-nowrap">🔥 {p.streak}</span>
          <span className="font-display text-[0.6rem] whitespace-nowrap">
            {!p.scheduledToday
              ? "HOY NO"
              : p.doneToday
                ? p.partialToday
                  ? "◐ MÍNIMO"
                  : "✓ HECHO"
                : "PENDIENTE"}
          </span>
        </button>

        {p.scheduledToday && p.minimalGoal && !p.doneToday ? (
          <button
            type="button"
            onClick={() => handleToggle(true)}
            disabled={pending}
            className="pixel-button font-display text-[0.55rem] px-2 py-2"
            style={{
              background: "var(--color-peach)",
              color: "var(--color-bg-deep)",
              boxShadow: "0 0 0 3px var(--color-border)",
            }}
            title={`Versión mínima: ${p.minimalGoal}`}
          >
            ◐
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleAnchorToggle}
          disabled={pending}
          className="pixel-button font-display text-[0.55rem] px-2 py-2"
          style={{
            background: p.isAnchor ? "var(--color-peach)" : "var(--color-surface-soft)",
            color: p.isAnchor ? "var(--color-bg-deep)" : "var(--color-ink)",
            boxShadow: "0 0 0 3px var(--color-border)",
          }}
          title={p.isAnchor ? "Quitar ancla" : "Designar como hábito ancla"}
        >
          👑
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={pending}
          className="pixel-button font-display text-[0.55rem] px-2 py-2"
          style={{
            background: "var(--color-lavender-dark)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 3px var(--color-border)",
          }}
          aria-label={open ? "Ocultar detalles" : "Ver detalles"}
        >
          {open ? "▲" : "▼"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="pixel-button font-display text-[0.55rem] px-2 py-2"
          style={{
            background: "var(--color-pink-dark)",
            color: "var(--color-ink)",
            boxShadow: "0 0 0 3px var(--color-border)",
          }}
          aria-label={`Borrar ${p.name}`}
        >
          ✕
        </button>
      </div>

      {p.intention ? (
        <div
          className="text-sm mt-2 italic flex items-start gap-2"
          style={{ color: p.doneToday ? "var(--color-bg-deep)" : "var(--color-ink-soft)" }}
        >
          <span>💭</span>
          <span>{p.intention}</span>
        </div>
      ) : null}

      {p.minimalGoal ? (
        <div
          className="text-sm mt-1 italic"
          style={{ color: p.doneToday ? "var(--color-bg-deep)" : "var(--color-ink-dim)" }}
        >
          Modo mínimo: <strong>{p.minimalGoal}</strong>
        </div>
      ) : null}

      {/* schedule indicator — only if non-daily */}
      {sched !== "1111111" ? (
        <div className="flex items-center gap-1 mt-2">
          <span className="font-display text-[0.5rem] tracking-wider text-[var(--color-ink-dim)] mr-1">
            DÍAS
          </span>
          {/* render Mon..Sun order for legibility */}
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const on = sched[wd] === "1";
            return (
              <span
                key={wd}
                className="font-display text-[0.55rem] px-1.5 py-0.5"
                style={{
                  background: on ? "var(--color-mint)" : "var(--color-bg-deep)",
                  color: on ? "var(--color-bg-deep)" : "var(--color-ink-dim)",
                  boxShadow: "0 0 0 1px var(--color-border)",
                }}
              >
                {WEEKDAY_LABELS[wd]}
              </span>
            );
          })}
        </div>
      ) : null}

      {open ? <HabitDetail habitId={p.id} habitName={p.name} /> : null}
    </li>
  );
}

function icon(s: string) {
  return s;
}
