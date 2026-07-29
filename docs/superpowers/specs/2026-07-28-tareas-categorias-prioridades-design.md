# Tareas: una sola tabla, categorías y prioridades · diseño

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para planificar
**Paso:** 2 de 7 de la ampliación de hábitos y tareas
**Depende de:** `2026-07-28-paleta-categorica-design.md`, ya implementado

---

## 1. Objetivo

Que una tarea sea **una sola cosa** en todo el dashboard, y que se pueda
organizar por tres ejes: estado, categoría y prioridad.

## 2. Punto de partida: hay dos sistemas de tareas

El repo tiene hoy dos tablas que guardan casi lo mismo y no se conocen:

| | `tasks` (`/tareas`) | `project_items` (`/proyectos`) |
|---|---|---|
| Anidación | ninguna | **árbol** por `parent_id` |
| Estado | TODO · IN_PROGRESS · DONE | los mismos tres |
| Orden manual | sí | sí |
| Descripción | **sí** | no |
| Cascada al completar | — | **no la hay** |

Lo que se ha pedido para `/tareas` —anidar subtareas con cascada— es lo que
`project_items` ya sabe hacer a medias. Añadirlo a `tasks` por separado dejaría
**dos árboles** que mantener, y la cascada habría que escribirla dos veces.

### El momento importa

En la base real hay hoy **1 tarea, 1 proyecto y 0 elementos de proyecto**.
Unificar ahora no arrastra prácticamente nada. Cada semana que pase, más caro.

## 3. La decisión: `tasks` absorbe `project_items`

Y no al revés, por dos razones:

1. `tasks` ya tiene `description`, que la ventana de detalle del bloque 4
   necesita. `project_items` no la tiene.
2. `/tareas` es la pantalla donde aterrizan todas las funciones nuevas. Mover
   la tabla que menos va a cambiar cuesta menos.

`project_items` **desaparece**. `/proyectos` pasa a leer de `tasks` filtrando
por `project_id`: es la misma cosa mirada desde otro ángulo.

### La tabla resultante

```sql
CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'TODO',
  "order"      INTEGER NOT NULL DEFAULT 0,
  parent_id    TEXT REFERENCES tasks(id)            ON DELETE CASCADE,
  project_id   TEXT REFERENCES projects(id)         ON DELETE SET NULL,
  category_id  TEXT REFERENCES task_categories(id)  ON DELETE SET NULL,
  priority     TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  completed_at INTEGER
);
```

Las tres claves foráneas borran de tres maneras distintas, y cada una es una
decisión:

- **`parent_id` CASCADE.** Borrar una tarea se lleva sus subtareas. Es lo que
  ya hacía `project_items` y es lo correcto: una subtarea sin padre no
  significa nada.
- **`project_id` SET NULL.** *Esto cambia el comportamiento actual*: hoy borrar
  un proyecto borra sus elementos. Al unificar, una tarea es una cosa de primera
  clase, y borrar el contenedor no debe llevarse el trabajo por delante. Las
  tareas sobreviven sueltas.
- **`category_id` SET NULL.** Borrar una categoría deja las tareas sin
  categoría, no las borra.

`parent_id` se declara en `SCHEMA_SQL` y **no** en el objeto de columnas de
Drizzle: una referencia a la propia tabla ahí provoca una inicialización
circular. Ya está resuelto así en `project_items` y se copia el patrón.

## 4. No hay sistema de migraciones, y hace falta uno

`createDb()` ejecuta `SCHEMA_SQL`, que son `CREATE TABLE IF NOT EXISTS`. Sirve
para una base nueva; sobre la que ya existe **no añade columnas**. Nunca ha
hecho falta hasta ahora porque el esquema solo había crecido con tablas nuevas.

Se añade `src/modules/core/db/migrar.ts` con una función `ponerAlDia(sqlite)`:

1. Lee `pragma table_info(tasks)` y añade con `ALTER TABLE ... ADD COLUMN` las
   columnas que falten.
2. Si la tabla `project_items` existe, copia sus filas a `tasks` conservando
   `id`, `parent_id` y `project_id`, y después la borra.
3. No hace nada si ya está todo. Es idempotente por diseño y se ejecuta en cada
   arranque.

**Por qué `ALTER TABLE` y no recrear la tabla:** SQLite no permite añadir una
columna con clave foránea a una tabla existente sin recrearla, pero sí acepta
`ADD COLUMN` de una columna anulable sin restricción. Las tres foráneas nuevas
quedan **declaradas en `SCHEMA_SQL` para las bases nuevas** y **sin declarar en
las que se ponen al día**. Es una diferencia real y se documenta: en la base
existente la integridad de `parent_id`, `project_id` y `category_id` la sostiene
el código, no el motor. Con una tarea guardada, recrear la tabla sería
excesivo; si algún día hace falta, se recrea entonces.

`createTestDb()` también llama a `ponerAlDia()`. Sobre un esquema recién creado
no debe hacer nada, y que los 432 tests pasen lo demuestra.

