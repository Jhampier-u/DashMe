import { describe, expect, it } from "vitest";
import {
  albumKey,
  artistKey,
  KEY_SEP,
  normalizeName,
  trackKey,
} from "@/modules/musica/lib/stats/normalize";

describe("normalizeName", () => {
  it("pasa a minúsculas", () => {
    expect(normalizeName("Slowdive")).toBe("slowdive");
  });

  it("elimina diacríticos", () => {
    expect(normalizeName("Beyonc\u00E9")).toBe("beyonce");
    expect(normalizeName("Beyonc\u00E9")).toBe(normalizeName("Beyonce"));
  });

  it("colapsa espacios y recorta", () => {
    expect(normalizeName("  Cocteau   Twins ")).toBe("cocteau twins");
  });

  it("trata igual las formas unicode compuesta y descompuesta", () => {
    // Escritas con escapes a propósito: las dos cadenas se ven idénticas en
    // pantalla y cualquier editor puede normalizarlas, dejando el test vacío.
    const compuesta = "Sigur R\u00F3s"; // ó precompuesta (NFC)
    const descompuesta = "Sigur Ro\u0301s"; // o + acento combinante (NFD)
    expect(compuesta).not.toBe(descompuesta);
    expect(normalizeName(compuesta)).toBe(normalizeName(descompuesta));
  });

  it("devuelve cadena vacía para entrada vacía", () => {
    expect(normalizeName("   ")).toBe("");
  });

  it("normaliza variantes fullwidth mediante NFKD", () => {
    // Texto CJK-adjacent puede traer letras latinas en ancho completo; deben
    // producir la misma clave que sus equivalentes ASCII.
    const fullwidth = "\uFF21\uFF22\uFF23";
    expect(normalizeName(fullwidth)).toBe("abc");
    expect(normalizeName(fullwidth)).toBe(normalizeName("ABC"));
  });

  it("descompone ligaduras tipográficas mediante NFKD", () => {
    const conLigadura = "o\uFB01cina"; // ligadura “fi” (U+FB01)
    expect(normalizeName(conLigadura)).toBe("oficina");
  });

  it("elimina caracteres de formato de ancho cero (Unicode Cf)", () => {
    const conCeroAncho = "Slow\u200Bdive"; // espacio de ancho cero (U+200B)
    expect(normalizeName(conCeroAncho)).toBe("slowdive");
    expect(normalizeName(conCeroAncho)).toBe(normalizeName("Slowdive"));
  });

  it("conserva letras sin descomposición de compatibilidad (ß, Æ, Ø, Ł)", () => {
    // Estas letras no tienen forma ASCII equivalente: deben sobrevivir a la
    // normalización intactas (salvo el cambio de mayúscula a minúscula), no
    // ser eliminadas ni sustituidas.
    expect(normalizeName("Straße")).toBe("straße");
    expect(normalizeName("Æon")).toBe("æon");
    expect(normalizeName("Øystein")).toBe("øystein");
    expect(normalizeName("Łukasz")).toBe("łukasz");
  });
});

describe("claves compuestas", () => {
  it("artistKey normaliza el nombre", () => {
    expect(artistKey("Duster")).toBe("duster");
  });

  it("trackKey une artista y título con el separador", () => {
    expect(trackKey("Duster", "Inside Out")).toBe(
      `duster${KEY_SEP}inside out`,
    );
  });

  it("albumKey une artista y álbum con el separador", () => {
    expect(albumKey("Duster", "Stratosphere")).toBe(
      `duster${KEY_SEP}stratosphere`,
    );
  });

  it("no colisiona cuando el título contiene el separador visible", () => {
    // Un título con guiones o barras no debe poder falsear una clave.
    const a = trackKey("Duster", "Inside Out");
    const b = trackKey("Duster - Inside", "Out");
    expect(a).not.toBe(b);
  });

  it("usa un separador no imprimible", () => {
    expect(KEY_SEP).toBe("\u001F");
  });
});
