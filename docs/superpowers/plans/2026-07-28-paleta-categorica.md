# La paleta categórica · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una sola paleta de colores categóricos en `core/ui`, compartida por identidad de hábito y etiquetas de música, con siete opciones de hábito en vez de tres.

**Architecture:** La paleta se declara una vez en TypeScript (claves, hex y etiqueta) y una vez en CSS (los tokens). Hábitos y música guardan claves en la base y las resuelven en lectura contra ella, cada uno con su mapa de claves heredadas. Ninguna fila se migra.

**Tech Stack:** Next 16.2.12 · Tailwind 4 · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-28-paleta-categorica-design.md`

---

## Antes de empezar: lee esto

**Aquí sí se tocan tests, al contrario que en el rediseño visual.** Allí un test
en rojo señalaba que un cambio de piel había tocado lógica. Aquí la lógica
cambia a propósito —tres colores pasan a siete— y el test debe seguirla. Son
tres afirmaciones sobre nombres en `color.test.ts`, y ninguna otra.

**`contraste.test.ts` NO se toca.** Afirma umbrales sobre `ACENTOS_HABITO` sea
cual sea su contenido, así que verifica el conjunto nuevo por sí solo. Si se
pone en rojo, es que los colores elegidos no pasan y hay que cambiar los
colores, nunca el umbral.

**Los ocho valores ya están medidos.** No los recalcules ni los afines:

```
pink  #ff9ec7  5,43:1     sky   #a5d8ff  6,87:1
lav   #c4b5fd  5,64:1     amber #f4b942  5,88:1
mint  #a7f0c8  7,90:1     coral #ff9980  5,01:1
peach #ffd6a5  7,64:1     acid  #d2ff3a  8,97:1

separación de los siete de hábito: normal 29,6 · deutan 10,1 · protan 12,2
umbrales:                          normal 20   · deutan  9   · protan  9
```

**Ninguna fila de la base cambia.** Hábitos guarda `aqua`/`violet`/`orange` y
música guarda `violet`/`rose`; las dos cosas se resuelven en lectura. Si te ves
escribiendo una migración, te has salido.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/modules/core/ui/paleta.ts` | **Nuevo.** Las ocho entradas, su tipo y el helper de token |
| `src/modules/core/ui/tokens.css` | Los ocho tokens CSS, sustituyendo a los `--h-*` |
| `src/modules/core/ui/contraste.ts` | `ACENTOS_HABITO` pasa a siete |
| `src/modules/habitos/lib/color.ts` | Claves de hábito renombradas y `LEGACY` ampliado |
| `src/modules/habitos/lib/color.test.ts` | Las tres afirmaciones sobre nombres |
| `src/modules/musica/lib/tags.ts` | `TAG_COLORS` sale de la paleta compartida |
| `src/modules/musica/components/TagBadge.tsx` | Resuelve la clave contra la paleta |
| `src/app/globals.css` | Los `--color-tag-*` pasan a apuntar a los tokens compartidos |

---

### Tarea 1: La paleta compartida

**Files:**
- Create: `src/modules/core/ui/paleta.ts`
- Modify: `src/modules/core/ui/tokens.css`

- [ ] **Paso 1: Declarar la paleta**

`src/modules/core/ui/paleta.ts`:

