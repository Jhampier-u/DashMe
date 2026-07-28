# Jardín moderno y retirada de lo pixel · Plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development
> (recomendada) o superpowers:executing-plans para ejecutar este plan tarea por
> tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** repintar el Jardín en el lenguaje moderno conservando su metáfora,
dar uso real al color de hábito con una paleta validada de tres colores, y
retirar del proyecto todo el sistema pixel.

**Arquitectura:** la lógica pura vive en `src/lib/` para que Vitest la vea —
`color.ts` resuelve claves de color y `day.ts` gana el formateo de días. La
presentación usa las primitivas modernas ya existentes (`Card`, `PageHeader`,
`Button`) más una nueva, `Stat`, que absorbe tres duplicados. La retirada va al
final, cuando ya no queda nadie usando lo viejo.

**Stack:** Next.js 16.2.4 (App Router, Turbopack), React 19, Prisma 7 +
better-sqlite3, Vitest con `TZ=America/Lima`, TypeScript estricto.

**Spec:** `docs/superpowers/specs/2026-07-27-jardin-y-retirada-pixel-design.md`

---

## Contexto que todo agente necesita

**El proyecto está a medio migrar.** Cuatro pantallas ya usan el lenguaje
moderno (tokens `--m-*`, estilos inline, primitivas en `src/components/ui/`). El
Jardín es la última que sigue en pixel. Al acabar este plan, el sistema pixel
desaparece.

**Convenciones del código moderno de este proyecto:**

- Los estilos van **inline** con `style={{...}}`, no con clases de Tailwind. Las
  únicas clases que se usan son `m-card`, `m-label`, `m-num` y las `untap-*`.
- Los colores salen siempre de tokens: `var(--m-ink)`, `var(--m-ink-2)`,
  `var(--m-ink-3)`, `var(--m-surface)`, `var(--m-line)`, `var(--m-series)`,
  `var(--m-good)`, `var(--m-warn)`, `var(--m-crit)`.
- Los números que el usuario lee llevan `className="m-num"` (cifras tabulares).
- Los textos están en español, en minúscula salvo la inicial. **Nada de
  MAYÚSCULAS**: era una convención de la tipografía pixel.
- Singular y plural se respetan siempre: nunca «1 días».

**Cómo se verifica:**

```bash
npx tsc --noEmit && npx eslint . && npx vitest run
```

`npx vitest run` debe dar **101 pruebas en verde** al empezar este plan.

**Prohibido:** `prisma migrate reset` ni ninguna operación que vacíe la base de
datos. Las migraciones de este plan se aplican con `prisma migrate dev`, que
conserva los datos.

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `src/lib/color.ts` | claves de color de hábito y su resolución |
| `src/lib/color.test.ts` | pruebas de `resolveHabitColor` |
| `src/components/ui/Stat.tsx` | primitiva «rótulo + cifra + nota» y su rejilla |

**Se reescriben:**

| Archivo | Qué cambia |
|---|---|
| `src/components/GardenScene.tsx` | escena moderna: cielo y suelo separados, sin adornos de 8 bits |
| `src/app/garden/page.tsx` | página moderna con `PageHeader`, `StatGrid`, `Card` |

**Se modifican:**

| Archivo | Qué cambia |
|---|---|
| `src/lib/day.ts` | gana `formatDays(n)` |
| `src/lib/day.test.ts` | pruebas de `formatDays` |
| `src/app/globals.css` | añade `--h-*`, borra todo lo pixel |
| `src/app/layout.tsx` | fuera VT323 y Press Start 2P |
| `prisma/schema.prisma` | `Habit.color` por defecto `aqua`; fuera `Project.color` |
| `src/components/habits/NewHabitForm.tsx` | tres colores en vez de cinco |
| `src/components/habits/HabitRow.tsx` | recibe `color` y pinta la franja |
| `src/app/habits/page.tsx` | pasa `color` a `HabitRow` |
| `src/components/home/MetricTiles.tsx` | usa `Stat` |
| `src/components/tasks/FlowPanel.tsx` | usa `Stat`; arregla dos «1 días» |
| `src/components/habits/HabitDetail.tsx` | usa `Stat` |
| `src/lib/projects.ts` | fuera el campo `color` |
| `src/components/projects/NewProjectForm.tsx` | fuera el `fd.set("color", …)` |
| `src/components/shell/AppShell.tsx` | comentario que menciona `PageShell` |
| 4 archivos | import de `PixelConfirm` → `ConfirmDialog` |

**Se borran:** `PixelWindow.tsx`, `PixelCard.tsx`, `PixelButton.tsx`,
`PageShell.tsx`, `SectionHeader.tsx`, `Greeting.tsx`.

**Se renombra:** `PixelConfirm.tsx` → `ConfirmDialog.tsx`.

---

## Tarea 1: El módulo de color

**Archivos:**
- Crear: `src/lib/color.ts`
- Probar: `src/lib/color.test.ts`

Los cinco pasteles actuales no son distinguibles entre sí (lavanda y rosa están
a ΔE 7.8 con visión de color normal). La paleta baja a tres colores validados.
Este módulo es la única fuente de verdad de qué colores existen.

- [ ] **Paso 1: Escribir la prueba que falla**

Crear `src/lib/color.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_HABIT_COLOR,
  HABIT_COLORS,
  habitColorVar,
  resolveHabitColor,
} from "./color";

describe("resolveHabitColor", () => {
  it("deja intactas las tres claves válidas", () => {
    expect(resolveHabitColor("aqua")).toBe("aqua");
    expect(resolveHabitColor("violet")).toBe("violet");
    expect(resolveHabitColor("orange")).toBe("orange");
  });

  it("traduce las claves de la era pixel por tono más cercano", () => {
    expect(resolveHabitColor("mint")).toBe("aqua");
    expect(resolveHabitColor("sky")).toBe("violet");
    expect(resolveHabitColor("lavender")).toBe("violet");
    expect(resolveHabitColor("peach")).toBe("orange");
    expect(resolveHabitColor("pink")).toBe("orange");
  });

  it("traduce 'moss', que era el defecto del esquema y no existía", () => {
    expect(resolveHabitColor("moss")).toBe("aqua");
  });

  it("cae en el color por defecto ante cualquier valor desconocido", () => {
    expect(resolveHabitColor("")).toBe(DEFAULT_HABIT_COLOR);
    expect(resolveHabitColor("chartreuse")).toBe(DEFAULT_HABIT_COLOR);
    expect(resolveHabitColor("AQUA")).toBe(DEFAULT_HABIT_COLOR);
  });
});

describe("HABIT_COLORS", () => {
  it("tiene exactamente tres colores, que es el máximo distinguible", () => {
    expect(HABIT_COLORS).toHaveLength(3);
  });

  it("todas sus claves se resuelven a sí mismas", () => {
    for (const c of HABIT_COLORS) {
      expect(resolveHabitColor(c.key)).toBe(c.key);
    }
  });

  it("incluye el color por defecto", () => {
    expect(HABIT_COLORS.map((c) => c.key)).toContain(DEFAULT_HABIT_COLOR);
  });
});

describe("habitColorVar", () => {
  it("devuelve la referencia al token CSS", () => {
    expect(habitColorVar("aqua")).toBe("var(--h-aqua)");
    expect(habitColorVar("violet")).toBe("var(--h-violet)");
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y ver que falla**

```bash
npx vitest run src/lib/color.test.ts
```

Esperado: FAIL, no resuelve el módulo `./color`.

- [ ] **Paso 3: Escribir la implementación**

Crear `src/lib/color.ts`:

```ts
/**
 * Los colores de identidad de un hábito.
 *
 * Son tres y no cinco por una razón medible: validados como paleta categórica
 * sobre la superficie oscura y con la lista de todos los pares —que es el caso
 * real, porque todas las muestras se ven juntas en el selector y todos los
 * hábitos se ven juntos en la lista— ningún conjunto de cuatro pasa la
 * separación bajo daltonismo ni el suelo de visión normal. Tres es el máximo.
 *
 * Quedan fuera a propósito:
 *  - el azul #3987e5, que es --m-series, el color de las gráficas
 *  - verde, amarillo y rojo, que son --m-good, --m-warn y --m-crit
 *
 * Regla que acompaña al naranja: no poner un relleno de --m-crit a plena
 * intensidad junto a un acento de hábito. El filo crítico de la fila va al 45%
 * de opacidad, que compuesto queda a ΔE 22.9 del naranja, y ahí no hay
 * confusión posible.
 */
