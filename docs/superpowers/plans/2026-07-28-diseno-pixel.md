# Sistema visual pixel-kawaii · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el sistema visual pixel-kawaii —tokens, tres fuentes, seis componentes base— y repintar `/habitos` entera con él, para poder juzgar la dirección funcionando antes de extenderla.

**Architecture:** Los tokens viven en `@theme` de Tailwind 4 y se consumen como utilidades, igual que hace música. Los seis componentes de `core/ui/` se repintan sin cambiar su API. `/habitos` se repinta componente a componente.

**Tech Stack:** Next 16.2.12 · Tailwind 4 · `next/font/google` · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-28-diseno-pixel-design.md`

---

## Antes de empezar: lee esto

**Esto es piel, no lógica.** Si te encuentras tocando una consulta, un cálculo de racha
o un server action, te has salido del carril. Vuelve atrás.

**Los 420 tests deben seguir en verde sin que modifiques ninguno.** Son de lógica pura
y de acceso a datos. Un test en rojo no es "hay que actualizar el test": es la señal de
que el cambio dejó de ser visual. Investiga antes de tocarlo.

**Dos reglas duras del spec, que gobiernan cada decisión:**

1. **El pastel es fondo o borde, nunca texto.** Los pasteles sobre crema tienen
   contraste bajo por naturaleza. El texto va siempre en `--ink` o `--ink-2`.
2. **Press Start 2P nunca por debajo de 14px, VT323 nunca por debajo de 16px.** Por
   debajo son ilegibles. Si un título no cabe, se acorta el texto — no se encoge la
   fuente.

**Al terminar convivirán dos pieles:** `/habitos` en pastel claro y el resto en el
lenguaje oscuro actual. Es feo y es deliberado. No repintes nada más "ya que estás".

**Next 16 no es el Next que crees conocer.** Consulta `node_modules/next/dist/docs/`
antes de tocar layouts o la carga de fuentes.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/modules/core/ui/tokens.css` | La paleta en `@theme`, con sus contrastes anotados |
| `src/modules/core/ui/contraste.ts` | Matemática de contraste WCAG y separación de tonos |
| `src/modules/core/ui/contraste.test.ts` | La verificación ejecutable de las dos reglas duras |
| `src/app/layout.tsx` | Carga de las tres fuentes |
| `src/app/globals.css` | Importa los tokens; conserva lo que aún usan otras secciones |
| `src/modules/core/ui/{Card,Button,Field,Modal,PageHeader,Stat}.tsx` | Repintados, misma API |
| `src/modules/habitos/components/habits/*` | Las 8 piezas de la pantalla |
| `src/app/habitos/page.tsx` | La composición |

---

# Fase A · El sistema

### Tarea 1: La paleta, verificada por test

Esta tarea invierte el orden habitual a propósito: **primero el test que mide, luego
los colores.** El spec exige que los contrastes estén medidos y no elegidos a ojo, y
la única forma de que eso sea cierto dentro de seis meses es que falle el build.

**Files:**
- Create: `src/modules/core/ui/contraste.ts`
- Test: `src/modules/core/ui/contraste.test.ts`

- [ ] **Paso 1: Escribir el test que falla**

`src/modules/core/ui/contraste.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { contraste, PALETA, ACENTOS_HABITO, separacionMinima } from "./contraste";

describe("la paleta cumple las reglas del sistema", () => {
  it("el texto principal sobre papel pasa AA", () => {
    expect(contraste(PALETA.ink, PALETA.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(PALETA.ink, PALETA.paper2)).toBeGreaterThanOrEqual(4.5);
  });

  it("el texto secundario sobre papel pasa AA para texto grande", () => {
    expect(contraste(PALETA.ink2, PALETA.paper)).toBeGreaterThanOrEqual(3);
  });

  it("el trazo se distingue del papel", () => {
    expect(contraste(PALETA.line, PALETA.paper)).toBeGreaterThanOrEqual(3);
  });

  it("cada pastel sirve de fondo para la tinta", () => {
    // La regla dura: el pastel es fondo, y el texto encima va en --ink.
    for (const [nombre, hex] of Object.entries(PALETA.acentos)) {
      expect(
        contraste(PALETA.ink, hex),
        `${nombre} no aguanta texto en tinta`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("los acentos de hábito se distinguen entre sí", () => {
  it("son exactamente tres", () => {
    // Tres es el máximo que pasa la separación bajo daltonismo. Añadir un
    // cuarto rompe la distinción, no la mejora.
    expect(Object.keys(ACENTOS_HABITO)).toHaveLength(3);
  });

  it("ningún par se confunde con visión normal", () => {
    expect(separacionMinima(ACENTOS_HABITO, "normal")).toBeGreaterThanOrEqual(20);
  });

  it("ningún par se confunde con deuteranopía", () => {
    expect(separacionMinima(ACENTOS_HABITO, "deutan")).toBeGreaterThanOrEqual(9);
  });

  it("ningún par se confunde con protanopía", () => {
    expect(separacionMinima(ACENTOS_HABITO, "protan")).toBeGreaterThanOrEqual(9);
  });
});
```

