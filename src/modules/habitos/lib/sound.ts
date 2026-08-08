"use client";

// Lightweight chiptune synth using WebAudio API — no asset files.

let ctx: AudioContext | null = null;
let mutedCache: boolean | null = null;

function readMuted(): boolean {
  if (typeof window === "undefined") return true;
  if (mutedCache !== null) return mutedCache;
  mutedCache = window.localStorage.getItem("untap:muted") === "1";
  return mutedCache;
}

export function isMuted(): boolean {
  return readMuted();
}

export function setMuted(m: boolean) {
  mutedCache = m;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("untap:muted", m ? "1" : "0");
    window.dispatchEvent(
      new CustomEvent("untap:muteChange", { detail: { muted: m } }),
    );
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

type Note = {
  freq: number;
  duration: number; // seconds
  type?: OscillatorType;
  gain?: number;
  delay?: number; // start offset
};

function playSequence(notes: Note[]) {
  if (readMuted()) return;
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? "square";
    osc.frequency.value = n.freq;
    const start = now + (n.delay ?? 0);
    const peak = n.gain ?? 0.08;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(start);
    osc.stop(start + n.duration + 0.02);
  }
}

// --- Effects ---

export function playChime() {
  // C5 + E5 quick blip — habit tick
  playSequence([
    { freq: 523.25, duration: 0.08, type: "triangle", gain: 0.1 },
    { freq: 659.25, duration: 0.12, type: "triangle", gain: 0.1, delay: 0.05 },
  ]);
}

export function playMinimalChime() {
  // softer single note — minimum viable
  playSequence([{ freq: 440, duration: 0.12, type: "sine", gain: 0.08 }]);
}

export function playFanfare() {
  // C–E–G–C ascending — level up
  playSequence([
    { freq: 523.25, duration: 0.12, type: "square", gain: 0.09 },
    { freq: 659.25, duration: 0.12, type: "square", gain: 0.09, delay: 0.08 },
    { freq: 783.99, duration: 0.12, type: "square", gain: 0.09, delay: 0.16 },
    { freq: 1046.5, duration: 0.32, type: "square", gain: 0.1, delay: 0.24 },
  ]);
}

export function playClick() {
  playSequence([{ freq: 1200, duration: 0.03, type: "square", gain: 0.04 }]);
}

export function playUndo() {
  // descending tone — undo / un-tick
  playSequence([
    { freq: 523.25, duration: 0.06, type: "triangle", gain: 0.06 },
    { freq: 392, duration: 0.1, type: "triangle", gain: 0.05, delay: 0.04 },
  ]);
}

export function playShield() {
  // bright "saved" — shield used
  playSequence([
    { freq: 880, duration: 0.06, type: "triangle", gain: 0.08 },
    { freq: 1175, duration: 0.1, type: "triangle", gain: 0.09, delay: 0.05 },
    { freq: 1568, duration: 0.18, type: "triangle", gain: 0.08, delay: 0.12 },
  ]);
}

export function playQuestComplete() {
  // coin-pickup style
  playSequence([
    { freq: 988, duration: 0.06, type: "square", gain: 0.07 },
    { freq: 1319, duration: 0.16, type: "square", gain: 0.08, delay: 0.05 },
  ]);
}

export function playAnchor() {
  // regal ding for anchor habit
  playSequence([
    { freq: 659.25, duration: 0.08, type: "triangle", gain: 0.09 },
    { freq: 880, duration: 0.1, type: "triangle", gain: 0.1, delay: 0.06 },
    { freq: 1318.5, duration: 0.2, type: "triangle", gain: 0.09, delay: 0.14 },
  ]);
}

export function playMilestone() {
  // streak milestone — bigger fanfare
  playSequence([
    { freq: 523.25, duration: 0.1, type: "square", gain: 0.09 },
    { freq: 783.99, duration: 0.1, type: "square", gain: 0.09, delay: 0.08 },
    { freq: 1046.5, duration: 0.1, type: "square", gain: 0.09, delay: 0.16 },
    { freq: 1318.5, duration: 0.18, type: "square", gain: 0.1, delay: 0.24 },
    { freq: 1568, duration: 0.32, type: "square", gain: 0.1, delay: 0.36 },
  ]);
}