export type HabitColor = "aqua" | "violet" | "orange";

export const HABIT_COLORS: { key: HabitColor; label: string }[] = [
  { key: "aqua", label: "Aqua" },
  { key: "violet", label: "Violeta" },
  { key: "orange", label: "Naranja" },
];

export const DEFAULT_HABIT_COLOR: HabitColor = "aqua";

/**
 * Claves de la era pixel, traducidas por tono más cercano. `moss` era el
 * `@default` del esquema y nunca existió como token, así que ninguna fila que
 * lo tenga guardado mostró jamás un color.
 */
const LEGACY: Record<string, HabitColor> = {
  mint: "aqua",
  moss: "aqua",
  sky: "violet",
  lavender: "violet",
  peach: "orange",
  pink: "orange",
};

/**
 * Traduce lo que hay guardado en la base de datos a una clave válida. No hace
 * falta migrar filas: se resuelve en lectura.
 */
export function resolveHabitColor(stored: string): HabitColor {
  if (stored === "aqua" || stored === "violet" || stored === "orange") {
    return stored;
  }
  return LEGACY[stored] ?? DEFAULT_HABIT_COLOR;
}

/** Referencia al token CSS del color, para usar en estilos inline. */
export function habitColorVar(key: HabitColor): string {
  return `var(--h-${key})`;
}
```

- [ ] **Paso 4: Ejecutar las pruebas y ver que pasan**

```bash
npx vitest run src/lib/color.test.ts
```

Esperado: PASS, 8 pruebas (4 + 3 + 1). La suite completa pasa de 101 a 109.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/color.ts src/lib/color.test.ts
git commit -m "Anade el modulo de color de habito con tres colores validados"
```

---

## Tarea 2: `formatDays`, la regla que ha fallado cuatro veces

**Archivos:**
- Modificar: `src/lib/day.ts`
- Probar: `src/lib/day.test.ts`

«1 días» ya se ha corregido dos veces a mano y sigue vivo en dos sitios más
(`FlowPanel.tsx:94` y `:99`). Es una regla, así que va a una función con prueba.
Los `.tsx` no los ve Vitest; `src/lib/` sí.

- [ ] **Paso 1: Escribir la prueba que falla**

Añadir al final de `src/lib/day.test.ts`, y añadir `formatDays` al import que ya
existe desde `./day`:

```ts
describe("formatDays", () => {
  it("usa el singular con uno", () => {
    expect(formatDays(1)).toBe("1 día");
  });

  it("usa el plural con cero y con más de uno", () => {
    expect(formatDays(0)).toBe("0 días");
    expect(formatDays(2)).toBe("2 días");
    expect(formatDays(30)).toBe("30 días");
  });

  it("usa el plural con negativos, que no deberían llegar pero llegan", () => {
    expect(formatDays(-1)).toBe("-1 días");
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y ver que falla**

```bash
npx vitest run src/lib/day.test.ts
```

Esperado: FAIL, `formatDays` no está exportado.

- [ ] **Paso 3: Escribir la implementación**

Añadir al final de `src/lib/day.ts`:

```ts
/**
 * «1 día» / «N días». Existe porque el ternario suelto se copió cuatro veces y
 * en dos de ellas salió mal.
 */
export function formatDays(n: number): string {
  return n === 1 ? "1 día" : `${n} días`;
}
```

- [ ] **Paso 4: Ejecutar las pruebas y ver que pasan**

```bash
npx vitest run src/lib/day.test.ts
```

Esperado: PASS, incluidas las tres nuevas.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/day.ts src/lib/day.test.ts
git commit -m "Anade formatDays para que 1 dia no vuelva a salir en plural"
```

---

## Tarea 3: Los tokens y el esquema

**Archivos:**
- Modificar: `src/app/globals.css`
- Modificar: `prisma/schema.prisma:19`

Los tres tokens CSS y el nuevo `@default`. Aquí **no** se borra nada pixel
todavía: eso es la tarea 9, cuando ya nadie lo use.

- [ ] **Paso 1: Añadir los tokens**

En `src/app/globals.css`, dentro del bloque `:root` de los tokens modernos
(el que empieza en la línea 35 con `--m-page`), justo antes de `--m-radius`:

```css
  /*
    Colores de identidad de hábito. Son tres porque con la lista de todos los
    pares ningún conjunto de cuatro pasa la separación bajo daltonismo. Paleta
    validada sobre --m-surface: peor par aqua↔naranja ΔE 9.4 (deutan), peor par
    con visión normal violeta↔aqua ΔE 24.6, los tres ≥ 3:1 de contraste.
    El azul queda fuera por ser --m-series; verde, amarillo y rojo por ser los
    colores de estado.
  */
  --h-aqua: #199e70;
  --h-violet: #9085e9;
  --h-orange: #d95926;

```

- [ ] **Paso 2: Cambiar el `@default` del esquema**

En `prisma/schema.prisma`, línea 19. Antes:

```prisma
  color        String     @default("moss")
```

Después:

```prisma
  color        String     @default("aqua")
```

- [ ] **Paso 3: Crear la migración**

```bash
npx prisma migrate dev --name habit_color_default_aqua
```

Esperado: crea la migración y la aplica. **Si Prisma pide reiniciar la base de
datos, PARAR y escalar** — no aceptar. Un cambio de `@default` no debe requerir
reset.

- [ ] **Paso 4: Comprobar que la base sigue con sus datos**

