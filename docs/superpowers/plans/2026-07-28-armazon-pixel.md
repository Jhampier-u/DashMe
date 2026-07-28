# El armazón en pixel-kawaii · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repintar la navegación, el toast y las pantallas de error con el sistema pixel-kawaii, y voltear el fondo del documento a papel.

**Architecture:** Los tokens y los seis componentes base ya existen. Esto es aplicarlos: `AppShell` y `SoundToggle` pasan a utilidades de Tailwind sobre `@theme`, el toast y los errores a estilos en línea con `var(--color-*)`. El fondo global cambia en `globals.css` y las secciones sin repintar se protegen solas con su `.m-root`.

**Tech Stack:** Next 16.2.12 · Tailwind 4 · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-28-armazon-pixel-design.md`

---

## Antes de empezar: lee esto

**Aquí no hay test que escribir primero, y no es un descuido.** Este paso no
añade ni una línea de lógica: cambia colores, trazos y fuentes. No hay
comportamiento nuevo que un test pueda afirmar. Lo que sustituye al ciclo rojo-
verde es doble: los **428 tests existentes siguen pasando sin tocarse** —si uno
se pone en rojo, el cambio dejó de ser visual e hiciste algo que no tocaba— y la
**auditoría de las dos reglas duras sobre el DOM renderizado** de la Tarea 5,
que es más fuerte que un grep del fuente porque mide lo que el navegador pinta.

**Las dos reglas duras del sistema, que gobiernan cada decisión:**

1. **El pastel es fondo o borde, nunca texto.** El texto va siempre en
   `--color-tinta`. `--color-tinta-2` mide 4,00:1 y solo vale para texto grande
   (≥24px, o ≥18,66px en negrita); por debajo de eso, tinta plena.
2. **Press Start 2P nunca por debajo de 14px, VT323 nunca por debajo de 16px.**
   Por debajo son ilegibles. Si algo no cabe, se acorta el texto — no se encoge
   la fuente. Lo que necesite ser más pequeño va en Quicksand.

**Contrastes ya medidos, por si dudas** (los afirma `contraste.test.ts`):

```
tinta sobre paper .... 9,76:1     tinta sobre sky ...... 6,87:1
tinta sobre paper-2 .. 9,09:1     tinta sobre peach .... 7,64:1
paper sobre tinta .... 9,76:1     tinta sobre yellow ... 8,49:1
```

**Al terminar seguirá viéndose mezclado, y peor que ahora.** Un armazón claro
enmarcando cinco secciones oscuras choca más que el estado actual. Es el precio
de ir por pasos y está aceptado en el spec. No repintes nada más «ya que estás»:
la portada está a un clic y no entra.

**Next 16 no es el Next que crees conocer.** Consulta `node_modules/next/dist/docs/`
antes de tocar layouts.

---

## Estructura de archivos

| Archivo | Responsabilidad | Qué cambia |
|---|---|---|
| `src/app/globals.css` | Fondo y tinta del documento | Dos valores |
| `src/modules/core/shell/AppShell.tsx` | Lateral, barras móviles y los dos tipos de enlace | Superficies, ítem activo, logotipo |
| `src/modules/core/shell/NavIcons.tsx` | Las seis figuras de la navegación | Solo `strokeWidth` |
| `src/modules/habitos/components/SoundToggle.tsx` | Interruptor de sonido | Pasa a tecla del sistema |
| `src/modules/habitos/components/AchievementToast.tsx` | Aviso de logro, encima de todo | Superficie y las cinco variantes |
| `src/app/error.tsx` · `src/app/not-found.tsx` | Pantallas de error | Tinta y títulos pixelados |

---

### Tarea 1: El fondo del documento

Va primero a propósito: todo lo que repintes después hay que juzgarlo contra el
fondo definitivo, no contra el que se va.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Paso 1: Comprobar que `.m-root` protege a las secciones pendientes**

```bash
cd "/c/PROYECTO JUAMPI"
grep -A4 "^\.m-root" src/app/globals.css
```

Esperado: el bloque declara `background: var(--m-page)` y `color: var(--m-ink)`.
**Si no los declarara, para y dilo:** sin eso, voltear el fondo deja texto casi
blanco sobre papel en cinco secciones, que es ilegible.

- [ ] **Paso 2: Voltear el fondo**

En `src/app/globals.css`, sustituye el bloque `html, body`:

```css
/*
  El documento ya es de papel. Las secciones que aún no se han repintado no se
  rompen: cada una monta su contenido dentro de un `.m-root`, que impone su
  propio fondo oscuro y su propia tinta clara. Es el mismo mecanismo que las
  protegió mientras se repintaba hábitos, usado ahora al revés.
*/
html,
body {
  background: var(--color-paper);
  color: var(--color-tinta);
}
```

- [ ] **Paso 3: Verificar**

```bash
npx tsc --noEmit && npx vitest run && npm run build
```
Esperado: limpio, 428 tests, build correcto.

- [ ] **Paso 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): el documento pasa a fondo de papel"
```

