# El jardín en pixel-kawaii · diseño

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para planificar
**Paso:** 5 de 7 del rediseño visual

---

## 1. Objetivo

Repintar el jardín, y con él resolver el único caso del proyecto donde el
sistema no se aplica a una interfaz sino a **una ilustración**: `GardenScene`
dibuja un cielo con seis fases según la hora local.

## 2. Punto de partida

El jardín es hoy la pantalla más incoherente del dashboard: sus `Stat` y sus
`Card` son de papel desde que se repintaron los seis componentes base, pero la
página conserva el escudo `.m-root` que se le puso para sobrevivir al volteo del
fondo. El resultado es una cabecera sobre fondo negro con tarjetas claras
debajo. **Retirar ese escudo es lo que arregla ese contraste.**

### Lo que hace especial a esta pantalla

`GardenScene` no es una superficie de interfaz. Es un dibujo:

- Seis fases de cielo —amanecer, mañana, mediodía, tarde, atardecer y noche—
  con degradado propio cada una, elegidas por `useLocalHour()`.
- Suelo con su propio degradado por fase.
- 22 estrellas que solo salen cuando la fase es oscura.
- Cuatro nubes que cruzan la escena.
- Las plantas, que crecen de tamaño con la racha.

Aplicarle la paleta pastel eliminaría la noche, y con ella el ciclo entero.

## 3. La decisión: el dibujo pasa a pixel art de verdad

**Los seis cielos se rehacen como bandas planas**, no como degradados suaves.
Es lo que convierte la escena en pixel art conservando sus fases: la noche sigue
siendo oscura y las estrellas siguen teniendo sentido.

La técnica es sustituir

```
linear-gradient(180deg, a 0%, b 50%, c 100%)
```

por paradas duras

```
linear-gradient(180deg, a 0 34%, b 34% 67%, c 67% 100%)
```

**Los colores no cambian.** Se conservan exactamente los tres tonos de cada
fase; lo que cambia es que dejan de interpolarse. Es la conversión mínima fiel:
la paleta ya funciona y no hay motivo para inventar seis cielos nuevos.

**Hay una ironía que debe quedar escrita en el código.** El comentario actual de
`SKY` dice que cielo y suelo se separaron en dos capas porque una parada dura en
el horizonte «era el bandeado pixel», tratándolo como defecto. Ahora el bandeado
es el objetivo. Si no se corrige ese comentario, la próxima persona lo
«arreglará» de vuelta.

### Dónde para el pixel art

**El dibujo se convierte; la capa de emoji se queda como está.**

Las plantas, el sol, la luna y las nubes son emoji, y un emoji no es pixel art
se le haga lo que se le haga. Sus resplandores —el halo del sol, el brillo de la
planta cumplida— viven sobre esa capa y **se conservan**: comunican estado, y
quitarlos por pureza estética costaría información.

Lo que sí se convierte:

- **Las estrellas dejan de ser círculos con halo y pasan a cuadrados sin halo.**
  Un píxel es cuadrado; es el detalle que más dice con menos código.
- **La barra de tierra de cada planta** pierde su radio y su degradado.
- **El marco de la escena**: trazo de 3px, radio de tarjeta y sombra dura, para
  que se lea como una lámina puesta sobre el papel.

### Lo que se pone encima de la escena

El rótulo de fase y el cartel de cada planta van hoy en cápsulas negras
translúcidas con tinta clara. Pasan a **cápsulas de papel con tinta y trazo de
2px**: se leen como pegatinas sobre la lámina y dan 9,76:1 sea cual sea el cielo
detrás, que con un fondo que cambia seis veces al día es la única forma de
garantizar el contraste.

El cartel de planta conserva su filo de color de hábito a la izquierda: es
identidad y sigue cumpliendo la misma función.

## 4. El resto de la pantalla

- `src/app/jardin/page.tsx` pierde su `.m-root` y pone fondo de papel.
- Sus `Card` y `Stat` ya están repintados.
- `PageHeader` ya hereda el color, así que el título se resuelve solo.

## 5. Alcance de este paso

| Archivo | Líneas |
|---|---:|
| `src/modules/habitos/components/GardenScene.tsx` | 393 |
| `src/app/jardin/page.tsx` | 145 |

**Fuera:** proyectos y música.

## 6. Qué no cambia

**Ninguna lógica, ningún dato, ninguna ruta.** `phaseFor`, `seedRand`,
`stageFor`, `plantEmoji` y `isPlantWilted` se quedan igual.

**Los 428 tests siguen en verde sin modificar ninguno.**

**Las seis fases siguen existiendo y siguen eligiéndose por la hora local.**

**La escena sigue comunicando lo mismo:** la fase del día, qué plantas están
regadas hoy, cuáles marchitas, cuál es el ancla, la racha de cada una y su
etapa de crecimiento por tamaño.

**Las estrellas siguen apareciendo solo en fase oscura**, y `isDark` sigue
incluyendo amanecer y atardecer.

**El sembrado sigue siendo determinista**: la escena no baila en cada render.

## 7. Riesgos

**Tres bandas pueden verse crudas.** Un cielo de tres franjas planas es mucho
menos sutil que un degradado. Si al verlo resulta pobre, la salida es añadir una
cuarta banda intermedia por fase, no volver al degradado.

**El horizonte deja de ser el único corte.** Hoy la única parada dura está en el
horizonte y por eso se lee como horizonte. Con el cielo en bandas habrá tres
cortes más, y el horizonte podría dejar de destacar. Se compensa dándole al
suelo un trazo superior de tinta.

**Las cápsulas de papel sobre la escena son mucho más visibles** que las negras
translúcidas de ahora. Van a competir con las plantas por la atención. Es el
precio de garantizar el contraste sobre seis cielos distintos.

## 8. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Los 428 tests pasan **sin que se haya modificado ninguno**
3. `/jardin` sin `.m-root` y con fondo de papel — **el fondo negro desaparece**
4. Las seis fases siguen existiendo, con cielos de bandas planas
5. Las estrellas son cuadradas y solo salen en fase oscura
6. Todo lo que se superpone a la escena se lee sobre los seis cielos
7. Ningún pastel usado como color de texto; suelos de fuente respetados
8. El resto de secciones sigue funcionando

## 9. Fuera de alcance

- Proyectos y música
- Cualquier cambio de lógica, datos o rutas
- Sustituir los emoji por sprites de pixel art
- Fases de cielo nuevas
