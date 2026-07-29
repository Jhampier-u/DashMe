# Proyectos en pixel-kawaii · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repintar proyectos y consolidar la barra de progreso, que está escrita cuatro veces.

**Architecture:** La barra se extrae primero, para no escribir el estilo nuevo dos veces más. Luego el árbol —la pieza grande—, después las tarjetas y el panel, y por último las dos composiciones.

**Tech Stack:** Next 16.2.12 · Tailwind 4 · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-28-proyectos-pixel-design.md`

---

## Antes de empezar: lee esto

**No hay test que escribir primero.** Este paso no añade lógica. Lo sustituyen
los **428 tests existentes sin tocarse** y la auditoría de contraste de la
Tarea 6.

**Las tres reglas del sistema:**

1. **El pastel es fondo o borde, nunca texto.**
2. **Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px.**
3. **En una gráfica, la tinta dibuja y el pastel rellena.**

**El vocabulario de estado ya existe y no se reinventa:** papel para lo
pendiente, `sky` para lo que está en curso, tinta invertida para lo hecho. Es lo
mismo que usan las columnas de tareas y el sello de la fila de hábito.

**Contrastes ya medidos:**

```
tinta sobre paper .... 9,76:1     tinta sobre sky ...... 6,87:1
tinta sobre paper-2 .. 9,09:1     tinta sobre peach .... 7,64:1
paper sobre tinta .... 9,76:1     tinta sobre yellow ... 8,49:1
```

**La Tarea 1 toca dos pantallas ya terminadas.** `DiagnosisPanel` y `QuestList`
solo cambian de implementación, no de aspecto. Si cambian de aspecto, algo se
hizo mal.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `core/ui/ProgressBar.tsx` | **Nuevo.** Carril y relleno, una sola vez |
| `projects/ProjectTreeItem.tsx` | Un nodo del árbol y sus cuatro acciones |
| `projects/ProjectTree.tsx` | La raíz del árbol y el alta de subtarea |
| `projects/ProjectCard.tsx` | Un proyecto en la rejilla |
| `projects/AdvancePanel.tsx` | Ritmo de avance y sus barras |
| `projects/NewProjectForm.tsx` | El formulario de proyecto nuevo |
| `app/proyectos/page.tsx` · `app/proyectos/[id]/page.tsx` | Las dos composiciones |

---

### Tarea 1: La barra de progreso, una sola vez

**Files:**
- Create: `src/modules/core/ui/ProgressBar.tsx`
- Modify: `src/modules/habitos/components/habits/DiagnosisPanel.tsx`
- Modify: `src/modules/habitos/components/home/QuestList.tsx`

- [ ] **Paso 1: Crear el componente**

`src/modules/core/ui/ProgressBar.tsx`:

```tsx
/**
 * Carril y relleno. Estaba escrito cuatro veces con la misma forma.
 *
 * El carril lleva trazo propio: sin él, una barra al 4% sobre papel sería un
 * punto perdido en el aire. El relleno va en pastel porque es superficie, que
 * es justo el papel que la regla dura le reserva.
 */