Los umbrales salen de los que el `globals.css` actual documenta para la paleta vigente
(peor par aqua↔naranja ΔE 9.4 en deutan, peor par con visión normal ΔE 24.6). Si la
paleta nueva no los alcanza, **el spec manda oscurecer los tres acentos hasta que
pasen** — no bajar el umbral.

- [ ] **Paso 2: Ejecutar y comprobar que falla**

```bash
cd "/c/PROYECTO JUAMPI"
npx vitest run src/modules/core/ui/contraste.test.ts
```
Esperado: FAIL — no encuentra `./contraste`.

- [ ] **Paso 3: Escribir la implementación**

`src/modules/core/ui/contraste.ts` necesita:

- `hexARgb(hex: string): [number, number, number]`
- `luminancia(rgb): number` — la relativa de WCAG, con la corrección sRGB
  (`c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055) ** 2.4`)
- `contraste(a: string, b: string): number` — `(L1 + 0.05) / (L2 + 0.05)`
- `simular(hex, tipo: "normal" | "deutan" | "protan"): string` — proyección de
  Brettel/Viénot para daltonismo
- `deltaE(a: string, b: string): number` — CIE76 sobre Lab basta para este uso
- `separacionMinima(colores, tipo): number` — el ΔE del par más cercano tras simular

**No inventes las matrices de simulación.** Los coeficientes de Brettel/Viénot y las
constantes de conversión sRGB→XYZ→Lab son valores publicados y concretos; si los
aproximas de memoria, el test seguirá pasando pero habrá dejado de medir nada, que es
peor que no tenerlo. Búscalos y cita la fuente en un comentario del archivo.

Si no puedes obtenerlos con certeza, **para y díselo al usuario** en vez de rellenar
con números plausibles. Un test de accesibilidad que miente es una trampa que alguien
descubrirá dentro de meses, cuando ya nadie recuerde de dónde salieron esos valores.

Más las constantes `PALETA` y `ACENTOS_HABITO` con los valores del spec:

```ts
export const PALETA = {
  paper: "#fff5fb",
  paper2: "#ffeaf6",
  ink: "#4a3a52",
  ink2: "#8a738f",
  line: "#4a3a52",
  acentos: {
    pink: "#ff9ec7",
    lav: "#c4b5fd",
    mint: "#a7f0c8",
    peach: "#ffd6a5",
    sky: "#a5d8ff",
    yellow: "#ffe6a7",
  },
} as const;
```

`ACENTOS_HABITO` son los tres que se asignan a hábitos. **Empieza por rosa, lavanda y
menta y deja que el test decida.** Si no pasan, oscurécelos manteniendo el tono hasta
que pasen, y anota en un comentario el valor final de cada ΔE.

- [ ] **Paso 4: Ejecutar hasta que pase**

```bash
npx vitest run src/modules/core/ui/contraste.test.ts
```

Itera sobre los valores de `ACENTOS_HABITO`, no sobre los umbrales.

- [ ] **Paso 5: Commit**

```bash
git add src/modules/core/ui/contraste.ts src/modules/core/ui/contraste.test.ts
git commit -m "feat(ui): paleta pixel-kawaii verificada por test"
```

---

### Tarea 2: Los tokens y las tres fuentes

**Files:**
- Create: `src/modules/core/ui/tokens.css`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`

- [ ] **Paso 1: Escribir los tokens**

`src/modules/core/ui/tokens.css`, con un bloque `@theme` de Tailwind 4. Incluye los
valores que la Tarea 1 dejó verificados y **anota junto a cada uno su ratio medido**,
igual que hace hoy `src/app/globals.css` con los suyos. Ese comentario es la memoria
de por qué el valor es ese y no otro.

Define también `--shadow-hard: 4px 4px 0 var(--color-line)` y los radios (10px
controles, 14px tarjetas).

- [ ] **Paso 2: Importarlos sin romper lo existente**

En `src/app/globals.css`, importa `tokens.css`. **No borres todavía los tokens
`--m-*`**: tareas, proyectos, jardín y la portada aún los usan, y este paso no los
toca. Convivirán hasta que a cada sección le llegue su turno.

- [ ] **Paso 3: Cargar las tres fuentes**

En `src/app/layout.tsx`, con `next/font/google`, siguiendo el patrón que
`src/app/musica/layout.tsx` ya usa para Fraunces y JetBrains:

```tsx
import { Press_Start_2P, VT323, Quicksand } from "next/font/google";

