# La paleta categórica · diseño

**Fecha:** 2026-07-28
**Estado:** aprobado, listo para planificar
**Paso:** 1 de 7 de la ampliación de hábitos y tareas

---

## 1. Objetivo

Levantar **una sola paleta de colores categóricos** en `core/ui`, medida bajo
daltonismo, que compartan la identidad de hábito, las categorías de tarea, las
prioridades y las etiquetas de música.

Es el primer bloque porque los tres siguientes dependen de él: sin colores no
hay categorías ni prioridades que pintar.

## 2. Punto de partida

Hoy hay **dos paletas categóricas** y ninguna sabe de la otra:

| Dónde | Cuántos | Elegidos cómo |
|---|---:|---|
| Identidad de hábito (`ACENTOS_HABITO`) | 3 | Midiendo separación bajo daltonismo |
| Etiquetas de música (`TAG_COLORS`) | 7 | Midiendo contraste con la tinta |

Y una petición: **más opciones de color para los hábitos**.

### Lo que la medición dijo

Tres no era un límite de la ciencia, era un límite del inventario: solo había
seis pasteles entre los que elegir. Metiendo los trece disponibles —los seis del
sistema más los siete de música— y buscando por fuerza bruta el conjunto más
grande que pasa los tres umbrales, el máximo real es **ocho**.

Bajar el umbral no daría más: relajando el de visión normal de 20 a 15, el
máximo sigue siendo ocho. No hay nada que ganar aflojando, así que **los
umbrales no se tocan**.

## 3. La paleta

Ocho entradas. Siete se ofrecen como identidad de hábito; `acid` queda fuera de
esa lista por decisión estética del usuario —es el amarillo-verde que se retiró
de música— pero se conserva en la paleta por la razón del punto 4.

| Clave | Hex | Tinta encima |
|---|---|---:|
| `pink` | `#ff9ec7` | 5,43:1 |
| `lav` | `#c4b5fd` | 5,64:1 |
| `mint` | `#a7f0c8` | 7,90:1 |
| `peach` | `#ffd6a5` | 7,64:1 |
| `sky` | `#a5d8ff` | 6,87:1 |
| `amber` | `#f4b942` | 5,88:1 |
| `coral` | `#ff9980` | 5,01:1 |
| `acid` | `#d2ff3a` | 8,97:1 |

Separación de los siete de hábito, medida tras simular cada visión:

```
              normal   deutan   protan
peor par       29.6     10.1     12.2
peor pareja   lav~sky  lav~sky  mint~peach
umbral          20        9        9
```

**El `deutan` de 10,1 no mejora al añadir colores**: lo marca `lav~sky`, que ya
estaba antes. Sigue siendo el margen más justo del sistema.

## 4. Por qué ocho y no siete

Música guarda el color de cada etiqueta como una clave de texto en la base:
`acid`, `amber`, `coral`, `sky`, `violet`, `rose`, `mint`. Con ocho entradas
cada una encuentra sitio propio:

```
acid→acid    amber→amber   coral→coral   sky→sky
violet→lav   rose→pink     mint→mint     (peach queda libre)
```

Con siete, `acid` y `amber` colapsarían en el mismo color y **dos etiquetas
distintas del usuario se volverían indistinguibles**. Es un dato suyo, no una
preferencia nuestra.

## 5. Quién usa qué

| Consumidor | Colores |
|---|---|
| Identidad de hábito | los 7, sin `acid` |
| Categorías de tarea | los 8 |
| Etiquetas de música | los 8 |
| Prioridades de tarea | 4 fijos: `lav` urgente · `coral` alto · `amber` medio · `mint` bajo |

Las prioridades y las categorías **comparten juego a propósito**, por decisión
del usuario. Lo que las separa en pantalla no es el tono sino la forma y la
posición: la prioridad es un punto redondo a la izquierda del nombre, la
categoría un subrayado debajo. Es la misma regla que sostiene el resto del
sistema —nunca solo color— y por eso compartir es aceptable aquí.

## 6. Las claves de hábito se renombran

Las tres actuales son nombres heredados que ya no describen su color: `aqua` es
menta, `violet` es lavanda y `orange` es rosa. Añadir cuatro claves correctas al
lado dejaría la mitad del conjunto mintiendo.

Se renombran las siete a su color real y las tres viejas pasan al mapa `LEGACY`
que **ya existe** en `resolveHabitColor` para exactamente esto:

```
aqua → mint      violet → lav      orange → pink
```

Ninguna fila de la base cambia: se resuelve en lectura, igual que se resolvieron
en su día las claves de la era pixel.

