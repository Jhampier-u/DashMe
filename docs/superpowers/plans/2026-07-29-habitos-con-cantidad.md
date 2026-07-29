# Hábitos con cantidad · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un hábito pueda tener un objetivo numérico y que el día se apunte con una cantidad, sin cambiar el comportamiento de ningún hábito que ya exista.

**Architecture:** Una función pura, `diasQueCuentan`, decide qué días cuentan para la racha. Los cinco sitios que hoy construyen ese conjunto por su cuenta pasan por ella. `computeStreak` no se toca.

**Tech Stack:** Next 16.2.12 · Drizzle sobre SQLite · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-29-habitos-con-cantidad-design.md`

---

## Antes de empezar: lee esto

**`streak.ts` NO se toca, ni sus tests.** `computeStreak` recibe un conjunto de
días hechos y no sabe nada de cantidades. Si te ves editándola, has cogido el
camino equivocado: lo que cambia es quién construye ese conjunto.

**Son CINCO sitios los que lo construyen**, y ese es el fallo probable de este
bloque. Si a uno se le olvida el filtro, la misma racha sale distinta en la
portada y en el detalle, y sin dar error. La Tarea 3 los enumera; la Tarea 6
comprueba que no queda ninguno suelto.

**Un hábito sin objetivo tiene que comportarse EXACTAMENTE como hoy.** Es el
criterio nº 3 y el que protege los datos que ya hay. `targetCount` nulo significa
«no se cuenta», y por ese camino no debe cambiar ni una cuenta.

**Aquí SÍ hace falta `migrar.ts`**, al contrario que en los adjuntos: son columnas
nuevas en tablas que ya existen.

**Y no escribas acentos graves en los comentarios de `schema-sql.ts`.** Es una
plantilla literal y cualquiera de ellos la cierra a media cadena. Ha pasado dos
veces en este proyecto.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/modules/habitos/lib/cantidad.ts` | **Nuevo.** `diasQueCuentan` y los umbrales, puro |
| `src/modules/habitos/lib/cantidad.test.ts` | **Nuevo.** |
| `src/modules/core/db/migrar.ts` | Las dos columnas nuevas |
| `src/modules/core/db/schema-sql.ts` | Lo mismo para bases nuevas |
| `src/modules/habitos/schema.ts` | Lo mismo en Drizzle |
| `src/modules/habitos/lib/habits.ts` | Pasa por `diasQueCuentan` |
| `src/modules/habitos/lib/home.ts` | Idem |
| `src/modules/habitos/lib/stats.ts` | Idem |
| `src/modules/habitos/lib/mutations.ts` | Idem, más `setHabitCount` |
| `src/modules/habitos/components/habits/HabitRow.tsx` | El contador y el aviso |
| `src/modules/habitos/components/habits/NewHabitForm.tsx` | El campo de objetivo |

---

### Tarea 1: La regla, en un solo sitio

**Files:**
- Create: `src/modules/habitos/lib/cantidad.ts`
- Create: `src/modules/habitos/lib/cantidad.test.ts`

- [x] **Paso 1: Escribir el test**

