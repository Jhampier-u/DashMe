# ¿Escucho distinto los días que cumplo? · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un panel en la portada que compare tus minutos de escucha en los días que cumples todo contra los que no, y que se niegue a comparar cuando no hay datos suficientes.

**Architecture:** La parte calculable vive en `core/` y no sabe qué es un hábito ni qué es una escucha. Hábitos aporta dos conjuntos de días; música aporta minutos por día; la página compone. Los dos módulos siguen sin conocerse.

**Tech Stack:** Next 16.2.12 · Drizzle sobre SQLite · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-30-cruce-musica-habitos-design.md`

---

## Antes de empezar: lee esto

**Lo importante de este bloque es cuándo NO responde.** Hoy hay un solo día con
datos de los dos lados. Un panel que con eso dijera un porcentaje estaría
inventando. El suelo son **10 días en cada grupo**, y por debajo se dice cuántos
faltan.

**`compararGrupos` no importa nada de `habitos` ni de `musica`.** Si te ves
haciéndolo, el cruce ha dejado de ser de nadie y ha pasado a ser de uno de los
dos. Es el criterio nº 6.

**`habitos` no importa `musica`, ni al revés.** La composición la hace
`src/app/page.tsx`, que es el único sitio que conoce legítimamente las dos
interfaces públicas. Es el criterio nº 7.

**Ninguna tabla, ninguna columna, ninguna migración.** Todo sale de lo que ya hay.

**Y el texto no afirma causalidad.** Sin flechas, sin «mejor» ni «peor», sin
consejos. Solo lo que mide.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `core/analisis/comparar-dias.ts` | **Nuevo.** `compararGrupos`, pura y sin dominio |
| `core/analisis/comparar-dias.test.ts` | **Nuevo.** |
| `habitos/lib/dias-cumplidos.ts` | **Nuevo.** Los dos conjuntos de días |
| `habitos/lib/dias-cumplidos.test.ts` | **Nuevo.** |
| `app/page.tsx` | Compone las dos lecturas |
| `habitos/components/home/MusicaPanel.tsx` | **Nuevo.** Lo pinta |

---

### Tarea 1: La comparación, pura y sin dominio

**Files:**
- Create: `src/modules/core/analisis/comparar-dias.ts`
- Create: `src/modules/core/analisis/comparar-dias.test.ts`

- [ ] **Paso 1: Escribir el test**

`src/modules/core/analisis/comparar-dias.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compararGrupos, mediana, MINIMO_POR_GRUPO } from "./comparar-dias";

/** Días como números sueltos: esta función no sabe qué es una fecha. */
const dias = (...ns: number[]) => new Set(ns);

/** Todos los días valen lo mismo salvo los que se indiquen. */
function valores(m: Record<number, number>): Map<number, number> {
  return new Map(Object.entries(m).map(([k, v]) => [Number(k), v]));
}

/** n días seguidos desde `desde`, todos con el mismo valor. */
function serie(desde: number, n: number, valor: number) {
  const m: Record<number, number> = {};
  for (let i = 0; i < n; i++) m[desde + i] = valor;
  return m;
}

describe("mediana", () => {
  it("con impares es el de en medio", () => {
    expect(mediana([3, 1, 2])).toBe(2);
  });

  it("con pares es la media de los dos centrales", () => {
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });

  it("sin nada es null", () => {
    expect(mediana([])).toBeNull();
  });

  /*
    Por esto es mediana y no media: un solo día raro —ocho horas de música de
    fondo— arrastra la media y fabrica una diferencia que no existe.
  */
  it("un valor extremo no la mueve", () => {
    expect(mediana([10, 10, 10, 10, 5000])).toBe(10);
  });
});

