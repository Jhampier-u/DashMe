# El armazón en pixel-kawaii · diseño

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para planificar
**Paso:** 2 de 7 del rediseño visual

---

## 1. Objetivo

Llevar el sistema pixel-kawaii al armazón de la aplicación —navegación, avisos y
pantallas de error— y **voltear el fondo del documento a papel**, que es el
momento en que el dashboard deja de ser oscuro.

Es el paso más pequeño de los que quedan y a la vez el más visible: el armazón
sale en todas las pantallas, así que mientras siga oscuro cualquier sección
repintada se seguirá viendo a medias.

## 2. Punto de partida

El paso anterior (`2026-07-28-diseno-pixel-design.md`) levantó el sistema y
repintó `/habitos`. Dejó dos pieles conviviendo a propósito. Lo que queda,
medido:

| Bloque | Líneas | Sub-proyecto |
|---|---:|---|
| Armazón, avisos y errores | 468 | **este** |
| Portada y gráficas | 941 | 3 |
| Tareas | 404 | 4 |
| Jardín | 524 | 5 |
| Proyectos | 847 | 6 |
| Música | 7.537 | 7 |

**Música entra en pixel como todo lo demás.** Es una decisión tomada y con
coste: hoy tiene un sistema visual completo y terminado —editorial oscuro,
Fraunces, JetBrains Mono, 760 usos de sus utilidades— que se pierde. Va la
última porque es donde más probable es que el sistema se quede corto, y
conviene llegar con cinco secciones de rodaje.

### Lo que ya está resuelto y no se rediscute

- La paleta, sus contrastes medidos y la separación bajo daltonismo, en
  `src/modules/core/ui/contraste.ts` y verificados por test.
- Los tokens y las tres fuentes, en `src/modules/core/ui/tokens.css`.
- Los seis componentes base de `core/ui/`, ya repintados.

## 3. Decisiones tomadas

| Decisión | Elección |
|---|---|
| Alcance de este paso | Armazón, toast, `error`, `not-found` y el fondo global |
| Fondo del documento | Pasa a `--color-paper` en este paso, no más adelante |
| Secciones sin repintar | Se protegen con su `.m-root`, que ya impone fondo oscuro |
| Ítem de navegación activo | Relleno macizo, no texto teñido |
| Portada y gráficas | Fuera: son el sub-proyecto 3 |

## 4. El sistema aplicado al armazón

### El fondo del documento

`globals.css` fija hoy `html, body { background: var(--m-page) }` (`#0f0f13`).
Pasa a `var(--color-paper)`, con `color: var(--color-tinta)`.

**Esto no rompe las secciones pendientes.** Cada una monta su contenido dentro
de un `<main className="m-root">`, y `.m-root` declara su propio fondo oscuro y
su propia tinta clara. Es el mismo mecanismo que protegió a las demás mientras
se repintaba hábitos, ahora usado al revés.

Lo que sí cambia de aspecto es el espacio que queda **fuera** de `.m-root`: el
armazón, que es justo lo que este paso repinta.

### La navegación

- Lateral de escritorio y barras móviles: fondo `--color-paper`, y el trazo que
  las separa del contenido a 3px en `--color-line` (hoy es 1px translúcido).
- **Ítem activo: relleno macizo en `--color-sky` con la tinta encima** (6,87:1).
  Es el mismo recurso que el sello «Hecho» de la fila de hábito. Hoy el activo se
  marca tiñendo el texto de azul y con un fondo al 13%; teñir texto está
  prohibido por la regla dura del sistema.
- Ítem inactivo: tinta plena sobre papel. La jerarquía la da el relleno y el
  grosor, no el tono — `--color-tinta-2` se queda en 4,00:1 y a 13px no llega a
  AA.
- El logotipo «Dashboard» en Press Start 2P a 14px, su suelo. Es una palabra y
  cabe; si algún día no cupiera, se acorta el texto.
- `SoundToggle` pasa a tecla del sistema: trazo de 3px, radio de control y el
  hundido al pulsar. Su `aria-pressed` no se toca.

### Los iconos de navegación

`NavIcons` no necesita cambio de color: sus seis figuras salen de un objeto de
props compartido con `stroke: "currentColor"`, así que ya heredan la tinta del
ítem que las contiene.

Lo que sí desentona es el grosor. Están a **1,6px** en un sistema cuyo trazo es
de 3px en todo lo demás, y al lado de un borde macizo se ven desvaídas. Suben a
**2,5px**: no a 3, porque a 24×24 un trazo de 3px cierra los huecos interiores
de figuras como la casa o la carpeta y deja manchas en vez de dibujos.

