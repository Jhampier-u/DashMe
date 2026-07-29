# Música en pixel-kawaii · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar música al sistema pixel-kawaii remapeando su `@theme` y arreglando los sitios de rol invertido que el remapeo rompe.

**Architecture:** Un solo commit voltea los 760 usos cambiando los valores del tema. Los ~100 sitios que eso rompe se localizan en dos pasadas: por grep los dos patrones conocidos, y por auditoría de contraste el resto.

**Tech Stack:** Next 16.2.12 · Tailwind 4 · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-28-musica-pixel-design.md`

---

## Antes de empezar: lee esto

**Este paso rompe música a propósito y luego la arregla.** Entre la Tarea 1 y la
Tarea 4 la sección está a medias. Es la apuesta de la estrategia: romper de
golpe, encontrar con la auditoría, arreglar por archivo. Si te asusta ver la
sección rota después del primer commit, es lo esperado.

**Las tres reglas del sistema:**

1. **El pastel es fondo o borde, nunca texto.**
2. **Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px.**
3. **En una gráfica, la tinta dibuja y el pastel rellena.**

**Los dos patrones que el remapeo invierte**, y que hay que buscar a mano:

- `text-ink*` — significaba «texto oscuro sobre cápsula clara». Tras remapear
  queda papel sobre claro: **invisible**. Pasa a `text-tinta`.
- `bg-cream` y `hover:bg-cream` — significaban «relleno claro». Tras remapear
  quedan tinta, así que su texto encima debe pasar a `text-paper`.

**No puedes ver música renderizada desde la herramienta.** Está tras el login de
Spotify. La auditoría de la Tarea 4 hay que ejecutarla **en el navegador de
quien tenga sesión**, o se quedarán sitios sin encontrar.

**Contrastes ya medidos:**

```
tinta sobre paper .... 9,76:1     tinta sobre sky ...... 6,87:1
tinta sobre paper-2 .. 9,09:1     tinta sobre peach .... 7,64:1
paper sobre tinta .... 9,76:1     tinta sobre yellow ... 8,49:1
```

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/app/globals.css` | El `@theme` de música, sus utilidades y su ambiente |
| `src/app/musica/layout.tsx` | Las fuentes de la sección |
| Los 37 archivos de música | Solo los sitios de rol invertido |

---

### Tarea 1: El remapeo

Un commit que voltea los 760 usos.

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Paso 1: Los nueve tonos**

En el `@theme` de música, sustituye los valores conservando los nombres:

```css
  /*
    Música conserva sus nombres y cambia sus valores. Los nombres describen el
    mundo oscuro del que viene —`ink` era el fondo, `cream` el texto— y
    renombrarlos costaría tocar 760 usos en 37 archivos para no ganar nada.
    Lo que hay debajo ya es el sistema pixel.
  */
  --color-ink: var(--color-paper);
  --color-ink-2: var(--color-paper-2);
  /* Solo hay dos papeles, así que el tercer nivel se colapsa en el segundo. */
  --color-ink-3: var(--color-paper-2);
  --color-cream: var(--color-tinta);
  --color-cream-dim: var(--color-tinta);
  /*
    Los tres niveles de texto se colapsan en uno. `tinta-2` mide 4,00:1 y solo
    cubre texto grande; usarlo para los 214 `text-mute` dejaría media sección
    bajo AA. Es el mismo trade que ya tomaron las otras cinco secciones: la
    jerarquía la dan el tamaño y el grosor, no el tono.
  */
  --color-mute: var(--color-tinta);
  --color-rule: var(--color-line);
  --color-acid: var(--color-yellow);
  --color-blood: var(--color-peach);
```

- [ ] **Paso 2: Las siete etiquetas**

Son una paleta categórica, como los acentos de hábito: siete no caben en seis
pasteles sin que dos dejen de distinguirse. Se conservan y se corrigen las tres
que no aguantaban tinta encima.

