# Hábitos · el diagnóstico — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a Hábitos los tres diagnósticos que la fase 1 aplazó: qué hábito falla, qué día de la semana se cae, y cuál lleva más tiempo sin tocarse.

**Architecture:** Casi todo el cálculo ya existe. El ranking sale de llamar a `complianceSeries` con un solo hábito; los días sin tocar, de `daysSince`. Lo único nuevo es `weekdayRates`, del que pasa a derivarse el `bestWeekday` que ya usa Inicio.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript estricto, Prisma 7 sobre SQLite, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-27-habitos-design.md` — segunda mitad.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/metrics.ts` (modificar) | Añade `weekdayRates` y `worstWeekday`; `bestWeekday` pasa a derivarse |
| `src/lib/metrics.test.ts` (modificar) | Sus tests |
| `src/lib/habits.ts` (modificar) | Añade `getHabitDiagnosis()` |
| `src/components/habits/DiagnosisPanel.tsx` (nuevo) | Los tres bloques |
| `src/app/habits/page.tsx` (modificar) | Monta el panel |

---

### Task 1: weekdayRates

**Files:**
- Modify: `src/lib/metrics.ts`
- Test: `src/lib/metrics.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Ampliar el import existente de `./metrics` en `src/lib/metrics.test.ts` para incluir `weekdayRates` y `worstWeekday`, y añadir al final del archivo:

```ts
describe("weekdayRates", () => {
  it("devuelve siete posiciones, de domingo a sábado", () => {
    // 2026-07-26 es domingo y 2026-07-27 lunes.
    const rates = weekdayRates([day("2026-07-26", 0.4), day("2026-07-27", 0.8)]);
    expect(rates).toHaveLength(7);
    expect(rates[0]).toBeCloseTo(0.4, 6);
    expect(rates[1]).toBeCloseTo(0.8, 6);
  });

  it("promedia las repeticiones del mismo día de la semana", () => {
    // Ambos lunes.
    const rates = weekdayRates([day("2026-07-20", 0.4), day("2026-07-27", 1)]);
    expect(rates[1]).toBeCloseTo(0.7, 6);
  });

  it("un día de la semana sin datos vale null, no cero", () => {
    const rates = weekdayRates([day("2026-07-27", 1)]);
    expect(rates[1]).toBeCloseTo(1, 6);
    expect(rates[2]).toBeNull();
  });

  it("los días sin nada programado no cuentan", () => {
    const rates = weekdayRates([day("2026-07-27", null)]);
    expect(rates[1]).toBeNull();
  });
});

