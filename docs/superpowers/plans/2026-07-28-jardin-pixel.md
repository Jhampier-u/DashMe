# El jardín en pixel-kawaii · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repintar el jardín y convertir su escena en pixel art conservando las seis fases de cielo.

**Architecture:** Los cielos pasan de degradado suave a bandas planas cambiando solo las paradas, no los colores. El dibujo se convierte; la capa de emoji se queda. Lo que se superpone a la escena pasa a cápsulas de papel, que es lo único que garantiza contraste sobre seis cielos distintos.

**Tech Stack:** Next 16.2.12 · Tailwind 4 · vitest 4.1

**Spec:** `docs/superpowers/specs/2026-07-28-jardin-pixel-design.md`

---

## Antes de empezar: lee esto

**No hay test que escribir primero.** Este paso no añade lógica. Lo sustituyen
los **428 tests existentes sin tocarse** y la verificación en pantalla de la
Tarea 4, que aquí importa más que nunca: **el cielo cambia con la hora local**,
así que hay fases que no vas a poder ver cuando ejecutes esto.

**Las tres reglas del sistema:**

1. **El pastel es fondo o borde, nunca texto.**
2. **Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px.**
3. **En una gráfica, la tinta dibuja y el pastel rellena.**

**Y la regla propia de este paso:** el dibujo se convierte a pixel art; **la capa
de emoji no**. Las plantas, el sol y las nubes son emoji y seguirán sin ser
pixel art hagas lo que hagas. Sus resplandores comunican estado y se conservan.

**No inventes colores de cielo.** Los dieciocho tonos que hay son los que
funcionan; lo único que cambia es que dejan de interpolarse.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `components/GardenScene.tsx` | Cielo, suelo, estrellas, nubes y las plantas |
| `app/jardin/page.tsx` | La composición y las métricas |

---

### Tarea 1: Los seis cielos, en bandas

**Files:**
- Modify: `src/modules/habitos/components/GardenScene.tsx`

- [ ] **Paso 1: Corregir el comentario que va a confundir a la próxima persona**

El comentario actual sobre `SKY` dice que la parada dura «era el bandeado
pixel», tratándolo como defecto. Ahora es el objetivo. Sustitúyelo:

```tsx
// Cielo y suelo van en capas separadas para poder darle al horizonte su propio
// trazo.
//
// Las paradas son DURAS a propósito: `a 0 34%, b 34% 67%` pinta tres franjas
// planas en vez de interpolarlas. Ese bandeado es lo que hace que la escena sea
// pixel art conservando sus seis fases —la noche sigue siendo noche—, y es justo
// lo contrario de lo que buscaba la versión anterior, que lo trataba como un
// defecto a evitar. Si te dan ganas de suavizarlo, es que no has leído esto.
//
// Los colores son los mismos de siempre. Lo único que cambió es cómo se reparten.
```

- [ ] **Paso 2: Los cielos**

```tsx
const SKY: Record<SkyPhase, string> = {
  dawn: "linear-gradient(180deg, #2b2440 0 34%, #6b4f74 34% 67%, #c98f6d 67% 100%)",
  morning: "linear-gradient(180deg, #4a6f9e 0 34%, #7fa3c9 34% 67%, #cfd9e2 67% 100%)",
  midday: "linear-gradient(180deg, #3d7ab5 0 34%, #6ba3d4 34% 67%, #bcd8ea 67% 100%)",
  afternoon: "linear-gradient(180deg, #55749e 0 34%, #8f9cba 34% 67%, #d9b48f 67% 100%)",
  dusk: "linear-gradient(180deg, #241d38 0 34%, #6d5480 34% 67%, #c07f92 67% 100%)",
  night: "linear-gradient(180deg, #0c0c14 0 34%, #16162a 34% 67%, #232144 67% 100%)",
};
```

- [ ] **Paso 3: El suelo**

```tsx
const GROUND: Record<SkyPhase, string> = {
  dawn: "linear-gradient(180deg, #3a4a2c 0 50%, #26301c 50% 100%)",
  morning: "linear-gradient(180deg, #46603a 0 50%, #2c3d24 50% 100%)",
  midday: "linear-gradient(180deg, #4d6b3d 0 50%, #314426 50% 100%)",
  afternoon: "linear-gradient(180deg, #445c36 0 50%, #2b3a22 50% 100%)",
  dusk: "linear-gradient(180deg, #2f3a24 0 50%, #1e2617 50% 100%)",
  night: "linear-gradient(180deg, #1b2416 0 50%, #121810 50% 100%)",
};
```

