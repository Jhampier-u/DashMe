# La portada y las gráficas en pixel-kawaii · diseño

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para planificar
**Paso:** 3 de 7 del rediseño visual

---

## 1. Objetivo

Repintar la portada y, sobre todo, **fijar cómo se dibujan los datos en el
sistema pixel**. Las gráficas son lo único del proyecto que el sistema no ha
tocado todavía, y no son de la portada: las reusan tareas y proyectos. Lo que se
decida aquí gobierna esos dos pasos.

## 2. Punto de partida

Los dos pasos anteriores levantaron el sistema, repintaron `/habitos` y el
armazón, y voltearon el fondo del documento a papel.

La portada quedó a medias por construcción: sus `Stat` y su `QuestList` son
pastel desde que se repintaron los seis componentes base, y el resto sigue
oscuro. Es la pantalla de la captura que abrió este encargo.

**Queda un texto ilegible en todo el proyecto**, y está aquí: el selector de
rango de `TrendCard` mide 1,12:1. Este paso lo cierra.

### Las gráficas son territorio nuevo

`LineChart` y `BarChart` son genéricos de dominio: reciben números y dibujan.
`ComplianceChart` es el envoltorio que traduce conceptos de hábitos a esas
series. Ninguno sabe nada del sistema visual, y los tres están en el lenguaje
oscuro.

Los usa la portada hoy, y los usarán tareas y proyectos.

## 3. Decisiones tomadas

| Decisión | Elección |
|---|---|
| Quién dibuja el dato | La tinta, no el pastel |
| Para qué sirve el pastel en una gráfica | Rellenar áreas y barras, nunca trazar |
| Rótulos de eje | Quicksand, porque a 11px VT323 está bajo su suelo |
| Tooltip duplicado | Se extrae a un componente compartido |
| `MetricTiles` | No se toca: es composición pura de `Stat` |

## 4. El sistema aplicado a los datos

### La regla: la tinta dibuja, el pastel rellena

| Elemento | Hoy | Pasa a |
|---|---|---|
| Línea de tendencia | azul 2px | **tinta 3px** |
| Área bajo la línea | azul al 10% | **sky macizo** |
| Puntos del día | azul al 45% | tinta |
| Punto con escudo | anillo ámbar | **peach con filo de tinta** |
| Barras | azul al 55% | **sky con borde de tinta de 2px** |
| Barra bajo el ratón | azul macizo | tinta maciza |
| Rejilla y cruceta | 1px gris | 2px discontinuo en `--color-line` |
| Base del eje | 1px | 3px |
| Tooltip | superficie oscura | papel, trazo de 3px, sombra dura |
| Rótulos de eje | 10px gris | Quicksand 11px en tinta |

**Por qué la línea va en tinta y no en un pastel.** La línea *es* el dato. Un
trazo fino en pastel sobre papel no se sostiene: rosa sobre crema a 3px de grosor
se pierde, y oscurecerlo lo sacaría de la paleta. La tinta da 9,76:1 y además
encaja con el resto del sistema, donde todo lleva su contorno de tinta.

**Por qué el área sí es pastel.** Es superficie, no trazo, y es exactamente el
papel que la regla dura le reserva al pastel. Sky macizo bajo una línea de tinta
se lee sin ambigüedad.

**Por qué los rótulos no van en VT323.** Miden 10–11px. VT323 por debajo de 16px
deja de leerse, y una gráfica de 190px de alto no admite rótulos de 16. La regla
del sistema para esos casos es explícita: lo que necesita ser más pequeño va en
Quicksand.

**El punto con escudo conserva su forma.** Hoy es un anillo y no un disco, que es
lo que lo distingue de los puntos normales sin depender del color. Se mantiene el
anillo y solo cambia el tono a peach.

### El tooltip compartido

`LineChart` y `BarChart` declaran hoy el mismo tooltip con los mismos doce
valores, copiado. Se extrae a `ChartTooltip`, que recibe el contenido y la
posición horizontal y resuelve por su cuenta el anclaje a los bordes.

No es refactor gratuito: son dos ficheros que este paso repinta de todas formas,
y mantener la duplicación significaría escribir el estilo pixel dos veces.

### La portada

