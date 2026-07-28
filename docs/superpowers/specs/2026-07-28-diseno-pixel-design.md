# Sistema visual pixel-kawaii · cimientos y hábitos

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para planificar
**Paso:** 1 de 6 del rediseño visual

---

## 1. Objetivo

Darle vida al dashboard con una estética cute y pixel art, empezando por el sistema
de diseño y una pantalla completa —hábitos— para poder juzgarlo funcionando antes de
extenderlo al resto.

**Este documento cubre solo cimientos y hábitos.** Tareas, proyectos, jardín, música y
portada van después, cada uno con su propio ciclo.

## 2. Punto de partida

### Los dos vocabularios que existen hoy

| Módulo | Modelo | Superficie |
|---|---|---|
| `habitos` | `var(--m-*)` en estilos inline | 207 usos |
| `musica` | Utilidades de Tailwind sobre `@theme` | **757 usos, cero hexadecimales sueltos** |

El de música es el que aguanta un cambio de piel sin tocar componentes, y por eso es
el modelo que adopta el sistema nuevo. Es una ironía útil: la sección que llegó ayer
está mejor preparada para esto que la que lleva más tiempo.

### La referencia

`legacy/portafolio/css/styles.css` es pixel-art kawaii pastel y ya resuelve el
problema que probablemente hundió el pixel anterior de Untap: **reparte tres fuentes
por papeles** en vez de usar la pixelada para todo.

```
--font-px:   'Press Start 2P'   → títulos y acentos
--font-vt:   'VT323'            → datos
--font-body: 'Quicksand'        → lo que hay que leer
```

### Lo que se retiró ayer, y por qué importa

`docs/untap/specs/2026-07-27-jardin-y-retirada-pixel-design.md` documenta la retirada
del sistema pixel de Untap, con un criterio que este rediseño hereda:

> Se queda lo que comunica estado o tiempo, se va lo que era relleno decorativo de 8 bits.

Lo que se retiró fue una implementación, no la estética. Este spec la recupera con las
tres fuentes separadas por papel, que es lo que evita que canse.

### Restricciones heredadas que no se negocian

- **La separación de los colores de hábito está medida.** `src/app/globals.css`
  documenta que aqua, violeta y naranja se eligieron calculando ΔE bajo daltonismo,
  porque ningún conjunto de cuatro pasaba. Los hexadecimales pueden cambiar; el
  criterio no.
- **Los contrastes actuales están anotados en el propio CSS** con sus ratios AA
  medidos sobre `--m-surface`. El sistema nuevo debe poder decir lo mismo de los suyos.

## 3. Decisiones tomadas

| Decisión | Elección |
|---|---|
| Dirección visual | **A · Cuaderno** — la paleta del Portafolio, sin cambios |
| Modelo de tokens | Utilidades de Tailwind sobre `@theme`, como música |
| Alcance de este paso | Cimientos + `/habitos` completa |
| Música | Se queda oscura hasta su propio paso; nada de repintarla a medias |
| Jardín | Va en su propio paso, con su propia conversación |

## 4. El sistema

### Color

```
Papel      --paper    #fff5fb     --paper-2  #ffeaf6
Tinta      --ink      #4a3a52     --ink-2    #8a738f
Trazo      --line     #4a3a52     (3px, sin excepciones)

Acentos    --pink     #ff9ec7     --lav      #c4b5fd
           --mint     #a7f0c8     --peach    #ffd6a5
           --sky      #a5d8ff     --yellow   #ffe6a7
```

**Regla dura: el pastel es fondo o borde, nunca texto.** Los pasteles sobre crema
tienen contraste bajo por naturaleza. El texto va siempre en `--ink` o `--ink-2`
sobre papel. Esta regla es lo que hace que la paleta sea usable y no solo bonita.

Los tres acentos de hábito salen de esta paleta, pero **hay que medir su separación
bajo daltonismo antes de fijarlos**, igual que se hizo con los actuales. Elegir tres
pasteles porque quedan bien juntos es exactamente el error que el criterio anterior
evitaba.

**Si ninguna terna de pasteles pasa la separación**, la salida no es rebajar el
criterio: es oscurecer esos tres acentos concretos hasta que pasen, conservando el
resto de la paleta clara. Un hábito mal distinguido es un fallo funcional; un rosa
menos pastel es una concesión estética. Se cede en la estética.

**El dashboard pasa de oscuro a claro.** Hoy `--m-page` es `#0f0f13`; la dirección
Cuaderno es crema. Es el cambio más visible de todo el rediseño y afecta a cada
pantalla, no solo a las repintadas — conviene tenerlo presente al ver hábitos en
pastel junto a secciones que siguen en oscuro.

