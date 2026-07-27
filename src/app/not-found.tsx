import Link from "next/link";

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-4 py-16">
      <div className="pixel-window text-center">
        <div className="text-6xl mb-4 untap-bobble inline-block">🗺️</div>
        <h2 className="font-display text-[0.8rem] tracking-widest text-[var(--color-peach)] mb-3">
          ZONA NO EXPLORADA
        </h2>
        <p className="text-[var(--color-ink-soft)] text-lg mb-6">
          Esta página no existe en el mapa.
        </p>
        <Link
          href="/"
          className="pixel-button pixel-edge font-display uppercase text-[0.65rem] tracking-wider px-4 py-3 inline-block"
          style={{
            background: "var(--color-mint)",
            color: "var(--color-bg-deep)",
          }}
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
