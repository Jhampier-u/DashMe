import type { ReactNode } from "react";

type PixelWindowProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function PixelWindow({ title, children, className = "" }: PixelWindowProps) {
  return (
    <div className={`pixel-window ${className}`}>
      {title ? (
        <div
          className="font-display uppercase text-[0.7rem] tracking-wider text-[var(--color-peach)] mb-3 pb-2"
          style={{ borderBottom: "2px solid var(--color-border)" }}
        >
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}
