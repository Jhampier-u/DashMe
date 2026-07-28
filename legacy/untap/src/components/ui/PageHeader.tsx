import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  /** Acción principal de la pantalla, alineada a la derecha. */
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 4,
      }}
    >
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-0.02em" }}>
          {title}
        </h1>
        {subtitle ? (
          <p style={{ fontSize: 13.5, color: "var(--m-ink-2)", marginTop: 4 }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