---

### Tarea 2: La navegación

**Files:**
- Modify: `src/modules/core/shell/AppShell.tsx` (164 líneas)
- Modify: `src/modules/core/shell/NavIcons.tsx` (solo una constante)
- Modify: `src/modules/habitos/components/SoundToggle.tsx` (46 líneas)

- [ ] **Paso 1: Engordar el trazo de los iconos**

En `src/modules/core/shell/NavIcons.tsx`, dentro del objeto `SHARED`:

```ts
  strokeWidth: 2.5,
```

Sustituye el `1.6` actual. **No subas a 3:** a 24×24, un trazo de 3px cierra los
huecos interiores de la casa y la carpeta y las convierte en manchas.

- [ ] **Paso 2: Repintar las tres superficies del armazón**

En `src/modules/core/shell/AppShell.tsx`, amplía el import de tipos que ya
existe —no añadas una segunda línea de import del mismo módulo:

```tsx
import type { ComponentType, CSSProperties, ReactNode } from "react";
```

Y añade la constante debajo de `NAV_ITEMS`:

```tsx
/*
  Las tres superficies del armazón comparten piel. El trazo sube de 1px
  translúcido a los 3px macizos del sistema: es el borde que separa la
  navegación del contenido y ahora se ve.
*/
const SUPERFICIE: CSSProperties = {
  background: "var(--color-paper)",
  color: "var(--color-tinta)",
  fontFamily: "var(--font-cuerpo)",
};
```

Sustituye los tres `style` de contenedor:

```tsx
// <aside>
style={{ ...SUPERFICIE, borderRight: "3px solid var(--color-line)" }}

// <header> móvil
style={{ ...SUPERFICIE, borderBottom: "3px solid var(--color-line)" }}

// <nav> inferior móvil
style={{
  ...SUPERFICIE,
  borderTop: "3px solid var(--color-line)",
  paddingBottom: "env(safe-area-inset-bottom)",
}}
```

- [ ] **Paso 3: El logotipo en Press Start 2P**

Los dos enlaces «Dashboard» (el de la lateral y el de la barra móvil) llevan el
mismo estilo:

```tsx
style={{
  fontFamily: "var(--font-pixel)",
  fontSize: 14,
  lineHeight: 1.5,
  color: "var(--color-tinta)",
  textDecoration: "none",
}}
```

14px es el suelo de la fuente. «Dashboard» son nueve caracteres y la lateral
mide 208px menos 24 de padding: cabe con holgura.

- [ ] **Paso 4: El ítem activo, relleno en vez de teñido**

Sustituye el cuerpo de `SidebarLink`:

```tsx
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
```

Y el de `BottomLink`:

```tsx
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
```

El rótulo de 10px se queda en Quicksand: por debajo de 16px, VT323 no se lee.

- [ ] **Paso 5: `SoundToggle` pasa a tecla**

Sustituye el `style` del botón por clases:

```tsx
      className={
        "w-[30px] h-[30px] inline-flex items-center justify-center " +
        "rounded-control border-3 border-line bg-paper text-tinta text-[13px] " +
        "cursor-pointer shadow-hard font-cuerpo " +
        "transition-[transform,box-shadow] duration-75 ease-out " +
        "active:translate-x-0.5 active:translate-y-0.5 " +
        "active:shadow-[2px_2px_0_var(--color-line)] " +
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line"
      }
```

Borra el atributo `style` entero. **No toques `aria-pressed`, `title` ni
`aria-label`:** son lo que comunica el estado sin depender del icono.

- [ ] **Paso 6: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 7: Comprobar en el navegador**

```bash
npm run dev
```

Con la ventana ancha y estrecha, comprueba: la sección activa se distingue de
un vistazo en las dos barras, el logotipo se lee, y el interruptor de sonido se
hunde al pulsarlo.

- [ ] **Paso 8: Commit**

```bash
git add src/modules/core/shell src/modules/habitos/components/SoundToggle.tsx
git commit -m "feat(ui): repintar la navegacion del armazon"
```

---

### Tarea 3: El toast de logro

**Files:**
- Modify: `src/modules/habitos/components/AchievementToast.tsx` (127 líneas)

- [ ] **Paso 1: Extraer el rótulo, que se repite cinco veces**

Amplía el import de React que ya existe —no añadas una segunda línea:

