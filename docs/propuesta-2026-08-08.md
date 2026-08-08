# Qué hacer distinto, y por qué

Fecha: 8 de agosto de 2026 · Secciones: tareas, hábitos y jardín · Basado en
cuatro líneas de investigación de mercado y literatura de HCI.

**Esto es una propuesta. No hay nada implementado.**

---

## La tesis

Se pidió «algo único». La conclusión de la investigación es que **la originalidad
por la vía de añadir mecánicas es casi siempre contraproducente en esta
categoría**: la gamificación sobre una app ya digital aporta un efecto calificado
de «trivial» sobre 10.079 personas y decae a negativo medido en años.

Pero hay dos vetas de originalidad que sí se sostienen:

1. **Construir lo que la investigación publicó y el mercado descartó.** El
   catálogo de prototipos de 2005–2009 —UbiFit, PeopleGarden, Tableau Machine,
   Digital Family Portrait— quedó publicado, evaluado, y el mercado se quedó solo
   con la racha.
2. **Hacer lo que un producto comercial no puede permitirse.** Sin suscripción ni
   retención que defender, este dashboard puede decir «no hay datos suficientes»,
   puede tratar «ya no lo necesito» como un éxito, y puede no notificar nunca.

Lo que sigue es todo de una de esas dos vetas. Nada es una mecánica inventada.

---

# Parte 1 · Tareas: la barra de filtros

El problema señalado —prioridad y categorías amontonadas, y el subrayado de
color en el sitio equivocado— es real y está medido por terceros.

## 1.1 Lo que ya está bien y no hay que tocar

**Una categoría por tarea.** Bergman et al. (2013, *JASIST*), dos estudios con 75
y 23 participantes con ambos mecanismos disponibles: preferencia clara por
carpetas sobre etiquetas, **y cuando usaron etiquetas normalmente pusieron una
sola por elemento**. La clasificación múltiple se usó al guardar y casi nunca al
recuperar; recuperar por etiqueta fue más lento y con menos aciertos.

Iba a proponer etiquetas múltiples. La evidencia dice que no.

**El punto de prioridad.** `PriorityDot` codifica en color **y tamaño** más
`aria-label`. Cumple WCAG 1.4.1 y no hay nada que arreglar.

**No ordenar por prioridad.** Bellotti et al. (CHI 2004): «people are not poor at
prioritizing». Zhu et al. (2018): cualquier señal de urgencia secuestra la
decisión por encima de la importancia, violando el principio de dominancia.

## 1.2 Los seis cambios

1. **Separar los grupos con cabecera.** Baymard, que hace pruebas de usabilidad a
   gran escala: agrupar por tipo es «la columna vertebral de un panel legible».
   Dos filas con su rótulo —`Prioridad` y `Categoría`— en vez de una sola tira.

2. **Quitar el filo de color de la píldora de categoría.** El color de categoría
   ya vive donde tiene que vivir: el borde inferior bajo el título de la tarea,
   en `TaskCard`. Repetirlo en el filtro es lo que hace que las dos familias de
   píldora se lean como una.

3. **Etiquetar cada píldora con su faceta.** `Categoría: Ocio` en vez de `Ocio`.
   Baymard: la misma palabra puede aparecer en varias facetas y el usuario no
   puede saber a cuál pertenece.

4. **Recuento por opción.** `Ocio (7)`. Baymard lo llama «una de las mejoras de
   mayor impacto». Las tareas ya están cargadas en memoria: contar es gratis.

5. **Chips de filtro activo, con su ✕ y un «quitar todo».** Este es el que vale
   la pena: el patrón está consolidado en comercio electrónico y **no existe en
   ninguna app de tareas personal revisada**. Todoist, Things y TickTick enseñan
   el nombre de una vista guardada, no las condiciones puestas.

6. **Y entre grupos, O dentro del grupo.** Es el estándar documentado. Hoy solo
   se puede tener un filtro de cada tipo.

## 1.3 Lo que NO propongo, y por qué