- `TodayCard` y `TrendCard` dejan de dibujar su propia superficie y pasan a
  `<Card>`, igual que hizo `QuestList`.
- **El selector de rango** (28d/90d/12m) pasa a rejilla de teclas con la variante
  `aria-pressed:` de Tailwind, el mismo recurso que el formulario de hábito
  nuevo. Es lo que cierra el 1,12:1.
- Las píldoras de hábito pendiente pasan a teclas con trazo y hundido: se pulsan
  para marcar, así que deben parecer pulsables.
- **Dos textos pierden su color.** «Día completo» iba en verde y «viene de
  fallar» en rojo; los dos pasan a tinta con más grosor. El punto que marca un
  hábito crítico sí puede llevar color, porque es un punto y no texto: peach con
  filo de tinta.
- Los rótulos de sección («HÁBITOS», «MÚSICA») en VT323 a 16px, su suelo.
- La página pierde su `.m-root` y pone fondo de papel, como hizo `/habitos`.

## 5. Alcance de este paso

| Archivo | Líneas |
|---|---:|
| `src/modules/habitos/components/charts/LineChart.tsx` | 188 |
| `src/app/page.tsx` | 199 |
| `src/modules/habitos/components/charts/BarChart.tsx` | 114 |
| `src/modules/habitos/components/home/TodayCard.tsx` | 112 |
| `src/modules/habitos/components/home/TrendCard.tsx` | 105 |
| `src/modules/habitos/components/charts/ComplianceChart.tsx` | 53 |
| `src/modules/habitos/components/charts/ChartTooltip.tsx` | nuevo |

Son 771 líneas, no las 941 que anota el mapa del paso anterior. La diferencia
son `QuestList`, `MetricTiles` y `ProgressRing`: viven en estas dos carpetas y
contaban en el bloque, pero ya se repintaron sobre la marcha en pasos anteriores.

**Fuera:** tareas, jardín, proyectos y música. `MetricTiles` no se toca: es
composición pura de `Stat`, igual que lo era `HabitsHeader`.

## 6. Qué no cambia

**Ninguna lógica, ningún dato, ninguna ruta.** Las escalas, los caminos SVG y la
matemática de `lib/chart.ts` se quedan como están: esto es piel.

**Los 428 tests siguen en verde sin modificar ninguno.**

**Las gráficas siguen comunicando lo mismo:** la media móvil, el cumplimiento
crudo de cada día, qué días llevaron escudo, y el tooltip con su detalle. El
anillo del escudo sigue siendo un anillo.

**`BarChart` sigue pintando la base sin barras cuando todo vale cero**, en vez de
dividir por cero al escalar.

**La cruceta y el tooltip siguen usando la misma escala X.** Si difirieran,
señalarían días distintos.

## 7. Riesgos

**El área maciza puede tapar los puntos.** Hoy el relleno está al 10% y los
puntos se ven a través. Con sky macizo, los puntos que caigan bajo la línea
quedan sobre un fondo azul en vez de sobre papel. Tinta sobre sky da 6,87:1, así
que se ven — pero hay que mirarlo, no darlo por hecho.

**Los rótulos de eje a 11px.** Es el texto más pequeño del sistema. En tinta
plena sobre papel da 9,76:1, pero es pequeño; si en pantalla no se lee, se sube
el tamaño y se recorta el número de marcas, no al revés.

**El tooltip compartido cambia dos componentes a la vez.** Un fallo ahí se ve en
la portada, y luego en tareas y proyectos. Se extrae primero y se verifica antes
de repintar nada.

## 8. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Los 428 tests pasan **sin que se haya modificado ninguno**
3. La portada completa en el estilo nuevo, sin `.m-root`
4. **Ningún texto por debajo de 3:1 en toda la portada** — cierra el 1,12:1
5. Ningún pastel usado como color de texto
6. Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px
7. Las gráficas conservan media móvil, puntos, escudos y tooltip
8. `/habitos` y el armazón intactos; el resto de secciones sigue funcionando

## 9. Fuera de alcance

- Tareas, jardín, proyectos y música
- Cualquier cambio de lógica, datos o rutas
- Tipos de gráfica nuevos
- Modo claro/oscuro