```ts
/**
 * La paleta categórica del dashboard: los colores con los que el usuario
 * distingue cosas entre sí —hábitos, etiquetas, categorías y prioridades—.
 *
 * Es una sola porque antes eran dos —una en hábitos y otra en música— y ninguna
 * sabía de la otra. Compartirla es lo que permite que un color signifique lo
 * mismo en toda la aplicación.
 *
 * LOS VALORES ESTÁN MEDIDOS, no elegidos a ojo. Cada uno aguanta la tinta
 * encima con al menos 4,5:1, que es como se usan: cápsulas, filos y rellenos con
 * texto encima. Y los siete que se ofrecen como hábito mantienen entre sí la
 * separación mínima bajo daltonismo que exige `contraste.test.ts`.
 *
 * Añadir un color nuevo NO es libre: hay que volver a medir el conjunto, porque
 * la separación es una propiedad del grupo y no de cada color por su cuenta.
 */
export const PALETA_CATEGORICA = {
  pink: { hex: "#ff9ec7", label: "Rosa" },
  lav: { hex: "#c4b5fd", label: "Lavanda" },
  mint: { hex: "#a7f0c8", label: "Menta" },
  peach: { hex: "#ffd6a5", label: "Melocotón" },
  sky: { hex: "#a5d8ff", label: "Cielo" },
  amber: { hex: "#f4b942", label: "Ámbar" },
  coral: { hex: "#ff9980", label: "Coral" },
  acid: { hex: "#d2ff3a", label: "Lima" },
} as const;

export type ColorCategorico = keyof typeof PALETA_CATEGORICA;

export const COLORES: ColorCategorico[] = Object.keys(
  PALETA_CATEGORICA,
) as ColorCategorico[];

/**
 * Los que se ofrecen como identidad de hábito: todos menos `acid`.
 *
 * `acid` es el amarillo-verde que se retiró de música por decisión estética. Se
 * queda en la paleta —música tiene etiquetas guardadas con esa clave y quitarla
 * las colapsaría con `amber`— pero no se ofrece al crear un hábito.
 *
 * El tipo lo EXCLUYE, no solo la lista: así un hábito con color `acid` no
 * compila, en vez de colarse y descubrirse en pantalla.
 */
export type ColorHabito = Exclude<ColorCategorico, "acid">;

export const COLORES_HABITO: ColorHabito[] = [
  "pink",
  "lav",
  "mint",
  "peach",
  "sky",
  "amber",
  "coral",
];

/** Referencia al token CSS, para estilos en línea. */
export function varColor(key: ColorCategorico): string {
  return `var(--c-${key})`;
}
```

- [ ] **Paso 2: Los tokens**

En `src/modules/core/ui/tokens.css`, sustituye el bloque `:root` de los `--h-*`
entero por:

```css
/* ==========================================================================
   La paleta categórica

   Los colores con los que el usuario distingue cosas entre sí. Los declara
   `paleta.ts` con su hexadecimal y su etiqueta; aquí solo se les da nombre de
   token para poder usarlos desde CSS.

   No van en `@theme` porque `--c-*` no es un espacio de nombres de Tailwind y
   no queremos utilidades por color: se consumen por `var()`, resolviendo una
   clave guardada en la base.

   La separación de los siete que se ofrecen como hábito la afirma
   `contraste.test.ts`. Añadir uno más obliga a volver a medir el conjunto.
   ========================================================================== */
:root {
  --c-pink: #ff9ec7;
  --c-lav: #c4b5fd;
  --c-mint: #a7f0c8;
  --c-peach: #ffd6a5;
  --c-sky: #a5d8ff;
  --c-amber: #f4b942;
  --c-coral: #ff9980;
  --c-acid: #d2ff3a;
}
```

- [ ] **Paso 3: Verificar**

```bash
cd "/c/PROYECTO JUAMPI"
npx tsc --noEmit && npm run lint
```

El build fallará todavía si algo usaba `--h-*`; se arregla en la Tarea 3.

- [ ] **Paso 4: Commit**

```bash
git add src/modules/core/ui/paleta.ts src/modules/core/ui/tokens.css
git commit -m "feat(ui): declarar la paleta categorica compartida"
```

---

### Tarea 2: Los hábitos pasan a siete colores

**Files:**
- Modify: `src/modules/core/ui/contraste.ts`

- [ ] **Paso 1: Ampliar `ACENTOS_HABITO`**

Sustituye la constante y su comentario:

