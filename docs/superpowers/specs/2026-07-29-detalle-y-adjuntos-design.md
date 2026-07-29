# Detalle de tarea y adjuntos · diseño

**Fecha:** 2026-07-29
**Estado:** aprobado, listo para planificar
**Paso:** 4 de 7 de la ampliación de hábitos y tareas
**Depende de:** `2026-07-29-cascada-subtareas-design.md`, ya implementado

---

## 1. Objetivo

Que una tarea tenga **un sitio propio** donde caben su descripción, su
categoría, su prioridad, su árbol de subtareas y sus adjuntos —archivos y
enlaces—.

## 2. Punto de partida

La tarjeta del tablero ya muestra el título, la descripción, el punto de
prioridad, el subrayado de categoría y el árbol desplegable. Lo que no tiene es
sitio para **editar** nada de eso, ni para colgar un archivo.

Y el repo **no tiene ninguna infraestructura de archivos**: ni una subida, ni una
escritura a disco, ni una carpeta donde ponerlos. Este es el primer bloque que
sale de SQLite.

## 3. `/tareas/<id>`: una página, no una ventana flotante

`Modal` ya existe y habría sido más rápido, pero una página propia gana en lo que
importa: **recargar no la pierde, «atrás» funciona y el enlace se puede
guardar**. Es la misma razón por la que los filtros viven en la URL.

Con adjuntos y árbol dentro, una ventana flotante además se queda estrecha.

La tarjeta del tablero enlaza al detalle desde su título.

## 4. Una sola tabla para archivos y enlaces

```sql
CREATE TABLE task_attachments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,              -- 'file' | 'link'
  name       TEXT NOT NULL,              -- lo que se muestra
  url        TEXT,                       -- solo los enlaces
  stored_as  TEXT,                       -- solo los archivos: su nombre en disco
  size       INTEGER,                    -- solo los archivos, en bytes
  mime       TEXT,                       -- solo los archivos
  created_at INTEGER NOT NULL
);
CREATE INDEX task_attachments_task_idx ON task_attachments(task_id);
```

Una tabla y no dos porque **se leen, se ordenan y se borran juntos**: en la
pantalla son una sola lista. Separarlos duplicaría cada consulta y cada borrado
para ganar unas columnas nulas.

`SCHEMA_SQL` crece, y esta vez sale gratis: `CREATE TABLE IF NOT EXISTS` ya
cubre añadir tablas. **No hace falta tocar `migrar.ts`**, que existe para añadir
*columnas* a tablas que ya están.

## 5. Los archivos viven en disco

En `data/adjuntos/`. Tres razones:

- `data/` **ya está en `.gitignore`**, así que no se sube nada por error.
- La base ya pesa 150 MB por el histórico de música. Meter fotos dentro la hace
  crecer sin freno y ralentiza cada copia de seguridad.
- Un archivo en una carpeta se abre y se copia con el explorador.

El coste, y hay que decirlo: **la copia de seguridad pasa a ser dos cosas**, el
`.db` y la carpeta.

### El nombre en disco no es el nombre que subiste

En disco el archivo se llama por un identificador generado. El nombre original
se guarda en `name`, solo para mostrarlo y para nombrar la descarga.

Eso resuelve tres problemas de golpe: dos archivos con el mismo nombre no se
pisan, un nombre con caracteres raros o con `../` no puede escribir donde no
debe, y el contenido de la carpeta no filtra de qué van tus tareas.

## 6. Servir los archivos es la parte con riesgo

`data/adjuntos/` está fuera de `public/`, así que Next no los sirve. Hace falta
una ruta: `GET /api/adjunto/[id]`.

**Esa ruta recibe un id y NUNCA una ruta de archivo.** Busca el id en la base y
sirve el `stored_as` que ella guarda, resolviéndolo siempre dentro de
`data/adjuntos/`. Si aceptara un nombre de la URL,
`/api/adjunto/../../data/juampi.db` descargaría la base entera.

Además, antes de leer, comprueba que la ruta resuelta **empieza por la carpeta de
adjuntos**. Es un cinturón sobre el tirante: aunque `stored_as` llegara corrupto
de la base, no puede salirse.

La respuesta lleva `Content-Type` del `mime` guardado y
`Content-Disposition: attachment` con el nombre original. **`attachment` y no
`inline` a propósito**: servir HTML o SVG subido por el usuario en el mismo
origen que la aplicación es un agujero de script; forzar la descarga lo cierra.

## 7. El límite de tamaño, y por qué no es solo un número