`src/modules/habitos/lib/cantidad.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { diasQueCuentan, esCompleto, type LogParaRacha } from "./cantidad";

const DIA = 86_400_000;
const d = (n: number) => new Date(n * DIA);

function log(n: number, extra: Partial<LogParaRacha> = {}): LogParaRacha {
  return { date: d(n), partial: false, count: null, ...extra };
}

describe("esCompleto", () => {
  it("sin objetivo, lo manda el botón", () => {
    expect(esCompleto(null, null, false)).toBe(true);
    expect(esCompleto(null, null, true)).toBe(false);
  });

  it("con objetivo, lo manda la cantidad", () => {
    expect(esCompleto(8, 8, false)).toBe(true);
    expect(esCompleto(8, 9, false)).toBe(true);
    expect(esCompleto(8, 7, false)).toBe(false);
    expect(esCompleto(8, 0, false)).toBe(false);
  });

  /*
    Con objetivo, la cantidad manda SOBRE el botón: si no, apuntar 3 de 8 y
    pulsar «hecho» daría un día completo con tres vasos.
  */
  it("con objetivo, el botón no puede saltarse la cantidad", () => {
    expect(esCompleto(8, 3, false)).toBe(false);
  });

  it("con objetivo pero sin cantidad apuntada, vale el botón", () => {
    expect(esCompleto(8, null, false)).toBe(true);
    expect(esCompleto(8, null, true)).toBe(false);
  });
});

describe("diasQueCuentan sin objetivo", () => {
  /*
    Esta es la garantía de que ningún hábito existente cambia: sin objetivo,
    TODO registro cuenta, igual que hoy, incluidos los de modo mínimo.
  */
  it("cuenta todos los registros, también los de modo mínimo", () => {
    const set = diasQueCuentan([log(1), log(2, { partial: true })], null);
    expect(set.size).toBe(2);
    expect(set.has(d(2).getTime())).toBe(true);
  });
});

describe("diasQueCuentan con objetivo", () => {
  it("cuenta el día que llega al objetivo", () => {
    const set = diasQueCuentan([log(1, { count: 8 })], 8);
    expect(set.has(d(1).getTime())).toBe(true);
  });

  it("no cuenta el día que se queda corto", () => {
    const set = diasQueCuentan([log(1, { count: 7, partial: true })], 8);
    expect(set.size).toBe(0);
  });

  it("pasarse del objetivo también cuenta", () => {
    expect(diasQueCuentan([log(1, { count: 12 })], 8).size).toBe(1);
  });

  /*
    Los registros de antes de este bloque tienen `count` nulo: nunca se apuntó
    una cantidad. Se interpretan por su `partial`, que es la única información
    que hay. Inventarles una cantidad sería peor.
  */
  it("los registros viejos se leen por su partial", () => {
    const set = diasQueCuentan(
      [log(1), log(2, { partial: true })],
      8,
    );
    expect(set.has(d(1).getTime())).toBe(true);
    expect(set.has(d(2).getTime())).toBe(false);
  });

  it("normaliza al día, así que dos horas del mismo día son un día", () => {
    const set = diasQueCuentan(
      [
        { date: new Date(d(5).getTime() + 3600_000), partial: false, count: 8 },
      ],
      8,
    );
    expect(set.size).toBe(1);
  });

  it("con la lista vacía devuelve un conjunto vacío", () => {
    expect(diasQueCuentan([], 8).size).toBe(0);
  });
});
```

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
cd "/c/PROYECTO JUAMPI"
npx vitest run src/modules/habitos/lib/cantidad.test.ts
```

Esperado: **FAIL**, `Cannot find module './cantidad'`.

- [x] **Paso 3: Escribirlo**

`src/modules/habitos/lib/cantidad.ts`:

```ts
import { normalizeDayKey } from "./day";

/*
  La regla de qué día cuenta para la racha, en UN solo sitio.

  Existe por una razón concreta y no por gusto: cinco lugares del módulo
  construían ese conjunto de días por su cuenta —`habits.ts`, `home.ts`,
  `stats.ts` y dos veces `mutations.ts`—. Con la cantidad, cinco copias de la
  regla serían cinco oportunidades de que una se quede atrás, y el síntoma sería
  la misma racha saliendo distinta en la portada y en el detalle, sin dar error.
*/

/** Lo mínimo que hace falta saber de un registro para decidir si cuenta. */
export type LogParaRacha = {
  date: Date;
  partial: boolean;
  /** Lo apuntado ese día. Nulo en todo lo registrado antes de este bloque. */
  count: number | null;
};

/**
 * ¿Ese día está completo?
 *
 * Sin objetivo lo manda el botón, como siempre. CON objetivo lo manda la
 * cantidad y el botón no puede saltarse: si no, apuntar 3 de 8 vasos y pulsar
 * «hecho» daría un día completo con tres vasos.
 *
 * Con objetivo pero sin cantidad apuntada —los registros viejos— solo queda el
 * botón, que es la única información que existe.
 */
