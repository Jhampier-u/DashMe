# Subtareas con cascada bidireccional · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que marcar un padre cierre sus subtareas y que cerrar la última subtarea cierre el padre, con el mismo XP se haga en el orden que se haga.

**Architecture:** Una función pura, `planCascada`, decide todos los cambios de estado a partir de la lista plana de tareas. `updateTaskStatus` los aplica en una transacción. El árbol de `/proyectos` baja a `components/tasks/` y lo comparten las dos pantallas.

**Tech Stack:** Next 16.2.12 · Drizzle sobre SQLite · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-29-cascada-subtareas-design.md`

---

## Antes de empezar: lee esto

**Ninguna migración.** No hay columnas nuevas. Si te ves tocando `SCHEMA_SQL` o
`migrar.ts`, te has salido.

**La subida es un EVENTO, no una regla permanente.** Se recalculan los ancestros
cuando cambia un hijo, y solo entonces. Si la implementas como invariante —«un
padre con todos los hijos hechos está hecho»— será imposible desmarcar un padre
a mano, porque se volvería a marcar al instante. Es la contradicción que el spec
resuelve en su punto 3 y el fallo más fácil de cometer aquí.

**La transacción de Drizzle sobre better-sqlite3 es SÍNCRONA.** `db.transaction(cb)`
devuelve `T`, no `Promise<T>`, y dentro se usa `tx.update(...).run()`, no
`await`. Verificado en `node_modules/drizzle-orm/better-sqlite3/session.d.ts:28`.
Un `async` ahí compila y no hace lo que parece.

**El ciclo cuelga el servidor.** `parent_id` no tiene foránea en la base real,
así que A→B→A es posible. Subir por los ancestros sin un conjunto de visitados
es un bucle infinito en el proceso del servidor, no un test en rojo.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/modules/habitos/lib/cascada.ts` | **Nuevo.** `planCascada`: decide, no toca la base |
| `src/modules/habitos/lib/cascada.test.ts` | **Nuevo.** Los casos de borde del árbol |
| `src/modules/habitos/lib/mutations.ts` | `updateTaskStatus` aplica el plan; nace `createSubtask` |
| `src/modules/habitos/lib/tasks.ts` | Cada raíz del tablero lleva su árbol |
| `src/modules/habitos/components/tasks/TaskTree.tsx` | **Movido** desde `projects/ProjectTree.tsx` |
| `src/modules/habitos/components/tasks/TaskTreeItem.tsx` | **Movido** desde `projects/ProjectTreeItem.tsx` |
| `src/modules/habitos/components/tasks/TaskCard.tsx` | Despliega el árbol |
| `src/app/proyectos/[id]/page.tsx` | Importa el árbol de su sitio nuevo |

---

### Tarea 1: `planCascada`, la función pura

**Files:**
- Create: `src/modules/habitos/lib/cascada.ts`
- Create: `src/modules/habitos/lib/cascada.test.ts`

- [x] **Paso 1: Escribir el test**

