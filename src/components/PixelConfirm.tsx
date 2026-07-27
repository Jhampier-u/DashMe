"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Request = {
  title: string;
  message: string;
  confirmLabel?: string;
};

/**
 * Confirmación en la estética del juego, en vez del `confirm()` del navegador.
 * Devuelve una promesa como el nativo, así que sustituirlo es un cambio de una
 * línea en cada sitio.
 */
export function useConfirm() {
  const [request, setRequest] = useState<Request | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((req: Request) => {
    setRequest(req);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    setRequest(null);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  useEffect(() => {
    if (!request) return;
    acceptRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, close]);

  const dialog = request ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 13, 31, 0.75)" }}
      role="dialog"
      aria-modal="true"
      aria-label={request.title}
      onClick={() => close(false)}
    >
      <div
        className="pixel-window max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-display text-[0.7rem] tracking-widest text-[var(--color-pink)] mb-3">
          {request.title.toUpperCase()}
        </div>
        <p className="text-lg text-[var(--color-ink)] mb-5">{request.message}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => close(false)}
            className="pixel-button font-display text-[0.6rem] px-3 py-2"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-ink)",
              boxShadow: "0 0 0 3px var(--color-border)",
            }}
          >
            CANCELAR
          </button>
          <button
            ref={acceptRef}
            type="button"
            onClick={() => close(true)}
            className="pixel-button font-display text-[0.6rem] px-3 py-2"
            style={{
              background: "var(--color-pink)",
              color: "var(--color-bg-deep)",
              boxShadow: "0 0 0 3px var(--color-border)",
            }}
          >
            {(request.confirmLabel ?? "Borrar").toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
