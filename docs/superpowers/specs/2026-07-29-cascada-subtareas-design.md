# Subtareas con cascada bidireccional · diseño

**Fecha:** 2026-07-29
**Estado:** aprobado, listo para planificar
**Paso:** 3 de 7 de la ampliación de hábitos y tareas
**Depende de:** `2026-07-28-tareas-categorias-prioridades-design.md`, ya implementado

---

## 1. Objetivo

Que completar una tarea y completar sus partes sean **la misma cosa**, se haga
en el orden que se haga: marcar el padre cierra sus subtareas, y cerrar la
última subtarea cierra el padre.

## 2. Punto de partida

La anidación **ya existe**. Al unificar las tablas, `tasks` heredó el árbol de
`project_items`, y `/proyectos` ya lo despliega, renombra, borra y amplía.

Lo que no existe es la cascada: hoy marcar un padre como hecho no toca a sus
hijos, y cerrar todos los hijos deja al padre por iniciar. Las dos mitades del
mismo trabajo llevan cuentas separadas.

Y en `/tareas` el árbol no se ve: la tarjeta dice «3 subtareas · 1 hecha» y ahí
se acaba.

## 3. La contradicción que hubo que resolver

Dos decisiones aprobadas chocaban entre sí:

- Desmarcar un padre a mano **deja los hijos hechos**.
- Con todas las subtareas hechas, el padre **se marca solo**.

Juntas son imposibles: al desmarcar el padre, sus hijos siguen todos hechos, así
que volvería a marcarse al instante y sería imposible desmarcarlo.

**La subida es un EVENTO, no una regla permanente.** El padre se recalcula
cuando cambia un hijo, y solo entonces. Un padre desmarcado a mano se queda
desmarcado —con sus hijos hechos— hasta que se toque alguna subtarea.

Esto es lo que hace que la cascada sea previsible en vez de mágica: nada se
mueve si no has movido tú algo primero.

## 4. Las reglas

| Lo que haces | Lo que pasa |
|---|---|
| Marcas hecha una tarea con hijos | bajan **todos** sus descendientes a hecha |
| Cambias una subtarea | se recalculan sus ancestros, uno a uno hacia arriba |
| Desmarcas a mano una tarea con hijos | no baja nada; los hijos se quedan como estaban |

Las dos primeras **no son excluyentes**: marcar hecha una subtarea que a su vez
tiene hijos baja hasta sus descendientes Y sube a recalcular sus ancestros. Un
solo clic puede mover el árbol en las dos direcciones.

El recálculo de un ancestro mira **solo a sus hijos directos**:

```
todos hechos            → hecha
ninguno hecho, ninguno en proceso → por iniciar
cualquier otra mezcla   → en proceso
```

Y **se detiene en cuanto un ancestro no cambia**: si su estado ya era el que le
tocaba, los de más arriba lo ven igual que antes y tampoco pueden cambiar.

## 5. Una función pura decide, otra aplica

`src/modules/habitos/lib/cascada.ts` expone `planCascada(filas, cambio)`:

- **Entra** la lista plana de todas las tareas —`id`, `parentId`, `status`— y el
  cambio pedido.
- **Sale** la lista completa de cambios a hacer, cada uno con su estado anterior
  y el nuevo. Solo los que de verdad cambian.
- **No toca la base.**

Esa separación es el punto del diseño. La cascada es lógica delicada con muchos
casos de borde —árboles profundos, mezclas de estados, huérfanos, ciclos— y
como función pura se prueba a fondo con decenas de casos en milisegundos. Como
consulta enterrada en una mutación, se probaría con tres.

`updateTaskStatus` pasa a ser el aplicador: pide el plan y lo escribe.

### La transacción es síncrona

En better-sqlite3, `db.transaction(cb)` de Drizzle **no acepta un callback
asíncrono**: devuelve `T`, no `Promise<T>`. Dentro hay que usar la forma
síncrona, `tx.update(...).run()`. Verificado en
`node_modules/drizzle-orm/better-sqlite3/session.d.ts:28`.

Los cambios se agrupan por estado destino, así que son **como mucho tres
sentencias**, una por estado. `completed_at` entra en la misma: el grupo que va
a «hecha» lo recibe con la hora, y los otros dos a nulo. O se escriben las tres
o ninguna.

## 6. El XP sale del conjunto de cambios

No de la tarea que tocaste:

```
xpDelta = (cuántas entran en «hecha» − cuántas salen) × XP_PER_TASK
```

Así completar cinco subtareas una a una y dejar que el padre se cierre solo da
exactamente lo mismo que marcar el padre y que bajen las cinco. **El premio no
depende del orden de los clics**, que es la razón por la que se eligió esta
opción.

La consecuencia aceptada: partir una tarea en muchas subtareas multiplica el XP.
En un panel personal eso solo se lo hace uno a sí mismo.

