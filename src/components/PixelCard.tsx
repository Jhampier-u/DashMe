import type { ReactNode } from "react";

type Tone = "surface" | "mint" | "peach" | "lavender" | "sky" | "pink";

const toneStyle: Record<Tone, string> = {
  surface: "bg-[var(--color-surface)] text-[var(--color-ink)]",
  mint: "bg-[var(--color-mint)] text-[var(--color-bg-deep)]",
  peach: "bg-[var(--color-peach)] text-[var(--color-bg-deep)]",
  lavender: "bg-[var(--color-lavender)] text-[var(--color-bg-deep)]",
  sky: "bg-[var(--color-sky)] text-[var(--color-bg-deep)]",
  pink: "bg-[var(--color-pink)] text-[var(--color-bg-deep)]",
};

type PixelCardProps = {
  children: ReactNode;
  className?: string;
  tone?: Tone;
};

export function PixelCard({
  children,
  className = "",
  tone = "surface",
}: PixelCardProps) {
  return (
    <div className={`pixel-edge-tight ${toneStyle[tone]} p-4 ${className}`}>
      {children}
    </div>
  );
}