`src/modules/habitos/lib/cascada.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planCascada, type FilaCascada } from "./cascada";
import type { TaskStatus } from "./tasks";

/** `a>b` significa «b es hijo de a». El estado va tras los dos puntos. */
function arbol(...defs: string[]): FilaCascada[] {
  return defs.map((d) => {
    const [ruta, estado] = d.split(":");
    const partes = ruta.split(">");
    return {
      id: partes[partes.length - 1],
      parentId: partes.length > 1 ? partes[partes.length - 2] : null,
      status: (estado ?? "TODO") as TaskStatus,
    };
  });
}

/** El plan como objeto plano, para poder afirmarlo de un vistazo. */
function estados(filas: FilaCascada[], id: string, nuevo: TaskStatus) {
  const r: Record<string, TaskStatus> = {};
  for (const c of planCascada(filas, { id, nuevo })) r[c.id] = c.a;
  return r;
}

describe("hacia abajo", () => {
  it("marcar un padre cierra a sus hijos", () => {
    const t = arbol("p", "p>h1", "p>h2");
    expect(estados(t, "p", "DONE")).toEqual({
      p: "DONE",
      h1: "DONE",
      h2: "DONE",
    });
  });

  it("baja hasta el fondo, no solo un nivel", () => {
    const t = arbol("p", "p>h", "p>h>n", "p>h>n>b");
    expect(estados(t, "p", "DONE")).toEqual({
      p: "DONE",
      h: "DONE",
      n: "DONE",
      b: "DONE",
    });
  });

  it("no repite los que ya estaban hechos", () => {
    const t = arbol("p", "p>h1:DONE", "p>h2");
    const plan = planCascada(t, { id: "p", nuevo: "DONE" });
    expect(plan.map((c) => c.id).sort()).toEqual(["h2", "p"]);
  });

  /*
    Solo baja al COMPLETAR. Desmarcar un padre significa «aquí queda algo por
    hacer», no «borra todo ese trabajo».
  */
  it("desmarcar un padre no toca a sus hijos", () => {
    const t = arbol("p:DONE", "p>h1:DONE", "p>h2:DONE");
    expect(estados(t, "p", "TODO")).toEqual({ p: "TODO" });
  });

  it("poner un padre en proceso tampoco baja", () => {
    const t = arbol("p", "p>h1", "p>h2");
    expect(estados(t, "p", "IN_PROGRESS")).toEqual({ p: "IN_PROGRESS" });
  });
});

describe("hacia arriba", () => {
  it("cerrar la última subtarea cierra al padre", () => {
    const t = arbol("p", "p>h1:DONE", "p>h2");
    expect(estados(t, "h2", "DONE")).toEqual({ h2: "DONE", p: "DONE" });
  });

  it("con hijos a medias el padre queda en proceso", () => {
    const t = arbol("p", "p>h1", "p>h2");
    expect(estados(t, "h1", "DONE")).toEqual({ h1: "DONE", p: "IN_PROGRESS" });
  });

  it("un hijo en proceso basta para que el padre lo esté", () => {
    const t = arbol("p", "p>h1", "p>h2");
    expect(estados(t, "h1", "IN_PROGRESS")).toEqual({
      h1: "IN_PROGRESS",
      p: "IN_PROGRESS",
    });
  });

  it("reabrir una subtarea reabre al padre", () => {
    const t = arbol("p:DONE", "p>h1:DONE", "p>h2:DONE");
    expect(estados(t, "h2", "TODO")).toEqual({ h2: "TODO", p: "IN_PROGRESS" });
  });

  it("si no queda ninguna hecha, el padre vuelve a por iniciar", () => {
    const t = arbol("p:IN_PROGRESS", "p>h1:DONE");
    expect(estados(t, "h1", "TODO")).toEqual({ h1: "TODO", p: "TODO" });
  });

  it("sube varios niveles", () => {
    const t = arbol("a", "a>b", "a>b>c");
    expect(estados(t, "c", "DONE")).toEqual({
      c: "DONE",
      b: "DONE",
      a: "DONE",
    });
  });

  /*
    Si un ancestro ya estaba en el estado que le tocaba, los de más arriba lo
    ven igual que antes y tampoco pueden cambiar. Parar ahí no es solo una
    optimización: seguir subiendo escribiría filas que no cambian.
  */
  it("para en cuanto un ancestro no cambia", () => {
    const t = arbol("a:IN_PROGRESS", "a>b:IN_PROGRESS", "a>b>c", "a>b>c2:DONE", "a>x");
    const plan = planCascada(t, { id: "c", nuevo: "IN_PROGRESS" });
    expect(plan.map((c) => c.id)).toEqual(["c"]);
  });
});

describe("las dos direcciones a la vez", () => {
  it("una subtarea con hijos baja y sube en el mismo clic", () => {
    const t = arbol("a", "a>b", "a>b>c", "a>b>c2");
    expect(estados(t, "b", "DONE")).toEqual({
      b: "DONE",
      c: "DONE",
      c2: "DONE",
      a: "DONE",
    });
  });
});

describe("casos que no deberían existir pero existen", () => {
  it("una hoja sin padre solo se cambia a sí misma", () => {
    expect(estados(arbol("sola"), "sola", "DONE")).toEqual({ sola: "DONE" });
  });

  it("un id que no está devuelve un plan vacío", () => {
    expect(planCascada(arbol("a"), { id: "fantasma", nuevo: "DONE" })).toEqual([]);
  });

  it("cambiar al estado que ya tiene no cambia nada", () => {
    expect(planCascada(arbol("a:DONE"), { id: "a", nuevo: "DONE" })).toEqual([]);
  });

  /*
    Un padre que no existe. `buildTaskTree` ya lo saca como raíz; aquí la
    subida simplemente no encuentra a quién recalcular y para.
  */
  it("un huérfano no rompe la subida", () => {
    const t: FilaCascada[] = [
      { id: "h", parentId: "fantasma", status: "TODO" },
    ];
    expect(estados(t, "h", "DONE")).toEqual({ h: "DONE" });
  });

  /*
    EL CASO QUE CUELGA EL SERVIDOR. `parent_id` no tiene clave foránea en la
    base real, así que A hijo de B y B hijo de A es una fila corrupta posible.
    Sin conjunto de visitados, subir por los ancestros es un bucle infinito
    dentro del proceso de Next: no un test en rojo, un servidor colgado.
  */
  it("un ciclo no cuelga", () => {
    const t: FilaCascada[] = [
      { id: "a", parentId: "b", status: "TODO" },
      { id: "b", parentId: "a", status: "TODO" },
    ];
    const plan = planCascada(t, { id: "a", nuevo: "DONE" });
    expect(plan.length).toBeLessThanOrEqual(2);
  });

  it("un ciclo tampoco cuelga bajando", () => {
    const t: FilaCascada[] = [
      { id: "a", parentId: "b", status: "TODO" },
      { id: "b", parentId: "a", status: "TODO" },
    ];
    expect(() => planCascada(t, { id: "a", nuevo: "DONE" })).not.toThrow();
  });
});

describe("el plan dice de dónde viene cada cambio", () => {
  it("trae el estado anterior, que es de donde sale el XP", () => {
    const t = arbol("p", "p>h1:DONE", "p>h2");
    const plan = planCascada(t, { id: "h2", nuevo: "DONE" });
    const h2 = plan.find((c) => c.id === "h2");
    expect(h2).toEqual({ id: "h2", de: "TODO", a: "DONE" });
  });
});
```

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
cd "/c/PROYECTO JUAMPI"
npx vitest run src/modules/habitos/lib/cascada.test.ts
```

Esperado: **FAIL**, `Cannot find module './cascada'`.

- [x] **Paso 3: Escribir la función**

`src/modules/habitos/lib/cascada.ts`:

```ts
import type { TaskStatus } from "./tasks";