```bash
npx prisma studio --browser none &
```

O más simple y sin abrir nada:

```bash
node -e "const D=require('better-sqlite3')('prisma/dev.db');console.log('habits',D.prepare('select count(*) c from Habit').get().c,'logs',D.prepare('select count(*) c from HabitLog').get().c)"
```

Esperado: los mismos recuentos que antes de la migración.

- [ ] **Paso 5: Verificar que compila**

```bash
npx tsc --noEmit && npx eslint .
```

Esperado: sin errores.

- [ ] **Paso 6: Commit**

```bash
git add src/app/globals.css prisma/schema.prisma prisma/migrations
git commit -m "Anade los tokens de color de habito y cambia el defecto del esquema"
```

---

## Tarea 4: `Stat`, la primitiva que absorbe tres duplicados

**Archivos:**
- Crear: `src/components/ui/Stat.tsx`
- Modificar: `src/components/home/MetricTiles.tsx`
- Modificar: `src/components/tasks/FlowPanel.tsx`
- Modificar: `src/components/habits/HabitDetail.tsx`

El patrón «rótulo + cifra + nota» está escrito tres veces. El Jardín sería la
cuarta.

**Condición de esta tarea: el resultado renderizado debe ser idéntico.** Los
valores de `fontSize`, `marginTop`, `color` y `letterSpacing` del componente
nuevo están copiados de los tres originales precisamente para eso. No es una
ocasión para retocar el diseño.

- [ ] **Paso 1: Crear la primitiva**

Crear `src/components/ui/Stat.tsx`:

```tsx
import type { ReactNode } from "react";
import { Card } from "./Card";

/**
 * `md` va dentro de su propia tarjeta y es lo que usan las rejillas de
 * métricas de una pantalla. `sm` no lleva tarjeta porque ya vive dentro de
 * una, como en el detalle de un hábito.
 */
export type StatSize = "sm" | "md";

type StatProps = {
  label: string;
  value: string;
  meta?: string;
  size?: StatSize;
};

export function Stat({ label, value, meta, size = "md" }: StatProps) {
  const md = size === "md";

  const body = (
    <>
      <div className="m-label">{label}</div>
      <div
        className="m-num"
        style={{
          fontSize: md ? 21 : 17,
          fontWeight: 600,
          marginTop: md ? 6 : 4,
          letterSpacing: md ? "-0.02em" : undefined,
        }}
      >
        {value}
      </div>
      {meta === undefined ? null : (
        <div
          style={{
            fontSize: md ? 11.5 : 11,
            color: md ? "var(--m-ink-2)" : "var(--m-ink-3)",
            marginTop: md ? 3 : 2,
          }}
        >
          {meta}
        </div>
      )}
    </>
  );

  return md ? <Card style={{ padding: "13px 14px" }}>{body}</Card> : <div>{body}</div>;
}

export function StatGrid({
  children,
  min = 150,
  gap = 10,
}: {
  children: ReactNode;
  min?: number;
  gap?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap,
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Paso 2: Migrar `MetricTiles`**

Reemplazar el contenido completo de `src/components/home/MetricTiles.tsx`:

```tsx
import { weekdayName } from "@/lib/stats";
import { formatDays } from "@/lib/day";
import { Stat, StatGrid } from "@/components/ui/Stat";
import type { WeekdayRate } from "@/lib/metrics";

type Props = {
  streak: { days: number; habitName: string } | null;
  best: WeekdayRate | null;
  level: number;
  xp: number;
  xpToNext: number;
  shields: number;
  maxShields: number;
};

export function MetricTiles(p: Props) {
  return (
    <StatGrid>
      <Stat
        label="Racha activa"
        value={p.streak ? formatDays(p.streak.days) : "—"}
        meta={p.streak ? p.streak.habitName : "sin rachas abiertas"}
      />
      <Stat
        label="Mejor día"
        value={p.best ? weekdayName(p.best.weekday) : "—"}
        meta={p.best ? `${Math.round(p.best.rate * 100)}% de cumplimiento` : "aún sin datos"}
      />
      <Stat
        label="Nivel"
        value={String(p.level)}
        meta={`${p.xp} XP · ${p.xpToNext} para el ${p.level + 1}`}
      />
      <Stat label="Escudos" value={`${p.shields} / ${p.maxShields}`} meta="disponibles" />
    </StatGrid>
  );
}
```

- [ ] **Paso 3: Migrar `FlowPanel` y arreglar los dos «1 días»**

En `src/components/tasks/FlowPanel.tsx`:

Borrar la función local `Stat` completa (líneas 11-24) y ajustar los imports.
Los imports quedan así:

```tsx
import { Card } from "@/components/ui/Card";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { BarChart } from "@/components/charts/BarChart";
import { formatDayLabel, formatDays } from "@/lib/day";
import type { TaskMetrics } from "@/lib/tasks";
```

Y reemplazar el bloque final —la rejilla que empieza en la línea 85 y las dos
`<Stat>` que contiene— por esto. Nótese `formatDays` en vez de `${n} días`, que
era el bug, y `meta` en vez de `hint`:

```tsx
      <StatGrid min={180} gap={12}>
        <Stat
          label="Tiempo de vida"
          value={medianLifetime === null ? "—" : formatDays(medianLifetime)}
          meta={medianLifetime === null ? "aún no has cerrado nada" : "mediana, últimos 90 días"}
        />
        <Stat
          label="Lo más antiguo abierto"
          value={oldestOpen === null ? "—" : formatDays(oldestOpen)}
          meta={oldestOpen === null ? "no queda nada abierto" : "desde que se creó"}
        />
      </StatGrid>
```

- [ ] **Paso 4: Migrar `HabitDetail`**

En `src/components/habits/HabitDetail.tsx`: borrar la función local `Stat`
(líneas 11-21) y la constante local `days` (línea 9), y usar la primitiva.

Los imports quedan así:

```tsx
"use client";

import { useEffect, useState } from "react";
import { fetchHabitStats } from "@/app/actions";
import { on } from "@/lib/events";
import { formatDays } from "@/lib/day";
import { Stat, StatGrid } from "@/components/ui/Stat";
import type { HabitDetailStats } from "@/lib/stats";
import { MonthCalendar } from "./MonthCalendar";
```

Y el bloque de las cuatro cifras pasa a:

```tsx
        <StatGrid min={110} gap={12}>
          <Stat size="sm" label="Racha" value={formatDays(stats.currentStreak)} meta="actual" />
          <Stat size="sm" label="Mejor" value={formatDays(stats.bestStreak)} meta="histórica" />
          <Stat
            size="sm"
            label="30 días"
            value={`${Math.round(stats.completionRate30 * 100)}%`}
            meta={`${stats.doneIn30} de ${stats.scheduledIn30} que tocaban`}
          />
          <Stat size="sm" label="Total" value={String(stats.totalDone)} meta="veces cumplido" />
        </StatGrid>