- **Etiquetas múltiples**: contra la evidencia de Bergman.
- **Ordenar por prioridad**: automatizaría un sesgo documentado.
- **Fechas de vencimiento**: el circuito está documentado —fechas inventadas para
  que la tarea aparezca, incumplidas sin consecuencia, montón de vencidas,
  «vencido» deja de significar nada—. No tenerlas es una ventaja.
- **Subtareas más profundas**: el mantenedor de Super Productivity lo rechazó
  cuatro veces, **lo implementó en un PR que funcionaba y lo tiró**: «los árboles
  profundos se convierten en un sitio donde enredar en vez de trabajar». Es el
  único «no» bien argumentado de todo el corpus, y va contra algo que ya tenemos.

---

# Parte 2 · Hábitos: el estado «ya no lo necesito»

**Esta es la propuesta única del documento.**

## 2.1 El hueco, con nombre y fecha

Epstein, Caraway, Johnston, Ping, Fogarty y Munson, **CHI 2016**, *Beyond
Abandonment to Next Steps*. Estudian por qué la gente deja de registrarse y
encuentran **seis razones × cinco perspectivas sobre la vida después**, en ejes
independientes.

Entre las razones está **«learned enough»**. Entre las perspectivas, **«continued
use of knowledge or skills»**. La metáfora de un participante:

> «El software de seguimiento financiero que usaba eran como ruedines. Usé los
> ruedines para desarrollar equilibrio. Llegó el momento de quitarlos.»

Y la frase que lo sostiene: *«El abandono no es siempre indicativo de fracaso ni
el final exitoso de un proceso, sino que puede ser señal de rendimientos
decrecientes o de una redefinición de objetivos.»* Lo llaman **abandono feliz**.

**La métrica dominante del sector no lo contempla.** Eysenbach (2005), *The Law
of Attrition*, es el concepto fundacional de medición en salud digital y **no
distingue en ningún momento a quien se va porque fracasó de quien se va porque ya
no lo necesita**. Veintiún años después se sigue midiendo así.

**Y ninguna herramienta verificada tiene ese estado.** En Loop Habit Tracker, la
documentación oficial explica el score pero no menciona en ningún momento qué
hacer cuando un hábito ya está formado. Su «archivar» es ocultar de la lista:
limpieza de interfaz, no un estado de éxito.

Los dos productos que sí tratan el final como éxito —Sleepio, que llama
*graduate* a sus usuarios, y Virta, cuyos honorarios dependen de revertir la
diabetes— lo hacen **porque su estructura económica se lo exige**, no por virtud
de diseño.

## 2.2 La propuesta

Un hábito puede marcarse como **interiorizado**. Concretamente:

- **Deja de pedirse**: sale de pendientes, no cuenta para la racha global ni para
  el clima, no genera fallo.
- **Conserva todo su historial**: sigue en la memoria del jardín, sigue en las
  gráficas, sigue siendo tuyo.
- **En el jardín se queda como planta adulta** que ya no necesita riego. No
  desaparece ni se marchita: se queda.
- **Se puede deshacer.** Si vuelve a costar, vuelve a la lista sin penalización y
  sin perder lo anterior.
- **Se dice en texto**, con fecha: «interiorizado el 8 de agosto de 2026».

Es un **tercer estado**, distinto de «activo» y de «borrado». Borrar un hábito
formado castiga por haberlo conseguido; dejarlo activo para siempre convierte un
éxito en una tarea perpetua.

**Por qué es único y no un capricho:** el vocabulario académico existe desde
2016, la métrica del sector no lo contempla desde 2005, ninguna herramienta lo
implementa, y **un producto con suscripción no puede construirlo** porque un
usuario que se gradúa es un usuario que deja de pagar. Aquí no hay nadie a quien
retener.

## 2.3 Riesgo, dicho por delante

Un matiz del propio paper que conviene no perder: el 7,1 % de quienes dejaron el
seguimiento *por barreras de recogida de datos* seguían aplicando lo aprendido.
**La causa del abandono no predice si el resultado fue bueno.** Por eso esto debe
ser una decisión explícita del usuario y nunca una inferencia automática del
sistema.

