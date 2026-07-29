# La portada y las gráficas en pixel-kawaii · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fijar cómo se dibujan los datos en el sistema pixel y repintar la portada con ello.

**Architecture:** El tooltip duplicado se extrae primero a un componente compartido, para no escribir el estilo nuevo dos veces. Luego las dos gráficas, luego las tarjetas de la portada, y por último la composición. La matemática de `lib/chart.ts` no se toca.

**Tech Stack:** Next 16.2.12 · Tailwind 4 · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-28-portada-graficas-design.md`

---

## Antes de empezar: lee esto

**No hay test que escribir primero y no es un descuido.** Este paso no añade
lógica: cambia colores, trazos y fuentes. Lo que sustituye al ciclo rojo-verde
son los **428 tests existentes pasando sin tocarse** y la **auditoría de
contraste sobre el DOM renderizado** de la Tarea 7.

**Las dos reglas duras:**

1. **El pastel es fondo o borde, nunca texto.** El texto va en `--color-tinta`.
2. **Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px.** Lo que necesite
   ser más pequeño va en Quicksand.

**Y la regla nueva que fija este paso:** en una gráfica, **la tinta dibuja y el
pastel rellena**. Líneas, puntos, crucetas y bordes en `--color-tinta`; áreas y
barras en pastel. Si te ves poniendo un pastel como trazo fino, te has salido.

**Contrastes ya medidos:**

```
tinta sobre paper .... 9,76:1     tinta sobre sky ...... 6,87:1
tinta sobre paper-2 .. 9,09:1     tinta sobre peach .... 7,64:1
paper sobre tinta .... 9,76:1     tinta sobre yellow ... 8,49:1
```

**Estas gráficas las van a reusar tareas y proyectos.** Lo que decidas aquí se
hereda en dos pasos más. No metas nada específico de la portada dentro de
`LineChart` o `BarChart`: son genéricos y reciben todo por props.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `charts/ChartTooltip.tsx` | **Nuevo.** La burbuja de detalle y su anclaje a los bordes |
| `charts/LineChart.tsx` | Línea, área, puntos, rejilla y cruceta |
| `charts/BarChart.tsx` | Barras verticales y su base |
| `charts/ComplianceChart.tsx` | Envoltorio de dominio; solo le queda un color en el tooltip |
| `home/TodayCard.tsx` | El hoy: anillo, cifra y pendientes pulsables |
| `home/TrendCard.tsx` | Cumplimiento, delta y selector de rango |
| `app/page.tsx` | La composición |

---

### Tarea 1: El tooltip compartido

Va primero para no escribir el estilo nuevo dos veces.

**Files:**
- Create: `src/modules/habitos/components/charts/ChartTooltip.tsx`
- Modify: `src/modules/habitos/components/charts/LineChart.tsx`
- Modify: `src/modules/habitos/components/charts/BarChart.tsx`

- [ ] **Paso 1: Crear el componente**

`src/modules/habitos/components/charts/ChartTooltip.tsx`:

```tsx
import type { ReactNode } from "react";

