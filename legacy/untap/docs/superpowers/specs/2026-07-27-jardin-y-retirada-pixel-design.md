# Fase 3 · El Jardín moderno y la retirada de lo pixel

Fecha: 2026-07-27

## Objetivo

Cerrar la migración visual de Untap. El Jardín se repinta en el lenguaje moderno
conservando su metáfora, el color de hábito pasa a servir para algo, y desaparecen
del proyecto los componentes, clases, tokens y tipografías del sistema pixel.

Al terminar la fase no debe quedar ninguna referencia a `--color-*`, `.pixel-*`,
VT323 ni Press Start 2P en `src/`.

## Decisiones tomadas

1. **El Jardín se moderniza conservando la metáfora.** Sigue siendo un jardín con
   plantas que crecen y se marchitan, y se sigue pudiendo regar desde ahí.
2. **El color de hábito recibe uso real:** acento en la fila del hábito y tinte del
   cartel de su planta. Deja de ser un dato que se pide y no se mira.
3. La retirada de lo pixel ocurre al final de la fase, cuando ya no queda nadie
   usándolo.

## Sección 1 — El Jardín

### Qué conserva y qué pierde

El criterio: **se queda lo que comunica estado o tiempo, se va lo que era relleno
decorativo de 8 bits.**

Conserva:

- El ciclo día/noche del cielo con sus seis fases (`dawn`, `morning`, `midday`,
  `afternoon`, `dusk`, `night`) y la etiqueta de fase.
- El sol / luna / amanecer según la fase.
- Las estrellas en las fases oscuras y las nubes a la deriva.
- Las plantas: especie, cinco etapas de crecimiento, estado marchito, corona del
  hábito ancla, aura de floreciente.
- El riego con un click, con su ráfaga de gotas y destellos.
- El cartel de cada planta con nombre y racha, ahora tintado con su color.

Pierde:

- La silueta de montañas recortada con `clipPath`.
- La cerca de madera de degradados repetidos.
- La fila de matojos 🌾 del borde inferior.
- La regadera 🪣 de la esquina.
- Las mariposas y sus tres animaciones `butterfly-0/1/2`.
- El catálogo de especies de la página.

### Estructura de la página

`src/app/garden/page.tsx` (server component) pasa a usar las primitivas modernas
ya existentes — `PageHeader`, `Card`, `Button` — y una nueva, `StatGrid`
(sección 2b).

```
PageHeader  "Tu jardín" · "Cada hábito es una planta. Riégalas para que crezcan."
StatGrid    plantas · regadas hoy · maduras · florecientes
Card        aviso de plantas marchitas   [solo si wilted > 0]
Card        la escena  →  <GardenScene>
Card        leyenda de etapas (compacta, una fila)
```

Se retira el tile «planta más vieja» junto con el cálculo de `oldestStreak`: la
racha más larga ya se muestra en Inicio y en el detalle del hábito.

El aviso de marchitas va **antes** de la escena, no después: es lo accionable de
la pantalla y no debe quedar por debajo del pliegue.

Estado vacío: una `Card` centrada con 🌱, el texto actual y un `Button` a
`/habits`.

### La escena

`src/components/GardenScene.tsx` sigue siendo un client component (usa
`useLocalHour`, `useTransition` y `useSparkleBurst`).

**Cielo.** Los degradados actuales mezclan cielo y suelo en un mismo
`linear-gradient` con paradas duras, que es lo que produce el bandeado pixel. Se
separan: el cielo es un degradado suave de tres paradas sobre el 62% superior, y
el suelo es una banda propia con su propio degradado.

```ts
const SKY: Record<SkyPhase, string> = {
  dawn:      "linear-gradient(180deg, #2b2440 0%, #6b4f74 45%, #c98f6d 100%)",
  morning:   "linear-gradient(180deg, #4a6f9e 0%, #7fa3c9 50%, #cfd9e2 100%)",
  midday:    "linear-gradient(180deg, #3d7ab5 0%, #6ba3d4 50%, #bcd8ea 100%)",
  afternoon: "linear-gradient(180deg, #55749e 0%, #8f9cba 50%, #d9b48f 100%)",
  dusk:      "linear-gradient(180deg, #241d38 0%, #6d5480 45%, #c07f92 100%)",
  night:     "linear-gradient(180deg, #0c0c14 0%, #16162a 55%, #232144 100%)",
};

const GROUND: Record<SkyPhase, string> = {
  dawn:      "linear-gradient(180deg, #3a4a2c 0%, #26301c 100%)",
  morning:   "linear-gradient(180deg, #46603a 0%, #2c3d24 100%)",
  midday:    "linear-gradient(180deg, #4d6b3d 0%, #314426 100%)",
  afternoon: "linear-gradient(180deg, #445c36 0%, #2b3a22 100%)",
  dusk:      "linear-gradient(180deg, #2f3a24 0%, #1e2617 100%)",
  night:     "linear-gradient(180deg, #1b2416 0%, #121810 100%)",
};
```