export function ProgressBar({
  /** De 0 a 1. Se acota, así que un valor fuera de rango no rompe el dibujo. */
  value,
  /** Color del relleno. Pastel o tinta, nunca un tono de texto. */
  fill = "var(--color-sky)",
  height = 12,
}: {
  value: number;
  fill?: string;
  height?: number;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <div
      style={{
        height,
        background: "var(--color-paper-2)",
        border: "2px solid var(--color-line)",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div style={{ height: "100%", width: `${percent}%`, background: fill }} />
    </div>
  );
}
```

- [ ] **Paso 2: Usarlo en `DiagnosisPanel`**

Añade `import { ProgressBar } from "@/modules/core/ui/ProgressBar";`, borra la
constante `PISTA` y sustituye el bloque de la barra por:

```tsx
                <ProgressBar
                  value={habit.rate ?? 0}
                  fill={(habit.rate ?? 0) < 0.5 ? "var(--color-peach)" : "var(--color-sky)"}
                />
```

- [ ] **Paso 3: Usarlo en `QuestList`**

Añade el mismo import y sustituye el bloque de la barra por:

```tsx
            <ProgressBar
              value={ratio}
              height={10}
              fill={q.completed ? "var(--color-tinta)" : "var(--color-sky)"}
            />
```

- [ ] **Paso 4: Verificar que NO cambia el aspecto**

```bash
cd "/c/PROYECTO JUAMPI"
npx tsc --noEmit && npm run lint && npx vitest run
```

Con `npm run dev`, abre `/habitos` y `/` y comprueba en la consola que las
barras siguen midiendo lo mismo:

```js
[...document.querySelectorAll('div')]
  .filter(d => getComputedStyle(d).borderRadius === '999px' && getComputedStyle(d).overflow === 'hidden')
  .map(d => {
    const s = getComputedStyle(d);
    const hijo = d.firstElementChild;
    const r = hijo ? getComputedStyle(hijo) : null;
    return `${s.height} carril:${s.backgroundColor} borde:${s.borderTopWidth} relleno:${r?.backgroundColor} ${r?.width}`;
  })
```

Esperado en `/habitos`: altura 12px, carril `rgb(255, 234, 246)`, borde 2px.
Esperado en `/`: altura 10px para las de objetivos.

- [ ] **Paso 5: Commit**

```bash
git add src/modules/core/ui/ProgressBar.tsx src/modules/habitos/components/habits/DiagnosisPanel.tsx src/modules/habitos/components/home/QuestList.tsx
git commit -m "refactor(ui): extraer la barra de progreso"
```

---

### Tarea 2: El árbol de subtareas

La pieza grande, y donde está la decisión del paso.

**Files:**
- Modify: `src/modules/habitos/components/projects/ProjectTreeItem.tsx`

- [ ] **Paso 1: El estado, por relleno en vez de por tinte**

Sustituye `STATUS_COLOR` por el relleno, y añade la clase de los botones:

```tsx
/*
  La forma ya dice el estado —círculo vacío, medio y lleno—, así que el color
  era redundante. El glifo pasa a tinta y lo que marca el estado es el relleno
  del botón, con el mismo vocabulario que las columnas de tareas y el sello de
  la fila de hábito.
*/
const STATUS_FILL: Record<ProjectItemStatus, string> = {
  TODO: "var(--color-paper)",
  IN_PROGRESS: "var(--color-sky)",
  DONE: "var(--color-tinta)",
};

const STATUS_INK: Record<ProjectItemStatus, string> = {
  TODO: "var(--color-tinta)",
  IN_PROGRESS: "var(--color-tinta)",
  DONE: "var(--color-paper)",
};
```

Borra `STATUS_COLOR` entero.

- [ ] **Paso 2: Los botones, que son teclas**

Sustituye la constante `ICON_BUTTON` entera:

```tsx
/*
  Van en clases y no en un objeto de estilo porque llevan `:active`,
  `:focus-visible` y `:disabled`, y nada de eso se puede escribir en línea.

  26px y no 28 como en tareas: el árbol pone cuatro botones por nodo y los
  nodos se anidan.
*/
const ICON_BUTTON =
  "w-[26px] h-[26px] shrink-0 inline-flex items-center justify-center " +
  "rounded-control border-3 border-line text-tinta text-[11px] leading-none " +
  "cursor-pointer font-cuerpo " +
  "transition-transform duration-75 ease-out active:translate-x-px active:translate-y-px " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
  "disabled:opacity-40";

/*
  El campo de edición en línea. Está escrito igual aquí y en `ProjectTree`, así
  que se comparte desde un solo sitio.
*/
export const CAMPO_LINEA =
  "flex-1 min-w-0 bg-paper-2 text-tinta font-cuerpo text-[13.5px] " +
  "border-3 border-line rounded-control px-2.5 py-1.5 " +
  "placeholder:text-tinta-2 " +
  "outline-none focus:outline-3 focus:outline-offset-2 focus:outline-line";
```

**Sin sombra dura en estos botones**, al contrario que en tareas: cuatro por
nodo y anidados, la sombra convertiría el árbol en una pared. El hundido se
queda en 1px.

- [ ] **Paso 3: Los cuatro botones y el título**

```tsx
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${ICON_BUTTON} bg-paper`}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
          aria-label={open ? `Contraer ${node.title}` : `Expandir ${node.title}`}
          aria-expanded={open}
        >
          {open ? "▾" : "▸"}
        </button>

        <button
          type="button"
          onClick={cycle}
          disabled={pending}
          className={ICON_BUTTON}
          style={{
            background: STATUS_FILL[node.status],
            color: STATUS_INK[node.status],
            fontSize: 13,
          }}
          aria-label={`${node.title}: ${STATUS_NAME[node.status]}. Pulsa para cambiar de estado`}
        >
          {STATUS_MARK[node.status]}
        </button>

        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={200}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") {
                setEditing(false);
                setDraft(node.title);
              }
            }}
            className={CAMPO_LINEA}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              flex: 1,
              textAlign: "left",
              background: "transparent",
              border: 0,
              padding: "5px 0",
              fontFamily: "var(--font-cuerpo)",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              color: "var(--color-tinta)",
              textDecoration: node.status === "DONE" ? "line-through" : "none",
            }}
            aria-label={`Renombrar ${node.title}`}
          >
            {node.title}
            {hasChildren ? (
              // El contador es un dato: VT323 en su suelo de 16px.
              <span
                style={{
                  fontFamily: "var(--font-vt)",
                  fontSize: 16,
                  fontVariantNumeric: "tabular-nums",
                  marginLeft: 8,
                }}
              >
                {node.children.filter((c) => c.status === "DONE").length}/
                {node.children.length}
              </span>
            ) : null}
          </button>
        )}

        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={pending}
          className={`${ICON_BUTTON} bg-paper`}
          aria-label={`Añadir subtarea dentro de ${node.title}`}
        >
          +
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className={`${ICON_BUTTON} bg-peach`}
          aria-label={`Borrar ${node.title}`}
        >
          ✕
        </button>
```

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Paso 5: Commit**

```bash
git add src/modules/habitos/components/projects/ProjectTreeItem.tsx
git commit -m "feat(proyectos): repintar el arbol de subtareas"
```

---

### Tarea 3: La raíz del árbol

**Files:**
- Modify: `src/modules/habitos/components/projects/ProjectTree.tsx`

- [ ] **Paso 1: Reusar el campo compartido**

Añade `import { ProjectTreeItem, CAMPO_LINEA } from "./ProjectTreeItem";` —
sustituyendo el import actual— y en el `<input>` cambia el `style` entero por
`className={CAMPO_LINEA}`.

- [ ] **Paso 2: El texto vacío**

```tsx
        <p style={{ fontSize: 13, padding: "12px 0" }}>
          Sin subtareas todavía. Añade la primera y empieza a anidar.
        </p>
```

- [ ] **Paso 3: Verificar y commit**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
git add src/modules/habitos/components/projects/ProjectTree.tsx
git commit -m "feat(proyectos): repintar la raiz del arbol"
```

---

### Tarea 4: La tarjeta y el panel de ritmo

**Files:**
- Modify: `src/modules/habitos/components/projects/ProjectCard.tsx`
- Modify: `src/modules/habitos/components/projects/AdvancePanel.tsx`

- [ ] **Paso 1: `ProjectCard`, la superficie y el botón**

Sustituye el `<div className="m-card">` de apertura:

```tsx
    <div
      style={{
        background: "var(--color-paper)",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-hard)",
        padding: 16,
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        opacity: pending ? 0.5 : 1,
        position: "relative",
      }}
    >
```

El enlace del nombre pierde su color —lo hereda— y el botón de borrar pasa a
tecla:

```tsx
        <Link
          href={`/proyectos/${project.id}`}
          style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, textDecoration: "none" }}
        >
          {project.name}
        </Link>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className={
            "w-[26px] h-[26px] shrink-0 inline-flex items-center justify-center " +
            "rounded-control border-3 border-line bg-peach text-tinta text-[11px] leading-none " +
            "cursor-pointer font-cuerpo " +
            "transition-transform duration-75 ease-out active:translate-x-px active:translate-y-px " +
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
            "disabled:opacity-40"
          }
          aria-label={`Borrar el proyecto ${project.name}`}
        >
          ✕
        </button>
