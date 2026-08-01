# La fauna del jardín

Fecha: 2026-08-01 · Bloque F del rediseño del jardín · Rama `pixel`

## 1. Objetivo

Que el jardín refleje también lo que no son hábitos: la música que escuchaste y
las tareas que cerraste.

**Las plantas son los hábitos. La fauna es todo lo demás que hiciste ese día.**

## 2. Lo que este bloque NO hace

Ya existe un cruce entre música y hábitos —`compararGrupos`, en la portada— que
responde a «¿escuchas distinto los días que cumples?» y que **se niega a
contestar** con menos de diez días por grupo. Eso sigue como está.

Esto es otra cosa y conviene no confundirlas: aquí no se afirma ninguna
relación entre música y hábitos. Un pájaro no dice que escuchar te ayude a
cumplir. Dice que ese día escuchaste. Es un reflejo, no una tesis.

## 3. Qué aparece

| Bicho | Sale de | Cuántos |
|---|---|---|
| Pájaros, en el cielo | minutos escuchados ese día | 0 · 1 · 2 · 3 · 4 |
| Mariposas, entre las plantas | tareas cerradas ese día | una por tarea, hasta 5 |

Tramos de los pájaros: nada → 0; menos de 30 min → 1; hasta 90 → 2; hasta 180 →
3; más → 4.

**Cero de algo es cero de eso.** Un día sin música no tiene pájaros, y un día sin
tareas no tiene mariposas. Nunca se rellena con fauna de adorno para que la
escena no parezca vacía: si el día estuvo vacío, la escena lo dice.

## 4. Funciona también en el pasado

La memoria del bloque C reconstruye cualquier día, y la fauna va con ella: los
minutos y las tareas de cada día viajan en el mismo paquete que los hábitos.

Se traen **solo desde el primer registro de hábito**, que es donde empieza la
barra de tiempo. Hay 2.833 días con escuchas guardadas y mandarlos todos al
navegador sería pagar por un pasado al que no se puede llegar.

## 5. Que se entienda sin ver bien

Un bicho pequeño y en movimiento es de lo peor que se puede pedir a la vista, así
que **el recuento va en texto** debajo de la escena: «hoy: 43 min de música · 2
tareas». La fauna es el adorno de un dato que se puede leer.

Los bichos son `aria-hidden` y no se anuncian: lo que se lee es la frase.

Con `prefers-reduced-motion` los bichos se quedan quietos. Siguen estando, que es
lo que importa; lo que se va es el aleteo.

## 6. Alcance

**Dentro:** los dos sprites, los tramos, la consulta por día, la fauna en la
escena y la frase con el recuento.

**Fuera:** afirmar cualquier relación entre música y hábitos —eso ya tiene su
sitio y su regla de negarse—; fauna que reaccione a nada más; sonido.

## 7. Criterios de aceptación

1. Un día sin música no pinta ningún pájaro.
2. Un día sin tareas cerradas no pinta ninguna mariposa.
3. Los tramos son los de la tabla, y el de arriba no se pasa de 4.
4. Las mariposas se paran en 5 aunque cierres veinte tareas.
5. El recuento del día se puede **leer como texto**.
6. Al viajar a un día pasado, la fauna es la de ese día.
7. Sin música ni tareas en toda la historia, el jardín se ve como antes.
