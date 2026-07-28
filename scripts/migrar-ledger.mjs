import Database from "better-sqlite3";

/**
 * Las cinco tablas con contenido real. `spotify_credentials` queda fuera a
 * propósito: son tokens de acceso que caducan y se regeneran al iniciar
 * sesión. Las otras seis tablas del esquema están vacías en origen.
 */
export const TABLAS_A_MIGRAR = [
  "streams",
  "import_batches",
  "artist_genres",
  "top_snapshots",
  "capture_state",
];

/**
 * Copia las tablas de `origen` a `destino` con ATTACH, en una transacción.
 *
 * `INSERT OR IGNORE` hace la operación idempotente: si la ejecutas dos veces,
 * las claves ya presentes se saltan en vez de duplicarse o reventar.
 *
 * El origen se adjunta y solo se lee. Esto es deliberado y no una precaución
 * decorativa: el origen es la única copia de ocho años de historial.
 */
export function copiarTablas(rutaOrigen, rutaDestino) {
  const db = new Database(rutaDestino);
  const conteos = {};
  try {
    db.pragma("foreign_keys = OFF");
    db.exec(`ATTACH DATABASE '${rutaOrigen.replace(/'/g, "''")}' AS origen`);
    const copiar = db.transaction(() => {
      for (const tabla of TABLAS_A_MIGRAR) {
        db.exec(`INSERT OR IGNORE INTO main."${tabla}" SELECT * FROM origen."${tabla}"`);
        conteos[tabla] = db
          .prepare(`SELECT count(*) c FROM main."${tabla}"`)
          .get().c;
      }
    });
    copiar();
    return conteos;
  } finally {
    try {
      db.exec("DETACH DATABASE origen");
    } catch {
      // Si el ATTACH falló, no hay nada que soltar.
    }
    db.pragma("foreign_keys = ON");
    db.close();
  }
}

/** Conteos de las tablas a migrar en una base, para verificar antes/después. */
export function contar(ruta) {
  const db = new Database(ruta, { readonly: true });
  try {
    const out = {};
    for (const tabla of TABLAS_A_MIGRAR) {
      out[tabla] = db.prepare(`SELECT count(*) c FROM "${tabla}"`).get().c;
    }
    return out;
  } finally {
    db.close();
  }
}