```css
  /*
    Paleta categórica de etiquetas. Se usan como cápsulas con tinta encima, así
    que cada una tiene que llegar a 4,5:1 contra `--color-tinta`. Medido:

      acid   #d2ff3a  8,97:1      sky    #6ed3ff  6,16:1
      amber  #f4b942  5,88:1      mint   #62e8aa  6,76:1
      coral  #ff9980  5,01:1  (era #ff7a59, 4,05 — no llegaba)
      violet #c2a5ff  5,01:1  (era #b18cff, 4,00 — no llegaba)
      rose   #ff93b5  5,00:1  (era #ff6c9a, 3,90 — no llegaba)

    Los tres se ACLARAN, no se oscurecen: la tinta es oscura, así que el
    contraste sube alejando el fondo hacia el blanco. Se apunta a 5:1 y no al
    4,5 justo para que un retoque futuro no lo rompa en silencio.

    Siguen siendo siete distinguibles: el peor par es coral~rose con ΔE 30,6,
    muy por encima del umbral de 20 que se exigió a los acentos de hábito.
  */
  --color-tag-acid: #d2ff3a;
  --color-tag-amber: #f4b942;
  --color-tag-coral: #ff9980;
  --color-tag-sky: #6ed3ff;
  --color-tag-violet: #c2a5ff;
  --color-tag-rose: #ff93b5;
  --color-tag-mint: #62e8aa;
```

- [ ] **Paso 3: Las fuentes**

```css
  --font-serif: var(--font-pixel);
  /*
    No pasa a VT323 aunque sea la fuente de datos del sistema: su consumidor
    principal es `.label-mono`, que mide 10px, y VT323 por debajo de 16 deja de
    leerse. Lo que necesita ser más pequeño va en Quicksand.
  */
  --font-mono: var(--font-cuerpo);
```

- [ ] **Paso 4: La clase `.display` pierde sus ejes**

`font-variation-settings` ajusta `opsz`, `SOFT` y `WONK`, que son ejes de
Fraunces. Press Start 2P no tiene ejes, así que esas declaraciones no harían
nada. Se quitan en vez de dejarlas mintiendo:

```css
  .display {
    font-family: var(--font-serif);
    letter-spacing: 0;
    line-height: 1.5;
  }
  .display-italic {
    font-family: var(--font-serif);
    letter-spacing: 0;
    line-height: 1.5;
  }
```

El `letter-spacing` negativo también se va: apretaba una serif variable y sobre
una pixelada monoespaciada solo la emborrona.

- [ ] **Paso 5: El ambiente**

Sustituye `.musica-root` y borra `.musica-root::before` entero:

```css
/*
  El contenedor de la sección. Ya no monta ambiente: los dos degradados
  radiales eran resplandores ácido y rojo para un mundo oscuro, y el grano de
  película contradice el pixel art, que es plano por definición. La textura del
  sistema es el papel y el trazo, no el ruido.

  Se conserva la clase porque es donde se aplican las fuentes de la sección.
*/
.musica-root {
  font-feature-settings: normal;
}
```

- [ ] **Paso 6: Verificar que compila**

```bash
cd "/c/PROYECTO JUAMPI"
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

La sección estará rota visualmente. Eso es lo esperado en este punto.

- [ ] **Paso 7: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(musica): remapear el tema al sistema pixel"
```

---

### Tarea 2: Las fuentes dejan de cargarse

**Files:**
- Modify: `src/app/musica/layout.tsx`

- [ ] **Paso 1: Quitar Fraunces y JetBrains**

Borra los dos imports de `next/font/google`, las dos constantes `fraunces` y
`mono`, y sus `.variable` del `className` del contenedor. **No toques el guard
de sesión ni el `redirect`**: es lo que protege la sección.

El `className` queda:

```tsx
      className="musica-root min-h-full flex flex-col antialiased bg-ink text-cream font-serif selection:bg-acid selection:text-ink"
```

