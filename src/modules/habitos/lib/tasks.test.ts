import { describe, it, expect } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { taskCategories, tasks } from "@/modules/habitos/schema";
import {
  getTasksGrouped,
  getTaskMetrics,
  FLOW_WEEKS,
  buildTaskTree,
  parseTaskFilter,
  contarFacetas,
  SIN_FILTRO,
  getTask,
} from "./tasks";

const T0 = new Date("2026-07-01T12:00:00Z");

type Seed = {
  id: string;
  status?: string;
  order?: number;
  createdAt?: Date;
  completedAt?: Date | null;
};

function makeTask({
  id,
  status = "TODO",
  order = 0,
  createdAt = T0,
  completedAt = null,
}: Seed) {
  return {
    id,
    title: `tarea ${id}`,
    status,
    order,
    createdAt,
    updatedAt: createdAt,
    completedAt,
  };
}

describe("getTasksGrouped", () => {
  it("reparte por estado en las tres columnas", async () => {
    const db = createTestDb();
    await db
      .insert(tasks)
      .values([
        makeTask({ id: "a", status: "TODO" }),
        makeTask({ id: "b", status: "IN_PROGRESS" }),
        makeTask({ id: "c", status: "DONE" }),
      ]);

    const g = await getTasksGrouped(db);

    expect(g.TODO.map((t) => t.id)).toEqual(["a"]);
    expect(g.IN_PROGRESS.map((t) => t.id)).toEqual(["b"]);
    expect(g.DONE.map((t) => t.id)).toEqual(["c"]);
  });

  it("ordena por order y desempata por fecha de creación", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      makeTask({ id: "tarde", order: 1, createdAt: new Date("2026-07-02") }),
      makeTask({
        id: "primera",
        order: 0,
        createdAt: new Date("2026-07-03"),
      }),
      makeTask({ id: "empate", order: 1, createdAt: new Date("2026-07-01") }),
    ]);

    const g = await getTasksGrouped(db);

    // order asc primero; con order igual, la más antigua va antes.
    expect(g.TODO.map((t) => t.id)).toEqual(["primera", "empate", "tarde"]);
  });

  it("devuelve las tres claves aunque no haya tareas", async () => {
    const g = await getTasksGrouped(createTestDb());

    expect(g.TODO).toEqual([]);
    expect(g.IN_PROGRESS).toEqual([]);
    expect(g.DONE).toEqual([]);
  });
});

describe("getTaskMetrics", () => {
  it("no revienta con la base vacía", async () => {
    const m = await getTaskMetrics(createTestDb());

    expect(m.weeks).toHaveLength(FLOW_WEEKS);
    expect(m.medianLifetime).toBeNull();
    expect(m.oldestOpen).toBeNull();
  });

  it("cuenta como cerrada solo la que tiene completedAt", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      // DONE pero sin completedAt: no debe entrar en el cálculo de vida.
      makeTask({ id: "sin-fecha", status: "DONE", completedAt: null }),
      makeTask({
        id: "cerrada",
        status: "DONE",
        createdAt: new Date("2026-07-01T00:00:00Z"),
        completedAt: new Date("2026-07-05T00:00:00Z"),
      }),
    ]);

    const m = await getTaskMetrics(db);

    // Una sola cerrada, de 4 días de vida: la mediana es 4.
    expect(m.medianLifetime).toBe(4);
  });

  it("considera abierta cualquiera que no esté en DONE", async () => {
    const db = createTestDb();
    await db
      .insert(tasks)
      .values([
        makeTask({ id: "abierta", status: "TODO", createdAt: T0 }),
        makeTask({ id: "curso", status: "IN_PROGRESS", createdAt: T0 }),
        makeTask({ id: "cerrada", status: "DONE", completedAt: T0 }),
      ]);

    const m = await getTaskMetrics(db);

    // Hay abiertas, así que oldestOpen tiene valor (no null).
    expect(m.oldestOpen).not.toBeNull();
  });
});

// ---------- El árbol y el filtro ----------

function nodo(id: string, parentId: string | null) {
  return { id, parentId, title: id };
}

describe("buildTaskTree", () => {
  it("cuelga cada hijo de su padre", () => {
    const raices = buildTaskTree([
      nodo("a", null),
      nodo("b", "a"),
      nodo("c", "b"),
    ]);
    expect(raices).toHaveLength(1);
    expect(raices[0].children[0].id).toBe("b");
    expect(raices[0].children[0].children[0].id).toBe("c");
  });

  /*
    En la base que se pone al día, `parent_id` no tiene clave foránea: SQLite no
    admite añadirla con ALTER TABLE. Así que un padre que no existe es un estado
    POSIBLE, y el árbol tiene que aguantarlo enseñando el huérfano como raíz en
    vez de tragárselo.
  */
  it("un hijo cuyo padre no existe sale como raíz, no desaparece", () => {
    const raices = buildTaskTree([
      nodo("a", null),
      nodo("huerfano", "fantasma"),
    ]);
    expect(raices.map((r) => r.id).sort()).toEqual(["a", "huerfano"]);
  });

  it("con la lista vacía devuelve una lista vacía", () => {
    expect(buildTaskTree([])).toEqual([]);
  });
});

