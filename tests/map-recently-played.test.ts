import { describe, expect, it } from "vitest";
import {
  mapRecentlyPlayed,
  type RecentlyPlayedItem,
} from "@/modules/musica/lib/capture/map-recently-played";

function item(over: Partial<RecentlyPlayedItem> = {}): RecentlyPlayedItem {
  return {
    played_at: "2026-07-15T18:30:00.000Z",
    track: {
      uri: "spotify:track:abc",
      name: "Alison",
      duration_ms: 216_000,
      artists: [{ id: "a1", name: "Slowdive" }],
      album: { id: "al1", name: "Souvlaki" },
    },
    ...over,
  };
}

describe("mapRecentlyPlayed", () => {
  it("convierte un item en una fila de stream", () => {
    const [fila] = mapRecentlyPlayed([item()], "UTC");

    expect(fila.ts).toBe(Date.UTC(2026, 6, 15, 18, 30, 0));
    expect(fila.trackName).toBe("Alison");
    expect(fila.artistName).toBe("Slowdive");
    expect(fila.albumName).toBe("Souvlaki");
    expect(fila.trackUri).toBe("spotify:track:abc");
    expect(fila.source).toBe("live");
  });

  it("normaliza las claves de agrupación", () => {
    const [fila] = mapRecentlyPlayed([item()], "UTC");
    expect(fila.artistKey).toBe("slowdive");
    expect(fila.trackKey).toBe("slowdive\u001Falison");
    expect(fila.albumKey).toBe("slowdive\u001Fsouvlaki");
  });

  it("calcula la fecha y hora local", () => {
    const [fila] = mapRecentlyPlayed([item()], "America/Lima");
    expect(fila.localDate).toBe("2026-07-15");
    expect(fila.localHour).toBe(13);
  });

  it("usa la duración completa como ms_played", () => {
    // recently-played no informa de cuánto sonó. Es una sobreestimación
    // acotada y temporal: el dump reemplazará este rango con datos exactos.
    const [fila] = mapRecentlyPlayed([item()], "UTC");
    expect(fila.msPlayed).toBe(216_000);
  });

  it("deja a null los campos que la API no proporciona", () => {
    const [fila] = mapRecentlyPlayed([item()], "UTC");
    expect(fila.skipped).toBeNull();
    expect(fila.reasonStart).toBeNull();
    expect(fila.reasonEnd).toBeNull();
    expect(fila.shuffle).toBeNull();
  });

  it("construye el dedup_key con el timestamp y el uri", () => {
    const [fila] = mapRecentlyPlayed([item()], "UTC");
    expect(fila.dedupKey).toBe(`${Date.UTC(2026, 6, 15, 18, 30, 0)}:spotify:track:abc`);
  });

  it("usa track_key en el dedup_key cuando no hay uri", () => {
    const sinUri = item({
      track: { ...item().track!, uri: "" },
    });
    const [fila] = mapRecentlyPlayed([sinUri], "UTC");
    expect(fila.trackUri).toBeNull();
    expect(fila.dedupKey).toBe(
      `${Date.UTC(2026, 6, 15, 18, 30, 0)}:slowdive\u001Falison`,
    );
  });

  it("acepta la clave `item` además de `track`", () => {
    // El fork de feb 2026 renombró `track` a `item` en playlists; se admiten
    // las dos formas por si recently-played sigue el mismo camino.
    const conItem: RecentlyPlayedItem = {
      played_at: "2026-07-15T18:30:00.000Z",
      item: item().track,
    };
    const [fila] = mapRecentlyPlayed([conItem], "UTC");
    expect(fila.trackName).toBe("Alison");
  });

  it("descarta items sin pista", () => {
    const vacio: RecentlyPlayedItem = { played_at: "2026-07-15T18:30:00.000Z" };
    expect(mapRecentlyPlayed([vacio], "UTC")).toHaveLength(0);
  });

  it("descarta items con fecha inválida", () => {
    expect(mapRecentlyPlayed([item({ played_at: "no-es-fecha" })], "UTC")).toHaveLength(0);
  });

  it("usa el primer artista cuando hay varios", () => {
    const varios = item({
      track: {
        ...item().track!,
        artists: [
          { id: "a1", name: "Slowdive" },
          { id: "a2", name: "Mojave 3" },
        ],
      },
    });
    const [fila] = mapRecentlyPlayed([varios], "UTC");
    expect(fila.artistName).toBe("Slowdive");
  });

  it("tolera un item sin artistas", () => {
    const sinArtistas = item({ track: { ...item().track!, artists: [] } });
    expect(mapRecentlyPlayed([sinArtistas], "UTC")).toHaveLength(0);
  });
});