/** Lo único que la cascada necesita saber de una tarea. */
export type FilaCascada = {
  id: string;
  parentId: string | null;
  status: TaskStatus;
};

export type CambioEstado = {
  id: string;
  /** El estado que tenía. De aquí sale el XP. */
  de: TaskStatus;
  a: TaskStatus;
};

/**
 * Decide TODOS los cambios de estado que provoca mover una tarea.
 *
 * Es pura: recibe la lista plana y devuelve la lista de cambios. No toca la
 * base, no mira el reloj y no lanza. Quien la aplica es `updateTaskStatus`.
 *
 * Esa separación es el punto del diseño. La cascada tiene muchos casos de borde
 * —árboles profundos, mezclas de estados, huérfanos, ciclos— y como función
 * pura se prueban todos en milisegundos. Enterrada en una mutación se probarían
 * tres.
 *
 * DOS DIRECCIONES, y no son excluyentes:
 *
 *   abajo — solo al COMPLETAR: los descendientes se cierran con ella.
 *   arriba — siempre: los ancestros se recalculan a partir de sus hijos.
 *
 * La subida es un EVENTO y no una regla permanente. Se recalcula porque algo
 * cambió, no porque el estado deba cumplirse en todo momento. Es lo que permite
 * desmarcar un padre a mano sin que se vuelva a marcar solo al instante.
 */
