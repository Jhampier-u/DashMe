# Hábitos · la pantalla — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar la pantalla de Hábitos al lenguaje moderno conservando toda su mecánica: marcar, modo mínimo, ancla, calendario con relleno hacia atrás, escudos, misiones y día crítico.

**Architecture:** Sigue el patrón ya establecido en `tasks/` y `projects/`: componentes en `src/components/habits/`, cabecera con el formulario desplegándose debajo, primitivas de `ui/`, y reutilización del `QuestList` de Inicio. No se toca ninguna Server Action ni la lógica de dominio.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-27-habitos-design.md`

**Este plan es la primera mitad.** El bloque de diagnóstico va en su propio plan y no toca nada de lo que este deja hecho.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/components/habits/DayStatus.tsx` (nuevo) | Avatar, cifra del día, nivel y escudos |
| `src/components/habits/CriticalBanner.tsx` (nuevo) | Aviso de la regla de los 2 días |
| `src/components/habits/HabitRow.tsx` (nuevo) | Fila de hábito con todas sus acciones |
| `src/components/habits/HabitDetail.tsx` (nuevo) | Estadísticas del hábito |
| `src/components/habits/MonthCalendar.tsx` (nuevo) | Calendario mensual con relleno |
| `src/components/habits/NewHabitForm.tsx` (nuevo) | Formulario de creación |
| `src/components/habits/HabitsHeader.tsx` (nuevo) | Cabecera con el formulario debajo |
| `src/app/habits/page.tsx` (reescribir) | Composición |

Se borran, en la tarea que los sustituye: `components/HabitToggle.tsx`,
`HabitDetail.tsx`, `MonthCalendar.tsx`, `NewHabitForm.tsx`, `PlayerStatus.tsx`,
`CriticalDayBanner.tsx`, `DailyQuestsPanel.tsx` y `StatsPanel.tsx`.

**Nada de lógica de dominio cambia.** Las Server Actions, `lib/habits.ts`,
`lib/stats.ts` y `lib/garden.ts` se quedan como están: esta fase es de
presentación.

---

### Task 1: Resumen del día y aviso crítico

**Files:**
- Create: `src/components/habits/DayStatus.tsx`
- Create: `src/components/habits/CriticalBanner.tsx`

- [ ] **Step 1: Crear el resumen del día**

Crear `src/components/habits/DayStatus.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { MAX_SHIELDS, type LevelInfo } from "@/lib/level";
import { on } from "@/lib/events";
import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/charts/ProgressRing";

type Snapshot = LevelInfo & { shields: number };

type Props = {
  initial: Snapshot;
  done: number;
  scheduled: number;
};

/** El avatar sigue existiendo: la estructura se moderniza, el humor se queda. */
function avatarFor(ratio: number, scheduled: number): string {
  if (scheduled === 0) return "🌙";
  if (ratio >= 1) return "🦸";
  if (ratio >= 0.5) return "🙂";
  if (ratio > 0) return "🙃";
  return "😴";
}

function moodFor(ratio: number, scheduled: number): string {
  if (scheduled === 0) return "Hoy no toca ninguno. Descansa.";
  if (ratio >= 1) return "Día completo.";
  if (ratio >= 0.5) return "Vas por buen camino.";
  if (ratio > 0) return "Has empezado, sigue.";
  return "Aún no has marcado nada hoy.";
}

export function DayStatus({ initial, done, scheduled }: Props) {
  const [live, setLive] = useState<Snapshot | null>(null);
  const [lastFromServer, setLastFromServer] = useState(initial);

  // El servidor manda: en cuanto llega un dato nuevo, lo local se descarta.
  if (lastFromServer !== initial) {
    setLastFromServer(initial);
    setLive(null);
  }
  const info = live ?? initial;

  useEffect(() => on("untap:xp", ({ player }) => setLive(player)), []);

  const ratio = scheduled === 0 ? 0 : done / scheduled;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 34 }} aria-hidden>
            {avatarFor(ratio, scheduled)}
          </span>
          <ProgressRing value={done} max={scheduled} size={52} stroke={4} />
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
              <span
                className="m-num"
                style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-0.03em", lineHeight: 1 }}
              >
                {done}
              </span>
              <span className="m-num" style={{ fontSize: 16, color: "var(--m-ink-3)" }}>
                /{scheduled}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 4 }}>
              {moodFor(ratio, scheduled)}
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 20 }}>
          <div>
            <div className="m-label">Nivel</div>
            <div className="m-num" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
              {info.level}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginTop: 2 }}>
              {info.xpForNextLevel - info.xpIntoLevel} XP para el {info.level + 1}
            </div>
          </div>
          <div>
            <div className="m-label">Escudos</div>
            <div className="m-num" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
              {info.shields} / {MAX_SHIELDS}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginTop: 2 }}>
              perdonan un día
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Crear el aviso**

Crear `src/components/habits/CriticalBanner.tsx`:

```tsx
import type { HabitWithStatus } from "@/lib/habits";

