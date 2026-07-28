import { describe, expect, it } from "vitest";
import { SpotifyApiError } from "@/modules/musica/lib/spotify-core";

describe("SpotifyApiError", () => {
  it("conserva status y retryAfterSec", () => {
    const e = new SpotifyApiError("límite alcanzado", 429, 120);
    expect(e.status).toBe(429);
    expect(e.retryAfterSec).toBe(120);
  });

  it("permite omitir retryAfterSec", () => {
    const e = new SpotifyApiError("no encontrado", 404);
    expect(e.status).toBe(404);
    expect(e.retryAfterSec).toBeUndefined();
  });

  it("es reconocible con instanceof y sigue siendo un Error", () => {
    const e: unknown = new SpotifyApiError("x", 500);
    expect(e).toBeInstanceOf(SpotifyApiError);
    expect(e).toBeInstanceOf(Error);
  });

  it("expone el nombre para que aparezca en los logs", () => {
    expect(new SpotifyApiError("x", 500).name).toBe("SpotifyApiError");
  });

  it("conserva el mensaje", () => {
    expect(new SpotifyApiError("mensaje concreto", 500).message).toBe(
      "mensaje concreto",
    );
  });
});