## 7. Alcance de este paso

| Archivo | Qué |
|---|---|
| `src/modules/core/ui/paleta.ts` | **Nuevo.** Las ocho entradas y su tipo |
| `src/modules/core/ui/contraste.ts` | `ACENTOS_HABITO` de 3 a 7 |
| `src/modules/core/ui/tokens.css` | Los `--h-*` de 3 a 7, con nombres reales |
| `src/modules/habitos/lib/color.ts` | 7 claves, etiquetas y `LEGACY` ampliado |
| `src/modules/musica/lib/tags.ts` | Apunta a la paleta compartida |

**Fuera:** categorías, prioridades, filtros, anidación, adjuntos y todo lo de
hábitos. Este paso solo deja los colores listos.

## 8. Los tests cambian, y aquí sí toca

Tres afirmaciones de `color.test.ts` dejan de ser ciertas:

- Que `HABIT_COLORS` tiene exactamente tres, «que es el máximo distinguible». La
  medición dice que ya no: pasa a siete, y ese comentario se corrige.
- Que `resolveHabitColor("aqua")` devuelve `"aqua"`. Con el renombrado devuelve
  `"mint"`.
- Que `habitColorVar("aqua")` devuelve `var(--h-aqua)`. Esta además **no
  compilaría**: al renombrar, `"aqua"` deja de ser un `HabitColor` válido y
  TypeScript rechaza el argumento. Pasa a `habitColorVar("mint")` →
  `var(--h-mint)`.

Las tres son afirmaciones sobre nombres, no sobre comportamiento: lo que el
sistema hace —resolver una clave guardada al color que le toca— sigue siendo
exactamente lo mismo, y sigue estando cubierto.

Esto **no contradice** la regla que gobernó el rediseño visual. Allí un test en
rojo señalaba que un cambio de piel había tocado lógica. Aquí la lógica cambia a
propósito, y el test debe seguirla.

De `contraste.test.ts` cambia **una sola** afirmación, y esto es una corrección
sobre lo que decía antes este spec: sus tres pruebas de separación sí verifican
el conjunto nuevo por su cuenta —miden, no cuentan— pero hay una cuarta que
afirma que los acentos «son exactamente tres».

Lo importante de esa cuarta no es el número sino su comentario, que dice que
tres es «el máximo que pasa la separación bajo daltonismo». **Es falso**, y la
medición de este mismo spec lo desmiente: el límite estaba en el inventario. El
comentario se corrige, porque un test que afirma algo falso es peor que ninguno.

## 9. Qué no cambia

- Los umbrales de separación y el método de medición.
- La regla de que el pastel es fondo o borde, nunca texto.
- Los colores del armazón: rosa principal, peach destructivo, amarillo atención.
- Ninguna fila de la base de datos.

## 10. Riesgos

**El color de los hábitos existentes se mantiene, pero su nombre cambia.** Un
hábito guardado como `aqua` seguirá siendo menta; en el selector aparecerá como
«Menta». Es lo mismo que ya se ve, con la etiqueta correcta.

**Ocho colores es mucho más difícil de distinguir que tres**, aunque pasen el
umbral. La separación es la mínima aceptable, no cómoda: dos hábitos en `lav` y
`sky` serán parecidos para quien tenga deuteranopía. El umbral lo permite; la
comodidad es otra cosa.

**Los pasteles del sistema y los de música no eran el mismo conjunto.** `mint`
del sistema es `#a7f0c8` y el `mint` de música era `#62e8aa`. Al unificar, las
etiquetas de música que usen esas claves cambiarán ligeramente de tono. Son
cambios pequeños y todos siguen midiendo por encima de 4,5:1.

## 11. Criterios de aceptación

1. `npm run build`, `test`, `lint` y `tsc --noEmit` en verde
2. Una sola paleta categórica, consumida por hábitos y por música
3. Los hábitos ofrecen 7 colores y `contraste.test.ts` los verifica sin tocarse
4. Las claves viejas (`aqua`, `violet`, `orange`) siguen resolviendo
5. Ningún cambio en la base de datos
6. Los únicos tests modificados son las tres afirmaciones de `color.test.ts` y
   el recuento de `contraste.test.ts`, ambos del punto 8
7. Las tres pruebas de separación de `contraste.test.ts` pasan **sin tocarse**

## 12. Fuera de alcance

- Categorías, prioridades y filtros de tarea
- Anidación y cascada
- Detalle de tarea y adjuntos
- Las tres features de hábitos elegidas
- Cambiar los umbrales de daltonismo