La subida también puede **restar**: si desmarcas una subtarea y su padre deja de
estar completo, el padre sale de «hecha» y su XP se descuenta. Es simétrico y es
correcto.

`becameDone` sigue significando lo mismo que hoy —si la tarea **que tocaste**
pasó a hecha—, porque de eso dependen el sonido y el aviso. Se añade
`cambiadas`, cuántas se movieron en total, para poder decir «6 tareas
completadas» en vez de callarse.

## 7. Ciclos y huérfanos

`parent_id` no tiene clave foránea en la base del usuario —SQLite no admite
añadirla con `ALTER TABLE`—, así que dos estados imposibles son posibles:

- **Huérfano**: un `parentId` que no apunta a nada. Ya está cubierto:
  `buildTaskTree` lo saca como raíz.
- **Ciclo**: A hijo de B y B hijo de A. Ninguna pantalla puede crearlo, pero una
  fila corrupta sí. Subir por los ancestros sin defensa sería un bucle infinito
  que **cuelga el servidor**.

`planCascada` lleva un conjunto de visitados y para en cuanto repite. Con su
test.

## 8. El árbol se comparte, igual que se compartieron los datos

`ProjectTree` y `ProjectTreeItem` bajan de `components/projects/` a
`components/tasks/` como `TaskTree` y `TaskTreeItem`. Es el mismo movimiento que
hizo `buildTaskTree` con la lógica de datos, y por la misma razón: desde la
unificación lo necesitan las dos pantallas.

El único acoplamiento a proyectos que tienen es crear un hijo, que hoy llama a
`createProjectTask(projectId, parentId, título)`. Se sustituye por
`createSubtask(parentId, título)`, que **hereda el proyecto del padre**: una
subtarea siempre pertenece al mismo proyecto que su madre, o a ninguno.

En `/tareas`, la tarjeta despliega el árbol donde hoy dice «3 subtareas · 1
hecha». El texto se queda como resumen cuando está plegada.

## 9. Alcance

| Archivo | Qué |
|---|---|
| `habitos/lib/cascada.ts` | **Nuevo.** `planCascada`, pura |
| `habitos/lib/cascada.test.ts` | **Nuevo.** |
| `habitos/lib/mutations.ts` | `updateTaskStatus` aplica el plan; nace `createSubtask` |
| `habitos/lib/tasks.ts` | `getTasksGrouped` devuelve también el árbol de cada raíz |
| `habitos/components/tasks/TaskTree.tsx` | **Movido** desde `projects/` |
| `habitos/components/tasks/TaskTreeItem.tsx` | **Movido** desde `projects/` |
| `habitos/components/tasks/TaskCard.tsx` | Despliega el árbol |
| `app/proyectos/[id]/page.tsx` | Importa el árbol de su sitio nuevo |

**Fuera:** la ventana de detalle, los adjuntos y todo lo de hábitos.

## 10. Qué no cambia

- Los tres estados y el botón que los cicla.
- Que el tablero muestre solo raíces.
- El XP por tarea, que sigue siendo `XP_PER_TASK`.
- Las misiones diarias, que cuentan tareas cerradas: ahora una cascada puede
  cerrar varias de golpe y completar una misión de una vez. Es coherente con la
  decisión del punto 6.
- Ninguna columna nueva. **Ninguna migración.**

## 11. Riesgos

**Una cascada mueve muchas filas de golpe.** Marcar un proyecto entero como
hecho puede cerrar decenas de tareas y sumar decenas de XP. Es lo pedido, pero
conviene que la interfaz lo diga: de ahí `cambiadas`.

**El gráfico de flujo dará un salto.** Las métricas cuentan cierres por semana,
y una cascada mete varios en el mismo instante. No es un fallo; es que ahora se
cierra más de una tarea a la vez.

**Mover el árbol toca `/proyectos`, que funciona.** Es un cambio de ubicación y
de nombres, no de comportamiento. Sus tests deben seguir pasando.

## 12. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Marcar un padre como hecho cierra todos sus descendientes, a cualquier
   profundidad
3. Cerrar la última subtarea cierra el padre; abrir una lo reabre
4. Con hijos a medias, el padre queda en proceso
5. Desmarcar un padre a mano NO toca a sus hijos
6. El XP de una cascada es el mismo que el de hacer lo mismo tarea a tarea
7. Un ciclo en `parent_id` no cuelga nada
8. Los cambios se escriben en una sola transacción
9. `/tareas` despliega el árbol desde la tarjeta
10. `/proyectos` sigue funcionando y sus tests siguen pasando

## 13. Fuera de alcance

- La ventana de detalle y los adjuntos (bloque 4)
- Las funciones de hábitos (bloques 5 a 7)
- Arrastrar para reordenar o reanidar
- Deshacer una cascada de una vez