```ts
/*
  Los siete que identifican hábitos.

  Eran tres, y no por un límite de la ciencia sino del inventario: solo había
  seis pasteles entre los que elegir. Metiendo los trece disponibles —los del
  sistema más los categóricos de música— y buscando por fuerza bruta el conjunto
  más grande que pasa los tres umbrales, el máximo real resultó ser ocho. Se
  ofrecen siete: `acid` queda fuera por decisión estética.

  Bajar el umbral no daría más: relajando el de visión normal de 20 a 15 el
  máximo sigue siendo ocho. No hay nada que ganar aflojando.

  ΔE CIE76 del peor par tras simular cada visión:

                    normal   deutan   protan
    peor par         29.6     10.1     12.2
    quién es       lav~sky  lav~sky  mint~peach
    umbral exigido   20        9        9

  El deutan de 10,1 no empeoró al añadir colores: lo marcaba `lav~sky`, que ya
  estaba en la terna anterior. Sigue siendo el margen más justo del sistema.
*/
export const ACENTOS_HABITO = {
  pink: PALETA.acentos.pink,
  lav: PALETA.acentos.lav,
  mint: PALETA.acentos.mint,
  peach: PALETA.acentos.peach,
  sky: PALETA.acentos.sky,
  amber: "#f4b942",
  coral: "#ff9980",
} as const;
```

`amber` y `coral` van con su hexadecimal literal porque no están en
`PALETA.acentos`, que son los seis del sistema visual. La paleta categórica los
declara en `paleta.ts`; aquí se repiten para que este archivo siga siendo
autocontenido y medible sin importar nada de fuera.

- [ ] **Paso 2: Ejecutar el test que ya existe**

```bash
npx vitest run src/modules/core/ui/contraste.test.ts
```

Esperado: **PASS**, sin haber tocado el test. Afirma la separación sobre
`ACENTOS_HABITO` sea cual sea su contenido, así que verifica el conjunto nuevo
por su cuenta.

**Si falla, el problema son los colores, no el umbral.** No toques
`contraste.test.ts`.

- [ ] **Paso 3: Commit**

```bash
git add src/modules/core/ui/contraste.ts
git commit -m "feat(ui): los habitos pasan de tres a siete colores"
```

---

### Tarea 3: Las claves de hábito, renombradas

**Files:**
- Modify: `src/modules/habitos/lib/color.ts`
- Modify: `src/modules/habitos/lib/color.test.ts`

- [ ] **Paso 1: Reescribir `color.ts`**

Sustituye el archivo entero:

```ts
import {
  COLORES_HABITO,
  PALETA_CATEGORICA,
  varColor,
  type ColorHabito,
} from "@/modules/core/ui/paleta";

/**
 * Los colores de identidad de un hábito: los siete de la paleta categórica,
 * todos menos `acid`.
 *
 * Eran tres, y sus claves —`aqua`, `violet`, `orange`— ya no describían su
 * color desde el rediseño: valían menta, lavanda y cielo. Añadir cuatro claves
 * correctas al lado habría dejado la mitad del conjunto mintiendo, así que se
 * renombran todas y las viejas pasan al mapa `LEGACY` de abajo.
 *
 * La separación de los siete bajo daltonismo la afirma `contraste.test.ts`.
 */
export type HabitColor = ColorHabito;

export const HABIT_COLORS: { key: HabitColor; label: string }[] =
  COLORES_HABITO.map((key) => ({ key, label: PALETA_CATEGORICA[key].label }));

/**
 * El defecto sigue siendo menta, que es lo que valía `aqua`.
 *
 * El esquema de la base declara `aqua` como `@default` de la columna y no se
 * toca: `resolveHabitColor` lo traduce a menta, así que una fila insertada por
 * fuera de la aplicación acaba en el mismo sitio.
 */
export const DEFAULT_HABIT_COLOR: HabitColor = "mint";

/**
 * Claves que estuvieron guardadas en la base y ya no existen, traducidas por
 * tono más cercano.
 *
 * Las tres primeras son las del sistema oscuro, que se renombraron al ampliar
 * la paleta. Las de abajo son de la era pixel original; `moss` era el `@default`
 * del esquema y nunca existió como token, así que ninguna fila que lo tenga
 * guardado mostró jamás un color.
 *
 * No hace falta migrar filas: se resuelve en lectura.
 */
const LEGACY: Record<string, HabitColor> = {
  aqua: "mint",
  violet: "lav",
  orange: "pink",
  moss: "mint",
  lavender: "lav",
};

/** Traduce lo que hay guardado en la base de datos a una clave válida. */
export function resolveHabitColor(stored: string): HabitColor {
  if (stored in PALETA_CATEGORICA && stored !== "acid") {
    return stored as HabitColor;
  }
  return LEGACY[stored] ?? DEFAULT_HABIT_COLOR;
}

/** Referencia al token CSS del color, para usar en estilos inline. */
export function habitColorVar(key: HabitColor): string {
  return varColor(key);
}
```

