# Chrome compartido — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la barra de navegación pixel por un armazón moderno con lateral en escritorio y barra inferior en móvil, y dejar montadas las primitivas de interfaz que consumirán las pantallas de las fases siguientes.

**Architecture:** Un `AppShell` cliente envuelve el contenido en `layout.tsx` y resuelve la sección activa con `usePathname`. Los dos renderizados de navegación conviven en el DOM y se alternan con clases de Tailwind, sin detectar el ancho en JavaScript. El armazón no aporta `<main>`: cada pantalla ya trae el suyo. Las primitivas viven en `src/components/ui/` y solo se crean las que tienen consumidor en esta fase.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-07-27-chrome-compartido-design.md`

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/components/ui/Card.tsx` (nuevo) | Superficie con borde y radio, título opcional |
| `src/components/ui/Button.tsx` (nuevo) | Estilos de botón por variante, y componente `Button` |
| `src/components/ui/Modal.tsx` (nuevo) | Diálogo accesible: fondo, foco, Escape, clic fuera |
| `src/components/shell/NavIcons.tsx` (nuevo) | Los cinco iconos de trazo |
| `src/components/shell/AppShell.tsx` (nuevo) | Lateral, barra superior móvil, barra inferior y área de contenido |
| `src/components/SoundToggle.tsx` (modificar) | Restilado para el chrome nuevo |
| `src/components/PixelConfirm.tsx` (modificar) | Usa `Modal` por dentro; el hook `useConfirm` no cambia |
| `src/components/AchievementToast.tsx` (modificar) | Mismo cartón, tipografía y colores nuevos |
| `src/components/PageShell.tsx` (modificar) | Añade la clase `.pixel-page` |
| `src/app/layout.tsx` (modificar) | Envuelve con `AppShell` |
| `src/app/error.tsx` (modificar) | Usa `Card` y `Button` |
| `src/app/not-found.tsx` (modificar) | Usa `Card` y los estilos de botón |
| `src/app/globals.css` (modificar) | `.pixel-page` con las reglas pixel; `body` moderno; token `--m-crit-strong` |
| `src/components/NavBar.tsx` (borrar) | Sustituida por `AppShell` |

**Decisión de plan, no del spec:** en móvil no hay lateral, así que el interruptor de sonido se quedaría sin sitio. Se añade una **barra superior fina en móvil** con el logotipo a la izquierda y el interruptor a la derecha. En escritorio esa barra no existe: el logotipo y el interruptor viven en la lateral.

---

### Task 1: Primitivas Card y Button

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Button.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Añadir el token del botón destructivo**

En `src/app/globals.css`, dentro del bloque `:root` de tokens modernos (el que empieza con `--m-page`), añadir junto a `--m-crit`:

```css
  /* Fondo destructivo con texto blanco: 5,27:1. --m-crit es para texto, no
     llega a contraste como fondo. */
  --m-crit-strong: #c33a3a;
```

- [ ] **Step 2: Crear Card**

Crear `src/components/ui/Card.tsx`:

```tsx
import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Rótulo de la tarjeta. Si falta, la tarjeta es solo superficie. */
  title?: string;
  /** Contenido alineado a la derecha del rótulo. */
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Card({ children, title, action, className, style }: Props) {
  const hasHeader = title !== undefined || action !== undefined;

  return (
    <div className={className ? `m-card ${className}` : "m-card"} style={style}>
      {hasHeader ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 14,
          }}
        >
          {title !== undefined ? <span className="m-label">{title}</span> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Crear Button**

Crear `src/components/ui/Button.tsx`:

```tsx
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
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npx eslint`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/Button.tsx src/app/globals.css
git commit -m "Añade las primitivas Card y Button"
```

---

### Task 2: Modal, y PixelConfirm por dentro

**Files:**
- Create: `src/components/ui/Modal.tsx`
- Modify: `src/components/PixelConfirm.tsx`

- [ ] **Step 1: Crear Modal**

Crear `src/components/ui/Modal.tsx`:

```tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  /** Rótulo accesible del diálogo. */
  label: string;
  title: string;
  children: ReactNode;
  /** Botones de acción, alineados a la derecha. */
  footer: ReactNode;
  onDismiss: () => void;
};

/**
 * Diálogo modal. Se cierra con Escape o pulsando fuera; al abrirse lleva el
 * foco dentro para que no se quede detrás, en la página.
 */
export function Modal({ label, title, children, footer, onDismiss }: Props) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(6, 6, 9, 0.72)",
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--m-surface)",
          border: "1px solid var(--m-line)",
          borderRadius: 12,
          padding: 20,
          outline: "none",
          boxShadow: "0 18px 50px rgba(0, 0, 0, 0.5)",
        }}
      >
        <h2 style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
        <div style={{ fontSize: 13.5, color: "var(--m-ink-2)", lineHeight: 1.55 }}>
          {children}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          {footer}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reescribir el interior de PixelConfirm**

Sustituir **todo** el contenido de `src/components/PixelConfirm.tsx`. El hook y su API no cambian: los tres sitios que lo usan (`HabitToggle`, `TaskCard`, `ProjectTreeItem`) siguen llamando a `confirm({ title, message, confirmLabel })` y pintando `dialog`.

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

type Request = {
  title: string;
  message: string;
  confirmLabel?: string;
};

/**
 * Confirmación propia en vez del `confirm()` del navegador. Devuelve una
 * promesa como el nativo, así que sustituirlo es un cambio de una línea.
 */
export function useConfirm() {
  const [request, setRequest] = useState<Request | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((req: Request) => {
    setRequest(req);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    setRequest(null);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const dismiss = useCallback(() => close(false), [close]);

  const dialog = request ? (
    <Modal
      label={request.title}
      title={request.title}
      onDismiss={dismiss}
      footer={
        <>
          <Button variant="secondary" onClick={dismiss}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => close(true)}>
            {request.confirmLabel ?? "Borrar"}
          </Button>
        </>
      }
    >
      {request.message}
    </Modal>
  ) : null;

  return { confirm, dialog };
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint && npx vitest run`
Expected: sin errores, 74 tests en verde.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Modal.tsx src/components/PixelConfirm.tsx
git commit -m "Añade el Modal moderno y lo usa en la confirmación"
```

---

### Task 3: Iconos de navegación

**Files:**
- Create: `src/components/shell/NavIcons.tsx`

- [ ] **Step 1: Crear los cinco iconos**

Crear `src/components/shell/NavIcons.tsx`:

```tsx
// Iconos de trazo propios. Sin librería: son cinco figuras de una línea cada
// una y una dependencia menos que mantener.

type IconProps = { className?: string };

