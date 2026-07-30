# Notas del día y racha global · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una nota por hábito y día, y una racha de días seguidos cumpliendo todo lo programado.

**Architecture:** Las notas viven en su propia tabla, no como columna del registro del día. La racha global es una función pura que reusa `buildHabitSpecs` para saber desde cuándo cuenta cada hábito.

**Tech Stack:** Next 16.2.12 · Drizzle sobre SQLite · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-29-notas-y-racha-global-design.md`

---

## Antes de empezar: lee esto

**Las notas NO son una columna de `habit_logs`.** Si lo fueran, escribir una nota
en un día que no cumpliste obligaría a crear el registro de ese día — o sea, **a
marcar el hábito como hecho para poder decir que no lo hiciste**. Y ese es justo
el día en que más quieres escribir algo. Tabla aparte.

**La racha global tiene que respetar desde cuándo cuenta cada hábito.** Sin eso
sale **cero para siempre** en cuanto añades un hábito: los días anteriores a su
creación aparecen como días en que no lo cumpliste. `buildHabitSpecs` ya devuelve
ese `since`; úsalo y no inventes otro.

**`streak.ts` no se toca, ni sus tests.** Van dos bloques seguidos respetándolo.

**Ninguna migración.** Solo se añade una tabla, y para eso basta
`CREATE TABLE IF NOT EXISTS`. Si te ves tocando `migrar.ts`, te has salido.

**Y no escribas acentos graves en los comentarios de `schema-sql.ts`.** Es una
plantilla literal. Ha pasado dos veces.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/modules/habitos/lib/racha-global.ts` | **Nuevo.** `rachaGlobal`, pura |
| `src/modules/habitos/lib/racha-global.test.ts` | **Nuevo.** |
| `src/modules/core/db/schema-sql.ts` | `habit_notes` |
| `src/modules/habitos/schema.ts` | Lo mismo en Drizzle |
| `src/modules/habitos/lib/notas.ts` | **Nuevo.** Leer, guardar y borrar |
| `src/modules/habitos/lib/notas.test.ts` | **Nuevo.** |
| `src/modules/habitos/lib/home.ts` | Devuelve `globalStreak` |
| `src/modules/habitos/components/home/MetricTiles.tsx` | La pinta |
| `src/modules/habitos/components/habits/HabitRow.tsx` | La nota de hoy |

---

### Tarea 1: La racha global, pura

**Files:**
- Create: `src/modules/habitos/lib/racha-global.ts`
- Create: `src/modules/habitos/lib/racha-global.test.ts`

- [x] **Paso 1: Escribir el test**