describe("compararGrupos se niega sin datos suficientes", () => {
  /*
    LA DECISIÓN CENTRAL DEL BLOQUE. Hoy hay un día de solapamiento; decir un
    porcentaje con eso sería inventar.
  */
  it("con un día en cada grupo no compara", () => {
    const r = compararGrupos(valores({ 1: 30, 2: 40 }), dias(1), dias(2));
    expect(r.suficiente).toBe(false);
  });

  it("dice cuántos faltan en cada grupo", () => {
    const r = compararGrupos(
      valores({ ...serie(1, 3, 30), ...serie(100, 1, 40) }),
      dias(1, 2, 3),
      dias(100),
    );
    expect(r.suficiente).toBe(false);
    expect(r.faltanA).toBe(MINIMO_POR_GRUPO - 3);
    expect(r.faltanB).toBe(MINIMO_POR_GRUPO - 1);
  });

  it("con uno de los dos grupos completo tampoco basta", () => {
    const r = compararGrupos(
      valores({ ...serie(1, 20, 30), ...serie(100, 2, 40) }),
      dias(...Array.from({ length: 20 }, (_, i) => 1 + i)),
      dias(100, 101),
    );
    expect(r.suficiente).toBe(false);
    expect(r.faltanA).toBe(0);
    expect(r.faltanB).toBe(MINIMO_POR_GRUPO - 2);
  });

  it("justo en el mínimo ya compara", () => {
    const n = MINIMO_POR_GRUPO;
    const r = compararGrupos(
      valores({ ...serie(1, n, 30), ...serie(100, n, 50) }),
      dias(...Array.from({ length: n }, (_, i) => 1 + i)),
      dias(...Array.from({ length: n }, (_, i) => 100 + i)),
    );
    expect(r.suficiente).toBe(true);
  });
});

describe("compararGrupos con datos suficientes", () => {
  const n = MINIMO_POR_GRUPO;
  const gA = dias(...Array.from({ length: n }, (_, i) => 1 + i));
  const gB = dias(...Array.from({ length: n }, (_, i) => 100 + i));

  it("devuelve las dos medianas y los dos tamaños", () => {
    const r = compararGrupos(
      valores({ ...serie(1, n, 30), ...serie(100, n, 50) }),
      gA,
      gB,
    );
    expect(r.suficiente).toBe(true);
    expect(r.medianaA).toBe(30);
    expect(r.medianaB).toBe(50);
    expect(r.nA).toBe(n);
    expect(r.nB).toBe(n);
  });

  /*
    Un día del grupo sin valor cuenta como CERO y no se descarta: no haber
    escuchado nada es un dato, y descartarlo subiría la mediana del grupo que
    menos escucha.
  */
  it("un día sin valor cuenta como cero", () => {
    const soloAlgunos = valores({ ...serie(1, n - 1, 30), ...serie(100, n, 50) });
    const r = compararGrupos(soloAlgunos, gA, gB);
    expect(r.nA).toBe(n);
    // Con n-1 treintas y un cero, la mediana sigue siendo 30 salvo con n=2.
    expect(r.medianaA).toBe(30);
  });

  /*
    Los días que no están en ninguno de los dos conjuntos se ignoran, incluso si
    tienen valor. Ahí van los días en pausa y los que no tocaba nada.
  */
  it("los días fuera de los dos grupos se ignoran", () => {
    const conRuido = valores({
      ...serie(1, n, 30),
      ...serie(100, n, 50),
      ...serie(500, 50, 9999),
    });
    const r = compararGrupos(conRuido, gA, gB);
    expect(r.medianaA).toBe(30);
    expect(r.medianaB).toBe(50);
    expect(r.nA + r.nB).toBe(n * 2);
  });

  it("un día en los dos grupos a la vez no se cuenta dos veces", () => {
    const n2 = MINIMO_POR_GRUPO;
    const solapado = dias(...Array.from({ length: n2 }, (_, i) => 1 + i));
    const r = compararGrupos(
      valores(serie(1, n2, 30)),
      solapado,
      solapado,
    );
    // Mismo conjunto en los dos lados: la comparación no significa nada, pero no
    // debe reventar ni contar el doble.
    expect(r.nA).toBe(n2);
    expect(r.nB).toBe(n2);
  });
});
```

- [ ] **Paso 2: Ejecutar y verlo fallar**

```bash
cd "/c/PROYECTO JUAMPI"
npx vitest run src/modules/core/analisis/comparar-dias.test.ts
```

- [ ] **Paso 3: Escribirlo**

`src/modules/core/analisis/comparar-dias.ts`:

```ts
/*
  Compara una serie diaria de números partida en dos grupos de días.

  NO SABE DE NINGÚN DOMINIO, y eso es deliberado. La pregunta que responde
  —«¿este número es distinto en estos días que en aquellos?»— no pertenece ni a
  hábitos ni a música: si viviera en uno, ese módulo tendría que importar al
  otro, y hoy no se conocen. Recibe números por día y dos conjuntos de días.

  Las claves de día son números a secas. Aquí no se sabe si son epoch, ordinales
  o índices: solo tienen que ser comparables por igualdad.
*/

