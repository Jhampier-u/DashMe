# Tareas en pixel-kawaii · diseño

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para planificar
**Paso:** 4 de 7 del rediseño visual

---

## 1. Objetivo

Repintar la sección de tareas con el sistema pixel-kawaii. Es el bloque más
pequeño que queda —404 líneas— y el primero que se apoya casi entero en
decisiones ya tomadas.

## 2. Punto de partida

Los tres pasos anteriores dejaron resuelto casi todo lo que esta sección
necesita: los seis componentes base, el armazón, la superficie de formulario, la
tecla con su hundido, el sello de estado y la regla de gráficas.

**`BarChart` se repintó en el paso anterior pero no se ve en ninguna pantalla
todavía**: la portada solo usa `LineChart`. `FlowPanel` es su primer consumidor,
así que este paso es donde se comprueba de verdad la decisión de las barras.

## 3. La única decisión nueva: el estado de una tarea

El reparto de acentos vigente asigna `pink · lav · mint` a la identidad de
hábito y `sky · peach · yellow` al armazón de la interfaz. El estado de una
tarea no es ninguna de las dos cosas.

**No se inventa semántica de color.** Las tres columnas se distinguen por el
relleno de su contador, reusando el vocabulario que ya existe:

| Columna | Contador |
|---|---|
| Por iniciar | `paper-2` con trazo de 2px |
| En curso | `sky` |
| Hecho | **tinta invertida** — el mismo sello que «Hecho» en la fila de hábito |

Que «hecho» se vea igual en hábitos y en tareas es coherencia de sistema, no
decoración: son el mismo concepto en dos pantallas.

Las tarjetas completadas se **tachan**, igual que los objetivos cumplidos de la
portada. Sobre papel, apagar el tono se come el contraste; el tachado además se
ve sin distinguir tonos.

## 4. El resto, aplicando lo ya decidido

- **`TaskCard`**: superficie de papel con trazo de 3px y sombra dura. Los
  botones ← → ✕ son las teclas del sistema con su hundido, y el de borrar va en
  peach, igual que en la fila de hábito.
- **`FlowPanel`**: su `▲/▼` iba en verde y rojo. Pasa a flecha y grosor, la
  misma solución que en `TrendCard`. Los números en VT323.
- **`TasksBoard`**: los rótulos de columna en VT323 a 16px, y el hueco vacío con
  trazo discontinuo.
- **`NewTaskForm`**: la superficie de `Card` a mano, como `NewHabitForm`, porque
  es un `<form>` y `Card` es un `<div>`.
- **`src/app/tareas/page.tsx`**: pierde su `.m-root` y pone fondo de papel.
- **`TasksHeader` no se toca**: es composición de `PageHeader` y `Button`.

## 5. Alcance de este paso

| Archivo | Líneas |
|---|---:|
| `src/modules/habitos/components/tasks/TaskCard.tsx` | 119 |
| `src/modules/habitos/components/tasks/FlowPanel.tsx` | 85 |
| `src/modules/habitos/components/tasks/NewTaskForm.tsx` | 61 |
| `src/modules/habitos/components/tasks/TasksBoard.tsx` | 55 |
| `src/app/tareas/page.tsx` | 48 |

**Fuera:** jardín, proyectos y música.

## 6. Qué no cambia

**Ninguna lógica, ningún dato, ninguna ruta.**

**Los 428 tests siguen en verde sin modificar ninguno.**

**El tablero sigue comunicando lo mismo:** las tres columnas, cuántas tareas hay
en cada una, el título y la descripción de cada tarea, si está hecha, y hacia
dónde se puede mover. Los `aria-label` de los tres botones no se tocan.

**Los botones de mover siguen deshabilitándose en los extremos**, que es lo que
impide sacar una tarea del flujo por accidente.

**`FlowPanel` sigue siendo un componente de cliente.** Le pasa `renderTooltip` a
`BarChart`, y una función no cruza la frontera servidor → cliente.

## 7. Riesgos

**Las barras se ven aquí por primera vez.** La decisión —relleno de sky con
contorno de tinta, e inversión a tinta maciza bajo el ratón— se tomó a ciegas en
el paso anterior. Si algo no funciona, este es el momento de verlo, y corregirlo
afecta también a proyectos.

**Tres tarjetas por columna con trazo de 3px y sombra dura es mucho peso.** El
tablero es la pantalla con más elementos por metro cuadrado del proyecto. Si se
satura, lo que cede es la sombra de las tarjetas, no el trazo.

## 8. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Los 428 tests pasan **sin que se haya modificado ninguno**
3. `/tareas` completa en el estilo nuevo, sin `.m-root`
4. Ningún texto por debajo de 3:1 en la pantalla
5. Ningún pastel usado como color de texto
6. Press Start 2P nunca bajo 14px, VT323 nunca bajo 16px
7. El tablero conserva sus tres columnas, sus contadores y sus tres acciones
8. El resto de secciones sigue funcionando

## 9. Fuera de alcance

- Jardín, proyectos y música
- Cualquier cambio de lógica, datos o rutas
- Arrastrar y soltar tarjetas entre columnas
- Modo claro/oscuro
