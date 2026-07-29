# Tareas en pixel-kawaii · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repintar la sección de tareas con el sistema pixel-kawaii.

**Architecture:** Casi todo es aplicar decisiones ya tomadas. Lo único nuevo es cómo se marca el estado de una tarea, y se resuelve reusando el sello de «Hecho» de la fila de hábito.

**Tech Stack:** Next 16.2.12 · Tailwind 4 · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-28-tareas-pixel-design.md`

---

## Antes de empezar: lee esto

**No hay test que escribir primero.** Este paso no añade lógica. Lo que sustituye
al ciclo rojo-verde son los **428 tests existentes sin tocarse** y la
**auditoría de contraste sobre el DOM renderizado** de la Tarea 5.

**Las tres reglas del sistema:**

1. **El pastel es fondo o borde, nunca texto.** El texto va en `--color-tinta`.
2. **Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px.** Lo más pequeño va
   en Quicksand.
3. **En una gráfica, la tinta dibuja y el pastel rellena.**

**Contrastes ya medidos:**

```
tinta sobre paper .... 9,76:1     tinta sobre sky ...... 6,87:1
tinta sobre paper-2 .. 9,09:1     tinta sobre peach .... 7,64:1
paper sobre tinta .... 9,76:1     tinta sobre yellow ... 8,49:1
```

**Aquí se ven las barras por primera vez.** `BarChart` se repintó en el paso
anterior sin ningún consumidor en pantalla. `FlowPanel` es el primero. Míralas
de verdad en la Tarea 3: si algo no funciona, corregirlo afecta también a
proyectos.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `tasks/TasksBoard.tsx` | Las tres columnas y sus contadores |
| `tasks/TaskCard.tsx` | Una tarea y sus tres acciones |
| `tasks/FlowPanel.tsx` | Ritmo de cierre, barras y dos métricas |
| `tasks/NewTaskForm.tsx` | El formulario de tarea nueva |
| `app/tareas/page.tsx` | La composición |

---

### Tarea 1: El tablero y sus contadores

Aquí está la única decisión nueva del paso.

**Files:**
- Modify: `src/modules/habitos/components/tasks/TasksBoard.tsx`

- [ ] **Paso 1: Los contadores por estado**

Añade arriba del componente:

```tsx
import type { CSSProperties } from "react";

/*
  El estado de una tarea no es identidad de hábito ni armazón, así que no se
  inventa un color para él: se reusa el vocabulario que ya existe.

  «Hecho» lleva el mismo sello invertido que en la fila de hábito. Que el mismo
  concepto se vea igual en dos pantallas es coherencia de sistema, no adorno.
*/
const CONTADOR: Record<TaskStatus, CSSProperties> = {
  TODO: { background: "var(--color-paper-2)", color: "var(--color-tinta)" },
  IN_PROGRESS: { background: "var(--color-sky)", color: "var(--color-tinta)" },
  DONE: { background: "var(--color-tinta)", color: "var(--color-paper)" },
};

const CONTADOR_BASE: CSSProperties = {
  fontFamily: "var(--font-vt)",
  fontSize: 16,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  padding: "3px 9px",
  borderRadius: 999,
  border: "2px solid var(--color-line)",
};
```

- [ ] **Paso 2: La cabecera de cada columna**

Sustituye el bloque del rótulo y el contador:

```tsx
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            {/* VT323 a 16, su suelo. */}
            <span
              style={{
                fontFamily: "var(--font-vt)",
                fontSize: 16,
                lineHeight: 1,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--color-tinta)",
              }}
            >
              {STATUS_LABEL[status]}
            </span>
            <span style={{ ...CONTADOR_BASE, ...CONTADOR[status] }}>
              {grouped[status].length}
            </span>
          </div>
```

- [ ] **Paso 3: El hueco vacío**

```tsx
              <div
                style={{
                  border: "3px dashed var(--color-line)",
                  borderRadius: "var(--radius-card)",
                  padding: "20px 12px",
                  fontSize: 12.5,
                  color: "var(--color-tinta)",
                  fontFamily: "var(--font-cuerpo)",
                  textAlign: "center",
                }}
              >
                Nada aquí
              </div>
```

- [ ] **Paso 4: Un poco más de aire**

El `gap` de la rejilla sube de 12 a 16, y el de la columna de tarjetas de 8 a 12:
con trazo de 3px y sombra dura, las sombras se muerden con la tarjeta de abajo.

- [ ] **Paso 5: Verificar**

```bash
cd "/c/PROYECTO JUAMPI"
npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Paso 6: Commit**

```bash
git add src/modules/habitos/components/tasks/TasksBoard.tsx
git commit -m "feat(tareas): repintar el tablero y sus contadores"
```

---

### Tarea 2: La tarjeta de tarea

**Files:**
- Modify: `src/modules/habitos/components/tasks/TaskCard.tsx`

- [ ] **Paso 1: Los botones, que son teclas**

Sustituye la constante `MOVE_BUTTON` entera por una cadena de clases:

