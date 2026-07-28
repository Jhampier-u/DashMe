# Hábitos: lenguaje moderno y diagnóstico

Fecha: 2026-07-27
Estado: aprobado, pendiente de plan de implementación
Fase: 2c de la migración a tracker moderno

## Contexto

Quedan dos pantallas en pixel: Hábitos y Jardín. Esta migra Hábitos, la más
grande —1.280 líneas en nueve archivos— y le añade el ranking diagnóstico que la
fase 1 aplazó explícitamente «a su pantalla».

La fase 3 seguirá siendo el Jardín y la retirada de tokens y tipografías pixel.

## Decisiones tomadas

- **Las plantas y el avatar se conservan, rediseñados.** Cada hábito mantiene su
  planta creciendo con la racha, y el resumen del día mantiene el avatar con su
  humor. Es la misma decisión que se tomó con el cartón de celebración: la
  estructura se moderniza, la personalidad se queda.
- **El mapa de calor de 12 semanas se retira.** Con la curva de cumplimiento en
  Inicio, no aporta lo suficiente para ocupar sitio.
- **Entran tres diagnósticos:** qué hábito falla, qué día se cae, y cuál lleva
  más tiempo sin tocarse.

## Contenido de la pantalla

De arriba abajo:

1. **Cabecera** con el botón de nuevo hábito. El formulario se despliega debajo
   a todo el ancho, como en Tareas y Proyectos.
2. **Aviso de día crítico**, si algún hábito viene de fallar su día programado
   anterior. Color de estado con icono y texto, nunca color solo.
3. **Resumen del día**: avatar según el porcentaje cumplido, cifra de
   cumplidos sobre programados, y nivel y escudos como cifras discretas.
4. **Objetivos del día**, reutilizando el mismo componente que Inicio.
5. **Lista de hábitos**: planta, nombre, racha, estado y acciones (marcar, modo
   mínimo, ancla, desplegar detalle, borrar). El detalle desplegado mantiene las
   estadísticas y el calendario mensual con su relleno hacia atrás.
6. **Diagnóstico**, los tres bloques.

## Los tres diagnósticos

- **Qué hábito me está fallando.** Ranking por cumplimiento de los últimos 28
  días, del peor al mejor. Cada hábito se mide sobre **los días que le tocaban a
  él**, no sobre 28: un hábito de lunes y viernes con 7 de 8 está al 88%, no al
  25%.
- **Qué día se me cae.** Cumplimiento medio de cada día de la semana, con el peor
  destacado. Inicio ya muestra el mejor; este es el reverso, y es el que sirve
  para actuar.
- **Cuál llevo más tiempo sin tocar.** Días desde el último cumplimiento de cada
  hábito, con el más abandonado destacado. **No es la racha**: un hábito de lunes
  y viernes puede tener la racha viva y llevar cinco días sin tocarse.

Un hábito que no se ha cumplido nunca se cuenta desde su creación, y el texto lo
dice —«sin cumplir desde que lo creaste»— en vez de fingir una cifra.

## Arquitectura

Casi todo el cálculo ya existe y se reutiliza:

- El **ranking por hábito** sale de llamar a `complianceSeries` con un solo
  hábito y promediar con `averageRate` — las mismas funciones que usa Inicio para
  el agregado. No se escribe aritmética nueva.
- Los **días sin tocar** salen de `daysSince`, escrito en la fase de Proyectos.

Solo hace falta una función pura nueva:

| Pieza | Responsabilidad | Estado |
|---|---|---|
| `lib/metrics.ts` → `weekdayRates` | Cumplimiento medio de los siete días de la semana | Nuevo |
| `lib/metrics.ts` → `bestWeekday` | Pasa a derivarse de `weekdayRates` | Refactor |
| `lib/habits.ts` | Añade la consulta del diagnóstico | Existe |
| `components/habits/*` | La pantalla, siguiendo lo hecho en `tasks/` y `projects/` | Nuevo |

`bestWeekday` se refactoriza a propósito: hoy recorre los días por su cuenta, y
si se dejara así, el mejor día de Inicio y el peor día de Hábitos saldrían de dos
recorridos distintos que podrían discrepar. Derivando ambos de `weekdayRates`,
eso no puede pasar.

Se retiran `components/StatsPanel.tsx` (el mapa de calor) y
`components/DailyQuestsPanel.tsx` (el panel de misiones pixel, sustituido por el
`QuestList` que ya usa Inicio). Con ellos y los demás componentes de esta
pantalla migrados, `PixelWindow`, `PixelCard`, `PixelButton`, `PageShell` y
`SectionHeader` se quedan sin más consumidores que el Jardín, y se retiran en la
fase 3.

## Manejo de errores

- **Sin hábitos:** estado vacío con llamada a crear el primero. Ni lista, ni
  diagnóstico, ni resumen del día.
- **Un solo hábito:** el ranking se muestra igual; un ranking de uno sigue
  diciendo su porcentaje, que es información.
- **Hábito recién creado:** entra en el ranking contando solo desde que existe,
  no desde hace 28 días.
- **Ningún día con datos:** el bloque de días de la semana dice que aún no hay
  suficiente historial, en vez de pintar siete ceros.

## Pruebas

Vitest sobre `weekdayRates`, siguiendo el patrón de los 94 tests existentes:

- Devuelve siete posiciones, indexadas de domingo a sábado.
- Promedia las repeticiones del mismo día de la semana.
- Un día de la semana sin datos vale `null`, no cero.
- `bestWeekday` sigue devolviendo lo mismo que antes del refactor, y el peor día
  sale de la misma función.

Verificación en navegador antes de dar la fase por terminada: marcar y desmarcar,
modo mínimo, ancla, calendario con relleno hacia atrás, borrado con diálogo, y
los tres diagnósticos con datos reales.

## Fuera de alcance

- El Jardín y la retirada de tokens y tipografías pixel.
- Modo claro.
- Cambiar la mecánica de hábitos: escudos, misiones, XP y calendario funcionan
  como están.
