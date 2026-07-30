# ¿Escucho distinto los días que cumplo? · diseño

**Fecha:** 2026-07-30
**Estado:** aprobado, listo para planificar
**Paso:** 7 de 7 de la ampliación de hábitos y tareas

---

## 1. Objetivo

Responder a una pregunta: **¿escuchas más o menos música los días que cumples
todo lo que te toca?**

## 2. El dato que manda en el diseño

| | |
|---|---|
| Días con escuchas | **2.833**, de 2018-09-16 a 2026-07-29 |
| Días con registro de hábito | **1** |
| Solapamiento | **1 día** |

Con un día no se puede decir nada. Y con cinco tampoco.

**Así que la decisión central de este bloque no es qué calcular, es cuándo
NEGARSE a calcular.** Un panel que con dos días dijera «escuchas un 40% más
cuando cumples» estaría inventando, y sería peor que no tener panel.

## 3. Lo que se compara, y con qué estadística

Los días se parten en dos grupos:

- **Cumplidos**: los días en que hiciste *todo* lo programado. Misma definición
  que la racha global y que la misión «día completo», para no inventar un tercer
  criterio de lo mismo.
- **Fallados**: los días en que te tocaba algo y no lo cumpliste todo.

De cada grupo se saca la **mediana** de minutos escuchados.

### Mediana y no media

Con pocos días, un solo día raro —ocho horas de música de fondo trabajando—
arrastra la media y produce una diferencia que no existe. La mediana no se mueve
por un caso.

### El suelo: 10 días en cada grupo

Por debajo de eso el panel dice **cuántos faltan**, no un número. Diez no es una
cifra sagrada, es el punto en que una mediana empieza a no depender de un día
concreto; y decir «te faltan 8 días cumplidos» es información útil, mientras que
un porcentaje inventado no lo es.

### Lo que el panel NO va a decir

No va a decir que la música te ayuda a cumplir, ni al revés. **Esto es una
correlación sobre tus propios datos**, y con dos grupos de diez días no
distingue causa de casualidad. El texto dirá lo que mide —«los días que cumples
escuchas X minutos; los que no, Y»— y nada más.

## 4. Quién es el dueño de este cruce

Ninguno de los dos módulos.

`AGENTS.md` dice que a `core/` sube lo que un segundo módulo necesita de verdad.
Aquí no es que un módulo necesite algo del otro: es que **hay una pregunta que
no pertenece a ninguno**. Si viviera en hábitos, hábitos importaría música; si
viviera en música, al revés. Cualquiera de las dos ataría dos dominios que hoy no
se conocen.

La salida es que la parte calculable **no sepa de ninguno de los dos**:

```ts
// core/analisis/comparar-dias.ts
compararGrupos(
  valorPorDia: Map<number, number>,
  grupoA: Set<number>,
  grupoB: Set<number>,
  minimo = 10,
): Comparacion
```

No sabe qué es un hábito ni qué es una escucha. Recibe números por día y dos
conjuntos de días. **La composición la hace la página**, que es el único sitio
que legítimamente conoce las dos interfaces públicas.

## 5. Dónde se ve

En la portada, bajo la gráfica de cumplimiento. Es donde ya está la pregunta
«¿cómo voy?», y este panel es una respuesta más.

Con datos insuficientes se ve igual de intencionado: «Te faltan 8 días
cumplidos y 4 fallados para poder comparar». No un hueco vacío.

## 6. Alcance

| Archivo | Qué |
|---|---|
| `core/analisis/comparar-dias.ts` | **Nuevo.** `compararGrupos`, pura y sin dominio |
| `core/analisis/comparar-dias.test.ts` | **Nuevo.** |
| `habitos/lib/dias-cumplidos.ts` | **Nuevo.** Los dos conjuntos de días, desde hábitos |
| `habitos/lib/dias-cumplidos.test.ts` | **Nuevo.** |
| `musica/index.ts` | Expone los minutos por día si no lo hace ya |
| `app/page.tsx` | Compone las dos lecturas |
| `habitos/components/home/MusicaPanel.tsx` | **Nuevo.** Lo pinta |

**Fuera:** por artista, por género, por hora del día, y cualquier cruce con
tareas.

## 7. Qué no cambia

- Ninguna tabla, ninguna columna, ninguna migración.
- `streak.ts`, el XP, los escudos, las pausas.
- Los dos módulos siguen sin conocerse.

## 8. Riesgos

**El panel va a decir «faltan datos» durante semanas.** Es correcto y es lo que
se ha pedido, pero hay que decirlo en el propio panel para que no parezca roto.

**Un día en pausa no es ni cumplido ni fallado.** Sale de los dos conjuntos, igual
que sale del resto del sistema. Si no, una pausa larga contaría como una racha de
fallos y torcería la comparación entera.

**Los días sin nada programado tampoco cuentan.** Ni cumplidos ni fallados: no
había nada que cumplir.

**La correlación se leerá como causa.** Es inevitable en cuanto se pinta un
número, y por eso el texto tiene que ser literal sobre lo que mide. Sin flechas,
sin «mejor» ni «peor», sin consejos.

## 9. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Con menos de 10 días en un grupo, el panel dice cuántos faltan
3. Con datos suficientes, muestra las dos medianas y cuántos días tiene cada grupo
4. Los días en pausa no entran en ninguno de los dos grupos
5. Los días sin nada programado no entran en ninguno de los dos grupos
6. `compararGrupos` no importa nada de `habitos` ni de `musica`
7. `habitos` no importa `musica`, ni al revés
8. El texto no afirma causalidad

## 10. Fuera de alcance

- Cruces por artista, género u hora
- Cruces con tareas
- Cualquier gráfica: este panel son dos números y una frase
