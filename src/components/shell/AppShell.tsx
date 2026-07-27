"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { SoundToggle } from "@/components/SoundToggle";
import {
  IconGarden,
  IconHabits,
  IconHome,
  IconProjects,
  IconTasks,
} from "./NavIcons";

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", Icon: IconHome },
  { href: "/habits", label: "Hábitos", Icon: IconHabits },
  { href: "/garden", label: "Jardín", Icon: IconGarden },
  { href: "/tasks", label: "Tareas", Icon: IconTasks },
  { href: "/projects", label: "Proyectos", Icon: IconProjects },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Armazón de la aplicación. Los dos renderizados de navegación conviven en el
 * DOM y se alternan con clases: detectar el ancho en JavaScript rompería la
 * hidratación, porque el servidor no sabe cuánto mide la ventana.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      {/* Lateral · escritorio */}
      <aside
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-52 lg:px-3 lg:py-4"
        style={{ background: "var(--m-surface)", borderRight: "1px solid var(--m-line)" }}
      >
        <Link
          href="/"
          className="px-2 pb-4"
          style={{
            fontSize: 15,
            fontWeight: 650,
            letterSpacing: "-0.01em",
            color: "var(--m-ink)",
            textDecoration: "none",
          }}
        >
          Untap
        </Link>

        <nav className="flex flex-col gap-0.5 flex-1" aria-label="Secciones">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        <div className="px-2 pt-3">
          <SoundToggle />
        </div>
      </aside>

      {/* Barra superior · móvil. En escritorio el logotipo y el sonido viven
          en la lateral, así que esta barra no existe. */}
      <header
        className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{
          background: "var(--m-surface)",
          borderBottom: "1px solid var(--m-line)",
        }}
      >
        <Link
          href="/"
          style={{
            fontSize: 14.5,
            fontWeight: 650,
            color: "var(--m-ink)",
            textDecoration: "none",
          }}
        >
          Untap
        </Link>
        <SoundToggle />
      </header>

      {/* Contenedor, no `<main>`: cada pantalla ya trae el suyo (Inicio
          directamente, y las demás a través de PageShell). Anidar dos `<main>`
          es HTML inválido y confunde a los lectores de pantalla.
          El `_` de la clase es cómo Tailwind escribe los espacios: `calc` los
          exige alrededor del `+`. */}
      <div className="lg:ml-52 pb-[calc(4.75rem_+_env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </div>

      {/* Barra inferior · móvil */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex"
        aria-label="Secciones"
        style={{
          background: "var(--m-surface)",
          borderTop: "1px solid var(--m-line)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {NAV_ITEMS.map((item) => (
          <BottomLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
    </div>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const { Icon } = item;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-2.5 px-2 py-2 rounded-lg"
      style={{
        fontSize: 13,
        textDecoration: "none",
        color: active ? "var(--m-ink)" : "var(--m-ink-2)",
        fontWeight: active ? 550 : 400,
        background: active ? "rgba(57, 135, 229, 0.13)" : "transparent",
      }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {item.label}
    </Link>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  const { Icon } = item;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="flex-1 flex flex-col items-center gap-1 py-2"
      style={{
        fontSize: 10,
        textDecoration: "none",
        color: active ? "var(--m-series)" : "var(--m-ink-2)",
        fontWeight: active ? 550 : 400,
      }}
    >
      <Icon className="w-5 h-5" />
      {item.label}
    </Link>
  );
}