El contenedor: `borderRadius: 12`, `overflow: hidden`, `minHeight: 30rem`,
`transition: background 1500ms ease-in-out`. Cielo y suelo son dos divs
absolutos; el suelo ocupa `top: 62%` hacia abajo.

**Etiqueta de fase.** Píldora arriba a la izquierda: `background:
rgba(0,0,0,0.35)`, `borderRadius: 999px`, `padding: "3px 9px"`, `fontSize: 11`,
`color: var(--m-ink)`, texto en capital inicial (`Amanecer`, `Mediodía`, …) — no
en mayúsculas, que era una convención de la tipografía pixel.

**Sol / luna.** Se conserva el emoji por fase con su `drop-shadow`. Se le quita
la clase `untap-bobble`.

**Estrellas y nubes.** Igual que ahora, pero las estrellas pasan a
`borderRadius: "50%"` — eran cuadradas por ser pixel. Conservan `untap-pulse`,
que no es una animación pixel sino una utilidad de movimiento genérica. La
animación `cloud-drift` se conserva en el bloque `<style>` local de la escena.

**Cuadrícula de plantas.** Se conserva el cálculo actual de columnas
(`Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))))`) y `content-end`.

**La planta.** Se conserva el emoji por especie y etapa, el escalado por etapa,
la opacidad para «no toca» y «sed», el filtro de marchita, la corona y el aura.
Cambian dos piezas:

- *La tierra.* De `repeating-linear-gradient` con `inset box-shadow` a una barra
  redondeada sobria: `width: 72`, `height: 7`, `borderRadius: 4`, `background:
  "linear-gradient(180deg, #5a4028 0%, #3b2a1a 100%)"`.
- *El cartel.* De madera con degradado y borde de 2px a un chip moderno:
  `background: rgba(0,0,0,0.4)`, `borderRadius: 7`, `borderLeft: 3px solid
  <color del hábito>`, `padding: "4px 8px"`. Dentro, el nombre a `fontSize: 12`
  en `var(--m-ink)` truncado, y debajo la racha a `fontSize: 10.5` en
  `var(--m-ink-2)` con la clase `m-num`, con el formato `{n} d · {etapa}` en
  capital inicial. El singular se respeta: `1 d` nunca `1 días`.

**Accesibilidad.** El `title` y el `aria-label` del botón de riego se conservan
tal cual: el color del cartel es redundante, nunca el único portador de
identidad — el nombre del hábito está siempre al lado.

## Sección 2 — La paleta de hábitos

### Por qué baja de cinco colores a tres

Los cinco pasteles actuales no son distinguibles entre sí. Validados como paleta
categórica sobre la superficie oscura (`--m-surface: #17171d`), con la lista de
todos los pares — que es el caso real: las cinco muestras se ven juntas en el
selector, y todos los hábitos se ven juntos en la lista y en el jardín:

```
$ node scripts/validate_palette.js "#a8d8b8,#f5c89e,#f0a8c4,#c4a8e0,#a8c8e8" \
    --mode dark --surface "#17171d" --pairs all

  [FAIL] Lightness band      los cinco fuera de la banda L 0.48–0.67
  [FAIL] Chroma floor        los cinco por debajo del suelo (leen como gris)
  [FAIL] CVD separation      peor par peach↔mint ΔE 3.4 (protan)
  [FAIL] Normal-vision floor peor par lavender↔pink ΔE 7.8 — por debajo de 15
  [PASS] Contrast vs surface los cinco ≥ 3:1
```

