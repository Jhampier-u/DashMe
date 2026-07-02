import "server-only";

/**
 * Serialized min-interval throttle. NOT a token bucket: no permite ráfagas —
 * cada release se espacia al menos `minIntervalMs` mediante una única cola FIFO,
 * sin importar cuántos callers hagan `acquire()` a la vez. Se usa para mantener
 * las llamadas salientes (Spotify, Last.fm) bajo la ventana rodante de cada API.
 */
class IntervalThrottle {
  private queue: Array<() => void> = [];
  private processing = false;
  private lastReleased = 0;

  constructor(private readonly minIntervalMs: number) {}

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.pump();
    });
  }

  private async pump() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const elapsed = Date.now() - this.lastReleased;
        if (elapsed < this.minIntervalMs) {
          await sleep(this.minIntervalMs - elapsed);
        }
        const next = this.queue.shift();
        this.lastReleased = Date.now();
        next?.();
      }
    } finally {
      this.processing = false;
    }
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// Spotify: 4 req/s sostenido = 120 req/30s, bajo el cap de 180.
const SPOTIFY_MIN_INTERVAL_MS = 250;
// Last.fm: ~4.5 req/s, bajo su guía de ~5 req/s por key. Cola propia para que
// los 6 workers de géneros no se salten el límite (antes pegaban a pelo).
const LASTFM_MIN_INTERVAL_MS = 220;

declare global {
  // eslint-disable-next-line no-var
  var __spotifyRateLimiter: IntervalThrottle | undefined;
  // eslint-disable-next-line no-var
  var __lastfmRateLimiter: IntervalThrottle | undefined;
}

export const spotifyLimiter =
  globalThis.__spotifyRateLimiter ??
  (globalThis.__spotifyRateLimiter = new IntervalThrottle(SPOTIFY_MIN_INTERVAL_MS));

export const lastfmLimiter =
  globalThis.__lastfmRateLimiter ??
  (globalThis.__lastfmRateLimiter = new IntervalThrottle(LASTFM_MIN_INTERVAL_MS));
