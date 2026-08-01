# El jardín en pixel art · diseño

**Fecha:** 2026-07-30
**Estado:** aprobado, listo para planificar
**Paso:** 2 de 5 del rediseño del jardín

---

## 1. Objetivo

Que el jardín deje de ser emoji y pase a estar **dibujado**: cinco especies con
cinco etapas reales, la escena entera en pixel art, y las plantas colocadas donde
tú quieras.

## 2. Lo que arrastra del bloque anterior

Del bloque A quedó pendiente lo que no se podía hacer con emoji: **tres de las
cinco especies no crecen** porque no existen cinco emoji de cactus. Aquí se
arregla, porque dibujando sí existen.

## 3. Los sprites son rejillas de texto

Un sprite no se escribe en SVG. Se escribe así:

```
. . . g . . .
. . g G g . .
. g G R G g .
. . . t . . .
. . . t . . .
```

Un carácter por píxel, cada letra una entrada de una paleta. El código lo
convierte en rectángulos.

**Por qué esto y no SVG a mano**, que es la decisión de la que depende que el
bloque sea posible:

- Veinticinco sprites en SVG a mano son miles de líneas ilegibles. En rejilla son
  veinticinco bloques que se leen de un vistazo.
- **Tú puedes retocarlos sin saber SVG.** Cambiar un pétalo es cambiar una letra.
- Un error se ve mirando: un píxel fuera de sitio salta a la vista en el texto.

La rejilla es de **16 × 16**. Cabe una flor reconocible, y a 3 px por celda da
48 px, que es el tamaño al que hoy se pintan las plantas medianas.

### La paleta

Sale de la que ya existe —`--c-*` y la tinta— y no se inventa ninguna. Cada letra
apunta a un token, así que si algún día cambia la paleta, cambian los sprites.

`.` es transparente. Las mayúsculas son la versión oscura de cada color, para
poder sombrear sin meter tonos nuevos.

## 4. Las cinco especies, con cinco etapas de verdad

| | 0 · Semilla | 1 · Brote | 2 · Joven | 3 · Madura | 4 · Floreciente |
|---|---|---|---|---|---|
| Flor | tierra removida | dos hojas | tallo con capullo | flor abierta | flor grande y dos capullos |
| Árbol | tierra removida | brote con dos hojas | tronco fino y copa pequeña | tronco y copa ancha | copa con frutos |
| Hierba | tierra removida | tres briznas | mata baja | mata alta | espigas |
| Cactus | tierra removida | bola pequeña | columna | columna con brazo | con flor arriba |
| Hongo | tierra removida | punto blanco | sombrero pequeño | sombrero abierto | corro de tres |

**Cada etapa cambia de silueta, no solo de tamaño.** Es lo que el jardín prometía
y no cumplía.

Más dos estados que no son etapas:

- **Marchita** — la silueta de su etapa, caída y en tonos apagados.
- **Regada hoy** — un brillo, no un cambio de dibujo.

## 5. Las plantas van en huecos, no en coordenadas

El jardín es una **rejilla de parcelas**. Cada hábito ocupa un hueco, guardado
como un número entero en `habits.garden_slot`.

**Huecos y no coordenadas libres**, y esta es la decisión que evita la mitad de
los problemas:

- Dos plantas **no pueden solaparse**, porque un hueco es de una.
- Nada puede quedar fuera de la pantalla.
- Arrastrar es **intercambiar dos huecos**, que es una operación reversible y
  trivial de guardar: un número.
- En móvil funciona igual, porque no hay precisión que acertar.

Un hábito nuevo cae en el primer hueco libre. Si hay más hábitos que huecos, la
rejilla crece por abajo.

## 6. Arrastrar no puede ser la única forma

Es la regla de accesibilidad del rediseño, y aquí es literal: **una interfaz que
solo se puede usar arrastrando es inservible con teclado**.

Cada planta es un botón. Con el teclado: `Enter` la coge, las flechas la mueven de
hueco, `Enter` la suelta, `Escape` cancela. Con el ratón, arrastrar hace lo mismo.

Las dos rutas llaman a la **misma** función de intercambio.

## 7. Que se entienda sin ver bien

- Cada planta lleva `role="img"` y un `aria-label` que dice especie, etapa y
  estado: «Flor, madura, regada hoy».
- La etapa no depende solo del dibujo: el cartel de debajo ya la dice en texto.
- Marchita no se distingue **solo por el color**: la silueta está caída.
- El foco del teclado se ve, con el mismo anillo del resto del dashboard.

## 8. La escena entera

Sol, luna, nubes y suelo pasan también a pixel art. El **estado** del cielo no
cambia: sigue siendo la hora real y el tiempo del bloque A. Solo cambia el dibujo.

## 9. Alcance

| Archivo | Qué |
|---|---|
| `core/ui/pixel/sprite.ts` | **Nuevo.** Rejilla de texto → SVG, y la paleta |
| `core/ui/pixel/sprite.test.ts` | **Nuevo.** |
| `core/ui/pixel/Sprite.tsx` | **Nuevo.** El componente |
| `habitos/lib/sprites/*.ts` | **Nuevo.** Los dibujos, uno por especie |
| `habitos/lib/garden.ts` | El emoji sale; queda la lógica de etapas |
| `habitos/lib/huecos.ts` | **Nuevo.** Colocar e intercambiar, puro |
| `habitos/lib/huecos.test.ts` | **Nuevo.** |
| `core/db/*`, `habitos/schema.ts`, `migrar.ts` | `habits.garden_slot` |
| `habitos/components/GardenScene.tsx` | Redibujada |

## 10. Qué no cambia

- Las etapas y cuándo se alcanzan: 1, 3, 7 y 14 días.
- Qué es estar marchita.
- El tiempo y las fases del día.
- Regar pulsando una planta.

## 11. Riesgos

**El estilo puede no gustarte.** Por eso el plan entrega **la flor primero**: si
el estilo falla, se tira un sprite y no veinticinco. Es la razón de que este
bloque vaya por etapas.

**Es mucho dibujo mío y no puedo enseñártelo antes de hacerlo.** Un sprite mal
proporcionado no lo detecta ningún test: hay que mirarlo.

**`garden_slot` es una columna nueva en una tabla que existe**, así que **sí hace
falta `migrar.ts`**. Nulo significa «aún sin sitio» y se resuelve al colocar.

**Arrastrar es lo más fácil de romper en móvil.** Por eso los huecos: sin
precisión que acertar, y con la ruta de teclado como red.

## 12. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Un sprite se define en texto y se pinta igual que su rejilla
3. Las cinco especies tienen cinco siluetas distintas
4. Marchita se distingue por forma, no solo por color
5. Dos plantas nunca ocupan el mismo hueco
6. Las plantas se pueden reordenar **con el teclado**, sin ratón
7. Cada planta dice especie, etapa y estado a un lector de pantalla
8. La migración añade `garden_slot` y es idempotente
9. Ningún emoji queda en la escena del jardín

## 13. Fuera de alcance

- La memoria del jardín, la tienda y el cruce: bloques C, E y F
- Animar las plantas
- Sprites para tareas o proyectos