export function esCompleto(
  targetCount: number | null,
  count: number | null,
  partial: boolean,
): boolean {
  if (targetCount === null) return !partial;
  if (count === null) return !partial;
  return count >= targetCount;
}

/**
 * Los días que cuentan para la racha, ya normalizados al día.
 *
 * SIN objetivo cuenta todo registro, incluidos los de modo mínimo: es
 * exactamente el comportamiento de hoy, y de eso depende que ningún hábito
 * existente cambie.
 */
export function diasQueCuentan(
  logs: LogParaRacha[],
  targetCount: number | null,
): Set<number> {
  const set = new Set<number>();
  for (const l of logs) {
    if (targetCount === null || esCompleto(targetCount, l.count, l.partial)) {
      set.add(normalizeDayKey(l.date).getTime());
    }
  }
  return set;
}
```

- [x] **Paso 4: Verificar**

```bash
npx vitest run src/modules/habitos/lib/cantidad.test.ts && npx tsc --noEmit
```

Esperado: **PASS**, 11 afirmaciones.

- [x] **Paso 5: Commit**

```bash
git add src/modules/habitos/lib/cantidad.ts src/modules/habitos/lib/cantidad.test.ts
git commit -m "feat(habitos): la regla de que dia cuenta, en un solo sitio"
```

---

### Tarea 2: Las dos columnas

**Files:**
- Modify: `src/modules/core/db/migrar.ts`
- Modify: `src/modules/core/db/migrar.test.ts`
- Modify: `src/modules/core/db/schema-sql.ts`
- Modify: `src/modules/habitos/schema.ts`

- [x] **Paso 1: El test de la migración**

En `src/modules/core/db/migrar.test.ts`, dentro del bloque de la base vieja:

```ts
  it("añade también las columnas de cantidad", () => {
    const s = baseVieja();
    ponerAlDia(s);
    expect(columnas(s, "habits")).toContain("target_count");
    expect(columnas(s, "habit_logs")).toContain("count");
    s.close();
  });
```

> `baseVieja()` no crea `habits` ni `habit_logs`. Añádelas a `ESQUEMA_VIEJO` con
> su forma actual —sin las columnas nuevas—, o el test pasará por vacío. Cópialas
> del `SCHEMA_SQL` de hoy quitando `target_count` y `count`.

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/core/db/migrar.test.ts
```

- [x] **Paso 3: La migración**

`migrar.ts` hoy solo sabe añadir columnas a `tasks`. Generalízalo:

```ts
/**
 * Las columnas que cada tabla fue ganando después de su creación.
 *
 * Van SIN clave foránea y anulables a propósito: SQLite no admite `ADD COLUMN`
 * con referencia ni con NOT NULL sin valor por defecto.
 */
const COLUMNAS_NUEVAS: Record<string, [string, string][]> = {
  tasks: [
    ["parent_id", "TEXT"],
    ["project_id", "TEXT"],
    ["category_id", "TEXT"],
    ["priority", "TEXT"],
  ],
  habits: [["target_count", "INTEGER"]],
  habit_logs: [["count", "INTEGER"]],
};
```

Y el bucle de `ponerAlDia`:

```ts
export function ponerAlDia(sqlite: Sqlite): void {
  for (const [tabla, columnas] of Object.entries(COLUMNAS_NUEVAS)) {
    const tiene = columnasDe(sqlite, tabla);
    // `pragma table_info` de una tabla que no existe devuelve vacío: si la
    // tabla no está, no hay nada que poner al día.
    if (tiene.size === 0) continue;
    for (const [nombre, tipo] of columnas) {
      if (!tiene.has(nombre)) {
        sqlite.exec(`ALTER TABLE ${tabla} ADD COLUMN ${nombre} ${tipo}`);
      }
    }
  }
  for (const sql of INDICES_NUEVOS) sqlite.exec(sql);
  if (existeTabla(sqlite, "project_items")) absorberProjectItems(sqlite);
}
```

- [x] **Paso 4: El DDL y Drizzle**

En `schema-sql.ts`, dentro de `habits`, tras `intention`:

```sql
  target_count INTEGER,
```

Y dentro de `habit_logs`, tras `xp_awarded`:

```sql
  count        INTEGER,
```

En `schema.ts`:

```ts
  /** Objetivo numérico del día. Nulo = este hábito no se cuenta. */
  targetCount: integer("target_count"),
```

```ts
  /** Lo apuntado ese día. Nulo = no se apuntó cantidad. */
  count: integer("count"),
```

- [x] **Paso 5: Verificar**

```bash
npx vitest run && npx tsc --noEmit && npm run lint
```

`schema-parity.test.ts` compara el DDL con Drizzle: si falla, es que una de las
dos columnas está solo en un lado.

- [x] **Paso 6: Poner al día la base real**

```bash
npx vite-node --version >/dev/null 2>&1 || echo "vite-node se instalará al usarlo"
```

La migración corre sola al arrancar el servidor. Después:

```bash
node -e "
const D=require('better-sqlite3');const d=new D('data/juampi.db',{readonly:true});
for (const t of ['habits','habit_logs']) {
  console.log(t, d.prepare('pragma table_info('+t+')').all().map(c=>c.name).join(', '));
}
"
```

Esperado: `target_count` en `habits` y `count` en `habit_logs`.

- [x] **Paso 7: Commit**

```bash
git add -A src
git commit -m "feat(habitos): las columnas de cantidad, con su migracion"
```

---

### Tarea 3: Los cinco sitios

> **Nota de la ejecución:** eran CINCO usos pero **CUATRO conjuntos**. En
> `habits.ts` y en `home.ts`, el mismo conjunto alimenta a `computeStreak` y a
> `isCriticalDay`, así que se arregla una vez y sirve para los dos. Y `habits.ts`
> y `stats.ts` ya usaban `.select()` sin proyección, así que `count` y
> `targetCount` estaban disponibles sin tocar la consulta: solo hubo que
> extenderlas en `home.ts` y en `mutations.ts`.

**Files:**
- Modify: `src/modules/habitos/lib/habits.ts`
- Modify: `src/modules/habitos/lib/home.ts`
- Modify: `src/modules/habitos/lib/stats.ts`
- Modify: `src/modules/habitos/lib/mutations.ts`

- [x] **Paso 1: `habits.ts`**

La consulta de registros tiene que traer `count`, y el conjunto sale de la
función:

```ts
    const doneKeys = diasQueCuentan(
      hLogs.map((l) => ({
        date: l.date,
        partial: !!l.partial,
        count: l.count,
      })),
      h.targetCount,
    );
```

Y el objeto que devuelve gana lo que la fila necesita:

```ts
      targetCount: h.targetCount,
      countToday: todayLog?.count ?? null,
```

Añádelos también al tipo `HabitWithStatus`.

- [x] **Paso 2: `home.ts`**

`keysByHabit` se construye a partir de `entries`. Esas entradas necesitan
`count`, y el objetivo del hábito:

```ts
  const objetivoPorHabito = new Map(habits.map((h) => [h.id, h.targetCount]));

  const logsPorHabito = new Map<string, LogParaRacha[]>();
  for (const entry of entries) {
    const lista = logsPorHabito.get(entry.habitId);
    const l = { date: entry.day, partial: entry.partial, count: entry.count };
    if (lista) lista.push(l);
    else logsPorHabito.set(entry.habitId, [l]);
  }

  const keysByHabit = new Map<string, Set<number>>();
  for (const [id, logs] of logsPorHabito) {
    keysByHabit.set(id, diasQueCuentan(logs, objetivoPorHabito.get(id) ?? null));
  }
```

`entries` sale del `map` sobre `logs` que hay unas líneas arriba. Su proyección
selecciona `habitId`, `date`, `partial` y `shielded`: **añade `count`** a la
consulta y al `map`. Y en el `select` de `habitsTable` de la misma función, añade
`targetCount`.

```ts
      .select({
        habitId: habitLogs.habitId,
        date: habitLogs.date,
        partial: habitLogs.partial,
        shielded: habitLogs.shielded,
        count: habitLogs.count,
      })
```