`src/modules/habitos/lib/racha-global.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rachaGlobal, type EspecieDia } from "./racha-global";

const DIA = 86_400_000;
/** Días absolutos: el 0 es jueves 1970-01-01, así que 4 = lunes. */
const d = (n: number) => new Date(n * DIA);

const TODOS = "1111111";
/** Solo lunes. El 4 es lunes, y de siete en siete. */
const LUNES = "0100000";

function spec(id: string, schedule = TODOS, desde = 0): EspecieDia {
  return { id, schedule, since: d(desde) };
}

/** `hechos` es día absoluto -> ids cumplidos del todo ese día. */
function hechos(m: Record<number, string[]>): Map<number, Set<string>> {
  return new Map(
    Object.entries(m).map(([n, ids]) => [d(Number(n)).getTime(), new Set(ids)]),
  );
}

describe("rachaGlobal", () => {
  it("sin hábitos es cero", () => {
    expect(rachaGlobal([], hechos({}), d(10))).toBe(0);
  });

  it("cuenta los días seguidos con todo hecho", () => {
    const r = rachaGlobal(
      [spec("a"), spec("b")],
      hechos({ 10: ["a", "b"], 9: ["a", "b"], 8: ["a", "b"] }),
      d(10),
    );
    expect(r).toBe(3);
  });

  it("un día al que le falta un hábito corta", () => {
    const r = rachaGlobal(
      [spec("a"), spec("b")],
      hechos({ 10: ["a", "b"], 9: ["a"], 8: ["a", "b"] }),
      d(10),
    );
    expect(r).toBe(1);
  });

  /*
    Hoy sin cumplir no rompe la racha de ayer: aún queda día. Es la misma regla
    que `computeStreak` aplica a un hábito, y tenerla distinta aquí sería una
    sorpresa.
  */
  it("hoy a medio hacer no borra lo de ayer", () => {
    const r = rachaGlobal(
      [spec("a")],
      hechos({ 9: ["a"], 8: ["a"] }),
      d(10),
    );
    expect(r).toBe(2);
  });

  /*
    Los días sin nada programado se saltan: no suman y no rompen. Otra vez, lo
    mismo que hace la racha de un hábito con su calendario.
  */
  it("los días sin nada programado se saltan", () => {
    // Solo lunes: el 4 y el 11 son lunes; del 5 al 10 no toca nada.
    const r = rachaGlobal(
      [spec("a", LUNES)],
      hechos({ 11: ["a"], 4: ["a"] }),
      d(11),
    );
    expect(r).toBe(2);
  });

  /*
    EL CASO QUE HARÍA INÚTIL LA CIFRA. Sin respetar `since`, un hábito creado
    ayer haría que todos los días anteriores contaran como incumplidos y la
    racha global sería cero para siempre.
  */
  it("un hábito no cuenta antes de existir", () => {
    const r = rachaGlobal(
      [spec("viejo", TODOS, 0), spec("nuevo", TODOS, 10)],
      hechos({ 10: ["viejo", "nuevo"], 9: ["viejo"], 8: ["viejo"] }),
      d(10),
    );
    expect(r).toBe(3);
  });

  it("un día con hábitos vigentes pero ninguno cumplido corta", () => {
    const r = rachaGlobal(
      [spec("a")],
      hechos({ 10: ["a"], 8: ["a"] }),
      d(10),
    );
    expect(r).toBe(1);
  });

  it("no mira más atrás del tope", () => {
    const todos: Record<number, string[]> = {};
    for (let i = 0; i <= 500; i++) todos[i] = ["a"];
    const r = rachaGlobal([spec("a")], hechos(todos), d(500), 30);
    expect(r).toBe(30);
  });
});
```

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
cd "/c/PROYECTO JUAMPI"
npx vitest run src/modules/habitos/lib/racha-global.test.ts
```

- [x] **Paso 3: Escribirlo**

`src/modules/habitos/lib/racha-global.ts`:

```ts
import { addDays } from "./day";
import { isScheduledOn } from "./streak";

/**
 * Lo que la racha global necesita saber de un hábito. Coincide a propósito con
 * `HabitSpec` de `metrics.ts`, que es de donde sale: así la racha global cuadra
 * con las gráficas de cumplimiento en vez de llevar su propia cuenta.
 */
export type EspecieDia = {
  id: string;
  schedule: string;
  /** Primer día en que el hábito cuenta: su creación o su registro más antiguo. */
  since: Date;
};

/** Cuántos días como mucho se miran hacia atrás. */
export const TOPE_DIAS = 400;

/**
 * Días seguidos cumpliendo TODO lo programado.
 *
 * Misma definición que la misión «día completo» que ya existe, para no inventar
 * un segundo criterio de lo mismo: solo cuentan los hábitos cumplidos del todo,
 * y `hechosPorDia` solo debe traer los no parciales.
 *
 * Es pura y con tope: recorrer hacia atrás sin límite sería una consulta que
 * crece sola con los años.
 */
export function rachaGlobal(
  specs: EspecieDia[],
  hechosPorDia: Map<number, Set<string>>,
  hoy: Date,
  tope: number = TOPE_DIAS,
): number {
  if (specs.length === 0) return 0;

  let cursor = hoy;
  // Si hoy aún no está completo, se empieza por ayer: queda día para hacerlo, y
  // es la misma cortesía que `computeStreak` tiene con un hábito.
  if (!diaCompleto(specs, hechosPorDia, hoy)) cursor = addDays(hoy, -1);

  let racha = 0;
  for (let i = 0; i < tope; i++) {
    const vigentes = specsVigentes(specs, cursor);
    // Día sin nada programado: no suma y no rompe.
    if (vigentes.length > 0) {
      if (todosHechos(vigentes, hechosPorDia, cursor)) racha += 1;
      else break;
    }
    cursor = addDays(cursor, -1);
  }
  return racha;
}