const pixel = Press_Start_2P({ variable: "--font-pixel", weight: "400", subsets: ["latin"], display: "swap" });
const vt = VT323({ variable: "--font-vt", weight: "400", subsets: ["latin"], display: "swap" });
const cuerpo = Quicksand({ variable: "--font-cuerpo", subsets: ["latin"], display: "swap" });
```

Aplica las tres variables en el `<html>` y `--font-cuerpo` como familia por defecto del
`<body>`. **Cuidado:** el layout de música aplica sus propias fuentes a un `<div>`
contenedor; no las pises.

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npx vitest run && npm run build
```
Esperado: limpio, 420 tests más los nuevos de contraste, build correcto.

Arranca el servidor y comprueba que `/musica` sigue con Fraunces y `/habitos` ya recibe
Quicksand como cuerpo.

- [ ] **Paso 5: Commit**

```bash
git add -A src
git commit -m "feat(ui): tokens del sistema pixel y las tres fuentes"
```

---

### Tarea 3: Los seis componentes base

**Files:**
- Modify: `src/modules/core/ui/{Card,Button,Field,Modal,PageHeader,Stat}.tsx` (371 líneas en total)

- [ ] **Paso 1: Leerlos antes de tocarlos**

```bash
cat src/modules/core/ui/*.tsx
```

Fíjate en su API pública: props, variantes, estados. **No cambia ninguna.** Los
consumidores no deben enterarse salvo por el aspecto.

- [ ] **Paso 2: Repintarlos**

A cada uno: borde de 3px en `--color-line`, `box-shadow: var(--shadow-hard)`, radio
10px en controles y 14px en tarjetas, y las utilidades de la paleta nueva.

Reglas que no puedes saltarte:
- Ningún pastel como color de texto.
- `Stat`: el número va en VT323 (mínimo 16px), la etiqueta en Quicksand.
- `PageHeader`: el título en Press Start 2P (mínimo 14px), y si no cabe se acorta el
  texto.
- `Button`: la sombra dura se desplaza al pulsar (`translate(2px,2px)` y sombra a 2px),
  que es lo que da la sensación física de tecla.
- Estados de foco visibles y `prefers-reduced-motion` respetado.

- [ ] **Paso 3: Verificar que nadie se rompió**

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

Los seis componentes los usan también tareas, proyectos y jardín. Van a cambiar de
aspecto ahí también, y **eso es esperado y correcto**: son componentes compartidos.
Lo que no debe pasar es que dejen de funcionar.

- [ ] **Paso 4: Commit**

```bash
git add -A src/modules/core/ui
git commit -m "feat(ui): repintar los seis componentes base"
```

---

# Fase B · La pantalla de hábitos

Ocho piezas, 1.117 líneas. Se van en tres tareas para que cada commit sea revisable.

### Tarea 4: Cabecera, banner y estado del día

**Files:**
- Modify: `HabitsHeader.tsx` (31), `CriticalBanner.tsx` (39), `DayStatus.tsx` (100)

- [ ] **Paso 1: Repintar las tres**

`CriticalBanner` es el aviso de la regla de los dos días. **Tiene que seguir gritando:**
es lo único de la pantalla cuyo trabajo es alarmar. En pastel, eso se consigue con el
borde y el fondo, no bajando la tinta.

