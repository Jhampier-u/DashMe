/*
  Interfaz pública del módulo de hábitos.

  Es lo ÚNICO que `src/app` y el dashboard pueden importar de aquí. Nadie de
  fuera entra a `lib/` ni a `components/` directamente. Cuando en el
  sub-proyecto 5 la portada tenga que leer de hábitos y de música a la vez, esta
  frontera es la diferencia entre componer dos interfaces limpias y enredar el
  dashboard con las tripas de dos aplicaciones.
*/

// Lecturas
export {
  getHabitsWithTodayStatus,
  getOrCreatePlayer,
  getPlayerLevelInfo,
  getHabitMonth,
  getHabitDiagnosis,
  BACKFILL_MAX_DAYS,
  type HabitWithStatus,
  type MonthDay,
  type HabitDiagnosis,
} from "./lib/habits";
export { getHomeMetrics, type HomeMetrics } from "./lib/home";
export { getNota, notasDeHabito, LIMITE_NOTA, type Nota } from "./lib/notas";
export { pausasDeHabito, pausasPorHabito, type Pausa } from "./lib/pausas";
export { asignarHuecos, intercambiar, type ConHueco } from "./lib/huecos";
export { intercambiarHuecos, getJardinHistorico } from "./lib/jardin";
// `comprarDecoracion` NO sale por aquí a propósito: el server action de
// `actions.ts` se llama igual, y tener los dos a mano invita a que una pantalla
// llame al que recibe la base desde el navegador, donde no hay base.
export { decoracionesTuyas } from "./lib/tienda";
export { getConteosDeFacetas, type Conteos } from "./lib/tasks";
export { primerDiaDeRegistro, diasConTareaCerrada } from "./lib/jardin";
export {
  mezclarFauna,
  memoriaDeFauna,
  semanaDeFauna,
  fraseDeMemoria,
  type DiaDeFauna,
  type SemanaRecordada,
} from "./lib/fauna";
export {
  CATALOGO,
  TIENDA,
  puedeComprar,
  esDecoracion,
  type Decoracion,
  type EnLaTienda,
  type Compra,
  type Rechazo,
} from "./lib/decoraciones";
export {
  jardinEn,
  rachaEn,
  semanaEn,
  primerDiaConDatos,
  type HabitoHistorico,
  type PlantaEn,
} from "./lib/historia";
export { getDiasCumplidos, type DiasCumplidos } from "./lib/dias-cumplidos";
export { climaDe, ETIQUETA, NUBES, type Clima, type Tiempo } from "./lib/clima";
export { dayKey, isoFromDayKey, dayKeyFromISO } from "./lib/day";
export {
  listProjects,
  getProjectWithTree,
  getProjectMetrics,
  fraseDeMovimiento,
  progresoDe,
  estaTerminado,
  type ProjectSummary,
  type ProjectItemNode,
} from "./lib/projects";
export { getTodayQuests, syncDailyQuests } from "./lib/quests";
export {
  getHabitStats,
  getGlobalStats,
  type HabitDetailStats,
  type GlobalStats,
} from "./lib/stats";
export { getTasksGrouped, getTaskMetrics, STATUS_LABEL } from "./lib/tasks";
export { listCategorias, type Categoria } from "./lib/categorias";
export { listAttachments, type Adjunto } from "./lib/adjuntos";
export { getTask, type TaskDetalle } from "./lib/tasks";
export {
  PRIORIDADES,
  PRIORIDAD_DEFS,
  prioridadColorVar,
  resolvePrioridad,
  type Prioridad,
} from "./lib/prioridad";

// Constantes de gamificación que las vistas necesitan para etiquetar.
export { MAX_SHIELDS, XP_PER_HABIT, XP_PER_TASK } from "./lib/level";

// Lógica pura de presentación del jardín: sin acceso a datos, pero las páginas
// la necesitan para pintar la escena.
export {
  stageFor,
  isPlantWilted,
  plantEmoji,
  stageLabel,
  plantStateLabel,
  PLANT_SPECIES,
  type PlantSpecies,
} from "./lib/garden";

// Escrituras: los server actions, ya con la conexión inyectada.
export * from "./actions";
export {
  estadoSrbai,
  guardarMedida,
  sugerirInteriorizado,
  puntuacion,
  ITEMS as ITEMS_SRBAI,
  MIN_DIAS as MIN_DIAS_SRBAI,
  type EstadoSrbai,
  type Sugerencia,
  type Medida,
} from "./lib/srbai";
export {
  exportarTodo,
  importarTodo,
  contarTodo,
  ORDEN as TABLAS_EXPORTADAS,
  FORMATO as FORMATO_EXPORT,
  VERSION as VERSION_EXPORT,
  type Exportacion,
} from "./lib/exportar";