/** Los hábitos que ese día ya existían y estaban programados. */
function specsVigentes(specs: EspecieDia[], dia: Date): EspecieDia[] {
  return specs.filter(
    (s) => s.since.getTime() <= dia.getTime() && isScheduledOn(s.schedule, dia),
  );
}

function todosHechos(
  vigentes: EspecieDia[],
  hechosPorDia: Map<number, Set<string>>,
  dia: Date,
): boolean {
  const hechos = hechosPorDia.get(dia.getTime());
  if (!hechos) return false;
  return vigentes.every((s) => hechos.has(s.id));
}

/** ¿Ese día estaba todo hecho? Un día sin nada programado NO cuenta como completo. */
function diaCompleto(
  specs: EspecieDia[],
  hechosPorDia: Map<number, Set<string>>,
  dia: Date,
): boolean {
  const vigentes = specsVigentes(specs, dia);
  if (vigentes.length === 0) return false;
  return todosHechos(vigentes, hechosPorDia, dia);
}
```

- [x] **Paso 4: Verificar**

```bash
npx vitest run src/modules/habitos/lib/racha-global.test.ts && npx tsc --noEmit
```

- [x] **Paso 5: Commit**

```bash
git add src/modules/habitos/lib/racha-global.ts src/modules/habitos/lib/racha-global.test.ts
git commit -m "feat(habitos): la racha global, pura y con tope"
```

---

### Tarea 2: La tabla de notas y su acceso

**Files:**
- Modify: `src/modules/core/db/schema-sql.ts`
- Modify: `src/modules/habitos/schema.ts`
- Create: `src/modules/habitos/lib/notas.ts`
- Create: `src/modules/habitos/lib/notas.test.ts`

- [ ] **Paso 1: El esquema**

En `schema-sql.ts`, tras `habit_logs` y sus índices:

```sql
CREATE TABLE IF NOT EXISTS habit_notes (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       INTEGER NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
-- Una nota por habito y dia. Mismo patron que habit_logs, del que depende el
-- calculo de rachas.
CREATE UNIQUE INDEX IF NOT EXISTS habit_notes_habit_date_unq
  ON habit_notes(habit_id, date);
```

En `schema.ts`:

```ts
/**
 * Notas por hábito y día.
 *
 * Tabla aparte y NO una columna de `habit_logs` a propósito: si fuera una
 * columna, escribir una nota en un día que no cumpliste obligaría a crear el
 * registro de ese día, o sea a marcar el hábito como hecho para poder decir que
 * no lo hiciste. Y ese es justo el día en que más quieres escribir algo.
 */
export const habitNotes = sqliteTable(
  "habit_notes",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    text: text("text").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    unqHabitDate: uniqueIndex("habit_notes_habit_date_unq").on(t.habitId, t.date),
  }),
);

export type HabitNoteRow = typeof habitNotes.$inferSelect;
```

- [ ] **Paso 2: El test**

`src/modules/habitos/lib/notas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs } from "@/modules/habitos/schema";
import { getNota, notasDeHabito, setNota } from "./notas";

const T0 = new Date(1700000000000);
const DIA1 = new Date(Date.UTC(2026, 6, 1));
const DIA2 = new Date(Date.UTC(2026, 6, 2));

async function conHabito() {
  const db = createTestDb();
  await db.insert(habits).values({
    id: "h1",
    name: "Leer",
    schedule: "1111111",
    createdAt: T0,
  });
  return db;
}

