/**
 * 🦊 Настроение дня Марка
 *
 * Анализирует тональность последних сообщений в чате и определяет
 * «настроение дня» — эмоцию, которую Марк показывает в idle-состоянии.
 * Персистится в localStorage с TTL = 1 день.
 */

import type { MascotEmotion } from "../components/Mascot";

const MOOD_KEY = "mp:mascot:mood";
const MOOD_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface MoodState {
  emotion: MascotEmotion;
  scores: {
    positive: number;
    negative: number;
    analytical: number;
    creative: number;
    neutral: number;
  };
  updatedAt: number; // timestamp
}

const DEFAULT_SCORES = { positive: 0, negative: 0, analytical: 0, creative: 0, neutral: 1 };

function loadMood(): MoodState {
  try {
    const raw = localStorage.getItem(MOOD_KEY);
    if (!raw) return { emotion: "idle", scores: { ...DEFAULT_SCORES }, updatedAt: Date.now() };
    const parsed: MoodState = JSON.parse(raw);
    // Reset if expired
    if (Date.now() - parsed.updatedAt > MOOD_TTL) {
      return { emotion: "idle", scores: { ...DEFAULT_SCORES }, updatedAt: Date.now() };
    }
    return parsed;
  } catch {
    return { emotion: "idle", scores: { ...DEFAULT_SCORES }, updatedAt: Date.now() };
  }
}

function saveMood(state: MoodState) {
  localStorage.setItem(MOOD_KEY, JSON.stringify(state));
}

/** Keyword-based scoring (fast, runs on every assistant message) */
const PATTERNS: Array<{ re: RegExp; category: keyof MoodState["scores"]; weight: number }> = [
  // Positive
  { re: /отличн|супер|молодец|класс|здорово|прекрасн|потряс|превосход|успех|рост|прибыл|конверс|🎉|👍|🔥|💪/gi, category: "positive", weight: 2 },
  { re: /хорош|неплох|улучш|рекоменд|совет|помо[гж]/gi, category: "positive", weight: 1 },
  // Negative
  { re: /ошибк|провал|падени|убыт|потер|снижен|проблем|плохо|не удалось|увы|к сожалению|😢|😞/gi, category: "negative", weight: 2 },
  { re: /риск|осторожн|внимани|предупрежд/gi, category: "negative", weight: 1 },
  // Analytical
  { re: /анализ|метрик|данн|kpi|roi|cac|ltv|конверс|процент|статистик|рассчита|формул/gi, category: "analytical", weight: 2 },
  { re: /сравн|тест|гипотез|a\/b|корреляц|сегмент/gi, category: "analytical", weight: 1 },
  // Creative
  { re: /идея|креатив|контент|сторител|нарратив|визуал|дизайн|бренд|🎨|✨|💡/gi, category: "creative", weight: 2 },
  { re: /придум|генерир|вдохнов|тренд|формат|reels|stories/gi, category: "creative", weight: 1 },
];

function scoreText(text: string): Partial<MoodState["scores"]> {
  const scores: Partial<MoodState["scores"]> = {};
  for (const { re, category, weight } of PATTERNS) {
    const matches = text.match(re);
    if (matches) {
      scores[category] = (scores[category] || 0) + matches.length * weight;
    }
  }
  return scores;
}

function emotionFromScores(scores: MoodState["scores"]): MascotEmotion {
  const { positive, negative, analytical, creative, neutral } = scores;
  const total = positive + negative + analytical + creative + neutral;
  if (total <= 1) return "idle";

  // Dominant category
  const entries: [string, number][] = [
    ["positive", positive],
    ["negative", negative],
    ["analytical", analytical],
    ["creative", creative],
    ["neutral", neutral],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const [dominant] = entries[0];

  switch (dominant) {
    case "positive": return "celebrate";
    case "negative": return "oops";
    case "analytical": return "think";
    case "creative": return "work";
    default: return "idle";
  }
}

/** Call this after each assistant response to update mood */
export function updateMood(assistantText: string): MascotEmotion {
  const state = loadMood();
  const delta = scoreText(assistantText);

  // Merge scores with decay (older scores fade)
  const decay = 0.85;
  state.scores.positive = state.scores.positive * decay + (delta.positive || 0);
  state.scores.negative = state.scores.negative * decay + (delta.negative || 0);
  state.scores.analytical = state.scores.analytical * decay + (delta.analytical || 0);
  state.scores.creative = state.scores.creative * decay + (delta.creative || 0);
  state.scores.neutral = state.scores.neutral * decay + (delta.neutral || 0);

  state.emotion = emotionFromScores(state.scores);
  state.updatedAt = Date.now();
  saveMood(state);

  return state.emotion;
}

/** Get current mood without modifying it */
export function getMood(): MascotEmotion {
  return loadMood().emotion;
}

/** Get a human-friendly mood label */
export function getMoodLabel(): string {
  const mood = getMood();
  const labels: Record<MascotEmotion, string> = {
    idle: "спокоен",
    wave: "приветлив",
    think: "задумчив",
    celebrate: "в восторге",
    work: "вдохновлён",
    oops: "обеспокоен",
    sleep: "дремлет",
    love: "влюблён",
  };
  return labels[mood] || "спокоен";
}

/** Reset mood (e.g. from Settings) */
export function resetMood() {
  localStorage.removeItem(MOOD_KEY);
}