```

- [ ] **Paso 5: Verificar que compila y que las pruebas siguen en verde**

```bash
npx tsc --noEmit && npx eslint . && npx vitest run
```

Esperado: sin errores, todas las pruebas en verde.

- [ ] **Paso 6: Commit**

```bash
git add src/components/ui/Stat.tsx src/components/home/MetricTiles.tsx src/components/tasks/FlowPanel.tsx src/components/habits/HabitDetail.tsx
git commit -m "Extrae la primitiva Stat y arregla dos 1 dias en Tareas"
```

---

## Tarea 5: El selector de color, con tres opciones

**Archivos:**
- Modificar: `src/components/habits/NewHabitForm.tsx:10-16`, `:50`, `:129-148`

Hoy el selector ofrece cinco colores usando `var(--color-${choice.key})`, que
son tokens pixel. Pasa a tres, con los tokens nuevos.

- [ ] **Paso 1: Cambiar la lista y el estado inicial**

En `src/components/habits/NewHabitForm.tsx`, borrar la constante `COLORS`
(líneas 10-16) y añadir al import:

```tsx
import { DEFAULT_HABIT_COLOR, HABIT_COLORS, habitColorVar } from "@/lib/color";
```

Cambiar la línea 50. Antes:

```tsx
  const [color, setColor] = useState("mint");
```

Después:

```tsx
  const [color, setColor] = useState<string>(DEFAULT_HABIT_COLOR);
```

- [ ] **Paso 2: Cambiar el bloque del selector**

Reemplazar el bloque `<div>` del color (líneas 129-148) por:

```tsx
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
```

Cambia respecto al original: `HABIT_COLORS` en vez de `COLORS`,
`habitColorVar(...)` en vez de `` `var(--color-${choice.key})` ``, y un `title`
nuevo, porque una muestra sin texto necesita algo al pasar el ratón.

- [ ] **Paso 3: Verificar que compila**

```bash
npx tsc --noEmit && npx eslint .
```

Esperado: sin errores.

- [ ] **Paso 4: Commit**

```bash
git add src/components/habits/NewHabitForm.tsx
git commit -m "El selector de color pasa a tres opciones con los tokens nuevos"
```

---

## Tarea 6: La franja de color en la fila del hábito

**Archivos:**
- Modificar: `src/components/habits/HabitRow.tsx`
- Modificar: `src/app/habits/page.tsx:52-68`

`HabitRow` no declara `color` en sus props, así que el dato viaja desde la base
de datos hasta la pantalla de Hábitos y ahí se pierde. Se declara y se pinta.

**Por qué `boxShadow` y no `borderLeft`:** la tarjeta ya tiene `border: 1px
solid`. Subir el borde izquierdo a 3px desplazaría el contenido 2px y rompería
el radio de la esquina. `inset 3px 0 0` pinta dentro, respeta el radio y no
mueve nada.

- [ ] **Paso 1: Declarar la prop y calcular el acento**

En `src/components/habits/HabitRow.tsx`, añadir al import:

```tsx
import { habitColorVar, resolveHabitColor } from "@/lib/color";
```

Añadir `color: string;` al tipo `Props` (después de `icon: string;`):

```tsx
type Props = {
  id: string;
  name: string;
  icon: string;
  color: string;
  streak: number;
  // …el resto sin cambios
};
```

Dentro de `HabitRow`, junto a los otros cálculos (después de la línea que
define `plant`):

```tsx
  const accent = habitColorVar(resolveHabitColor(p.color));
```

- [ ] **Paso 2: Pintar la franja**

En el `<div>` exterior de `HabitRow`, añadir `boxShadow` al objeto de estilo.
Antes:

```tsx
      style={{
        background: "var(--m-surface)",
        border: `1px solid ${p.criticalToday ? "rgba(226, 96, 96, 0.45)" : "var(--m-line)"}`,
        borderRadius: 10,
        padding: 14,
        opacity: pending ? 0.5 : p.scheduledToday ? 1 : 0.65,
      }}
```

Después:

```tsx
      style={{
        background: "var(--m-surface)",
        border: `1px solid ${p.criticalToday ? "rgba(226, 96, 96, 0.45)" : "var(--m-line)"}`,
        borderRadius: 10,
        // La franja de identidad va por dentro para no desplazar el contenido
        // ni romper el radio, que es lo que pasaría subiendo el borde a 3px.
        boxShadow: `inset 3px 0 0 ${accent}`,
        padding: 14,
        paddingLeft: 17,
        opacity: pending ? 0.5 : p.scheduledToday ? 1 : 0.65,
      }}
```

`paddingLeft: 17` compensa los 3px de la franja para que el contenido no quede
pegado a ella.

- [ ] **Paso 3: Pasar la prop desde la pantalla**

`HabitRow` se renderiza en `src/app/habits/page.tsx:52`, que pasa las props una
por una. Añadir `color` después de `icon` (línea 56):

```tsx
                <HabitRow
                  key={habit.id}
                  id={habit.id}
                  name={habit.name}
                  icon={habit.icon}
                  color={habit.color}
                  streak={habit.streak}
```

El resto de las props se quedan igual.

- [ ] **Paso 4: Verificar que compila**

```bash
npx tsc --noEmit && npx eslint .
```

Esperado: sin errores. Si la pantalla no pasa `color`, TypeScript lo dirá aquí —
por eso la prop es obligatoria y no opcional.

- [ ] **Paso 5: Commit**

```bash
git add src/components/habits/HabitRow.tsx src/app/habits/page.tsx
git commit -m "La fila del habito pinta su color de identidad"
```

---

## Tarea 7: La escena del Jardín, moderna

**Archivos:**
- Reescribir: `src/components/GardenScene.tsx`

La reescritura completa. Conserva cielo por horas, estrellas, nubes, plantas con
sus etapas, marchitas, corona, aura y el riego con un click. Se van montañas,
cerca, matojos, regadera y mariposas.

**Nota sobre el cielo:** los degradados actuales meten cielo y suelo en un mismo
`linear-gradient` con paradas duras, y eso es lo que produce el bandeado pixel.
Ahora son dos capas: cielo suave arriba, suelo propio abajo del horizonte.

- [ ] **Paso 1: Escribir el archivo completo**

Reemplazar el contenido completo de `src/components/GardenScene.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import type { HabitWithStatus } from "@/lib/habits";
import { useLocalHour } from "@/lib/useLocalHour";
import { plantEmoji, stageFor, stageLabel } from "@/lib/garden";
import { habitColorVar, resolveHabitColor } from "@/lib/color";
import { formatDays } from "@/lib/day";
import { toggleToday } from "@/app/actions";
import { emitToggleResult } from "@/lib/events";
import { useSparkleBurst, SparkleLayer } from "./Sparkle";

type Props = { habits: HabitWithStatus[] };

type SkyPhase = "dawn" | "morning" | "midday" | "afternoon" | "dusk" | "night";

