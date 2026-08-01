# El tiempo del jardín · diseño

**Fecha:** 2026-07-30
**Estado:** aprobado, listo para planificar
**Paso:** 1 de 5 del rediseño del jardín

---

## 1. Objetivo

Que las nubes del jardín dejen de ser adorno y digan **cómo ha ido tu semana**.

## 2. De dónde sale este bloque, y en qué se quedó

Iba a ser «arreglar lo que promete y no cumple», con dos partes:

- **Las especies que no crecen** — tres de las cinco repiten emoji. **Se va entera
  al bloque del pixel art**: no existen cinco emoji de cactus, así que arreglarlo
  ahora sería trabajo que se tira cuando las dibujemos en SVG.
- **El cielo** — y aquí hay una corrección: *no miente*. El sol y la luna salen de
  `useLocalHour()` y son honestos. Lo que es decoración fija son **las cuatro
  nubes**.

Así que el bloque se queda en las nubes. Es pequeño, y merece la pena porque su
entregable no son unos píxeles: es una **función pura y probada** que sobrevive al
rediseño visual que viene después.

## 3. Qué mide

El cumplimiento de los **últimos 7 días**, con la misma definición que ya usan la
racha global y el cruce con música: un día cuenta como cumplido si hiciste *todo*
lo que tocaba.

Y lo lee del mismo sitio: `getDiasCumplidos`, que ya existe, ya está probado y ya
**respeta las pausas**. Eso último importa: una semana de vacaciones no debe
traerte lluvia.

## 4. Los tres estados, y el cuarto

| Cumplidos de los evaluables | Tiempo |
|---|---|
| 80% o más | despejado |
| 40% a 79% | algo nublado |
| menos del 40% | lluvia |
| **ningún día evaluable** | **sin dato** |

El cuarto es el que importa. Si en los últimos siete días no tocaba nada —o todo
estaba en pausa— **no se inventa un tiempo**: el cielo se queda como está hoy, con
su sol o su luna y sin nubes que signifiquen nada.

Es la misma regla que en el panel de música: **antes que inventar, callar**.

## 5. Los umbrales, y por qué esos

Con siete días, 80% son 6 de 7 y 40% son 3 de 7. Es decir: **un fallo a la semana
sigue siendo despejado**, y hacen falta cuatro para que llueva.

Está escogido a favor de no castigar. Un jardín que se nubla al primer tropiezo
enseña a evitar el jardín.

## 6. Que se entienda sin ver bien

Es la regla del rediseño entero, aplicada aquí:

- El tiempo **no se transmite solo con un emoji de nube**. Va acompañado de un
  rótulo en texto —«Despejado», «Algo nublado», «Lluvia»— y de un `title` que
  dice de dónde sale: «6 de 7 días cumplidos».
- El número de nubes cambia con el estado, así que hay **cantidad además de
  forma**: cero, dos y cuatro.

## 7. Alcance

| Archivo | Qué |
|---|---|
| `habitos/lib/clima.ts` | **Nuevo.** `climaDe`, pura |
| `habitos/lib/clima.test.ts` | **Nuevo.** |
| `app/jardin/page.tsx` | Lee los días y calcula el tiempo |
| `habitos/components/GardenScene.tsx` | Pinta las nubes según el estado |

**Fuera:** las especies, el pixel art, las parcelas, la estación del año.

## 8. Qué no cambia

- El sol, la luna y las fases del día: ya eran honestos.
- Las plantas, las rachas, el XP.
- Ninguna tabla, ninguna columna, ninguna migración.

## 9. Riesgos

**El cielo dirá «sin dato» al principio.** Con un día de historia, hoy no hay
semana que resumir. Es correcto y es lo mismo que hace el panel de música, pero
conviene que el rótulo lo diga en vez de dejar un hueco.

**Se rehará al llegar al pixel art.** El dibujo, no la lógica. Se dice aquí para
que nadie se sorprenda en el bloque siguiente.

**Un cielo que juzga.** Lluvia porque has fallado es un juicio, por suave que sea.
Se mitiga con los umbrales del punto 5 y con el rótulo, que dice el dato —«3 de 7
días cumplidos»— y no un adjetivo sobre ti.

## 10. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Con 6 de 7 días cumplidos, despejado
3. Con 3 de 7, algo nublado
4. Con 2 de 7, lluvia
5. Sin días evaluables, **sin dato**: no se inventa un tiempo
6. Una semana entera en pausa no da lluvia
7. El estado va acompañado de texto, no solo de un emoji

## 11. Fuera de alcance

- La estación del año
- Que el tiempo afecte a las plantas
- Animar la lluvia
