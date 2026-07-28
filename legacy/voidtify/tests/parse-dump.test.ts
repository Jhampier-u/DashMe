import { describe, expect, it } from "vitest";
import { parseDumpRecords, type DumpRecord } from "@/lib/import/parse-dump";

const TZ = "America/Guayaquil";

function registro(over: Partial<DumpRecord> = {}): DumpRecord {
  return {
    ts: "2019-03-15T18:30:00Z",
    platform: "android",
    ms_played: 210_000,
    master_metadata_track_name: "Alison",
    master_metadata_album_artist_name: "Slowdive",
    master_metadata_album_album_name: "Souvlaki",
    spotify_track_uri: "spotify:track:abc",
    reason_start: "clickrow",
    reason_end: "endplay",
    shuffle: false,
    skipped: false,
    ...over,
  };
}

describe("parseDumpRecords", () => {
  it("convierte un registro en una fila", () => {
    const { filas } = parseDumpRecords([registro()], TZ);
    expect(filas).toHaveLength(1);

    const f = filas[0];
    expect(f.ts).toBe(Date.UTC(2019, 2, 15, 18, 30, 0));
    expect(f.msPlayed).toBe(210_000);
    expect(f.trackName).toBe("Alison");
    expect(f.artistName).toBe("Slowdive");
    expect(f.albumName).toBe("Souvlaki");
    expect(f.trackUri).toBe("spotify:track:abc");
    expect(f.source).toBe("import");
  });

  it("normaliza las claves de agrupación", () => {
    const { filas } = parseDumpRecords([registro()], TZ);
    expect(filas[0].artistKey).toBe("slowdive");
    expect(filas[0].trackKey).toBe("slowdive\u001Falison");
    expect(filas[0].albumKey).toBe("slowdive\u001Fsouvlaki");
  });

  it("calcula la fecha y hora locales", () => {
    // 18:30 UTC son las 13:30 en Guayaquil.
    const { filas } = parseDumpRecords([registro()], TZ);
    expect(filas[0].localDate).toBe("2019-03-15");
    expect(filas[0].localHour).toBe(13);
  });

  it("conserva los booleanos como booleanos", () => {
    // La columna es INTEGER en SQL, pero Drizzle la declara con
    // `{ mode: "boolean" }` y hace la conversión a 0/1 al escribir. Del lado
    // de TypeScript son booleanos, y tratarlos como números no compila.
    const { filas } = parseDumpRecords(
      [registro({ shuffle: true, skipped: false })],
      TZ,
    );
    expect(filas[0].shuffle).toBe(true);
    expect(filas[0].skipped).toBe(false);
  });

  it("acepta booleanos nulos o ausentes", () => {
    const { filas } = parseDumpRecords(
      [registro({ shuffle: null, skipped: undefined })],
      TZ,
    );
    expect(filas[0].shuffle).toBeNull();
    expect(filas[0].skipped).toBeNull();
  });

  it("conserva reason_start, reason_end y platform", () => {
    const { filas } = parseDumpRecords([registro()], TZ);
    expect(filas[0].reasonStart).toBe("clickrow");
    expect(filas[0].reasonEnd).toBe("endplay");
    expect(filas[0].platform).toBe("android");
  });

  it("construye el dedup_key con el timestamp y el uri", () => {
    const { filas } = parseDumpRecords([registro()], TZ);
    expect(filas[0].dedupKey).toBe(
      `${Date.UTC(2019, 2, 15, 18, 30, 0)}:spotify:track:abc`,
    );
  });

  it("usa track_key en el dedup_key cuando no hay uri", () => {
    const { filas } = parseDumpRecords(
      [registro({ spotify_track_uri: null })],
      TZ,
    );
    expect(filas[0].trackUri).toBeNull();
    expect(filas[0].dedupKey).toBe(
      `${Date.UTC(2019, 2, 15, 18, 30, 0)}:slowdive\u001Falison`,
    );
  });

  it("descarta podcasts y cuenta cuántos", () => {
    const podcast = registro({
      master_metadata_track_name: null,
      master_metadata_album_artist_name: null,
      episode_name: "Un episodio",
      spotify_episode_uri: "spotify:episode:xyz",
    });

    const r = parseDumpRecords([registro(), podcast], TZ);
    expect(r.filas).toHaveLength(1);
    expect(r.descartados).toBe(1);
  });

  it("descarta audiolibros y los cuenta aparte de los podcasts", () => {
    const audiolibro = registro({
      master_metadata_track_name: null,
      master_metadata_album_artist_name: null,
      audiobook_title: "Un libro",
      audiobook_uri: "spotify:audiobook:xyz",
    });

    const r = parseDumpRecords([registro(), audiolibro], TZ);
    expect(r.filas).toHaveLength(1);
    expect(r.descartados).toBe(1);
    expect(r.audiolibros).toBe(1);
  });

  it("descarta registros sin artista", () => {
    const r = parseDumpRecords(
      [registro({ master_metadata_album_artist_name: null })],
      TZ,
    );
    expect(r.filas).toHaveLength(0);
    expect(r.descartados).toBe(1);
  });

  it("cuenta como inválido un registro con fecha imposible", () => {
    const r = parseDumpRecords([registro({ ts: "no-es-fecha" })], TZ);
    expect(r.filas).toHaveLength(0);
    expect(r.invalidos).toBe(1);
  });

  it("una entrada corrupta no interrumpe el resto", () => {
    const r = parseDumpRecords(
      [registro(), registro({ ts: "roto" }), registro({ ts: "2019-03-16T18:30:00Z" })],
      TZ,
    );
    expect(r.filas).toHaveLength(2);
    expect(r.invalidos).toBe(1);
  });

  it("conserva las reproducciones cortas", () => {
    // El umbral de 30 s se aplica al consultar, no al importar: sin las cortas
    // no se puede analizar el abandono, que es justo lo que el dump permite.
    const r = parseDumpRecords([registro({ ms_played: 550 })], TZ);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0].msPlayed).toBe(550);
  });

  it("nunca almacena la dirección IP ni el país", () => {
    const conIp = registro() as DumpRecord & Record<string, unknown>;
    conIp.ip_addr = "186.43.233.220";
    conIp.conn_country = "EC";
    conIp.incognito_mode = false;

    const { filas } = parseDumpRecords([conIp], TZ);
    const serializada = JSON.stringify(filas[0]);

    expect(serializada).not.toContain("186.43.233.220");
    expect(serializada).not.toContain("ip_addr");
    expect(serializada).not.toContain("conn_country");
  });

  it("informa del rango temporal de lo parseado", () => {
    const r = parseDumpRecords(
      [
        registro({ ts: "2019-06-01T00:00:00Z" }),
        registro({ ts: "2018-01-01T00:00:00Z", spotify_track_uri: "spotify:track:x" }),
        registro({ ts: "2020-12-31T00:00:00Z", spotify_track_uri: "spotify:track:y" }),
      ],
      TZ,
    );

    expect(r.desde).toBe(Date.UTC(2018, 0, 1));
    expect(r.hasta).toBe(Date.UTC(2020, 11, 31));
  });

  it("devuelve desde y hasta nulos si no hubo filas válidas", () => {
    const r = parseDumpRecords([registro({ ts: "roto" })], TZ);
    expect(r.desde).toBeNull();
    expect(r.hasta).toBeNull();
  });
});
