"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="max-w-xl mx-auto px-4 py-16">
      <div className="pixel-window text-center">
        <div className="text-6xl mb-4">💥</div>
        <h2 className="font-display text-[0.8rem] tracking-widest text-[var(--color-pink)] mb-3">
          ALGO SE ROMPIÓ
        </h2>
        <p className="text-[var(--color-ink-soft)] text-lg mb-2">
          El aventurero tropezó con una piedra.
        </p>
        {error.digest ? (
          <p className="text-[var(--color-ink-dim)] text-sm mb-5">
            Código: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="pixel-button pixel-edge font-display uppercase text-[0.65rem] tracking-wider px-4 py-3"
          style={{
            background: "var(--color-mint)",
            color: "var(--color-bg-deep)",
          }}
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