describe("setNota", () => {
  it("guarda y devuelve la nota", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "Hoy me costó");
    expect(await getNota(db, "h1", DIA1)).toBe("Hoy me costó");
  });

  it("volver a guardar el mismo día actualiza, no duplica", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "primera");
    await setNota(db, "h1", DIA1, "segunda");
    expect(await getNota(db, "h1", DIA1)).toBe("segunda");
    expect(await notasDeHabito(db, "h1")).toHaveLength(1);
  });

  /*
    Vacío BORRA. Así el estado «sin nota» es uno solo y no dos —fila ausente o
    fila con cadena vacía—, que es la clase de duplicidad que después se olvida
    en un `if`.
  */
  it("guardar vacío borra la fila", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "algo");
    await setNota(db, "h1", DIA1, "   ");
    expect(await getNota(db, "h1", DIA1)).toBeNull();
    expect(await notasDeHabito(db, "h1")).toHaveLength(0);
  });

  it("borrar una que no existe no revienta", async () => {
    const db = await conHabito();
    await expect(setNota(db, "h1", DIA1, "")).resolves.not.toThrow();
  });

  /*
    ESTE ES EL MOTIVO DE QUE LAS NOTAS SEAN UNA TABLA APARTE. Se puede escribir
    una nota en un día sin registro, sin que eso marque el hábito.
  */
  it("se puede anotar un día sin marcar el hábito", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "Hoy no pude, estaba enfermo");
    expect(await db.select().from(habitLogs)).toHaveLength(0);
    expect(await getNota(db, "h1", DIA1)).toBe("Hoy no pude, estaba enfermo");
  });

  it("normaliza al día, así que dos horas del mismo día son la misma nota", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "una");
    await setNota(db, "h1", new Date(DIA1.getTime() + 3_600_000), "otra");
    expect(await notasDeHabito(db, "h1")).toHaveLength(1);
    expect(await getNota(db, "h1", DIA1)).toBe("otra");
  });
});

describe("notasDeHabito", () => {
  it("las devuelve por día", async () => {
    const db = await conHabito();
    await setNota(db, "h1", DIA1, "una");
    await setNota(db, "h1", DIA2, "dos");
    const todas = await notasDeHabito(db, "h1");
    expect(todas).toHaveLength(2);
    expect(todas.map((n) => n.text)).toContain("dos");
  });

  it("de un hábito sin notas devuelve vacío", async () => {
    expect(await notasDeHabito(await conHabito(), "h1")).toEqual([]);
  });
});
```

- [ ] **Paso 3: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/habitos/lib/notas.test.ts
```

- [ ] **Paso 4: Escribirlo**

`src/modules/habitos/lib/notas.ts`:

```ts
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { habitNotes } from "@/modules/habitos/schema";
import { normalizeDayKey } from "./day";

export const LIMITE_NOTA = 500;

export type Nota = { date: Date; text: string };

export async function getNota(
  db: Db,
  habitId: string,
  date: Date,
): Promise<string | null> {
  const dia = normalizeDayKey(date);
  const [fila] = await db
    .select({ text: habitNotes.text })
    .from(habitNotes)
    .where(and(eq(habitNotes.habitId, habitId), eq(habitNotes.date, dia)))
    .limit(1);
  return fila?.text ?? null;
}

export async function notasDeHabito(db: Db, habitId: string): Promise<Nota[]> {
  const filas = await db
    .select({ date: habitNotes.date, text: habitNotes.text })
    .from(habitNotes)
    .where(eq(habitNotes.habitId, habitId))
    .orderBy(asc(habitNotes.date));
  return filas.map((f) => ({ date: f.date, text: f.text }));
}

/**
 * Guarda la nota de un día. **Vacío borra.**
 *
 * Que vacío borre deja un solo estado para «sin nota», en vez de dos —fila
 * ausente o fila con cadena vacía—, que es la clase de duplicidad que después se
 * olvida en un `if` y pinta un punto de nota donde no hay nada.
 */
export async function setNota(
  db: Db,
  habitId: string,
  date: Date,
  text: string,
): Promise<void> {
  if (!habitId) return;
  const dia = normalizeDayKey(date);
  const limpio = text.trim().slice(0, LIMITE_NOTA);
  const donde = and(eq(habitNotes.habitId, habitId), eq(habitNotes.date, dia));

  if (!limpio) {
    await db.delete(habitNotes).where(donde);
    return;
  }

  const ahora = new Date();
  const [existente] = await db
    .select({ id: habitNotes.id })
    .from(habitNotes)
    .where(donde)
    .limit(1);

  if (existente) {
    await db
      .update(habitNotes)
      .set({ text: limpio, updatedAt: ahora })
      .where(eq(habitNotes.id, existente.id));
    return;
  }

  await db.insert(habitNotes).values({
    id: crypto.randomUUID(),
    habitId,
    date: dia,
    text: limpio,
    createdAt: ahora,
    updatedAt: ahora,
  });
}
```

