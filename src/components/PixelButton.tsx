"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "danger" | "accent" | "ghost";

const variantStyle: Record<Variant, string> = {
  primary: "bg-[var(--color-mint)] text-[var(--color-bg-deep)]",
  danger: "bg-[var(--color-pink)] text-[var(--color-bg-deep)]",
  accent: "bg-[var(--color-peach)] text-[var(--color-bg-deep)]",
  ghost: "bg-[var(--color-surface)] text-[var(--color-ink)]",
};

type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

export function PixelButton({
  variant = "primary",
  children,
  className = "",
  ...rest
}: PixelButtonProps) {
  return (
    <button
      {...rest}
      className={`pixel-button pixel-edge font-display uppercase text-[0.65rem] tracking-wider px-4 py-3 ${variantStyle[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
