import { describe, it, expect } from "vitest";
import {
  addDays,
  dayKey,
  dayKeyFromISO,
  daysBetween,
  isoFromDayKey,
  localDayRange,
  normalizeDayKey,
  weekdayOf,
} from "./day";

// vitest.config.mts fija TZ=America/Lima (UTC-5).

describe("dayKey", () => {
  it("usa el día de calendario local, no el UTC", () => {
    // 22:00 del 27 de julio en Lima son las 03:00 UTC del 28.
    // El bug original registraba esto como día 28 y rompía la racha del 27.
    const lateNight = new Date("2026-07-28T03:00:00Z");
    expect(isoFromDayKey(dayKey(lateNight))).toBe("2026-07-27");
  });

  it("mantiene el mismo día durante toda la jornada local", () => {
    const morning = new Date("2026-07-27T13:00:00Z"); // 08:00 local
    const evening = new Date("2026-07-28T04:59:00Z"); // 23:59 local del 27
    expect(dayKey(morning).getTime()).toBe(dayKey(evening).getTime());
  });

  it("cambia de día a la medianoche local", () => {
    const before = new Date("2026-07-28T04:59:59Z"); // 23:59:59 local
    const after = new Date("2026-07-28T05:00:00Z"); // 00:00:00 local
    expect(daysBetween(dayKey(after), dayKey(before))).toBe(1);
  });

  it("produce medianoche UTC", () => {
    const key = dayKey(new Date("2026-07-27T18:34:12Z"));
    expect(key.getUTCHours()).toBe(0);
    expect(key.getUTCMinutes()).toBe(0);
    expect(key.getUTCSeconds()).toBe(0);
    expect(key.getUTCMilliseconds()).toBe(0);
  });
});

describe("normalizeDayKey", () => {
  it("es idempotente sobre una clave ya normalizada", () => {
    const key = dayKey(new Date("2026-07-27T18:00:00Z"));
    expect(normalizeDayKey(key).getTime()).toBe(key.getTime());
    expect(normalizeDayKey(normalizeDayKey(key)).getTime()).toBe(key.getTime());
  });

  it("no desplaza los valores guardados en la BD", () => {
    // Lo que Prisma devuelve para un date-only: medianoche UTC.
    const stored = new Date("2026-07-27T00:00:00Z");
    expect(isoFromDayKey(normalizeDayKey(stored))).toBe("2026-07-27");
  });
});

describe("dayKeyFromISO", () => {
  it("parsea fechas válidas", () => {
    expect(isoFromDayKey(dayKeyFromISO("2026-07-27")!)).toBe("2026-07-27");
  });

  it("rechaza formatos inválidos", () => {
    expect(dayKeyFromISO("27-07-2026")).toBeNull();
    expect(dayKeyFromISO("2026-7-1")).toBeNull();
    expect(dayKeyFromISO("")).toBeNull();
    expect(dayKeyFromISO("2026-07-27T10:00:00Z")).toBeNull();
  });

  it("rechaza fechas que no existen", () => {
    expect(dayKeyFromISO("2026-02-31")).toBeNull();
    expect(dayKeyFromISO("2026-13-01")).toBeNull();
  });
});

describe("addDays / daysBetween", () => {
  it("suma y resta días", () => {
    const key = dayKeyFromISO("2026-07-27")!;
    expect(isoFromDayKey(addDays(key, 1))).toBe("2026-07-28");
    expect(isoFromDayKey(addDays(key, -1))).toBe("2026-07-26");
    expect(isoFromDayKey(addDays(key, -27))).toBe("2026-06-30");
  });

  it("cuenta la distancia en días", () => {
    const a = dayKeyFromISO("2026-07-27")!;
    const b = dayKeyFromISO("2026-06-27")!;
    expect(daysBetween(a, b)).toBe(30);
    expect(daysBetween(b, a)).toBe(-30);
  });
});

describe("weekdayOf", () => {
  it("devuelve 0=domingo..6=sábado", () => {
    expect(weekdayOf(dayKeyFromISO("2026-07-27")!)).toBe(1); // lunes
    expect(weekdayOf(dayKeyFromISO("2026-07-25")!)).toBe(6); // sábado
    expect(weekdayOf(dayKeyFromISO("2026-07-26")!)).toBe(0); // domingo
  });
});

describe("localDayRange", () => {
  it("cubre exactamente 24 horas alrededor del instante dado", () => {
    const now = new Date("2026-07-28T03:00:00Z"); // 22:00 local del 27
    const { start, end } = localDayRange(now);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(now.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(now.getTime()).toBeLessThan(end.getTime());
    // arranca a medianoche local del 27
    expect(start.getDate()).toBe(27);
    expect(start.getHours()).toBe(0);
  });
});