Un ΔE 7.8 con visión de color normal significa que lavanda y rosa son
prácticamente el mismo color para cualquiera. Y el suelo de croma reprobado
significa que los cinco leen como gris.

Con la lista de todos los pares, **ningún conjunto de cuatro pasa**. Se probaron
los cuatro conjuntos posibles de cuatro tomados de las ranuras del sistema y
todos fallan la separación bajo daltonismo y el suelo de visión normal. Tres es
el máximo. Así que la paleta baja a tres colores distinguibles en vez de cinco
que no lo son.

### La paleta

| Clave | Etiqueta | Hex | Token |
|---|---|---|---|
| `aqua` | Aqua | `#199e70` | `--h-aqua` |
| `violet` | Violeta | `#9085e9` | `--h-violet` |
| `orange` | Naranja | `#d95926` | `--h-orange` |

```
$ node scripts/validate_palette.js "#d95926,#199e70,#9085e9" \
    --mode dark --surface "#17171d" --pairs all

  [PASS] Lightness band      los tres dentro de L 0.48–0.67
  [PASS] Chroma floor        los tres ≥ 0.1
  [PASS] CVD separation      peor par aqua↔naranja ΔE 9.4 (deutan) · tritan 9.4
  [PASS] Normal-vision floor peor par violeta↔aqua ΔE 24.6
  [PASS] Contrast vs surface los tres ≥ 3:1
  → ALL CHECKS PASS
```

Dos exclusiones deliberadas:

- **El azul `#3987e5` queda fuera** aunque es la primera ranura del sistema:
  es `--m-series`, el color de las gráficas. Que el azul significase a la vez
  «cumplimiento» y «este hábito» sería una colisión de sentido.
- **Verde, amarillo y rojo quedan fuera** por ser `--m-good`, `--m-warn` y
  `--m-crit`. Los colores de estado están reservados.

El naranja roza el rojo crítico como token puro (ΔE 6.0), pero `--m-crit` nunca
aparece puro junto a un acento: en la fila de hábito es un filo al 45% de
opacidad, que compuesto sobre la superficie da `#72383b`, a ΔE 22.9 del naranja.
Queda como regla: **no poner un relleno de `--m-crit` a plena intensidad junto a
un acento de hábito.**

### El módulo

`src/lib/color.ts`:

```ts
export type HabitColor = "aqua" | "violet" | "orange";

export const HABIT_COLORS: { key: HabitColor; label: string }[] = [
  { key: "aqua", label: "Aqua" },
  { key: "violet", label: "Violeta" },
  { key: "orange", label: "Naranja" },
];

export const DEFAULT_HABIT_COLOR: HabitColor = "aqua";

/** Traduce lo guardado en BD a una clave válida. Tolera claves antiguas. */
export function resolveHabitColor(stored: string): HabitColor;

/** Referencia CSS del color, para usar en estilos. */
export function habitColorVar(key: HabitColor): string; // `var(--h-${key})`
```

`resolveHabitColor` absorbe las claves de la era pixel por tono más cercano, y
cualquier valor desconocido cae en el color por defecto:

| Guardado | Resuelve a | Motivo |
|---|---|---|
| `aqua`, `violet`, `orange` | sí mismo | ya migrado |
| `mint` | `aqua` | verde → aqua |
| `sky`, `lavender` | `violet` | azul y lavanda → violeta |
| `peach`, `pink` | `orange` | cálidos → naranja |
| `moss` | `aqua` | era el valor por defecto del esquema |
| cualquier otro | `aqua` | por defecto |

`moss` merece mención: es el `@default` de `Habit.color` en el esquema y **no
existe** ni entre las opciones del formulario ni entre los tokens CSS, así que
`var(--color-moss)` nunca resolvió a nada. El `@default` del esquema pasa a
`"aqua"`.

No hace falta migración de datos: se resuelve en lectura. Se cambia el
`@default` del esquema, lo que exige una migración de Prisma, pero **sin tocar
las filas existentes**.

> **Regla para la ejecución:** las dos migraciones de esta fase —el `@default`
> de `Habit.color` y el borrado de `Project.color`— se aplican con
> `prisma migrate dev`, que conserva los datos. **Está prohibido usar
> `migrate reset`** ni ninguna otra operación que vacíe la base. El permiso que
> se concedió para eso en una fase anterior era para aquella acción concreta y
> no se extiende a esta.

