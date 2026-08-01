# El jardín con memoria

Fecha: 2026-07-31 · Bloque C del rediseño del jardín · Rama `pixel`

## 1. Objetivo

Poder ver el jardín tal y como estaba cualquier día pasado, y recorrerlo día a
día como un timelapse.

Hoy el jardín solo sabe pintar el presente. Pero todo lo necesario para
reconstruir el pasado ya está guardado: `habit_logs` dice qué se cumplió y qué
día, `habit_pauses` qué días no contaban, y `habits.schedule` qué días tocaban.
La memoria no hay que grabarla — **hay que deducirla**.

## 2. La consecuencia de que no se grabe nada

No hay tabla nueva, ni columna nueva, ni migración. Este bloque es el primero
del rediseño que no toca el esquema.

Eso tiene una contrapartida honesta: **la reconstrucción refleja los registros
de hoy, no una foto de aquel día**. Si borras el registro del 12 de julio, el 12
de julio cambia también en la memoria. Es correcto —los registros son la
verdad— pero conviene saberlo: esto no es un historial de auditoría.

## 3. Qué se reconstruye de cada planta

Para un día `D`, cada hábito da:

| Dato | De dónde sale |
|---|---|
| ¿existía? | `createdAt <= D`. Un hábito creado ayer no sale en junio. |
| ¿cumplido ese día? | hay un log con clave de día `D` |
| racha en `D` | `computeStreak` caminando hacia atrás desde `D` |
| ¿alguna vez cumplido? | hay algún log con clave `<= D` |
| etapa y marchitez | `stageFor` e `isPlantWilted`, los de siempre |

Nada de esto es nuevo: son las mismas funciones que pintan el presente. Lo único
que cambia es desde qué día se mira.

## 4. La decisión delicada: el pasado se ve al cierre del día

`computeStreak` tiene una gracia deliberada: si hoy toca y aún no lo has hecho,
la racha **no** se rompe todavía, porque tienes hasta medianoche.

Esa gracia es correcta para hoy y es mentira para ayer. El 12 de julio ya se
acabó: si tocaba y no lo hiciste, la racha se rompió, y pintar la planta viva
sería contar una versión favorable de tu pasado.

**Regla:** para cualquier día anterior a hoy, sin gracia — un día programado y no
cumplido rompe la racha. Para hoy, la gracia de siempre.

Consecuencia visible y esperada: si abres la memoria y retrocedes un solo día,
una planta que hoy está viva puede aparecer marchita en el día de ayer. No es un
fallo; es que ayer, al cerrar, lo estaba.

## 5. El pasado es de solo lectura

En un día que no es hoy:

- no se puede regar — el botón se desactiva;
- no se puede mover una planta — el asa desaparece;
- se dice **con texto** qué día se está viendo, no solo con un control.

Regar el pasado no es que sea difícil: es que no significa nada. Un registro
lleva su fecha, y crear uno con fecha de junio no es «recordar», es falsear.

## 6. Cómo se recorre

Debajo de la escena, una barra con:

- **◀ ▶** un día atrás y un día adelante;
- un **deslizador** sobre todo el rango, para saltar lejos de un tirón;
- **▶ Reproducir**, que avanza solo hasta hoy y se para;
- **Hoy**, que vuelve al presente y devuelve el jardín a su modo normal.

El rango empieza en el primer registro que exista y acaba hoy. Sin registros no
hay memoria que enseñar, y la barra no se pinta.

## 7. Todo el recorrido pasa en el navegador

Los datos —hábitos, pausas y claves de día cumplidas— se cargan **una vez** al
abrir la pantalla, y cada día se reconstruye en el cliente.

La alternativa era pedir cada día al servidor. Se descarta: arrastrar el
deslizador dispararía una petición por día y el timelapse iría a tirones. Lo que
se carga son claves de día, no filas completas — para un año de cinco hábitos
son unos pocos miles de números.

## 8. Accesibilidad

Es la regla G, que aplica a todo el rediseño:

- el deslizador es un `<input type="range">` de verdad, así que las flechas y
  Inicio/Fin funcionan sin escribir nada;
- el día que se ve va en **texto**, no solo en la posición del control;
- `prefers-reduced-motion` desactiva la reproducción automática — el botón sigue
  ahí, pero no arranca solo y avisa de que está pausado;
- un `role="status"` anuncia el día al cambiar.

## 9. Alcance

**Dentro:** reconstruir un día, la barra de tiempo, el modo solo lectura, y el
clima de esa semana —que sale de los mismos registros.

**Fuera:** exportar el timelapse como imagen o vídeo; comparar dos días lado a
lado; la tienda (bloque E) y el cruce con música (bloque F).

## 10. Criterios de aceptación

1. Un hábito creado el día 10 **no aparece** al mirar el día 5.
2. Un día programado y fallado en el pasado deja la planta **marchita**.
3. El mismo día de hoy, visto desde la memoria, se pinta **igual** que el jardín
   normal.
4. En el pasado no se puede regar ni mover ninguna planta.
5. El día que se está viendo se puede leer **como texto**.
6. El deslizador se maneja **con el teclado**.
7. Sin ningún registro, la barra de tiempo no aparece y el jardín funciona como
   antes.