Es un solo valor en el objeto compartido y afecta a los seis iconos a la vez.

### El toast de logro

`AchievementToast` es lo único que se dibuja encima de cualquier pantalla, así
que va a aparecer en papel sobre secciones aún oscuras. **Se asume:** pertenece
al armazón, no a las secciones.

- Superficie de papel con trazo de 3px y sombra dura, en lugar de la sombra
  difusa de 60px actual.
- **Conserva sus cinco variantes** —subida de nivel, hito de racha, escudo
  usado, hábito ancla y objetivo cumplido— y su cola: el temporizador solo lo
  marca el toast visible.
- La animación `untap-popin` no se toca, ni su duración inyectada, ni su
  respeto a `prefers-reduced-motion`.
- Los «+N XP» van hoy en `--m-good`, un verde. Pasan a tinta: **ningún pastel
  como color de texto**. Lo que los destaca es el tamaño y el grosor.
- Los números en VT323, nunca por debajo de 16px.

### Errores

`error.tsx` y `not-found.tsx` ya usan `Card` y `buttonStyle`, repintados en el
paso anterior. Les quedan los `var(--m-*)` sueltos del texto secundario.

## 5. Alcance de este paso

**Dentro:**

| Archivo | Líneas |
|---|---:|
| `src/modules/core/shell/AppShell.tsx` | 164 |
| `src/modules/habitos/components/AchievementToast.tsx` | 127 |
| `src/modules/core/shell/NavIcons.tsx` | 70 · solo el grosor del trazo |
| `src/modules/habitos/components/SoundToggle.tsx` | 46 |
| `src/app/error.tsx` | 40 |
| `src/app/not-found.tsx` | 21 |
| `src/app/globals.css` | el volteo del fondo |

Son las 468 líneas de la tabla del punto 2.

**Fuera:** la portada, las gráficas, tareas, jardín, proyectos y música. Cada
uno con su propio ciclo.

## 6. Qué no cambia

**Ninguna lógica, ningún dato, ninguna ruta.** Esto es piel.

**Los 428 tests siguen en verde sin modificar ninguno.** Un test en rojo es la
señal de que el cambio dejó de ser visual.

**La navegación sigue diciendo lo mismo:** las seis secciones, cuál es la
activa, y el `aria-current="page"` que ya lo comunica sin depender del color.

**Los dos renderizados de navegación siguen conviviendo en el DOM** y
alternándose por clases. Detectar el ancho en JavaScript rompería la
hidratación, que es la razón por la que están así.

**El toast conserva su cola, sus tiempos y sus cinco variantes.**

## 7. Riesgos

**El contraste del ítem activo.** Es el único sitio del armazón donde hay texto
sobre pastel. Tinta sobre `sky` mide 6,87:1 y pasa AA de sobra, pero hay que
usar tinta y no bajar a `tinta-2`.

**La mezcla se vuelve más visible, no menos.** Al voltear el fondo, el armazón
claro enmarcará cinco secciones que siguen oscuras. Va a verse peor que ahora
antes de verse mejor. Es el precio de hacerlo en pasos y es temporal.

**El toast sobre fondo oscuro.** Un panel de papel sobre una sección oscura
tiene contraste de sobra, pero rompe la atmósfera de esa pantalla durante los
2,2–3,5 segundos que dura. Se acepta.

**Deriva de alcance.** La portada está a un clic de la navegación y la tentación
de «ya que estoy» es máxima. No entra.

## 8. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Los 428 tests pasan **sin que se haya modificado ninguno**
3. `html, body` en papel, y las secciones sin repintar siguen legibles gracias a
   su `.m-root`
4. La navegación completa en el estilo nuevo, en escritorio y en móvil
5. Ningún pastel usado como color de texto en el armazón
6. Press Start 2P nunca por debajo de 14px, VT323 nunca por debajo de 16px
7. El toast conserva sus cinco variantes, su cola y su animación
8. `/habitos` sigue intacta; el resto de secciones carga y funciona

## 9. Fuera de alcance

- Portada, gráficas, tareas, jardín, proyectos y música
- Cualquier cambio de lógica, datos o rutas
- Animaciones nuevas más allá de los estados que ya existen
- Modo claro/oscuro: la dirección Cuaderno se compromete con un solo mundo
