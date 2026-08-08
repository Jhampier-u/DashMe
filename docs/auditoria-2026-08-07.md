# Auditoría del dashboard y estudio del sector

Fecha: 7-8 de agosto de 2026 · Secciones auditadas: inicio, hábitos, jardín,
tareas y proyectos. Música queda fuera por decisión del usuario.

**Estado: COMPLETO.** Auditoría cerrada y las cinco líneas de investigación
devueltas.

**Nada de esto se ha corregido.** Es un informe, por decisión del usuario.

---

# Parte A · Auditoría de código

## Cómo se hizo, y por qué importa decirlo

Casi todo este código lo escribí yo, así que auditarlo es auditarme. Para no
apoyarme en lo que creo recordar, cada hallazgo está **medido** contra una base
de datos real —`createTestDb`— y no solo leído. Esa disciplina ya se ganó su
sitio en esta misma sesión: mi primera hipótesis sobre el hallazgo 1 era falsa, y
solo medir lo demostró.

Sesgo conocido y no resuelto: **verifico el DOM pero no veo la pantalla**. Tres
fallos de esta sesión —las plantas flotando en el cielo, el encuadre del cielo y
un byte nulo en un archivo fuente— se me escaparon por eso y los encontró el
usuario mirando. Esta auditoría comparte esa ceguera.

---

## Hallazgo 1 · «Hecho hoy» y «cuenta para la racha» son cosas distintas

**Gravedad: alta. Latente.** · `habits.ts:166` y `habits.ts:138`

`doneToday` es `!!todayLog`: basta con que exista un registro. Pero `doneKeys`
pasa por `diasQueCuentan`, que con un objetivo exige `count >= targetCount`. De
`doneKeys` salen la racha, el día crítico y `last30`.

El mismo objeto se contradice. Medido con un hábito de objetivo 8 y 2 apuntados:

| Campo | Valor |
|---|---|
| `doneToday` | `true` |
| `last30[0]` (hoy) | `false` |
| `streak` | `0` |
| Pendientes en la portada | `0` |

Con dos vasos de ocho la aplicación dice que está hecho, lo quita de pendientes y
la planta se queda en semilla para siempre, porque la racha nunca sube.

## Hallazgo 2 · Dos definiciones de «día cumplido» conviviendo

**Gravedad: alta. Latente.** · Misma raíz que el 1, mayor alcance.

| Camino | ¿Respeta `targetCount`? |
|---|---|
| Racha del hábito, `last30`, planta | Sí (`diasQueCuentan`) |
| Racha global de la portada (`home.ts:105`) | **No** |
| Clima del jardín (`dias-cumplidos.ts`) | **No** |
| Misión «día perfecto» (`quests.ts:181`) | **No** |

Medido con objetivo 8 y 2 apuntados durante tres días seguidos:

```
racha global (portada) = 3     ← «tres días cumpliendo TODO lo programado»
racha del hábito       = 0
días cumplidos (clima) = 3     → cielo despejado
```

`cantidad.ts` existe precisamente para centralizar esta regla. Su comentario
dice que había cinco copias y que el síntoma sería «la misma racha saliendo
distinta sin dar error». **Tres caminos no pasan por ella, y ese síntoma es
exactamente lo que se acaba de medir.**

**Por qué no te afecta hoy:** ninguno de los tres hábitos existentes tiene
objetivo, así que esa rama no se ejecuta. La funcionalidad entera de «hábitos con
cantidad» no es de fiar en el momento en que se use.

## Hallazgo 3 · La prioridad de una tarea no hace nada

**Gravedad: media. Activa.** · `tasks.ts:136` y `tasks.ts:262`

Las dos consultas ordenan por `asc(tasks.order), asc(tasks.createdAt)`. **No hay
un solo sitio, ni en consulta ni en interfaz, que ordene por prioridad.** Marcar
una tarea como `URGENT` cambia su color y su etiqueta, y nada más: sigue donde
estaba. Se puede filtrar por prioridad, pero no priorizar.

*Nota para el veredicto: la evidencia del sector complica esto. Bellotti et al.
(CHI 2004) concluyen que «people are not poor at prioritizing», y Zhu et al.
(2018) documentan que cualquier señal de urgencia secuestra la decisión por
encima de la importancia. Que ordenar por prioridad sea la solución obvia no
significa que sea la correcta. Se decide en la parte C.*

## Hallazgo 4 · Dos políticas opuestas para las tareas huérfanas

**Gravedad: media. Latente.** · `tasks.ts:171` contra `tasks.ts:44-64`

