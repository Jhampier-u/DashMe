import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "@/modules/core/db/schema-sql";
import { copiarTablas, TABLAS_A_MIGRAR } from "../scripts/migrar-ledger.mjs";

const temporales: string[] = [];

/**
 * `@types/better-sqlite3` declara `get()` como `unknown` y el script es `.mjs`
 * sin `checkJs`, así que TypeScript infiere `{}` para el objeto de conteos.
 * Estos dos ayudantes son puramente de tipos: no cambian ni una consulta ni
 * una expectativa, solo evitan que `tsc --noEmit` falle en el test.
 */
function conteo(db: Database.Database, tabla: string): number {
  return (db.prepare(`select count(*) c from ${tabla}`).get() as { c: number })
    .c;
}

function conteos(valor: unknown): Record<string, number> {
  return valor as Record<string, number>;
}

function baseTemporal(nombre: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-test-"));
  const ruta = path.join(dir, nombre);
  const db = new Database(ruta);
  db.exec(SCHEMA_SQL);
  db.close();
  temporales.push(dir);
  return ruta;
}

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("copiarTablas", () => {
  it("copia todas las filas y devuelve los conteos", () => {
    const origen = baseTemporal("origen.db");
    const destino = baseTemporal("destino.db");

    const o = new Database(origen);
    const insertar = o.prepare(
      "insert into streams (ts, ms_played, track_uri, track_name, artist_name, track_key, artist_key, local_date, local_hour, source, dedup_key) values (?,?,?,?,?,?,?,?,?,?,?)",
    );
    /*
      Las 500 inserciones van dentro de una transacción.

      Sueltas, cada `run()` confirma por su cuenta y sincroniza a disco: 500
      fsync que tardaban unos cinco segundos y hacían que este test rozara el
      límite por defecto de vitest. Fallaba de forma intermitente según lo
      ocupado que estuviera el disco, y no por nada que tuviera que ver con lo
      que comprueba.

      Se siguen insertando las mismas 500 filas y se sigue afirmando lo mismo;
      solo se confirman de una vez.
    */
    o.transaction(() => {
      for (let i = 0; i < 500; i++) {
        insertar.run(
          1600000000000 + i,
          1000,
          `spotify:track:${i}`,
          `Canción ${i}`,
          "Artista",
          `cancion-${i}`,
          "artista",
          "2020-09-13",
          12,
          "import",
          `k${i}`,
        );
      }
    })();
    o.close();

    const resultado = conteos(copiarTablas(origen, destino));

    expect(resultado.streams).toBe(500);
    const d = new Database(destino, { readonly: true });
    expect(conteo(d, "streams")).toBe(500);
    d.close();
  });

  it("no toca la base de origen", () => {
    const origen = baseTemporal("origen.db");
    const destino = baseTemporal("destino.db");
    const o = new Database(origen);
    o.prepare(
      "insert into streams (ts, ms_played, track_uri, track_name, artist_name, track_key, artist_key, local_date, local_hour, source, dedup_key) values (?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      1600000000000,
      1000,
      "spotify:track:a",
      "A",
      "Artista",
      "a",
      "artista",
      "2020-09-13",
      12,
      "import",
      "ka",
    );
    o.close();

    const antes = fs.statSync(origen).mtimeMs;
    copiarTablas(origen, destino);

    const o2 = new Database(origen, { readonly: true });
    expect(conteo(o2, "streams")).toBe(1);
    o2.close();
    expect(fs.statSync(origen).mtimeMs).toBe(antes);
  });

  it("es idempotente: repetirla no duplica", () => {
    const origen = baseTemporal("origen.db");
    const destino = baseTemporal("destino.db");
    const o = new Database(origen);
    o.prepare(
      "insert into streams (ts, ms_played, track_uri, track_name, artist_name, track_key, artist_key, local_date, local_hour, source, dedup_key) values (?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      1600000000000,
      1000,
      "spotify:track:a",
      "A",
      "Artista",
      "a",
      "artista",
      "2020-09-13",
      12,
      "import",
      "ka",
    );
    o.close();

    copiarTablas(origen, destino);
    copiarTablas(origen, destino);

    const d = new Database(destino, { readonly: true });
    expect(conteo(d, "streams")).toBe(1);
    d.close();
  });

  it("deja el destino intacto si una tabla falla", () => {
    const origen = baseTemporal("origen.db");
    const destino = baseTemporal("destino.db");
    // Origen sin la tabla `streams`: el ATTACH la encuentra pero el SELECT no.
    const o = new Database(origen);
    o.exec("drop table streams");
    o.close();

    expect(() => copiarTablas(origen, destino)).toThrow();

    const d = new Database(destino, { readonly: true });
    // La transacción no se confirmó: el resto de tablas siguen vacías.
    expect(conteo(d, "import_batches")).toBe(0);
    d.close();
  });

  it("declara las cinco tablas con datos y ninguna más", () => {
    expect(TABLAS_A_MIGRAR).toEqual([
      "streams",
      "import_batches",
      "artist_genres",
      "top_snapshots",
      "capture_state",
    ]);
    // spotify_credentials queda fuera: son tokens que caducan y se regeneran
    // al iniciar sesión. Migrar uno muerto solo confunde al depurar.
    expect(TABLAS_A_MIGRAR).not.toContain("spotify_credentials");
  });
});