const SHARED = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconHome({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

export function IconHabits({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconGarden({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M12 21v-7" />
      <path d="M12 14c0-3 2-5 5-5 0 3-2 5-5 5Z" />
      <path d="M12 14c0-3-2-5-5-5 0 3 2 5 5 5Z" />
    </svg>
  );
}

export function IconTasks({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function IconProjects({ className }: IconProps) {
  return (
    <svg {...SHARED} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npx eslint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/NavIcons.tsx
git commit -m "Añade los iconos de trazo de la navegación"
```

---

### Task 4: El armazón

**Files:**
- Create: `src/components/shell/AppShell.tsx`
- Modify: `src/components/SoundToggle.tsx`
- Modify: `src/app/layout.tsx`
- Delete: `src/components/NavBar.tsx`

- [ ] **Step 1: Restilar SoundToggle**

Sustituir el `return` de `src/components/SoundToggle.tsx` (la parte del `<button>`; el `useSyncExternalStore` y la función `toggle` **no se tocan**):

```tsx
  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 7,
        background: "transparent",
        border: "1px solid var(--m-line)",
        color: "var(--m-ink-2)",
        fontSize: 13,
        cursor: "pointer",
      }}
      title={muted ? "Activar sonidos" : "Silenciar"}
      aria-label={muted ? "Activar sonidos" : "Silenciar sonidos"}
      aria-pressed={!muted}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
```

- [ ] **Step 2: Crear AppShell**

Crear `src/components/shell/AppShell.tsx`:

```tsx
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
```

- [ ] **Step 3: Usar el armazón en el layout**

Sustituir el cuerpo de `src/app/layout.tsx`. Cambia el import de `NavBar` por el de `AppShell` y el `<body>`:

```tsx
import { AppShell } from "@/components/shell/AppShell";
```

```tsx
      <body className="min-h-full">
        <AchievementToast />
        <SoundEffects />
        <AppShell>{children}</AppShell>
      </body>
```

El import de `NavBar` desaparece. `AchievementToast` y `SoundEffects` se quedan donde están, fuera del armazón: son capas superpuestas, no navegación.

- [ ] **Step 4: Borrar la barra pixel**

```bash
git rm src/components/NavBar.tsx
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npx eslint && npm run build`
Expected: sin errores. Si `tsc` se queja de que falta `NavBar`, es que algo más la importaba: búscalo con `grep -rn "NavBar" src` y repórtalo en vez de recrear el archivo.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Sustituye la barra pixel por el armazón con lateral y barra inferior"
```

---

### Task 5: Acotar las reglas pixel del body

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/PageShell.tsx`

- [ ] **Step 1: Separar las reglas**

En `src/app/globals.css`, sustituir el bloque `html, body { … }` y el bloque `body { … }` que le sigue por esto:

```css
html,
body {
  background: var(--m-page);
  color: var(--m-ink);
}

body {
  font-family: var(--m-font);
  font-size: 15px;
  line-height: 1.5;
}

/*
  Las reglas de la estética pixel. Estaban en `body`, donde también afectaban a
  las pantallas ya migradas: su texto se pintaba sin suavizado. Las aplica
  PageShell, así que cubren de una vez las pantallas que aún no se han migrado.
*/
.pixel-page {
  font-family: var(--font-vt323), monospace;
  font-size: 1.25rem;
  line-height: 1.4;
  color: var(--color-ink);
  background: var(--color-bg-deep);
  image-rendering: pixelated;
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: grayscale;
  background-image:
    radial-gradient(circle at 25% 25%, rgba(196, 168, 224, 0.05) 1px, transparent 1px),
    radial-gradient(circle at 75% 75%, rgba(168, 200, 232, 0.04) 1px, transparent 1px);
  background-size: 12px 12px, 12px 12px;
  background-position: 0 0, 6px 6px;
}
```

La regla `img { image-rendering: pixelated; }` que hay más abajo se deja como está: no molesta y desaparecerá en la fase 3.

- [ ] **Step 2: Aplicar la clase desde PageShell**

En `src/components/PageShell.tsx`, añadir `pixel-page` al `className` del `<main>`, que queda así:

```tsx
    <main
      className="pixel-page w-full max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-8 untap-page-in"
      style={accent ? ({ ["--accent" as string]: accent } as React.CSSProperties) : undefined}
    >
```

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: build correcto.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/PageShell.tsx
git commit -m "Acota las reglas de suavizado pixel a las pantallas sin migrar"
```

---

### Task 6: Páginas de error

**Files:**
- Modify: `src/app/error.tsx`
- Modify: `src/app/not-found.tsx`

- [ ] **Step 1: Reescribir error.tsx**

Sustituir **todo** el contenido de `src/app/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "64px 16px" }}>
      <Card style={{ textAlign: "center", padding: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Algo se rompió
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--m-ink-2)", marginBottom: 6 }}>
          No hemos podido cargar esta pantalla.
        </p>
        {error.digest ? (
          <p style={{ fontSize: 12, color: "var(--m-ink-3)", marginBottom: 20 }}>
            Código: {error.digest}
          </p>
        ) : (
          <div style={{ height: 14 }} />
        )}
        <Button variant="primary" onClick={() => unstable_retry()}>
          Reintentar
        </Button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Reescribir not-found.tsx**

Sustituir **todo** el contenido de `src/app/not-found.tsx`:

```tsx
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { buttonStyle } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "64px 16px" }}>
      <Card style={{ textAlign: "center", padding: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Esta página no existe
        </h2>
        <p style={{ fontSize: 13.5, color: "var(--m-ink-2)", marginBottom: 20 }}>
          El enlace que has seguido no lleva a ninguna parte.
        </p>
        <Link href="/" style={buttonStyle("primary")}>
          Volver al inicio
        </Link>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint && npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/error.tsx src/app/not-found.tsx
git commit -m "Migra las páginas de error a las primitivas nuevas"
```

---

### Task 7: Cartón de logro

**Files:**
- Modify: `src/components/AchievementToast.tsx`

- [ ] **Step 1: Restilar el cartón**

En `src/components/AchievementToast.tsx` **no se toca la lógica**: ni la cola, ni los `on(...)`, ni los tiempos `SHORT_MS`/`LONG_MS`, ni el tipo `Toast`. Solo cambia lo que se pinta.

Sustituir el `<div className="pixel-window untap-popin" …>` y todo su contenido interno por esto, dejando intacto el `<div className="fixed inset-0 …">` que lo envuelve:

```tsx
      <div
        key={top.key}
        className="untap-popin"
        style={{
          minWidth: "17rem",
          maxWidth: "22rem",
          textAlign: "center",
          background: "var(--m-surface)",
          border: "1px solid var(--m-line)",
          borderRadius: 14,
          padding: "26px 24px",
          boxShadow: "0 22px 60px rgba(0, 0, 0, 0.55)",
          animationDuration: `${duration}ms`,
        }}
      >
        {top.kind === "levelup" ? (
          <>
            <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--m-ink-3)", marginBottom: 10 }}>
              Has subido de nivel
            </div>
            <div className="m-num" style={{ fontSize: 46, fontWeight: 650, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {top.level}
            </div>
          </>
        ) : top.kind === "milestone" ? (
          <>
            <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--m-ink-3)", marginBottom: 10 }}>
              Racha de {top.days} días
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 8 }}>{top.habit}</div>
            <div style={{ fontSize: 13.5, color: "var(--m-good)" }}>+{top.bonus} XP</div>
          </>
        ) : top.kind === "shield" ? (
          <>
            <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--m-ink-3)", marginBottom: 10 }}>
              Escudo usado
            </div>
            <div style={{ fontSize: 15, color: "var(--m-ink)" }}>Tu racha sigue viva</div>
          </>
        ) : top.kind === "anchor" ? (
          <>
            <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--m-ink-3)", marginBottom: 10 }}>
              Hábito ancla
            </div>
            <div style={{ fontSize: 15, color: "var(--m-ink)" }}>Cumplido · bonus extra</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--m-ink-3)", marginBottom: 10 }}>
              Objetivo cumplido
            </div>
            <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 8 }}>{top.label}</div>
            <div style={{ fontSize: 13.5, color: "var(--m-good)" }}>+{top.xp} XP</div>
          </>
        )}
      </div>