export function planCascada(
  filas: FilaCascada[],
  cambio: { id: string; nuevo: TaskStatus },
): CambioEstado[] {
  const porId = new Map(filas.map((f) => [f.id, f]));
  const raiz = porId.get(cambio.id);
  if (!raiz) return [];

  const hijosDe = new Map<string, FilaCascada[]>();
  for (const f of filas) {
    if (!f.parentId) continue;
    const l = hijosDe.get(f.parentId);
    if (l) l.push(f);
    else hijosDe.set(f.parentId, [f]);
  }

  /** El estado de cada tarea DESPUÉS de lo decidido hasta ahora. */
  const estado = new Map<string, TaskStatus>();
  const estadoDe = (id: string) =>
    estado.get(id) ?? porId.get(id)?.status ?? "TODO";
  const anotar = (id: string, a: TaskStatus) => estado.set(id, a);

  anotar(cambio.id, cambio.nuevo);

  // ---- Hacia abajo: solo al completar ----
  if (cambio.nuevo === "DONE") {
    // `vistos` no es una optimización: con un ciclo en `parent_id` esto sería
    // un bucle infinito dentro del proceso del servidor.
    const vistos = new Set([cambio.id]);
    const cola = [cambio.id];
    while (cola.length > 0) {
      const actual = cola.pop()!;
      for (const h of hijosDe.get(actual) ?? []) {
        if (vistos.has(h.id)) continue;
        vistos.add(h.id);
        anotar(h.id, "DONE");
        cola.push(h.id);
      }
    }
  }

  // ---- Hacia arriba: siempre ----
  const subidos = new Set<string>([cambio.id]);
  let hijo = raiz;
  while (hijo.parentId) {
    const padre = porId.get(hijo.parentId);
    // Huérfano: el padre no existe. No hay a quién recalcular.
    if (!padre) break;
    // Ciclo.
    if (subidos.has(padre.id)) break;
    subidos.add(padre.id);

    const suyos = hijosDe.get(padre.id) ?? [];
    const toca = estadoPorHijos(suyos.map((h) => estadoDe(h.id)));
    // Si el padre ya estaba como le toca, los de arriba lo ven igual que antes
    // y tampoco pueden cambiar.
    if (toca === estadoDe(padre.id)) break;
    anotar(padre.id, toca);
    hijo = padre;
  }

  const plan: CambioEstado[] = [];
  for (const [id, a] of estado) {
    const de = porId.get(id)?.status ?? "TODO";
    if (de !== a) plan.push({ id, de, a });
  }
  return plan;
}

/** El estado que le toca a un padre según sus hijos DIRECTOS. */
function estadoPorHijos(hijos: TaskStatus[]): TaskStatus {
  if (hijos.length === 0) return "TODO";
  if (hijos.every((s) => s === "DONE")) return "DONE";
  if (hijos.every((s) => s === "TODO")) return "TODO";
  return "IN_PROGRESS";
}
```

- [x] **Paso 4: Verificar**

```bash
npx vitest run src/modules/habitos/lib/cascada.test.ts && npx tsc --noEmit
```

Esperado: **PASS**, 20 afirmaciones.

- [x] **Paso 5: Commit**

```bash
git add src/modules/habitos/lib/cascada.ts src/modules/habitos/lib/cascada.test.ts
git commit -m "feat(tareas): planCascada decide la cascada sin tocar la base"
```

---

### Tarea 2: Aplicar el plan

**Files:**
- Modify: `src/modules/habitos/lib/mutations.ts`
- Modify: `src/modules/habitos/lib/mutations.test.ts`

- [x] **Paso 1: Escribir los tests**

Añade a `src/modules/habitos/lib/mutations.test.ts`, conservando lo que ya hay.
Comprueba primero que `updateTaskStatus` esté en la lista de imports del
archivo; si no, añádelo.

```ts
describe("updateTaskStatus con cascada", () => {
  const T0 = new Date(1700000000000);
  const t = (id: string, parentId: string | null, status = "TODO") => ({
    id,
    title: id,
    status,
    order: 1,
    parentId,
    createdAt: T0,
    updatedAt: T0,
  });

  it("cierra a los descendientes", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h", "p"), t("n", "h")]);

    await updateTaskStatus(db, "p", "DONE");

    const filas = await db.select().from(tasks);
    expect(filas.every((f) => f.status === "DONE")).toBe(true);
  });

  it("les pone fecha de cierre, que es de donde salen las métricas", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h", "p")]);

    await updateTaskStatus(db, "p", "DONE");

    const filas = await db.select().from(tasks);
    expect(filas.every((f) => f.completedAt !== null)).toBe(true);
  });

  it("al reabrir, la fecha de cierre se borra", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h", "p")]);
    await updateTaskStatus(db, "p", "DONE");

    await updateTaskStatus(db, "h", "TODO");

    const [padre] = await db.select().from(tasks).where(eq(tasks.id, "p"));
    expect(padre.status).toBe("TODO");
    expect(padre.completedAt).toBeNull();
  });

  /*
    La razón por la que se eligió dar XP por toda la cascada: el premio no debe
    depender del orden de los clics. Este test es esa frase, comprobada.
  */
  it("da el mismo XP de arriba abajo que de abajo arriba", async () => {
    const abajoArriba = createTestDb();
    await abajoArriba.insert(tasks).values([t("p", null), t("h1", "p"), t("h2", "p")]);
    await updateTaskStatus(abajoArriba, "h1", "DONE");
    const r1 = await updateTaskStatus(abajoArriba, "h2", "DONE");

    const arribaAbajo = createTestDb();
    await arribaAbajo.insert(tasks).values([t("p", null), t("h1", "p"), t("h2", "p")]);
    const r2 = await updateTaskStatus(arribaAbajo, "p", "DONE");

    expect(r1.player.xp).toBe(r2.player.xp);
  });

  it("dice cuántas se movieron", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h1", "p"), t("h2", "p")]);

    const r = await updateTaskStatus(db, "p", "DONE");

    expect(r.cambiadas).toBe(3);
  });

  it("becameDone sigue hablando de la tarea que tocaste", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h", "p")]);

    const r = await updateTaskStatus(db, "h", "DONE");

    expect(r.becameDone).toBe(true);
  });

  it("desmarcar un padre no toca a sus hijos", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([t("p", null), t("h", "p")]);
    await updateTaskStatus(db, "p", "DONE");

    await updateTaskStatus(db, "p", "TODO");

    const [hijo] = await db.select().from(tasks).where(eq(tasks.id, "h"));
    expect(hijo.status).toBe("DONE");
  });
});
```

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/habitos/lib/mutations.test.ts
```