### Dónde se usa

- **Fila de hábito** (`HabitRow.tsx`): franja vertical de 3px en el borde
  izquierdo de la tarjeta, con `boxShadow: inset 3px 0 0 <color>` — no
  `borderLeft`, que desplazaría el contenido 2px y rompería el radio.
- **Cartel de la planta** (`GardenScene.tsx`): `borderLeft: 3px solid <color>`.
- **Selector del formulario** (`NewHabitForm.tsx`): tres muestras en vez de
  cinco, con `background: var(--h-…)` en vez de `var(--color-…)`.

`HabitWithStatus.color` ya viaja desde `lib/habits.ts`, así que no hace falta
tocar la consulta. `HabitRow` sí necesita recibir `color` en sus props: hoy no
lo declara.

## Sección 2b — `StatGrid`, la cuarta copia que no se escribe

El patrón «rótulo pequeño + número grande + nota» está escrito **tres veces** en
el proyecto, con la misma estructura y distinto tamaño de cifra:

| Archivo | Componente local | Cifra |
|---|---|---|
| `components/home/MetricTiles.tsx:14` | `Tile({k, v, m})` | 21 |
| `components/tasks/FlowPanel.tsx:14` | tile con `m-label` | 21 |
| `components/habits/HabitDetail.tsx:11` | `Stat({label, value, hint})` | 17 |

El Jardín sería la cuarta. Se extrae una primitiva y se migran las tres copias,
porque dejar tres duplicados junto a una abstracción recién creada es peor que
no tenerla.

`src/components/ui/Stat.tsx`:

```ts
export type StatSize = "sm" | "md";   // sm = cifra 17, md = cifra 21

export function Stat(p: {
  label: string;
  value: string;
  meta?: string;
  size?: StatSize;   // por defecto "md"
}): ReactElement;

/** Rejilla que se reparte sola. Por defecto minmax(150px, 1fr) y gap 10. */
export function StatGrid(p: {
  children: ReactNode;
  min?: number;
  gap?: number;
}): ReactElement;
```

`Stat` con `size: "md"` envuelve su contenido en `.m-card` con `padding: "13px
14px"`, como hoy `MetricTiles`. Con `size: "sm"` no lleva tarjeta: es solo el
trío de líneas, como hoy `HabitDetail`, que ya vive dentro de una tarjeta.

**Condición de la migración: el resultado renderizado debe ser idéntico.** No es
una ocasión para retocar tamaños ni espaciados. Las tres pantallas afectadas
—Inicio, el detalle de hábito y Tareas— entran en la verificación de navegador.

### Y `formatDays`, la regla que ha fallado cuatro veces

Al abrir esos tres archivos aparecieron **dos «1 días» más**, en
`components/tasks/FlowPanel.tsx:94` y `:99`: `medianLifetime` y `oldestOpen`
valen 1 con cierta frecuencia y salen en plural. Ya se corrigió el mismo fallo
dos veces a mano, en `MetricTiles` y en `HabitDetail`.

Cuatro apariciones del mismo error dejan claro que es una regla, no un descuido.
Se añade `formatDays(n)` a `src/lib/day.ts` —que ya contiene `formatDayLabel`—
con su prueba, y las cuatro llamadas pasan por ella. Vive en `src/lib/` porque
los `.tsx` no los ve Vitest, y esta regla merece quedar fijada por una prueba.

## Sección 3 — `Project.color` se retira

`Project.color` es una columna muerta: `NewProjectForm.tsx:23` la fija a
`"lavender"` sin preguntar, y no se pinta en ninguna parte. Se retira por
completo — columna del esquema, campo del tipo en `lib/projects.ts:36`, su
copia en el payload de `lib/projects.ts:77`, y el `fd.set` del formulario.

Los hábitos conservan color y los proyectos no, y la asimetría es deliberada:
en Hábitos el color ayuda a identificar de un vistazo una lista corta y estable;
en Proyectos nunca se pidió ni se mostró.

## Sección 4 — La retirada

Solo `/garden/page.tsx` sigue usando componentes pixel. Todo lo demás ya está
huérfano.

**Archivos que se borran:**