```tsx
import { useEffect, useState, type CSSProperties } from "react";
```

Y añade las dos constantes junto a `SHORT_MS` y `LONG_MS`:

```tsx
/*
  El rótulo de las cinco variantes era el mismo objeto copiado cinco veces.
  Ahora es uno. Va en tinta plena: a 12px, tinta-2 no llega a AA.
*/
const ROTULO: CSSProperties = {
  fontFamily: "var(--font-cuerpo)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--color-tinta)",
  marginBottom: 10,
};

/*
  El premio en XP iba en verde. El verde como color de texto está prohibido por
  la regla dura, así que pasa a sello: fondo amarillo con la tinta encima
  (8,49:1). Celebra igual y además se lee sin distinguir tonos.
*/
const PREMIO: CSSProperties = {
  display: "inline-block",
  fontFamily: "var(--font-vt)",
  fontSize: 18,
  lineHeight: 1,
  color: "var(--color-tinta)",
  background: "var(--color-yellow)",
  border: "2px solid var(--color-line)",
  borderRadius: 999,
  padding: "4px 10px",
};
```

- [ ] **Paso 2: Repintar el panel**

Sustituye el `style` del `div` con `className="untap-popin"`:

```tsx
        style={{
          minWidth: "17rem",
          maxWidth: "22rem",
          textAlign: "center",
          background: "var(--color-paper)",
          border: "3px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
          padding: "26px 24px",
          boxShadow: "var(--shadow-hard)",
          color: "var(--color-tinta)",
          fontFamily: "var(--font-cuerpo)",
          animationDuration: `${duration}ms`,
        }}
```

**No toques `animationDuration`.** La animación cubre toda la vida del toast y
su duración se inyecta desde aquí; si la quitas, el aviso se desvanece y vuelve
a aparecer.

- [ ] **Paso 3: Repintar las cinco variantes**

Sustituye el bloque completo de variantes:

```tsx
        {top.kind === "levelup" ? (
          <>
            <div style={ROTULO}>Has subido de nivel</div>
            <div
              style={{
                fontFamily: "var(--font-vt)",
                fontSize: 46,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {top.level}
            </div>
          </>
        ) : top.kind === "milestone" ? (
          <>
            <div style={ROTULO}>Racha de {top.days} días</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 12 }}>
              {top.habit}
            </div>
            <div style={PREMIO}>+{top.bonus} XP</div>
          </>
        ) : top.kind === "shield" ? (
          <>
            <div style={ROTULO}>Escudo usado</div>
            <div style={{ fontSize: 15 }}>Tu racha sigue viva</div>
          </>
        ) : top.kind === "anchor" ? (
          <>
            <div style={ROTULO}>Hábito ancla</div>
            <div style={{ fontSize: 15 }}>Cumplido · bonus extra</div>
          </>
        ) : (
          <>
            <div style={ROTULO}>Objetivo cumplido</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 12 }}>
              {top.label}
            </div>
            <div style={PREMIO}>+{top.xp} XP</div>
          </>
        )}
```

Las cinco variantes siguen siendo cinco. La cola, los temporizadores y
`aria-live="polite"` no se tocan.

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Paso 5: Verlo de verdad**

El toast solo aparece al ganar XP, así que con datos reales no se ve casi nunca.
Fuérzalo temporalmente. En `AchievementToast` hay una línea

```tsx
  const top = queue[0];
```

Sustitúyela —no añadas otra `const top`, no compilaría— por:

```tsx
  // SONDA TEMPORAL — borrar tras mirar las cinco variantes.
  const top = {
    kind: "milestone",
    key: 1,
    habit: "Leer 30 minutos",
    days: 7,
    bonus: 50,
  } as Toast;
```

Ve pasando por las cinco cambiando ese objeto:

```tsx
  { kind: "levelup",   key: 1, level: 4 }
  { kind: "milestone", key: 1, habit: "Leer 30 minutos", days: 7, bonus: 50 }
  { kind: "shield",    key: 1 }
  { kind: "anchor",    key: 1 }
  { kind: "quest",     key: 1, label: "Completa 3 hábitos hoy", xp: 30, emoji: "✅" }
```

Con la sonda puesta el toast no se va nunca, que es justo lo que quieres para
mirarlo con calma. **Restaura `const top = queue[0];` antes de seguir** y
comprueba con `git diff` que no queda rastro.

- [ ] **Paso 6: Commit**

```bash
git add src/modules/habitos/components/AchievementToast.tsx
git commit -m "feat(ui): repintar el toast de logro"
```

---

### Tarea 4: Las pantallas de error

**Files:**
- Modify: `src/app/error.tsx` (40 líneas)
- Modify: `src/app/not-found.tsx` (21 líneas)