`buildTaskTree` documenta explícitamente que un hijo cuyo padre no está debe
salir como raíz, porque «perderlo en silencio sería peor», y así lo hace.

`getTasksGrouped`, en el mismo archivo, hace `if (t.parentId) continue` sin
comprobar si ese padre existe. Una tarea huérfana **desaparece del tablero** de
`/tareas` mientras sigue apareciendo en el árbol.

Dos funciones del mismo archivo con políticas opuestas ante el mismo caso límite.
La base migrada no tiene foránea en `parent_id` —está documentado en
`migrar.ts`— así que el caso es alcanzable.

---

# Parte B · Estudio del sector

*Tres de cinco líneas. Cada afirmación lleva fuente; lo que no se pudo verificar
va marcado como tal.*

## B.1 · Lo que de verdad funciona, según la evidencia

**Intenciones de implementación — el hallazgo más sólido de todo el estudio.**
Gollwitzer & Sheeran (2006), metaanálisis de 94 tests y más de 8.000
participantes: formular «si ocurre X, entonces haré Y» produce **d = 0,65** sobre
la consecución de objetivos. Lo que funciona es **vincular la acción a un momento
y un lugar concretos**, no la lista.

**CORRECCIÓN IMPORTANTE.** Ese 0,65 mezcla dominios muy heterogéneos, muchos de
laboratorio. Al aislar salud y actividad física el efecto se desploma: da Silva et
al. (2018), 13 ECAs, da **d=0,15 y NO significativo**; solo llega a 0,25 con
refuerzo activo. Y Wang et al. (2021), N=15.907, detecta sesgo de publicación
(Egger p<0,01) que corrige g=0,336 a **0,242**. El tamaño realista en conductas de
salud es **d entre 0,15 y 0,25: pequeño**. Sigue siendo de lo mejor respaldado del
campo, lo que dice más del campo que del efecto.

→ *Este dashboard ya tiene el campo `intention` («Cuando X, entonces Y»).* Vale la
pena conservarlo, pero sin prometer lo que no da.

**Monitorizar el progreso.** Harkin et al. (2016), *Psychological Bulletin*, 138
ensayos, N=19.951: **d = 0,40**. Real y modesto. Moderador decisivo: el efecto es
mayor cuando el resultado **se registra físicamente**. Lo que sirve es el acto de
registrar, no contemplar el gráfico.

**Hacer un plan libera la cabeza.** Masicampo & Baumeister (2011): las metas sin
cumplir producen pensamientos intrusivos, y **formular un plan concreto elimina
esa interferencia sin haber completado la tarea**.

**Subobjetivos próximos.** Bandura & Schunk (1981): los subobjetivos cercanos
producen progreso y autoeficacia; los objetivos lejanos, efectos mínimos.

**Descomponer mejora la estimación.** Kruger & Evans (2003): enumerar los
subcomponentes reduce la falacia de planificación. Ojo al matiz: mejora la
**estimación**, no la ejecución.

## B.2 · Lo que NO tiene el respaldo que se le atribuye

- **«Eat the frog»**: su fundamento —el autocontrol como depósito que se agota—
  está desacreditado. Hagger et al. (2016), replicación en 23 laboratorios con
  2.141 participantes: **d = 0,04, con el cero dentro del intervalo**.
- **PARA, MITs, regla 1-3-5, Ivy Lee, matriz de Eisenhower**: ningún estudio
  revisado por pares que los evalúe. Son propuestas de autores.
- **GTD**: existe un análisis académico (Heylighen & Vidal, 2008) pero es una
  justificación teórica *post-hoc*, no un ensayo empírico.
- **Time-blocking**: el dato que todo el mundo cita (HBR 2018) es una encuesta de
  opinión sobre trucos, no un estudio de resultados. El respaldo real del
  time-blocking viene de Gollwitzer, no de ahí.
- **Sobrecarga de opciones**: mucho más disputada de lo que se cree. El
  metaanálisis de Scheibehenne et al. (2010), 50 estudios y N=5.036, da un
  **efecto medio cercano a cero**. Lo que sí está bien establecido es *feature
  fatigue* (Thompson et al., 2005, 704 citas): la gente **compra** la app con más
  funciones y **usa** la que menos estorba.

## B.3 · Lo que puede hacer daño

**Medir reduce el disfrute.** Etkin (2016), *Journal of Consumer Research*, seis
experimentos: medir una actividad aumenta cuánto la haces **y reduce cuánto la
disfrutas**, porque «se parece más a trabajo». Aparece **sin recompensa externa**:
medir por sí solo ya opera como una.

→ *Apunta directo a los pájaros por la música del bloque F.*