/**
 * Días mínimos en CADA grupo para responder.
 *
 * Es la decisión central de este bloque. Con menos, la mediana depende de un día
 * concreto y el resultado sería inventado — y decir «te faltan 8 días» es
 * información útil, mientras que un porcentaje falso no lo es.
 */
export const MINIMO_POR_GRUPO = 10;

export type Comparacion = {
  /** Si hay bastantes días en los dos grupos para decir algo. */
  suficiente: boolean;
  nA: number;
  nB: number;
  /** Cuántos días faltan en cada grupo. 0 si ya hay bastantes. */
  faltanA: number;
  faltanB: number;
  /** `null` si el grupo está vacío. */
  medianaA: number | null;
  medianaB: number | null;
};

/**
 * La mediana.
 *
 * Se usa esta y no la media porque un solo día raro —ocho horas de música de
 * fondo trabajando— arrastra la media y fabrica una diferencia que no existe.
 */
export function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const orden = [...xs].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 1
    ? orden[medio]
    : (orden[medio - 1] + orden[medio]) / 2;
}

export function compararGrupos(
  valorPorDia: Map<number, number>,
  grupoA: Set<number>,
  grupoB: Set<number>,
  minimo: number = MINIMO_POR_GRUPO,
): Comparacion {
  // Un día del grupo sin valor cuenta como CERO y no se descarta: no haber
  // escuchado nada es un dato, y descartarlo subiría la mediana del grupo que
  // menos escucha.
  const deA = [...grupoA].map((d) => valorPorDia.get(d) ?? 0);
  const deB = [...grupoB].map((d) => valorPorDia.get(d) ?? 0);

  const nA = deA.length;
  const nB = deB.length;

  return {
    suficiente: nA >= minimo && nB >= minimo,
    nA,
    nB,
    faltanA: Math.max(0, minimo - nA),
    faltanB: Math.max(0, minimo - nB),
    medianaA: mediana(deA),
    medianaB: mediana(deB),
  };
}
```

- [ ] **Paso 4: Verificar que no sabe de dominios**

```bash
npx vitest run src/modules/core/analisis/comparar-dias.test.ts && npx tsc --noEmit
grep -n "habitos\|musica" src/modules/core/analisis/comparar-dias.ts || echo "sin dominios: correcto"
```

- [ ] **Paso 5: Commit y push**

```bash
git add src/modules/core/analisis
git commit -m "feat(core): comparar una serie diaria partida en dos grupos"
git push
```

---

### Tarea 2: Los dos conjuntos de días

**Files:**
- Create: `src/modules/habitos/lib/dias-cumplidos.ts`
- Create: `src/modules/habitos/lib/dias-cumplidos.test.ts`
- Modify: `src/modules/habitos/index.ts`

- [ ] **Paso 1: Escribir el test**

`src/modules/habitos/lib/dias-cumplidos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { habits, habitLogs, habitPauses } from "@/modules/habitos/schema";
import { getDiasCumplidos } from "./dias-cumplidos";

const T0 = new Date(Date.UTC(2026, 6, 1));
const D = (n: number) => new Date(Date.UTC(2026, 6, n));

async function conHabito(id: string, schedule = "1111111") {
  const db = createTestDb();
  await db.insert(habits).values({ id, name: id, schedule, createdAt: T0 });
  return db;
}

async function marcar(
  db: Awaited<ReturnType<typeof conHabito>>,
  habitId: string,
  dia: Date,
  partial = false,
) {
  await db.insert(habitLogs).values({
    id: `${habitId}-${dia.getTime()}`,
    habitId,
    date: dia,
    partial,
    xpAwarded: 0,
    createdAt: dia,
  });
}