```

- [ ] **Paso 2: `ProjectCard`, los números y la barra**

Añade `import { ProgressBar } from "@/modules/core/ui/ProgressBar";` y
sustituye:

```tsx
      <p style={{ fontSize: 12.5, marginTop: 8, minHeight: 18 }}>
        {project.description ?? "Sin descripción"}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: "var(--font-vt)",
          fontSize: 16,
          fontVariantNumeric: "tabular-nums",
          marginTop: 12,
          marginBottom: 8,
        }}
      >
        <span>
          {project.doneItems} de {project.totalItems}
        </span>
        <span>{Math.round(percent * 100)}%</span>
      </div>

      <ProgressBar value={percent} />

      {/* El aviso iba en ámbar. Ahora lo dicen el ▲ que ya llevaba y el grosor. */}
      <div style={{ fontSize: 11.5, fontWeight: stale ? 700 : 400, marginTop: 12 }}>
        {stale ? "▲ " : ""}
        {movement}
      </div>
```

- [ ] **Paso 3: `AdvancePanel`**

Rótulo a la ranura de `Card`, y el resto igual que en `FlowPanel`:

```tsx
    <Card title="Ritmo de avance">
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
        <span style={{ fontSize: 12.5 }}>subtareas en 12 semanas</span>
        {change.changePercent === null ? null : change.changePercent === 0 ? (
          <span style={{ fontSize: 12.5 }}>sin cambio</span>
        ) : (
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

Y en el tooltip de las barras, el `<span style={{ color: "var(--m-ink-2)" }}>`
pasa a `<span>`: el tooltip ya fija su tinta.

Borra el `<div className="m-label">Ritmo de avance</div>`.

- [ ] **Paso 4: Verificar y commit**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
git add src/modules/habitos/components/projects
git commit -m "feat(proyectos): repintar la tarjeta y el panel de ritmo"
```

---

### Tarea 5: El formulario y las dos composiciones

**Files:**
- Modify: `src/modules/habitos/components/projects/NewProjectForm.tsx`
- Modify: `src/app/proyectos/page.tsx`
- Modify: `src/app/proyectos/[id]/page.tsx`

- [ ] **Paso 1: El formulario**

Igual que en `NewHabitForm` y `NewTaskForm`: añade la constante `SUPERFICIE` y
sustituye `className="m-card"` por `style={{ ...SUPERFICIE, ... }}`.

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

Los `var(--m-*)` que queden en sus textos se quitan para que hereden.

- [ ] **Paso 2: La rejilla**

En `src/app/proyectos/page.tsx`, el mismo contenedor que las demás pantallas:

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

Se cae `className="m-root"` y el `gap` del contenedor interior sube a 20. Los
`var(--m-*)` restantes se quitan.

- [ ] **Paso 3: El detalle**

En `src/app/proyectos/[id]/page.tsx`, el mismo `<main>` que arriba. Además:

```tsx
        <Link href="/proyectos" style={{ fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
          ← Proyectos
        </Link>
```

```tsx
            {/* El nombre lo escribe el usuario, así que parte de línea en vez
                de desbordar. 14px es el suelo de Press Start 2P. */}
            <h1
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 14,
                lineHeight: 1.6,
                overflowWrap: "anywhere",
              }}
            >
              {project.name}
            </h1>
```

```tsx
          {project.description ? (
            <p style={{ fontSize: 13.5, marginTop: 8 }}>{project.description}</p>
          ) : null}
```

Y la barra de la tarjeta de progreso:

```tsx
            <span style={{ fontFamily: "var(--font-vt)", fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
              {doneItems} de {totalItems} · {Math.round(percent * 100)}%
            </span>
            <span style={{ fontSize: 11.5 }}>{movement}</span>
          </div>
          <ProgressBar value={percent} />
```

con `import { ProgressBar } from "@/modules/core/ui/ProgressBar";`.

- [ ] **Paso 4: Verificar y commit**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
git add src/modules/habitos/components/projects/NewProjectForm.tsx src/app/proyectos
git commit -m "feat(proyectos): repintar el formulario y las dos composiciones"
```

---

### Tarea 6: Verificación final

- [ ] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Si `tests/migrar-ledger.test.ts` da timeout, es el flake conocido. Relánzalo.

- [ ] **Paso 2: Que ningún test se haya modificado y no queden `--m-*`**

```bash
git diff main --stat -- '*.test.ts'
grep -rn "var(--m-\|m-card\|m-root\|m-label\|m-num" src/app/proyectos src/modules/habitos/components/projects || echo "ninguno"
```

- [ ] **Paso 3: Contraste y reglas, en las dos pantallas**

Con `npm run dev`, ejecuta esto en `/proyectos` **y** en el detalle de un
proyecto:

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
  return { ruta: location.pathname, CONTRASTE: bajo3.length ? bajo3 : 'ok', REGLA1: malColor.length ? malColor : 'ok', REGLA2: malFuente.length ? malFuente : 'ok' };
})()
```

- [ ] **Paso 4: Que la consolidación no cambiara nada**

Vuelve a `/habitos` y a `/` y comprueba que las barras de diagnóstico y de
objetivos siguen viéndose igual que antes. **Es el riesgo del spec.**

- [ ] **Paso 5: Que el árbol siga funcionando**

En el detalle de un proyecto: plegar y desplegar un nodo, cambiar el estado de
una subtarea y **devolverlo al que estaba** dando la vuelta al ciclo, y abrir el
diálogo de borrar **sin confirmarlo**.

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. Los 428 tests pasan y **ninguno fue modificado**
- [ ] 3. Las dos pantallas sin `.m-root` y con fondo de papel
- [ ] 4. Ningún texto bajo 3:1 en ninguna de las dos
- [ ] 5. Ningún pastel como texto; suelos de fuente respetados
- [ ] 6. El árbol conserva jerarquía, estados, contadores y sus cuatro acciones
- [ ] 7. Una sola implementación de la barra, usada en cuatro sitios
- [ ] 8. `/habitos` y la portada se ven igual que antes de la consolidación