**Rumiación.** Eikey et al. (2021): interactuar con los propios datos puede
producir «cognición ansiosa y perseverante centrada en lo negativo de uno mismo».
Los autores insisten en que **reflexión y rumiación no son lo mismo**, y que estas
herramientas producen la segunda creyendo fomentar la primera.

**Ortosomnia.** Baron et al. (2017) y Jahrami et al. (2024, n=523): del 3 % al
14 % de prevalencia según criterio. Gente que empeora su sueño persiguiendo la
métrica, algunos sin creerse una polisomnografía normal.

**Retroalimentación desmotivadora.** Attig & Franke (2019) documentan que el
propio medidor genera estrés y desmotivación.

**Nota honesta sobre las rachas:** buscando específicamente el efecto aislado de
la mecánica de rachas, **no se encontró ningún estudio que lo mida**. Solo quejas
recurrentes y apps que se posicionan contra ellas. La evidencia es débil y no se
va a presentar como si no lo fuera.

## B.4 · Por qué la gente abandona

**Revisión sistemática JMIR** (Kidman et al., dic 2024, 18 estudios, **525.824
participantes**): mediana de abandono **~70 % en los primeros 100 días**, con
patrón de acantilado seguido de meseta. Taxonomía de 22 razones en 6 categorías,
una de ellas **la carga de introducción manual de datos**.

Encuesta directa (Healthcare, 2022, n=209):

| Motivo | % |
|---|---|
| Motivación decreciente | **31,6 %** |
| Descargar apps hasta encontrar la adecuada | **21,5 %** |
| Faltan funciones | 18,7 % |
| No es divertida | 10 % |
| Difícil de usar | 8,6 % |

**La motivación decreciente es la causa número uno desde 2014 y ninguna app la ha
resuelto.**

**El punto de fallo de GTD está identificado con precisión: la revisión
semanal.** El patrón general, y es el que más importa aquí: **el coste de
mantener el sistema crece con su tamaño, y su beneficio no.** Hay un punto de
cruce, y ahí se abandona.

Retención de la categoría productividad: **D1 ~17-30 %, D30 ~4-8 %** según
fuente. Está en el tercio bajo del mercado.

## B.5 · Cuántos datos hacen falta para afirmar algo

Cálculos de potencia para una correlación de Pearson (α=0,05, potencia 0,80):

| Correlación real | Observaciones |
|---|---|
| r = 0,20 | **194** |
| r = 0,30 | **85** |
| r = 0,50 | 29 |

Y comparaciones múltiples: **20 pares probados dan un 64 % de probabilidad de al
menos un falso positivo**. Un dashboard con 10 métricas genera 45 pares; con 15,
105. Encontrará correlaciones «significativas» aunque los datos sean ruido.

Añádase la **autocorrelación**: 365 días con ρ=0,7 equivalen a unas 125
observaciones independientes.

→ *Nuestro `MINIMO_POR_GRUPO = 10` evita el disparate pero no da potencia para
concluir nada. Aun así es más de lo que hace Exist.io, la referencia del sector,
que recomienda conectar «tantos servicios como puedas» sin un solo aviso
estadístico.*

## B.6 · Señales del mercado que sí son informativas

- **El modelo de una sola fecha está roto, y lo dicen los productos**: OmniFocus
  4.7 añadió fechas «Planned» y Todoist añadió «Deadlines» como campo distinto
  del vencimiento. Su ausencia es queja crónica en los demás.
- **El circuito documentado de las fechas falsas**: la app solo da relevancia a
  lo que tiene fecha → el usuario pone fechas inventadas para que aparezca → se
  incumplen sin consecuencia → se acumula el montón de vencidas → «vencido» deja
  de significar nada.
- **Linear** vale 1.250 M USD, es rentable y crece al +280 % con ~80 personas,
  con tres primitivas y una política explícita de no añadir opciones. Es el
  argumento comercial más caro jamás pagado a favor de quitar cosas.
- **Amazing Marvin** declara «300+ ajustes» y se vende para TDAH. Su propuesta de
  valor y su fallo de producto son literalmente la misma característica.
- **Riesgo de continuidad**: Bending Spoons compra apps estancadas, recorta
  equipo y sube precios —Evernote pasó de 69,99 a 129,99 USD/año y sus descargas
  cayeron un 64 %—. Salió a bolsa en julio de 2026 con 1.680 M USD para repetirlo.
  *Un dashboard propio y local es inmune a esto por construcción.*

## B.7 · Lo que no se pudo verificar

- **Reddit fue inaccesible** en las dos líneas que lo necesitaban. Era fuente
  principal para migración, prioridades y ansiedad por vencidos.