```

Los emojis grandes (🎉, 🔥, 🛡️, 👑) desaparecen: eran el vocabulario de juego que se retira. El `emoji` sigue en el tipo `Toast` y en `QUEST_DEFS` porque lo usa el panel de misiones antiguo de `/habits`, que se migra en 2c.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npx eslint`
Expected: sin errores. Si `eslint` avisa de una variable `emoji` sin usar en este archivo, quítala de la desestructuración pero **no** del tipo `Toast`.

- [ ] **Step 3: Commit**

```bash
git add src/components/AchievementToast.tsx
git commit -m "Restila el cartón de logro con el lenguaje moderno"
```

---

### Task 8: Verificación en navegador

**Files:** ninguno, salvo que aparezcan fallos.

- [ ] **Step 1: Arrancar**

Usar `preview_start` con la configuración `untap-dev` de `.claude/launch.json`.

- [ ] **Step 2: Crear datos mínimos**

Hace falta al menos un hábito y una tarea para que las pantallas no estén todas vacías. Crear un hábito desde `/habits` y una tarea desde `/tasks` a través de la interfaz.

- [ ] **Step 3: Recorrer las cinco rutas a 1280 px**

Con `resize_window` a 1280×900, visitar `/`, `/habits`, `/garden`, `/tasks` y `/projects`. En cada una comprobar:

- La lateral se ve y la sección correspondiente está marcada (`aria-current="page"` en un solo enlace).
- No hay desbordamiento horizontal: `document.documentElement.scrollWidth <= window.innerWidth`.

- [ ] **Step 4: Comprobar la ruta desconocida**

Visitar `/ruta-que-no-existe`. Debe salir la página de «Esta página no existe» y **ningún** enlace de navegación debe llevar `aria-current`.

- [ ] **Step 5: Repetir a 375 px y a 768 px**

Con `resize_window` a 375×812 y luego 768×1024:

- Por debajo de 1024 px se ve la barra superior fina y la inferior; la lateral no.
- El contenido no queda tapado por la barra inferior: el último elemento de la página debe quedar por encima del borde superior de la barra.
- Sigue sin haber desbordamiento horizontal.

- [ ] **Step 6: Comprobar el diálogo y el cartón**

- En `/habits`, pulsar el botón de borrar de un hábito: debe salir el diálogo nuevo. Cancelar y comprobar que el hábito sigue.
- Marcar un hábito y comprobar que el cartón de logro sigue apareciendo si se dispara alguno.

- [ ] **Step 7: Revisar consola y servidor**

Usar `read_console_messages` y `preview_logs`.
Expected: sin errores.

- [ ] **Step 8: Captura**

Usar `computer` con `screenshot` y **mirarla**: comprobar que no hay solapes ni cortes.

- [ ] **Step 9: Commit de lo que haya salido**

```bash
git add -A
git commit -m "Corrige lo detectado al verificar el armazón en navegador"
```

Si no ha salido nada, omitir el commit y decirlo en el informe.

---

## Verificación final

```bash
npm test && npx tsc --noEmit && npx eslint && npm run build
```

Expected: 74 tests en verde, sin errores de tipos, lint limpio y build correcto.