```ts
  const entries = logs.map((l) => ({
    habitId: l.habitId,
    day: normalizeDayKey(l.date),
    partial: l.partial,
    shielded: l.shielded,
    count: l.count,
  }));
```

> `buildHabitSpecs` y `complianceSeries` también reciben `entries`. Añadir un
> campo no les afecta, pero comprueba que sus tipos no lo prohíban.

- [x] **Paso 3: `stats.ts`**

```ts
  const doneKeys = diasQueCuentan(
    logs.map((l) => ({ date: l.date, partial: !!l.partial, count: l.count })),
    targetCount,
  );
```

`targetCount` sale del hábito que esta función ya consulta; si no lo consulta,
añádelo al `select`.

- [x] **Paso 4: `mutations.ts`**

La función privada que recalcula la racha tras marcar selecciona **solo `date`**.
Necesita las otras dos columnas y el objetivo del hábito, que hay que pasarle:

```ts
  const logs = await db
    .select({
      date: habitLogs.date,
      partial: habitLogs.partial,
      count: habitLogs.count,
    })
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.habitId, habitId),
        gte(habitLogs.date, addDays(today, -400)),
      ),
    );
  const keys = diasQueCuentan(
    logs.map((l) => ({ date: l.date, partial: !!l.partial, count: l.count })),
    targetCount,
  );
  return computeStreak(schedule, keys, today);
```

`targetCount` entra como parámetro nuevo de esa función. **Sigue la cadena hasta
quien la llama** y pásale `habit.targetCount`, que ya está a mano ahí.

- [x] **Paso 5: Verificar que no queda ninguno suelto**

```bash
grep -rn "computeStreak(" src/modules/habitos/lib/*.ts | grep -v streak
```

Cada línea que salga tiene que recibir un conjunto que venga de
`diasQueCuentan`. **Compruébalas una por una**: es el fallo probable de este
bloque.

```bash
npx vitest run && npx tsc --noEmit && npm run lint
```

`streak.test.ts` no debe necesitar ni un cambio.

- [x] **Paso 6: Commit**

```bash
git add -A src
git commit -m "refactor(habitos): los cinco calculos de racha pasan por la misma regla"
```

---

### Tarea 4: Apuntar la cantidad

**Files:**
- Modify: `src/modules/habitos/lib/mutations.ts`
- Modify: `src/modules/habitos/lib/mutations.test.ts`
- Modify: `src/modules/habitos/actions.ts`

- [x] **Paso 1: Los tests**

Añade a `mutations.test.ts`:

```ts
describe("hábitos con cantidad", () => {
  async function conObjetivo(target: number | null) {
    const db = createTestDb();
    await db.insert(habits).values({
      id: "h1",
      name: "Agua",
      schedule: "1111111",
      targetCount: target,
      createdAt: new Date(1700000000000),
    });
    return db;
  }

  it("llegar al objetivo cuenta como completo", async () => {
    const db = await conObjetivo(8);
    await setHabitCount(db, "h1", 8);
    const [l] = await db.select().from(habitLogs);
    expect(l.count).toBe(8);
    expect(l.partial).toBe(false);
  });

  it("quedarse corto cuenta como a medias", async () => {
    const db = await conObjetivo(8);
    await setHabitCount(db, "h1", 5);
    const [l] = await db.select().from(habitLogs);
    expect(l.partial).toBe(true);
  });

  it("apuntar cero borra el registro del día", async () => {
    const db = await conObjetivo(8);
    await setHabitCount(db, "h1", 5);
    await setHabitCount(db, "h1", 0);
    expect(await db.select().from(habitLogs)).toHaveLength(0);
  });

  /*
    Volver a apuntar el mismo día ACTUALIZA, no inserta: el índice único de
    (habit_id, date) lo impide, y de él depende el cálculo de rachas.
  */
  it("apuntar dos veces el mismo día no duplica", async () => {
    const db = await conObjetivo(8);
    await setHabitCount(db, "h1", 3);
    await setHabitCount(db, "h1", 8);
    const filas = await db.select().from(habitLogs);
    expect(filas).toHaveLength(1);
    expect(filas[0].count).toBe(8);
  });

  it("un hábito sin objetivo no acepta cantidad", async () => {
    const db = await conObjetivo(null);
    await setHabitCount(db, "h1", 5);
    expect(await db.select().from(habitLogs)).toHaveLength(0);
  });

  /*
    El XP tiene que cuadrar en las dos direcciones: subir de 3 a 8 da la
    diferencia, no el total otra vez.
  */
  it("subir del corto al objetivo ajusta el XP, no lo duplica", async () => {
    const db = await conObjetivo(8);
    const corto = await setHabitCount(db, "h1", 3);
    const pleno = await setHabitCount(db, "h1", 8);
    expect(pleno.player.xp).toBe(XP_PER_HABIT);
    expect(corto.player.xp).toBe(Math.floor(XP_PER_HABIT / 2));
  });
});
```

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/habitos/lib/mutations.test.ts
```

- [x] **Paso 3: `setHabitCount`**

```ts
/**
 * Apunta la cantidad de hoy en un hábito de cantidad.
 *
 * Reusa `toggleHabitDay` en lo que puede —el XP, el ancla, los hitos y los
 * escudos ya están resueltos ahí— y solo añade la columna `count` y el `partial`
 * derivado. Escribir una segunda ruta de XP en paralelo sería la forma más
 * rápida de que las dos dejaran de cuadrar.
 *
 * Cantidad 0 borra el registro del día: es lo mismo que desmarcar.
 */