```tsx
/*
  Los tres botones son teclas del sistema. Van en clases y no en un objeto de
  estilo porque llevan `:active`, `:focus-visible` y `:disabled`, y nada de eso
  se puede escribir en línea.
*/
const MOVE_BUTTON =
  "w-[28px] h-[28px] shrink-0 inline-flex items-center justify-center " +
  "rounded-control border-3 border-line text-tinta text-xs leading-none " +
  "cursor-pointer shadow-hard font-cuerpo " +
  "transition-[transform,box-shadow] duration-75 ease-out " +
  "active:translate-x-0.5 active:translate-y-0.5 " +
  "active:shadow-[2px_2px_0_var(--color-line)] " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
  "disabled:opacity-40 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0";
```

- [ ] **Paso 2: La superficie de la tarjeta**

```tsx
    <div
      style={{
        background: "var(--color-paper)",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-hard)",
        padding: 14,
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        opacity: pending ? 0.5 : 1,
      }}
    >
      {/* Lo hecho se tacha en vez de apagarse de color: sobre papel, bajar el
          tono se come el contraste, y el tachado se ve sin distinguir tonos. */}
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 700,
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {task.title}
      </div>
      {task.description ? (
        <div style={{ fontSize: 12, marginTop: 6 }}>{task.description}</div>
      ) : null}
```

- [ ] **Paso 3: Las tres acciones**

```tsx
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => move(prev)}
          disabled={!prev || pending}
          className={`${MOVE_BUTTON} bg-paper`}
          aria-label={`Mover ${task.title} hacia atrás`}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => move(next)}
          disabled={!next || pending}
          className={`${MOVE_BUTTON} bg-paper`}
          aria-label={`Mover ${task.title} hacia adelante`}
        >
          →
        </button>
        <span style={{ flex: 1 }} />
        {/* Peach es el acento destructivo del armazón, el mismo que en la fila
            de hábito y que la variante `danger` de <Button>. */}
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className={`${MOVE_BUTTON} bg-peach`}
          aria-label={`Borrar ${task.title}`}
        >
          ✕
        </button>
      </div>
```

Se cae el `opacity: prev ? 1 : 0.3` en línea: ahora lo hace `disabled:opacity-40`
de la clase, que además cubre el caso de `pending`.

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Paso 5: Commit**

```bash
git add src/modules/habitos/components/tasks/TaskCard.tsx
git commit -m "feat(tareas): repintar la tarjeta de tarea"
```

---

### Tarea 3: El panel de ritmo, y las barras por fin en pantalla

**Files:**
- Modify: `src/modules/habitos/components/tasks/FlowPanel.tsx`

- [ ] **Paso 1: Pasar el rótulo a la ranura de `Card`**

Sustituye `<Card>` por `<Card title="Ritmo de cierre">` y borra el
`<div className="m-label">Ritmo de cierre</div>`.

- [ ] **Paso 2: La cifra y el cambio**

```tsx
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
          <span
            style={{
              fontFamily: "var(--font-vt)",
              fontSize: 30,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {change.current}
          </span>
          <span style={{ fontSize: 12.5 }}>en 12 semanas</span>
          {change.changePercent === null ? null : change.changePercent === 0 ? (
            <span style={{ fontSize: 12.5 }}>sin cambio</span>
          ) : (
            // Iba en verde o rojo. Ahora lo dicen la flecha y el grosor, igual
            // que en TrendCard.
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>
              {up ? "▲" : "▼"} {Math.abs(change.changePercent)}%
            </span>
          )}
        </div>
        <div style={{ fontSize: 11.5, marginTop: 6 }}>
          {change.changePercent === null
            ? "sin periodo anterior con el que comparar"
            : `frente a ${change.previous} en las 12 semanas anteriores`}
        </div>
```

- [ ] **Paso 3: El tooltip de las barras**

```tsx
            renderTooltip={(i) => (
              <>
                <strong style={{ fontSize: 12.5 }}>
                  Semana del {formatDayLabel(weeks[i].week)}
                </strong>
                <br />
                {/* El tooltip ya fija su tinta. */}
                <span>
                  {weeks[i].count === 1 ? "1 tarea" : `${weeks[i].count} tareas`}
                </span>
              </>
            )}
```

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 5: MIRAR LAS BARRAS**

Este es el paso que el spec marca como riesgo. Con `npm run dev`, abre
`http://127.0.0.1:3000/tareas` y comprueba:

- que las barras se distinguen del fondo de la tarjeta;
- que al pasar el ratón la barra señalada se invierte a tinta maciza y **no hay
  duda de cuál es**;
- que el tooltip aparece y no desborda en los extremos.

Si el contorno de 2px sobre barras estrechas satura, la salida es quitarle el
contorno a las barras y dejar solo el relleno — **no** cambiar el color.

- [ ] **Paso 6: Commit**

```bash
git add src/modules/habitos/components/tasks/FlowPanel.tsx
git commit -m "feat(tareas): repintar el panel de ritmo"
```

---

### Tarea 4: El formulario y la composición

