# Inicio moderno — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir la pantalla de Inicio como panel moderno con estado del día accionable y tendencia de cumplimiento, junto a la capa de métricas y las primitivas de gráfica que servirán al resto de pantallas.

**Architecture:** Tres capas independientes. `lib/metrics.ts` calcula cumplimiento con funciones puras sin tocar base de datos. `lib/home.ts` consulta Prisma y compone el payload. `components/charts/*` pinta series de números sin saber nada del dominio. La pantalla une las tres.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Prisma 7 sobre SQLite, Tailwind 4, Vitest. Sin librería de gráficas: SVG a mano.

**Spec:** `docs/superpowers/specs/2026-07-27-inicio-moderno-design.md`

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/metrics.ts` (nuevo) | Cumplimiento diario, media móvil, delta de periodo, mejor día. Puro |
| `src/lib/metrics.test.ts` (nuevo) | Tests de lo anterior |
| `src/lib/chart.ts` (nuevo) | Escalas, trazado de líneas y áreas, segmentación de huecos. Puro |
| `src/lib/chart.test.ts` (nuevo) | Tests de lo anterior |
| `src/lib/home.ts` (nuevo) | Consulta Prisma y compone el payload de Inicio |
| `src/components/charts/ProgressRing.tsx` (nuevo) | Anillo de progreso |
| `src/components/charts/ComplianceChart.tsx` (nuevo) | Línea, área, puntos, cruceta y tooltip |
| `src/components/home/TodayCard.tsx` (nuevo) | Bloque «Hoy» con chips accionables |
| `src/components/home/TrendCard.tsx` (nuevo) | Bloque «Cumplimiento» con selector de rango |
| `src/components/home/MetricTiles.tsx` (nuevo) | Fila de cuatro métricas secundarias |
| `src/components/home/QuestList.tsx` (nuevo) | Misiones del día, lenguaje neutro |
| `src/app/globals.css` (modificar) | Añadir tokens modernos junto a los pixel |
| `src/app/page.tsx` (reescribir) | Composición de la pantalla |
| `src/lib/quests.ts` (modificar) | Textos neutros en `QUEST_DEFS` |

Las gráficas reciben números y no importan nada de `lib/habits` ni `lib/metrics`: así valen luego para tareas y proyectos sin tocarlas.

---

### Task 1: Tokens de diseño modernos

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Añadir el bloque de tokens**

Insertar justo después del bloque `:root { ... }` existente, sin borrar nada de lo que ya hay (las otras cuatro pantallas siguen usando los tokens pixel):

```css
/*
  Tokens del lenguaje moderno. Conviven con los pixel de arriba mientras
  quedan pantallas por migrar; los antiguos se retiran con la última.
*/
:root {
  --m-page: #0f0f13;
  --m-surface: #17171d;
  --m-elevated: #1e1e26;
  --m-line: rgba(255, 255, 255, 0.09);

  --m-ink: #f2f2f5;
  --m-ink-2: #a8a8b4;
  --m-ink-3: #75757f;

  --m-series: #3987e5;
  --m-track: rgba(255, 255, 255, 0.09);

  --m-good: #0ca30c;
  --m-warn: #fab219;
  --m-crit: #d03b3b;

  --m-radius: 10px;
  --m-font: system-ui, -apple-system, "Segoe UI", sans-serif;
}

.m-root {
  font-family: var(--m-font);
  color: var(--m-ink);
  background: var(--m-page);
}

.m-card {
  background: var(--m-surface);
  border: 1px solid var(--m-line);
  border-radius: var(--m-radius);
  padding: 18px;
}

.m-label {
  font-size: 11px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--m-ink-3);
}

.m-num {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Comprobar que compila**

Run: `npm run build`
Expected: build correcto, sin avisos nuevos de CSS.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "Añade los tokens del lenguaje visual moderno"
```

---

### Task 2: Serie de cumplimiento diario

**Files:**
- Create: `src/lib/metrics.ts`
- Test: `src/lib/metrics.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/metrics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dayKeyFromISO } from "./day";
import { complianceSeries, type HabitSpec, type LogEntry } from "./metrics";

const key = (iso: string) => dayKeyFromISO(iso)!;
const DAILY = "1111111";
const MWF = "0101010"; // lun, mié, vie

function habit(id: string, schedule = DAILY, since = "2026-07-01"): HabitSpec {
  return { id, schedule, since: key(since) };
}

function log(
  habitId: string,
  iso: string,
  extra: Partial<LogEntry> = {},
): LogEntry {
  return { habitId, day: key(iso), partial: false, shielded: false, ...extra };
}