/**
 * Regla de los 2 días. El color va siempre acompañado de icono y texto: quien
 * no distingue el rojo debe recibir el mismo aviso.
 */
export function CriticalBanner({ habits }: { habits: HabitWithStatus[] }) {
  const critical = habits.filter((h) => h.criticalToday);
  if (critical.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        background: "rgba(226, 96, 96, 0.10)",
        border: "1px solid rgba(226, 96, 96, 0.35)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <span aria-hidden style={{ color: "var(--m-crit)", fontSize: 13 }}>
        ▲
      </span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--m-crit)" }}>
          {critical.length === 1
            ? "Un hábito viene de fallar"
            : `${critical.length} hábitos vienen de fallar`}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 4 }}>
          Fallar dos veces seguidas es lo que rompe una racha:{" "}
          {critical.map((h) => h.name).join(", ")}.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/habits
git commit -m "Añade el resumen del día y el aviso de día crítico"
```

---

### Task 2: Fila de hábito

**Files:**
- Create: `src/components/habits/HabitRow.tsx`

- [ ] **Step 1: Implementar**

Crear `src/components/habits/HabitRow.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toggleToday, deleteHabit, setHabitAnchor } from "@/app/actions";
import { emitToggleResult } from "@/lib/events";
import { useConfirm } from "@/components/PixelConfirm";
import { plantEmoji, type PlantSpecies } from "@/lib/garden";
import { DEFAULT_SCHEDULE } from "@/lib/streak";
import { HabitDetail } from "./HabitDetail";

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
        padding: 14,
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
```

- [ ] **Step 2: Verificar**

`npx tsc --noEmit` **fallará** porque `./HabitDetail` aún no existe. Es lo
esperado; se crea en la tarea 3. Anótalo y sigue.

- [ ] **Step 3: Commit**

```bash
git add src/components/habits/HabitRow.tsx
git commit -m "Añade la fila de hábito moderna"
```

---

### Task 3: Detalle y calendario

**Files:**
- Create: `src/components/habits/HabitDetail.tsx`
- Create: `src/components/habits/MonthCalendar.tsx`

- [ ] **Step 1: Crear el detalle**

Crear `src/components/habits/HabitDetail.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchHabitStats } from "@/app/actions";
import { on } from "@/lib/events";
import type { HabitDetailStats } from "@/lib/stats";
import { MonthCalendar } from "./MonthCalendar";

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="m-label">{label}</div>
      <div className="m-num" style={{ fontSize: 17, fontWeight: 600, marginTop: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--m-ink-3)", marginTop: 2 }}>{hint}</div>
    </div>
  );
}