/*
  La burbuja de detalle de las gráficas. Estaba declarada dos veces, con los
  mismos doce valores, en LineChart y en BarChart.

  Cerca de los bordes se ancla por su lado en vez de centrarse, para no
  desbordar la tarjeta que la contiene.
*/
export function ChartTooltip({
  /** Posición horizontal en porcentaje del ancho de la gráfica. */
  left,
  children,
}: {
  left: number;
  children: ReactNode;
}) {
  const anchor =
    left < 15 ? "translateX(0)" : left > 85 ? "translateX(-100%)" : "translateX(-50%)";

  return (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        top: 0,
        transform: anchor,
        pointerEvents: "none",
        background: "var(--color-paper)",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-control)",
        boxShadow: "var(--shadow-hard)",
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        padding: "7px 10px",
        fontSize: 11.5,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Paso 2: Usarlo en `LineChart`**

Añade el import:

```tsx
import { ChartTooltip } from "./ChartTooltip";
```

Borra las constantes `tooltipAnchor` (el cálculo se fue al componente) y
sustituye el bloque final del tooltip por:

```tsx
      {activeIndex !== null ? (
        <ChartTooltip left={tooltipLeft}>{renderTooltip(activeIndex)}</ChartTooltip>
      ) : null}
```

**Conserva `tooltipLeft` tal cual está**: usa la misma escala X que la cruceta
del SVG, y si difirieran señalarían días distintos.

- [ ] **Paso 3: Usarlo en `BarChart`**

Añade el mismo import y sustituye el bloque del tooltip por:

```tsx
      {hover !== null ? (
        <ChartTooltip left={((hover + 0.5) / values.length) * 100}>
          {renderTooltip(hover)}
        </ChartTooltip>
      ) : null}
```

- [ ] **Paso 4: Verificar**

```bash
cd "/c/PROYECTO JUAMPI"
npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Paso 5: Commit**

```bash
git add src/modules/habitos/components/charts
git commit -m "refactor(charts): extraer el tooltip compartido"
```

---

### Tarea 2: `LineChart`

**Files:**
- Modify: `src/modules/habitos/components/charts/LineChart.tsx`

- [ ] **Paso 1: Rejilla y rótulos de eje**

Sustituye el bloque de `ticks`:

```tsx
        {ticks.map((value) => (
          <g key={value}>
            {/* Discontinua: es guía, no dato. */}
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--color-line)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            {/* Quicksand y no VT323: a 11px la pixelada está bajo su suelo. */}
            <text
              x={PAD.left - 8}
              y={y(value) + 4}
              textAnchor="end"
              fontSize={11}
              fontFamily="var(--font-cuerpo)"
              fill="var(--color-tinta)"
            >
              {formatTick(value)}
            </text>
          </g>
        ))}
