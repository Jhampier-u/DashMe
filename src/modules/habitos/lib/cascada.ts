import type { TaskStatus } from "./tasks";

/** Lo único que la cascada necesita saber de una tarea. */
export type FilaCascada = {
  id: string;
  parentId: string | null;
  status: TaskStatus;
};

export type CambioEstado = {
  id: string;
  /** El estado que tenía. De aquí sale el XP. */
  de: TaskStatus;
  a: TaskStatus;
};

/**
 * Decide TODOS los cambios de estado que provoca mover una tarea.
 *
 * Es pura: recibe la lista plana y devuelve la lista de cambios. No toca la
 * base, no mira el reloj y no lanza. Quien la aplica es `updateTaskStatus`.
 *
 * Esa separación es el punto del diseño. La cascada tiene muchos casos de borde
 * —árboles profundos, mezclas de estados, huérfanos, ciclos— y como función
 * pura se prueban todos en milisegundos. Enterrada en una mutación se probarían
 * tres.
 *
 * DOS DIRECCIONES, y no son excluyentes:
 *
 *   abajo — solo al COMPLETAR: los descendientes se cierran con ella.
 *   arriba — siempre: los ancestros se recalculan a partir de sus hijos.
 *
 * La subida es un EVENTO y no una regla permanente. Se recalcula porque algo
 * cambió, no porque el estado deba cumplirse en todo momento. Es lo que permite
 * desmarcar un padre a mano sin que se vuelva a marcar solo al instante.
 */
export function planCascada(
  filas: FilaCascada[],
  cambio: { id: string; nuevo: TaskStatus },
): CambioEstado[] {
  const porId = new Map(filas.map((f) => [f.id, f]));
  const raiz = porId.get(cambio.id);
  if (!raiz) return [];

  const hijosDe = new Map<string, FilaCascada[]>();
  for (const f of filas) {
    if (!f.parentId) continue;
    const l = hijosDe.get(f.parentId);
    if (l) l.push(f);
    else hijosDe.set(f.parentId, [f]);
  }

  /** El estado de cada tarea DESPUÉS de lo decidido hasta ahora. */
  const estado = new Map<string, TaskStatus>();
  const estadoDe = (id: string) =>
    estado.get(id) ?? porId.get(id)?.status ?? "TODO";
  const anotar = (id: string, a: TaskStatus) => estado.set(id, a);

  anotar(cambio.id, cambio.nuevo);

  // ---- Hacia abajo: solo al completar ----
  if (cambio.nuevo === "DONE") {
    // `vistos` no es una optimización: con un ciclo en `parent_id` esto sería
    // un bucle infinito dentro del proceso del servidor.
    const vistos = new Set([cambio.id]);
    const cola = [cambio.id];
    while (cola.length > 0) {
      const actual = cola.pop()!;
      for (const h of hijosDe.get(actual) ?? []) {
        if (vistos.has(h.id)) continue;
        vistos.add(h.id);
        anotar(h.id, "DONE");
        cola.push(h.id);
      }
    }
  }

  // ---- Hacia arriba: siempre ----
  const subidos = new Set<string>([cambio.id]);
  let hijo = raiz;
  while (hijo.parentId) {
    const padre = porId.get(hijo.parentId);
    // Huérfano: el padre no existe. No hay a quién recalcular.
    if (!padre) break;
    // Ciclo.
    if (subidos.has(padre.id)) break;
    subidos.add(padre.id);

    const suyos = hijosDe.get(padre.id) ?? [];
    const toca = estadoPorHijos(suyos.map((h) => estadoDe(h.id)));
    // Si el padre ya estaba como le toca, los de arriba lo ven igual que antes
    // y tampoco pueden cambiar.
    if (toca === estadoDe(padre.id)) break;
    anotar(padre.id, toca);
    hijo = padre;
  }

  const plan: CambioEstado[] = [];
  for (const [id, a] of estado) {
    const de = porId.get(id)?.status ?? "TODO";
    if (de !== a) plan.push({ id, de, a });
  }
  return plan;
}

/** El estado que le toca a un padre según sus hijos DIRECTOS. */
function estadoPorHijos(hijos: TaskStatus[]): TaskStatus {
  if (hijos.length === 0) return "TODO";
  if (hijos.every((s) => s === "DONE")) return "DONE";
  if (hijos.every((s) => s === "TODO")) return "TODO";
  return "IN_PROGRESS";
}