export function HabitDetail({
  habitId,
  habitName,
}: {
  habitId: string;
  habitName: string;
}) {
  const [stats, setStats] = useState<HabitDetailStats | null>(null);
  // Marcar días desde el calendario cambia racha y porcentaje.
  const [version, setVersion] = useState(0);

  useEffect(() => on("untap:xp", () => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let alive = true;
    fetchHabitStats(habitId).then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, [habitId, version]);

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--m-line)" }}>
      {stats ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 12,
          }}
        >
          <Stat label="Racha" value={`${stats.currentStreak} días`} hint="actual" />
          <Stat label="Mejor" value={`${stats.bestStreak} días`} hint="histórica" />
          <Stat
            label="30 días"
            value={`${Math.round(stats.completionRate30 * 100)}%`}
            hint={`${stats.doneIn30} de ${stats.scheduledIn30} que tocaban`}
          />
          <Stat label="Total" value={String(stats.totalDone)} hint="veces cumplido" />
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: "var(--m-ink-3)" }}>
          Cargando estadísticas…
        </div>
      )}
      <MonthCalendar habitId={habitId} habitName={habitName} />
    </div>
  );
}
```

- [ ] **Step 2: Crear el calendario**

Crear `src/components/habits/MonthCalendar.tsx`:

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import type { MonthDay } from "@/lib/habits";
import { fetchHabitMonth, toggleHabitOnDay } from "@/app/actions";
import { emitToggleResult } from "@/lib/events";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];

const NAV_BUTTON = {
  width: 26,
  height: 26,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 6,
  border: "1px solid var(--m-line)",
  background: "var(--m-elevated)",
  color: "var(--m-ink-2)",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

export function MonthCalendar({
  habitId,
  habitName,
}: {
  habitId: string;
  habitName: string;
}) {
  const [now] = useState(() => new Date());
  const [year, setYear] = useState(() => now.getFullYear());
  const [month, setMonth] = useState(() => now.getMonth());
  // El mes cargado viaja con sus datos, así que "cargando" es un valor derivado.
  const [loaded, setLoaded] = useState<{ key: string; days: MonthDay[] } | null>(null);
  const [token, setToken] = useState(0);
  const [pending, startTransition] = useTransition();

  const monthKey = `${year}-${month}`;
  const loading = loaded?.key !== monthKey;
  const days = loaded?.key === monthKey ? loaded.days : [];

  useEffect(() => {
    let alive = true;
    fetchHabitMonth(habitId, year, month).then((result) => {
      if (alive) setLoaded({ key: `${year}-${month}`, days: result });
    });
    return () => {
      alive = false;
    };
  }, [habitId, year, month, token]);

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }

  function toggle(day: MonthDay) {
    if (!day.editable || pending) return;
    setLoaded((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            days: prev.days.map((d) =>
              d.date === day.date ? { ...d, done: !d.done } : d,
            ),
          },
    );
    startTransition(async () => {
      emitToggleResult(await toggleHabitOnDay(habitId, day.date));
      setToken((t) => t + 1);
    });
  }

  function describe(day: MonthDay): string {
    if (day.shielded) return `${day.date}: cubierto por un escudo`;
    if (day.isFuture) return `${day.date}: aún no llega`;
    if (!day.scheduled) return `${day.date}: no toca`;
    if (!day.editable) return `${day.date}: fuera del rango editable`;
    return `${day.date}: ${day.done ? "cumplido" : "pendiente"}`;
  }

  function colors(day: MonthDay) {
    if (day.shielded) return { bg: "rgba(250, 178, 25, 0.22)", fg: "var(--m-ink)" };
    if (day.partial) return { bg: "rgba(250, 178, 25, 0.35)", fg: "var(--m-ink)" };
    if (day.done) return { bg: "var(--m-series)", fg: "#fff" };
    if (!day.scheduled) return { bg: "transparent", fg: "var(--m-ink-3)" };
    return { bg: "var(--m-elevated)", fg: "var(--m-ink-2)" };
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <button type="button" onClick={() => shift(-1)} style={NAV_BUTTON} aria-label="Mes anterior">
          ←
        </button>
        <span style={{ fontSize: 13, fontWeight: 550 }}>
          {MONTHS[month]} {year}
        </span>
        <button type="button" onClick={() => shift(1)} style={NAV_BUTTON} aria-label="Mes siguiente">
          →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            style={{ textAlign: "center", fontSize: 10, color: "var(--m-ink-3)", paddingBottom: 2 }}
          >
            {w}
          </div>
        ))}

        {loading
          ? Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                style={{ aspectRatio: "1", borderRadius: 5, background: "var(--m-elevated)" }}
              />
            ))
          : days.map((day) => {
              const { bg, fg } = colors(day);
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => toggle(day)}
                  disabled={!day.editable || pending}
                  title={describe(day)}
                  aria-label={`${habitName}, ${describe(day)}`}
                  style={{
                    aspectRatio: "1",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 5,
                    fontSize: 11,
                    fontFamily: "inherit",
                    background: bg,
                    color: fg,
                    border: day.isToday ? "1px solid var(--m-ink-2)" : "1px solid transparent",
                    opacity: day.inMonth ? (day.isFuture ? 0.35 : 1) : 0.3,
                    cursor: day.editable ? "pointer" : "default",
                  }}
                >
                  {day.shielded ? "🛡" : day.day}
                </button>
              );
            })}
      </div>

      <div style={{ fontSize: 11, color: "var(--m-ink-3)", marginTop: 8 }}>
        Solo los días que tocan, hasta 60 días atrás. 🛡 escudo · tono suave, modo mínimo.
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint`
Expected: sin errores. Aquí desaparece el fallo que dejó la tarea 2.

