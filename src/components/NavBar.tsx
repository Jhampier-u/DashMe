"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SoundToggle } from "./SoundToggle";

const TABS = [
  { href: "/", label: "Inicio", icon: "🏠", accent: "var(--color-peach)" },
  { href: "/habits", label: "Hábitos", icon: "🌱", accent: "var(--color-mint)" },
  { href: "/garden", label: "Jardín", icon: "🌳", accent: "var(--color-mint)" },
  { href: "/tasks", label: "Tareas", icon: "📝", accent: "var(--color-sky)" },
  { href: "/projects", label: "Proyectos", icon: "📁", accent: "var(--color-lavender)" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavBar() {
  const pathname = usePathname();
  return (
    <nav
      className="sticky top-0 z-30 backdrop-blur-sm"
      style={{
        background: "color-mix(in srgb, var(--color-bg-deep) 92%, transparent)",
        borderBottom: "3px solid var(--color-border)",
      }}
    >
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="font-display text-sm sm:text-base tracking-widest text-[var(--color-peach)] hover:text-[var(--color-mint)] transition-colors"
        >
          UNTAP
        </Link>
        <div className="flex gap-1 sm:gap-2 items-center">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="pixel-button font-display text-[0.55rem] sm:text-[0.6rem] tracking-wider px-2 sm:px-3 py-2 flex items-center gap-1 sm:gap-2"
                style={{
                  background: active ? tab.accent : "var(--color-surface)",
                  color: active ? "var(--color-bg-deep)" : "var(--color-ink)",
                  boxShadow: active
                    ? `0 0 0 3px var(--color-border), inset 0 -3px 0 0 rgba(0,0,0,0.18)`
                    : "0 0 0 3px var(--color-border)",
                  transform: active ? "translateY(1px)" : "none",
                }}
              >
                <span className="text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
          <SoundToggle />
        </div>
      </div>
    </nav>
  );
}
