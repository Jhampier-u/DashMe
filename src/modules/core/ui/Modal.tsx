"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  /** Rótulo accesible del diálogo. */
  label: string;
  title: string;
  children: ReactNode;
  /** Botones de acción, alineados a la derecha. */
  footer: ReactNode;
  onDismiss: () => void;
};

/**
 * Diálogo modal. Se cierra con Escape o pulsando fuera; al abrirse lleva el
 * foco dentro para que no se quede detrás, en la página.
 */
export function Modal({ label, title, children, footer, onDismiss }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(6, 6, 9, 0.72)",
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--m-surface)",
          border: "1px solid var(--m-line)",
          borderRadius: 12,
          padding: 20,
          outline: "none",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.5)",
        }}
      >
        <h2 style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
        <div style={{ fontSize: 13.5, color: "var(--m-ink-2)", lineHeight: 1.55 }}>
          {children}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          {footer}
        </div>
      </div>
    </div>
  );
}