**Ojo con el `LEGACY`:** las claves antiguas `mint`, `sky`, `peach` y `pink` de
la era pixel **ya no van en el mapa**, porque ahora son claves válidas de la
paleta y se resuelven a sí mismas. Antes traducían a otra cosa; el efecto para
una fila guardada con `mint` es que ahora muestra menta, que es lo que su nombre
decía.

- [ ] **Paso 2: Actualizar las tres afirmaciones sobre nombres**

En `src/modules/habitos/lib/color.test.ts`:

```ts
describe("HABIT_COLORS", () => {
  it("tiene siete colores, el máximo distinguible menos el descartado", () => {
    expect(HABIT_COLORS).toHaveLength(7);
  });
```

```ts
describe("resolveHabitColor", () => {
  it("deja pasar las claves válidas", () => {
    expect(resolveHabitColor("mint")).toBe("mint");
    expect(resolveHabitColor("lav")).toBe("lav");
    expect(resolveHabitColor("pink")).toBe("pink");
  });

  it("traduce las claves del sistema oscuro", () => {
    expect(resolveHabitColor("aqua")).toBe("mint");
    expect(resolveHabitColor("violet")).toBe("lav");
    expect(resolveHabitColor("orange")).toBe("pink");
  });
```

```ts
describe("habitColorVar", () => {
  it("devuelve la referencia al token CSS", () => {
    expect(habitColorVar("mint")).toBe("var(--c-mint)");
    expect(habitColorVar("lav")).toBe("var(--c-lav)");
  });
});
```

**Conserva las demás afirmaciones tal cual**: que `acid` no se ofrece, que las
claves inválidas caen al defecto y que el defecto está en la lista siguen siendo
ciertas y siguen haciendo falta. Añade además:

```ts
  it("no ofrece el color descartado", () => {
    expect(HABIT_COLORS.map((c) => c.key)).not.toContain("acid");
  });
```

- [ ] **Paso 3: Verificar**

```bash
npx tsc --noEmit && npx vitest run src/modules/habitos/lib/color.test.ts
```

- [ ] **Paso 4: Commit**

```bash
git add src/modules/habitos/lib/color.ts src/modules/habitos/lib/color.test.ts
git commit -m "feat(habitos): renombrar las claves de color a su tono real"
```

---

### Tarea 4: Música apunta a la paleta compartida

**Files:**
- Modify: `src/modules/musica/lib/tags.ts`
- Modify: `src/modules/musica/components/TagBadge.tsx`
- Modify: `src/app/globals.css`

- [ ] **Paso 1: `tags.ts` sale de la paleta**

```ts
// Pure types/constants for tags. No "use server" — safe to import anywhere.

import { COLORES, type ColorCategorico } from "@/modules/core/ui/paleta";

/*
  Las etiquetas ofrecen los OCHO colores, incluido `acid`, al contrario que los
  hábitos. Música ya tiene etiquetas guardadas con esa clave y quitarla las
  colapsaría con `amber`: dos etiquetas distintas del usuario pasarían a verse
  iguales.
*/
export const TAG_COLORS = COLORES;

export type TagColor = ColorCategorico;

/**
 * Claves que estuvieron guardadas y ya no existen. `violet` y `rose` eran las
 * de la paleta editorial de música; se traducen por tono más cercano.
 */
const LEGACY: Record<string, TagColor> = {
  violet: "lav",
  rose: "pink",
};

export type Tag = {
  id: number;
  name: string;
  color: string;
  trackCount: number;
};

export const isValidTagColor = (c: string): c is TagColor =>
  (TAG_COLORS as readonly string[]).includes(c);

/** Traduce lo guardado a una clave válida. No hace falta migrar filas. */
export function resolveTagColor(stored: string): TagColor {
  if (isValidTagColor(stored)) return stored;
  return LEGACY[stored] ?? "amber";
}
```

