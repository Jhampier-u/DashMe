import { describe, expect, it } from "vitest";
import { createTestDb } from "@/modules/core/db/testing";
import { tasks } from "@/modules/habitos/schema";
import {
  createCategoria,
  deleteCategoria,
  listCategorias,
  renameCategoria,
  resolveCategoriaColor,
} from "./categorias";

async function conCategoria(nombre = "Casa", color = "pink") {
  const db = createTestDb();
  const r = await createCategoria(db, nombre, color);
  if (!r.ok) throw new Error(`no se creó: ${r.motivo}`);
  return { db, id: r.id };
}

const T0 = new Date(1700000000000);

describe("createCategoria", () => {
  it("la crea y la devuelve la lista", async () => {
    const { db } = await conCategoria();
    const lista = await listCategorias(db);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      name: "Casa",
      color: "pink",
      taskCount: 0,
    });
  });

  it("rechaza un nombre vacío", async () => {
    const db = createTestDb();
    expect(await createCategoria(db, "   ", "pink")).toEqual({
      ok: false,
      motivo: "vacio",
    });
  });

  /*
    Se comprueba en el código ADEMÁS del índice único de SQLite. El índice es la
    garantía; esto es lo que permite decir «ya existe» en vez de reventar con
    una excepción del motor a la cara del usuario.
  */
  it("rechaza una repetida sin mirar mayúsculas", async () => {
    const { db } = await conCategoria("Casa");
    expect(await createCategoria(db, "casa", "mint")).toEqual({
      ok: false,
      motivo: "repetida",
    });
    expect(await listCategorias(db)).toHaveLength(1);
  });

  it("un color que no está en la paleta cae al de por defecto", async () => {
    const db = createTestDb();
    const r = await createCategoria(db, "Casa", "chartreuse");
    expect(r.ok).toBe(true);
    expect((await listCategorias(db))[0].color).toBe("pink");
  });
});

describe("listCategorias", () => {
  it("cuenta cuántas tareas usan cada una", async () => {
    const { db, id } = await conCategoria();
    await db.insert(tasks).values([
      {
        id: "t1",
        title: "A",
        categoryId: id,
        order: 1,
        status: "TODO",
        createdAt: T0,
        updatedAt: T0,
      },
      {
        id: "t2",
        title: "B",
        categoryId: id,
        order: 2,
        status: "DONE",
        createdAt: T0,
        updatedAt: T0,
      },
      {
        id: "t3",
        title: "C",
        categoryId: null,
        order: 3,
        status: "TODO",
        createdAt: T0,
        updatedAt: T0,
      },
    ]);
    expect((await listCategorias(db))[0].taskCount).toBe(2);
  });
});

describe("deleteCategoria", () => {
  /*
    Lo importante de este test no es que la categoría desaparezca, es que la
    TAREA sobreviva. Borrar una etiqueta no puede llevarse trabajo por delante.
  */
  it("deja vivas sus tareas, sin categoría", async () => {
    const { db, id } = await conCategoria();
    await db.insert(tasks).values({
      id: "t1",
      title: "A",
      categoryId: id,
      order: 1,
      status: "TODO",
      createdAt: T0,
      updatedAt: T0,
    });
    await deleteCategoria(db, id);
    expect(await listCategorias(db)).toHaveLength(0);
    const [t] = await db.select().from(tasks);
    expect(t.title).toBe("A");
    expect(t.categoryId).toBeNull();
  });
});

describe("renameCategoria", () => {
  it("cambia el nombre", async () => {
    const { db, id } = await conCategoria();
    await renameCategoria(db, id, "Hogar");
    expect((await listCategorias(db))[0].name).toBe("Hogar");
  });

  it("no deja chocar con otra que ya existe", async () => {
    const { db, id } = await conCategoria("Casa");
    await createCategoria(db, "Trabajo", "sky");
    expect(await renameCategoria(db, id, "trabajo")).toEqual({
      ok: false,
      motivo: "repetida",
    });
    expect((await listCategorias(db)).map((c) => c.name).sort()).toEqual([
      "Casa",
      "Trabajo",
    ]);
  });

  it("renombrarse a sí misma no choca consigo misma", async () => {
    const { db, id } = await conCategoria("Casa");
    expect(await renameCategoria(db, id, "CASA")).toMatchObject({ ok: true });
    expect((await listCategorias(db))[0].name).toBe("CASA");
  });
});

describe("resolveCategoriaColor", () => {
  it("deja pasar las claves de la paleta", () => {
    expect(resolveCategoriaColor("acid")).toBe("acid");
    expect(resolveCategoriaColor("lav")).toBe("lav");
  });

  it("cualquier otra cosa cae al color por defecto", () => {
    expect(resolveCategoriaColor("violet")).toBe("pink");
    expect(resolveCategoriaColor("")).toBe("pink");
  });
});