export async function setHabitCount(
  db: Db,
  habitId: string,
  count: number,
): Promise<ToggleResult> {
  const [habit] = await db
    .select()
    .from(habitsTable)
    .where(eq(habitsTable.id, habitId))
    .limit(1);
  if (!habit) return emptyToggle(db, "not-found");
  // Sin objetivo no se apunta cantidad: ese hábito va por su botón de siempre.
  if (habit.targetCount === null) return emptyToggle(db, "no-target");

  const n = Math.max(0, Math.floor(count));
  const hoy = dayKey();
  const [existente] = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, hoy)))
    .limit(1);

  // Cero es desmarcar. Si no hay nada, no hay nada que hacer.
  if (n === 0) {
    if (!existente) return emptyToggle(db, "ok");
    return toggleHabitDay(db, habitId, hoy, false);
  }

  const completo = n >= habit.targetCount;
  const partialAhora = !completo;

  // Si el estado de completitud no cambia, solo se actualiza el número: el XP
  // ya está bien y volver a pasar por `toggleHabitDay` lo movería sin motivo.
  if (existente && !!existente.partial === partialAhora) {
    await db
      .update(habitLogs)
      .set({ count: n })
      .where(eq(habitLogs.id, existente.id));
    return soloContador(db, partialAhora);
  }

  // Cambia de completo a corto o al revés: se pasa por la ruta de siempre, que
  // ajusta el XP, y después se guarda el número.
  if (existente) await toggleHabitDay(db, habitId, hoy, false);
  const r = await toggleHabitDay(db, habitId, hoy, partialAhora);
  await db
    .update(habitLogs)
    .set({ count: n })
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, hoy)));
  return r;
}
```

**`emptyToggle` existe y recibe una razón**, de la unión
`"ok" | "not-found" | "not-scheduled" | "out-of-range"`. Hay que **añadir
`"no-target"`** a esa unión: un hábito sin objetivo al que se le apunta cantidad
no es «no encontrado» ni «fuera de rango», y meterlo con calzador en una de esas
haría que el mensaje al usuario mintiera.

**`recomputeToggle` NO existe** —era un invento de este plan— y hace falta un
ayudante nuevo. Cuando solo cambia el número y no la completitud, no hay XP que
mover ni evento que anunciar:

```ts
/**
 * El día ya estaba registrado y solo se movió el número: ni XP, ni escudo, ni
 * hito. Pasar por `toggleHabitDay` aquí sería peor que inútil — desmarcar y
 * volver a marcar puede gastar un escudo o disparar un aviso de hito que el
 * usuario no ha ganado otra vez.
 */
