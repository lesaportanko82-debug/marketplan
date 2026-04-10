/**
 * 🦊 Глобальная шина реакций Марка.
 *
 * Любой модуль может вызвать showMascotReaction("save") — и
 * маленький Марк всплывёт с анимацией + текстом + звуком.
 *
 * Реакции: save, delete, ai_start, ai_done, error, copy, export, milestone
 */

import type { MascotEmotion } from "../components/Mascot";

export type ReactionType =
  | "save"
  | "delete"
  | "ai_start"
  | "ai_done"
  | "error"
  | "copy"
  | "export"
  | "milestone"
  | "like";

export interface ReactionConfig {
  emotion: MascotEmotion;
  text: string;
  duration: number; // ms
  color: string;    // accent
}

export const REACTION_CONFIGS: Record<ReactionType, ReactionConfig> = {
  save:      { emotion: "love",      text: "Сохранено!",       duration: 2200, color: "#1a7a6d" },
  delete:    { emotion: "oops",      text: "Удалено...",       duration: 2000, color: "#c08a40" },
  ai_start:  { emotion: "think",     text: "Думаю...",         duration: 2500, color: "#0d7377" },
  ai_done:   { emotion: "celebrate", text: "Готово! ✨",       duration: 2500, color: "#1a7a6d" },
  error:     { emotion: "oops",      text: "Что-то не так!",   duration: 2500, color: "#b8874e" },
  copy:      { emotion: "wave",      text: "Скопировано!",     duration: 1800, color: "#2eb8a4" },
  export:    { emotion: "work",      text: "Экспортирую...",   duration: 2200, color: "#d4a373" },
  milestone: { emotion: "celebrate", text: "Достижение! 🏆",   duration: 3000, color: "#d4a373" },
  like:      { emotion: "love",      text: "Отлично!",         duration: 2000, color: "#1a7a6d" },
};

/* ═══ Event bus ═══ */
const EVENT_NAME = "mp:mascot:reaction";

export interface ReactionEvent {
  type: ReactionType;
  text?: string; // override
}

export function showMascotReaction(type: ReactionType, text?: string) {
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { type, text } })
  );
}

export function onMascotReaction(handler: (evt: ReactionEvent) => void): () => void {
  const listener = (e: Event) => {
    handler((e as CustomEvent<ReactionEvent>).detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

/* ═══ Milestones ═══ */
const MILESTONE_KEY = "mp:mascot:milestones";

export interface Milestone {
  id: string;
  label: string;
  description: string;
  threshold: number;
  reward: string; // displayed in game
  icon: string;
}

export const MILESTONES: Milestone[] = [
  { id: "first_project",   label: "Первый проект",   description: "Создайте свой первый проект",          threshold: 1,  reward: "Марк верит в вас! Каждый великий маркетолог начинал с первого проекта.", icon: "🚀" },
  { id: "first_ai",        label: "AI-первопроходец", description: "Сгенерируйте первый AI-контент",      threshold: 1,  reward: "AI — ваш суперинструмент! Используйте его чаще — Марк подскажет.",       icon: "🤖" },
  { id: "posts_5",         label: "Контент-марафон",  description: "Создайте 5 постов в контент-плане",   threshold: 5,  reward: "5 постов — отличный старт! Контент — король, а вы его советник.",        icon: "📝" },
  { id: "posts_25",        label: "Контент-мастер",   description: "Создайте 25 постов",                  threshold: 25, reward: "25 постов! Ваша аудитория в восторге. Марк аплодирует стоя!",          icon: "🏆" },
  { id: "tests_3",         label: "Экспериментатор",  description: "Создайте 3 A/B теста",                threshold: 3,  reward: "Данные — лучший друг маркетолога. Тестируйте, оптимизируйте, побеждайте!", icon: "🧪" },
  { id: "competitors_3",   label: "Шпион",            description: "Добавьте 3 конкурентов",              threshold: 3,  reward: "Знай врага в лицо! Теперь вы на шаг впереди конкурентов.",              icon: "🕵️" },
  { id: "week_streak",     label: "Неделя в деле",    description: "Заходите в приложение 7 дней подряд", threshold: 7,  reward: "7 дней подряд! Марк гордится вашей дисциплиной. Так держать!",          icon: "🔥" },
  { id: "automations_1",   label: "Автоматизатор",    description: "Создайте первую автоматизацию",       threshold: 1,  reward: "Автоматизация — путь к масштабу! Пусть роботы работают за вас.",         icon: "⚡" },
  { id: "exports_3",       label: "Мастер экспорта",  description: "Экспортируйте 3 отчёта",              threshold: 3,  reward: "Профессиональные отчёты готовы! Клиенты будут впечатлены.",              icon: "📊" },
];

interface MilestoneProgress {
  [milestoneId: string]: {
    current: number;
    completed: boolean;
    completedAt?: string;
    gameShown?: boolean;
  };
}

function getProgress(): MilestoneProgress {
  try {
    const raw = localStorage.getItem(MILESTONE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: MilestoneProgress) {
  localStorage.setItem(MILESTONE_KEY, JSON.stringify(progress));
}

/**
 * Increment milestone counter. Returns the milestone if newly completed.
 * Call from modules: checkMilestone("first_project", 1)
 */
export function checkMilestone(milestoneId: string, count: number = 1): Milestone | null {
  const milestone = MILESTONES.find(m => m.id === milestoneId);
  if (!milestone) return null;

  const progress = getProgress();
  const entry = progress[milestoneId] || { current: 0, completed: false };

  if (entry.completed) return null;

  entry.current = count;
  if (entry.current >= milestone.threshold && !entry.completed) {
    entry.completed = true;
    entry.completedAt = new Date().toISOString();
    entry.gameShown = false;
    progress[milestoneId] = entry;
    saveProgress(progress);
    return milestone;
  }

  progress[milestoneId] = entry;
  saveProgress(progress);
  return null;
}

/** Mark game as shown for milestone */
export function markGameShown(milestoneId: string) {
  const progress = getProgress();
  if (progress[milestoneId]) {
    progress[milestoneId].gameShown = true;
    saveProgress(progress);
  }
}

/** Get all completed milestones */
export function getCompletedMilestones(): Array<Milestone & { completedAt: string }> {
  const progress = getProgress();
  return MILESTONES.filter(m => progress[m.id]?.completed).map(m => ({
    ...m,
    completedAt: progress[m.id].completedAt || "",
  }));
}

/** Get pending game (completed but game not shown) */
export function getPendingGame(): Milestone | null {
  const progress = getProgress();
  for (const m of MILESTONES) {
    const entry = progress[m.id];
    if (entry?.completed && !entry.gameShown) {
      return m;
    }
  }
  return null;
}

/** Reset all milestones */
export function resetMilestones() {
  localStorage.removeItem(MILESTONE_KEY);
}

/** Track daily streak */
export function trackDailyVisit() {
  const key = "mp:mascot:daily_visits";
  try {
    const raw = localStorage.getItem(key);
    const data: { dates: string[] } = raw ? JSON.parse(raw) : { dates: [] };
    const today = new Date().toISOString().slice(0, 10);
    if (!data.dates.includes(today)) {
      data.dates.push(today);
      localStorage.setItem(key, JSON.stringify(data));
    }
    // Count consecutive days ending today
    const sorted = [...data.dates].sort().reverse();
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 30; i++) {
      const check = d.toISOString().slice(0, 10);
      if (sorted.includes(check)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  } catch {
    return 0;
  }
}
