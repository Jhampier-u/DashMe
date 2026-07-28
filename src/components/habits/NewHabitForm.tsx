"use client";

import { useState, useTransition } from "react";
import { createHabit } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { DEFAULT_HABIT_COLOR, HABIT_COLORS, habitColorVar } from "@/lib/color";
import { PLANT_SPECIES, type PlantSpecies } from "@/lib/garden";

const ICONS = ["⭐", "📖", "🏃", "🧘", "💧", "🎨", "🎮", "🌱", "🎵", "💪", "🍎", "✍️"];
// Índice por getUTCDay(): 0=domingo. Se muestran empezando en lunes.
const WEEKDAYS = [
  { index: 1, label: "L" },
  { index: 2, label: "M" },
  { index: 3, label: "X" },
  { index: 4, label: "J" },
  { index: 5, label: "V" },
  { index: 6, label: "S" },
  { index: 0, label: "D" },
];

const CHIP = {
  minWidth: 34,
  height: 34,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 7,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
} as const;

const LABEL = {
  display: "block",
  fontSize: 12,
  color: "var(--m-ink-2)",
  marginBottom: 6,
} as const;

export function NewHabitForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("⭐");
  const [color, setColor] = useState<string>(DEFAULT_HABIT_COLOR);
  const [species, setSpecies] = useState<PlantSpecies>("flower");
  const [days, setDays] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));
  const [intention, setIntention] = useState("");
  const [minimalGoal, setMinimalGoal] = useState("");
  const [isAnchor, setIsAnchor] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleDay(index: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      // Nunca se queda sin ningún día: un hábito que no toca nunca no existe.
      if (next.size === 0) next.add(index);
      return next;
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    let schedule = "";
    for (let i = 0; i < 7; i++) schedule += days.has(i) ? "1" : "0";

    const fd = new FormData();
    fd.set("name", name);
    fd.set("icon", icon);
    fd.set("color", color);
    fd.set("plantSpecies", species);
    fd.set("schedule", schedule);
    fd.set("intention", intention);
    fd.set("minimalGoal", minimalGoal);
    if (isAnchor) fd.set("isAnchor", "on");

    startTransition(async () => {
      await createHabit(fd);
      onDone();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="m-card"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <Field
        label="Nombre"
        value={name}
        onChange={setName}
        placeholder="ej. Leer 20 minutos"
        maxLength={60}
        autoFocus
      />

      <div>
        <span style={LABEL}>Icono</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ICONS.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => setIcon(choice)}
              aria-pressed={icon === choice}
              aria-label={`Icono ${choice}`}
              style={{
                ...CHIP,
                fontSize: 16,
                background: icon === choice ? "rgba(57,135,229,0.16)" : "var(--m-elevated)",
                border: `1px solid ${icon === choice ? "var(--m-series)" : "var(--m-line)"}`,
              }}
            >
              {choice}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span style={LABEL}>Color</span>
        <div style={{ display: "flex", gap: 6 }}>
          {HABIT_COLORS.map((choice) => (
            <button
              key={choice.key}
              type="button"
              onClick={() => setColor(choice.key)}
              aria-pressed={color === choice.key}
              aria-label={choice.label}
              title={choice.label}
              style={{
                ...CHIP,
                flex: 1,
                background: habitColorVar(choice.key),
                border: `2px solid ${color === choice.key ? "var(--m-ink)" : "transparent"}`,
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <span style={LABEL}>Planta del jardín</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PLANT_SPECIES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSpecies(option.key)}
              aria-pressed={species === option.key}
              style={{
                ...CHIP,
                gap: 6,
                padding: "0 12px",
                fontSize: 12.5,
                color: "var(--m-ink)",
                background: species === option.key ? "rgba(57,135,229,0.16)" : "var(--m-elevated)",
                border: `1px solid ${species === option.key ? "var(--m-series)" : "var(--m-line)"}`,
              }}
            >
              {option.sample} {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span style={LABEL}>Días que toca</span>
        <div style={{ display: "flex", gap: 6 }}>
          {WEEKDAYS.map((day) => {
            const on = days.has(day.index);
            return (
              <button
                key={day.index}
                type="button"
                onClick={() => toggleDay(day.index)}
                aria-pressed={on}
                style={{
                  ...CHIP,
                  flex: 1,
                  color: on ? "var(--m-ink)" : "var(--m-ink-3)",
                  background: on ? "rgba(57,135,229,0.16)" : "var(--m-elevated)",
                  border: `1px solid ${on ? "var(--m-series)" : "var(--m-line)"}`,
                }}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginTop: 6 }}>
          La racha y las misiones solo cuentan en estos días.
        </p>
      </div>

      <Field
        label="Intención (opcional)"
        value={intention}
        onChange={setIntention}
        placeholder="Cuando me sirva el café, 5 sentadillas"
        maxLength={140}
      />
      <Field
        label="Modo mínimo (opcional)"
        value={minimalGoal}
        onChange={setMinimalGoal}
        placeholder="Leer 1 página"
        maxLength={80}
      />

      <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={isAnchor}
          onChange={(e) => setIsAnchor(e.target.checked)}
          style={{ width: 15, height: 15, accentColor: "var(--m-series)" }}
        />
        <span style={{ fontSize: 13 }}>Hábito ancla</span>
        <span style={{ fontSize: 11.5, color: "var(--m-ink-3)" }}>
          el más importante · da XP extra
        </span>
      </label>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
          {pending ? "Guardando…" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
