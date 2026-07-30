# Pausas de hábito · diseño

**Fecha:** 2026-07-29
**Estado:** aprobado, listo para planificar
**Paso:** el que salió del bloque 6

---

## 1. Objetivo

Poder decir «del 1 al 15 de agosto estuve de vacaciones» y que esos días **no
cuenten para nada**: ni rompan la racha, ni bajen el porcentaje de cumplimiento.

## 2. Por qué esto va aparte

Los dos bloques anteriores protegieron `streak.ts` a propósito. **Este lo cambia,
y es el motivo de haberlo separado.**

Hoy `isScheduledOn(schedule, día)` mira el día de la semana y nada más. Una pausa
exige que **fechas concretas** dejen de estar programadas, y de ese predicado
dependen 14 llamadas repartidas en 8 archivos, más 33 en los tests de rachas.

## 3. La idea que hace mecánico el resto

Una pausa **no es un estado nuevo**. Es otra razón para que un día no esté
programado.

Eso importa porque *todos* los consumidores ya saben tratar un día no programado:
lo saltan, no lo cuentan y no lo consideran un fallo. Si la pausa entra por esa
misma puerta, no hay que enseñarles nada nuevo.

Así que el calendario deja de ser una cadena y pasa a ser un dato con dos partes:

```ts
type Rango = { desde: Date; hasta: Date };   // ambos inclusive
type Calendario = { schedule: string; pausas: Rango[] };

function estaProgramado(cal: Calendario, dia: Date): boolean {
  return isScheduledOn(cal.schedule, dia) && !enPausa(cal.pausas, dia);
}
```

Las seis funciones de `streak.ts` pasan a recibir `Calendario` en vez de
`string`. **Es el cambio grande y es mecánico**: donde había un `schedule`, ahora
va un objeto que lo contiene.

### Es un dato, no una función

Se podría haber pasado un predicado `(dia) => boolean` y `streak.ts` no habría
sabido nada de calendarios. Se ha descartado: `HabitSpec` viaja por `metrics.ts`
hacia las gráficas, y un objeto con una función dentro deja de ser inspeccionable
y de poder pasar por una frontera de servidor a cliente. Un `Calendario` es datos
puros de principio a fin.

## 4. La tabla

```sql
CREATE TABLE habit_pauses (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  from_day   INTEGER NOT NULL,
  to_day     INTEGER NOT NULL,
  reason     TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX habit_pauses_habit_idx ON habit_pauses(habit_id);
```

Tabla nueva, así que **no hace falta `migrar.ts`**.

**Los rangos pueden solaparse y no se impide.** Solapar es inofensivo —el
predicado pregunta «¿está este día dentro de *alguna* pausa?»— y prohibirlo
obligaría a validar contra todas las demás en cada guardado, para evitar un
problema que no existe.

`from_day` y `to_day` son claves de día normalizadas, como todo lo demás del
módulo. Un rango al revés —`hasta` antes de `desde`— se **corrige al guardar**
intercambiándolos, en vez de rechazarse: es un error de dedo, no una intención.

## 5. Retroactivo, y lo que eso implica

Se puede pausar el pasado, porque nadie se acuerda de pausar **antes** de ponerse
enfermo. Consecuencia que hay que decir en voz alta:

> **Añadir una pausa puede hacer que tu racha suba de golpe.** Si fallaste tres
> días y luego los marcas como pausa, la racha se recalcula y vuelve a unir lo de
> antes con lo de después.

Eso es lo que se ha pedido, y es correcto. Pero verlo sin avisar parece un fallo,
así que la pantalla lo dice al guardar.

## 6. Un registro dentro de una pausa no se borra

Si marcaste un hábito un día que luego declaras en pausa, **el registro se
queda**. Solo deja de contar para la racha y para el porcentaje.

Es la única opción que no pierde datos, y deshacer la pausa devuelve las cosas a
su sitio exactamente. Un día pausado con registro se pinta distinto de un día
pausado sin él.

## 7. Qué se ve

En el detalle del hábito, una lista de pausas con sus dos fechas y un motivo
opcional, más un botón para añadir y una ✕ para quitar.

En el calendario del mes, los días en pausa se ven **apagados**, como los días no
programados, porque es exactamente lo que son.

## 8. Alcance

| Archivo | Qué |
|---|---|
| `habitos/lib/calendario.ts` | **Nuevo.** `Calendario`, `Rango`, `estaProgramado`, `enPausa` |
| `habitos/lib/calendario.test.ts` | **Nuevo.** |
| `habitos/lib/streak.ts` | Las seis funciones reciben `Calendario` |
| `habitos/lib/streak.test.ts` | Mecánico: envolver el `schedule` |
| `habitos/lib/metrics.ts` | `HabitSpec.schedule` pasa a `HabitSpec.calendario` |
| `habitos/lib/pausas.ts` | **Nuevo.** Leer, guardar y borrar pausas |
| `habitos/lib/pausas.test.ts` | **Nuevo.** |
| `core/db/schema-sql.ts`, `habitos/schema.ts` | La tabla |
| `habitos/lib/habits.ts`, `home.ts`, `stats.ts`, `quests.ts`, `mutations.ts`, `racha-global.ts` | Componen el `Calendario` |
| `habitos/components/habits/HabitDetail.tsx` | La lista de pausas |
| `habitos/components/habits/MonthCalendar.tsx` | Los días apagados |

## 9. Qué no cambia

- El XP, los escudos, el ancla, los hitos y el jardín.
- Ninguna columna de las tablas que ya existen.
- La lógica de `computeStreak`: sigue haciendo lo mismo, solo pregunta de otra
  forma si un día tocaba.

## 10. Riesgos

**Es el cambio más extendido de toda la serie.** 14 llamadas y 8 archivos. El
fallo probable es dejarse una sin convertir: compilaría si el tipo coincidiera por
casualidad, así que la conversión tiene que dejar el tipo viejo **imposible** —
quitar la sobrecarga de `string` y que TypeScript señale cada sitio.

**Los tests de rachas cambian, 33 llamadas.** Es mecánico y no debe cambiar ni
una expectativa. Si una expectativa cambia, es un fallo.

**Una pausa que cubre hoy deja el hábito fuera del día.** No aparece como
pendiente ni cuenta para las misiones. Es lo correcto, pero si te pausas sin
querer parecerá que el hábito desapareció: la fila tiene que decir «en pausa».

**La racha puede subir al añadir una pausa retroactiva.** Punto 5.

## 11. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Un hábito sin pausas se comporta **exactamente** como hoy
3. Un día en pausa no rompe la racha
4. Un día en pausa no baja el porcentaje de cumplimiento
5. Una pausa retroactiva vuelve a unir la racha
6. Un registro dentro de una pausa **no se borra**
7. Los rangos al revés se corrigen al guardar
8. Ninguna expectativa de `streak.test.ts` cambia de valor
9. La fila dice «en pausa» cuando hoy lo está

## 11.b Un riesgo que el spec no vio

**El detalle del hábito no se refresca solo.** Es un componente de cliente que se
trae sus datos una vez y solo los recarga cuando cambia el XP; una pausa no toca
el XP, así que la lista se quedaba obsoleta al añadir o quitar. Resuelto en la
ejecución: las acciones devuelven la lista fresca y el panel la guarda en su
estado.

Merece estar escrito porque **`refresh()` no basta** en esta pantalla, y el mismo
error se repetirá con cualquier cosa que se añada al detalle y no mueva el XP.

## 12. Fuera de alcance

- Pausas de tareas o de proyectos
- Pausar todos los hábitos a la vez
- Pausas que se repiten (todos los agostos)
- El cruce con música
