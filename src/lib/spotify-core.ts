import "server-only";
import { spotifyLimiter } from "./rate-limiter";

const SPOTIFY_API = "https://api.spotify.com/v1";

/**
 * Núcleo HTTP contra la Web API: rate limiter global, backoff y reintentos.
 *
 * Recibe el access token como argumento en vez de leerlo de la sesión, de modo
 * que sirve tanto a las peticiones con sesión (`spotifyFetch`) como a las del
 * cron sin cookie (`spotifyFetchHeadless`). Sin esta separación, la lógica de
 * reintentos habría que duplicarla.
 */
export async function spotifyRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<T> {
  const isMutation = init.method && init.method !== "GET";
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "User-Agent": "ledger-app/0.1 (personal-use)",
  };
  if (isMutation) headers["Content-Type"] = "application/json";

  // Wait for the global rate limiter — guarantees we never exceed Spotify's
  // 180 req/30s cap regardless of how many scanners run in parallel.
  await spotifyLimiter.acquire();

  const res = await fetch(`${SPOTIFY_API}${path}`, { ...init, headers });

  // Retry on 429 always; retry 5xx only for idempotent methods. A POST (add
  // tracks, create playlist) may have been partially processed before the 5xx,
  // so retrying it could duplicate tracks or create duplicate playlists.
  const method = (init.method ?? "GET").toUpperCase();
  const isIdempotent = method === "GET" || method === "PUT" || method === "DELETE";
  const canRetry = res.status === 429 || (res.status >= 500 && isIdempotent);
  if (canRetry && attempt < 4) {
    const parsedRetryAfter = parseInt(res.headers.get("Retry-After") ?? "", 10);
    // A non-numeric Retry-After (e.g. HTTP-date) must not become NaN, or the
    // backoff collapses to setTimeout(NaN) === 0ms (hammering on retry).
    const retryAfterSec = Number.isFinite(parsedRetryAfter) ? parsedRetryAfter : 0;
    // If Spotify wants us to wait more than 60s, give up and let the user know.
    const MAX_AUTO_WAIT_S = 60;
    if (retryAfterSec > MAX_AUTO_WAIT_S) {
      const minutes = Math.ceil(retryAfterSec / 60);
      const err = new Error(
        `Spotify rate limit: ${minutes} min de espera. Intenta más tarde.`,
      ) as Error & { status?: number; retryAfterSec?: number };
      err.status = 429;
      err.retryAfterSec = retryAfterSec;
      throw err;
    }
    const backoffMs = Math.max(
      retryAfterSec * 1000,
      Math.min(30_000, 500 * 2 ** attempt),
    );
    console.warn(
      `[spotify] ${res.status} on ${path}. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/4)…`,
    );
    await new Promise((r) => setTimeout(r, backoffMs));
    return spotifyRequest<T>(accessToken, path, init, attempt + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Spotify ${res.status}: ${text}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