function phaseFor(hour: number): SkyPhase {
  if (hour < 6) return "night";
  if (hour < 9) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 15) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 21) return "dusk";
  return "night";
}

/** Donde acaba el cielo y empieza la tierra. */
const HORIZON = "62%";

const SKY: Record<SkyPhase, string> = {
  dawn: "linear-gradient(180deg, #2b2440 0%, #6b4f74 45%, #c98f6d 100%)",
  morning: "linear-gradient(180deg, #4a6f9e 0%, #7fa3c9 50%, #cfd9e2 100%)",
  midday: "linear-gradient(180deg, #3d7ab5 0%, #6ba3d4 50%, #bcd8ea 100%)",
  afternoon: "linear-gradient(180deg, #55749e 0%, #8f9cba 50%, #d9b48f 100%)",
  dusk: "linear-gradient(180deg, #241d38 0%, #6d5480 45%, #c07f92 100%)",
  night: "linear-gradient(180deg, #0c0c14 0%, #16162a 55%, #232144 100%)",
};

const GROUND: Record<SkyPhase, string> = {
  dawn: "linear-gradient(180deg, #3a4a2c 0%, #26301c 100%)",
  morning: "linear-gradient(180deg, #46603a 0%, #2c3d24 100%)",
  midday: "linear-gradient(180deg, #4d6b3d 0%, #314426 100%)",
  afternoon: "linear-gradient(180deg, #445c36 0%, #2b3a22 100%)",
  dusk: "linear-gradient(180deg, #2f3a24 0%, #1e2617 100%)",
  night: "linear-gradient(180deg, #1b2416 0%, #121810 100%)",
};

// El amanecer y el atardecer también cuentan como "oscuros" para las estrellas,
// así que el icono no puede deducirse de isDark — antes el 🌅 nunca salía.
function skyIcon(phase: SkyPhase): string {
  if (phase === "dawn" || phase === "dusk") return "🌅";
  if (phase === "night") return "🌙";
  return "☀️";
}