- [ ] **Paso 2: `TagBadge` resuelve la clave**

Sustituye el mapa de siete entradas por una llamada al resolutor:

```tsx
import { varColor } from "@/modules/core/ui/paleta";
import { resolveTagColor } from "@/modules/musica/lib/tags";
```

Y donde antes buscaba en el objeto, ahora:

```tsx
const color = varColor(resolveTagColor(tag.color));
```

Borra el objeto literal `{ acid: "var(--color-tag-acid)", ... }` entero.

- [ ] **Paso 3: Retirar los tokens de etiqueta**

En `src/app/globals.css`, borra el bloque de siete `--color-tag-*` del `@theme`
de música. Ya no los usa nadie: `TagBadge` era su único consumidor y ahora tira
de `--c-*`.

**Compruébalo antes de borrar:**

```bash
grep -rn "color-tag-\|bg-tag-\|text-tag-" src/ || echo "sin consumidores"
```

Si el grep devuelve algo, arréglalo primero.

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 5: Commit**

```bash
git add src/modules/musica src/app/globals.css
git commit -m "feat(musica): las etiquetas usan la paleta compartida"
```

---

### Tarea 5: Verificación final

- [ ] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

- [ ] **Paso 2: Que solo se tocara `color.test.ts`**

```bash
git diff main --stat -- '*.test.ts'
```

Esperado: **solo** `src/modules/habitos/lib/color.test.ts`. Si aparece
`contraste.test.ts`, algo se hizo mal: ese archivo verifica el conjunto nuevo
sin necesitar cambios.

- [ ] **Paso 3: Que no quede rastro de los tokens viejos**

```bash
grep -rn "\-\-h-aqua\|--h-violet\|--h-orange\|--color-tag-" src/ || echo "sin restos"
```

- [ ] **Paso 4: Los siete colores, en pantalla**

Con `npm run dev`, en `http://127.0.0.1:3000/habitos`, abre el formulario de
hábito nuevo y comprueba que el selector de color ofrece **siete** muestras,
todas distintas, y que la elegida lleva su `✓`.

En la consola, que ninguna baje de contraste con la tinta encima:

```js
[...document.querySelectorAll('form button[title]')].map(b => {
  const s = getComputedStyle(b);
  return `${b.title}: ${s.backgroundColor}`;
})
```

Esperado: siete entradas con siete colores distintos.

- [ ] **Paso 5: Que los hábitos existentes no cambien de color**

Tu hábito actual está guardado como `aqua`. Comprueba que su acento sigue siendo
menta —`rgb(167, 240, 200)`— y que en el selector aparece rotulado «Menta».

```js
[...document.querySelectorAll('div')]
  .filter(d => getComputedStyle(d).boxShadow.includes('inset'))
  .map(d => getComputedStyle(d).boxShadow.match(/rgb\([^)]+\)/)?.[0])
```

- [ ] **Paso 6: Las etiquetas de música siguen distinguiéndose**

Esto necesita tu sesión de Spotify. En `/musica/tags`, comprueba que el selector
ofrece ocho colores y que las etiquetas existentes conservan uno distinguible
—las que estuvieran en `violet` ahora se ven lavanda y las de `rose`, rosa.

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. Una sola paleta categórica, consumida por hábitos y por música
- [ ] 3. Los hábitos ofrecen 7 colores y `contraste.test.ts` los verifica **sin tocarse**
- [ ] 4. Las claves viejas (`aqua`, `violet`, `orange`, `rose`) siguen resolviendo
- [ ] 5. Ningún cambio en la base de datos
- [ ] 6. El único test modificado es `color.test.ts`