- **El tamaño del mercado de apps de hábitos no está medido**: las estimaciones
  varían **11 veces** entre consultoras para el mismo año y ninguna publica
  metodología. No se usará para sostener ninguna recomendación.
- Precios de TickTick y Motion, cifras de Doist, y el efecto aislado de las
  rachas: sin verificar.

---

## B.8 · Habitica, el espejo más cercano

Es el competidor que más se parece a lo que hay aquí: gamificación con castigo.
5 M+ descargas, 4,7 en Play y 4,2 en App Store, releases cada pocos días. Vivo y
grande. Lo que le falla importa mucho más que lo que le funciona.

**El castigo produce evitación, y la evitación produce más castigo.** Es el bucle
mejor documentado de todo el estudio, en sus propias reseñas:

> «I crashed out from the penalties when having a tough time and ended up
> uninstalling it for almost 3 years.» (4★, 15-jul-2026)

> «It would probably be awesome if I could remember to use it» — usuaria con TDAH
> que **evita la app cuando se atrasa**. (5★, 25-sep-2025)

> «Not for the ill or disabled» — el sistema de penalización castiga fallos
> causados por la propia enfermedad. (3★, 11-dic-2025)

**Habitica tiene una página de wiki oficial titulada «Burnout»**, promocionada por
su propio equipo, que reconoce cuatro disparadores: el juego se vuelve demasiado
difícil, demasiado fácil, tedioso, o cambia la vida del jugador. «En el peor
caso, el Burnout resulta en que el jugador abandona Habitica.»

Y su remedio recomendado es, en esencia, **bajar las expectativas hasta que el
juego deje de castigarte**: reducir días por semana, convertir tareas diarias en
hábitos sueltos, o usar un script comunitario llamado **«Bad Day Mode»** que te
cura del todo y te hace inmune al daño ese día.

**Ese script existe porque el producto no trae la válvula de escape.** Es el dato
más útil para nosotros.

**La queja contraria también existe**, y es igual de reveladora:

> «there was no consequence for losing health by not completing tasks, I didn't
> feel like I was accomplishing anything» (2★, 24-mar-2026)

No hay término medio configurable: o castiga demasiado o no significa nada.

**Otros dos hallazgos que valen para el veredicto:**

- **El TDAH es su caso de uso dominante** —unas 12 menciones explícitas en 150
  reseñas— y es exactamente el perfil al que su mecánica de castigo hace más
  daño. Vende a quien peor tolera lo que vende.
- **Quitar las Guilds y la Taberna (ago-2023) es el evento singular más citado
  como causa de abandono**, y seguía apareciendo en reseñas en febrero de 2026.
  Lo que retenía a los veteranos no era el juego, era la gente.

## B.9 · La industria se está moviendo hacia rachas indulgentes, y hay datos

Es el hallazgo con más peso para el jardín, y no es opinión:

- **Duolingo midió que dar MÁS red de seguridad sube el uso.** Duplicar los
  *streak freezes* disponibles aumentó los aprendices activos diarios un **+0,38 %**.
  Y una racha de 7 días multiplica por **3,6** la probabilidad de terminar el
  curso. La racha funciona; **aflojarla funciona mejor**.
- **Apple añadió pausar los anillos hasta 90 días sin romper la racha** en
  watchOS 11 (2024), después de nueve años de rachas rígidas. Lo hizo el actor
  con más datos de comportamiento del mundo.
- **Aloe Bud**: 4,78★ con 6.881 valoraciones, y su descripción dice literalmente
  que trae la atención a las actividades del día *«using encouraging push
  notifications, rather than guilt or shame»*. Es la implementación pura del
  anti-castigo y le va bien.
- **Finch**: **4,95★ con 736.728 valoraciones**. Es el gigante de la categoría.
  Una mascota virtual que crece con tu autocuidado, explícitamente anti-culpa.

**Finch es nuestro jardín sin el castigo.** Misma idea —una criatura que crece
con lo que haces— y es la app mejor valorada de toda la categoría. La diferencia
es que a Finch no se le muere nada cuando fallas.

La queja simétrica en Grit (4,79★, 15.261 valoraciones) describe justo lo que
queremos evitar: *«sientes presión por completarlo todo. Al día siguiente, si no
completaste algo, te añade un menos y es como si tuvieras que ganártelo otra
vez»*.

## B.10 · Perder el historial mata la aplicación al instante

Aparece en tres apps distintas, y una cita lo explica mejor que ningún análisis:

> «el apoyo emocional que me daba desplazarme por el historial de mi autocuidado»
> — usuaria de Aloe Bud que perdió cuatro años de datos

En Onrise: *«Me borró los hábitos DOS VECES»*. **El valor emocional acumulado
ES el producto.**

→ *Aquí este proyecto está estructuralmente bien: base local, sin nube que
cancelar, sin empresa que te suba el precio, y desde el bloque C el pasado se
puede recorrer día a día. Es una ventaja real y conviene no romperla nunca.*

## B.11 · Las dos quejas funcionales universales

**Recordatorios que no llegan** y **ausencia de widget**. Fallan en HabitShare,
Aloe Bud y Onrise a la vez. Un tracker que no aparece en la pantalla de inicio y
no avisa, no se usa.

→ *Este dashboard no tiene ninguna de las dos cosas: ni notificaciones ni widget.
Vive en una pestaña del navegador que hay que abrir a propósito.*

## B.12 · El hallazgo que lo reordena todo

**Fallar un día NO daña la formación del hábito.** Es de Lally et al. (2010), el
mismo estudio del que sale el famoso «66 días», citado literalmente por sus
autores:

> «Missing the occasional opportunity to perform the behaviour did not seriously
> impair the habit formation process: automaticity gains soon resumed after one
> missed performance.»

La automaticidad retomó su curva. **El daño de fallar no es mecánico: es
atribucional.** Viene de cómo la persona interpreta el fallo.

Y sobre eso hay **tres literaturas independientes que convergen**, lo que es
mucho más fuerte que un solo hallazgo:

- **Contrarregulación** (Herman y Polivy, desde 1975): quien hace dieta y *cree*
  haber roto su límite come más después, aunque la ruptura real fuera mínima. **La
  creencia del fallo, no el fallo.**
- **Efecto «qué más da»** (Cochran y Tesser, 1996): percibido el fallo, se
  abandona la autorregulación entera en vez de moderar el daño.
- **Abstinence Violation Effect** (Marlatt y Gordon, 1985): tras un desliz, la
  persona genera atribuciones **internas, estables y globales** —«soy débil,
  siempre fallo»— y **esa atribución, no el desliz, predice la recaída completa**.

**Y sobre rachas en concreto**, Silverman y Barasch (2022), *Journal of Consumer
Research*, 7 experimentos —la única referencia empírica seria que existe—:

1. Una racha **mostrada como intacta** aumenta el compromiso frente a una mostrada
   como rota, **controlando el comportamiento real**. Es un efecto de
   REPRESENTACIÓN: importa lo que el registro enseña, no lo que hiciste.
2. La gente trata mantener la racha como **una meta en sí misma**, desplazada de
   la meta original. La métrica sustituye al objetivo.
3. La caída tras romperla es **mayor cuando uno se culpa a sí mismo**.
4. La caída **se atenúa cuando existe una vía de reparación**.

Nótese la correspondencia: el moderador de autoculpa que encuentran en 2022 **es
el AVE de Marlatt y Gordon de 1985**, replicado en un dominio comercial cuarenta
años después.

**La conclusión es incómoda y hay que decirla entera: un fallo objetivamente
inocuo, representado como catástrofe, fabrica el mecanismo atribucional que la
investigación sobre recaída identifica como el predictor real del abandono. Buena
parte de la mecánica estándar de estas apps produce el problema que dice
resolver.**

## B.13 · La gamificación aporta menos de lo que parece

- **Nishi et al. (2024)**, *eClinicalMedicine* (Lancet), 36 ECAs, **N=10.079**, el
  único que compara apps CON gamificación frente a apps SIN ella: **+489 pasos al
  día, calificado de «trivial»**, y **nulo** en actividad moderada-vigorosa,
  lípidos, tensión, glucemia y dieta.
- **Mazeas et al. (2022)**, 16 ECAs: frente a control inactivo g=0,58; **frente a
  una intervención activa no gamificada, g=0,23**. Y a las 14 semanas, **0,15**.
- **Kim y Castelli (2021)**, decaimiento temporal: intervenciones de días d=1,57;
  de semanas d=0,39; **de años d=−0,20. Negativo.**
- **Revisión de 87 papers sobre efectos indeseados**: insignias, tablas de
  clasificación y puntos son **los elementos más asociados a efectos negativos**.
  Dato colateral: en el grupo focal, **los desarrolladores desconocían la mayoría
  de esos efectos**.
- **Sobrejustificación** (Deci et al., 1999, 128 estudios): el daño aparece cuando
  la recompensa es **esperada, tangible y contingente** —d entre −0,28 y −0,40—.
  Las **inesperadas o puramente informativas no socavan**.

