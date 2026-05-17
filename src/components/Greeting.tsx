"use client";

import { useEffect, useState } from "react";

function pickGreeting(hour: number) {
  if (hour < 6) return { text: "¿No duermes, aventurero?", emoji: "🌙" };
  if (hour < 12) return { text: "Buenos días, aventurero", emoji: "☀️" };
  if (hour < 19) return { text: "Buenas tardes, aventurero", emoji: "🌤️" };
  return { text: "Buenas noches, aventurero", emoji: "🌙" };
}

export function Greeting() {
  const [g, setG] = useState({ text: "Hola, aventurero", emoji: "👋" });
  useEffect(() => {
    setG(pickGreeting(new Date().getHours()));
  }, []);
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
