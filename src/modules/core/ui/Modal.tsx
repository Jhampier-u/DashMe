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
        // El velo se tiñe de tinta en vez de negro: sobre un mundo crema, un
        // negro puro detrás del papel lo hace parecer un recorte, no una capa.
        background: "rgba(74, 58, 82, 0.55)",
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--color-paper)",
          border: "3px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
          padding: 20,
          outline: "none",
          boxShadow: "var(--shadow-hard)",
          color: "var(--color-tinta)",
          fontFamily: "var(--font-cuerpo)",
        }}
      >
        {/*
          14px es el suelo de Press Start 2P, y aquí se usa el suelo y no más
          porque el título lo pone quien abre el diálogo y puede ser una frase
          entera ("¿Borrar este hábito?"). Por eso parte de línea en vez de
          desbordar: lo que no se hace nunca es encogerlo por debajo de 14.
        */}
        <h2
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 12,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </h2>
        <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{children}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          {footer}
        </div>
      </div>
    </div>
  );
}