---

# Parte 3 · El jardín

## 3.1 Lo que valida lo que ya hay

**UbiFit Garden** — Consolvo, McDonald y Landay, **CHI 2009**. Un jardín donde
florece una flor por actividad, con la regla de diseño escrita: *«Las flores no
mueren. La hierba no se marchita. El cielo no truena.»* Evaluado con un
**experimento de campo de tres meses, 28 personas, tres condiciones**. Resultado
con significación estadística: **quienes tenían el jardín mantuvieron su actividad
los tres meses, incluidas semanas de festivo; quienes no, bajaron.**

Su estrategia *Positive*: cuando la conducta no se realiza, **ni recompensa ni
castigo**, pero hay que sostener el interés. Y el porqué del castigo: en
Fish'n'Steps (UbiComp 2006), **algunos participantes dejaban de mirar la pantalla
cuando su pez no estaba contento**, lo que llevó a los investigadores a
replantearse el castigo entero.

La metáfora es más vieja aún: **PeopleGarden** (UIST 1999), personas como flores
cuya altura y pétalos codifican su historial. Nunca se comercializó.

## 3.2 Cuatro fallos concretos

**a) El clima semanal se leerá como un bug.** Skog, Ljungblad y Holmquist
(InfoVis 2003) documentan que si un dato cambia poco, **la gente cree que el
sistema está roto** — les pasó con su previsión del tiempo. El nuestro cambia
como mucho una vez por semana. Su recomendación: añadir un mínimo de movimiento a
los datos lentos, precisamente para señalar que el sistema vive.

**b) El tamaño es el canal que nadie lee.** En el mismo estudio codificaron un
dato en color *y* tamaño; la gente usó el color y **casi nadie tradujo el tamaño
a una cantidad**. Nuestras plantas codifican la etapa en tamaño. Propuesta:
añadir una segunda señal —forma o tono— a la etapa, sin quitar el crecimiento.

**c) Falta degradación elegante.** Skog rompía deliberadamente su plantilla
artística —cuadrados en negro— cuando el servidor caía. Nosotros, si no hay datos
de música, pintamos **cero pájaros**, que es idéntico a lo que pintamos cuando no
escuchaste nada, y la frase afirma «ni música ni tareas cerradas». Hay que
distinguir *no hubo* de *no lo sé*, igual que ya hace el clima con `sin-dato`.

**d) La tienda es el vector de riesgo, no el jardín.** Bódi (2024) acuña **«cozy
agency»**: sentirse productivo dentro de parámetros predeterminados e inofensivos.
Y Diefenbach y Müssig (2019), 45 usuarios: **lo que predice si la motivación
sobrevive es que el usuario perciba las recompensas como apropiadas**. Los precios
importan más de lo que parece.

## 3.3 Lo que copiaría

**La memoria de UbiFit.** Mariposa grande = la semana en curso; **mariposas
pequeñas = los objetivos de las tres semanas anteriores**. Un mes de historia
dentro de la misma escena, sin ejes. Con reinicio semanal, *«para que aunque haya
tenido una mala semana, pueda empezar de cero la siguiente»*. Los participantes lo
citaron: *«veía la mariposa y pensaba: lo conseguí la semana pasada, puedes
hacerlo otra vez»*.

Es la solución **publicada y evaluada** al problema de dar sentido de historia sin
castigar el presente ni convertirlo en gráfica. Y tenemos ya la infraestructura de
fauna para hacerlo.

**El marco del Digital Family Portrait** (CHI 2001) como alternativa: 28 iconos,
uno por día, **una semana por lado de un marco**.

## 3.4 Lo que NO propongo

- **Más gamificación**: trivial frente a una app ya digital, negativa en años.
- **Que la planta muera**: ya no lo hace, y es lo mejor respaldado del proyecto.
- **Un motor de correlaciones automático**: con 20 pares hay un 64 % de
  probabilidad de un falso positivo. Exist.io ejecuta del orden de dos mil
  contrastes cada lunes sin corregir por comparaciones múltiples, y es **el más
  honesto del mercado**.

