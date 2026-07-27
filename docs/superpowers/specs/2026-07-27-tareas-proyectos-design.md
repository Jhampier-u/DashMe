# Tareas y Proyectos: lenguaje moderno y métricas de flujo

Fecha: 2026-07-27
Estado: aprobado, pendiente de plan de implementación
Fase: 2b de la migración a tracker moderno

## Contexto

La petición original fue «gráficas de cumplimiento y más cosas en las diferentes
pantallas». La fase 1 entregó Inicio y aplazó explícitamente las métricas de
tareas y proyectos a sus propias pantallas. Esta fase las trae, y de paso migra
esas pantallas al lenguaje moderno.

Estado al empezar: Inicio migrado (fase 1), chrome compartido migrado (fase 2a).
Quedan en pixel Tareas, Proyectos, el detalle de proyecto, y Hábitos y Jardín,
que van en 2c y en la fase 3.

## Alcance

**Dentro:** `/tasks`, `/projects` y `/projects/[id]` — estilo y métricas nuevas.

**Fuera, por decisión explícita:**

- Arrastrar tarjetas y subtareas. Se mantienen los botones actuales, mejor
  dibujados. El arrastre tendrá su propio spec si se quiere.
- Registrar transiciones de estado. Sin esa tabla no se puede medir el tiempo
  que una tarea pasa en cada columna, y reconstruir el pasado es imposible, así
  que la métrica no se promete.
- Hábitos y Jardín.

## Un límite de los datos, dicho por delante

`Task` y `ProjectItem` guardan `createdAt`, `completedAt` y el estado actual. No
hay historial de cambios. Por tanto **se puede** medir cuánto se cierra, cuánto
tarda algo desde que nace hasta que muere, y cuánto lleva esperando lo que sigue
abierto; y **no se puede** medir cuánto tiempo pasó en «en proceso».

## Qué mide cada pantalla

### Tareas

- **Ritmo de cierre.** Tareas completadas por semana, últimas 12 semanas, con el
  delta contra las 12 anteriores.
- **Tiempo de vida.** La **mediana** de días entre crear y cerrar, sobre las
  tareas cerradas en los últimos 90 días. Mediana y no media: una sola tarea
  olvidada durante trescientos días desplaza la media y no informa de nada.
- **Lo más antiguo abierto.** Días desde la creación de la tarea sin completar
  más vieja.
- Se conservan las cuatro cifras actuales (total, por iniciar, en proceso,
  hechas) como tiles.

### Proyectos

- **Último movimiento** por proyecto: días desde la última subtarea completada.
  Es lo que delata un proyecto parado, que es la pregunta real de esa pantalla.
  Si el proyecto no ha completado nada nunca, se cuenta desde su creación y se
  dice así, en vez de fingir un dato.
- **Ritmo de avance.** Subtareas completadas por semana, con el mismo componente
  de barras que Tareas.
- Se conservan icono, nombre, descripción y barra de progreso.

### Detalle de proyecto

Estilo nuevo para el árbol y las cifras, más el «último movimiento» del proyecto.
No lleva gráfica: con el árbol delante, una barra semanal aporta poco.

## Definiciones

- **Semana:** de lunes a domingo, etiquetada por su lunes. Se agrupa por la
  fecha local de `completedAt`, con la misma noción de día que el resto de la
  aplicación (`lib/day.ts`).
- **Semanas sin datos** aparecen como barra a cero, no como hueco: en un
  recuento, cero es un dato, no una ausencia. Esto es lo contrario que en la
  gráfica de cumplimiento, donde `null` significa «no tocaba nada».
- **Delta de ritmo:** variación porcentual del total de las últimas 12 semanas
  frente al de las 12 anteriores. Se omite —no se muestra nada— cuando el
  periodo anterior suma **cero**: no existe el porcentaje de aumento sobre nada,
  y un «+∞%» o un «+100%» serían inventados. Aplica igual en Tareas y en
  Proyectos, que comparten componente y comportamiento.
- **Mediana de vida:** días enteros entre `createdAt` y `completedAt`. Con un
  número par de tareas, el promedio de las dos centrales.
- **Distancias en días:** siempre entre claves de día locales, nunca restando
  instantes. Una tarea creada anoche y cerrada esta mañana tiene un día de vida,
  no cero: lo que se cuenta son días de calendario, como en el resto de la
  aplicación.

## Arquitectura

| Pieza | Responsabilidad | Estado |
|---|---|---|
| `lib/flow.ts` | Puro: agrupar por semana, mediana de duración, antigüedad, delta | Nuevo |
| `lib/tasks.ts` | Añade la consulta de métricas de tareas | Existe |
| `lib/projects.ts` | Añade último movimiento y ritmo de avance | Existe |
| `components/charts/BarChart.tsx` | Barras genéricas: recibe números, no sabe qué cuenta | Nuevo |
| `components/ui/Field.tsx` | Campo de formulario con etiqueta | Nuevo |
| `components/ui/PageHeader.tsx` | Título y subtítulo de pantalla | Nuevo |

`BarChart` no conoce el dominio, igual que `LineChart`: las dos pantallas lo usan
sin que él sepa si cuenta tareas o subtareas. Es el retorno de haber separado
gráfico y dominio en la fase 1.

Las consultas se añaden a `lib/tasks.ts` y `lib/projects.ts`, que ya sirven a esas
pantallas. No se inventan módulos nuevos donde ya hay un sitio natural.

`Field` y `PageHeader` son las dos primitivas que 2a dejó fuera por no tener
consumidor. Aquí lo tienen: los tres formularios de creación y las dos cabeceras.

## Manejo de errores

- **Sin tareas o sin proyectos:** estado vacío con llamada a crear el primero. No
  se pintan gráficas vacías.
- **Menos de 12 semanas de historial:** la gráfica muestra las semanas que haya y
  se omite el delta, diciendo que aún no hay periodo con el que comparar.
- **Ninguna tarea cerrada todavía:** el tiempo de vida no se muestra en vez de
  enseñar un cero engañoso.
- **Proyecto sin nada completado:** el último movimiento se cuenta desde la
  creación y el texto lo dice.

## Pruebas

Vitest sobre `lib/flow.ts`, siguiendo el patrón de `day.ts`, `streak.ts` y
`metrics.ts`:

- Agrupar por semana: una fecha cae en la semana de su lunes; el domingo cae en
  la semana que empezó el lunes anterior, no en la siguiente.
- Semanas sin datos salen a cero y en su posición.
- Mediana con número impar y con número par de valores.
- Mediana sobre lista vacía: `null`, no cero.
- Antigüedad de lo más viejo abierto, y `null` si no hay nada abierto.
- Delta cuando el periodo anterior está vacío: se omite.

Verificación en navegador de las tres rutas antes de dar la fase por terminada.

## Fuera de alcance

- Arrastrar y soltar.
- Tabla de transiciones de estado.
- Hábitos, Jardín y la retirada de tokens y tipografías pixel.
- Modo claro.