Las dos ya usan `Card` y `Button`, repintados en el paso anterior. Les quedan
los `var(--m-*)` del texto y unos títulos que pueden pasar a pixelada.

- [ ] **Paso 1: `error.tsx`**

Sustituye el contenido de la `Card`:

```tsx
        <h2
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 14,
            overflowWrap: "anywhere",
          }}
        >
          Algo se rompió
        </h2>
        <p style={{ fontSize: 13.5, marginBottom: 6 }}>
          No hemos podido cargar esta pantalla.
        </p>
        {error.digest ? (
          <p style={{ fontFamily: "var(--font-vt)", fontSize: 16, marginBottom: 20 }}>
            Código: {error.digest}
          </p>
        ) : (
          <div style={{ height: 14 }} />
        )}
```

El código de error es un dato, así que va en VT323 a 16px, su suelo.

- [ ] **Paso 2: `not-found.tsx`**

```tsx
        <h2
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 14,
            overflowWrap: "anywhere",
          }}
        >
          Esta página no existe
        </h2>
        <p style={{ fontSize: 13.5, marginBottom: 20 }}>
          El enlace que has seguido no lleva a ninguna parte.
        </p>
```

Cuatro palabras, que es el máximo del spec para Press Start 2P.

- [ ] **Paso 3: Verificar**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Comprueba la de 404 visitando cualquier ruta inventada, p. ej. `/no-existe`.

- [ ] **Paso 4: Commit**

```bash
git add src/app/error.tsx src/app/not-found.tsx
git commit -m "feat(ui): repintar las pantallas de error"
```

---

### Tarea 5: Verificación final

- [ ] **Paso 1: Los cuatro comandos**

```bash
cd "/c/PROYECTO JUAMPI"
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

**Si `tests/migrar-ledger.test.ts` da timeout, es un flake conocido** y no tiene
relación con esto: no importa nada de UI. Vuelve a lanzarlo solo.

- [ ] **Paso 2: Que ningún test se haya modificado**

```bash
git diff main --stat -- '*.test.ts'
```
Esperado: vacío. Este paso no toca ni añade tests.

- [ ] **Paso 3: Las dos reglas duras, sobre el DOM renderizado**

Con `npm run dev` levantado, abre `http://127.0.0.1:3000/` y ejecuta esto en la
consola del navegador. Audita el armazón, que es lo que vive fuera de `main`:

```js
(() => {
  const PASTELES = { 'rgb(255, 158, 199)':'pink','rgb(196, 181, 253)':'lav',
    'rgb(167, 240, 200)':'mint','rgb(255, 214, 165)':'peach',
    'rgb(165, 216, 255)':'sky','rgb(255, 230, 167)':'yellow' };
  const propio = (el) => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const malColor = [], malFuente = [];
  for (const el of document.querySelectorAll('aside *, header *, nav *')) {
    const s = getComputedStyle(el), size = parseFloat(s.fontSize);
    if (!propio(el)) continue;
    if (PASTELES[s.color]) malColor.push(el.textContent.trim().slice(0, 24));
    if (/Press Start 2P/.test(s.fontFamily) && size < 14) malFuente.push('PressStart ' + size);
    if (/VT323/.test(s.fontFamily) && size < 16) malFuente.push('VT323 ' + size);
  }
  return { REGLA1: malColor.length ? malColor : 'ok', REGLA2: malFuente.length ? malFuente : 'ok' };
})()
```

Esperado: `{ REGLA1: 'ok', REGLA2: 'ok' }`.

- [ ] **Paso 4: Las secciones pendientes siguen legibles**

Recorre `/`, `/tareas`, `/proyectos`, `/jardin` y `/musica`. Van a verse
mezcladas —armazón claro, contenido oscuro— **y eso es lo esperado**. Lo que no
puede pasar es que alguna quede con texto claro sobre fondo claro: eso
significaría que perdió su `.m-root` y hay que investigarlo.

Comprueba también que `/habitos`, que ya está en pixel, sigue intacta.

- [ ] **Paso 5: El toast, una última vez**

```bash
grep -rn "SONDA" src/ || echo "sin restos de sonda"
```
Esperado: sin restos.

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. Los 428 tests pasan y **ninguno fue modificado**
- [ ] 3. `html, body` en papel, y las secciones sin repintar siguen legibles
- [ ] 4. La navegación completa en el estilo nuevo, en escritorio y en móvil
- [ ] 5. Ningún pastel usado como color de texto en el armazón
- [ ] 6. Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px
- [ ] 7. El toast conserva sus cinco variantes, su cola y su animación
- [ ] 8. `/habitos` intacta; el resto de secciones carga y funciona
