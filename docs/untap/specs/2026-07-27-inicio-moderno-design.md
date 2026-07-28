# Inicio moderno: métricas de cumplimiento y sistema de gráficas

Fecha: 2026-07-27
Estado: aprobado, pendiente de plan de implementación

## Contexto

Untap nació como gestor de hábitos en pixel art. El usuario ha decidido
convertirlo en un tracker moderno con gamificación discreta: se retira el
lenguaje pixel de toda la interfaz.

El cambio completo son tres proyectos encadenados:

1. **Este spec** — fundación visual, capa de métricas y pantalla de Inicio.
2. Migración de Hábitos, Tareas y Proyectos al lenguaje nuevo.
3. Decidir en qué se convierte el Jardín y retirar tipografía y tokens pixel.

Se ataca por rebanada vertical: una pantalla terminada de punta a punta que
sirva de patrón para las demás.

## Objetivo

Inicio debe contestar dos preguntas de un vistazo:

1. **¿Cómo voy hoy?** — estado del día y qué falta, accionable sin navegar.
2. **¿Voy a mejor o a peor?** — tendencia de cumplimiento con comparación
   contra el periodo anterior.

Explícitamente fuera: ranking diagnóstico de hábitos y métricas de tareas y
proyectos. Irán en las pantallas correspondientes.

## Definición de las métricas

Métrica base: **cumplimiento diario = cumplidos ÷ programados ese día**.

El denominador varía por día porque cada hábito tiene su calendario. Casos
límite, ya decididos:

| Caso | Regla | Motivo |
|---|---|---|
| Hábito inexistente ese día | Fuera del denominador antes de `min(createdAt, primer registro)` | Un hábito nuevo no debe ensuciar retroactivamente el historial |
| Día sin nada programado | Excluido del promedio; no es un 0% | Un día de descanso no es un fracaso |
| Modo mínimo (`partial`) | Cuenta **0,5** | Coherente con el XP; contarlo como 1 infla, como 0 castiga el mecanismo anti-rendición |
| Día cubierto por escudo (`shielded`) | **No** cuenta como cumplido; se marca aparte | El escudo protege la racha, no debe falsear la tendencia |

**Periodo de comparación: 28 días contra los 28 anteriores.** Cuatro semanas
exactas, así ambos periodos tienen la misma composición de días de la semana y
la comparación no se distorsiona por tener cinco sábados.

**Media móvil de 7 días** para la línea de tendencia. El cumplimiento diario
crudo salta demasiado para leer una tendencia; se pintan ambos (puntos tenues
para el dato crudo, línea para la señal) en vez de ocultar el ruido.

## Contenido de la pantalla

### Bloque «Hoy»

Número grande `cumplidos / programados` con anillo de progreso. No es una
gráfica: es un titular, y la forma correcta de un titular es una cifra.

Debajo, los hábitos pendientes como **chips clicables**: llaman a la acción
`toggleToday` existente y refrescan la pantalla, igual que hace hoy la lista de
hábitos. Si hay día crítico (regla de los 2 días), aviso en color de estado
acompañado de icono y texto — nunca solo color.

### Bloque «Cumplimiento»

- Delta por delante: `73% ▲6 pts` y debajo `frente a 67% en los 28 días
  anteriores`. Contesta la pregunta antes de mirar la curva.
- Gráfica de línea: media móvil de 7 días sobre relleno de área tenue, más los
  puntos diarios crudos. Los días con escudo se dibujan como anillo ámbar.
- Selector de rango: 28d / 90d / 12m.
- Cruceta y tooltip al pasar el ratón en cualquier punto, con desglose del día:
  media, cumplidos sobre programados y cuántos con escudo.

### Fila de métricas secundarias

Cuatro tiles: racha activa, mejor día de la semana, nivel con XP restante y
escudos disponibles. La gamificación sigue existiendo pero deja de mandar.