---

# Parte 4 · Música — DESCARTADA

> **Nota del 8 de agosto de 2026.** El usuario decidió que música quede
> **aislada**: no se cruza con hábitos, tareas ni jardín. Todo el cruce se ha
> retirado del código —los pájaros del jardín y el panel de la portada—, así que
> lo que sigue en esta sección **ya no se propone**. Se conserva porque el
> análisis del hueco de mercado sigue siendo cierto; simplemente no es para este
> proyecto.



**Nadie ha modelado la música como algo más que un contador.** Exist.io, el único
producto capaz de cruzar música con ánimo poniendo un p-valor al lado, la reduce a
un entero diario: `tracks`. Un barrido de GitHub por estrellas devuelve solo
paneles de hábitos de escucha; el único repo con «correlation» en el nombre
correlaciona reproducciones de álbumes entre sí.

Y el proyecto con la mejor infraestructura del mundo para esto —HPI, con
`lastfm.py`, sueño, ejercicio y productividad en el mismo sitio— **tiene la
intención declarada por escrito y no ha publicado ni un hallazgo**.

Tenemos 2.833 días de escuchas y una regla que se niega a afirmar. Estamos dentro
del hueco.

**Pero antes de construir nada ahí, dos avisos:**

1. **Etkin (2016)**, seis experimentos: medir una actividad placentera aumenta
   cuánto la haces **y reduce cuánto la disfrutas**, sin necesidad de recompensa
   externa. La música es probablemente lo único de este dashboard que no se pide
   como deber.
2. **Spotify deprecó Audio Features y Audio Analysis para aplicaciones nuevas el
   27 de noviembre de 2024.** Cualquier análisis por valencia o energía está fuera
   de alcance salvo que la aplicación tuviera acceso extendido previo. *Sin
   verificar: si el export de GDPR sigue siendo vía viable.*

**Propuesta mínima y honesta:** que los pájaros dependan de que **hubo** música,
no de cuánta. Presencia en vez de cantidad, sin escalón que superar. Elimina el
incentivo a escuchar para llenar el cielo, que es justo lo que Etkin describe.

---

---

# Parte 5 · Dos hallazgos tardíos

## 5.1 El Parlamento Europeo nombra las rachas

**Resolución del Parlamento Europeo de 12 de diciembre de 2023 sobre el diseño
adictivo de los servicios en línea** (P9_TA(2023)0459). Nombra explícitamente
*scroll infinito*, *pull-to-refresh*, *autoplay*, *notificaciones de recaptura*,
*técnicas de gamificación* y — literalmente — **«streaks»**.

Y pide un **«derecho digital a no ser molestado»**, con *«todas las funciones de
captura de atención apagadas por diseño»* y activación voluntaria fácil.

La FTC estadounidense, en cambio, **no** categoriza las mecánicas de retención
como patrón oscuro: sus cuatro categorías van de engaño, cargos no autorizados y
privacidad. El Parlamento Europeo es hoy la única institución que nombra las
rachas.

**Qué implica aquí.** No que haya que quitar la racha, sino que el diseño honesto
es **no protegerla artificialmente y no monetizar su reparación**. Duolingo
publica que duplicar los *streak freezes* le subió los usuarios activos un 0,38 %;
y un usuario documentó una racha de **3.097 días habiendo faltado la mitad de un
mes, incluidos cinco días seguidos**, gracias a esas protecciones. Su conclusión:
*la racha no mide constancia, mide adherencia*.

Nuestra gracia de un día **dice en pantalla que ha perdonado un día**. Esa línea
—«5 días de racha · 1 día perdonado»— es justamente lo que separa un mecanismo
honesto de uno que infla el número. Conviene no quitarla nunca.

## 5.2 Corrección: no notificar no es gratis

En el informe anterior escribí que la ausencia de notificaciones «no es un coste,
es lo que la evidencia recomienda». **Hay que matizarlo.**

Stawarz et al. (CHI 2015) miden que apoyarse en recordatorios **dificulta la
formación del hábito** — eso sigue en pie, y es sobre automaticidad.

