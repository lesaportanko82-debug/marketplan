/**
 * 🔊 Sound effects for Марк (Web Audio API - no external files)
 * 
 * Тихие, приятные звуки при появлении маскота.
 * Все звуки синтезируются через Web Audio API.
 * Громкость: 0.08–0.15 (едва слышно, ненавязчиво).
 */

const STORAGE_KEY = "mp:mascot:sounds_enabled";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/* ═══ Public API: enable/disable ═══ */
export function isSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "true"; // enabled by default
  } catch {
    return true;
  }
}

export function setSoundEnabled(val: boolean) {
  localStorage.setItem(STORAGE_KEY, String(val));
}

/* ═══ Core: play a tone ═══ */
function playTone(
  freq: number,
  duration: number,
  vol: number,
  type: OscillatorType = "sine",
  detune = 0,
  ramp?: { freq: number; time: number }
) {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;

  if (ramp) {
    osc.frequency.linearRampToValueAtTime(ramp.freq, ctx.currentTime + ramp.time);
  }

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/* ═══ Sound presets per emotion/event ═══ */

/** Мягкий "pop" - появление подсказки */
export function playPop() {
  playTone(800, 0.12, 0.1, "sine");
  setTimeout(() => playTone(1200, 0.08, 0.06, "sine"), 40);
}

/** Приветствие - два мелодичных тона */
export function playWave() {
  playTone(523, 0.15, 0.08, "sine"); // C5
  setTimeout(() => playTone(659, 0.15, 0.08, "sine"), 120); // E5
}

/** Ура! - маленькая восходящая трель */
export function playCelebrate() {
  playTone(523, 0.1, 0.09, "sine"); // C5
  setTimeout(() => playTone(659, 0.1, 0.09, "sine"), 80); // E5
  setTimeout(() => playTone(784, 0.15, 0.1, "sine"), 160); // G5
  setTimeout(() => playTone(1047, 0.2, 0.07, "triangle"), 250); // C6
}

/** Думает - мягкий низкий "хм" */
export function playThink() {
  playTone(330, 0.25, 0.06, "sine", 0, { freq: 350, time: 0.2 });
}

/** Работает - тихое "клик-клик" клавиатуры */
export function playWork() {
  playTone(1800, 0.04, 0.04, "square");
  setTimeout(() => playTone(2200, 0.03, 0.03, "square"), 60);
}

/** Ой! - нисходящий тон */
export function playOops() {
  playTone(600, 0.2, 0.08, "sine", 0, { freq: 300, time: 0.18 });
}

/** Сон - мягкий "ш-ш" (белый шум через oscillator trick) */
export function playSleep() {
  playTone(200, 0.4, 0.04, "sine", 0, { freq: 180, time: 0.35 });
}

/** Любовь - восходящая "сердечная" нота */
export function playLove() {
  playTone(440, 0.15, 0.07, "sine"); // A4
  setTimeout(() => playTone(554, 0.15, 0.08, "sine"), 100); // C#5
  setTimeout(() => playTone(659, 0.25, 0.06, "triangle"), 200); // E5
}

/** Успех/Сохранение */
export function playSuccess() {
  playTone(660, 0.1, 0.08, "sine");
  setTimeout(() => playTone(880, 0.18, 0.07, "sine"), 100);
}

/** Ошибка */
export function playError() {
  playTone(300, 0.15, 0.08, "sawtooth");
  setTimeout(() => playTone(250, 0.2, 0.06, "sawtooth"), 100);
}

/** Онбординг шаг */
export function playStep() {
  playTone(700, 0.1, 0.06, "sine");
  setTimeout(() => playTone(900, 0.08, 0.05, "sine"), 60);
}

/* ═══ Dispatch by emotion ═══ */
type Emotion = "idle" | "wave" | "think" | "celebrate" | "work" | "oops" | "sleep" | "love";

const SOUND_MAP: Record<Emotion, (() => void) | null> = {
  idle: null, // no sound for idle - too frequent
  wave: playWave,
  think: playThink,
  celebrate: playCelebrate,
  work: playWork,
  oops: playOops,
  sleep: playSleep,
  love: playLove,
};

export function playEmotionSound(emotion: Emotion) {
  const fn = SOUND_MAP[emotion];
  if (fn) fn();
}