describe("parseTaskFilter", () => {
  it("lee la categoría y la prioridad de la URL", () => {
    expect(parseTaskFilter({ cat: "c1", pri: "URGENT" })).toEqual({
      categoriaIds: ["c1"],
      prioridades: ["URGENT"],
    });
  });

  it("sin parámetros no filtra nada", () => {
    expect(parseTaskFilter({})).toEqual({ categoriaIds: [], prioridades: [] });
  });

  /*
    Una prioridad inventada en la URL no debe filtrar por algo que no existe y
    dejar el tablero vacío sin explicación: se ignora.
  */
  it("una prioridad que no existe se ignora", () => {
    expect(parseTaskFilter({ pri: "CRITICAL" }).prioridades).toEqual([]);
  });

  it("un parámetro repetido filtra por TODOS, no por el primero", () => {
    /*
      Cambió a propósito: dentro de un grupo los filtros suman (O), que es el
      estándar del filtrado por facetas. Antes se quedaba con el primero y no
      había forma de pedir «Ocio o Casa».
    */
    expect(parseTaskFilter({ cat: ["c1", "c2"] }).categoriaIds).toEqual([
      "c1",
      "c2",
    ]);
  });

  it("también acepta la forma separada por comas, que es la que genera la barra", () => {
    expect(parseTaskFilter({ cat: "c1,c2" }).categoriaIds).toEqual([
      "c1",
      "c2",
    ]);
    expect(parseTaskFilter({ pri: "URGENT,LOW" }).prioridades).toEqual([
      "URGENT",
      "LOW",
    ]);
  });

  it("descarta vacíos y repetidos", () => {
    // `?cat=a,,a` no debe filtrar dos veces por lo mismo ni por la nada.
    expect(parseTaskFilter({ cat: "a,,a" }).categoriaIds).toEqual(["a"]);
  });

  it("sin parámetros, no filtra nada", () => {
    expect(parseTaskFilter({})).toEqual({ categoriaIds: [], prioridades: [] });
  });
});

describe("getTasksGrouped con árbol y filtro", () => {
  const base = {
    title: "x",
    status: "TODO",
    order: 1,
    createdAt: T0,
    updatedAt: T0,
  };

  /*
    Si el tablero devolviera TODO, al unificar habrían aparecido de golpe como
    tarjetas sueltas los elementos anidados de los proyectos, descolgados de su
    contexto.
  */
  it("solo devuelve las raíces", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      { ...base, id: "padre", parentId: null },
      { ...base, id: "hijo", parentId: "padre" },
    ]);
    const g = await getTasksGrouped(db);
    expect(g.TODO.map((t) => t.id)).toEqual(["padre"]);
  });

  it("cuenta las subtareas de cada raíz y cuántas están hechas", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      { ...base, id: "padre", parentId: null },
      { ...base, id: "h1", parentId: "padre" },
      { ...base, id: "h2", parentId: "padre", status: "DONE" },
    ]);
    const g = await getTasksGrouped(db);
    expect(g.TODO[0].hijos).toEqual({ total: 2, hechos: 1 });
  });

  it("filtra por prioridad", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      { ...base, id: "u", priority: "URGENT" },
      { ...base, id: "b", priority: "LOW" },
      { ...base, id: "sin", priority: null },
    ]);
    const g = await getTasksGrouped(db, {
      categoriaIds: [],
      prioridades: ["URGENT"],
    });
    expect(g.TODO.map((t) => t.id)).toEqual(["u"]);
  });

  it("filtra por categoría", async () => {
    const db = createTestDb();
    // Las categorías van primero: en una base nueva `category_id` SÍ tiene
    // clave foránea y SQLite rechaza una tarea que apunte a una que no existe.
    await db.insert(taskCategories).values([
      { id: "c1", name: "Casa", color: "pink", createdAt: T0 },
      { id: "c2", name: "Trabajo", color: "sky", createdAt: T0 },
    ]);
    await db.insert(tasks).values([
      { ...base, id: "casa", categoryId: "c1" },
      { ...base, id: "otra", categoryId: "c2" },
    ]);
    const g = await getTasksGrouped(db, {
      categoriaIds: ["c1"],
      prioridades: [],
    });
    expect(g.TODO.map((t) => t.id)).toEqual(["casa"]);
  });

  /*
    «3 subtareas» es una propiedad de la tarea, no del filtro que tengas puesto:
    si el conteo se hiciera sobre las filas ya filtradas, poner un filtro haría
    que a una tarea le "desaparecieran" hijos que siguen existiendo.
  */
  it("el conteo de hijos no lo altera el filtro", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      { ...base, id: "padre", priority: "URGENT" },
      { ...base, id: "h1", parentId: "padre", priority: "LOW" },
    ]);
    const g = await getTasksGrouped(db, {
      categoriaIds: [],
      prioridades: ["URGENT"],
    });
    expect(g.TODO[0].hijos).toEqual({ total: 1, hechos: 0 });
  });

  it("una prioridad corrupta en la base se lee como sin prioridad", async () => {
    const db = createTestDb();
    await db.insert(tasks).values({ ...base, id: "t", priority: "CRITICAL" });
    const g = await getTasksGrouped(db);
    expect(g.TODO[0].priority).toBeNull();
  });
});

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