Puntos, niveles e insignias son exactamente recompensas esperadas, tangibles y
contingentes: la combinación peor.

## B.14 · Las dos piezas de evidencia más fuertes de todo el estudio

Llegaron al final y reordenan dos recomendaciones.

### Premiar la VUELTA tras fallar ganó entre 54 intervenciones

**Milkman et al. (2021), *Nature*, 8 dic 2021.** Megaestudio: **61.293 personas, 54
intervenciones de cuatro semanas, 30 científicos de 15 universidades**. Del
abstract:

> «45 % de estas intervenciones aumentaron significativamente las visitas
> semanales al gimnasio entre un 9 % y un 27 %; **la intervención con mejor
> rendimiento ofrecía micro-recompensas por volver al gimnasio después de una
> sesión perdida**.»

**La ganadora entre cincuenta y cuatro fue exactamente lo contrario de la lógica
de racha: premiar volver después de fallar.** No «no castigar»: *premiar el
regreso*.

Del mismo estudio, el jarro de agua fría: **solo el 8 % de las intervenciones
produjo un cambio significativo y medible una vez terminada**.

### Los recordatorios ESTORBAN; las señales de contexto funcionan; nadie las implementa

**Stawarz, Cox y Blandford, CHI 2015.** Estudio de cuatro semanas **más una
revisión funcional de 115 apps de hábitos**. Del abstract, literal:

> «apoyarse en recordatorios favoreció la repetición pero **dificultó el
> desarrollo del hábito**, mientras que el uso de señales basadas en eventos
> aumentó la automaticidad; **el refuerzo positivo fue inefectivo**. La revisión
> funcional reveló que las apps existentes se centran en el autoseguimiento y los
> recordatorios, y **no soportan señales basadas en eventos**.»

Tres hallazgos en una frase: los recordatorios **estorban** al automatismo, el
refuerzo positivo **no sirve**, y **ninguna de las 115 apps revisadas
implementaba lo único que sí funciona**.

### Y el 100 % de los usuarios de Habitica sufre efectos contraproducentes

**Diefenbach y Müssig (2019)**, *International Journal of Human-Computer Studies*,
45 usuarios durante dos semanas: **todos los participantes** experimentaron
efectos contraproducentes, entre ellos «ser castigado por Habitica justo en
épocas especialmente productivas» y **reetiquetar tareas para esquivar el
castigo**. El sistema punitivo produce evasión, no cumplimiento.

---

# Parte C · Veredicto

## C.1 · El diagnóstico en una frase

**Este proyecto tiene una base honesta poco común y una mecánica central que la
evidencia desaconseja.** Lo raro es que las válvulas de escape que le faltan a
todo el sector ya están construidas aquí; lo que falta es dejar de castigar.

## C.2 · Lo que ya está bien, y no por casualidad

Estas decisiones se tomaron antes de leer nada de esto y la evidencia las respalda:

| Lo que hay | Qué lo respalda |
|---|---|
| **Pausas** — un día en pausa no cuenta como fallo, ni para racha ni para clima | Apple añadió exactamente esto en watchOS 11 (2024) tras nueve años de rachas rígidas |
| **Escudos** | Duolingo midió que **duplicar los freezes subió los activos diarios un +0,38 %**. Aflojar mejora los números |
| **Modo mínimo** (parcial) | Es una vía de reparación, el moderador que **atenúa** la caída en Silverman y Barasch |
| **Negarse a afirmar sin datos** (`MINIMO_POR_GRUPO`) | Exist.io, la referencia del sector, no pone un solo aviso estadístico y su página de correlaciones da 404 |
| **Base local, sin empresa detrás** | Bending Spoons compra apps estancadas y sube precios: Evernote pasó de 69,99 a 129,99 USD/año |
| **La memoria del jardín (bloque C)** | «Perder el historial mata la app»: el valor emocional acumulado ES el producto |
| **El campo `intention`** | Intenciones de implementación: pequeño, pero de lo mejor que hay |
| **Nunca una sola señal** | Regla de accesibilidad propia, aplicada en todo el rediseño |

**Lo que la industria tuvo que parchear por fuera, aquí viene de serie.** La
comunidad de Habitica escribió un script llamado «Bad Day Mode» porque el producto
no traía la válvula. Aquí las pausas y los escudos son parte del modelo de datos.

## C.3 · El problema central: la planta marchita

`isPlantWilted(streak, doneToday, hasEverBeenDone)` marchita la planta cuando la
racha llega a cero. Y `computeStreak` pone la racha a cero al primer día
programado y fallado.

