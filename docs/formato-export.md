# El formato de exportación

Versión **1** del formato `dashme-export`.

Este documento existe para que el fichero se pueda leer sin este código
delante. Si algún día el dashboard desaparece, el volcado tiene que seguir
siendo utilizable, y para eso hace falta que alguien pueda entenderlo.

## Por qué

El hallazgo que motiva esto no es de formato, es de **retención**. Habitica
promedia tu historial antiguo para ahorrar almacenamiento, y lo dice en su
propia documentación: los datos viejos se sustituyen por su media, y es la
media lo que acaba en la exportación. **Ningún formato recupera lo que la base
ya tiró.**

Este proyecto conserva todo y nunca promedia. El volcado de hoy incluye tu
primer día.

Y no es teórico: la base de este dashboard se perdió una vez y se recuperó
entera de un volcado con esta misma forma. Un export que nunca se ha vuelto a
importar es una promesa, no una salida.

## Cómo se saca

Desde `/habitos`, el botón **Descargar todo**. O directamente:

```
curl -OJ http://127.0.0.1:3000/api/exportar
```

Es un enlace normal a propósito: se puede abrir en otra pestaña, copiar o pedir
con `curl`, y funciona aunque el JavaScript de la página falle.

## La forma

```json
{
  "formato": "dashme-export",
  "version": 1,
  "generado": "2026-08-28T06:00:00.000Z",
  "recuento": { "habits": 3, "habit_logs": 412, "…": 0 },
  "tablas": {
    "habits": [ { "id": "…", "name": "Leer", "createdAt": 1785196800000 } ],
    "habit_logs": [ … ]
  }
}
```

- `recuento` es redundante a propósito: permite comprobar de un vistazo que no
  falta nada sin recorrer el fichero entero.
- Las claves de cada fila son las de **TypeScript** (`camelCase`), no las de
  SQL (`snake_case`). Es lo que devuelve la capa de datos y lo que vuelve a
  aceptar al importar.
- Las fechas van como **milisegundos desde epoch**. Un día se guarda como
  medianoche **UTC** de la fecha local — ver `lib/day.ts`.
- Los booleanos van como `true` y `false`. En SQLite se guardan como 0 y 1,
  pero la capa de datos ya los traduce y el volcado sale de ahí.

## Las tablas, y en qué orden

El orden importa al importar: los padres van antes que los hijos. Es el de
`ORDEN` en `src/modules/habitos/lib/exportar.ts`, y un test comprueba que están
todas las del esquema — si alguien añade una tabla y no la pone ahí, ese test
cae.

| Tabla | Qué guarda |
|---|---|
| `habits` | Los hábitos, con su horario, su intención y si están interiorizados |
| `habit_logs` | Un registro por día cumplido, con el XP que dio |
| `habit_notes` | Una nota por hábito y día |
| `habit_pauses` | Rangos de días que no cuentan |
| `habit_automaticity` | Las medidas semanales del SRBAI, los cuatro ítems |
| `player` | Saldo de XP, lo gastado y los escudos |
| `daily_quests` | Las misiones de cada día |
| `garden_decorations` | Lo comprado en la tienda |
| `projects` | Los proyectos |
| `task_categories` | Las categorías de tareas |
| `tasks` | Tareas y subtareas, anidadas por `parentId` |
| `task_attachments` | Los adjuntos: la FILA, no el fichero (ver abajo) |

## Qué NO lleva, y por qué

**Nada derivado.** Ni rachas, ni nivel, ni las sugerencias de automaticidad.
Todo eso se recalcula al leer, así que meterlo en el volcado sería exportar una
opinión de hoy con aspecto de dato — y dentro de un año, al reimportarlo, esa
opinión ya no coincidiría con lo que el mismo código calcula. Lo que se guarda
es lo que sale.

**Los ficheros de los adjuntos.** `task_attachments` lleva la fila —nombre,
tipo, tamaño— pero no el contenido, que vive en `data/adjuntos/`. Un JSON con
binarios dentro deja de ser legible, y esa carpeta se copia aparte. **Es la
única cosa que un volcado no basta para restaurar**, y por eso está dicho aquí
y no en una nota al pie.

## Volver a importar

```ts
import { importarTodo } from "@/modules/habitos";

await importarTodo(db, JSON.parse(fichero));
await importarTodo(db, JSON.parse(fichero), { reemplazar: true });
```

Sin `reemplazar` **se niega a escribir si la base tiene datos**. Importar
encima mezclaría dos historiales sin decirlo, y una mezcla silenciosa es peor
que un error.

Con `reemplazar` borra primero, en orden inverso —hijos antes que padres— para
no depender de los `ON DELETE`.

Una tabla que falte en el fichero no es un error: un volcado de una versión
anterior no conoce las tablas que se añadieron después. Una **versión mayor**
que la que entiende esta copia sí lo es, y se rechaza en vez de leer a medias.

## Si cambia el formato

`version` sube cuando un volcado viejo deje de poder leerse tal cual. Añadir
una tabla o una columna opcional **no** la sube: eso ya se tolera.

## Una nota sobre las fechas, porque costó

`JSON.stringify` convierte un `Date` en **texto ISO**, y al reimportar, la capa
de datos espera un `Date` y revienta con `value.getTime is not a function`.

O sea que la ida y vuelta funcionaba en memoria y estaba **rota en cuanto
pasaba por un fichero** — el único camino que le importa a nadie. Se descubrió
descargando el fichero de verdad; el test de ida y vuelta pasaba porque le daba
el objeto en memoria.

Por eso las fechas se convierten a milisegundos al salir y de vuelta a `Date`
al entrar, y qué columnas son fechas se le pregunta a la tabla en vez de
adivinarlo por el nombre — `createdAt`, `week` y `fromDay` no se parecen en
nada.

La importación **también acepta texto ISO**, para poder leer los volcados que
salieron antes de este arreglo. Una fecha que no se entienda se rechaza en vez
de guardarse como basura.