| Archivo | Consumidores hoy |
|---|---|
| `src/components/PixelWindow.tsx` | solo `garden/page.tsx` |
| `src/components/PageShell.tsx` | solo `garden/page.tsx` |
| `src/components/SectionHeader.tsx` | solo `garden/page.tsx` |
| `src/components/PixelCard.tsx` | **ninguno** — ya muerto |
| `src/components/PixelButton.tsx` | **ninguno** — ya muerto |
| `src/components/Greeting.tsx` | **ninguno** — muerto desde la fase 1 |

**Renombrado:** `src/components/PixelConfirm.tsx` → `ConfirmDialog.tsx`. No
tiene ni una línea de estilo pixel; solo le queda el nombre. Cuatro archivos
importan su `useConfirm` y hay que actualizarlos: `habits/HabitRow.tsx`,
`tasks/TaskCard.tsx`, `projects/ProjectCard.tsx`, `projects/ProjectTreeItem.tsx`.

**`globals.css`:** se eliminan el bloque de tokens `--color-*`, sus
reexportaciones en `@theme`, y las clases `.pixel-window`, `.pixel-edge`,
`.pixel-edge-tight`, `.pixel-button`, `.hover-lift` y `.pixel-page`. Se añaden
los tres tokens `--h-*`.

De las animaciones, **solo se borran dos**, las que mueren con sus únicos
consumidores:

| Animación | Quién la usa | Destino |
|---|---|---|
| `untap-page-in` | solo `PageShell` | se borra |
| `untap-slide-in` | solo `SectionHeader` | se borra |
| `untap-bobble` | escena, estado vacío | se conserva |
| `untap-pulse` | estrellas, aura de floreciente | se conserva |
| `untap-popin` | `AchievementToast` | se conserva |

Las tres que se conservan no son pixel: son utilidades de movimiento genéricas,
y su bloque de `prefers-reduced-motion` se mantiene intacto.

**Las tipografías.** En `layout.tsx` se retiran el `import { VT323,
Press_Start_2P } from "next/font/google"`, las dos llamadas que las configuran
(`--font-vt323`, `--font-press-start`) y las dos clases del `<html>`, que se
queda solo con `h-full`. En `globals.css` se retiran sus reexportaciones en
`@theme` (`--font-pixel`, `--font-display`, líneas 103-104) y la clase
`.font-display` (líneas 140-142). Tras esto no queda ninguna descarga de fuente:
todo el proyecto usa `--m-font`, que es `system-ui`.

**`AppShell.tsx:98`:** un comentario menciona `PageShell`. Se actualiza el
texto; no hay código pixel en el archivo.

## Pruebas

`src/lib/color.test.ts`, sobre `resolveHabitColor`:

- las tres claves válidas se resuelven a sí mismas
- cada clave antigua se resuelve según la tabla (`mint`→`aqua`, `sky`→`violet`,
  `lavender`→`violet`, `peach`→`orange`, `pink`→`orange`, `moss`→`aqua`)
- una clave desconocida y la cadena vacía caen en `aqua`

Se prueba `resolveHabitColor` y no `habitColorVar` porque el primero es la
lógica y el segundo es interpolación de cadena. Los `.tsx` no los ve Vitest, así
que toda regla que merezca prueba vive en `src/lib/`.

Verificación en navegador, ya que las tres fases anteriores produjeron cada una
al menos un fallo real que `tsc`, `eslint` y `build` dieron por bueno:

- `/garden` renderiza con plantas, y con el jardín vacío
- regar una planta desde la escena marca el hábito y refresca las cifras
- las seis fases del cielo (forzando la hora) y el suelo separado
- la franja de color en `/habits` y el cartel tintado en `/garden`
- el selector de color muestra tres muestras y guarda la elección
- Inicio, el detalle de hábito y Tareas se ven igual que antes tras migrar a
  `Stat` — es una extracción, no un rediseño
- `/tasks` y `/projects` siguen en pie tras el renombrado de `PixelConfirm`
- una búsqueda final de `--color-`, `pixel-`, `VT323` y `Press Start` en `src/`
  no devuelve nada

## Fuera de alcance

Sigue pendiente de fases anteriores, documentado y no incluido aquí:

- autenticación antes de cualquier despliegue
- SQLite → Postgres para Vercel
- el fallo de `loading.tsx` en Next 16.2.4 con Turbopack
- `complianceSeries` aplica la programación *actual* de un hábito a todo su
  historial