```

- [ ] **Paso 2: Área y línea**

```tsx
        {/* El área es superficie, así que va en pastel macizo. */}
        {lineSegments.map((seg, i) => (
          <path key={`area-${i}`} d={areaPath(seg, y(0))} fill="var(--color-sky)" />
        ))}
        {/* La línea ES el dato, así que va en tinta: un trazo fino en pastel
            sobre papel no se sostiene. */}
        {lineSegments.map((seg, i) => (
          <path
            key={`line-${i}`}
            d={linePath(seg)}
            fill="none"
            stroke="var(--color-tinta)"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
```

- [ ] **Paso 3: Puntos**

```tsx
        {dots?.map((value, i) =>
          value === null ? null : highlighted?.[i] ? (
            // El día con escudo sigue siendo un ANILLO y no un disco: es lo que
            // lo distingue sin depender del color. Solo cambia el tono.
            <circle
              key={i}
              cx={x(i)}
              cy={y(value)}
              r={4}
              fill="var(--color-peach)"
              stroke="var(--color-tinta)"
              strokeWidth={2}
            />
          ) : (
            <circle key={i} cx={x(i)} cy={y(value)} r={2.5} fill="var(--color-tinta)" />
          ),
        )}
```

- [ ] **Paso 4: Cruceta y punto activo**

```tsx
        {activeIndex !== null ? (
          <g>
            <line
              x1={x(activeIndex)}
              x2={x(activeIndex)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--color-line)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            {line[activeIndex] === null ? null : (
              <circle
                cx={x(activeIndex)}
                cy={y(line[activeIndex] as number)}
                r={5}
                fill="var(--color-tinta)"
                stroke="var(--color-paper)"
                strokeWidth={2}
              />
            )}
          </g>
        ) : null}
```

- [ ] **Paso 5: Rótulos de inicio y fin**

```tsx
        <text
          x={PAD.left}
          y={H - 6}
          fontSize={11}
          fontFamily="var(--font-cuerpo)"
          fill="var(--color-tinta)"
        >
          {startLabel}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          fontSize={11}
          fontFamily="var(--font-cuerpo)"
          fill="var(--color-tinta)"
          textAnchor="end"
        >
          {endLabel}
        </text>
```

- [ ] **Paso 6: El color suelto de `ComplianceChart`**

En `ComplianceChart.tsx`, dentro del tooltip, sustituye

```tsx
            <span style={{ color: "var(--m-ink-3)" }}>
```

por

```tsx
            <span>
```

El tooltip ya fija su tinta; el gris claro sobre papel no se leería.

- [ ] **Paso 7: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 8: Mirarla, que es el riesgo del spec**

Con `npm run dev`, abre `http://127.0.0.1:3000/` y pasa el ratón por la gráfica
de cumplimiento. **Comprueba expresamente que los puntos se ven sobre el área
maciza**: antes el relleno estaba al 10% y ahora es sky opaco. Tinta sobre sky
da 6,87:1, así que deberían verse, pero es lo que el spec marcó como riesgo.

- [ ] **Paso 9: Commit**

```bash
git add src/modules/habitos/components/charts
git commit -m "feat(charts): la tinta dibuja y el pastel rellena"
```

---

### Tarea 3: `BarChart`

**Files:**
- Modify: `src/modules/habitos/components/charts/BarChart.tsx`

- [ ] **Paso 1: La base y las barras**

Sustituye el `style` del contenedor de barras:

```tsx
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
          height,
          borderBottom: "3px solid var(--color-line)",
        }}
```

Y el `style` de cada barra:

```tsx
            <div
              style={{
                width: "100%",
                height: max === 0 ? 0 : `${(value / max) * 100}%`,
                minHeight: value > 0 ? 2 : 0,
                // Relleno en pastel, contorno en tinta: la barra es superficie
                // y el borde es lo que la hace del sistema.
                background: hover === i ? "var(--color-tinta)" : "var(--color-sky)",
                border: value > 0 ? "2px solid var(--color-line)" : "none",
                borderBottom: "none",
                borderRadius: "6px 6px 0 0",
              }}
            />
```

- [ ] **Paso 2: Los rótulos**

```tsx
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-cuerpo)",
          fontSize: 11,
          color: "var(--color-tinta)",
          marginTop: 8,
        }}
      >
```

- [ ] **Paso 3: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

`BarChart` no se usa en la portada, así que aquí no hay nada que mirar en
pantalla todavía. Se verá cuando le toque a tareas.

- [ ] **Paso 4: Commit**

```bash
git add src/modules/habitos/components/charts/BarChart.tsx
git commit -m "feat(charts): repintar las barras"
```

---

### Tarea 4: `TodayCard`

**Files:**
- Modify: `src/modules/habitos/components/home/TodayCard.tsx`

- [ ] **Paso 1: Pasar a `Card`**

Añade el import y sustituye el `<div className="m-card">` de apertura y su
cierre:

```tsx
import { Card } from "@/modules/core/ui/Card";
```

```tsx
    <Card title="Hoy" style={{ opacity: busy ? 0.7 : 1 }}>
```

Y borra el `<div className="m-label">Hoy</div>` de dentro: el rótulo ahora lo
pone `Card`. Cierra con `</Card>`.

- [ ] **Paso 2: El anillo y la cifra**

```tsx
        <ProgressRing
          value={done}
          max={scheduled}
          track="var(--color-paper-2)"
          fill="var(--color-tinta)"
        />
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span
              style={{
                fontFamily: "var(--font-vt)",
                fontSize: 46,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {done}
            </span>
            <span
              style={{
                fontFamily: "var(--font-vt)",
                fontSize: 24,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              /{scheduled}
            </span>
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6 }}>
            {scheduled === 0 ? "hoy no toca ningún hábito" : "hábitos de hoy"}
          </div>
          {partial > 0 ? (
            <div style={{ fontSize: 11.5, marginTop: 4 }}>
              {partial === 1 ? "1 en modo mínimo" : `${partial} en modo mínimo`}
            </div>
          ) : null}
        </div>
```

- [ ] **Paso 3: Los pendientes, que son teclas**

Este bloque sustituye desde el `<div style={{ marginTop: 16, ... }}>` que abre la
lista de pendientes hasta el `) : null}` que cierra el ternario entero — las tres
ramas de golpe, porque las dos primeras cambian y la tercera marca el final.

```tsx
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "3px dashed var(--color-line)" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 10 }}>
            {pending.length === 1 ? "Falta 1 antes de medianoche" : `Faltan ${pending.length} antes de medianoche`}
          </div>
          {pending.map((habit) => (
            <button
              key={habit.id}
              type="button"
              onClick={() => mark(habit.id)}
              disabled={busy}
              className={
                "inline-flex items-center gap-2 mr-1.5 mb-1.5 px-3 py-1.5 " +
                "rounded-full border-3 border-line bg-paper text-tinta font-cuerpo text-[12.5px] " +
                "cursor-pointer shadow-hard " +
                "transition-[transform,box-shadow] duration-75 ease-out " +
                "active:translate-x-0.5 active:translate-y-0.5 " +
                "active:shadow-[2px_2px_0_var(--color-line)] " +
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
                "disabled:opacity-50 disabled:shadow-none"
              }
              aria-label={`Marcar ${habit.name} como hecho`}
            >
              {/* El punto SÍ puede llevar color: es un punto, no texto. */}
              <span
                aria-hidden="true"
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  border: "2px solid var(--color-tinta)",
                  background: habit.critical ? "var(--color-peach)" : "var(--color-sky)",
                }}
              />
              {habit.name}
            </button>
          ))}
          {critical.length > 0 ? (
            // Iba en rojo. El rojo como color de texto está prohibido, así que
            // lo que avisa ahora son el ▲ y el grosor.
            <div
              style={{
                display: "flex",
                gap: 7,
                alignItems: "center",
                fontSize: 12,
                fontWeight: 700,
                marginTop: 6,
              }}
            >
              <span aria-hidden="true">▲</span>
              <span>
                {critical.length === 1
                  ? `${critical[0].name} viene de fallar ayer`
                  : `${critical.length} hábitos vienen de fallar ayer`}
              </span>
            </div>
          ) : null}
        </div>
      ) : scheduled > 0 ? (
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "3px dashed var(--color-line)",
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          {partial > 0 ? "Día completo, con mínimos." : "Día completo."}
        </div>
      ) : null}
```

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Paso 5: Commit**

```bash
git add src/modules/habitos/components/home/TodayCard.tsx
git commit -m "feat(inicio): repintar la tarjeta de hoy"
```

---

### Tarea 5: `TrendCard`

Aquí está el último texto ilegible del proyecto.

**Files:**
- Modify: `src/modules/habitos/components/home/TrendCard.tsx`

- [ ] **Paso 1: Pasar a `Card`, usando su ranura de acción**

Hoy el rótulo y el selector viven en un `flex` con `space-between` montado a
mano. `Card` ya resuelve eso: tiene `title` y `action`. Se aprovecha en vez de
repetirlo.

Añade `import { Card } from "@/modules/core/ui/Card";`. Sustituye el
`<div className="m-card">` de apertura, el `flex` exterior y el
`<div className="m-label">` por:

```tsx
    <Card title="Cumplimiento" action={<SelectorDeRango range={range} onChange={setRange} />}>
```

Borra el `</div>` del `flex` exterior y cierra el componente con `</Card>`. Lo
que queda dentro es la cifra, el delta y la gráfica, sin envoltorio propio.

Define el selector como componente aparte al final del archivo, para que la
llamada de arriba se lea:

```tsx
function SelectorDeRango({
  range,
  onChange,
}: {
  range: (typeof RANGES)[number];
  onChange: (r: (typeof RANGES)[number]) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r)}
          aria-pressed={range.key === r.key}
          className={
            "px-2.5 py-1 rounded-control border-3 border-line " +
            "bg-paper text-tinta font-cuerpo text-[11.5px] cursor-pointer " +
            "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-line " +
            "aria-pressed:bg-sky aria-pressed:font-bold"
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
```

Lo elegido se marca con la variante `aria-pressed:`, que lee el atributo que ya
estaba puesto: así el estado visual y el accesible no pueden separarse. **Este
selector es el que medía 1,12:1.**

La cifra y el delta:

```tsx
          {delta === null ? (
            <div style={{ fontSize: 13 }}>Aún no hay datos suficientes.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <span
                  style={{
                    fontFamily: "var(--font-vt)",
                    fontSize: 34,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(delta.current * 100)}%
                </span>
                {delta.deltaPoints === null ? null : (
                  // Iba en verde o rojo según subiera o bajara. Ahora lo dicen
                  // la flecha y el grosor, que se leen sin distinguir tonos.
                  <span style={{ fontSize: 12.5, fontWeight: changed ? 700 : 500 }}>
                    {changed ? `${up ? "▲" : "▼"} ${Math.abs(delta.deltaPoints)} pts` : "sin cambio"}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11.5, marginTop: 6 }}>
                {delta.previous === null
                  ? "sin periodo anterior suficiente para comparar"
                  : `frente a ${Math.round(delta.previous * 100)}% del periodo anterior · ${delta.previousDays} días medidos`}
              </div>
            </>
          )}
```

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Paso 3: Commit**

```bash
git add src/modules/habitos/components/home/TrendCard.tsx
git commit -m "feat(inicio): repintar la tarjeta de tendencia"
```

---

### Tarea 6: La composición de la portada

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Paso 1: El contenedor**

Sustituye el `<main>` y su estilo:

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

Se cae `className="m-root"`. El aire entre bloques sube de 32 a 36, y el de
dentro de cada sección de 14 a 18: con trazo de 3px y sombra dura, el espaciado
anterior se queda corto.

```tsx
const seccion: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
};
```

Y en el contenedor interior, `gap: 36`.

- [ ] **Paso 2: Los rótulos de sección**

```tsx
const tituloSeccion: React.CSSProperties = {
  fontFamily: "var(--font-vt)",
  fontSize: 16,
  lineHeight: 1,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-tinta)",
};
```

16px es el suelo de VT323.

- [ ] **Paso 3: La cabecera y los enlaces**

```tsx
          <span style={{ fontSize: 14, fontWeight: 700 }}>Hoy</span>
          <span style={{ fontFamily: "var(--font-vt)", fontSize: 16 }}>{today}</span>
```

Los tres «Ver todo» pierden su color:

```tsx
            <Link href="/habitos" style={{ fontSize: 13, fontWeight: 700 }}>
              Ver todo
            </Link>
```

(y el equivalente con `href="/musica"`).

- [ ] **Paso 4: El estado vacío**

```tsx
            <Card style={{ textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                Aún no tienes hábitos.
              </p>
              <p style={{ fontSize: 13, marginBottom: 20 }}>
                Crea el primero y esta pantalla empezará a medirte.
              </p>
              <Link href="/habitos" style={buttonStyle("primary")}>
                Crear un hábito
              </Link>
            </Card>
```

Añade los imports que faltan:

```tsx
import { Card } from "@/modules/core/ui/Card";
import { buttonStyle } from "@/modules/core/ui/Button";
```

Sustituye el `<div className="m-card">` del estado vacío y el enlace que llevaba
su propio azul a mano.

- [ ] **Paso 5: El párrafo de música**

```tsx
          <p style={{ fontSize: 14 }}>
            Tu biblioteca y tu historial de escucha, en su propia sección. Los
            datos cruzados con el resto del dashboard llegan más adelante.
          </p>
```

- [ ] **Paso 6: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(inicio): repintar la composicion de la portada"
```

---

### Tarea 7: Verificación final

- [ ] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Si `tests/migrar-ledger.test.ts` da timeout, es el flake conocido: no importa
nada de UI. Vuelve a lanzarlo.

- [ ] **Paso 2: Que ningún test se haya modificado**

```bash
git diff main --stat -- '*.test.ts'
```
Esperado: vacío.

- [ ] **Paso 3: Contraste y reglas duras, sobre la portada renderizada**

Con `npm run dev`, en `http://127.0.0.1:3000/`, en la consola:

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

Esperado: los tres en `ok`. **El de contraste es el criterio 4 del spec**: cierra
el 1,12:1 que era el último texto ilegible del proyecto.

- [ ] **Paso 4: La gráfica, con el ratón encima**

Pasa el ratón por la gráfica de cumplimiento y comprueba que la cruceta, el
punto activo y el tooltip aparecen, y que el tooltip no se sale por los bordes
al llegar a los extremos.

- [ ] **Paso 5: El resto sigue en pie**

`/habitos` intacta, y `/tareas`, `/proyectos`, `/jardin` y `/musica` cargando.
Van a seguir viéndose mezcladas y eso es lo esperado.

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. Los 428 tests pasan y **ninguno fue modificado**
- [ ] 3. La portada completa en el estilo nuevo, sin `.m-root`
- [ ] 4. **Ningún texto bajo 3:1 en la portada** — cierra el 1,12:1
- [ ] 5. Ningún pastel como color de texto
- [ ] 6. Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px
- [ ] 7. Las gráficas conservan media móvil, puntos, escudos y tooltip
- [ ] 8. `/habitos` y el armazón intactos; el resto sigue funcionando
