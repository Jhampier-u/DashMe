# Hábitos con cantidad · diseño

**Fecha:** 2026-07-29
**Estado:** aprobado, listo para planificar
**Paso:** 5 de 7 de la ampliación de hábitos y tareas

---

## 1. Objetivo

Que un hábito pueda tener un **objetivo numérico** —«beber 8 vasos»— y que el día
se apunte con una cantidad en vez de con un sí.

## 2. Punto de partida

Hoy un hábito se marca **hecho** o **en modo mínimo**. El modo mínimo es un texto
libre —«al menos 5 minutos»— con su botón; da la mitad del XP y **conserva la
racha**. En la base es la columna booleana `partial` de `habit_logs`.

No hay ninguna cantidad en ninguna parte.

## 3. Las tres decisiones, y la contradicción que dejaban

Aprobado:

| | |
|---|---|
| Cantidad | **un solo objetivo**, sin mínimo numérico |
| XP | por umbrales: objetivo → completo, por debajo → mitad |
| Racha | **solo el objetivo** la mantiene |

Eso deja dos reglas distintas para la misma fila: un hábito de cantidad a 7 de 8
pierde la racha, y uno de modo mínimo marcado en mínimo no. **Conviven a
propósito**, y la interfaz tiene que decirlo: en un hábito de cantidad, apuntar
por debajo del objetivo avisa de que no protege la racha.

### Por qué ser estricto no es cruel

**El escudo ya existe.** `MAX_SHIELDS` permite salvar un día malo sin perder la
racha, y es el mecanismo pensado para eso. Que el mínimo también la protegiera
eran dos caminos para lo mismo. La cantidad estricta empuja hacia el escudo, que
es el que estaba diseñado para este caso.

## 4. Lo que decide el tamaño del bloque

`computeStreak` recibe un **conjunto de días hechos** y no sabe nada de `partial`.
No hay que tocarla, ni sus tests: el cambio está en quién construye ese conjunto.

Y ahí está el riesgo real: **cinco sitios lo construyen por su cuenta** —
`habits.ts`, `home.ts`, `stats.ts` y dos veces `mutations.ts`—. Si a uno se le
olvida el filtro, la misma racha sale distinta según la pantalla, y en silencio.

**Por eso nace una sola función pura**, `diasQueCuentan(logs, objetivo)`, y los
cinco pasan por ella. Es la pieza central del diseño: no por elegancia, sino
porque cinco copias de una regla son cinco oportunidades de que una se quede
atrás.

## 5. El esquema

```sql
ALTER TABLE habits     ADD COLUMN target_count INTEGER;  -- null = no se cuenta
ALTER TABLE habit_logs ADD COLUMN count        INTEGER;  -- null = no se contó
```

**Esto sí necesita `migrar.ts`**, al contrario que el bloque de adjuntos: son
columnas nuevas en tablas que ya existen, y para eso `CREATE TABLE IF NOT EXISTS`
no sirve. Las dos van sin restricción y anulables, así que `ADD COLUMN` las
admite.

`target_count` nulo significa «este hábito no se cuenta»: sigue funcionando
exactamente como hoy, con su modo mínimo de texto si lo tenía. **Ningún hábito
existente cambia de comportamiento.**

## 6. Las reglas, en una tabla

Para un hábito con `target_count = 8`:

| Lo apuntado | `partial` | XP | Racha |
|---|---|---|---|
| 8 o más | `false` | completo | la mantiene |
| 1 a 7 | `true` | mitad | **no** la mantiene |
| nada | sin registro | — | se rompe |

Para un hábito sin `target_count`, **nada cambia**: hecho da completo y mantiene,
modo mínimo da mitad y mantiene.

`partial` se sigue guardando y se **deriva** de la cantidad en vez de venir de un
botón. Eso es lo que permite que las misiones diarias y el «día completo» sigan
funcionando sin tocarlas: ya leen `partial`.

## 7. Qué se ve

En la fila del hábito, un hábito de cantidad muestra `3 / 8` y dos botones para
sumar y restar. El botón de completar sigue estando: lleva la cantidad al
objetivo de un golpe.

Al apuntar por debajo del objetivo, la fila dice que **la racha no está a
salvo**. Es la mitad de la decisión del punto 3: si la interfaz no lo dice, la
diferencia con el modo mínimo parece un fallo.

## 8. Alcance

| Archivo | Qué |
|---|---|
| `core/db/migrar.ts` | Las dos columnas nuevas |
| `core/db/schema-sql.ts` | Lo mismo para bases nuevas |
| `habitos/schema.ts` | Lo mismo en Drizzle |
| `habitos/lib/cantidad.ts` | **Nuevo.** `diasQueCuentan` y los umbrales, puro |
| `habitos/lib/cantidad.test.ts` | **Nuevo.** |
| `habitos/lib/habits.ts`, `home.ts`, `stats.ts`, `mutations.ts` | Pasan por `diasQueCuentan` |
| `habitos/lib/mutations.ts` | `setHabitCount`, y `createHabit` acepta objetivo |
| `habitos/components/habits/HabitRow.tsx` | El contador y el aviso |
| `habitos/components/habits/NewHabitForm.tsx` | El campo de objetivo |

**Fuera:** pausas, notas, racha global y el cruce con música.

## 9. Qué no cambia

- `computeStreak`, `computeBestStreak` y sus tests.
- El escudo, el ancla, los hitos y el jardín.
- Las misiones diarias, que leen `partial` y lo seguirán leyendo.
- Los hábitos que ya tienes, mientras no les pongas un objetivo.

## 10. Riesgos

**Cinco sitios construyen el conjunto de días.** Es el fallo probable de este
bloque: uno sin filtrar y la racha sale distinta en la portada y en el detalle.
La función compartida existe para eso, y hay que comprobar que los cinco la usan.

**La racha de un hábito puede bajar al ponerle un objetivo.** Un hábito que
marcabas «a medias» a menudo tenía racha; al volverse de cantidad, esos días
dejan de contar. No se pierde ningún registro, pero **el número que ves puede
caer**, y hay que avisarlo al guardar el objetivo.

**`count` nulo en registros viejos.** Todo lo registrado antes tiene `count`
nulo. Para un hábito sin objetivo da igual; si le pones uno, sus días antiguos
cuentan según su `partial`, no según una cantidad que nunca se apuntó. Es la
única interpretación posible y se documenta.

## 11. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. La migración añade las dos columnas y es idempotente
3. Un hábito sin objetivo se comporta **exactamente** como hoy
4. Con objetivo 8: apuntar 8 da XP completo y mantiene la racha
5. Con objetivo 8: apuntar 5 da la mitad del XP y **no** mantiene la racha
6. Los cinco sitios que calculan días usan la misma función
7. `streak.test.ts` sigue pasando sin tocarse
8. La fila avisa de que apuntar por debajo no protege la racha

## 12. Fuera de alcance

- Pausas, notas y racha global (bloque 6)
- El cruce con música (bloque 7)
- Unidades («vasos», «minutos») más allá de un rótulo
- Histórico de cantidades en la gráfica