describe("getTask", () => {
  const base = {
    title: "x",
    status: "TODO",
    order: 1,
    createdAt: T0,
    updatedAt: T0,
  };

  it("devuelve null si no existe", async () => {
    expect(await getTask(createTestDb(), "fantasma")).toBeNull();
  });

  it("trae la rama de una raíz", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      { ...base, id: "p" },
      { ...base, id: "h", parentId: "p" },
      { ...base, id: "n", parentId: "h" },
    ]);
    const t = await getTask(db, "p");
    expect(t!.arbol[0].id).toBe("h");
    expect(t!.arbol[0].children[0].id).toBe("n");
  });

  /*
    El caso que rompía un diseño de dos caminos: una SUBTAREA no es raíz del
    árbol global, así que buscarla en el mapa de raíces no la encontraba y su
    detalle habría salido sin subtareas.
  */
  it("trae la rama de una subtarea, que no es raíz del árbol global", async () => {
    const db = createTestDb();
    await db.insert(tasks).values([
      { ...base, id: "p" },
      { ...base, id: "h", parentId: "p" },
      { ...base, id: "n", parentId: "h" },
    ]);
    const t = await getTask(db, "h");
    expect(t!.arbol).toHaveLength(1);
    expect(t!.arbol[0].id).toBe("n");
  });

  it("una hoja trae el árbol vacío", async () => {
    const db = createTestDb();
    await db.insert(tasks).values({ ...base, id: "sola" });
    expect((await getTask(db, "sola"))!.arbol).toEqual([]);
  });

  it("trae la prioridad resuelta y no el texto crudo", async () => {
    const db = createTestDb();
    await db.insert(tasks).values({ ...base, id: "t", priority: "CRITICAL" });
    expect((await getTask(db, "t"))!.priority).toBeNull();
  });
});

describe("contarFacetas", () => {
  const t = (
    id: string,
    categoryId: string | null,
    priority: string | null,
    parentId: string | null = null,
  ) => ({ id, parentId, categoryId, priority });

  const filas = [
    t("1", "ocio", "URGENT"),
    t("2", "ocio", "LOW"),
    t("3", "casa", "URGENT"),
    t("4", null, null),
    t("5", "ocio", "URGENT", "1"), // subtarea: NO se cuenta
  ];

  it("cuenta solo las raíces, que es lo que enseña el tablero", () => {
    const c = contarFacetas(filas, SIN_FILTRO);
    expect(c.categorias).toEqual({ ocio: 2, casa: 1 });
    expect(c.prioridades).toEqual({ URGENT: 2, LOW: 1 });
    expect(c.sinCategoria).toBe(1);
  });

  it("CADA GRUPO SE CUENTA IGNORÁNDOSE A SÍ MISMO", () => {
    /*
      Es la decisión que hace útiles los números. Con «ocio» puesto, la cuenta de
      «casa» debe decir cuántas verías si la marcas —1—, no cuántas ves ahora,
      que sería 0 para todo lo no seleccionado y el número no serviría de nada.
    */
    const c = contarFacetas(filas, { categoriaIds: ["ocio"], prioridades: [] });
    expect(c.categorias).toEqual({ ocio: 2, casa: 1 });
    // La prioridad SÍ se cuenta con el filtro de categoría puesto.
    expect(c.prioridades).toEqual({ URGENT: 1, LOW: 1 });
  });

  it("y al revés: la categoría se cuenta con la prioridad puesta", () => {
    const c = contarFacetas(filas, {
      categoriaIds: [],
      prioridades: ["URGENT"],
    });
    expect(c.categorias).toEqual({ ocio: 1, casa: 1 });
    expect(c.prioridades).toEqual({ URGENT: 2, LOW: 1 });
  });

  it("una huérfana cuenta como raíz", () => {
    // Misma política que el tablero: si su padre no existe, no se pierde.
    const c = contarFacetas([t("9", "ocio", null, "fantasma")], SIN_FILTRO);
    expect(c.categorias).toEqual({ ocio: 1 });
  });

  it("sin tareas no inventa ceros", () => {
    expect(contarFacetas([], SIN_FILTRO)).toEqual({
      categorias: {},
      prioridades: {},
      sinCategoria: 0,
    });
  });
});