Esperado: **FAIL** en los de cascada; los que ya había siguen pasando.

- [x] **Paso 3: Reescribir `updateTaskStatus`**

Sustituye la función entera en `src/modules/habitos/lib/mutations.ts`:

```ts
export async function updateTaskStatus(
  db: Db,
  taskId: string,
  newStatus: TaskStatus,
): Promise<StatusChangeResult> {
  if (!taskId || !TASK_STATUSES.includes(newStatus)) {
    return emptyStatusChange(db);
  }

  const filas = await db
    .select({
      id: tasks.id,
      parentId: tasks.parentId,
      status: tasks.status,
    })
    .from(tasks);

  const plan = planCascada(
    filas.map((f) => ({
      id: f.id,
      parentId: f.parentId,
      status: (f.status as TaskStatus) ?? "TODO",
    })),
    { id: taskId, nuevo: newStatus },
  );
  if (plan.length === 0) return emptyStatusChange(db);

  const ahora = new Date();
  /*
    Una transacción SÍNCRONA. En better-sqlite3, `db.transaction(cb)` de Drizzle
    devuelve `T` y no `Promise<T>`: dentro va la forma síncrona `.run()`, no
    `await`. Un `async` aquí compila y no espera a nada.

    Los cambios se agrupan por estado destino, así que son como mucho tres
    sentencias. O se escriben las tres o ninguna: un árbol a medio cerrar sería
    peor que no haber tocado nada.
  */
  db.transaction((tx) => {
    for (const destino of TASK_STATUSES) {
      const ids = plan.filter((c) => c.a === destino).map((c) => c.id);
      if (ids.length === 0) continue;
      tx.update(tasks)
        .set({
          status: destino,
          completedAt: destino === "DONE" ? ahora : null,
          updatedAt: ahora,
        })
        .where(inArray(tasks.id, ids))
        .run();
    }
  });

  // El XP sale del CONJUNTO de cambios, no de la tarea que se tocó: así cerrar
  // de arriba abajo y de abajo arriba premian igual.
  const entran = plan.filter((c) => c.a === "DONE").length;
  const salen = plan.filter((c) => c.de === "DONE").length;
  const xpDelta = (entran - salen) * XP_PER_TASK;

  const quests = await syncDailyQuests(db);
  const { oldLevel, player } = await grantXp(db, xpDelta + quests.xpDelta);

  const tocada = plan.find((c) => c.id === taskId);

  return {
    // Sigue hablando de la tarea que TOCASTE: de eso dependen el sonido y el
    // aviso, y anunciar el cierre de un padre que se movió solo confundiría.
    becameDone: tocada?.de !== "DONE" && tocada?.a === "DONE",
    cambiadas: plan.length,
    xpDelta: xpDelta + quests.xpDelta,
    leveledUp: player.level > oldLevel,
    player,
    questsCompleted: quests.completed,
  };
}
```