Pero **Fitz et al. (2019)**, experimento de campo aleatorizado, n=237, tres
condiciones —continua, agrupada y ninguna—: **quienes no recibieron ninguna
notificación experimentaron más ansiedad y más FOMO**. Lo que ganó fue **agrupar**.

Así que la postura correcta es: no notificar es defendible **desde la soberanía
del usuario**, como hace HEY —*«las notificaciones vienen apagadas por defecto»*—
y no desde un bienestar medido. La evidencia de bienestar apunta a agrupar, no a
abstenerse. Nuestro dashboard no notifica y eso está bien, pero el argumento es
otro del que di.

## 5.3 La propuesta nueva: el daño ocurre antes de la exportación

Éste es el hallazgo que más me sorprendió del estudio.

**Habitica promedia tu historial antiguo para ahorrar almacenamiento.** Textual de
su documentación: *«no conserva todos los datos históricos de todas las tareas
para mejorar el rendimiento y reducir costes de base de datos; en su lugar, los
datos más antiguos se promedian y solo se incluye la media en las exportaciones»*.

**Ningún formato de exportación recupera lo que la base ya promedió.** La
portabilidad de verdad no es un compromiso de formato de fichero: es un
compromiso de **retención**.

Y el patrón del sector lo confirma: las mejores exportaciones del mercado son las
de **Loop** (GPLv3) y **HabitKit** (local-first) — las dos **sin servidor**. Sin
bloqueo en la nube no hay incentivo para dificultar la salida. En el otro extremo,
los backups de Todoist son **solo de pago** y además **excluyen las tareas
completadas y los proyectos archivados**; y Fabulous no tiene botón de exportar:
hay que pedirlo por un chatbot y esperar diez días a un fichero de formato no
especificado.

El marco legal no ayuda: el artículo 20 del RGPD cubre los datos que **tú
facilitaste**, y los **derivados** —rachas calculadas, puntuaciones, «insights»—
quedan discutiblemente fuera. No se encontró **ni una sola resolución
sancionadora por formato de exportación**.

**Propuesta:** una exportación honesta y completa, en un formato documentado, que
incluya **todo** — registros, notas, pausas, decoraciones, XP e historial — y que
se pueda volver a importar. No como feature de marketing, sino porque:

1. Este proyecto **ya conserva todo** y nunca promedia. La ventaja existe; solo
   falta la puerta.
2. Es lo que hace que el dato sea tuyo de verdad y no solo esté en tu disco.
3. **Un producto con suscripción no puede construir esto bien**, y los dos que
   mejor lo hacen son precisamente los dos que no tienen servidor.

Es, junto al estado «interiorizado», la otra cosa de este documento que un
competidor comercial no puede copiar sin renunciar a su modelo de negocio.

---

# Parte 6 · Lo que aporta el sexto informe

## 6.1 La pieza que le faltaba al estado «interiorizado»

En la parte 2 propuse que el usuario marcara a mano un hábito como interiorizado.
**Hay una forma mejor y con base psicométrica de saber cuándo sugerirlo.**

**SRBAI** — Gardner, Abraham, Lally y de Bruijn (2012), *IJBNPA* 9:102. Una
subescala validada de **cuatro ítems** que mide automaticidad:

> lo hago automáticamente · lo hago sin recordarlo conscientemente · lo hago sin
> pensar · empiezo antes de darme cuenta

**Ninguna app comercial mide automaticidad. Todas miden frecuencia.** Y son cosas
distintas: la racha cuenta días seguidos; el SRBAI mide si ya no tienes que
querer hacerlo.

Combinado con Lally et al. (2010) —la automaticidad crece por una curva asintótica
individual, con un rango de **18 a 254 días**— sale una alternativa a la racha que
sí responde a la pregunta que importa: *¿esto ya es un hábito?*

**Propuesta corregida:** cuatro preguntas una vez por semana, y cuando la curva se
aplane, el dashboard **sugiere** el estado interiorizado. La decisión sigue siendo
del usuario —el riesgo de 2.3 no cambia—, pero deja de ser una corazonada.

