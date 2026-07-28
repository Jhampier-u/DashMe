"use client";

import { useState, useTransition } from "react";
import { createHabit } from "@/modules/habitos/actions";
import { Button } from "@/modules/core/ui/Button";
import { Field } from "@/modules/core/ui/Field";
import { DEFAULT_HABIT_COLOR, HABIT_COLORS, habitColorVar } from "@/modules/habitos/lib/color";
import { PLANT_SPECIES, type PlantSpecies } from "@/modules/habitos/lib/garden";

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

/*
  Los selectores son rejillas de teclas, y es donde el estilo se luce: cada una
  con su trazo de 3px, su sombra dura y su hundido al pulsar.

  Lo elegido se marca con `aria-pressed:`, la variante de Tailwind que lee el
  atributo que ya estaba puesto. Así el estado visual y el accesible no pueden
  separarse: son el mismo dato. Antes eran dos cosas distintas —un `aria-pressed`
  por un lado y un borde azul por otro— y nada garantizaba que coincidieran.
*/
const CHIP =
  "min-w-[36px] h-[36px] inline-flex items-center justify-center " +
  // Sin tamaño de letra: lo pone cada rejilla, que es lo único que cambia
  // entre ellas. Así no hay dos utilidades de tamaño peleándose.
  "rounded-control border-3 border-line bg-paper text-tinta font-cuerpo " +
  "cursor-pointer shadow-hard " +
  "transition-[transform,box-shadow] duration-75 ease-out " +
  "active:translate-x-0.5 active:translate-y-0.5 " +
  "active:shadow-[2px_2px_0_var(--color-line)] " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
  "aria-pressed:bg-sky";

const LABEL = {
  display: "block",
  fontFamily: "var(--font-cuerpo)",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--color-tinta)",
  marginBottom: 8,
} as const;

/** La superficie de `Card`, a mano: esto es un `<form>` y `Card` es un `<div>`. */
const SUPERFICIE = {
  background: "var(--color-paper)",
  border: "3px solid var(--color-line)",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--shadow-hard)",
  padding: 18,
  color: "var(--color-tinta)",
  fontFamily: "var(--font-cuerpo)",
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
      style={{ ...SUPERFICIE, display: "flex", flexDirection: "column", gap: 16 }}
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
              className={`${CHIP} text-base`}
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
              // La muestra ES el color, así que `aria-pressed:bg-sky` sobra:
              // se quita del juego y lo elegido se marca con un ✓ en tinta.
              // Que la selección tenga forma y no solo tono importa el doble
              // aquí, que es justo el sitio donde se eligen colores.
              className={`${CHIP} flex-1 text-[15px]`}
              style={{ background: habitColorVar(choice.key) }}
            >
              {color === choice.key ? "✓" : ""}
            </button>
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
              className={`${CHIP} gap-1.5 px-3 text-[12.5px]`}
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
                className={`${CHIP} flex-1 text-[13px]`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 11.5, marginTop: 8 }}>
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
          style={{ width: 16, height: 16, accentColor: "var(--color-tinta)" }}
        />
        <span style={{ fontSize: 13, fontWeight: 700 }}>Hábito ancla</span>
        <span style={{ fontSize: 11.5 }}>el más importante · da XP extra</span>
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