Y actualiza el comentario de cabecera del archivo, que explica por qué las
fuentes viven ahí: ya no viven ahí.

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit && npm run lint && npm run build
grep -rn "fraunces\|jetbrains\|Fraunces\|JetBrains" src/ || echo "sin restos"
```

- [ ] **Paso 3: Commit**

```bash
git add src/app/musica/layout.tsx
git commit -m "feat(musica): dejar de cargar Fraunces y JetBrains"
```

---

### Tarea 3: Los dos patrones invertidos

Son los que el remapeo rompe y se pueden encontrar sin navegador.

**Files:**
- Modify: los archivos de música que los usen

- [ ] **Paso 1: Localizarlos**

```bash
echo "=== text-ink (texto oscuro sobre capsula clara) ==="
grep -rn "text-ink\b\|text-ink-2\b\|text-ink-3\b" src/modules/musica src/app/musica
echo "=== bg-cream y hover:bg-cream (relleno claro) ==="
grep -rn "bg-cream\b\|hover:bg-cream\b" src/modules/musica src/app/musica
```

- [ ] **Paso 2: `text-ink*` pasa a `text-tinta`**

Significaba «texto oscuro», y tras el remapeo `ink` es el papel. Es una
sustitución directa: `text-ink` → `text-tinta`, y lo mismo con `-2` y `-3`.

**Comprueba el contexto de cada uno antes de sustituir.** Si alguno estuviera
usándose como texto sobre un fondo oscuro de verdad, la sustitución sería
incorrecta — pero en música no hay fondos oscuros después del remapeo.

- [ ] **Paso 3: `bg-cream` arrastra a su texto**

`bg-cream` era un relleno claro y ahora es tinta maciza. El texto que caiga
encima tiene que pasar a `text-paper`. Búscalo en el mismo elemento o en sus
hijos directos.

El patrón típico es un botón: `bg-cream text-ink` → pasa a `bg-tinta text-paper`
(o, más simple, se deja `bg-cream` —que ya es tinta— y su texto pasa a
`text-paper`).

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 5: Commit**

```bash
git add src/modules/musica src/app/musica
git commit -m "feat(musica): arreglar los sitios de rol invertido"
```

---

### Tarea 4: La auditoría, en el navegador de quien tenga sesión

**Aquí hace falta el usuario.** Música está tras el login de Spotify.

- [ ] **Paso 1: Pedirle que recorra las doce rutas**

```
/musica              /musica/biblioteca    /musica/stats
/musica/historial    /musica/library       /musica/tags
/musica/smart        /musica/ajustes       /musica/playlist/<id>
/musica/escucha/artista/<key>   /musica/escucha/album/<key>
/musica/escucha/cancion/<key>
```

En cada una, esto en la consola del navegador:

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
    if (r < 3) bajo3.push(`${r}:1 "${el.textContent.trim().slice(0,30)}"`);
    if (PASTELES[s.color]) malColor.push(el.textContent.trim().slice(0,30));
    if (/Press Start 2P/.test(s.fontFamily) && size < 14) malFuente.push('PressStart ' + size);
    if (/VT323/.test(s.fontFamily) && size < 16) malFuente.push('VT323 ' + size);
  }
  return { ruta: location.pathname, CONTRASTE: bajo3.length ? bajo3 : 'ok',
           REGLA1: malColor.length ? malColor : 'ok', REGLA2: malFuente.length ? malFuente : 'ok' };
})()
```

- [ ] **Paso 2: Arreglar lo que salga, archivo por archivo**

Cada entrada de `CONTRASTE` trae el texto del elemento, que basta para
localizarlo por `grep`. Las reglas de decisión:

- **Texto claro sobre claro** → el color pasa a `text-tinta`.
- **Texto oscuro sobre oscuro** → el fondo es tinta, así que el texto pasa a
  `text-paper`.
- **Pastel como color de texto** (`REGLA1`) → pasa a `text-tinta`, y si hacía
  falta destacar, se rodea de un relleno.
- **Pixelada por debajo de su suelo** (`REGLA2`) → si es Press Start 2P, sube a
  14px o el texto se acorta; si es VT323 por debajo de 16, pasa a Quicksand.

Un commit por archivo o por grupo de archivos relacionados.

- [ ] **Paso 3: Repetir hasta que las doce rutas den `ok` en los tres**

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

- [ ] **Paso 3: Que no quede rastro de las fuentes viejas**

```bash
grep -rniE "fraunces|jetbrains" src/ || echo "sin restos"
```

- [ ] **Paso 4: El resto del dashboard sigue en pie**

`/`, `/habitos`, `/tareas`, `/proyectos` y `/jardin` cargan y se ven como antes.
El remapeo tocó tokens que **solo usa música**, así que no deberían haberse
movido — pero se comprueba, porque comparten `globals.css`.

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. Los 428 tests pasan y **ninguno fue modificado**
- [ ] 3. Ningún texto bajo 3:1 en las doce rutas de música
- [ ] 4. Los siete colores de etiqueta siguen siendo siete y distinguibles
- [ ] 5. Ningún pastel como color de texto
- [ ] 6. Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px
- [ ] 7. Fraunces y JetBrains ya no se cargan
- [ ] 8. El resto del dashboard sigue funcionando