Los server actions de esta versión **cortan el cuerpo a 1 MB por defecto**. Sin
tocar la configuración, adjuntar cualquier foto de móvil falla. Verificado en
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`.

| | |
|---|---|
| Tope por archivo, en el código | **50 MB** |
| `serverActions.bodySizeLimit` | **51 MB** |

El megabyte de diferencia no es por gusto. La propia documentación advierte que
`multipart/form-data` añade bordes, cabeceras de parte y metadatos —de 10 a 20 KB
como regla— y que hay que dejar hueco. Apurar el límite exacto rompería justo en
los archivos grandes, que son los que más cuesta volver a subir.

50 MB cubre fotos, escaneos, PDFs largos y clips cortos, y **cabe en un server
action**, que carga el archivo en memoria antes de escribirlo. Subir mucho más
obligaría a cambiar de mecanismo —una ruta que escriba a disco a chorro— y a
poner una barra de progreso real. Queda fuera.

## 8. El borrado, en el orden correcto

Borrar una tarea ya arrastra su árbol entero. Ahora tiene que arrastrar también
los archivos de todo ese árbol.

**Primero las filas, después los archivos.** Si se hiciera al revés y algo
fallara en medio, quedarían filas apuntando a archivos que ya no existen: la
pantalla enseñaría adjuntos que al pulsarlos dan error. Al revés, lo peor que
puede pasar es un archivo huérfano en disco, que no rompe nada y se puede
limpiar cuando se quiera.

**Pero antes de borrar las filas hay que LEERLAS.** La foránea es
`ON DELETE CASCADE`, así que al borrar la tarea sus adjuntos desaparecen solos —y
con ellos el único sitio donde estaba escrito cómo se llama cada archivo en
disco—. El orden completo es: leer la lista de `stored_as` de todo el árbol,
borrar las tareas, y después los archivos. Quien lo haga en dos pasos en vez de
tres deja huérfanos para siempre, sin forma de saber cuáles eran.

Al contrario que las columnas que se añadieron con `ALTER TABLE`, **esta foránea
sí la vigila el motor**: `task_attachments` es una tabla nueva y nace con ella
declarada, también en la base del usuario.

Borrar un archivo que ya no está **no es un error**: se ignora. Es el estado al
que llega cualquiera que haya borrado la carpeta a mano.

## 9. Lo que se puede editar en el detalle

| | |
|---|---|
| Título | sí, en línea |
| Descripción | sí |
| Categoría | sí, de la lista |
| Prioridad | sí, o ninguna |
| Estado | sí, con la cascada de siempre |
| Subtareas | el mismo árbol, con su formulario |
| Adjuntos | añadir archivo, añadir enlace, borrar |
| Proyecto | **no**, queda fuera de este bloque |

## 10. Qué no cambia

- El tablero, salvo que el título pasa a ser un enlace.
- La cascada, los filtros, los colores.
- Ninguna columna de `tasks`.

## 11. Riesgos

**Es el primer código que escribe en el disco del usuario.** Una ruta mal
construida no corrompe la base pero puede escribir fuera de sitio. De ahí que
el nombre en disco sea generado y que la lectura compruebe la carpeta.

**La copia de seguridad pasa a ser dos cosas.** Quien copie solo el `.db` tendrá
una base que menciona archivos que no tiene. Se documenta.

**Un adjunto puede desaparecer por debajo.** Si se borra el archivo a mano, la
fila sigue. La descarga responde 404 y la lista lo dice, en vez de reventar.

**El tope de 50 MB se comprueba en dos sitios** —en el código y en la
configuración de Next— y tienen que seguir cuadrando. Si alguien sube uno y no
el otro, el fallo aparece solo con archivos grandes.

## 12. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. `/tareas/<id>` existe, sobrevive a una recarga y responde al botón «atrás»
3. Se puede añadir, listar, descargar y borrar un archivo
4. Se puede añadir, listar y borrar un enlace
5. Un archivo de más de 50 MB se rechaza con un mensaje, no con una excepción
6. La ruta de descarga NO acepta rutas: `../` no sale de `data/adjuntos/`
7. Borrar una tarea borra los archivos de todo su árbol
8. Un archivo que falta en disco da 404 y no rompe la pantalla
9. El título, la descripción, la categoría y la prioridad se editan desde ahí
10. Nada de `data/adjuntos/` entra en git

## 13. Fuera de alcance

- Subidas de más de 50 MB y barra de progreso
- Previsualizar imágenes dentro de la página
- Mover una tarea de proyecto
- Las funciones de hábitos (bloques 5 a 7)