`DayStatus` muestra el avatar según el porcentaje del día. Conserva los cuatro estados.

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit && npx vitest run
```

- [ ] **Paso 3: Commit**

```bash
git add -A src/modules/habitos/components/habits
git commit -m "feat(habitos): repintar cabecera, banner y estado del dia"
```

---

### Tarea 5: La fila de hábito

**Files:**
- Modify: `HabitRow.tsx` (239 líneas), `HabitDetail.tsx` (56)

Es la pieza central de la pantalla y la que más información lleva.

- [ ] **Paso 1: Inventariar lo que comunica**

Antes de tocar nada, lista qué dice hoy una fila: nombre, icono, planta, racha, si
toca hoy, si está hecho, si fue parcial, si es ancla, si es día crítico, y los últimos
30 días. **Todo eso tiene que seguir leyéndose después.** Ese es el criterio del spec:
lo decorativo se añade alrededor de lo que ya comunica, no encima.

- [ ] **Paso 2: Repintar**

El color del hábito entra como acento de la fila y tinte del cartel de su planta —
misma función que hoy, valores nuevos de `ACENTOS_HABITO`.

El botón de marcar es el elemento más satisfactorio de la app: dale el desplazamiento
de la sombra al pulsar.

- [ ] **Paso 3: Verificar en el navegador**

```bash
npm run dev
```

Con hábitos reales, comprueba: marcar, desmarcar, modo mínimo, designar ancla, abrir
detalle. Los cinco estados de planta deben distinguirse de un vistazo.

- [ ] **Paso 4: Commit**

```bash
git add -A src/modules/habitos/components/habits
git commit -m "feat(habitos): repintar la fila de habito"
```

---

### Tarea 6: Calendario, formulario y diagnóstico

**Files:**
- Modify: `MonthCalendar.tsx` (175), `NewHabitForm.tsx` (237), `DiagnosisPanel.tsx` (156)

- [ ] **Paso 1: Repintar las tres**

`MonthCalendar` es el caso más delicado de contraste: cada día codifica hecho, parcial,
escudado, programado, editable y futuro. Son seis estados en celdas pequeñas. **Si dos
no se distinguen, usa forma además de color** — un borde punteado, una esquina cortada.
No dependas solo del tono.

`NewHabitForm` tiene los selectores de icono, color y especie. Es la pantalla donde el
estilo cute más se luce: los selectores son rejillas de botones y quedan bien con
sombra dura.

`DiagnosisPanel` lleva las barras de cumplimiento y el ranking. Sus datos vienen de
`metrics.ts` y **no se tocan**.

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

- [ ] **Paso 3: Commit**

```bash
git add -A src/modules/habitos/components/habits
git commit -m "feat(habitos): repintar calendario, formulario y diagnostico"
```

---

### Tarea 7: La composición de la página

**Files:**
- Modify: `src/app/habitos/page.tsx` (84 líneas)

- [ ] **Paso 1: Repintar el contenedor**

Fondo de papel, ritmo vertical y los espacios entre bloques. La página solo compone:
si te ves metiendo lógica aquí, va en el módulo.

- [ ] **Paso 2: Verificar la pantalla entera**

```bash
npm run dev
```

Recorre `/habitos` de arriba abajo con datos reales y comprueba las dos reglas duras:
**ningún texto en pastel** y **ninguna pixelada por debajo de su mínimo**. Búscalas
activamente; son fáciles de colar sin querer.

- [ ] **Paso 3: Commit**

```bash
git add src/app/habitos/page.tsx
git commit -m "feat(habitos): repintar la composicion de la pantalla"
```

---

# Fase C · Cierre

### Tarea 8: Verificación final

- [ ] **Paso 1: Los cuatro comandos**

```bash
cd "/c/PROYECTO JUAMPI"
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [ ] **Paso 2: Que ningún test se haya modificado**

```bash
git diff main --stat -- '*.test.ts' | tail -3
```

Esperado: **solo `contraste.test.ts`**, que es nuevo. Si aparece cualquier otro test
modificado, revisa por qué: el spec dice que los 420 pasan sin tocarse.

- [ ] **Paso 3: Las dos reglas duras, buscadas a propósito**

```bash
grep -rnE "color:\s*var\(--color-(pink|lav|mint|peach|sky|yellow)" src/modules/core/ui src/modules/habitos src/app/habitos && echo "PASTEL COMO TEXTO" || echo "regla 1 ok"
```

Para la segunda, revisa a mano cada uso de `--font-pixel` y `--font-vt` y confirma el
tamaño.

- [ ] **Paso 4: El resto de secciones sigue viva**

Arranca la app y comprueba que `/tareas`, `/proyectos`, `/jardin`, `/musica` y la
portada cargan y funcionan. Van a verse mezcladas —los seis componentes base ya son
pastel— y eso es lo esperado. Lo que no puede pasar es que algo deje de funcionar.

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. Los 420 tests pasan y **ninguno fue modificado**
- [ ] 3. Las tres fuentes cargan y cada una se usa solo en su papel
- [ ] 4. `/habitos` completa en el estilo nuevo
- [ ] 5. Ningún pastel usado como color de texto
- [ ] 6. Los ratios de contraste anotados en `tokens.css` y verificados por test
- [ ] 7. La separación de los tres acentos bajo daltonismo, verificada por test
- [ ] 8. El resto de secciones funciona, aunque con aspecto mezclado