## 6.2 El hueco mejor documentado del sector: los hábitos negativos

No los tenemos, y **nadie los tiene bien**. En Loop, los hábitos de tipo «como
mucho» están rotos de una forma que se lee sola:

- Un día **sin registro rompe la racha**: para abstenerte tienes que registrar
  activamente un cero cada día.
- La «mejor racha» se calcula sobre los periodos en que **sí** practicaste el mal
  hábito. El signo está invertido — [issue #2321](https://github.com/iSoron/uhabits/issues/2321), abierta en febrero de 2026.
- Y de ahí sale la frase más elocuente de todo el estudio: **el confeti celebra la
  recaída.**

Loop tuvo que añadir en 2.3.0 una regla reveladora: *«nunca marcar los hábitos de
"como mucho" como completados del día»* — porque siempre puedes empeorarlo antes
de medianoche.

La alternativa del mercado (I Am Sober, QuitNow) cuenta **tiempo desde el último
evento**, lo que evita el registro diario pero hace que **un desliz borre meses,
sin crédito parcial posible**.

Es un hueco real y bien probado. No lo propongo para ya —es una feature nueva, no
un arreglo—, pero es la mejor candidata si algún día quieres ampliar.

## 6.3 Dos piezas de arquitectura que merece la pena robar

**`aggday`, de Beeminder.** Separa tres cosas que todo el mundo mezcla: *qué
registras*, *cómo se resume un día* (suma, media, mediana, mínimo, máximo,
recuento, binario…) y *cómo decae el histórico*. Convierte «¿hice bastante?» de
una pregunta binaria en un escalar. Es la mejor idea de diseño de datos del
estudio.

**La asimetría del «horizonte de akrasia».** En Beeminder puedes bajarte el listón,
pero **con siete días de retardo**; subírtelo es inmediato. Resuelve el problema de
«ajustar la exigencia sin que sea una excusa» sin necesidad de juzgar al usuario.

## 6.4 Una advertencia que toca nuestra tienda

**Renfree et al. (CHI 2016)**, 16 usuarios de Lift: los recordatorios y las rachas
sostienen la repetición **pero crean dependencia de la app**, y como todo el mundo
acaba abandonándola, la conducta se derrumba con ella. Textual:

> *«Con las rachas, las recompensas extrínsecas esperadas anulan el desarrollo de
> la automaticidad al mantener la conducta orientada a la meta.»*

Y una revisión de 50 recomendaciones desde la teoría de la autodeterminación
(Alberts, Lyngs y Lukoff, 2024) remata el diagnóstico: *«la SDT se usa para
optimizar el compromiso con la tecnología misma, no con la conducta objetivo»*.

**Es el argumento más fuerte a favor del estado interiorizado**: si el éxito es que
el hábito sobreviva sin la app, la app tiene que tener una salida.

## 6.5 Y una corrección a un consejo popular

**Beshears et al. (2021), *Management Science*.** Incentivar la rutina —pagar por
ir al gimnasio **dentro de una ventana horaria planificada**— produjo **menos
visitas** que incentivar la flexibilidad, **durante la intervención y después de
retirarla**. El grupo de horario rígido cayó más al quitar los incentivos.

Va contra el consejo de «hazlo a la misma hora cada día». **No** va contra anclar a
un evento: encaja exactamente con Stawarz. Refuerza que los ejemplos del campo
`intention` deban ser sucesos —«cuando cierre el portátil»— y nunca relojes.

## 6.6 Un detalle que hay que comprobar en nuestras gráficas

**Niess et al. (MobileHCI 2020)** probaron cuatro formas de visualizar metas **no
alcanzadas** con 165 encuestados y 20 entrevistas: **las barras favorecen
significativamente la reflexión, y las barras multicolor disparan
significativamente más rumiación.**

El semáforo rojo/verde es el patrón malo. Merece la pena revisar cómo pintamos los
días fallados en `last30` y en las gráficas de cumplimiento.

---

# Parte 7 · El fallo de la racha, dicho por dentro

## 7.1 La foto del techo

La demanda del estado de Nuevo México contra Snap (2024) cita **70 veces** la
palabra «streak» y reproduce correos internos de la empresa de enero de 2017:

> *«Vaya, deberíamos tener más funciones adictivas como esta.»*

> *«Si abro Snapchat, **hago una foto del techo** para mantener mis rachas y no
> interactúo con el resto de la app, ¿es ese el comportamiento que queremos
> fomentar?»*

Esa segunda frase es el fallo de la racha en una línea: **produce cumplimiento
vacío**. Alguien de la propia empresa lo vio en 2017 y se publicó en 2024.

*(Dato de contraste, verificado por búsqueda en el PDF de 233 páginas: la demanda
de los 41 estados contra Meta **no menciona las rachas ni una sola vez**. Quien
las nombra es la de Snap.)*

**Qué significa para nosotros.** Nuestra racha ya perdona un día y lo dice. Pero la
foto del techo es un riesgo estructural de cualquier racha, y la defensa no es
más generosidad: es que **marcar cueste lo mismo que hacer**. Ahí ayuda el
objetivo numérico, que ya distingue «2 de 8» de «hecho».

## 7.2 Las herramientas de bienestar que no sirven

En febrero de 2026 la Comisión Europea acusó preliminarmente a TikTok de
incumplir el DSA por diseño adictivo, y en julio a Meta. Lo interesante no es la
acusación: es que **rechazó sus herramientas de bienestar existentes** por ser
*«fáciles de descartar y con poca fricción»*.

El caso de estudio de esa crítica es de Instagram: en julio de 2018 lanzó **«Ya
estás al día»**, una señal explícita de parada. En agosto de 2020 la enterró bajo
un flujo infinito de publicaciones sugeridas. **La señal de parar se convirtió en
una señal de seguir.**

Y Brasil ya lo ha prohibido: el Decreto 12.880/2026 veta *«recompensas basadas en
tiempo»*, con multas de hasta el 10 % de la facturación del grupo.

## 7.3 La asimetría, otra vez, en dos sitios más

Aparece el mismo patrón que el horizonte de akrasia de Beeminder:

- **Monzo** (2018): activar el bloqueo de apuestas es instantáneo; **desactivarlo
  exige 48 horas** de espera —después ampliadas hasta un año—. Casi 100.000
  personas lo usaron y bloqueó más de 200.000 transacciones.
- **Oura, Rest Mode**: al activarlo **suspende su propia puntuación de actividad y
  el objetivo diario**. El producto apaga su capa de gamificación cuando el cuerpo
  lo necesita.

**Protegerse es inmediato; desprotegerse tarda.** Es la forma general de «puedes
bajar el listón sin que sea una excusa», y encaja tal cual con nuestras pausas y
con el estado interiorizado.

Un hueco honesto: **no existe evidencia pública sobre el coste en uso de estas
funciones de descanso.** Ni Oura, ni Whoop, ni Garmin publican nada. La pregunta
«¿decirle al usuario que descanse te cuesta enganche?» está sin responder.

# Orden sugerido

1. **La barra de filtros** (parte 1). Es lo que molesta hoy, es pequeño y todo
   está respaldado.
2. **Los cuatro arreglos del jardín** (3.2). Pequeños y concretos; el de la
   degradación elegante corrige una deshonestidad que introduje yo.
3. **El estado «interiorizado»** (parte 2). Es el más grande y el único
   genuinamente único. Toca esquema, consultas y jardín.
4. **La memoria de UbiFit** (3.3), si tras lo anterior sigue apeteciendo.
5. **Los pájaros por presencia** (parte 4), que es una línea.
6. **El SRBAI para sugerir «interiorizado»** (6.1). Cuatro preguntas semanales;
   convierte la propuesta 3 de corazonada en medida.
7. **La exportación honesta** (5.3). Es la otra que un competidor no puede
   copiar, y no depende de nada de lo anterior: se puede hacer cuando se quiera.
