"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { SoundToggle } from "@/modules/habitos/components/SoundToggle";
import {
  IconGarden,
  IconHabits,
  IconHome,
  IconMusic,
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
  { href: "/habitos", label: "Hábitos", Icon: IconHabits },
  { href: "/jardin", label: "Jardín", Icon: IconGarden },
  { href: "/tareas", label: "Tareas", Icon: IconTasks },
  { href: "/proyectos", label: "Proyectos", Icon: IconProjects },
  { href: "/musica", label: "Música", Icon: IconMusic },
];

/*
  Las tres superficies del armazón comparten piel. El trazo sube de 1px
  translúcido a los 3px macizos del sistema: es el borde que separa la
  navegación del contenido y ahora se ve.

  Aquí sí se fija el color, al contrario que en `PageHeader`: quien impone el
  fondo tiene que imponer también la tinta. Heredar solo es correcto cuando no
  sabes sobre qué caes.
*/
const SUPERFICIE: CSSProperties = {
  background: "var(--color-paper)",
  color: "var(--color-tinta)",
  fontFamily: "var(--font-cuerpo)",
};

/** El logotipo, en las dos barras. 14px es el suelo de Press Start 2P. */
const LOGOTIPO: CSSProperties = {
  fontFamily: "var(--font-pixel)",
  fontSize: 14,
  lineHeight: 1.5,
  color: "var(--color-tinta)",
  textDecoration: "none",
};

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
        style={{ ...SUPERFICIE, borderRight: "3px solid var(--color-line)" }}
      >
        <Link href="/" className="px-2 pb-5" style={LOGOTIPO}>
          Dashboard
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
        style={{ ...SUPERFICIE, borderBottom: "3px solid var(--color-line)" }}
      >
        <Link href="/" style={LOGOTIPO}>
          Dashboard
        </Link>
        <SoundToggle />
      </header>

      {/* Contenedor, no `<main>`: cada pantalla ya trae el suyo. Anidar dos
          `<main>` es HTML inválido y confunde a los lectores de pantalla.
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
          ...SUPERFICIE,
          borderTop: "3px solid var(--color-line)",
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
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-control"
      style={{
        fontSize: 13,
        textDecoration: "none",
        // Tinta plena siempre: a 13px, tinta-2 se queda en 4,00:1 y no llega a
        // AA. Lo que distingue al activo es el relleno y el grosor, no el tono.
        color: "var(--color-tinta)",
        fontWeight: active ? 700 : 500,
        background: active ? "var(--color-sky)" : "transparent",
        // Borde transparente en el inactivo para que al activarse no se mueva
        // nada de sitio.
        border: `3px solid ${active ? "var(--color-line)" : "transparent"}`,
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
        // El rótulo se queda en Quicksand: por debajo de 16px, VT323 no se lee.
        fontSize: 10,
        textDecoration: "none",
        color: "var(--color-tinta)",
        fontWeight: active ? 700 : 500,
        background: active ? "var(--color-sky)" : "transparent",
      }}
    >
      <Icon className="w-5 h-5" />
      {item.label}
    </Link>
  );
}