const SKY_LABEL: Record<SkyPhase, string> = {
  dawn: "Amanecer",
  morning: "Mañana",
  midday: "Mediodía",
  afternoon: "Tarde",
  dusk: "Atardecer",
  night: "Noche",
};

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function GardenScene({ habits }: Props) {
  const hour = useLocalHour();
  const phase: SkyPhase = hour === null ? "night" : phaseFor(hour);
  const isDark = phase === "night" || phase === "dusk" || phase === "dawn";

  // Sembrado con los hábitos: la escena no baila en cada render.
  const rand = seedRand(habits.length * 31 + (habits[0]?.id.charCodeAt(0) ?? 7));
  const stars = Array.from({ length: 22 }, () => ({
    left: 2 + rand() * 96,
    top: 2 + rand() * 38,
    size: 2 + Math.floor(rand() * 2),
    delay: rand() * 1.6,
  }));
  const clouds = Array.from({ length: 4 }, (_, i) => ({
    left: 5 + i * 22 + rand() * 6,
    top: 6 + rand() * 18,
    size: 1.4 + rand() * 0.6,
    speed: 40 + rand() * 30,
    delay: rand() * 20,
  }));

  const columns = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(habits.length))));
  const fade = "background 1500ms ease-in-out";

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        minHeight: "30rem",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: SKY[phase], transition: fade }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: HORIZON,
          bottom: 0,
          background: GROUND[phase],
          transition: fade,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 20,
          padding: "3px 9px",
          borderRadius: 999,
          background: "rgba(0, 0, 0, 0.35)",
          color: "var(--m-ink)",
          fontSize: 11,
        }}
      >
        {SKY_LABEL[phase]}
      </div>

      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 20,
          top: 14,
          zIndex: 10,
          fontSize: 32,
          pointerEvents: "none",
          userSelect: "none",
          filter:
            phase === "midday"
              ? "drop-shadow(0 0 14px rgba(245, 200, 158, 0.7))"
              : "drop-shadow(0 0 10px rgba(245, 200, 158, 0.4))",
        }}
      >
        {skyIcon(phase)}
      </span>

      {isDark
        ? stars.map((s, i) => (
            <span
              key={`star-${i}`}
              className="untap-pulse"
              aria-hidden
              style={{
                position: "absolute",
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                borderRadius: "50%",
                background: "#f2f2f5",
                boxShadow: "0 0 4px rgba(242, 242, 245, 0.6)",
                animationDelay: `${s.delay}s`,
                pointerEvents: "none",
              }}
            />
          ))
        : null}

      {clouds.map((c, i) => (
        <span
          key={`cloud-${i}`}
          aria-hidden
          style={{
            position: "absolute",
            left: `${c.left}%`,
            top: `${c.top}%`,
            fontSize: `${c.size}rem`,
            opacity: isDark ? 0.22 : 0.45,
            animation: `cloud-drift ${c.speed}s linear infinite`,
            animationDelay: `-${c.delay}s`,
            filter: isDark ? "grayscale(0.5)" : "none",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          ☁️
        </span>
      ))}

      <div
        style={{
          position: "absolute",
          left: "3%",
          right: "3%",
          top: "58%",
          bottom: "1.25rem",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: 12,
            height: "100%",
            alignContent: "end",
          }}
        >
          {habits.map((h) => (
            <GardenPlant key={h.id} habit={h} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes cloud-drift {
          0%   { transform: translateX(0); }
          100% { transform: translateX(120vw); }
        }
      `}</style>
    </div>
  );
}

/** Tamaño del emoji por etapa: la planta crece de verdad al subir la racha. */
const PLANT_SIZE = [30, 38, 48, 60, 72];

function GardenPlant({ habit }: { habit: HabitWithStatus }) {
  const [pending, startTransition] = useTransition();
  const sparkle = useSparkleBurst("spark");
  const drops = useSparkleBurst("drop");

  const plant = plantEmoji(
    habit.plantSpecies,
    habit.streak,
    habit.doneToday,
    habit.hasEverBeenDone,
  );
  const stage = stageFor(habit.streak);
  const isWilted = !habit.doneToday && habit.streak === 0 && habit.hasEverBeenDone;
  const thirsty = !habit.doneToday && !isWilted && habit.scheduledToday;
  const offDay = !habit.scheduledToday;
  const accent = habitColorVar(resolveHabitColor(habit.color));

  function handleWater() {
    if (habit.doneToday || !habit.scheduledToday || pending) return;
    drops.burst();
    sparkle.burst();
    startTransition(async () => {
      emitToggleResult(await toggleToday(habit.id, false));
    });
  }

  const situacion = habit.doneToday
    ? "ya regada hoy"
    : offDay
      ? "hoy no toca"
      : "click para regar";

  return (
    <button
      type="button"
      onClick={handleWater}
      disabled={pending || habit.doneToday || offDay}
      title={`${habit.name} · ${stageLabel(stage)} · racha de ${formatDays(habit.streak)} · ${situacion}`}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        background: "transparent",
        border: 0,
        padding: 0,
        fontFamily: "inherit",
        cursor: habit.doneToday || offDay ? "default" : "pointer",
      }}
    >
      {stage >= 3 && habit.doneToday ? (
        <span
          className="untap-pulse"
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translate(-50%, -8px)",
            fontSize: 13,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          ✨
        </span>
      ) : null}

      {habit.isAnchor ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -8,
            right: 4,
            fontSize: 14,
            pointerEvents: "none",
            userSelect: "none",
            filter: "drop-shadow(0 0 4px rgba(245, 200, 158, 0.8))",
          }}
        >
          👑
        </span>
      ) : null}

      <span
        className={habit.doneToday ? "untap-bobble" : undefined}
        aria-hidden
        style={{
          position: "relative",
          fontSize: PLANT_SIZE[stage],
          lineHeight: 1,
          userSelect: "none",
          opacity: offDay ? 0.35 : thirsty ? 0.55 : 1,
          filter: isWilted
            ? "saturate(0.4) brightness(0.8)"
            : habit.doneToday
              ? "drop-shadow(0 0 8px rgba(25, 158, 112, 0.5))"
              : "none",
          transition: "opacity 200ms",
        }}
      >
        {plant}
        <SparkleLayer particles={sparkle.particles} />
        <SparkleLayer particles={drops.particles} />
      </span>

      <div
        aria-hidden
        style={{
          width: 72,
          height: 7,
          borderRadius: 4,
          marginTop: 4,
          background: "linear-gradient(180deg, #5a4028 0%, #3b2a1a 100%)",
        }}
      />

      <div
        style={{
          marginTop: 6,
          maxWidth: "9rem",
          padding: "4px 8px",
          borderRadius: 7,
          background: "rgba(0, 0, 0, 0.4)",
          borderLeft: `3px solid ${accent}`,
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "var(--m-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {habit.name}
        </div>
        <div className="m-num" style={{ fontSize: 10.5, color: "var(--m-ink-2)" }}>
          {habit.streak} d · {stageLabel(stage)}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Paso 2: Verificar que compila**

```bash
npx tsc --noEmit && npx eslint .
```

Esperado: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add src/components/GardenScene.tsx
git commit -m "Reescribe la escena del jardin en el lenguaje moderno"
```

---

## Tarea 8: La página del Jardín

**Archivos:**
- Reescribir: `src/app/garden/page.tsx`

Deja de usar `PageShell`, `SectionHeader` y `PixelWindow`. El aviso de marchitas
sube por delante de la escena: es lo accionable de la pantalla y no debe quedar
por debajo del pliegue. Desaparecen el catálogo de especies y el tile de «planta
más vieja».

- [ ] **Paso 1: Escribir el archivo completo**

Reemplazar el contenido completo de `src/app/garden/page.tsx`:

```tsx
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonStyle } from "@/components/ui/Button";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { GardenScene } from "@/components/GardenScene";
import { getHabitsWithTodayStatus } from "@/lib/habits";
import { stageFor } from "@/lib/garden";

export const dynamic = "force-dynamic";

const STAGES = [
  { emoji: "🟫", label: "Semilla", days: "0 d" },
  { emoji: "🌱", label: "Brote", days: "1-2 d" },
  { emoji: "🌿", label: "Joven", days: "3-6 d" },
  { emoji: "🌷", label: "Madura", days: "7-13 d" },
  { emoji: "🌻", label: "Floreciente", days: "14 d o más" },
];

export default async function GardenPage() {
  const habits = await getHabitsWithTodayStatus();

  const total = habits.length;
  const wateredToday = habits.filter((h) => h.doneToday).length;
  const mature = habits.filter((h) => stageFor(h.streak) >= 3).length;
  const blooming = habits.filter((h) => stageFor(h.streak) >= 4).length;
  const wilted = habits.filter(
    (h) => !h.doneToday && h.streak === 0 && h.hasEverBeenDone,
  ).length;

  return (
    <main style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PageHeader
        title="Tu jardín"
        subtitle="Cada hábito es una planta. Riégalas para que crezcan."
      />

      {total === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "36px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden>
              🌱
            </div>
            <p style={{ fontSize: 15, color: "var(--m-ink)", marginBottom: 6 }}>
              Tu jardín está esperando su primera semilla.
            </p>
            <p style={{ fontSize: 13, color: "var(--m-ink-2)", marginBottom: 20 }}>
              Crea un hábito para plantar y empezar a regar.
            </p>
            <Link href="/habits" style={buttonStyle("primary")}>
              Ir a hábitos
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <StatGrid>
            <Stat label="Plantas" value={String(total)} meta="en el jardín" />
            <Stat
              label="Regadas hoy"
              value={`${wateredToday} / ${total}`}
              meta={wateredToday === total ? "el jardín está al día" : "aún queda riego"}
            />
            <Stat label="Maduras" value={String(mature)} meta="racha de 7 días o más" />
            <Stat label="Florecientes" value={String(blooming)} meta="racha de 14 días o más" />
          </StatGrid>

          {wilted > 0 ? (
            <Card>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>
                  🥀
                </span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 550, color: "var(--m-crit)" }}>
                    {wilted === 1 ? "Una planta marchita" : `${wilted} plantas marchitas`}
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 4 }}>
                    {wilted === 1
                      ? "Riégala hoy, desde aquí o desde Hábitos, y revive."
                      : "Riégalas hoy, desde aquí o desde Hábitos, y revivirán."}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <GardenScene habits={habits} />
            <p style={{ fontSize: 12, color: "var(--m-ink-3)", marginTop: 10 }}>
              Click en una planta para regarla. La corona marca el hábito ancla y el
              destello, una racha de 7 días o más.
            </p>
          </Card>

          <Card title="Etapas de crecimiento">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
                gap: 10,
              }}
            >
              {STAGES.map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24 }} aria-hidden>
                    {s.emoji}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--m-ink)", marginTop: 4 }}>
                    {s.label}
                  </div>
                  <div className="m-num" style={{ fontSize: 11, color: "var(--m-ink-3)" }}>
                    {s.days}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--m-ink-2)", marginTop: 12 }}>
              Mantén la racha y la planta crece. Si la rompes se marchita, pero revive
              en cuanto retomes el hábito.
            </p>
          </Card>
        </>
      )}
    </main>
  );
}
```

- [ ] **Paso 2: Comprobar que no se anidan dos `<main>`**

`AppShell` mete el contenido en un `<div>`, no en un `<main>`, precisamente
porque cada pantalla trae el suyo. Confirmar leyendo
`src/components/shell/AppShell.tsx` que sigue siendo así. Dos `<main>` anidados
son HTML inválido, y es un fallo que ya se colgó una vez en este proyecto.

> **Por qué el estado vacío usa `<Link>` y no `<Button>`:** `Button` renderiza un
> `<button>` y no acepta ninguna prop para salir como enlace. Lo que sí exporta
> es `buttonStyle(variant, size)`, pensado exactamente para esto. Un `<button>`
> con un `onClick` que navega sería peor: rompe abrir en pestaña nueva.

- [ ] **Paso 3: Verificar que compila**

```bash
npx tsc --noEmit && npx eslint .
```

Esperado: sin errores.

- [ ] **Paso 4: Commit**

```bash
git add src/app/garden/page.tsx
git commit -m "Reescribe la pagina del jardin con las primitivas modernas"
```

---

## Tarea 9: Retirar `Project.color`

**Archivos:**
- Modificar: `prisma/schema.prisma:84`
- Modificar: `src/lib/projects.ts:36`, `:77`
- Modificar: `src/components/projects/NewProjectForm.tsx:23`

Columna muerta: el formulario la fija a `"lavender"` sin preguntar y no se pinta
en ninguna parte.

- [ ] **Paso 1: Quitar el `fd.set` del formulario**

En `src/components/projects/NewProjectForm.tsx`, borrar la línea 23:

```tsx
    fd.set("color", "lavender");
```

- [ ] **Paso 2: Quitar el campo del tipo y del payload**

En `src/lib/projects.ts`, borrar la línea 36 (`color: string;` del tipo) y la
línea 77 (`color: p.color,` del objeto que se devuelve).

- [ ] **Paso 3: Quitar la columna del esquema**

En `prisma/schema.prisma`, borrar la línea 84:

```prisma
  color       String        @default("lavender")
```

- [ ] **Paso 4: Comprobar que nadie más la usa**

```bash
grep -rn "color" src/lib/projects.ts src/components/projects src/app/actions.ts | grep -v "var(--"
```

Esperado: ninguna línea que lea o escriba `color` de un proyecto. Si
`src/app/actions.ts` lee `color` del `FormData` al crear un proyecto, quitar
también esa lectura.

- [ ] **Paso 5: Crear la migración**

```bash
npx prisma migrate dev --name drop_project_color
```

Esperado: crea y aplica la migración. **Si Prisma pide reiniciar la base de
datos, PARAR y escalar.** Borrar una columna en SQLite reconstruye la tabla
conservando las filas; no debe hacer falta reset.

- [ ] **Paso 6: Comprobar que los proyectos siguen ahí**

```bash
node -e "const D=require('better-sqlite3')('prisma/dev.db');console.log('projects',D.prepare('select count(*) c from Project').get().c)"
```

Esperado: el mismo recuento que antes.

- [ ] **Paso 7: Verificar**

```bash
npx tsc --noEmit && npx eslint . && npx vitest run
```

Esperado: sin errores, pruebas en verde.

- [ ] **Paso 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/projects.ts src/components/projects/NewProjectForm.tsx src/app/actions.ts
git commit -m "Retira Project.color, que se guardaba y no se pintaba"
```

---

## Tarea 10: La retirada

**Archivos:**
- Borrar: `PixelWindow.tsx`, `PixelCard.tsx`, `PixelButton.tsx`, `PageShell.tsx`, `SectionHeader.tsx`, `Greeting.tsx`
- Renombrar: `PixelConfirm.tsx` → `ConfirmDialog.tsx`
- Modificar: `globals.css`, `layout.tsx`, `AppShell.tsx`

Ya nadie usa nada de esto. Esta tarea solo borra.

- [ ] **Paso 1: Confirmar que están huérfanos**

```bash
grep -rn "PixelWindow\|PixelCard\|PixelButton\|PageShell\|SectionHeader\|Greeting" src --include=*.tsx
```

Esperado: solo las líneas de los propios archivos que se van a borrar, más el
comentario de `AppShell.tsx`. **Si aparece cualquier otro archivo importándolos,
PARAR:** significa que una tarea anterior quedó a medias.

- [ ] **Paso 2: Borrar los seis archivos**

```bash
git rm src/components/PixelWindow.tsx src/components/PixelCard.tsx src/components/PixelButton.tsx src/components/PageShell.tsx src/components/SectionHeader.tsx src/components/Greeting.tsx
```

- [ ] **Paso 3: Renombrar `PixelConfirm`**

No tiene ni una línea de estilo pixel; solo le queda el nombre.

```bash
git mv src/components/PixelConfirm.tsx src/components/ConfirmDialog.tsx
```

Actualizar el import en los cuatro archivos que lo usan —
`src/components/habits/HabitRow.tsx`, `src/components/tasks/TaskCard.tsx`,
`src/components/projects/ProjectCard.tsx`,
`src/components/projects/ProjectTreeItem.tsx` — cambiando en cada uno:

```tsx
import { useConfirm } from "@/components/PixelConfirm";
```

por:

```tsx
import { useConfirm } from "@/components/ConfirmDialog";
```

- [ ] **Paso 4: Limpiar `globals.css`**

Borrar de `src/app/globals.css`:

1. El comentario de cabecera `Untap — Pixel art design tokens (dark pastel)` y
   el bloque `:root` completo de las líneas 6-29 (todos los `--color-*`).
2. Dentro de `@theme inline`, las trece líneas `--color-*` y las dos `--font-*`
   (`--font-pixel`, `--font-display`). **Si el bloque `@theme inline` se queda
   vacío, borrarlo entero.**
3. El bloque `.pixel-page` (líneas 124-138) con su comentario.
4. La clase `.font-display` (líneas 140-142).
5. `.pixel-edge`, `.pixel-edge-tight`, `.pixel-button` y sus tres
   pseudoclases, `.pixel-window`, `.pixel-input` y `.pixel-input:focus`.
6. La regla global `img { image-rendering: pixelated; }` — pixelaba **todas** las
   imágenes del proyecto.
7. `.hover-lift` y `.hover-lift:hover`.
8. `.section-accent` y `.section-accent::before` (CSS muerto, sin uso).
9. Las animaciones `untap-page-in` y `untap-slide-in` con sus `@keyframes` y sus
   clases.

**Se conservan:** `untap-bobble`, `untap-pulse`, `untap-popin` con sus
`@keyframes`, el bloque `@media (prefers-reduced-motion: reduce)` **entero y sin
tocar**, `.m-root`, `.m-card`, `.m-label`, `.m-num`, el `:root` de los tokens
`--m-*` y `--h-*`, y las reglas de `html, body`.

Actualizar también el comentario del bloque de tokens modernos, que dice que
conviven con los pixel «mientras quedan pantallas por migrar». Ya no queda
ninguna.

- [ ] **Paso 5: Limpiar `layout.tsx`**

Reemplazar el contenido completo de `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { AchievementToast } from "@/components/AchievementToast";
import { SoundEffects } from "@/components/SoundEffects";

export const metadata: Metadata = {
  title: "Untap",
  description: "Untap — hábitos, tareas y proyectos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full">
        <AchievementToast />
        <SoundEffects />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

Cambia: fuera el import de `next/font/google` y las dos configuraciones de
fuente, fuera las dos clases de variable del `<html>`, y la descripción deja de
decir «al estilo pixel art», que ya no es cierto. Tras esto el proyecto no
descarga ninguna fuente: todo usa `--m-font`, que es `system-ui`.

- [ ] **Paso 6: Actualizar el comentario de `AppShell`**

En `src/components/shell/AppShell.tsx`, alrededor de la línea 98 hay un
comentario que explica por qué el contenido va en un `<div>` y menciona que unas
pantallas traen su `<main>` «directamente, y las demás a través de PageShell».
`PageShell` ya no existe: reescribir el comentario para que diga que cada
pantalla trae su propio `<main>`, y por eso aquí va un `<div>`.

- [ ] **Paso 7: La búsqueda que debe salir vacía**

```bash
grep -rn "\-\-color-\|pixel-\|font-display\|VT323\|Press_Start\|Press Start\|font-vt323\|font-press-start\|untap-page-in\|untap-slide-in\|hover-lift\|section-accent" src
```

Esperado: **cero resultados.** Cualquier línea que aparezca es trabajo sin
terminar.

- [ ] **Paso 8: Verificar todo**

```bash
npx tsc --noEmit && npx eslint . && npx vitest run && npx next build
```

Esperado: sin errores y build correcta.

- [ ] **Paso 9: Commit**

```bash
git add -A
git commit -m "Retira el sistema pixel: componentes, clases, tokens y tipografias"
```

---

## Tarea 11: Verificación en navegador

**Archivos:** ninguno, salvo los arreglos que aparezcan.

Las tres fases anteriores produjeron **cada una** al menos un fallo real que
`tsc`, `eslint` y `build` dieron por bueno: un `renderTooltip` cruzando la
frontera servidor/cliente que devolvía 500, un formulario de 215px de ancho, y
unas fechas desplazadas un día. Los comandos verdes no sustituyen a mirar.

- [ ] **Paso 1: Arrancar el servidor**

Usar la herramienta de preview del entorno, **no** `npm run dev` por Bash.

> **Aviso:** en este proyecto un `loading.tsx` en la raíz cuelga todas las
> páginas (Next 16.2.4 + Turbopack + `force-dynamic`). Está documentado en el
> README. Si alguna página se queda colgada indefinidamente, comprobar que no ha
> reaparecido ese archivo.

- [ ] **Paso 2: Revisar el Jardín con plantas**

Ir a `/garden`. Comprobar:

- las cifras de arriba cuadran con los hábitos que hay
- la escena pinta cielo arriba y suelo abajo, con el horizonte claro
- cada planta tiene su tierra y su cartel, y el cartel lleva franja de color
- el cartel dice «1 d», nunca «1 días»
- no hay montañas, ni cerca, ni matojos, ni regadera, ni mariposas
- no hay ni una letra en tipografía de 8 bits ni en MAYÚSCULAS
- la consola del navegador no tiene errores

- [ ] **Paso 3: Regar desde la escena**

Click en una planta pendiente. Comprobar que se marca el hábito, que salen las
gotas y los destellos, que la cifra de «regadas hoy» sube, y que la consola
sigue limpia.

- [ ] **Paso 4: Recorrer las seis fases del cielo**

`useLocalHour` lee `new Date().getHours()` y se resuscribe con el evento `focus`
de la ventana, así que se puede forzar la hora sin recargar — y sin recargar la
sustitución sobrevive. En la consola del navegador:

```js
Date.prototype.getHours = function () { return 13; };
window.dispatchEvent(new Event("focus"));
```

Repetir con `3` (noche), `7` (amanecer), `10` (mañana), `13` (mediodía), `16`
(tarde) y `19` (atardecer). En cada una, confirmar que el cielo y el suelo
cambian juntos con su transición, que la píldora dice la fase correcta, que el
icono es ☀️ / 🌅 / 🌙 según toca, y que las estrellas **solo** salen en
amanecer, atardecer y noche.

Al terminar, recargar la página para deshacer la sustitución.

- [ ] **Paso 5: El Jardín vacío**

**No borrar hábitos de la base de datos para esto.** Se fuerza en el código y se
revierte. En `src/app/garden/page.tsx`, cambiar temporalmente la línea de la
consulta a
`const habits: never[] = [];`, mirar la pantalla, comprobar que el botón «Ir a
hábitos» se ve como un botón primario y navega a `/habits`, y después revertir:

```bash
git checkout src/app/garden/page.tsx
```

Confirmar que el revertido funcionó antes de seguir:

```bash
git status --porcelain src/app/garden/page.tsx
```

Esperado: sin salida.

- [ ] **Paso 6: La franja de color en Hábitos**

Ir a `/habits`. Comprobar que cada fila tiene su franja vertical de 3px a la
izquierda, que el contenido no está pegado a ella, que la esquina redondeada no
se ha roto, y que en un hábito crítico la franja y el filo rojo se distinguen
sin esfuerzo.

- [ ] **Paso 7: El selector de color**

Abrir el formulario de hábito nuevo. Comprobar que hay **tres** muestras y no
cinco, que las tres se ven claramente distintas, que la seleccionada tiene su
borde, y que al crear un hábito el color elegido aparece en su fila.

- [ ] **Paso 8: Las tres pantallas migradas a `Stat`**

Comprobar que Inicio, el detalle de un hábito desplegado en `/habits` y `/tasks`
se ven **igual que antes**. Era una extracción, no un rediseño. En `/tasks`,
además, comprobar que «Tiempo de vida» y «Lo más antiguo abierto» dicen «1 día»
y no «1 días» cuando el valor es 1.

- [ ] **Paso 9: Que nada se ha roto con el renombrado**

Recorrer `/`, `/habits`, `/tasks`, `/projects` y `/garden`. En `/tasks` y
`/projects`, abrir un diálogo de borrado y cancelarlo, para confirmar que
`useConfirm` sigue funcionando tras el renombrado. **Cancelar, no confirmar.**

- [ ] **Paso 10: Movimiento reducido**

Con `prefers-reduced-motion: reduce` activo, comprobar que las estrellas y las
plantas no se animan y que nada queda invisible.

- [ ] **Paso 11: Móvil**

Con el viewport en 375px de ancho, comprobar que el Jardín no desborda en
horizontal y que la barra inferior de navegación no tapa el contenido.

- [ ] **Paso 12: Commit de los arreglos**

Si los pasos anteriores destaparon fallos, arreglarlos y commitear:

```bash
git add -A
git commit -m "Arregla lo que aparecio al verificar el jardin en el navegador"
```

Si no apareció nada, no hay commit — y conviene decirlo explícitamente en vez de
dar por hecho que se revisó.

---

## Cierre

- [ ] **Revisión final de la rama**

```bash
npx tsc --noEmit && npx eslint . && npx vitest run && npx next build
```

Esperado: todo verde, **112 pruebas** (101 al empezar + 8 de `color` + 3 de
`formatDays`). El número se confirma ejecutando, no se da por bueno de antemano.

- [ ] **Usar superpowers:finishing-a-development-branch** para decidir cómo
      integrar el trabajo.
