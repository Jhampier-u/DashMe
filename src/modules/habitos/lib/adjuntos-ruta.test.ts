import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  LIMITE_BYTES,
  esNombreEnDisco,
  nuevoNombreEnDisco,
  rutaDeAdjunto,
  validarEnlace,
  validarSubida,
} from "./adjuntos-ruta";

/** Absoluta a propósito: `path.join("C:", …)` daría una ruta relativa al disco. */
const BASE = path.resolve("C:/datos/adjuntos");

describe("nuevoNombreEnDisco", () => {
  it("no se parece al nombre original", () => {
    const n = nuevoNombreEnDisco();
    expect(n).not.toContain("factura");
    expect(esNombreEnDisco(n)).toBe(true);
  });

  /*
    Sin extensión, a propósito. No hace falta —el tipo va en `mime` y el nombre
    de la descarga en `name`— y pegar la del usuario reabriría la puerta que
    esto cierra.
  */
  it("no lleva extensión", () => {
    expect(path.extname(nuevoNombreEnDisco())).toBe("");
  });

  it("no repite", () => {
    const n = new Set(Array.from({ length: 200 }, () => nuevoNombreEnDisco()));
    expect(n.size).toBe(200);
  });
});

describe("esNombreEnDisco", () => {
  it("acepta un UUID", () => {
    expect(esNombreEnDisco("0c5fd419-f19e-403f-9da9-ad7144175d54")).toBe(true);
  });

  /*
    Es una LISTA BLANCA y no una búsqueda de `..`. Buscar lo malo siempre se
    queda corto —codificaciones, barras de Windows, nombres raros de NTFS—;
    exigir la forma exacta de un UUID no.
  */
  it("rechaza cualquier cosa que no lo sea", () => {
    for (const malo of [
      "..",
      "../../data/juampi.db",
      "..\\..\\data\\juampi.db",
      "%2e%2e%2f",
      "0c5fd419-f19e-403f-9da9-ad7144175d54.exe",
      "0c5fd419-f19e-403f-9da9-ad7144175d54/../x",
      "",
      "aaaa",
      "0C5FD419-F19E-403F-9DA9-AD7144175D5",
    ]) {
      expect(esNombreEnDisco(malo), malo).toBe(false);
    }
  });
});

describe("rutaDeAdjunto", () => {
  it("compone la ruta dentro de la carpeta", () => {
    const r = rutaDeAdjunto("0c5fd419-f19e-403f-9da9-ad7144175d54", BASE);
    expect(r).toBe(path.join(BASE, "0c5fd419-f19e-403f-9da9-ad7144175d54"));
  });

  /*
    EL CASO QUE IMPORTA. Sin esto, `/api/adjunto/../../data/juampi.db`
    descargaría la base entera, con el histórico de música y todo lo demás.
  */
  it("devuelve null ante cualquier intento de salirse", () => {
    expect(rutaDeAdjunto("../../data/juampi.db", BASE)).toBeNull();
    expect(rutaDeAdjunto("..", BASE)).toBeNull();
    expect(rutaDeAdjunto("a/b", BASE)).toBeNull();
  });

  it("la ruta que devuelve nunca se sale de la carpeta", () => {
    const r = rutaDeAdjunto(nuevoNombreEnDisco(), BASE);
    expect(r).not.toBeNull();
    expect(path.resolve(r!).startsWith(path.resolve(BASE))).toBe(true);
  });
});

describe("validarSubida", () => {
  it("acepta un archivo normal", () => {
    expect(validarSubida({ name: "factura.pdf", size: 1024 })).toEqual({
      ok: true,
    });
  });

  it("rechaza uno vacío", () => {
    expect(validarSubida({ name: "x", size: 0 })).toEqual({
      ok: false,
      motivo: "vacio",
    });
  });

  it("rechaza uno que pasa del tope", () => {
    expect(validarSubida({ name: "x", size: LIMITE_BYTES + 1 })).toEqual({
      ok: false,
      motivo: "grande",
    });
  });

  it("acepta uno justo en el tope", () => {
    expect(validarSubida({ name: "x", size: LIMITE_BYTES }).ok).toBe(true);
  });

  it("rechaza uno sin nombre", () => {
    expect(validarSubida({ name: "   ", size: 10 })).toEqual({
      ok: false,
      motivo: "sin-nombre",
    });
  });

  /*
    El tope del código y el de `next.config.ts` tienen que cuadrar, y el de Next
    va un poco por encima para los bordes de `multipart`. Si alguien sube uno y
    no el otro, el fallo aparece solo con archivos grandes.
  */
  it("el tope son 50 MB", () => {
    expect(LIMITE_BYTES).toBe(50 * 1024 * 1024);
  });
});

describe("validarEnlace", () => {
  it("acepta http y https", () => {
    expect(validarEnlace("https://ejemplo.com/x").ok).toBe(true);
    expect(validarEnlace("http://ejemplo.com").ok).toBe(true);
  });

  /*
    UN `javascript:` GUARDADO Y PINTADO EN UN href ES EJECUCIÓN DE CÓDIGO en la
    sesión del usuario, y basta con pegarlo en el campo. Se filtra por esquema
    permitido, no por lo que parezca sospechoso: la lista de lo malo nunca está
    completa.
  */
  it("rechaza los esquemas que ejecutan", () => {
    for (const malo of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:x",
      "file:///C:/Windows",
    ]) {
      expect(validarEnlace(malo).ok, malo).toBe(false);
    }
  });

  it("rechaza lo que no es una URL", () => {
    expect(validarEnlace("").ok).toBe(false);
    expect(validarEnlace("ejemplo.com").ok).toBe(false);
  });
});
