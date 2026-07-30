# Notas del día y racha global · diseño

**Fecha:** 2026-07-29
**Estado:** aprobado, listo para planificar
**Paso:** 6 de 7 de la ampliación de hábitos y tareas

---

## 1. Objetivo

Dos cosas pequeñas e independientes:

- **Una nota por hábito y día**, para que el panel deje de ser solo marcas.
- **Una racha global**: cuántos días seguidos has cumplido *todo* lo que tocaba.

## 2. Por qué las pausas no están aquí

Este bloque iba a llevar tres funciones. Las pausas se han sacado a su propio
bloque, y no por tamaño de código sino por dónde tocan: `isScheduledOn` solo mira
el día de la semana, y pausar exige que **fechas concretas** dejen de estar
programadas. Eso cambia el calendario que sostiene rachas, cumplimiento, días
críticos y misiones — y obligaría a tocar `streak.ts`, que el bloque anterior
protegió a propósito.

Mezclarlo con dos funciones triviales habría hecho imposible saber qué rompió qué.

## 3. Las notas necesitan su propia tabla, y esto es lo importante

Lo obvio sería una columna `note` en `habit_logs`. **Está mal**, y por una razón
concreta:

> Una nota solo existiría si existe el registro del día. Y escribir una nota en un
> día que **no** cumpliste obligaría a crear ese registro — es decir, **a marcar el
> hábito como hecho para poder decir que no lo hiciste**.

Y ese es justo el día en que más quieres escribir algo: «hoy no pude, estaba
enfermo». Así que las notas van aparte:

```sql
CREATE TABLE habit_notes (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       INTEGER NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX habit_notes_habit_date_unq ON habit_notes(habit_id, date);
```

Una nota por hábito y día, garantizado por el índice único — el mismo patrón que
ya usa `habit_logs`, del que depende el cálculo de rachas.

**No hace falta `migrar.ts`**: es una tabla nueva, y para eso ya sirve el
`CREATE TABLE IF NOT EXISTS` de `SCHEMA_SQL`.

Guardar una nota vacía **borra la fila**. Así no queda basura y el estado «sin
nota» es uno solo, no dos.

## 4. La racha global

Cuenta los días seguidos en los que cumpliste **todos** los hábitos que te
tocaban. Misma definición que la misión «día completo» que ya existe, para no
inventar un segundo criterio de lo mismo:

- Solo cuentan los registros **no parciales**. Un día a medias no es un día
  completo.
- Los días **sin nada programado se saltan**, igual que hace la racha de un
  hábito. No suman y no rompen.

### Un hábito solo cuenta desde que existe

Sin esto, la racha global sería **cero para siempre** en cuanto añadieras un
hábito: los días anteriores a su creación aparecerían como días en los que no lo
cumpliste.

Ya existe la pieza que lo resuelve: `buildHabitSpecs` devuelve, por hábito, la
fecha desde la que cuenta —su creación o su registro más antiguo, lo que sea
anterior—. La racha global usa esa misma, así que **cuadra con las gráficas de
cumplimiento** en vez de llevar su propia cuenta.

### Es una función pura

`rachaGlobal(specs, hechosPorDia, hoy)` no toca la base. Es la misma decisión que
en `planCascada` y en `diasQueCuentan`, y por lo mismo: tiene casos de borde
—días sin nada programado, hábitos recién creados, días a medias— y como función
pura se prueban todos en milisegundos.

## 5. Dónde se ve

**La nota**, en el calendario del mes del detalle del hábito: el día marcado
lleva un punto si tiene nota, y al pulsarlo se escribe. Y en la fila del hábito,
un campo para la de hoy.

**La racha global**, en la portada, junto a la racha más larga que ya está.
Comparten sitio a propósito: una dice «tu mejor hábito llega a 12 días», la otra
«llevas 3 días sin fallar en nada». Son distintas y juntas se entienden.

## 6. Alcance

| Archivo | Qué |
|---|---|
| `core/db/schema-sql.ts` | `habit_notes` |
| `habitos/schema.ts` | Lo mismo en Drizzle |
| `habitos/lib/notas.ts` | **Nuevo.** Leer, guardar y borrar notas |
| `habitos/lib/notas.test.ts` | **Nuevo.** |
| `habitos/lib/racha-global.ts` | **Nuevo.** `rachaGlobal`, pura |
| `habitos/lib/racha-global.test.ts` | **Nuevo.** |
| `habitos/lib/home.ts` | Devuelve la racha global |
| `habitos/lib/stats.ts` | Devuelve las notas del mes |
| `habitos/components/home/MetricTiles.tsx` | La pinta |
| `habitos/components/habits/HabitDetail.tsx` | La nota del día |

**Fuera:** las pausas, el cruce con música.

## 7. Qué no cambia

- `streak.ts` y sus tests. Otra vez.
- El XP, los escudos, el ancla, los hitos y el jardín.
- Las misiones diarias.
- Ninguna columna de las tablas que ya existen.

## 8. Riesgos

**La racha global puede salir 0 y ser correcto.** Si hoy te falta un hábito, la
racha global es 0 aunque lleves semanas con casi todo. Es exigente por diseño —lo
elegiste así— pero la primera vez que se vea puede parecer un fallo. El rótulo
tiene que decir qué mide: «días seguidos cumpliendo todo».

**Es cara de calcular hacia atrás.** Hay que recorrer día a día y, por cada uno,
comprobar todos los hábitos vigentes. Con una ventana de 400 días y unos pocos
hábitos es trivial, pero el límite tiene que estar escrito y no ser infinito.

**Una nota puede sobrevivir a su registro.** Si desmarcas un día, su nota sigue.
Es lo correcto —la nota no es el registro— pero significa que en el calendario
puede haber un punto de nota en un día sin marca. Se documenta y se pinta
distinto.

## 9. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Se puede escribir, editar y borrar la nota de un hábito en un día
3. Se puede escribir una nota en un día **sin** marcar el hábito
4. Guardar una nota vacía borra la fila
5. La racha global cuenta solo días con **todo** lo programado hecho
6. Un día a medias no cuenta como día completo
7. Los días sin nada programado no suman ni rompen
8. Un hábito no cuenta antes de existir
9. `streak.ts` y sus tests siguen intactos

## 10. Fuera de alcance

- Pausas (su propio bloque)
- El cruce con música (bloque 7)
- Buscar dentro de las notas
- Notas en tareas
