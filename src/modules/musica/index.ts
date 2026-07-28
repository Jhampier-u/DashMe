/*
  Interfaz pública del módulo de música.

  Es lo ÚNICO que `src/app` y el dashboard pueden importar de aquí. Nadie de
  fuera entra a `lib/` ni a `components/` directamente. Si necesitas algo que no
  está exportado, expórtalo aquí antes de usarlo — no atajes.
*/

// La API de Spotify: lecturas de perfil, playlists y canciones guardadas.
export {
  getMe,
  getAllMyPlaylists,
  getPlaylist,
  getPlaylistTracks,
  getLikedSongs,
  playlistTrackTotal,
  type SpotifyUser,
  type SpotifyPlaylist,
  type SpotifyTrack,
  type PlaylistDetail,
  type PlaylistTrackItem,
  type SavedTrackItem,
} from "./lib/spotify";

// Limpieza del HTML que devuelve Spotify en las descripciones.
export { sanitizeDescription } from "./lib/sanitize";

// Rango temporal de las vistas de estadísticas y su zona horaria.
export {
  parseRange,
  PRESETS,
  type PresetId,
  type StatsRange,
  type RangeParams,
} from "./lib/stats/range";
export {
  resolveTimeZone,
  localParts,
  type LocalParts,
} from "./lib/stats/local-time";

// Estadísticas de escucha.
export { getTotals, type Totals } from "./lib/stats/totals";
export {
  getTopArtists,
  getTopTracks,
  getTopAlbums,
  type TopEntry,
  type TopTrackEntry,
  type TopAlbumEntry,
} from "./lib/stats/tops";
export {
  getByHour,
  getByWeekday,
  getByMonth,
  getByDate,
  type HourBucket,
  type WeekdayBucket,
  type MonthBucket,
  type DayBucket,
} from "./lib/stats/time";
export { getStreaks, type Streaks } from "./lib/stats/streaks";
export {
  getSkipStats,
  getMostSkippedArtists,
  type SkipStats,
  type SkippedArtist,
} from "./lib/stats/skips";
export {
  getGenreBreakdown,
  PROFUNDIDAD,
  type GenreEntry,
  type GenreBreakdown,
} from "./lib/stats/genres";
export {
  getHistory,
  type HistoryRow,
  type HistoryPage,
  type HistoryOptions,
} from "./lib/stats/history";
export {
  getTrackDetail,
  getArtistDetail,
  getAlbumDetail,
  type TrackDetail,
  type ArtistDetail,
  type AlbumDetail,
} from "./lib/stats/detail";
export {
  getContraste,
  contarTomas,
  type Contraste,
  type Entidad,
  type SpotifyRange,
} from "./lib/stats/snapshots";

// Captura periódica del historial reciente.
export {
  runCapture,
  getCaptureState,
  type CaptureResult,
} from "./lib/capture/run-capture";

// Escrituras: server actions, ya con la conexión inyectada.
export { listTags, getTagsForTracks } from "./lib/tag-actions";
export { listSmartPlaylists, type SmartPlaylist } from "./lib/smart-actions";
export {
  listarArchivos,
  type ArchivoDisponible,
} from "./lib/import/import-actions";