describe("getDiasCumplidos", () => {
  it("un día con todo hecho es cumplido", async () => {
    const db = await conHabito("h1");
    await marcar(db, "h1", D(2));
    const r = await getDiasCumplidos(db, D(2), D(2));
    expect([...r.cumplidos]).toEqual([D(2).getTime()]);
    expect([...r.fallados]).toEqual([]);
  });

  it("un día con algo sin hacer es fallado", async () => {
    const db = await conHabito("h1");
    await db.insert(habits).values({
      id: "h2",
      name: "h2",
      schedule: "1111111",
      createdAt: T0,
    });
    await marcar(db, "h1", D(2));
    const r = await getDiasCumplidos(db, D(2), D(2));
    expect([...r.fallados]).toEqual([D(2).getTime()]);
    expect([...r.cumplidos]).toEqual([]);
  });

  /*
    Un día a medias NO es un día cumplido: misma definición que la racha global y
    que la misión «día completo».
  */
  it("un día a medias es fallado", async () => {
    const db = await conHabito("h1");
    await marcar(db, "h1", D(2), true);
    const r = await getDiasCumplidos(db, D(2), D(2));
    expect([...r.fallados]).toEqual([D(2).getTime()]);
  });

  /*
    UN DÍA EN PAUSA NO ES NI CUMPLIDO NI FALLADO. Si contara como fallado, una
    pausa larga sería una racha de fallos y torcería la comparación entera.
  */
  it("un día en pausa sale de los dos conjuntos", async () => {
    const db = await conHabito("h1");
    await db.insert(habitPauses).values({
      id: "p1",
      habitId: "h1",
      fromDay: D(2),
      toDay: D(2),
      reason: null,
      createdAt: T0,
    });
    const r = await getDiasCumplidos(db, D(2), D(2));
    expect(r.cumplidos.size).toBe(0);
    expect(r.fallados.size).toBe(0);
  });

  it("un día sin nada programado sale de los dos", async () => {
    // Solo lunes. El 2026-07-02 es jueves.
    const db = await conHabito("h1", "0100000");
    const r = await getDiasCumplidos(db, D(2), D(2));
    expect(r.cumplidos.size).toBe(0);
    expect(r.fallados.size).toBe(0);
  });

  /*
    Un hábito no cuenta antes de existir: si no, los días anteriores a su creación
    saldrían todos como fallados.
  */
  it("un hábito no cuenta antes de existir", async () => {
    const db = createTestDb();
    await db.insert(habits).values({
      id: "h1",
      name: "h1",
      schedule: "1111111",
      createdAt: D(10),
    });
    const r = await getDiasCumplidos(db, D(5), D(5));
    expect(r.cumplidos.size).toBe(0);
    expect(r.fallados.size).toBe(0);
  });

  it("sin hábitos los dos conjuntos están vacíos", async () => {
    const r = await getDiasCumplidos(createTestDb(), D(1), D(10));
    expect(r.cumplidos.size).toBe(0);
    expect(r.fallados.size).toBe(0);
  });
});
```

- [ ] **Paso 2: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/habitos/lib/dias-cumplidos.test.ts
```

- [ ] **Paso 3: Escribirlo**

`src/modules/habitos/lib/dias-cumplidos.ts`:

```ts
import { and, asc, gte, lte } from "drizzle-orm";
import type { Db } from "@/modules/core/db";
import { habits as habitsTable, habitLogs } from "@/modules/habitos/schema";
import { addDays, normalizeDayKey, dayKey } from "./day";
import { cal, estaProgramado, sanitizeSchedule } from "./calendario";
import { pausasPorHabito } from "./pausas";

export type DiasCumplidos = {
  /** Días en que se cumplió TODO lo programado. */
  cumplidos: Set<number>;
  /** Días en que tocaba algo y no se cumplió todo. */
  fallados: Set<number>;
};

/**
 * Parte los días en cumplidos y fallados.
 *
 * Un día es CUMPLIDO si todos los hábitos que tocaban ese día están marcados sin
 * modo mínimo. Misma definición que la racha global y que la misión «día
 * completo», para no inventar un tercer criterio de lo mismo.
 *
 * Tres clases de día quedan FUERA de los dos conjuntos:
 *
 *   · los que no tocaba nada — no había nada que cumplir;
 *   · los que todo lo que tocaba estaba en pausa — igual;
 *   · los anteriores a que existiera cada hábito.
 *
 * Lo de la pausa importa: si contara como fallado, una pausa larga sería una
 * racha de fallos y torcería cualquier comparación que se haga con esto.
 */
export async function getDiasCumplidos(
  db: Db,
  desde: Date,
  hasta: Date,
): Promise<DiasCumplidos> {
  const a = normalizeDayKey(desde);
  const b = normalizeDayKey(hasta);

  const [filas, logs, pausas] = await Promise.all([
    db
      .select({
        id: habitsTable.id,
        schedule: habitsTable.schedule,
        createdAt: habitsTable.createdAt,
      })
      .from(habitsTable)
      .orderBy(asc(habitsTable.createdAt)),
    db
      .select({
        habitId: habitLogs.habitId,
        date: habitLogs.date,
        partial: habitLogs.partial,
      })
      .from(habitLogs)
      .where(and(gte(habitLogs.date, a), lte(habitLogs.date, b))),
    pausasPorHabito(db),
  ]);

  const specs = filas.map((h) => ({
    id: h.id,
    calendario: cal(sanitizeSchedule(h.schedule), pausas.get(h.id) ?? []),
    desde: dayKey(h.createdAt),
  }));

  // Solo los NO parciales: un día a medias no es un día cumplido.
  const plenos = new Map<number, Set<string>>();
  for (const l of logs) {
    if (l.partial) continue;
    const t = normalizeDayKey(l.date).getTime();
    const set = plenos.get(t);
    if (set) set.add(l.habitId);
    else plenos.set(t, new Set([l.habitId]));
  }

  const cumplidos = new Set<number>();
  const fallados = new Set<number>();

  for (let d = a; d.getTime() <= b.getTime(); d = addDays(d, 1)) {
    const t = d.getTime();
    const vigentes = specs.filter(
      (s) => s.desde.getTime() <= t && estaProgramado(s.calendario, d),
    );
    // Nada que cumplir: fuera de los dos conjuntos.
    if (vigentes.length === 0) continue;

    const hechos = plenos.get(t) ?? new Set<string>();
    if (vigentes.every((s) => hechos.has(s.id))) cumplidos.add(t);
    else fallados.add(t);
  }

  return { cumplidos, fallados };
}
```