La migración lleva **su propio test**, al estilo de `migrar-ledger.test.ts`:
construye una base con la forma vieja —`tasks` sin columnas y `project_items`
con filas anidadas— y afirma que después están todas en `tasks`, con su árbol
intacto y sin `project_items`.

## 5. Categorías

Tabla propia, creadas por el usuario, una por tarea:

```sql
CREATE TABLE task_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX task_categories_name_unq
  ON task_categories(name COLLATE NOCASE);
```

`color` guarda una **clave de la paleta categórica** —`pink`, `lav`, `mint`…—,
no un hexadecimal, y se resuelve en lectura igual que los colores de hábito y
las etiquetas de música. Las ocho están disponibles, incluida `acid`.

El índice único es `COLLATE NOCASE` para que «Casa» y «casa» no sean dos
categorías. La comprobación se hace **también en el código** antes de insertar,
para poder devolver un mensaje en vez de una excepción de SQLite.

Se crean al vuelo desde el formulario de tarea y desde la barra de filtros, como
las etiquetas de música. No hay pantalla de gestión hasta que haga falta; sí hay
forma de renombrarlas y borrarlas desde el propio filtro.

## 6. Prioridades

Cuatro, fijas, **opcionales**. No son una tabla: son un valor de texto en la
columna, resuelto en lectura.

| Clave | Etiqueta | Color | Punto |
|---|---|---|---:|
| `URGENT` | Urgente | `lav` | 15px |
| `HIGH` | Alto | `coral` | 12px |
| `MEDIUM` | Medio | `amber` | 9px |
| `LOW` | Bajo | `mint` | 6px |
| *(null)* | sin prioridad | — | no se pinta |

Que sea opcional es lo que hace que el punto signifique algo: si todas las
tareas llevan punto, ninguna llama la atención.

Los cuatro colores salen de la paleta compartida y **coinciden a propósito** con
cuatro de los colores de categoría. Lo que los separa en pantalla no es el tono
sino la forma y el sitio: la prioridad es un punto redondo a la izquierda del
título, la categoría un subrayado debajo.

### El tamaño del punto no es decoración

La regla que sostiene el sistema visual es **nunca solo color**. Un punto que
solo cambia de tono deja fuera a quien no distingue lavanda de coral —y son
justamente Urgente y Alto—. El diámetro va de 6 a 15px: dos señales
independientes por el precio de una, y sigue siendo el punto redondo que se
pidió.

Los cuatro tamaños son múltiplos de 3 para caer en la rejilla del sistema pixel.

Además, el punto lleva `title` y `aria-label` con el nombre de la prioridad, y
el detalle la dice en texto.

## 7. La pantalla

El **estado manda**: siguen las tres columnas Por iniciar / En proceso /
Completadas. Categoría y prioridad se ven en cada tarjeta y sirven para filtrar.

```
┌─ Por iniciar ──────────────┐
│ ● Llamar al fontanero      │   ● = prioridad (color + tamaño)
│   ──────────               │   ─ = subrayado de categoría
│                            │
│ ●  Comprar cemento         │
│   ──────────               │
└────────────────────────────┘
```

### Qué tarjetas se ven

El tablero lista **solo las tareas raíz**, las que no tienen padre. Si no, al
migrar aparecerían de golpe como tarjetas sueltas los elementos anidados de los
proyectos, descolgados de su contexto.

Una tarea con hijos lleva bajo el título un `3 subtareas · 1 hecha`. Es una
línea de texto, no un árbol: el árbol desplegable es del bloque 3. Pero sin ella
el trabajo anidado desaparecería de la vista sin decir nada, y eso es peor que
no tenerlo.

### El orden se conserva tal cual

`order` no se recalcula al migrar. Solo se compara **dentro del mismo grupo**
—mismo padre y mismo estado—, así que dos tareas de grupos distintos con el
mismo número nunca se comparan entre sí. `createTask` pasa a calcular el
siguiente número dentro de su grupo, no dentro de todo `TODO`.

### Filtros

Chips sobre el tablero: uno por categoría —con su color— y cuatro de prioridad.
El estado no se filtra: ya son las columnas.

**Los filtros viven en la URL**, en `?cat=` y `?pri=`. Recargar no los pierde,
el botón «atrás» funciona y el enlace se puede guardar. Es además la vacuna
contra la clase de fallo que ya apareció en música, donde cambiar de rango
echaba al inicio del dashboard.

`searchParams` es una **promesa** en esta versión de Next y hay que esperarla; el
tipo sale del helper generado `PageProps<"/tareas">`. Verificado en
`node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`.

Un filtro que no case con nada muestra el estado vacío con un botón de quitar
filtros, no una columna en blanco sin explicación.

## 8. Dónde vive el código