- [ ] **Paso 4: El horizonte recupera su corte**

Con tres cortes más en el cielo, el horizonte deja de ser el único y puede
perderse. Se le da trazo propio. En la capa del suelo:

```tsx
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: HORIZON,
          bottom: 0,
          background: GROUND[phase],
          // El horizonte era el único corte duro de la escena y por eso se leía
          // como horizonte. Ahora hay tres más arriba, así que se marca.
          borderTop: "3px solid var(--color-line)",
          transition: fade,
        }}
      />
```

- [ ] **Paso 5: Verificar**

```bash
cd "/c/PROYECTO JUAMPI"
npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Paso 6: Commit**

```bash
git add src/modules/habitos/components/GardenScene.tsx
git commit -m "feat(jardin): los seis cielos pasan a bandas planas"
```

---

### Tarea 2: Las estrellas, el marco y la tierra

**Files:**
- Modify: `src/modules/habitos/components/GardenScene.tsx`

- [ ] **Paso 1: Estrellas cuadradas**

Un píxel es cuadrado. Se le quita el radio y el halo:

```tsx
              style={{
                position: "absolute",
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                // Cuadradas y sin halo: un píxel no tiene esquinas redondeadas
                // ni resplandor.
                background: "#f2f2f5",
                animationDelay: `${s.delay}s`,
                pointerEvents: "none",
              }}
```

Se caen `borderRadius: "50%"` y `boxShadow`.

- [ ] **Paso 2: El marco de la escena**

```tsx
    <div
      style={{
        position: "relative",
        border: "3px solid var(--color-line)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-hard)",
        overflow: "hidden",
        minHeight: "30rem",
      }}
    >
```

Que se lea como una lámina puesta sobre el papel.

- [ ] **Paso 3: La barra de tierra de cada planta**

```tsx
      <div
        aria-hidden
        style={{
          width: 72,
          height: 8,
          marginTop: 4,
          // Plana y con esquinas: sin radio y sin degradado.
          background: "#3b2a1a",
          border: "2px solid var(--color-line)",
        }}
      />
```

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
```

- [ ] **Paso 5: Commit**

```bash
git add src/modules/habitos/components/GardenScene.tsx
git commit -m "feat(jardin): estrellas cuadradas, marco y tierra plana"
```

---

### Tarea 3: Lo que se superpone a la escena

El fondo cambia seis veces al día, así que nada que se ponga encima puede
fiarse de él.

**Files:**
- Modify: `src/modules/habitos/components/GardenScene.tsx`

- [ ] **Paso 1: Una cápsula compartida**

Amplía el import de React que ya existe —no añadas una segunda línea del mismo
módulo:

```tsx
import { useTransition, type CSSProperties } from "react";
```

Y añade la constante cerca de las de arriba:

```tsx
/*
  Todo lo que se pone encima de la escena va en papel con tinta. Es lo único
  que garantiza contraste sobre seis cielos distintos: 9,76:1 tanto sobre el
  mediodía como sobre la medianoche. Las cápsulas negras translúcidas de antes
  dependían de que el cielo fuera claro.
*/
const PEGATINA: CSSProperties = {
  background: "var(--color-paper)",
  color: "var(--color-tinta)",
  border: "2px solid var(--color-line)",
  fontFamily: "var(--font-cuerpo)",
};
```

- [ ] **Paso 2: El rótulo de fase**

```tsx
      <div
        style={{
          ...PEGATINA,
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 20,
          padding: "3px 9px",
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {SKY_LABEL[phase]}
      </div>
```

- [ ] **Paso 3: El cartel de cada planta**

```tsx
      <div
        style={{
          ...PEGATINA,
          marginTop: 6,
          maxWidth: "9rem",
          padding: "5px 8px",
          borderRadius: "var(--radius-control)",
          // El filo de color es identidad de hábito y sigue cumpliendo la misma
          // función que en la fila y que en el cartel de la planta.
          borderLeft: `6px solid ${accent}`,
          textAlign: "left",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {habit.name}
        </div>
        {/* La racha es un dato: VT323 en su suelo de 16px. */}
        <div
          style={{
            fontFamily: "var(--font-vt)",
            fontSize: 16,
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {habit.streak} d · {estado}
        </div>
      </div>
```