Y en `src/modules/habitos/index.ts`:

```ts
export { getDiasCumplidos, type DiasCumplidos } from "./lib/dias-cumplidos";
```

- [ ] **Paso 4: Verificar que no importa música**

```bash
npx vitest run && npx tsc --noEmit && npm run lint
grep -rn "modules/musica" src/modules/habitos/ || echo "habitos no conoce musica: correcto"
```

- [ ] **Paso 5: Commit y push**

```bash
git add -A src
git commit -m "feat(habitos): los dias cumplidos y los fallados, sin contar pausas"
git push
```

---

### Tarea 3: El panel y la composición

**Files:**
- Create: `src/modules/habitos/components/home/MusicaPanel.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Paso 1: El panel**

`src/modules/habitos/components/home/MusicaPanel.tsx`.

**Por qué ahí, siendo un compromiso.** Este panel no es de hábitos: su texto
menciona los dos dominios, así que estrictamente no pertenece a ninguno. Pero no
importa nada de música —solo el tipo `Comparacion` de `core`—, así que **no crea
ninguna dependencia entre módulos**, y la portada se ensambla con los componentes
de `habitos/components/home/`. Inventarle una tercera casa a un solo componente
sería peor que este compromiso. Si algún día hay tres o cuatro paneles cruzados,
entonces sí merecerán su sitio.

```tsx
import { Card } from "@/modules/core/ui/Card";
import type { Comparacion } from "@/modules/core/analisis/comparar-dias";

const ROTULO = "block text-xs font-semibold text-tinta font-cuerpo mb-1.5";