**Files:**
- Modify: `src/modules/habitos/components/tasks/NewTaskForm.tsx`
- Modify: `src/app/tareas/page.tsx`

- [ ] **Paso 1: La superficie del formulario**

En `NewTaskForm.tsx`, añade la constante y quita la clase:

```tsx
/** La superficie de `Card`, a mano: esto es un `<form>` y `Card` es un `<div>`. */
const SUPERFICIE = {
  background: "var(--color-paper)",
  border: "3px solid var(--color-line)",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--shadow-hard)",
  padding: 18,
  color: "var(--color-tinta)",
  fontFamily: "var(--font-cuerpo)",
} as const;
```

```tsx
    <form
      onSubmit={submit}
      style={{ ...SUPERFICIE, display: "flex", flexDirection: "column", gap: 16 }}
    >
```

- [ ] **Paso 2: La composición**

En `src/app/tareas/page.tsx`:

```tsx
    <main
      style={{
        minHeight: "100%",
        padding: "24px 16px 56px",
        background: "var(--color-paper)",
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
      }}
    >
```

Se cae `className="m-root"`. El `gap` del contenedor interior sube de 16 a 20.

Y el estado vacío:

```tsx
          <Card style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              Aún no tienes tareas.
            </p>
            <p style={{ fontSize: 13 }}>
              Crea la primera y esta pantalla empezará a medir tu ritmo.
            </p>
          </Card>
```

- [ ] **Paso 3: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 4: Commit**

```bash
git add src/modules/habitos/components/tasks/NewTaskForm.tsx src/app/tareas/page.tsx
git commit -m "feat(tareas): repintar el formulario y la composicion"
```

---

### Tarea 5: Verificación final

- [ ] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Si `tests/migrar-ledger.test.ts` da timeout, es el flake conocido. Relánzalo.

- [ ] **Paso 2: Que ningún test se haya modificado**

```bash
git diff main --stat -- '*.test.ts'
```
Esperado: vacío.

- [ ] **Paso 3: Contraste y reglas, sobre `/tareas` renderizada**

Con `npm run dev`, en `http://127.0.0.1:3000/tareas`, en la consola:

```js
(() => {
  const PASTELES = { 'rgb(255, 158, 199)':'pink','rgb(196, 181, 253)':'lav',
    'rgb(167, 240, 200)':'mint','rgb(255, 214, 165)':'peach',
    'rgb(165, 216, 255)':'sky','rgb(255, 230, 167)':'yellow' };
  const lum = (rgb) => { const [r,g,b] = rgb.map(c => { c/=255; return c<=0.03928 ? c/12.92 : ((c+0.055)/1.055)**2.4; }); return 0.2126*r+0.7152*g+0.0722*b; };
  const px = (s) => (s.match(/\d+/g)||[255,255,255]).slice(0,3).map(Number);
  const ratio = (a,b) => { const l1=lum(px(a)), l2=lum(px(b)); return +(((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2)); };
  const fondoDe = (el) => { let n = el; while (n) { const b = getComputedStyle(n).backgroundColor; if (b && b !== 'rgba(0, 0, 0, 0)') return b; n = n.parentElement; } return 'rgb(255,255,255)'; };
  const propio = (el) => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  const bajo3 = [], malColor = [], malFuente = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!propio(el)) continue;
    const s = getComputedStyle(el), size = parseFloat(s.fontSize);
    const r = ratio(fondoDe(el), s.color);
    if (r < 3) bajo3.push(`${r}:1 "${el.textContent.trim().slice(0,24)}"`);
    if (PASTELES[s.color]) malColor.push(el.textContent.trim().slice(0,24));
    if (/Press Start 2P/.test(s.fontFamily) && size < 14) malFuente.push('PressStart ' + size);
    if (/VT323/.test(s.fontFamily) && size < 16) malFuente.push('VT323 ' + size);
  }
  return { CONTRASTE: bajo3.length ? bajo3 : 'ok', REGLA1: malColor.length ? malColor : 'ok', REGLA2: malFuente.length ? malFuente : 'ok' };
})()
```

Esperado: los tres en `ok`.

- [ ] **Paso 4: Que el tablero siga haciendo su trabajo**

Con tareas reales: mover una hacia adelante y hacia atrás, comprobar que los
botones de los extremos siguen deshabilitados, y abrir el diálogo de borrar
**sin confirmarlo**.

- [ ] **Paso 5: El resto sigue en pie**

`/`, `/habitos`, `/proyectos`, `/jardin` y `/musica` cargan. Proyectos y jardín
siguen mezclados y eso es lo esperado.

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. Los 428 tests pasan y **ninguno fue modificado**
- [ ] 3. `/tareas` completa en el estilo nuevo, sin `.m-root`
- [ ] 4. Ningún texto bajo 3:1 en la pantalla
- [ ] 5. Ningún pastel como color de texto
- [ ] 6. Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px
- [ ] 7. El tablero conserva columnas, contadores y las tres acciones
- [ ] 8. El resto de secciones sigue funcionando
