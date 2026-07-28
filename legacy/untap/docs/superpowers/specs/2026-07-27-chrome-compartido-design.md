# Chrome compartido: armazón de navegación y primitivas de interfaz

Fecha: 2026-07-27
Estado: aprobado, pendiente de plan de implementación
Fase: 2a de la migración a tracker moderno

## Contexto

La fase 1 reconstruyó la pantalla de Inicio y dejó montada la capa de métricas
y las primitivas de gráfica. Quedan **33 archivos y unas 3.575 líneas** en
lenguaje pixel.

Migrar las tres pantallas restantes de una sola vez es demasiado para un spec,
así que la fase 2 se parte en tres:

- **2a — este spec.** Chrome compartido: armazón de navegación, primitivas de
  interfaz, modal, cartón de logro y páginas de error.
- **2b.** Tareas y Proyectos.
- **2c.** Hábitos, la pantalla más grande.

La fase 3 sigue siendo el Jardín y la retirada de tokens y tipografías pixel.

Se ataca el chrome primero por dos razones: es lo que hace que la aplicación
deje de verse partida en dos, y define los componentes base que 2b y 2c van a
consumir. Empezando por una pantalla, esos componentes saldrían improvisados
desde dentro de ella.

## Decisiones tomadas

- **La navegación pasa a lateral en escritorio y barra inferior en móvil.**
- **El cartón de logro a pantalla completa se conserva**, rediseñado con la
  tipografía y los colores nuevos.
- **Los sonidos 8-bit se quedan tal cual**, con su interruptor, que se aloja en
  la barra lateral.

## El armazón

`src/app/layout.tsx` pasa de «barra arriba más contenido» a un armazón con
navegación lateral.

- **Lateral** a partir de 1024 px: ancho fijo de 208 px, logotipo arriba, las
  cinco secciones, e interruptor de sonido abajo del todo. Queda **fija**: al
  desplazar una pantalla larga se mueve solo el contenido, no la navegación.
- **Barra inferior** por debajo de 1024 px: los cinco iconos con etiqueta
  diminuta, fija abajo, respetando el área segura de iOS
  (`env(safe-area-inset-bottom)`).
- Una sola lista `NAV_ITEMS` alimenta ambos renderizados. El cambio entre uno y
  otro lo hace **CSS**, no JavaScript: detectar el ancho en el cliente
  provocaría desajuste de hidratación.
- La sección activa se resuelve con `usePathname`, con la misma regla que hoy:
  coincidencia exacta para `/`, y prefijo para el resto.

Los iconos son cinco SVG de trazo escritos a mano (inicio, hábitos, jardín,
tareas, proyectos). Sin librería de iconos y sin emojis.

## Las primitivas

En `src/components/ui/`:

| Pieza | Sustituye a | Responsabilidad | Consumidor en 2a |
|---|---|---|---|
| `Card` | `PixelWindow`, `PixelCard` | Superficie con borde y radio, título opcional | `error.tsx`, `not-found.tsx` |
| `Button` | `PixelButton` | Variantes: primaria, secundaria, fantasma, peligro | `error.tsx`, `Modal` |
| `Modal` | el diálogo interno de `PixelConfirm` | Diálogo accesible, cierre con Escape y clic fuera | `PixelConfirm` |

**Solo se construyen las tres que tienen consumidor en esta fase.** `Field` (que
sustituirá a `.pixel-input`) y `PageHeader` (que sustituirá a `SectionHeader`) no
los usa nadie hasta que se migren los formularios y las cabeceras de pantalla, así
que los crea 2b donde primero hagan falta. Diseñar un campo de formulario sin un
formulario delante es adivinar.

`Modal` se limita a sustituir el interior de `PixelConfirm`: **el hook
`useConfirm` conserva su API**, así que Hábitos, Tareas y Proyectos no se
enteran del cambio.

`AchievementToast` mantiene el cartón a pantalla completa y su cola de avisos;
solo cambian tipografía, colores y el marco.

## El `body`

Hoy `body` lleva `-webkit-font-smoothing: none` e `image-rendering: pixelated`
de forma global. Son reglas de la estética pixel, pero afectan también a la
pantalla de Inicio ya migrada, cuyo texto se pinta sin suavizado.

Esas reglas se mueven a una clase `.pixel-page`, que **aplica `PageShell`**. Como
las cuatro pantallas sin migrar ya usan `PageShell`, es una sola edición y todas
conservan su aspecto. Inicio no usa `PageShell`, así que queda limpio sin
tocarlo.

El `body` pasa a los valores modernos: tipografía de sistema, tamaño base normal
y suavizado por defecto.

## Convivencia

En 2a se borra **solo `NavBar.tsx`**, sustituida por el armazón. `SoundToggle`
se reutiliza dentro de la lateral, restilada.

`PixelWindow`, `PixelCard`, `PixelButton`, `PageShell` y `SectionHeader`
**se conservan**: los usan las cuatro pantallas sin migrar. Se retiran en 2c y
en la fase 3, cuando dejen de tener consumidores.

`error.tsx` y `not-found.tsx` son chrome compartido y hoy usan clases pixel, así
que se migran aquí con las primitivas nuevas.

## Manejo de errores

Sin lógica nueva que pueda fallar. Los dos casos a cuidar son de presentación:

- Ruta desconocida: la sección activa no coincide con ninguna y **ninguna** se
  marca, en vez de marcarse la primera.
- Pantalla estrecha: la barra inferior se superpone al contenido si este no
  reserva espacio, así que el área de contenido lleva relleno inferior
  equivalente a la altura de la barra más el área segura.

## Pruebas

Esta fase es presentación pura: no hay lógica que testear con Vitest y no se
añaden tests que no puedan fallar. Los **74 existentes deben seguir en verde**.

La verificación es en navegador y recorre las cinco rutas, porque el armazón las
toca todas:

1. Las cinco rutas renderizan sin errores de consola ni de servidor.
2. A 1280 px se ve la lateral; a 375 px, la barra inferior.
3. La sección activa se marca correctamente en cada una de las cinco rutas, y en
   una ruta inexistente no se marca ninguna.
4. El diálogo de confirmación sigue funcionando en Hábitos, Tareas y Proyectos.
5. El cartón de logro sigue apareciendo al completar un hábito.
6. Sin desbordamiento horizontal a 375, 768 y 1280 px.
7. En móvil, el contenido no queda tapado por la barra inferior.

## Fuera de alcance

- Migrar el interior de Hábitos, Tareas, Proyectos y Jardín.
- Retirar las primitivas y tokens pixel.
- Modo claro.
- Sustituir o retirar los sonidos.