function minutos(ms: number | null): string {
  if (ms === null) return "—";
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/**
 * Los días que cumples frente a los que no, en minutos de música.
 *
 * NO AFIRMA CAUSALIDAD, y eso es una decisión del diseño, no un descuido de
 * redacción. Es una correlación sobre dos grupos de diez días: no distingue causa
 * de casualidad. Sin flechas, sin «mejor» ni «peor», sin consejos.
 */
export function MusicaPanel({ c }: { c: Comparacion }) {
  return (
    <Card>
      <span className={ROTULO}>Música y hábitos</span>

      {!c.suficiente ? (
        <p style={{ fontSize: 13 }}>
          Todavía no hay bastante para comparar.
          {c.faltanA > 0 ? ` Faltan ${c.faltanA} días cumpliendo todo` : ""}
          {c.faltanA > 0 && c.faltanB > 0 ? " y" : ""}
          {c.faltanB > 0 ? ` ${c.faltanB} días sin cumplirlo todo` : ""}.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 13 }}>
            Los días que cumples todo escuchas{" "}
            <strong>{minutos(c.medianaA)}</strong> de música. Los días que no,{" "}
            <strong>{minutos(c.medianaB)}</strong>.
          </p>
          <p style={{ fontSize: 11.5, marginTop: 6 }}>
            Medianas sobre {c.nA} días cumplidos y {c.nB} sin cumplir. Es una
            coincidencia en tus datos, no una causa.
          </p>
        </>
      )}
    </Card>
  );
}
```

> La última frase es el criterio nº 8. **No la quites ni la suavices**: en cuanto
> se pinta un número, se lee como causa.

- [ ] **Paso 2: La composición, en la página**

En `src/app/page.tsx`, junto a las lecturas que ya hace:

```tsx
import { getByDate } from "@/modules/musica";
import { getDiasCumplidos } from "@/modules/habitos";
import { compararGrupos } from "@/modules/core/analisis/comparar-dias";
import { MusicaPanel } from "@/modules/habitos/components/home/MusicaPanel";
```

```tsx
  /*
    Aquí y no dentro de un módulo: la pregunta no es de hábitos ni de música, y
    ponerla en uno obligaría a ese a importar el otro. La página es el único sitio
    que conoce legítimamente las dos interfaces públicas.
  */
  const hastaISO = new Date().toISOString().slice(0, 10);
  const desde = new Date();
  desde.setUTCDate(desde.getUTCDate() - 365);
  const desdeISO = desde.toISOString().slice(0, 10);

  const [dias, porDia] = await Promise.all([
    getDiasCumplidos(db, desde, new Date()),
    getByDate(db, {
      fromDate: desdeISO,
      toDate: hastaISO,
      label: "último año",
      preset: "custom",
    }),
  ]);

  // `getByDate` devuelve la fecha como "YYYY-MM-DD"; los conjuntos de días son
  // claves numéricas. Se pasan a la misma moneda antes de comparar.
  const msPorDia = new Map<number, number>();
  for (const d of porDia) {
    const [y, m, dd] = d.date.split("-").map(Number);
    msPorDia.set(Date.UTC(y, m - 1, dd), d.ms);
  }

  const cruce = compararGrupos(msPorDia, dias.cumplidos, dias.fallados);
```

Y bajo la gráfica de cumplimiento, `<MusicaPanel c={cruce} />`.

> **Comprueba el tipo de `StatsRange`** antes de escribir el objeto: está en
> `src/modules/musica/lib/stats/range.ts` y tiene `fromDate`, `toDate`, `label` y
> `preset`. Si `preset` no admite `"custom"`, usa el valor que corresponda.

- [ ] **Paso 3: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 4: Commit y push**

```bash
git add -A src
git commit -m "feat(portada): el cruce entre musica y habitos"
git push
```

---

### Tarea 4: Verificación final

- [ ] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [ ] **Paso 2: Que los módulos sigan sin conocerse**

```bash
grep -rn "modules/musica" src/modules/habitos/ || echo "habitos no conoce musica"
grep -rn "modules/habitos" src/modules/musica/ || echo "musica no conoce habitos"
grep -n "habitos\|musica" src/modules/core/analisis/comparar-dias.ts || echo "el nucleo no conoce a nadie"
```

Los tres tienen que salir limpios. Son los criterios 6 y 7.

- [ ] **Paso 3: En pantalla**

La portada **no** está detrás de la sesión de Spotify y las escuchas ya están en
la base local, así que esto se puede comprobar sin entrar en Spotify:

1. Abre `http://127.0.0.1:3000` y busca «Música y hábitos».
2. Con los datos de hoy tiene que decir **cuántos días faltan**, no un número.
3. Comprueba en la consola que el texto no contiene «mejor», «peor» ni flechas.

- [ ] **Paso 4: Que el suelo sea el que decide, y no un fallo**

Que el panel diga «faltan datos» podría deberse a que está roto. Lo que demuestra
que la rama del «suficiente» es la que se toma es el test
`justo en el mínimo ya compara` de la Tarea 1, que con exactamente 10 y 10 sí
compara. **Comprueba que ese test está en verde**, y con eso queda probado que el
mensaje de la portada es una decisión y no una avería.

- [ ] **Paso 5: Marcar el plan y el spec**

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. Con menos de 10 días en un grupo, el panel dice cuántos faltan
- [ ] 3. Con datos suficientes, muestra las dos medianas y los dos tamaños
- [ ] 4. Los días en pausa no entran en ninguno de los dos grupos
- [ ] 5. Los días sin nada programado no entran en ninguno de los dos grupos
- [ ] 6. `compararGrupos` no importa nada de `habitos` ni de `musica`
- [ ] 7. `habitos` no importa `musica`, ni al revés
- [ ] 8. El texto no afirma causalidad