Amplía el tipo y el vacío, que están más arriba en el mismo archivo:

```ts
export type StatusChangeResult = {
  becameDone: boolean;
  /** Cuántas tareas movió en total, contando la cascada. */
  cambiadas: number;
  xpDelta: number;
  leveledUp: boolean;
  player: PlayerSnapshot;
  questsCompleted: QuestCompletion[];
};
```

En `emptyStatusChange`, añade `cambiadas: 0`.

Y el import, junto a los demás de `./`:

```ts
import { planCascada } from "./cascada";
```

- [x] **Paso 4: `createSubtask`**

`createProjectTask` solo sabe crear dentro de un proyecto. Añade al lado:

```ts
/**
 * Crea una subtarea colgando de otra.
 *
 * HEREDA el proyecto del padre: una subtarea pertenece al mismo proyecto que su
 * madre, o a ninguno. Es lo que permite que el mismo árbol sirva en `/tareas` y
 * en `/proyectos` sin que el componente sepa de proyectos.
 */
export async function createSubtask(db: Db, parentId: string, title: string) {
  const t = title.trim().slice(0, LIMITS.taskTitle);
  if (!parentId || !t) return;

  const [padre] = await db
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, parentId))
    .limit(1);
  if (!padre) return;

  const [last] = await db
    .select({ order: tasks.order })
    .from(tasks)
    .where(eq(tasks.parentId, parentId))
    .orderBy(desc(tasks.order))
    .limit(1);

  const ahora = new Date();
  await db.insert(tasks).values({
    id: crypto.randomUUID(),
    parentId,
    projectId: padre.projectId,
    title: t,
    order: (last?.order ?? 0) + 1,
    status: "TODO",
    createdAt: ahora,
    updatedAt: ahora,
  });
}
```

En `src/modules/habitos/actions.ts`, junto a las demás:

```ts
export async function crearSubtarea(parentId: string, title: string) {
  await m.createSubtask(db, parentId, title);
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
git commit -m "feat(tareas): la cascada se aplica en una transaccion"
```

---

### Tarea 3: El árbol se comparte

**Files:**
- Create: `src/modules/habitos/components/tasks/TaskTree.tsx` (movido)
- Create: `src/modules/habitos/components/tasks/TaskTreeItem.tsx` (movido)
- Delete: `src/modules/habitos/components/projects/ProjectTree.tsx`
- Delete: `src/modules/habitos/components/projects/ProjectTreeItem.tsx`
- Modify: `src/app/proyectos/[id]/page.tsx`

- [x] **Paso 1: Mover con git, para no perder la historia**

```bash
git mv src/modules/habitos/components/projects/ProjectTree.tsx \
       src/modules/habitos/components/tasks/TaskTree.tsx
git mv src/modules/habitos/components/projects/ProjectTreeItem.tsx \
       src/modules/habitos/components/tasks/TaskTreeItem.tsx
```

- [x] **Paso 2: Renombrar y desacoplar de proyectos**

En los dos archivos:

- `ProjectTree` → `TaskTree`, `ProjectTreeItem` → `TaskTreeItem`
- El import de `./ProjectTreeItem` pasa a `./TaskTreeItem`
- `import type { ProjectItemNode, ProjectItemStatus } from ".../lib/projects"`
  pasa a `import type { TaskTreeNode } from ".../lib/tasks"` y
  `import type { TaskStatus } from ".../lib/tasks"`

En `TaskTree`, la prop `projectId` **se queda pero pasa a ser opcional**:

```tsx
export function TaskTree({
  roots,
  projectId,
}: {
  roots: TaskTreeNode<NodoArbol>[];
  /**
   * Si falta, no se ofrece crear en la raíz del árbol. Es lo que hace
   * `/tareas`: ahí la raíz se crea con el botón «Nueva tarea» de la cabecera.
   */
  projectId?: string;
}) {
```

**No la sustituyas por una función `onCrearRaiz`.** `TaskTree` es un componente
de cliente y `/proyectos/[id]/page.tsx` es de servidor: una función anónima
—`(t) => createProjectTask(id, null, t)`— no se puede pasar de uno a otro, no es
serializable. Un `string` sí. Es la razón por la que `projectId` sobrevive.

En `TaskTreeItem`, el «añadir hijo» pasa de `createProjectTask(node.projectId,
node.id, t)` a:

```tsx
      await crearSubtarea(node.id, t);
```

