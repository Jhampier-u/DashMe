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
export {
  listProjects,
  getProjectWithTree,
  getProjectMetrics,
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