- [ ] **Step 4: Commit**

```bash
git add src/components/habits
git commit -m "Añade el detalle de hábito y su calendario mensual"
```

---

### Task 4: Formulario y cabecera

**Files:**
- Create: `src/components/habits/NewHabitForm.tsx`
- Create: `src/components/habits/HabitsHeader.tsx`

- [ ] **Step 1: Crear el formulario**

Crear `src/components/habits/NewHabitForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { createHabit } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PLANT_SPECIES, type PlantSpecies } from "@/lib/garden";

const ICONS = ["⭐", "📖", "🏃", "🧘", "💧", "🎨", "🎮", "🌱", "🎵", "💪", "🍎", "✍️"];
const COLORS = [
  { key: "mint", label: "Menta" },
  { key: "peach", label: "Melocotón" },
  { key: "pink", label: "Rosa" },
  { key: "lavender", label: "Lavanda" },
  { key: "sky", label: "Cielo" },
];
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
  const [color, setColor] = useState("mint");
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
          {COLORS.map((choice) => (
            <button
              key={choice.key}
              type="button"
              onClick={() => setColor(choice.key)}
              aria-pressed={color === choice.key}
              aria-label={choice.label}
              style={{
                ...CHIP,
                flex: 1,
                background: `var(--color-${choice.key})`,
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
```

- [ ] **Step 2: Crear la cabecera**

Crear `src/components/habits/HabitsHeader.tsx`:

```tsx
"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { NewHabitForm } from "./NewHabitForm";

export function HabitsHeader({ total }: { total: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Hábitos"
        subtitle={
          total === 0
            ? "Lo que repites es lo que construyes"
            : `${total} en marcha · lo que repites es lo que construyes`
        }
        action={
          open ? null : (
            <Button variant="primary" onClick={() => setOpen(true)}>
              Nuevo hábito
            </Button>
          )
        }
      />
      {open ? <NewHabitForm onDone={() => setOpen(false)} /> : null}
    </>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/habits
git commit -m "Añade el formulario de hábito y la cabecera"
```

---

### Task 5: Montar la pantalla

**Files:**
- Modify: `src/app/habits/page.tsx` (reescritura completa)
- Delete: los ocho componentes pixel que quedan sin uso

- [ ] **Step 1: Reescribir la página**

Sustituir **todo** el contenido de `src/app/habits/page.tsx`:

```tsx
import { getHabitsWithTodayStatus, getPlayerLevelInfo } from "@/lib/habits";
import { getTodayQuests } from "@/lib/quests";
import { Card } from "@/components/ui/Card";
import { QuestList } from "@/components/home/QuestList";
import { HabitsHeader } from "@/components/habits/HabitsHeader";
import { DayStatus } from "@/components/habits/DayStatus";
import { CriticalBanner } from "@/components/habits/CriticalBanner";
import { HabitRow } from "@/components/habits/HabitRow";

export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const [habits, player, quests] = await Promise.all([
    getHabitsWithTodayStatus(),
    getPlayerLevelInfo(),
    getTodayQuests(),
  ]);

  const scheduled = habits.filter((h) => h.scheduledToday);
  const done = scheduled.filter((h) => h.doneToday).length;

  return (
    <main className="m-root" style={{ minHeight: "100%", padding: "20px 16px 48px" }}>
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <HabitsHeader total={habits.length} />

        {habits.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 15, marginBottom: 6 }}>Aún no tienes hábitos.</p>
            <p style={{ fontSize: 13, color: "var(--m-ink-2)" }}>
              Crea el primero y empieza a construir una racha.
            </p>
          </Card>
        ) : (
          <>
            <CriticalBanner habits={habits} />
            <DayStatus initial={player} done={done} scheduled={scheduled.length} />
            <QuestList quests={quests} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {habits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  id={habit.id}
                  name={habit.name}
                  icon={habit.icon}
                  streak={habit.streak}
                  doneToday={habit.doneToday}
                  partialToday={habit.partialToday}
                  scheduledToday={habit.scheduledToday}
                  criticalToday={habit.criticalToday}
                  isAnchor={habit.isAnchor}
                  schedule={habit.schedule}
                  intention={habit.intention}
                  plantSpecies={habit.plantSpecies}
                  hasEverBeenDone={habit.hasEverBeenDone}
                  minimalGoal={habit.minimalGoal}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Comprobar consumidores antes de borrar**

```bash
grep -rn "components/HabitToggle\|components/HabitDetail\|components/MonthCalendar\|components/NewHabitForm\|components/PlayerStatus\|components/CriticalDayBanner\|components/DailyQuestsPanel\|components/StatsPanel" src
```

Expected: ninguna coincidencia. Si aparece alguna —por ejemplo desde
`src/app/garden/page.tsx`, que aún es pixel— **repórtalo y no borres ese
archivo**: el Jardín se migra en la fase 3 y necesita seguir compilando.

- [ ] **Step 3: Borrar los que no tengan consumidores**

```bash
git rm src/components/HabitToggle.tsx src/components/HabitDetail.tsx \
       src/components/MonthCalendar.tsx src/components/NewHabitForm.tsx \
       src/components/PlayerStatus.tsx src/components/CriticalDayBanner.tsx \
       src/components/DailyQuestsPanel.tsx src/components/StatsPanel.tsx
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npx eslint && npx vitest run && npm run build`
Expected: sin errores, 94 tests, build correcto.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Reconstruye la pantalla de Hábitos"
```

---

### Task 6: Verificación en navegador

**Files:** ninguno, salvo que aparezcan fallos.

- [ ] **Step 1: Arrancar**

Usar `preview_start` con la configuración `untap-dev`.

- [ ] **Step 2: Estado vacío**

Con la base sin hábitos, `/habits` muestra «Aún no tienes hábitos» y nada más:
ni resumen del día, ni misiones, ni lista.

- [ ] **Step 3: Crear**

Crear un hábito con el formulario, comprobando que **sale a todo el ancho** debajo
de la cabecera. Elegir icono, color, planta, quitar dos días de la semana,
rellenar modo mínimo y marcar ancla.

- [ ] **Step 4: La fila**

Comprobar en la fila creada: la corona del ancla, la planta, «0 días de racha»,
el estado, los chips de días (solo si el calendario no es diario), el texto del
modo mínimo, y que aparece el botón ◐.

- [ ] **Step 5: Marcar**

Pulsar la fila para marcar: el estado pasa a «Hecho», la racha a 1, la planta
crece y el resumen del día sube. Volver a pulsar para desmarcar y comprobar que
todo vuelve atrás.

- [ ] **Step 6: Detalle y calendario**

Desplegar con ▾: salen las cuatro estadísticas y el calendario. Marcar un día
pasado que **sí** toque y comprobar que las estadísticas se actualizan solas.
Comprobar que un día que no toca está deshabilitado.

- [ ] **Step 7: Borrar**

Pulsar ✕: sale el diálogo. Cancelar y comprobar que el hábito sigue.

- [ ] **Step 8: Anchos, consola y servidor**

Con `resize_window` a 400 y a 1280: sin desbordamiento horizontal. Revisar
`read_console_messages` y `preview_logs`: sin errores.

- [ ] **Step 9: Commit de lo que haya salido**

```bash
git add -A
git commit -m "Corrige lo detectado al verificar Hábitos en navegador"
```

Si no ha salido nada, omitir el commit y decirlo en el informe.

---

## Verificación final

```bash
npm test && npx tsc --noEmit && npx eslint && npm run build
```

Expected: 94 tests en verde, sin errores de tipos, lint limpio y build correcto.