- [ ] **Paso 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 5: Commit**

```bash
git add src/modules/habitos/components/GardenScene.tsx
git commit -m "feat(jardin): pegatinas de papel sobre la escena"
```

---

### Tarea 4: La composición, y ver las seis fases

**Files:**
- Modify: `src/app/jardin/page.tsx`

- [ ] **Paso 1: Retirar el escudo**

Esto es lo que arregla el fondo negro de la cabecera. Borra el comentario que
explicaba el escudo —ya no aplica— y sustituye el `<main>`:

```tsx
    <main
      style={{
        minHeight: "100%",
        padding: "24px 16px 56px",
        background: "var(--color-paper)",
        color: "var(--color-tinta)",
        fontFamily: "var(--font-cuerpo)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
```

Se cae `className="m-root"`.

- [ ] **Paso 2: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

- [ ] **Paso 3: VER LAS SEIS FASES**

`useLocalHour()` decide la fase, así que a la hora que ejecutes esto solo verás
una. Fuerza las otras cinco con una sonda temporal: en `GardenScene`, justo
después de

```tsx
  const phase: SkyPhase = hour === null ? "night" : phaseFor(hour);
```

sustituye esa línea por

```tsx
  // SONDA TEMPORAL — borrar tras ver las seis fases.
  const phase: SkyPhase = "night";
```

y ve pasando por `"dawn"`, `"morning"`, `"midday"`, `"afternoon"`, `"dusk"` y
`"night"`.

En cada una comprueba:

- que las tres bandas del cielo se distinguen y **no se ven crudas**;
- que el horizonte sigue leyéndose como horizonte;
- que el rótulo de fase y los carteles de planta se leen (van en papel, así que
  deberían, pero es el punto del ejercicio);
- que en `night`, `dusk` y `dawn` salen las estrellas, y que son cuadradas.

**Si tres bandas se ven pobres, la salida es añadir una cuarta intermedia por
fase — no volver al degradado.**

**Restaura la línea original y comprueba con `git diff` que no queda sonda.**

- [ ] **Paso 4: Commit**

```bash
git add src/app/jardin/page.tsx
git commit -m "feat(jardin): repintar la composicion y retirar el escudo"
```

---

### Tarea 5: Verificación final

- [ ] **Paso 1: Los cuatro comandos**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

Si `tests/migrar-ledger.test.ts` da timeout, es el flake conocido. Relánzalo.

- [ ] **Paso 2: Que ningún test se haya modificado, y que no quede sonda**

```bash
git diff main --stat -- '*.test.ts'
grep -rn "SONDA" src/ || echo "sin restos"
```

- [ ] **Paso 3: Contraste y reglas, sobre `/jardin` renderizada**

Con `npm run dev`, en `http://127.0.0.1:3000/jardin`, en la consola:

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

**Ojo con este:** las pegatinas están sobre la escena, cuyo fondo es un
`linear-gradient` y no un color, así que `fondoDe` sube hasta encontrar uno
opaco y puede medir contra el papel de la página. La cifra que importa la dan
las propias pegatinas: papel con tinta, 9,76:1 por construcción.

- [ ] **Paso 4: Que el jardín siga funcionando**

Con hábitos reales: pulsar una planta la riega. Comprueba que sale la lluvia de
partículas y que el cartel se actualiza. **Marca y desmarca la misma planta**
para dejarlo como estaba.

- [ ] **Paso 5: El resto sigue en pie**

`/`, `/habitos`, `/tareas`, `/proyectos` y `/musica` cargan. Proyectos sigue
mezclado y eso es lo esperado.

---

## Criterios de aceptación

- [ ] 1. `build`, `test`, `lint` y `tsc --noEmit` en verde
- [ ] 2. Los 428 tests pasan y **ninguno fue modificado**
- [ ] 3. `/jardin` sin `.m-root` — **el fondo negro desaparece**
- [ ] 4. Las seis fases existen, con cielos de bandas planas
- [ ] 5. Las estrellas son cuadradas y solo salen en fase oscura
- [ ] 6. Todo lo superpuesto a la escena se lee sobre los seis cielos
- [ ] 7. Ningún pastel como texto; suelos de fuente respetados
- [ ] 8. El resto de secciones sigue funcionando