con `import { crearSubtarea } from "@/modules/habitos/actions";`. Así el
componente deja de saber qué es un proyecto.

`deleteProjectItem` se queda con su nombre en `actions.ts`; borra por id y no
sabe de proyectos.

- [x] **Paso 3: El tipo del nodo**

En `src/modules/habitos/lib/tasks.ts`, junto a `TaskTreeNode`:

```ts
/** Lo que el árbol de la interfaz necesita de cada nodo. */
export type NodoArbol = {
  id: string;
  parentId: string | null;
  title: string;
  status: TaskStatus;
  order: number;
  createdAt: Date;
  completedAt: Date | null;
};
```

Y en `lib/projects.ts`, `ProjectItemNode` pasa a `TaskTreeNode<NodoArbol & { projectId: string }>`
para que `/proyectos` siga compilando sin cambiar nada más.

- [x] **Paso 4: `/proyectos` importa de su sitio nuevo**

En `src/app/proyectos/[id]/page.tsx`:

```tsx
import { TaskTree } from "@/modules/habitos/components/tasks/TaskTree";
```

Y donde se monta, pásale el creador de raíz:

```tsx
<TaskTree roots={roots} projectId={id} />
```

- [x] **Paso 5: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
grep -rn "ProjectTree\|ProjectItemNode" src/ || echo "sin restos"
```

- [x] **Paso 6: Commit**

```bash
git add -A src
git commit -m "refactor(tareas): el arbol baja a components/tasks y lo comparten las dos pantallas"
```

---

### Tarea 4: La tarjeta despliega el árbol

**Files:**
- Modify: `src/modules/habitos/lib/tasks.ts`
- Modify: `src/modules/habitos/lib/tasks.test.ts`
- Modify: `src/modules/habitos/components/tasks/TaskCard.tsx`

- [x] **Paso 1: El test**

Añade a `src/modules/habitos/lib/tasks.test.ts`:

```ts
describe("getTasksGrouped trae el árbol de cada raíz", () => {
  const base = {
    title: "x",
    status: "TODO",
    order: 1,
    createdAt: T0,
    updatedAt: T0,
  };

  it("cuelga los descendientes de su raíz", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      { ...base, id: "p" },
      { ...base, id: "h", parentId: "p" },
      { ...base, id: "n", parentId: "h" },
    ]);
    const g = await getTasksGrouped(db);
    expect(g.TODO).toHaveLength(1);
    expect(g.TODO[0].arbol[0].id).toBe("h");
    expect(g.TODO[0].arbol[0].children[0].id).toBe("n");
  });

  it("una tarea sin subtareas trae el árbol vacío", async () => {
    const db = createTestDb();
    await db.insert(tasks).values({ ...base, id: "sola" });
    const g = await getTasksGrouped(db);
    expect(g.TODO[0].arbol).toEqual([]);
  });
});
```

- [x] **Paso 2: Ejecutar y verlo fallar**

```bash
npx vitest run src/modules/habitos/lib/tasks.test.ts
```

- [x] **Paso 3: Añadir el árbol a `TaskRow`**

En `src/modules/habitos/lib/tasks.ts`, amplía el tipo:

```ts
  /** Cuántas subtareas cuelgan de ella y cuántas están hechas. */
  hijos: { total: number; hechos: number };
  /** Sus descendientes, ya anidados. Vacío si no tiene. */
  arbol: TaskTreeNode<NodoArbol>[];
```

Y dentro de `getTasksGrouped`, antes del bucle que agrupa:

```ts
  // El árbol se monta UNA vez sobre todas las filas y después se reparte. Con
  // `buildTaskTree` por raíz habría que recorrer la lista entera una vez por
  // tarjeta.
  const nodos: NodoArbol[] = all.map((t) => ({
    id: t.id,
    parentId: t.parentId,
    title: t.title,
    status: (t.status as TaskStatus) ?? "TODO",
    order: t.order,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
  }));
  const arbolPorRaiz = new Map(
    buildTaskTree(nodos).map((r) => [r.id, r.children]),
  );
