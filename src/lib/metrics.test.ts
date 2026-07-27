import { describe, it, expect } from "vitest";
import { dayKeyFromISO } from "./day";
import { complianceSeries, type HabitSpec, type LogEntry } from "./metrics";

const key = (iso: string) => dayKeyFromISO(iso)!;
const DAILY = "1111111";
const MWF = "0101010"; // lun, mié, vie

function habit(id: string, schedule = DAILY, since = "2026-07-01"): HabitSpec {
  return { id, schedule, since: key(since) };
}

function log(
  habitId: string,
  iso: string,
  extra: Partial<LogEntry> = {},
): LogEntry {
  return { habitId, day: key(iso), partial: false, shielded: false, ...extra };
}

describe("complianceSeries", () => {
  it("cuenta cumplidos sobre programados", () => {
    const days = complianceSeries(
      [habit("a"), habit("b")],
      [log("a", "2026-07-20")],
      key("2026-07-20"),
      key("2026-07-20"),
    );
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "2026-07-20",
      scheduled: 2,
      done: 1,
      rate: 0.5,
    });
  });

  it("no cuenta el hábito en días anteriores a su existencia", () => {
    const days = complianceSeries(
      [habit("a", DAILY, "2026-07-20")],
      [],
      key("2026-07-19"),
      key("2026-07-20"),
    );
    expect(days[0].scheduled).toBe(0);
    expect(days[0].rate).toBeNull();
    expect(days[1].scheduled).toBe(1);
  });

  it("excluye del promedio los días sin nada programado", () => {
    // Sábado 25: el hábito L-M-V no toca.
    const days = complianceSeries(
      [habit("a", MWF)],
      [],
      key("2026-07-25"),
      key("2026-07-25"),
    );
    expect(days[0].scheduled).toBe(0);
    expect(days[0].rate).toBeNull();
  });

  it("cuenta el modo mínimo como medio cumplimiento", () => {
    const days = complianceSeries(
      [habit("a"), habit("b")],
      [log("a", "2026-07-20", { partial: true })],
      key("2026-07-20"),
      key("2026-07-20"),
    );
    expect(days[0].done).toBe(0.5);
    expect(days[0].rate).toBe(0.25);
  });

  it("no da por cumplido un día cubierto por escudo, pero lo reporta", () => {
    const days = complianceSeries(
      [habit("a")],
      [log("a", "2026-07-20", { shielded: true })],
      key("2026-07-20"),
      key("2026-07-20"),
    );
    expect(days[0].done).toBe(0);
    expect(days[0].rate).toBe(0);
    expect(days[0].shielded).toBe(1);
  });

  it("ignora registros de días en los que el hábito no tocaba", () => {
    const days = complianceSeries(
      [habit("a", MWF)],
      [log("a", "2026-07-25")], // sábado
      key("2026-07-25"),
      key("2026-07-25"),
    );
    expect(days[0].scheduled).toBe(0);
    expect(days[0].done).toBe(0);
  });

  it("devuelve un elemento por día del rango, en orden", () => {
    const days = complianceSeries([habit("a")], [], key("2026-07-20"), key("2026-07-23"));
    expect(days.map((d) => d.date)).toEqual([
      "2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23",
    ]);
  });
});
