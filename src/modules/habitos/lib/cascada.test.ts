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
    const t = arbol(
      "a:IN_PROGRESS",
      "a>b:IN_PROGRESS",
      "a>b>c",
      "a>b>c2:DONE",
      "a>x",
    );
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
    expect(planCascada(arbol("a"), { id: "fantasma", nuevo: "DONE" })).toEqual(
      [],
    );
  });

  it("cambiar al estado que ya tiene no cambia nada", () => {
    expect(planCascada(arbol("a:DONE"), { id: "a", nuevo: "DONE" })).toEqual(
      [],
    );
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