```

Y en el objeto que se empuja, `arbol: arbolPorRaiz.get(t.id) ?? []`.

- [x] **Paso 4: La tarjeta**

En `TaskCard.tsx`, sustituye la línea del resumen de hijos por un botón que
despliega:

```tsx
      {task.hijos.total > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
            className="mt-1.5 text-[11.5px] text-tinta font-cuerpo underline cursor-pointer bg-transparent border-0 p-0 text-left"
          >
            {abierto ? "▾" : "▸"} {task.hijos.total} subtarea
            {task.hijos.total === 1 ? "" : "s"} · {task.hijos.hechos} hecha
            {task.hijos.hechos === 1 ? "" : "s"}
          </button>
          {abierto ? (
            <div style={{ marginTop: 8 }}>
              <TaskTree roots={task.arbol} />
            </div>
          ) : null}
        </>
      ) : null}
```

Con `const [abierto, setAbierto] = useState(false);` arriba y los imports de
`useState` y `TaskTree`.

> El resumen sigue siendo el rótulo del botón: plegada, la tarjeta dice lo
> mismo que decía antes.

- [x] **Paso 5: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [x] **Paso 6: Commit**

```bash
git add -A src
git commit -m "feat(tareas): la tarjeta despliega su arbol de subtareas"
```

---

### Tarea 4b: Sin esto no se podía crear la primera subtarea

Encontrado al ir a verificar, y era una pescadilla que se muerde la cola: la
tarjeta solo abría el árbol si `hijos.total > 0`, y el «añadir» del árbol estaba
atado a tener `projectId`. Desde `/tareas` no había forma de crear la PRIMERA
subtarea de nada: la única puerta al árbol era tener ya un árbol.

- [x] `TaskTree` acepta también `parentId`: el formulario de la raíz cuelga de
      la tarjeta en vez de del proyecto
- [x] El botón de la tarjeta sale SIEMPRE, con hijos o sin ellos. Sin hijos dice
      «Subtareas»; con ellos, el mismo resumen de antes

---

### Tarea 5: Verificación final

- [x] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [x] **Paso 2: Que no queden restos del nombre viejo**

```bash
grep -rn "ProjectTree\|ProjectItemNode\|createProjectTask" src/ | grep -v projects/ || echo "sin restos"
```

- [x] **Paso 3: En pantalla, en `/tareas`**

1. Crea una tarea con dos subtareas.
2. Despliega la tarjeta y marca una: el padre debe ponerse **en proceso**.
3. Marca la otra: el padre debe ponerse **hecha** y tacharse.
4. Desmarca el padre: **las subtareas deben seguir hechas**.
5. Desmarca una subtarea: el padre vuelve a **en proceso**.

El paso 4 es el que comprueba la resolución de la contradicción del spec.

- [x] **Paso 4: Que el XP no dependa del orden**

Comprobado con el test de `mutations.test.ts`, que monta las dos rutas sobre dos
bases limpias y exige el mismo XP, y NO repitiéndolo a mano en la base real:
reabrir y volver a cerrar mueve el XP y las misiones del día del usuario.

Lo que sí se midió en vivo, sobre un árbol de prueba propio: cerrar las dos
subtareas subió el XP 45, tres tareas por quince. Desmarcar el padre a mano bajó
quince, solo el suyo. Y reabrir una subtarea bajó otros quince.

**Aviso:** borrar una tarea que estaba hecha NO devuelve su XP —es el
comportamiento que ya había—, así que verificar en la base real la deja algo más
alta que al empezar. Con un árbol de prueba de tres, quince puntos.

- [x] **Paso 5: Que `/proyectos` siga igual**

Despliega un proyecto, añade una subtarea, renómbrala, márcala y bórrala. Nada
de eso debería haber cambiado.

- [x] **Paso 6: Marcar el plan y el spec**

Marca las casillas y anota cualquier desvío con su motivo.

---

## Criterios de aceptación

- [x] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [x] 2. Marcar un padre cierra todos sus descendientes, a cualquier profundidad
- [x] 3. Cerrar la última subtarea cierra al padre; reabrir una lo reabre
- [x] 4. Con hijos a medias, el padre queda en proceso
- [x] 5. Desmarcar un padre a mano NO toca a sus hijos
- [x] 6. El XP de una cascada es el mismo que hacerlo tarea a tarea
- [x] 7. Un ciclo en `parent_id` no cuelga
- [x] 8. Los cambios se escriben en una sola transacción
- [x] 9. `/tareas` despliega el árbol desde la tarjeta
- [x] 10. `/proyectos` sigue funcionando y sus tests siguen pasando
- [x] 11. Ninguna columna nueva y ninguna migración
