import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { createTestDb } from "@/modules/core/db/testing";
import * as esquema from "@/modules/core/db/schema";
import { exportarTodo, importarTodo, contarTodo } from "./exportar";

/*
  El fichero de VERDAD, descargado del servidor de producción en el 3100 y
  restaurado en una base limpia. No un objeto en memoria: el JSON tal cual lo
  recibe el navegador.

  Es la única prueba que responde a la pregunta que importa — «si mañana pierdo
  la base, ¿esto me la devuelve?» — y esa pregunta ya se hizo sola una vez en
  este proyecto.
*/
/*
  SE SALTA si el fichero no está, porque el volcado lleva datos reales y este
  repositorio es público. Para correrlo, con el servidor levantado:

    curl -s http://127.0.0.1:3100/api/exportar -o volcado.tmp.json
    npx vitest run src/modules/habitos/lib/restauracion.test.ts

  y bórralo después. Los tests que SÍ corren siempre son los de
  «cruzando el fichero de verdad», con datos inventados.
*/
describe("restaurar un volcado real", () => {
  const RUTA = "volcado.tmp.json";

  it.skipIf(!fs.existsSync(RUTA))("devuelve la base entera", async () => {
    const volcado = JSON.parse(fs.readFileSync(RUTA, "utf8"));
    const db = createTestDb();
    await importarTodo(db, volcado);

    expect(await contarTodo(db)).toEqual(volcado.recuento);

    const habitos = await db.select().from(esquema.habits);
    expect(habitos.length).toBe(volcado.recuento.habits);
    for (const h of habitos) expect(h.createdAt).toBeInstanceOf(Date);

    // Y lo que sale de la base restaurada es idéntico al fichero de partida.
    const devuelta = JSON.parse(JSON.stringify(await exportarTodo(db)));
    expect(devuelta.tablas).toEqual(volcado.tablas);
  });
});
