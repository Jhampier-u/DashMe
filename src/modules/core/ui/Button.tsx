import type { ButtonHTMLAttributes, CSSProperties } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: 8,
  fontFamily: "inherit",
  fontWeight: 550,
  lineHeight: 1.2,
  cursor: "pointer",
  border: "1px solid transparent",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const SIZES: Record<ButtonSize, CSSProperties> = {
  sm: { fontSize: 12.5, padding: "6px 11px" },
  md: { fontSize: 13.5, padding: "9px 16px" },
};

const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "var(--m-series-strong)", color: "#fff" },
  secondary: {
    background: "var(--m-elevated)",
    borderColor: "var(--m-line)",
    color: "var(--m-ink)",
  },
  ghost: { background: "transparent", color: "var(--m-ink-2)" },
  danger: { background: "var(--m-crit-strong)", color: "#fff" },
};

/**
 * Estilos sueltos, para elementos que no son `<button>` — un `<Link>` con
 * aspecto de botón, por ejemplo.
 */
export function buttonStyle(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
): CSSProperties {
  return { ...BASE, ...SIZES[size], ...VARIANTS[variant] };
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "secondary",
  size = "md",
  style,
  disabled,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        ...buttonStyle(variant, size),
        ...(disabled ? { opacity: 0.5, cursor: "default" } : null),
        ...style,
      }}
      {...rest}
    />
  );
}