describe("complianceSeries", () => {
  it("cuenta cumplidos sobre programados", () => {
    const days = complianceSeries(
      [habit("a"), habit("b")],
      [log("a", "2026-07-20")],
      key("2026-07-20"),
      key("2026-07-20"),
    );
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "2026-07-20",
      scheduled: 2,
      done: 1,
      rate: 0.5,
    });
  });

  it("no cuenta el hábito en días anteriores a su existencia", () => {
    const days = complianceSeries(
      [habit("a", DAILY, "2026-07-20")],
      [],
      key("2026-07-19"),
      key("2026-07-20"),
    );
    expect(days[0].scheduled).toBe(0);
    expect(days[0].rate).toBeNull();
    expect(days[1].scheduled).toBe(1);
  });

  it("excluye del promedio los días sin nada programado", () => {
    // Sábado 25: el hábito L-M-V no toca.
    const days = complianceSeries(
      [habit("a", MWF)],
      [],
      key("2026-07-25"),
      key("2026-07-25"),
    );
    expect(days[0].scheduled).toBe(0);
    expect(days[0].rate).toBeNull();
  });

  it("cuenta el modo mínimo como medio cumplimiento", () => {
    const days = complianceSeries(
      [habit("a"), habit("b")],
      [log("a", "2026-07-20", { partial: true })],
      key("2026-07-20"),
      key("2026-07-20"),
    );
    expect(days[0].done).toBe(0.5);
    expect(days[0].rate).toBe(0.25);
  });

  it("no da por cumplido un día cubierto por escudo, pero lo reporta", () => {
    const days = complianceSeries(
      [habit("a")],
      [log("a", "2026-07-20", { shielded: true })],
      key("2026-07-20"),
      key("2026-07-20"),
    );
    expect(days[0].done).toBe(0);
    expect(days[0].rate).toBe(0);
    expect(days[0].shielded).toBe(1);
  });

  it("ignora registros de días en los que el hábito no tocaba", () => {
    const days = complianceSeries(
      [habit("a", MWF)],
      [log("a", "2026-07-25")], // sábado
      key("2026-07-25"),
      key("2026-07-25"),
    );
    expect(days[0].scheduled).toBe(0);
    expect(days[0].done).toBe(0);
  });

  it("devuelve un elemento por día del rango, en orden", () => {
    const days = complianceSeries([habit("a")], [], key("2026-07-20"), key("2026-07-23"));
    expect(days.map((d) => d.date)).toEqual([
      "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23",
    ]);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/lib/metrics.test.ts`
Expected: FAIL — no se puede resolver el módulo `./metrics`.

- [ ] **Step 3: Implementar**

Crear `src/lib/metrics.ts`:

```ts
// Métricas de cumplimiento. Todo aquí es puro: recibe datos ya cargados y
// devuelve números. Las consultas viven en lib/home.ts.

import { addDays, isoFromDayKey } from "./day";
import { isScheduledOn } from "./streak";

/** Cuánto suma un día marcado en modo mínimo. */
export const PARTIAL_WEIGHT = 0.5;

export type HabitSpec = {
  id: string;
  schedule: string;
  /** Primer día en que el hábito cuenta: creación o su registro más antiguo. */
  since: Date;
};

export type LogEntry = {
  habitId: string;
  day: Date;
  partial: boolean;
  shielded: boolean;
};

export type DayCompliance = {
  date: string;
  scheduled: number;
  done: number;
  shielded: number;
  /** null cuando no tocaba nada: ese día no entra en ningún promedio. */
  rate: number | null;
};

export function complianceSeries(
  habits: HabitSpec[],
  logs: LogEntry[],
  from: Date,
  to: Date,
): DayCompliance[] {
  const byDay = new Map<number, LogEntry[]>();
  for (const entry of logs) {
    const t = entry.day.getTime();
    const list = byDay.get(t);
    if (list) list.push(entry);
    else byDay.set(t, [entry]);
  }

  const out: DayCompliance[] = [];
  for (let cursor = from; cursor.getTime() <= to.getTime(); cursor = addDays(cursor, 1)) {
    const activeIds = new Set(
      habits
        .filter(
          (h) =>
            cursor.getTime() >= h.since.getTime() &&
            isScheduledOn(h.schedule, cursor),
        )
        .map((h) => h.id),
    );

    let done = 0;
    let shielded = 0;
    for (const entry of byDay.get(cursor.getTime()) ?? []) {
      if (!activeIds.has(entry.habitId)) continue;
      if (entry.shielded) {
        shielded += 1;
        continue;
      }
      done += entry.partial ? PARTIAL_WEIGHT : 1;
    }

    out.push({
      date: isoFromDayKey(cursor),
      scheduled: activeIds.size,
      done,
      shielded,
      rate: activeIds.size === 0 ? null : done / activeIds.size,
    });
  }
  return out;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/lib/metrics.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics.ts src/lib/metrics.test.ts
git commit -m "Añade el cálculo de la serie de cumplimiento diario"
```

---

### Task 3: Media móvil y promedio

**Files:**
- Modify: `src/lib/metrics.ts`
- Test: `src/lib/metrics.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Ampliar la línea de import existente de `./metrics` para que quede así:

```ts
import {
  averageRate,
  complianceSeries,
  rollingMean,
  type HabitSpec,
  type LogEntry,
} from "./metrics";
```

Y añadir al final del archivo:

```ts
describe("rollingMean", () => {
  it("promedia la ventana que termina en cada punto", () => {
    expect(rollingMean([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5]);
  });

  it("usa los datos disponibles mientras la ventana no está llena", () => {
    expect(rollingMean([2, 4], 7)).toEqual([2, 3]);
  });

  it("ignora los huecos sin romper la media", () => {
    expect(rollingMean([1, null, 3], 3)).toEqual([1, 1, 2]);
  });

  it("devuelve null cuando la ventana entera es hueco", () => {
    expect(rollingMean([null, null], 2)).toEqual([null, null]);
  });
});

describe("averageRate", () => {
  it("promedia solo los días con algo programado", () => {
    expect(
      averageRate([
        { date: "a", scheduled: 2, done: 1, shielded: 0, rate: 0.5 },
        { date: "b", scheduled: 0, done: 0, shielded: 0, rate: null },
        { date: "c", scheduled: 1, done: 1, shielded: 0, rate: 1 },
      ]),
    ).toBe(0.75);
  });

  it("devuelve null si no hay ningún día con datos", () => {
    expect(
      averageRate([{ date: "a", scheduled: 0, done: 0, shielded: 0, rate: null }]),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/lib/metrics.test.ts`
Expected: FAIL — `rollingMean` y `averageRate` no existen.

- [ ] **Step 3: Implementar**

Añadir al final de `src/lib/metrics.ts`:

```ts
/**
 * Media móvil de la ventana que termina en cada punto. Los huecos no cuentan;
 * si la ventana entera es hueco, el resultado también lo es.
 */
export function rollingMean(
  values: (number | null)[],
  window: number,
): (number | null)[] {
  return values.map((_, i) => {
    const slice = values
      .slice(Math.max(0, i - window + 1), i + 1)
      .filter((v): v is number => v !== null);
    if (slice.length === 0) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** Cumplimiento medio de los días que tenían algo programado. */
export function averageRate(days: DayCompliance[]): number | null {
  const rates = days
    .map((d) => d.rate)
    .filter((v): v is number => v !== null);
  if (rates.length === 0) return null;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/lib/metrics.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics.ts src/lib/metrics.test.ts
git commit -m "Añade media móvil y promedio de cumplimiento"
```

---

### Task 4: Delta de periodo y mejor día

**Files:**
- Modify: `src/lib/metrics.ts`
- Test: `src/lib/metrics.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Ampliar de nuevo el import de `./metrics` para que quede así:

```ts
import {
  averageRate,
  bestWeekday,
  complianceSeries,
  periodDelta,
  rollingMean,
  type DayCompliance,
  type HabitSpec,
  type LogEntry,
} from "./metrics";
```

Y añadir al final del archivo:

```ts
function day(date: string, rate: number | null): DayCompliance {
  return {
    date,
    scheduled: rate === null ? 0 : 1,
    done: rate ?? 0,
    shielded: 0,
    rate,
  };
}

describe("periodDelta", () => {
  it("compara el último periodo con el anterior", () => {
    const days = [
      ...Array.from({ length: 2 }, (_, i) => day(`2026-07-0${i + 1}`, 0.5)),
      ...Array.from({ length: 2 }, (_, i) => day(`2026-07-0${i + 3}`, 0.8)),
    ];
    expect(periodDelta(days, 2)).toEqual({
      current: 0.8,
      previous: 0.5,
      deltaPoints: 30,
    });
  });

  it("omite la comparación si no hay periodo anterior", () => {
    const days = [day("2026-07-01", 0.6), day("2026-07-02", 0.6)];
    expect(periodDelta(days, 2)).toEqual({
      current: 0.6,
      previous: null,
      deltaPoints: null,
    });
  });

  it("devuelve null si el periodo actual no tiene datos", () => {
    expect(periodDelta([day("2026-07-01", null)], 2)).toBeNull();
  });
});

describe("bestWeekday", () => {
  it("elige el día de la semana con mejor tasa media", () => {
    // 2026-07-20 lunes, 2026-07-21 martes, 2026-07-27 lunes
    const days = [
      day("2026-07-20", 0.4),
      day("2026-07-21", 0.9),
      day("2026-07-27", 0.6),
    ];
    expect(bestWeekday(days)).toEqual({ weekday: 2, rate: 0.9 });
  });

  it("promedia las repeticiones del mismo día de la semana", () => {
    const days = [day("2026-07-20", 0.4), day("2026-07-27", 1)];
    expect(bestWeekday(days)).toEqual({ weekday: 1, rate: 0.7 });
  });

  it("devuelve null sin datos", () => {
    expect(bestWeekday([day("2026-07-20", null)])).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/lib/metrics.test.ts`
Expected: FAIL — `periodDelta` y `bestWeekday` no existen.

- [ ] **Step 3: Implementar**

Añadir al final de `src/lib/metrics.ts`:

```ts
export type PeriodDelta = {
  current: number;
  previous: number | null;
  /** Diferencia en puntos porcentuales, redondeada. */
  deltaPoints: number | null;
};

/**
 * Compara los últimos `periodDays` días con los `periodDays` anteriores.
 * Se usan 28 días (cuatro semanas exactas) para que ambos periodos tengan la
 * misma composición de días de la semana.
 */
export function periodDelta(
  days: DayCompliance[],
  periodDays: number,
): PeriodDelta | null {
  const current = averageRate(days.slice(-periodDays));
  if (current === null) return null;

  const previous = averageRate(days.slice(-periodDays * 2, -periodDays));
  return {
    current,
    previous,
    deltaPoints:
      previous === null ? null : Math.round((current - previous) * 100),
  };
}

export type WeekdayRate = { weekday: number; rate: number };

/** Día de la semana (0=domingo) con mejor tasa media de cumplimiento. */
export function bestWeekday(days: DayCompliance[]): WeekdayRate | null {
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);

  for (const d of days) {
    if (d.rate === null) continue;
    const weekday = new Date(`${d.date}T00:00:00Z`).getUTCDay();
    sums[weekday] += d.rate;
    counts[weekday] += 1;
  }

  let best: WeekdayRate | null = null;
  for (let weekday = 0; weekday < 7; weekday++) {
    if (counts[weekday] === 0) continue;
    const rate = sums[weekday] / counts[weekday];
    if (!best || rate > best.rate) best = { weekday, rate };
  }
  return best;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/lib/metrics.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics.ts src/lib/metrics.test.ts
git commit -m "Añade delta entre periodos y mejor día de la semana"
```

---

### Task 5: Helpers de trazado

**Files:**
- Create: `src/lib/chart.ts`
- Test: `src/lib/chart.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/chart.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { areaPath, linePath, scaleLinear, segments } from "./chart";

describe("scaleLinear", () => {
  it("mapea el dominio al rango", () => {
    const s = scaleLinear([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
  });

  it("admite rangos invertidos, como el eje Y del SVG", () => {
    const s = scaleLinear([0, 1], [100, 0]);
    expect(s(0)).toBe(100);
    expect(s(1)).toBe(0);
  });

  it("no divide por cero con dominio degenerado", () => {
    const s = scaleLinear([5, 5], [0, 100]);
    expect(s(5)).toBe(0);
  });
});

describe("linePath", () => {
  it("traza una polilínea", () => {
    expect(linePath([{ x: 0, y: 10 }, { x: 5, y: 0 }])).toBe("M0 10 L5 0");
  });

  it("devuelve cadena vacía sin puntos", () => {
    expect(linePath([])).toBe("");
  });
});

describe("areaPath", () => {
  it("cierra la línea contra la base", () => {
    expect(areaPath([{ x: 0, y: 10 }, { x: 5, y: 0 }], 20)).toBe(
      "M0 10 L5 0 L5 20 L0 20 Z",
    );
  });
});

describe("segments", () => {
  it("parte la serie en tramos continuos, saltando los huecos", () => {
    expect(segments([1, 2, null, 4])).toEqual([
      { start: 0, values: [1, 2] },
      { start: 3, values: [4] },
    ]);
  });

  it("devuelve un solo tramo si no hay huecos", () => {
    expect(segments([1, 2])).toEqual([{ start: 0, values: [1, 2] }]);
  });

  it("devuelve vacío si todo son huecos", () => {
    expect(segments([null, null])).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/lib/chart.test.ts`
Expected: FAIL — no se puede resolver el módulo `./chart`.

- [ ] **Step 3: Implementar**

Crear `src/lib/chart.ts`:

```ts
// Helpers de trazado SVG. No saben nada del dominio: reciben números.

export type Point = { x: number; y: number };

/** Escala lineal de un dominio a un rango. El rango puede ir al revés. */
export function scaleLinear(
  domain: [number, number],
  range: [number, number],
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => r0;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function linePath(points: Point[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`)
    .join(" ");
}

/** La misma línea, cerrada contra una base horizontal. */
export function areaPath(points: Point[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return [
    linePath(points),
    `L${round(last.x)} ${round(baselineY)}`,
    `L${round(first.x)} ${round(baselineY)}`,
    "Z",
  ].join(" ");
}

/**
 * Parte una serie con huecos en tramos continuos, conservando el índice de
 * inicio de cada uno. Así la línea se interrumpe en los días sin nada
 * programado en vez de bajar a cero.
 */
export function segments<T>(
  values: (T | null)[],
): { start: number; values: T[] }[] {
  const out: { start: number; values: T[] }[] = [];
  let current: { start: number; values: T[] } | null = null;

  values.forEach((value, i) => {
    if (value === null) {
      current = null;
      return;
    }
    if (!current) {
      current = { start: i, values: [] };
      out.push(current);
    }
    current.values.push(value);
  });

  return out;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run src/lib/chart.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chart.ts src/lib/chart.test.ts
git commit -m "Añade helpers de escala y trazado para las gráficas"
```

---

### Task 6: Anillo de progreso

**Files:**
- Create: `src/components/charts/ProgressRing.tsx`

- [ ] **Step 1: Implementar el componente**

Crear `src/components/charts/ProgressRing.tsx`:

```tsx
type Props = {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
};

/** Anillo de progreso. Decorativo: la cifra siempre va escrita al lado. */
export function ProgressRing({ value, max, size = 66, stroke = 5 }: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max === 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--m-track)"
        strokeWidth={stroke}
      />
      {ratio > 0 ? (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--m-series)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(circumference * ratio).toFixed(2)} ${circumference.toFixed(2)}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      ) : null}
    </svg>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/ProgressRing.tsx
git commit -m "Añade el componente de anillo de progreso"
```

---

### Task 7: Gráfica de cumplimiento

**Files:**
- Create: `src/components/charts/ComplianceChart.tsx`

- [ ] **Step 1: Implementar el componente**

Crear `src/components/charts/ComplianceChart.tsx`:

```tsx
"use client";

import { useState } from "react";
import { areaPath, linePath, scaleLinear, segments, type Point } from "@/lib/chart";

export type ChartPoint = {
  date: string;
  /** Cumplimiento crudo del día, null si no tocaba nada. */
  rate: number | null;
  /** Media móvil de 7 días, null mientras no haya ningún dato. */
  mean: number | null;
  done: number;
  scheduled: number;
  shielded: number;
};

const W = 560;
const H = 190;
const PAD = { left: 32, right: 14, top: 12, bottom: 26 };

const FORMATTER = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

function label(iso: string): string {
  return FORMATTER.format(new Date(`${iso}T00:00:00Z`));
}

export function ComplianceChart({ points }: { points: ChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;

  const x = scaleLinear([0, Math.max(1, points.length - 1)], [PAD.left, W - PAD.right]);
  const y = scaleLinear([0, 1], [H - PAD.bottom, PAD.top]);

  const meanSegments = segments(points.map((p) => p.mean)).map((seg) =>
    seg.values.map((value, i): Point => ({ x: x(seg.start + i), y: y(value) })),
  );

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - box.left) / box.width;
    const index = Math.round(ratio * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, index)));
  }

  const active = hover === null ? null : points[hover];

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Cumplimiento diario de los últimos ${points.length} días con media móvil de 7 días.`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--m-line)"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(value) + 4} textAnchor="end" fontSize={10} fill="var(--m-ink-3)">
              {Math.round(value * 100)}
            </text>
          </g>
        ))}

        {meanSegments.map((seg, i) => (
          <path key={`area-${i}`} d={areaPath(seg, y(0))} fill="var(--m-series)" fillOpacity={0.1} />
        ))}
        {meanSegments.map((seg, i) => (
          <path
            key={`line-${i}`}
            d={linePath(seg)}
            fill="none"
            stroke="var(--m-series)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {points.map((p, i) =>
          p.rate === null ? null : p.shielded > 0 ? (
            <circle
              key={p.date}
              cx={x(i)}
              cy={y(p.rate)}
              r={3.5}
              fill="none"
              stroke="var(--m-warn)"
              strokeWidth={1.6}
            />
          ) : (
            <circle key={p.date} cx={x(i)} cy={y(p.rate)} r={2.5} fill="var(--m-series)" fillOpacity={0.45} />
          ),
        )}

        {hover !== null && active ? (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--m-ink-3)"
              strokeWidth={1}
            />
            {active.mean === null ? null : (
              <circle cx={x(hover)} cy={y(active.mean)} r={4} fill="var(--m-series)" stroke="var(--m-surface)" strokeWidth={2} />
            )}
          </g>
        ) : null}

        <text x={PAD.left} y={H - 6} fontSize={10} fill="var(--m-ink-3)">
          {label(points[0].date)}
        </text>
        <text x={W - PAD.right} y={H - 6} fontSize={10} fill="var(--m-ink-3)" textAnchor="end">
          hoy
        </text>
      </svg>

      {active ? (
        <div
          style={{
            position: "absolute",
            left: `${(hover! / Math.max(1, points.length - 1)) * 100}%`,
            top: 0,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            background: "var(--m-elevated)",
            border: "1px solid var(--m-line)",
            borderRadius: 7,
            padding: "7px 10px",
            fontSize: 11.5,
            lineHeight: 1.5,
            whiteSpace: "nowrap",
          }}
        >
          <strong style={{ fontSize: 12.5 }}>{label(active.date)}</strong>
          <br />
          {active.mean === null ? "Sin datos" : `Media 7d: ${Math.round(active.mean * 100)}%`}
          <br />
          <span style={{ color: "var(--m-ink-3)" }}>
            {active.scheduled === 0
              ? "No tocaba nada"
              : `Ese día: ${active.done} de ${active.scheduled}`}
            {active.shielded > 0 ? ` · ${active.shielded} con escudo` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/ComplianceChart.tsx
git commit -m "Añade la gráfica de cumplimiento con media móvil y tooltip"
```

---

### Task 8: Consulta y composición del payload

**Files:**
- Create: `src/lib/home.ts`

- [ ] **Step 1: Implementar**

Crear `src/lib/home.ts`:

```ts
import { prisma } from "./prisma";
import { addDays, dayKey, normalizeDayKey } from "./day";
import { isCriticalDay, isScheduledOn, sanitizeSchedule } from "./streak";
import {
  bestWeekday,
  complianceSeries,
  periodDelta,
  rollingMean,
  type DayCompliance,
  type HabitSpec,
  type PeriodDelta,
  type WeekdayRate,
} from "./metrics";

/** Días de historial que se cargan de una vez; el rango se recorta en cliente. */
export const HISTORY_DAYS = 365;
/** Cuatro semanas exactas: ambos periodos tienen los mismos días de la semana. */
export const COMPARISON_DAYS = 28;
export const MEAN_WINDOW = 7;

export type PendingHabit = {
  id: string;
  name: string;
  critical: boolean;
};

export type HomeMetrics = {
  today: {
    scheduled: number;
    done: number;
    pending: PendingHabit[];
  };
  series: DayCompliance[];
  mean: (number | null)[];
  delta: PeriodDelta | null;
  best: WeekdayRate | null;
};

export async function getHomeMetrics(): Promise<HomeMetrics> {
  const today = dayKey();
  const from = addDays(today, -(HISTORY_DAYS - 1));

  const [habits, logs] = await Promise.all([
    prisma.habit.findMany({
      select: { id: true, name: true, schedule: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.habitLog.findMany({
      where: { date: { gte: from } },
      select: { habitId: true, date: true, partial: true, shielded: true },
    }),
  ]);

  const entries = logs.map((l) => ({
    habitId: l.habitId,
    day: normalizeDayKey(l.date),
    partial: l.partial,
    shielded: l.shielded,
  }));

  // Un hábito cuenta desde su creación o desde su registro más antiguo, lo que
  // sea anterior: rellenar hacia atrás no debe dejar días fuera del denominador.
  const firstLog = new Map<string, number>();
  for (const entry of entries) {
    const previous = firstLog.get(entry.habitId);
    const t = entry.day.getTime();
    if (previous === undefined || t < previous) firstLog.set(entry.habitId, t);
  }

  const specs: HabitSpec[] = habits.map((h) => {
    const created = dayKey(h.createdAt).getTime();
    const earliest = firstLog.get(h.id);
    return {
      id: h.id,
      schedule: sanitizeSchedule(h.schedule),
      since: new Date(earliest === undefined ? created : Math.min(created, earliest)),
    };
  });

  const series = complianceSeries(specs, entries, from, today);
  const mean = rollingMean(series.map((d) => d.rate), MEAN_WINDOW);

  // Días cumplidos por hábito, para reutilizar la regla de los 2 días ya
  // probada en lib/streak en vez de reimplementar "ayer".
  const keysByHabit = new Map<string, Set<number>>();
  for (const entry of entries) {
    let set = keysByHabit.get(entry.habitId);
    if (!set) {
      set = new Set();
      keysByHabit.set(entry.habitId, set);
    }
    set.add(entry.day.getTime());
  }

  const doneToday = new Set(
    entries
      .filter((e) => e.day.getTime() === today.getTime() && !e.shielded)
      .map((e) => e.habitId),
  );
  const scheduledToday = habits.filter((h) => isScheduledOn(h.schedule, today));

  return {
    today: {
      scheduled: scheduledToday.length,
      done: scheduledToday.filter((h) => doneToday.has(h.id)).length,
      pending: scheduledToday
        .filter((h) => !doneToday.has(h.id))
        .map((h) => {
          const keys = keysByHabit.get(h.id) ?? new Set<number>();
          return {
            id: h.id,
            name: h.name,
            critical: isCriticalDay(h.schedule, keys, today, keys.size > 0),
          };
        }),
    },
    series,
    mean,
    delta: periodDelta(series, COMPARISON_DAYS),
    best: bestWeekday(series.slice(-COMPARISON_DAYS * 3)),
  };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/home.ts
git commit -m "Añade la consulta y composición de métricas de Inicio"
```

---

### Task 9: Bloque «Hoy»

**Files:**
- Create: `src/components/home/TodayCard.tsx`

- [ ] **Step 1: Implementar**

Crear `src/components/home/TodayCard.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { toggleToday } from "@/app/actions";
import { emitToggleResult } from "@/lib/events";
import { ProgressRing } from "@/components/charts/ProgressRing";
import type { PendingHabit } from "@/lib/home";

type Props = {
  done: number;
  scheduled: number;
  pending: PendingHabit[];
};

export function TodayCard({ done, scheduled, pending }: Props) {
  const [busy, startTransition] = useTransition();
  const critical = pending.filter((h) => h.critical);

  function mark(id: string) {
    startTransition(async () => {
      emitToggleResult(await toggleToday(id, false));
    });
  }

  return (
    <div className="m-card" style={{ opacity: busy ? 0.7 : 1 }}>
      <div className="m-label" style={{ marginBottom: 14 }}>
        Hoy
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ProgressRing value={done} max={scheduled} />
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span className="m-num" style={{ fontSize: 44, fontWeight: 650, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {done}
            </span>
            <span className="m-num" style={{ fontSize: 20, color: "var(--m-ink-3)", fontWeight: 500 }}>
              /{scheduled}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--m-ink-2)", marginTop: 6 }}>
            {scheduled === 0 ? "hoy no toca ningún hábito" : "hábitos de hoy"}
          </div>
        </div>
      </div>

      {pending.length > 0 ? (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--m-line)" }}>
          <div style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginBottom: 9 }}>
            {pending.length === 1 ? "Falta 1 antes de medianoche" : `Faltan ${pending.length} antes de medianoche`}
          </div>
          {pending.map((habit) => (
            <button
              key={habit.id}
              type="button"
              onClick={() => mark(habit.id)}
              disabled={busy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--m-elevated)",
                border: "1px solid var(--m-line)",
                borderRadius: 999,
                padding: "5px 11px 5px 8px",
                fontSize: 12.5,
                color: "var(--m-ink)",
                margin: "0 6px 6px 0",
                cursor: busy ? "default" : "pointer",
                font: "inherit",
              }}
              aria-label={`Marcar ${habit.name} como hecho`}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: habit.critical ? "var(--m-crit)" : "var(--m-series)",
                }}
              />
              {habit.name}
            </button>
          ))}
          {critical.length > 0 ? (
            <div style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, color: "var(--m-crit)", marginTop: 4 }}>
              <span aria-hidden="true">▲</span>
              <span>
                {critical.length === 1
                  ? `${critical[0].name} viene de fallar ayer`
                  : `${critical.length} hábitos vienen de fallar ayer`}
              </span>
            </div>
          ) : null}
        </div>
      ) : scheduled > 0 ? (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--m-line)", fontSize: 12.5, color: "var(--m-good)" }}>
          Día completo.
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/TodayCard.tsx
git commit -m "Añade el bloque de estado de hoy con chips accionables"
```

---

### Task 10: Bloque «Cumplimiento»

**Files:**
- Create: `src/components/home/TrendCard.tsx`

- [ ] **Step 1: Implementar**

Crear `src/components/home/TrendCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ComplianceChart, type ChartPoint } from "@/components/charts/ComplianceChart";
import type { PeriodDelta } from "@/lib/metrics";

const RANGES = [
  { key: "28d", label: "28d", days: 28 },
  { key: "90d", label: "90d", days: 90 },
  { key: "12m", label: "12m", days: 365 },
] as const;

type Props = {
  points: ChartPoint[];
  delta: PeriodDelta | null;
};

export function TrendCard({ points, delta }: Props) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("28d");
  const days = RANGES.find((r) => r.key === range)!.days;
  const visible = points.slice(-days);

  const up = (delta?.deltaPoints ?? 0) >= 0;

  return (
    <div className="m-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="m-label" style={{ marginBottom: 9 }}>
            Cumplimiento
          </div>
          {delta === null ? (
            <div style={{ fontSize: 13, color: "var(--m-ink-2)" }}>
              Aún no hay datos suficientes.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <span className="m-num" style={{ fontSize: 30, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {Math.round(delta.current * 100)}%
                </span>
                {delta.deltaPoints === null ? null : (
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 550,
                      color: up ? "var(--m-good)" : "var(--m-crit)",
                    }}
                  >
                    {up ? "▲" : "▼"} {Math.abs(delta.deltaPoints)} pts
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--m-ink-3)", marginTop: 5 }}>
                {delta.previous === null
                  ? "sin periodo anterior con el que comparar"
                  : `frente a ${Math.round(delta.previous * 100)}% en los 28 días anteriores`}
              </div>
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 2,
            background: "var(--m-elevated)",
            border: "1px solid var(--m-line)",
            borderRadius: 7,
            padding: 2,
          }}
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              style={{
                font: "inherit",
                fontSize: 11.5,
                color: range === r.key ? "var(--m-ink)" : "var(--m-ink-2)",
                background: range === r.key ? "rgba(255,255,255,0.09)" : "none",
                border: 0,
                padding: "4px 10px",
                borderRadius: 5,
                cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <ComplianceChart points={visible} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos y lint**

Run: `npx tsc --noEmit && npx eslint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/TrendCard.tsx
git commit -m "Añade el bloque de tendencia con selector de rango"
```

---

### Task 11: Fila de métricas secundarias

**Files:**
- Create: `src/components/home/MetricTiles.tsx`

- [ ] **Step 1: Implementar**

Crear `src/components/home/MetricTiles.tsx`:

```tsx
import { weekdayName } from "@/lib/stats";
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

function Tile({ k, v, m }: { k: string; v: string; m: string }) {
  return (
    <div className="m-card" style={{ padding: "13px 14px" }}>
      <div className="m-label">{k}</div>
      <div className="m-num" style={{ fontSize: 21, fontWeight: 600, marginTop: 6, letterSpacing: "-0.02em" }}>
        {v}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--m-ink-2)", marginTop: 3 }}>{m}</div>
    </div>
  );
}

export function MetricTiles(p: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 10,
      }}
    >
      <Tile
        k="Racha activa"
        v={p.streak ? `${p.streak.days} días` : "—"}
        m={p.streak ? p.streak.habitName : "sin rachas abiertas"}
      />
      <Tile
        k="Mejor día"
        v={p.best ? weekdayName(p.best.weekday) : "—"}
        m={p.best ? `${Math.round(p.best.rate * 100)}% de cumplimiento` : "aún sin datos"}
      />
      <Tile k="Nivel" v={String(p.level)} m={`${p.xp} XP · ${p.xpToNext} para el ${p.level + 1}`} />
      <Tile k="Escudos" v={`${p.shields} / ${p.maxShields}`} m="disponibles" />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/MetricTiles.tsx
git commit -m "Añade la fila de métricas secundarias de Inicio"
```

---

### Task 12: Misiones con lenguaje neutro

**Files:**
- Modify: `src/lib/quests.ts`
- Create: `src/components/home/QuestList.tsx`

- [ ] **Step 1: Cambiar los textos**

En `src/lib/quests.ts`, sustituir los `label` y `description` de `QUEST_DEFS` por estos, dejando `emoji`, `target` y `xpReward` intactos (el panel antiguo de `/habits` sigue usando el emoji hasta que se migre):

```ts
  QUEST_3_HABITS: {
    kind: "QUEST_3_HABITS",
    label: "Tres hábitos",
    description: "Completa 3 hábitos hoy",
    emoji: "🎯",
    target: 3,
    xpReward: 50,
  },
  QUEST_EARLY: {
    kind: "QUEST_EARLY",
    label: "Antes de las 10",
    description: "Marca 1 hábito antes de las 10:00",
    emoji: "🌅",
    target: 1,
    xpReward: 30,
  },
  QUEST_TASK: {
    kind: "QUEST_TASK",
    label: "Dos tareas",
    description: "Completa 2 tareas",
    emoji: "📝",
    target: 2,
    xpReward: 40,
  },
  QUEST_TREE: {
    kind: "QUEST_TREE",
    label: "Una subtarea",
    description: "Completa 1 subtarea de proyecto",
    emoji: "🌳",
    target: 1,
    xpReward: 30,
  },
  QUEST_PERFECT: {
    kind: "QUEST_PERFECT",
    label: "Día completo",
    description: "Cumple todos tus hábitos de hoy",
    emoji: "🏆",
    target: 1,
    xpReward: 100,
  },
```

- [ ] **Step 2: Crear la lista compacta**

Crear `src/components/home/QuestList.tsx`:

```tsx
import { QUEST_DEFS, type DailyQuestRow } from "@/lib/quests";

export function QuestList({ quests }: { quests: DailyQuestRow[] }) {
  if (quests.length === 0) return null;
  const done = quests.filter((q) => q.completed).length;

  return (
    <div className="m-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span className="m-label">Objetivos del día</span>
        <span className="m-num" style={{ fontSize: 12, color: "var(--m-ink-3)" }}>
          {done}/{quests.length}
        </span>
      </div>

      {quests.map((q) => {
        const def = QUEST_DEFS[q.kind];
        const ratio = q.completed ? 1 : Math.min(1, q.progress / q.target);
        return (
          <div key={q.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
              <span style={{ color: q.completed ? "var(--m-ink-3)" : "var(--m-ink)" }}>
                {def.description}
              </span>
              <span className="m-num" style={{ color: "var(--m-ink-3)" }}>
                {q.completed ? `+${q.xpReward} XP` : `${q.progress}/${q.target}`}
              </span>
            </div>
            <div style={{ height: 4, background: "var(--m-track)", borderRadius: 2 }}>
              <div
                style={{
                  height: "100%",
                  width: `${ratio * 100}%`,
                  background: q.completed ? "var(--m-good)" : "var(--m-series)",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos y tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores, 63 tests en verde (35 previos + 19 de métricas + 9 de trazado).

- [ ] **Step 4: Commit**

```bash
git add src/lib/quests.ts src/components/home/QuestList.tsx
git commit -m "Reformula las misiones con lenguaje neutro y añade su lista compacta"
```

---

### Task 13: Montar la pantalla de Inicio

**Files:**
- Modify: `src/app/page.tsx` (reescritura completa)

- [ ] **Step 1: Reescribir la página**

Sustituir todo el contenido de `src/app/page.tsx`:

```tsx
import Link from "next/link";
import { getHomeMetrics } from "@/lib/home";
import { getHabitsWithTodayStatus, getPlayerLevelInfo } from "@/lib/habits";
import { getTodayQuests } from "@/lib/quests";
import { MAX_SHIELDS } from "@/lib/level";
import { TodayCard } from "@/components/home/TodayCard";
import { TrendCard } from "@/components/home/TrendCard";
import { MetricTiles } from "@/components/home/MetricTiles";
import { QuestList } from "@/components/home/QuestList";
import type { ChartPoint } from "@/components/charts/ComplianceChart";

export const dynamic = "force-dynamic";

const DATE_FORMAT = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default async function Home() {
  const [metrics, habits, player, quests] = await Promise.all([
    getHomeMetrics(),
    getHabitsWithTodayStatus(),
    getPlayerLevelInfo(),
    getTodayQuests(),
  ]);

  const points: ChartPoint[] = metrics.series.map((day, i) => ({
    date: day.date,
    rate: day.rate,
    mean: metrics.mean[i],
    done: day.done,
    scheduled: day.scheduled,
    shielded: day.shielded,
  }));

  const longest = habits.reduce(
    (best, h) => (h.streak > (best?.streak ?? 0) ? h : best),
    null as (typeof habits)[number] | null,
  );

  const today = DATE_FORMAT.format(new Date());

  return (
    <main className="m-root" style={{ minHeight: "100%", padding: "20px 16px 48px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Untap</span>
          <span style={{ fontSize: 13, color: "var(--m-ink-3)", textTransform: "capitalize" }}>{today}</span>
        </div>

        {habits.length === 0 ? (
          <div className="m-card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 16, marginBottom: 6 }}>Aún no tienes hábitos.</p>
            <p style={{ fontSize: 13, color: "var(--m-ink-2)", marginBottom: 20 }}>
              Crea el primero y esta pantalla empezará a medirte.
            </p>
            <Link
              href="/habits"
              style={{
                display: "inline-block",
                background: "var(--m-series)",
                color: "#fff",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13.5,
                fontWeight: 550,
              }}
            >
              Crear un hábito
            </Link>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 14,
                alignItems: "start",
              }}
            >
              <TodayCard
                done={metrics.today.done}
                scheduled={metrics.today.scheduled}
                pending={metrics.today.pending}
              />
              <div style={{ gridColumn: "span 1", minWidth: 0 }}>
                <TrendCard points={points} delta={metrics.delta} />
              </div>
            </div>

            <MetricTiles
              streak={longest && longest.streak > 0 ? { days: longest.streak, habitName: longest.name } : null}
              best={metrics.best}
              level={player.level}
              xp={player.xp}
              xpToNext={player.xpForNextLevel - player.xpIntoLevel}
              shields={player.shields}
              maxShields={MAX_SHIELDS}
            />

            <QuestList quests={quests} />
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Comprobar que compila y pasa lint**

Run: `npx tsc --noEmit && npx eslint && npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "Reconstruye Inicio como panel moderno"
```

---

### Task 14: Validar color y verificar en navegador

**Files:**
- Modify: `src/app/globals.css` (solo si el validador falla)

- [ ] **Step 1: Validar la paleta**

Run desde el directorio base de la skill `dataviz`:

```bash
node scripts/validate_palette.js "#3987e5,#0ca30c,#fab219,#d03b3b" --mode dark --surface "#17171d"
```

Expected: sin FAIL. Si alguna comprobación falla, ajustar el token correspondiente en `globals.css` al paso más cercano que pase y volver a ejecutar.

- [ ] **Step 2: Arrancar la app**

Usar `preview_start` con la configuración `untap-dev` de `.claude/launch.json`.

- [ ] **Step 3: Verificar con datos reales**

Crear dos hábitos, marcar uno y rellenar unos días hacia atrás desde el calendario. Comprobar en `/`:

- El anillo y la cifra `hecho/programado` coinciden con la realidad.
- Un chip pendiente marca el hábito sin recargar y la cifra sube.
- La línea tiene hueco (no cae a cero) en un día en que no tocaba nada.
- El tooltip muestra el desglose al pasar el ratón.
- Cambiar de 28d a 90d y 12m no pide datos al servidor.

- [ ] **Step 4: Revisar consola y logs**

Usar `read_console_messages` y `preview_logs`.
Expected: sin errores.

- [ ] **Step 5: Captura de pantalla**

Usar `computer` con `screenshot` y **mirarla**: comprobar que no hay solapes de etiquetas ni desbordes horizontales.

- [ ] **Step 6: Commit final**

```bash
git add -A
git commit -m "Ajusta la paleta tras validar contraste y daltonismo"
```

---

## Verificación final

```bash
npm test && npx tsc --noEmit && npx eslint && npm run build
```

Expected: 63 tests en verde, sin errores de tipos, lint limpio y build correcto.
