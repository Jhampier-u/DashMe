"use client";

import { useLocalHour } from "@/lib/useLocalHour";

const NEUTRAL = { text: "Hola, aventurero", emoji: "👋" };

function pickGreeting(hour: number) {
  if (hour < 6) return { text: "¿No duermes, aventurero?", emoji: "🌙" };
  if (hour < 12) return { text: "Buenos días, aventurero", emoji: "☀️" };
  if (hour < 19) return { text: "Buenas tardes, aventurero", emoji: "🌤️" };
  return { text: "Buenas noches, aventurero", emoji: "🌙" };
}

export function Greeting() {
  const hour = useLocalHour();
  const g = hour === null ? NEUTRAL : pickGreeting(hour);

  return (
    <div className="text-center">
      <div className="text-3xl mb-2 untap-bobble inline-block">{g.emoji}</div>
      <h2 className="font-display text-base sm:text-lg text-[var(--color-peach)] tracking-wider mb-1">
        {g.text.toUpperCase()}
      </h2>
      <p className="text-[var(--color-ink-soft)] text-lg">
        Tu día, tu progreso, tu aventura
      </p>
    </div>
  );
}