### Tipografía

| Fuente | Papel | Límites |
|---|---|---|
| Press Start 2P | Títulos de sección, nivel | **Nunca por debajo de 14px.** Máximo cuatro palabras |
| VT323 | Números, rachas, XP, etiquetas | Desde 16px |
| Quicksand | Frases: nombres, descripciones, ayuda | Cuerpo normal |

Se cargan con `next/font/google` en el layout raíz, siguiendo el patrón que música ya
usa para Fraunces y JetBrains Mono.

El límite de 14px en Press Start 2P no es estético: por debajo es ilegible. Si un
título no cabe, se acorta el texto — no se baja el tamaño.

### Forma

- Borde de **3px** en `--line`, en todo.
- Sombra **dura, 4px abajo-derecha, sin blur**: `4px 4px 0 var(--line)`.
- Radio de 10px en controles, 14px en tarjetas.

La sombra sin desenfoque es lo que hace que se lea como sticker en vez de como
material design. Es la regla que más define el resultado.

## 5. Los componentes

Seis, en `src/modules/core/ui/`. **No se crean nuevos: se repintan los que ya hay.**

`Card` · `Button` · `Field` · `Modal` · `PageHeader` · `Stat`

Cada uno recibe borde de 3px, sombra dura y el radio que le toque. Su API pública no
cambia: los consumidores no se enteran salvo por el aspecto.

## 6. Alcance de este paso

**Dentro:**

1. `src/modules/core/ui/tokens.css` con la paleta y el `@theme`.
2. Las tres fuentes cargadas en el layout raíz.
3. Los seis componentes base repintados.
4. `/habitos` completa: cabecera, filas de hábito, calendario mensual, panel de
   diagnóstico, formulario de hábito nuevo.

**Fuera, cada uno en su propio paso:** tareas, proyectos, jardín, música, portada.

## 7. Qué no cambia

**Ninguna lógica, ningún dato, ninguna ruta.** Esto es piel. Tocar una consulta o un
cálculo de racha significa haberse salido del carril.

**Los 420 tests siguen en verde sin modificar ninguno.** Son de lógica pura y de
acceso a datos; un rediseño no debería rozarlos. Un test en rojo es la señal de que el
cambio dejó de ser visual.

**Los tres colores de hábito conservan su función:** acento en la fila y tinte del
cartel de su planta. Cambian de valor, no de papel.

**La barra de siete días sigue comunicando lo mismo:** qué días tocaban, cuáles se
cumplieron y cuáles fueron en modo mínimo. Lo decorativo se añade alrededor de lo que
ya comunica algo, nunca encima.

## 8. Riesgos

**El contraste.** Es el riesgo principal y el que hunde las paletas pastel. La regla
de «pastel nunca como texto» lo evita por construcción, pero hay que verificarlo con
ratios medidos, no a ojo, y dejarlos anotados en el CSS como están hoy.

**La legibilidad de las pixeladas.** Press Start 2P por debajo de 14px y VT323 por
debajo de 16px son ilegibles. Si el diseño necesita texto más pequeño, ese texto va en
Quicksand — no se encoge la pixelada.

**El daltonismo.** Los tres acentos de hábito deben medirse antes de fijarse. Es un
cálculo, no una opinión.

**Deriva de alcance.** Es un rediseño: la tentación de «ya que estoy» es máxima. Solo
entran los seis componentes y `/habitos`. El jardín, en particular, queda fuera aunque
sea la pantalla más divertida de repintar.

**Dos pieles a la vez.** Al terminar este paso, hábitos será pastel y el resto seguirá
en el lenguaje actual. Es feo y es temporal, y es preferible a repintar seis secciones
antes de saber si la dirección funciona.

## 9. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. **Los 420 tests pasan sin que se haya modificado ninguno**
3. Las tres fuentes cargan y cada una se usa solo en su papel
4. `/habitos` completa en el estilo nuevo: cabecera, filas, calendario, diagnóstico y
   formulario
5. Ningún pastel usado como color de texto
6. Los ratios de contraste de los tokens nuevos, medidos y anotados en el CSS
7. La separación de los tres colores de hábito bajo daltonismo, calculada y anotada
8. El resto de secciones sigue funcionando, aunque con el aspecto anterior

## 10. Fuera de alcance

- Tareas, proyectos, jardín, música y portada
- Cualquier cambio de lógica, datos o rutas
- Animaciones y micro-interacciones más allá de los estados que ya existen
- Modo claro/oscuro: la dirección Cuaderno se compromete con un solo mundo