Eso es, exactamente, **representar como catástrofe un fallo que la evidencia dice
que es inocuo**. Es la cadena completa de B.12 implementada sin querer.

Y desde el bloque C hay un agravante que introduje yo: **la memoria permite
recorrer el pasado y ver las plantas marchitas de cada día fallado**. Eikey et al.
(2021) llaman a eso **rumiación** —«cognición ansiosa y perseverante centrada en
lo negativo de uno mismo»— y advierten de que estas herramientas la producen
creyendo fomentar reflexión.

**Contrapeso honesto, porque existe:** en las reseñas de Habitica también aparece
la queja simétrica —«no había consecuencia, no sentía que lograra nada»—. Quitar
toda consecuencia tiene su propio modo de fallo. La respuesta no es eliminar la
señal, es cambiar a qué se refiere.

## C.4 · Propuestas, en orden de importancia

### 1. Arreglar los cuatro hallazgos de la parte A

Antes que cualquier feature. Los hallazgos 1 y 2 hacen que «hábitos con cantidad»
no sea de fiar; el 3 y el 4 son incoherencias que ya están en producción.

### 2. Que la racha no vuelva a cero por un día

**La propuesta con más respaldo de todo el informe.** Opciones, de menos a más:

- **Racha con un fallo de gracia**: un día fallado no la rompe; dos seguidos sí.
  Barato, y ataca directamente el efecto «qué más da».
- **Enseñar «X de los últimos 30 días»** junto a la racha, o en vez de ella. Es
  una métrica que un mal día no destruye, y `last30` ya está calculado.
- **Reparación explícita**: gastar un escudo *después* de fallar, no antes. Es el
  moderador que Silverman y Barasch miden como amortiguador.

### 3. La planta no debería morir por un día

Que refleje **la tendencia** —los últimos 30 días— y no el estado binario de ayer.
Una planta que se marchita despacio tras una semana mala dice la verdad; una que
se marchita al primer fallo miente sobre lo que ese fallo significa.

**Finch tiene 4,95 estrellas con 736.728 valoraciones siendo exactamente esto: una
criatura que crece con lo que haces y no muere cuando fallas.**

### 4. Reconsiderar los pájaros de la música

Etkin (2016), seis experimentos: medir una actividad placentera **reduce su
disfrute** y la convierte en algo «que se parece más a trabajo». La música
probablemente sea lo único del dashboard que no se pide como deber. Sugerencia:
que los pájaros no dependan de *cuánta* música, sino de que hubo música —presencia
en vez de cantidad, sin escalón que superar—.

### 5. Dejar la prioridad como está, o quitarla

El hallazgo 3 decía que no ordena nada. **La corrección obvia —ordenar por
prioridad— probablemente sea un error**: Bellotti et al. (CHI 2004) concluyen que
«people are not poor at prioritizing», y Zhu et al. (2018) demuestran que la
urgencia secuestra la decisión por encima de la importancia, violando el principio
de dominancia. Ordenar por urgencia sería **automatizar un sesgo documentado**.
Mejor: que siga siendo una etiqueta para filtrar, y decirlo en la interfaz para
que nadie espere otra cosa.

### 6. Lo que NO recomiendo construir

- **Más gamificación.** Frente a una app ya digital, la gamificación aporta
  «trivial» (Nishi, N=10.079) y decae a **negativo** en años.
- **Puntos, insignias y clasificaciones nuevas.** Son los elementos con más
  efectos negativos documentados en 87 papers.
- **Un motor de correlaciones entre dominios.** Con 20 pares hay un 64 % de
  probabilidad de un falso positivo, y hacen falta ~85 días para un efecto
  moderado. Sería fabricar hallazgos.
- **Fechas de vencimiento obligatorias.** El circuito está documentado: fechas
  inventadas, incumplidas sin consecuencia, montón de vencidas, y «vencido» deja
  de significar nada. Que no las haya hoy es una ventaja, no una carencia.

## C.5 · Lo que este proyecto no puede resolver, y conviene saberlo

- **La motivación decreciente es la causa número uno de abandono (31,6 %) y nadie
  la ha resuelto desde 2014.** Ninguna feature de esta lista la arregla.
- **Lo que retenía a los veteranos de Habitica era la gente, no el juego.** En un
  dashboard de una sola persona eso no se puede replicar, y fingir que sí sería
  deshonesto.
- **Sin notificaciones ni widget**, esto vive en una pestaña que hay que abrir a
  propósito. Es la queja funcional universal del sector. Es una decisión legítima
  —menos interrupciones— pero tiene un coste conocido.