- [ ] **Paso 5: El server action**

En `actions.ts`:

```ts
export async function guardarNota(habitId: string, iso: string, text: string) {
  const dia = dayKeyFromISO(iso);
  if (!dia) return;
  await n.setNota(db, habitId, dia, text);
  refresh();
}
```

Con `import * as n from "./lib/notas";` y `dayKeyFromISO` de `./lib/day`.

> Se pasa la fecha como `"YYYY-MM-DD"` y no como `Date`: es lo que ya hace el
> resto de acciones que reciben días desde el navegador, y `dayKeyFromISO`
> rechaza lo que no sea una fecha válida.

Y en `index.ts`:

```ts
export { getNota, notasDeHabito, LIMITE_NOTA, type Nota } from "./lib/notas";
```

- [ ] **Paso 6: Verificar**

```bash
npx vitest run && npx tsc --noEmit && npm run lint
```

`schema-parity.test.ts` compara el DDL con Drizzle: si el recuento de tablas
falla, revisa que no hayas escrito las dos palabras de la sentencia de creación
dentro de un comentario del DDL.

- [ ] **Paso 7: Commit**

```bash
git add -A src
git commit -m "feat(habitos): notas por habito y dia, en su propia tabla"
```

---

### Tarea 3: La racha global en la portada

**Files:**
- Modify: `src/modules/habitos/lib/home.ts`
- Modify: `src/modules/habitos/components/home/MetricTiles.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Paso 1: `home.ts` la calcula**

`HomeMetrics` gana el campo:

```ts
  /** Días seguidos cumpliendo TODO lo programado. */
  globalStreak: number;
```

Y en el cuerpo, después de `specs` —que ya existe y sale de `buildHabitSpecs`—:

```ts
  /*
    Solo los NO parciales: un día a medias no es un día completo, y es la misma
    definición que usa la misión «día completo». `specs` trae el `since` de cada
    hábito, así que un hábito recién creado no arrastra la racha a cero.
  */
  const plenosPorDia = new Map<number, Set<string>>();
  for (const entry of entries) {
    if (entry.partial) continue;
    const t = entry.day.getTime();
    const set = plenosPorDia.get(t);
    if (set) set.add(entry.habitId);
    else plenosPorDia.set(t, new Set([entry.habitId]));
  }
  const globalStreak = rachaGlobal(specs, plenosPorDia, today);
```

Con `import { rachaGlobal } from "./racha-global";` y `globalStreak` en el objeto
que devuelve.

> `specs` es `HabitSpec[]`, que tiene la misma forma que `EspecieDia`. Si
> TypeScript se queja, es que una de las dos ha cambiado: alinéalas en vez de
> hacer un `as`.

- [ ] **Paso 2: La pinta**

En `MetricTiles.tsx`, las props ganan `globalStreak: number` y se añade una
baldosa junto a la racha activa:

```tsx
      <Stat
        label="Sin fallar"
        value={p.globalStreak > 0 ? formatDays(p.globalStreak) : "—"}
        meta={
          p.globalStreak > 0
            ? "días seguidos cumpliendo todo"
            : "cumple todo hoy y empieza"
        }
      />
```

> **El rótulo importa.** La racha global va a salir «—» a menudo: basta que falte
> un hábito hoy. El `meta` es lo que diferencia «es exigente» de «está roto».

En `src/app/page.tsx`, pásale `globalStreak={metrics.globalStreak}`.

- [ ] **Paso 3: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 4: Commit**

```bash
git add -A src
git commit -m "feat(habitos): la racha global en la portada"
```

---

### Tarea 4: La nota de hoy en la fila

**Files:**
- Modify: `src/modules/habitos/lib/habits.ts`
- Modify: `src/modules/habitos/components/habits/HabitRow.tsx`
- Modify: `src/app/habitos/page.tsx`

- [ ] **Paso 1: Traerla**

`getHabitsWithTodayStatus` ya consulta los registros; añade una consulta a
`habitNotes` del día de hoy y mete `notaHoy: string | null` en
`HabitWithStatus`:

```ts
  const notasHoy = ids.length
    ? await db
        .select({ habitId: habitNotes.habitId, text: habitNotes.text })
        .from(habitNotes)
        .where(and(inArray(habitNotes.habitId, ids), eq(habitNotes.date, today)))
    : [];
  const notaPorHabito = new Map(notasHoy.map((n) => [n.habitId, n.text]));