async function soloContador(db: Db, partial: boolean): Promise<ToggleResult> {
  return {
    ok: true,
    reason: "ok",
    done: true,
    partial,
    xpDelta: 0,
    leveledUp: false,
    player: await playerSnapshot(db),
    shieldUsed: false,
    anchorTriggered: false,
    milestone: null,
    questsCompleted: [],
  };
}
```

Y `createHabit` acepta el objetivo:

```ts
  const targetRaw = String(formData.get("targetCount") ?? "").trim();
  const targetCount = targetRaw === "" ? null : Math.max(1, Number(targetRaw) | 0);
```

Con `targetCount` en el `values({...})`.

Más una mutación para ponérselo a un hábito que ya existe:

```ts
export async function updateHabitTarget(
  db: Db,
  habitId: string,
  targetCount: number | null,
) {
  if (!habitId) return;
  await db
    .update(habitsTable)
    .set({ targetCount })
    .where(eq(habitsTable.id, habitId));
}
```

- [x] **Paso 4: Los server actions**

```ts
export async function apuntarCantidad(habitId: string, count: number) {
  const r = await m.setHabitCount(db, habitId, count);
  refresh();
  return r;
}

export async function cambiarObjetivoHabito(
  habitId: string,
  targetCount: number | null,
) {
  await m.updateHabitTarget(db, habitId, targetCount);
  refresh();
}
```

- [x] **Paso 5: Verificar**

```bash
npx vitest run && npx tsc --noEmit && npm run lint
```

- [x] **Paso 6: Commit**

```bash
git add -A src
git commit -m "feat(habitos): apuntar la cantidad del dia"
```

---

### Tarea 5: El contador y el aviso

**Files:**
- Modify: `src/modules/habitos/components/habits/HabitRow.tsx`
- Modify: `src/modules/habitos/components/habits/NewHabitForm.tsx`

- [x] **Paso 1: El contador en la fila**

Donde hoy está el botón de modo mínimo, un hábito con `targetCount` muestra en
su lugar el contador. Las props crecen con `targetCount: number | null` y
`countToday: number | null`.

```tsx
{p.targetCount !== null ? (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <button
      type="button"
      onClick={() => apuntar(Math.max(0, (p.countToday ?? 0) - 1))}
      disabled={pending || (p.countToday ?? 0) === 0}
      aria-label={`Quitar uno a ${p.name}`}
      className={BOTON_CONTADOR}
    >
      −
    </button>
    <span
      style={{
        fontFamily: "var(--font-vt)",
        fontSize: 16,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        minWidth: 42,
        textAlign: "center",
      }}
    >
      {p.countToday ?? 0} / {p.targetCount}
    </span>
    <button
      type="button"
      onClick={() => apuntar((p.countToday ?? 0) + 1)}
      disabled={pending}
      aria-label={`Sumar uno a ${p.name}`}
      className={BOTON_CONTADOR}
    >
      +
    </button>
  </div>
) : p.scheduledToday && p.minimalGoal && !p.doneToday ? (
  BOTON_DE_MODO_MINIMO_QUE_YA_ESTA_EN_EL_ARCHIVO
) : null}
```

Donde dice `BOTON_DE_MODO_MINIMO_QUE_YA_ESTA_EN_EL_ARCHIVO`, **pega el bloque
JSX del botón de modo mínimo tal como está hoy** en `HabitRow.tsx` (busca
`Modo mínimo:` en el `title`). No lo reescribas: la condición que lo envuelve es
la de siempre y solo cambia que ahora es la rama `else` del contador.

`apuntar` llama a `apuntarCantidad(p.id, n)` dentro de una transición, y
`BOTON_CONTADOR` copia las clases de ese mismo botón.

- [x] **Paso 2: El aviso, que es media decisión del spec**

Bajo el contador, cuando hay cantidad apuntada pero no se llega al objetivo:

```tsx
{p.targetCount !== null &&
(p.countToday ?? 0) > 0 &&
(p.countToday ?? 0) < p.targetCount ? (
  <div style={{ fontSize: 11.5, marginTop: 4 }}>
    Por debajo del objetivo: la racha no está a salvo.
  </div>
) : null}
```

> **Esto no es adorno.** Un hábito de cantidad por debajo del objetivo pierde la
> racha, y uno de modo mínimo no. Sin este aviso, la diferencia entre los dos
> parece un fallo. Es el criterio nº 8.

- [x] **Paso 3: El campo en el formulario**

En `NewHabitForm.tsx`, un campo numérico opcional:

```tsx
<Field
  label="Objetivo diario (opcional, p. ej. 8)"
  value={objetivo}
  onChange={(v) => setObjetivo(v.replace(/[^0-9]/g, ""))}
  placeholder="vacío = sin cantidad"
  maxLength={4}