- **Registrar cuesta.** «El coste de registrar supera el beneficio» es el motivo
  literal por el que la gente deja estas herramientas. Cada campo nuevo en el flujo
  diario juega en contra.

## C.6 · La pregunta de fondo

Harkin et al. (2016), 138 ensayos, N=19.951, dan **d=0,40** a monitorizar el
progreso, con un moderador decisivo: **el efecto es mayor cuando el resultado se
registra**. Lo que funciona es el **acto de marcar el hábito**. El jardín, las
plantas, el clima y la fauna son adorno alrededor de eso.

Eso no es un argumento para quitarlos: el adorno es lo que hace que quieras abrir
la pantalla, y este dashboard es tuyo y puede ser bonito porque sí. Es un
argumento para que **el adorno nunca estorbe al gesto de marcar, y sobre todo para
que nunca castigue por no haberlo hecho.**



# Adenda al veredicto

## D.1 · Corrección a lo que escribí en C.5

En C.5 puse la ausencia de notificaciones y widget como un coste conocido. **Es
media verdad y hay que corregirla.**

El widget sí es una carencia real: es la queja funcional del sector y reduce la
fricción de registrar, que es el gesto que la evidencia respalda.

**Los recordatorios son otra cosa.** Stawarz et al. midieron que apoyarse en ellos
**dificulta** la formación del hábito. Que este dashboard no dé la lata **no es un
coste: es lo que la evidencia recomienda**. Si algún día se añaden notificaciones,
conviene saber que se estaría añadiendo lo que un experimento controlado señala
como contraproducente.

## D.2 · La ventaja que nadie del sector tiene, y aquí ya está construida

Lo que Stawarz et al. encontraron que funciona son las **señales basadas en
eventos**: anclar la conducta a algo que ya ocurre, no a una hora del reloj.
Revisaron 115 apps y **ninguna lo soportaba**.

**El campo `intention` de cada hábito —«Cuando X, entonces Y»— es exactamente
eso.** Está construido, es un campo de texto libre y hoy no hace nada más que
mostrarse.

Es, con diferencia, **la mayor oportunidad del proyecto**: no construir algo
nuevo, sino darle peso a lo que ya está. Sugerencias concretas, de menor a mayor
esfuerzo:

- Enseñar la intención **junto al botón de marcar**, no escondida en el detalle.
  Es la señal, y debería estar donde ocurre el gesto.
- Pedirla al **crear** un hábito, con ejemplos anclados a eventos («cuando me
  siente a desayunar», «al cerrar el portátil») en vez de a horas.
- Marcar en la pantalla los hábitos **sin intención** como algo que le falta algo,
  igual que hoy se marca lo que no está regado.

## D.3 · La propuesta 2 y 3 del veredicto, reforzadas y corregidas

El megaestudio de Milkman va más lejos de lo que yo proponía. Yo decía «que la
racha no vuelva a cero» y «que la planta no muera por un día» — ambas son
*ausencia de castigo*. La evidencia dice que lo que mejor funcionó fue **premiar
activamente el regreso**.

Traducido a este jardín, y en orden de fuerza de la evidencia:

1. **Que volver tras fallar dé algo.** Un brote nuevo, un destello, XP extra la
   primera vez que riegas tras una ausencia. Es la mecánica ganadora entre 54,
   medida sobre 61.293 personas, y aquí no cuesta casi nada: ya hay XP, sprites y
   partículas.
2. **Que la racha no muera de un golpe** (fallo de gracia, o «X de los últimos
   30»).
3. **Que la planta refleje la tendencia** y no el estado binario de ayer.

En ese orden. La primera es la que tiene el respaldo más fuerte y es la que menos
código toca.

## D.4 · Expectativas, para no engañarnos

Del mismo megaestudio: **solo el 8 % de 54 intervenciones produjo un cambio
significativo y medible una vez terminada la intervención.** Y la retención a 30
días de las apps de salud mental es del **3,3 %** (Baumel et al., 2019, 93 apps).

Nada de lo propuesto aquí va a cambiar eso. Lo que sí puede hacer este proyecto
—y es una ventaja real que ninguna app del mercado tiene— es que **no hay nadie a
quien retener**. No hay churn que optimizar, ni suscripción que renovar, ni
métrica de engagement que defender ante nadie. Eso permite tomar decisiones que
un producto comercial no puede permitirse: no dar la lata, no castigar, y
negarse a afirmar cuando no hay datos.

**Ese es, al final, el argumento más fuerte a favor de este proyecto.** No es
mejor que Finch ni que Streaks. Es que puede ser honesto de un modo que ellos no
pueden.