```

Y en el objeto devuelto, `notaHoy: notaPorHabito.get(h.id) ?? null`.

- [ ] **Paso 2: El campo**

En `HabitRow.tsx`, las props ganan `notaHoy: string | null`, y bajo la fila:

```tsx
      {/*
        Se guarda al SALIR del campo, como el título de la tarea: escribir una
        nota no debería pedir un botón, y un guardado por tecla mandaría una
        petición por letra.
      */}
      <textarea
        defaultValue={p.notaHoy ?? ""}
        rows={1}
        maxLength={500}
        placeholder="Nota de hoy…"
        onBlur={(e) => {
          const v = e.target.value;
          if (v.trim() === (p.notaHoy ?? "")) return;
          startTransition(() => guardarNota(p.id, hoyISO, v));
        }}
        aria-label={`Nota de hoy para ${p.name}`}
        className="w-full mt-2 bg-paper-2 text-tinta font-cuerpo text-[12.5px] border-3 border-line rounded-control px-2 py-1 placeholder:text-tinta-2 outline-none focus:outline-3 focus:outline-offset-2 focus:outline-line resize-y"
      />
```

`hoyISO` sale de una prop nueva, `hoyISO: string`, que la página calcula con la
clave del día. **No lo calcules en el cliente**: la fecha del navegador puede
diferir de la del servidor y la nota acabaría en otro día.

- [ ] **Paso 3: La página la pasa**

En `src/app/habitos/page.tsx`, `notaHoy={habit.notaHoy}` y
`hoyISO={dayKey().toISOString().slice(0, 10)}`.

`dayKey` **no está exportada** de `src/modules/habitos/index.ts` ni importada en
esa página: comprobado. Añádela al `index.ts` —es una función pura de calendario
y la página la necesita— en vez de reimplementar el cálculo del día allí:

```ts
export { dayKey } from "./lib/day";
```

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 5: Commit**

```bash
git add -A src
git commit -m "feat(habitos): la nota de hoy en la fila del habito"
```

---

### Tarea 5: Verificación final

- [ ] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [ ] **Paso 2: `streak.ts` intacto**

```bash
git diff main --stat -- '*streak*'
```

Esperado: **nada**.

- [ ] **Paso 3: La base real**

```bash
node -e "
const D=require('better-sqlite3');const d=new D('data/juampi.db',{readonly:true});
console.log('habit_notes existe:', d.prepare(\"select count(*) c from sqlite_master where type='table' and name='habit_notes'\").get());
console.log('notas:', d.prepare('select count(*) c from habit_notes').get());
"
```

- [ ] **Paso 4: En pantalla**

1. Escribe una nota en un hábito **sin marcarlo** y comprueba que sigue sin marcar.
2. Recarga: la nota está.
3. Vacíala: desaparece la fila (`select count(*)` vuelve a 0).
4. Marca todos los hábitos de hoy y comprueba que «Sin fallar» pasa a 1 día.
5. Desmarca uno: vuelve a «—».

> El paso 4 y el 5 mueven tu XP y tus misiones del día. Si no quieres tocarlos,
> basta comprobar 1 a 3 y fiarse de los tests de la racha global, que cubren los
> casos con más detalle que una prueba a mano.

- [ ] **Paso 5: Marcar el plan y el spec**

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. Se puede escribir, editar y borrar la nota de un hábito en un día
- [ ] 3. Se puede escribir una nota en un día **sin** marcar el hábito
- [ ] 4. Guardar una nota vacía borra la fila
- [ ] 5. La racha global cuenta solo días con **todo** lo programado hecho
- [ ] 6. Un día a medias no cuenta como día completo
- [ ] 7. Los días sin nada programado no suman ni rompen
- [ ] 8. Un hábito no cuenta antes de existir
- [ ] 9. `streak.ts` y sus tests siguen intactos