El «mejor día» es el día de la semana con mayor **tasa** media de cumplimiento
en el rango, no el que más marcas acumula: `getGlobalStats` hoy cuenta
registros, y esa cifra premia a los días con más hábitos programados.

### Misiones diarias

Sobreviven **reformuladas**: lenguaje neutro y sin emojis («Completa 3
hábitos», «Completa 2 tareas»). Mantienen su recompensa de XP y la lógica de
recálculo actual. Solo cambian los textos de presentación.

## Arquitectura

### Piezas nuevas

| Pieza | Responsabilidad | Depende de |
|---|---|---|
| `lib/metrics.ts` | Funciones puras: serie de cumplimiento diario, media móvil, delta entre periodos, cumplimiento medio por día de la semana | nada |
| `lib/home.ts` | Consulta Prisma y compone el payload de Inicio | metrics, prisma |
| `components/charts/LineChart.tsx` | Línea + área + puntos + cruceta y tooltip | escalas |
| `components/charts/ProgressRing.tsx` | Anillo de progreso | nada |
| `lib/chart.ts` | Escalas y helpers de trazado, puros | nada |

Las gráficas no conocen el dominio: reciben series de números. Así sirven luego
para tareas y proyectos sin tocarlas.

### Gráficas propias, sin librería

SVG escrito a mano. Cada gráfica ronda las cien líneas. Una librería añadiría
~100 KB, obligaría a componentes cliente en todas partes y estorbaría justo en
el control fino de grosores, extremos y separaciones. El proyecto mantiene sus
siete dependencias de producción.

### Flujo de datos

Inicio pide **una vez** los últimos 365 días. Cambiar de rango recorta en
cliente, sin ida y vuelta al servidor. Dos consultas:

1. Hábitos con `schedule` y `createdAt`.
2. Registros del rango, con `partial` y `shielded`.

El resto es cálculo puro en memoria.

### Convivencia de estilos

Los tokens modernos se añaden **junto a** los pixel, que siguen en uso en las
otras cuatro pantallas. VT323 y Press Start 2P permanecen cargadas hasta que
migre la última pantalla; se retiran entonces junto a los tokens antiguos.

Se asume que durante los proyectos 2 y 3 conviven dos lenguajes visuales.

## Manejo de errores

- Sin hábitos: la pantalla muestra estado vacío con llamada a crear el primero,
  sin gráficas vacías.
- Sin historial suficiente (menos de 7 días): se pinta la línea con los días que
  haya y se omite el delta, indicando que aún no hay periodo con el que comparar.
- Días sin nada programado: huecos en la línea, no ceros.
- Fallo de consulta: lo recoge el `error.tsx` que ya existe.

## Pruebas

Vitest sobre las funciones puras de `lib/metrics.ts`, siguiendo el patrón de los
35 tests que ya existen para `day.ts` y `streak.ts`:

- Hábito creado a mitad del rango: no aparece en el denominador de días previos.
- Hábito con registros anteriores a su creación (relleno hacia atrás).
- Día sin nada programado: excluido del promedio, no cuenta como 0%.
- Modo mínimo suma 0,5.
- Día con escudo: fuera del numerador, presente en el desglose.
- Media móvil en los primeros días, cuando la ventana aún no está llena.
- Delta con periodo anterior incompleto.

Verificación en navegador de la pantalla montada antes de darla por terminada.

## Color

La paleta se pasa por el validador de contraste y daltonismo del método de
visualización contra la superficie oscura nueva, antes de dar por bueno nada.
Los colores de estado (bueno, aviso, crítico) van siempre con icono y texto.

## Fuera de alcance

- Migrar Hábitos, Tareas, Proyectos y Jardín.
- Decidir en qué se convierte el Jardín.
- Retirar tipografía y tokens pixel.
- Modo claro. Los tokens se estructuran para permitirlo, no se implementa.
- Ranking diagnóstico de hábitos y métricas de tareas y proyectos.
