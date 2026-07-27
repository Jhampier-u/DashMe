"use client";

import { useSyncExternalStore } from "react";

// El reloj del usuario es un sistema externo, así que se lee con
// useSyncExternalStore en vez de con un useEffect que hace setState al montar:
// el servidor renderiza el estado neutro, el cliente el real, y no hay ni
// desajuste de hidratación ni renders en cascada.

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000);
  window.addEventListener("focus", onChange);
  return () => {
    window.clearInterval(id);
    window.removeEventListener("focus", onChange);
  };
}

const getHour = () => new Date().getHours();
const noHourOnServer = () => null;

/** Hora local (0-23). `null` mientras se renderiza en el servidor. */
export function useLocalHour(): number | null {
  return useSyncExternalStore(subscribe, getHour, noHourOnServer);
}