| Archivo | Qué |
|---|---|
| `core/db/migrar.ts` | **Nuevo.** `ponerAlDia()`, idempotente |
| `core/db/migrar.test.ts` | **Nuevo.** Base con la forma vieja → forma nueva |
| `core/db/schema-sql.ts` | `tasks` con las columnas nuevas, `task_categories`, sin `project_items` |
| `habitos/schema.ts` | Lo mismo en Drizzle |
| `habitos/lib/prioridad.ts` | **Nuevo.** Puro: claves, etiquetas, color y tamaño |
| `habitos/lib/prioridad.test.ts` | **Nuevo.** |
| `habitos/lib/categorias.ts` | **Nuevo.** Consultas y mutaciones de categoría |
| `habitos/lib/categorias.test.ts` | **Nuevo.** |
| `habitos/lib/tasks.ts` | Filtrado, y el árbol que sube desde `projects.ts` |
| `habitos/lib/projects.ts` | Repuntado a `tasks` |
| `habitos/lib/quests.ts` | Las dos cuentas, separadas por `project_id` |
| `habitos/lib/mutations.ts` | Las cuatro funciones de `projectItems` pasan a `tasks` |
| `habitos/components/tasks/PriorityDot.tsx` | **Nuevo.** |
| `habitos/components/tasks/FilterBar.tsx` | **Nuevo.** |
| `habitos/components/tasks/TaskCard.tsx` | Punto y subrayado |
| `habitos/components/tasks/NewTaskForm.tsx` | Selector de categoría y prioridad |
| `app/tareas/page.tsx` | Lee `searchParams` |

El árbol se construye hoy dentro de `getProjectWithTree`. Sube a `tasks.ts` como
función propia y con test, porque a partir de ahora lo usan las dos pantallas.

### Una deuda que este paso NO paga

Las tareas y los proyectos viven dentro del módulo `habitos`, lo que contradice
la regla de fronteras de `AGENTS.md`. Extraer un módulo `tareas` obligaría a
mover también el XP, el nivel y las misiones diarias, que son de hábitos y que
las tareas consumen. Queda anotado y sin hacer: mezclarlo con esta unificación
haría el cambio imposible de revisar.

## 9. Qué cambia para el usuario

- Los elementos de proyecto pasan a ser tareas de pleno derecho: aparecen en
  `/tareas`, admiten categoría y prioridad, y tienen descripción.
- Borrar un proyecto ya **no** borra su trabajo.
- El resto se ve igual hasta que se marque una categoría o una prioridad.

## 10. Qué no cambia

- Los tres estados y sus nombres.
- El orden manual dentro de cada columna.
- El XP por tarea completada.
- **Las dos misiones diarias siguen contando exactamente lo mismo.** Hay dos, no
  una: «Dos tareas» cuenta filas de `tasks` y «Una subtarea de proyecto» cuenta
  filas de `project_items`. Como hoy ninguna tarea tiene proyecto y todo elemento
  lo tiene, al unificar se separan por esa misma línea:

  | Misión | Hoy | Después |
  |---|---|---|
  | Dos tareas | filas de `tasks` | tareas **sin** proyecto |
  | Una subtarea de proyecto | filas de `project_items` | tareas **con** proyecto |

  Los dos conjuntos son idénticos fila a fila. Una tarea que metas en un
  proyecto dejará de contar para la primera y pasará a contar para la segunda,
  que es justo lo que dicen sus rótulos.
- Ninguna fila se pierde.

## 11. Riesgos

**La migración toca la base real.** Corre en cada arranque y es idempotente,
pero se ejecuta sobre datos que no se pueden recuperar. Antes de la primera
ejecución en la base real, se copia `data/juampi.db` a un `.bak`.

**Las foráneas nuevas no las vigila el motor en la base existente.** Explicado
en el punto 4. El código es responsable de no dejar un `parent_id` colgando.

**`/proyectos` se repunta entero.** Cinco archivos usan `projectItems`. Es la
parte más aburrida y la más fácil de romper en silencio: `projects.test.ts` ya
cubre el árbol y los conteos, y esos tests deben seguir pasando con cambios
mínimos —solo los nombres de tabla—.

**Cuatro colores sirven a dos conceptos.** Prioridad y categoría comparten tonos
a propósito. Si en pantalla resultan confusos, la respuesta es cambiar la forma
o el sitio, no repartir más colores: no hay dieciséis que se distingan.

## 12. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. `project_items` no existe ni en el esquema ni en la base
3. La migración corre dos veces seguidas sin cambiar nada la segunda
4. Un elemento de proyecto anidado sobrevive con su padre y su proyecto
5. Borrar un proyecto deja sus tareas vivas y sin proyecto
6. Una tarea admite una categoría y una prioridad, ambas opcionales
7. Los filtros van en la URL y sobreviven a una recarga
8. Los cuatro puntos de prioridad se distinguen por tamaño además de por color
9. En `projects.test.ts` lo único que cambia son los nombres de tabla y columna:
   ninguna afirmación sobre el árbol, los conteos ni el último avance
10. El tablero solo muestra tareas raíz, y las que tienen hijos lo dicen

## 13. Fuera de alcance

- La cascada bidireccional al completar (bloque 3)
- La ventana de detalle y los adjuntos (bloque 4)
- Las funciones nuevas de hábitos (bloques 5 a 7)
- Extraer un módulo `tareas`
- Reordenar tareas arrastrando entre columnas