describe("worstWeekday", () => {
  it("elige el día de la semana con peor tasa", () => {
    // 2026-07-20 lunes, 21 martes, 22 miércoles
    const days = [
      day("2026-07-20", 0.9),
      day("2026-07-21", 0.2),
      day("2026-07-22", 0.6),
    ];
    expect(worstWeekday(days)).toEqual({ weekday: 2, rate: 0.2 });
  });

  it("devuelve null sin datos", () => {
    expect(worstWeekday([day("2026-07-20", null)])).toBeNull();
  });

  it("mejor y peor salen de la misma serie y no se contradicen", () => {
    const days = [
      day("2026-07-20", 0.9),
      day("2026-07-21", 0.2),
      day("2026-07-22", 0.6),
    ];
    const best = bestWeekday(days)!;
    const worst = worstWeekday(days)!;
    expect(best.rate).toBeGreaterThanOrEqual(worst.rate);
    expect(best.weekday).not.toBe(worst.weekday);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npx vitest run src/lib/metrics.test.ts`
Expected: FAIL — `weekdayRates` y `worstWeekday` no existen.

- [ ] **Step 3: Implementar**

En `src/lib/metrics.ts`, **sustituir** la función `bestWeekday` actual por este bloque:

```ts
/**
 * Cumplimiento medio de cada día de la semana, indexado 0=domingo..6=sábado.
 * Un día de la semana sin ningún dato vale `null`, no cero: nunca haber medido
 * un jueves no es lo mismo que haber fallado todos los jueves.
 */
export function weekdayRates(days: DayCompliance[]): (number | null)[] {
  const sums = new Array(7).fill(0);
  const counts = new Array(7).fill(0);

  for (const d of days) {
    if (d.rate === null) continue;
    const weekday = new Date(`${d.date}T00:00:00Z`).getUTCDay();
    sums[weekday] += d.rate;
    counts[weekday] += 1;
  }

  return sums.map((sum, weekday) =>
    counts[weekday] === 0 ? null : sum / counts[weekday],
  );
}

export type WeekdayRate = { weekday: number; rate: number };

function pickWeekday(
  days: DayCompliance[],
  better: (candidate: number, current: number) => boolean,
): WeekdayRate | null {
  const rates = weekdayRates(days);
  // Bucle normal y no `forEach`: TypeScript no sigue las asignaciones hechas
  // dentro de un callback, y el estrechamiento de `picked` se rompe.
  let picked: WeekdayRate | null = null;
  for (let weekday = 0; weekday < 7; weekday++) {
    const rate = rates[weekday];
    if (rate === null) continue;
    if (picked === null || better(rate, picked.rate)) picked = { weekday, rate };
  }
  return picked;
}

/** Día de la semana con mejor tasa media de cumplimiento. */
export function bestWeekday(days: DayCompliance[]): WeekdayRate | null {
  return pickWeekday(days, (candidate, current) => candidate > current);
}

/**
 * Día de la semana con peor tasa. Sale de la misma función que el mejor: si
 * cada uno recorriera los días por su cuenta, podrían llegar a contradecirse.
 */
export function worstWeekday(days: DayCompliance[]): WeekdayRate | null {
  return pickWeekday(days, (candidate, current) => candidate < current);
}
```

El tipo `WeekdayRate` ya existía; asegúrate de que no queda declarado dos veces.

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `npx vitest run`
Expected: PASS, 101 tests (94 previos + 7 nuevos). Los tests que ya existían de `bestWeekday` deben seguir en verde sin tocarlos: si alguno falla, el refactor cambió el comportamiento y hay que arreglarlo, no ajustar el test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics.ts src/lib/metrics.test.ts
git commit -m "Añade weekdayRates y deriva de ella el mejor y el peor día"
```

---

### Task 2: Consulta del diagnóstico

**Files:**
- Modify: `src/lib/habits.ts`

- [ ] **Step 1: Añadir la consulta**

`src/lib/habits.ts` ya importa `prisma`, y de `./day` importa `addDays`, `dayKey`, `isoFromDayKey`, `MS_PER_DAY` y `normalizeDayKey`. Ampliar sus imports con lo que falte:

```ts
import { daysSince } from "./flow";
import {
  averageRate,
  buildHabitSpecs,
  complianceSeries,
  weekdayRates,
  worstWeekday,
  type LogEntry,
} from "./metrics";
```

Y añadir al final del archivo:

```ts
/** Ventana del diagnóstico: cuatro semanas exactas. */
export const DIAGNOSIS_DAYS = 28;

export type HabitRanking = {
  id: string;
  name: string;
  icon: string;
  /** Cumplimiento sobre los días que le tocaban a él. `null` si no tocó ninguno. */
  rate: number | null;
  /** Días que le tocaban dentro de la ventana. */
  scheduled: number;
};

export type HabitUntouched = {
  id: string;
  name: string;
  days: number;
  /** Si nunca se ha cumplido, se cuenta desde que se creó y se dice. */
  from: "completion" | "creation";
};

export type HabitDiagnosis = {
  ranking: HabitRanking[];
  /** Siete posiciones, 0=domingo. `null` donde no hay datos. */
  weekdays: (number | null)[];
  worst: { weekday: number; rate: number } | null;
  untouched: HabitUntouched[];
};

export async function getHabitDiagnosis(): Promise<HabitDiagnosis> {
  const today = dayKey();
  const from = addDays(today, -(DIAGNOSIS_DAYS - 1));

  const [habits, logs] = await Promise.all([
    prisma.habit.findMany({
      select: { id: true, name: true, icon: true, schedule: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.habitLog.findMany({
      where: { date: { gte: from } },
      select: { habitId: true, date: true, partial: true, shielded: true },
    }),
  ]);

  const entries: LogEntry[] = logs.map((l) => ({
    habitId: l.habitId,
    day: normalizeDayKey(l.date),
    partial: l.partial,
    shielded: l.shielded,
  }));

  const specs = buildHabitSpecs(
    habits.map((h) => ({
      id: h.id,
      schedule: h.schedule,
      createdKey: dayKey(h.createdAt),
    })),
    entries,
  );

  // El ranking mide cada hábito sobre SUS días: uno de lunes y viernes con 7 de
  // 8 está al 88%, no al 25%. Por eso se llama a complianceSeries con un solo
  // hábito en vez de repartir el agregado.
  const ranking: HabitRanking[] = habits.map((habit) => {
    const spec = specs.find((s) => s.id === habit.id)!;
    const series = complianceSeries(
      [spec],
      entries.filter((e) => e.habitId === habit.id),
      from,
      today,
    );
    return {
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      rate: averageRate(series),
      scheduled: series.filter((d) => d.scheduled > 0).length,
    };
  });

  // Del peor al mejor. Los que no tuvieron ningún día programado van al final:
  // no se les puede reprochar nada.
  ranking.sort((a, b) => {
    if (a.rate === null) return b.rate === null ? 0 : 1;
    if (b.rate === null) return -1;
    return a.rate - b.rate;
  });

  const overall = complianceSeries(specs, entries, from, today);

  const lastByHabit = new Map<string, number>();
  for (const entry of entries) {
    if (entry.shielded) continue;
    const t = entry.day.getTime();
    const previous = lastByHabit.get(entry.habitId);
    if (previous === undefined || t > previous) lastByHabit.set(entry.habitId, t);
  }

  const untouched: HabitUntouched[] = habits
    .map((habit) => {
      const last = lastByHabit.get(habit.id);
      return last === undefined
        ? {
            id: habit.id,
            name: habit.name,
            days: daysSince(habit.createdAt, today),
            from: "creation" as const,
          }
        : {
            id: habit.id,
            name: habit.name,
            days: daysSince(new Date(last), today),
            from: "completion" as const,
          };
    })
    .sort((a, b) => b.days - a.days);

  return {
    ranking,
    weekdays: weekdayRates(overall),
    worst: worstWeekday(overall),
    untouched,
  };
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npx eslint && npx vitest run`
Expected: sin errores, 101 tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/habits.ts
git commit -m "Añade la consulta del diagnóstico de hábitos"
```

---

### Task 3: El panel

**Files:**
- Create: `src/components/habits/DiagnosisPanel.tsx`
- Modify: `src/app/habits/page.tsx`

- [ ] **Step 1: Crear el panel**

Crear `src/components/habits/DiagnosisPanel.tsx`:

```tsx
import { Card } from "@/components/ui/Card";
import { weekdayName } from "@/lib/stats";
import type { HabitDiagnosis } from "@/lib/habits";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function DiagnosisPanel({ diagnosis }: { diagnosis: HabitDiagnosis }) {
  const { ranking, weekdays, worst, untouched } = diagnosis;
  const conDatos = ranking.filter((h) => h.rate !== null);
  const masAbandonado = untouched[0];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 12,
        alignItems: "start",
      }}
    >
      <Card title="Qué se te está cayendo">
        {conDatos.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>
            Aún no hay días medidos en las últimas cuatro semanas.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {conDatos.map((habit) => (
              <div key={habit.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12.5,
                    marginBottom: 5,
                  }}
                >
                  <span style={{ color: "var(--m-ink)" }}>
                    {habit.icon} {habit.name}
                  </span>
                  <span className="m-num" style={{ color: "var(--m-ink-2)" }}>
                    {pct(habit.rate)}
                  </span>
                </div>
                <div style={{ height: 5, background: "var(--m-track)", borderRadius: 3 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.round((habit.rate ?? 0) * 100)}%`,
                      background:
                        (habit.rate ?? 0) < 0.5 ? "var(--m-crit)" : "var(--m-series)",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "var(--m-ink-3)", marginTop: 2 }}>
              Cada uno sobre los días que le tocaban, en las últimas cuatro semanas.
            </p>
          </div>
        )}
      </Card>

      <Card title="Qué día se te cae">
        {worst === null ? (
          <p style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>
            Aún no hay historial suficiente.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
              {WEEKDAY_ORDER.map((weekday) => {
                const rate = weekdays[weekday];
                const esPeor = weekday === worst.weekday;
                return (
                  <div key={weekday} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      title={`${weekdayName(weekday)}: ${pct(rate)}`}
                      style={{
                        height: 54,
                        display: "flex",
                        alignItems: "flex-end",
                        marginBottom: 5,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: rate === null ? 0 : `${Math.max(3, rate * 100)}%`,
                          background: esPeor ? "var(--m-crit)" : "rgba(57,135,229,0.55)",
                          borderRadius: "3px 3px 0 0",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: esPeor ? "var(--m-crit)" : "var(--m-ink-3)",
                      }}
                    >
                      {weekdayName(weekday)}
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>
              Tu peor día es el <strong>{weekdayName(worst.weekday).toLowerCase()}</strong>,
              con un {pct(worst.rate)} de cumplimiento.
            </p>
          </>
        )}
      </Card>

      <Card title="Lo que llevas más sin tocar">
        {masAbandonado === undefined ? (
          <p style={{ fontSize: 12.5, color: "var(--m-ink-2)" }}>Sin hábitos.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {untouched.map((habit, i) => (
              <div
                key={habit.id}
                style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}
              >
                <span style={{ color: i === 0 ? "var(--m-ink)" : "var(--m-ink-2)" }}>
                  {habit.name}
                </span>
                <span
                  className="m-num"
                  style={{ color: i === 0 ? "var(--m-warn)" : "var(--m-ink-3)" }}
                >
                  {habit.from === "creation"
                    ? "sin cumplir"
                    : habit.days === 0
                      ? "hoy"
                      : habit.days === 1
                        ? "1 día"
                        : `${habit.days} días`}
                </span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "var(--m-ink-3)", marginTop: 2 }}>
              No es la racha: uno de lunes y viernes puede tenerla viva y llevar cinco
              días sin tocarse.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Montarlo en la pantalla**

En `src/app/habits/page.tsx`:

Añadir el import de la consulta y del panel:

```tsx
import { getHabitsWithTodayStatus, getPlayerLevelInfo, getHabitDiagnosis } from "@/lib/habits";
```

```tsx
import { DiagnosisPanel } from "@/components/habits/DiagnosisPanel";
```

Añadir la consulta al `Promise.all`:

```tsx
  const [habits, player, quests, diagnosis] = await Promise.all([
    getHabitsWithTodayStatus(),
    getPlayerLevelInfo(),
    getTodayQuests(),
    getHabitDiagnosis(),
  ]);
```

Y añadir el panel **después** del bloque de la lista de hábitos, dentro del
fragmento del `else`, justo antes de su `</>`:

```tsx
            <DiagnosisPanel diagnosis={diagnosis} />
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint && npx vitest run && npm run build`
Expected: sin errores, 101 tests, build correcto.

- [ ] **Step 4: Commit**

```bash
git add src/components/habits/DiagnosisPanel.tsx src/app/habits/page.tsx
git commit -m "Añade el panel de diagnóstico a Hábitos"
```

---

### Task 4: Verificación en navegador

**Files:** ninguno, salvo que aparezcan fallos.

- [ ] **Step 1: Arrancar**

Usar `preview_start` con la configuración `untap-dev`.

- [ ] **Step 2: Con un hábito diario**

En `/habits`, con al menos un hábito y algún día cumplido:

- «Qué se te está cayendo» muestra el hábito con su porcentaje y una barra.
- «Qué día se te cae» muestra siete barras y una frase nombrando el peor día.
- «Lo que llevas más sin tocar» muestra el hábito con sus días o «hoy».

- [ ] **Step 3: Con un hábito que no toca todos los días**

Crear un segundo hábito con solo dos días de la semana activos y **no cumplirlo**.
Comprobar que en el ranking aparece con un porcentaje calculado **sobre sus
días**, no sobre 28. Con dos días programados y ninguno cumplido debe salir 0%,
no un número diminuto.

- [ ] **Step 4: Con un hábito recién creado y sin cumplir**

El bloque de «lo que llevas más sin tocar» debe decir **«sin cumplir»** para él,
no un número de días desde su último cumplimiento inexistente.

- [ ] **Step 5: Anchos, consola y servidor**

Con `resize_window` a 400 y a 1280: sin desbordamiento horizontal y los tres
bloques en una columna en estrecho. Revisar `read_console_messages` y
`preview_logs`: sin errores.

- [ ] **Step 6: Commit de lo que haya salido**

```bash
git add -A
git commit -m "Corrige lo detectado al verificar el diagnóstico en navegador"
```

Si no ha salido nada, omitir el commit y decirlo en el informe.

---

## Verificación final

```bash
npm test && npx tsc --noEmit && npx eslint && npm run build
```

Expected: 101 tests en verde, sin errores de tipos, lint limpio y build correcto.
