type Props = {
  title: string;
  subtitle?: string;
  emoji?: string;
  accent?: string; // CSS color
};

export function SectionHeader({
  title,
  subtitle,
  emoji,
  accent = "var(--color-peach)",
}: Props) {
  return (
    <header className="untap-slide-in flex items-end gap-4 mb-2">
      {emoji ? (
        <div
          className="text-4xl pixel-edge-tight w-14 h-14 flex items-center justify-center"
          style={{ background: accent, color: "var(--color-bg-deep)" }}
        >
          {emoji}
        </div>
      ) : null}
      <div className="flex-1">
        <h1
          className="font-display text-lg sm:text-xl tracking-widest"
          style={{ color: accent }}
        >
          {title.toUpperCase()}
        </h1>
        {subtitle ? (
          <p className="text-[var(--color-ink-soft)] text-base mt-1">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
