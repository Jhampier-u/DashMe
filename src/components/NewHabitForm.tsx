"use client";

import { useState, useTransition } from "react";
import { createHabit } from "@/app/actions";
import { PixelButton } from "./PixelButton";
import { PLANT_SPECIES, type PlantSpecies } from "@/lib/garden";

const ICON_CHOICES = [
  "⭐", "📖", "🏃", "🧘", "💧", "🎨",
  "🎮", "🌱", "🎵", "💪", "🍎", "✍️",
];

// Index matches JS Date.getDay() / getUTCDay(): 0=Sunday..6=Saturday
const WEEKDAYS = [
  { idx: 1, label: "L" },
  { idx: 2, label: "M" },
  { idx: 3, label: "M" },
  { idx: 4, label: "J" },
  { idx: 5, label: "V" },
  { idx: 6, label: "S" },
  { idx: 0, label: "D" },
];

function makeScheduleString(active: Set<number>): string {
  let s = "";
  for (let i = 0; i < 7; i++) s += active.has(i) ? "1" : "0";
  return s;
}

export function NewHabitForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("⭐");
  const [plantSpecies, setPlantSpecies] = useState<PlantSpecies>("flower");
  const [minimalGoal, setMinimalGoal] = useState("");
  const [intention, setIntention] = useState("");
  const [isAnchor, setIsAnchor] = useState(false);
  const [activeDays, setActiveDays] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5, 6]),
  );
  const [pending, startTransition] = useTransition();

  function toggleDay(idx: number) {
    setActiveDays((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      if (next.size === 0) next.add(idx); // never let all be off
      return next;
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name);
    fd.set("icon", icon);
    fd.set("plantSpecies", plantSpecies);
    fd.set("minimalGoal", minimalGoal);
    fd.set("intention", intention);
    fd.set("schedule", makeScheduleString(activeDays));
    if (isAnchor) fd.set("isAnchor", "on");
    startTransition(async () => {
      await createHabit(fd);
      setName("");
      setIcon("⭐");
      setPlantSpecies("flower");
      setMinimalGoal("");
      setIntention("");
      setIsAnchor(false);
      setActiveDays(new Set([0, 1, 2, 3, 4, 5, 6]));
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <PixelButton variant="primary" onClick={() => setOpen(true)}>
        + Nuevo hábito
      </PixelButton>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 w-full max-w-md p-4 pixel-edge-tight"
      style={{ background: "var(--color-surface)" }}
    >
      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)]">
        Nombre del hábito
      </label>
      <input
        autoFocus
        className="pixel-input"
        placeholder="ej. Leer 20 min"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
      />

      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)] mt-2">
        Icono
      </label>
      <div className="grid grid-cols-6 gap-2">
        {ICON_CHOICES.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => setIcon(emoji)}
            className="pixel-button text-2xl p-2"
            style={{
              background:
                icon === emoji ? "var(--color-lavender)" : "var(--color-bg-deep)",
              boxShadow: "0 0 0 3px var(--color-border)",
            }}
          >
            {emoji}
          </button>
        ))}
      </div>

      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)] mt-2">
        Planta del jardín
      </label>
      <div className="grid grid-cols-5 gap-2">
        {PLANT_SPECIES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setPlantSpecies(s.key)}
            className="pixel-button p-2 flex flex-col items-center gap-1"
            style={{
              background:
                plantSpecies === s.key
                  ? "var(--color-mint)"
                  : "var(--color-bg-deep)",
              color:
                plantSpecies === s.key
                  ? "var(--color-bg-deep)"
                  : "var(--color-ink)",
              boxShadow: "0 0 0 3px var(--color-border)",
            }}
          >
            <span className="text-xl">{s.sample}</span>
            <span className="font-display text-[0.5rem] tracking-wider">
              {s.label.toUpperCase()}
            </span>
          </button>
        ))}
      </div>

      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)] mt-2">
        Días activos
      </label>
      <div className="flex gap-1">
        {WEEKDAYS.map((w) => {
          const on = activeDays.has(w.idx);
          return (
            <button
              key={`${w.idx}-${w.label}`}
              type="button"
              onClick={() => toggleDay(w.idx)}
              className="pixel-button flex-1 font-display text-[0.65rem] py-2"
              style={{
                background: on ? "var(--color-mint)" : "var(--color-bg-deep)",
                color: on ? "var(--color-bg-deep)" : "var(--color-ink-dim)",
                boxShadow: "0 0 0 2px var(--color-border)",
              }}
            >
              {w.label}
            </button>
          );
        })}
      </div>
      <p className="text-[0.7rem] text-[var(--color-ink-dim)] -mt-1">
        Solo cuenta racha y misiones en estos días.
      </p>

      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)] mt-2">
        Intención (opcional) <span className="text-[var(--color-ink-dim)]">— "Cuando X entonces Y"</span>
      </label>
      <input
        className="pixel-input"
        placeholder='ej. "Cuando me sirva el café, 5 sentadillas"'
        value={intention}
        onChange={(e) => setIntention(e.target.value)}
        maxLength={140}
      />

      <label className="font-display text-[0.6rem] tracking-wider text-[var(--color-ink-soft)] mt-2">
        Modo mínimo (opcional) <span className="text-[var(--color-ink-dim)]">— versión "modo flojo"</span>
      </label>
      <input
        className="pixel-input"
        placeholder='ej. "Leer 1 página"'
        value={minimalGoal}
        onChange={(e) => setMinimalGoal(e.target.value)}
        maxLength={80}
      />

      <label
        className="flex items-center gap-2 mt-2 cursor-pointer text-base"
        title="El hábito ancla es el más importante. Cumplirlo da +10 XP extra y celebración especial."
      >
        <input
          type="checkbox"
          checked={isAnchor}
          onChange={(e) => setIsAnchor(e.target.checked)}
          className="w-4 h-4 accent-[var(--color-peach)]"
        />
        <span className="text-[var(--color-ink)]">👑 Hábito ancla</span>
        <span className="text-[var(--color-ink-dim)] text-sm">
          (el más importante · +10 XP bonus)
        </span>
      </label>

      <div className="flex gap-2 mt-3">
        <PixelButton type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending ? "Guardando..." : "Crear"}
        </PixelButton>
        <PixelButton
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancelar
        </PixelButton>
      </div>
    </form>
  );
}