/>
```

Y en el `FormData`, `fd.set("targetCount", objetivo)`.

> Se filtran los no-dígitos al escribir en vez de validar al enviar: así el campo
> no acepta nunca algo que el servidor vaya a rechazar.

- [x] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [x] **Paso 5: Commit**

```bash
git add -A src
git commit -m "feat(habitos): contador en la fila y aviso de racha en riesgo"
```

---

### Tarea 6: Verificación final

- [x] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [x] **Paso 2: Que los cinco pasen por la regla**

```bash
grep -rn "computeStreak(" src/modules/habitos/lib/*.ts | grep -v streak.ts
grep -rn "diasQueCuentan" src/modules/habitos/lib/*.ts | grep -v cantidad
```

El segundo grep tiene que cubrir todos los sitios del primero.

- [x] **Paso 3: Que `streak.test.ts` no se haya tocado**

```bash
git diff main --stat -- '*streak.test.ts'
```

Esperado: **nada**.

- [x] **Paso 4: La base real**

```bash
node -e "
const D=require('better-sqlite3');const d=new D('data/juampi.db',{readonly:true});
console.log('habits:', d.prepare('pragma table_info(habits)').all().map(c=>c.name).join(', '));
console.log('habit_logs:', d.prepare('pragma table_info(habit_logs)').all().map(c=>c.name).join(', '));
console.log('con objetivo:', d.prepare('select count(*) c from habits where target_count is not null').get());
"
```

- [x] **Paso 5: En pantalla**

1. Crea un hábito con objetivo 3.
2. Suma uno: la fila dice `1 / 3` y **avisa de que la racha no está a salvo**.
3. Sube a 3: el aviso desaparece y el hábito queda hecho.
4. Baja a 0: el registro del día se va.
5. Comprueba que un hábito **sin** objetivo sigue con su botón de modo mínimo y
   se comporta igual que antes.

> Hazlo sobre un hábito de prueba tuyo. Marcar y desmarcar mueve el XP, las
> misiones del día y —si el hábito es ancla— el bonus.

**Medido en la ejecución**, con objetivo 3 y XP_PER_HABIT = 25:

```
0 / 3   sin aviso
1 / 3   avisa · 2 / 3  avisa
3 / 3   sin aviso · partial 0 · XP +25 en total, no +25 por clic
2 / 3   avisa · partial 1 · XP a la mitad, 12
borrado tres habitos intactos, XP de vuelta al valor inicial
```

**Y un aviso para quien verifique así:** no llames al hábito de prueba
«…borrar». Buscar `/borrar/i` en los `aria-label` casa con el NOMBRE del hábito y
acaba pulsando el botón de marcar en vez del de borrar. Pasó aquí. Filtra por
`aria-label === "Borrar <nombre>"` exacto.

- [x] **Paso 6: Marcar el plan y el spec**

---

## Criterios de aceptación

- [x] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [x] 2. La migración añade las dos columnas y es idempotente
- [x] 3. Un hábito sin objetivo se comporta exactamente como hoy
- [x] 4. Con objetivo 8: apuntar 8 da XP completo y mantiene la racha
- [x] 5. Con objetivo 8: apuntar 5 da la mitad y **no** mantiene la racha
- [x] 6. Los cinco cálculos de racha pasan por `diasQueCuentan`
- [x] 7. `streak.test.ts` sigue pasando **sin tocarse**
- [x] 8. La fila avisa de que apuntar por debajo no protege la racha
