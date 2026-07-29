# Proyectos en pixel-kawaii · diseño

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para planificar
**Paso:** 6 de 7 del rediseño visual

---

## 1. Objetivo

Repintar la sección de proyectos: la rejilla de tarjetas, el detalle con su
árbol de subtareas anidadas y el panel de ritmo. Es el último paso antes de
música.

## 2. Punto de partida

Todo lo delicado del rediseño ya está resuelto: las gráficas, la ilustración del
jardín, el contraste sobre fondos variables y el vocabulario de estado. Esta
sección no plantea ningún problema nuevo — plantea uno **repetido**.

## 3. La decisión: el estado en el árbol

`ProjectTreeItem` marca el estado de cada subtarea con tres glifos —`○` `◐`
`●`— **teñidos** de gris, ámbar y verde.

Lo relevante es que **la forma ya lo dice todo**: círculo vacío, medio y lleno.
El color es redundante, así que quitarlo no cuesta información.

El glifo pasa a tinta y el estado lo marca el relleno del botón, con el mismo
vocabulario que ya usan las columnas de tareas:

| Estado | Relleno |
|---|---|
| Por hacer | papel |
| En proceso | `sky` |
| Hecha | **tinta invertida** |

Con esto son tres pantallas —hábitos, tareas y proyectos— diciendo «hecho» de la
misma forma. Y la redundancia entre forma y relleno significa que no se pierde
nada si no se distinguen los tonos.

## 4. La consolidación: la barra de progreso

La misma barra está escrita **cuatro veces**, con la misma estructura de carril
y relleno:

| Dónde | Estado |
|---|---|
| `DiagnosisPanel` | ya repintada |
| `QuestList` | ya repintada |
| `ProjectCard` | la repinta este paso |
| `app/proyectos/[id]/page.tsx` | la repinta este paso |

Se extrae a `src/modules/core/ui/ProgressBar.tsx` y **se actualizan las cuatro**.
Actualizar solo las dos de este paso dejaría tres implementaciones en vez de dos,
que es peor que no tocar nada.

Las dos ya repintadas no cambian de aspecto: el componente nace con sus valores.
Es una consolidación, no un rediseño.

## 5. El resto, aplicando lo ya decidido

- **`ProjectTreeItem`**: los cuatro botones a teclas del sistema, borrar en
  peach, y el contador `hechas/total` en VT323.
- **El campo de renombrar y el de añadir subtarea** están escritos a mano en dos
  archivos con el mismo estilo. Se comparte una sola cadena de clases con trazo
  de 3px y anillo de foco.
- **`ProjectCard`**: superficie de papel. Su aviso de proyecto parado iba en
  ámbar; pasa a tinta con el `▲` que ya llevaba y más grosor.
- **`AdvancePanel`**: rótulo a la ranura de `Card` y el `▲/▼` a flecha y grosor,
  como en `TrendCard` y `FlowPanel`.
- **Las dos páginas**: fondo de papel y fuera `.m-root`. El `h1` del detalle a
  Press Start 2P a 14px — los nombres de proyecto los escribe el usuario, así
  que parte de línea en vez de desbordar.
- **`ProjectsHeader` no se toca**: es `PageHeader` y `Button`.

## 6. Alcance de este paso

| Archivo | Líneas |
|---|---:|
| `components/projects/ProjectTreeItem.tsx` | 282 |
| `components/projects/ProjectCard.tsx` | 132 |
| `components/projects/ProjectTree.tsx` | 92 |
| `components/projects/NewProjectForm.tsx` | 89 |
| `app/proyectos/[id]/page.tsx` | 93 |
| `components/projects/AdvancePanel.tsx` | 68 |
| `app/proyectos/page.tsx` | 56 |
| `core/ui/ProgressBar.tsx` | nuevo |
| `components/habits/DiagnosisPanel.tsx` · `components/home/QuestList.tsx` | solo pasan a usar el componente |

**Fuera:** música.

## 7. Qué no cambia

**Ninguna lógica, ningún dato, ninguna ruta.**

**Los 428 tests siguen en verde sin modificar ninguno.**

**El árbol sigue comunicando lo mismo:** la jerarquía por sangrado, el estado de
cada nodo, cuántas hijas están hechas, y las cuatro acciones —plegar, cambiar
estado, añadir dentro y borrar. Sus `aria-label` y `aria-expanded` no se tocan.

**El ciclo de estado sigue siendo el mismo** y sigue dando la vuelta:
por hacer → en proceso → hecha → por hacer.

**El borrador del título sigue el valor del servidor mientras no se esté
editando**, que es lo que evita que se pise lo que escribes.

**Las dos barras ya repintadas conservan su aspecto exacto.**

## 8. Riesgos

**El árbol acumula trazos.** Cada nodo lleva cuatro botones con borde de 3px, y
los nodos se anidan. A partir de tres niveles puede saturar. Si pasa, lo que
cede es el borde de los botones de icono, no el sangrado.

**La consolidación toca dos pantallas ya verificadas.** `DiagnosisPanel` y
`QuestList` están fuera del alcance de este paso y solo cambian de
implementación. Hay que comprobar que no cambian de aspecto.

## 9. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Los 428 tests pasan **sin que se haya modificado ninguno**
3. Las dos pantallas de proyectos sin `.m-root` y con fondo de papel
4. Ningún texto por debajo de 3:1 en ninguna de las dos
5. Ningún pastel como color de texto; suelos de fuente respetados
6. El árbol conserva jerarquía, estados, contadores y sus cuatro acciones
7. Una sola implementación de la barra de progreso, usada en cuatro sitios
8. `/habitos` y la portada siguen viéndose igual que antes de la consolidación

## 10. Fuera de alcance

- Música
- Cualquier cambio de lógica, datos o rutas
- Arrastrar nodos para reordenar el árbol
- Modo claro/oscuro
