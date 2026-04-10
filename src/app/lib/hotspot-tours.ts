/**
 * 🔍 Hotspot Tours — управляемые туры по интерфейсу
 * 
 * Расширение системы хотспотов с:
 * - Пошаговыми турами
 * - Контекстными подсказками
 * - Прогрессом прохождения
 * - Интерактивными действиями
 */

import { SpotlightTarget } from "../components/SpotlightOverlay";

// ══════ TYPES ══════
export interface TourStep extends SpotlightTarget {
  /** Unique ID for the step */
  id: string;
  /** Optional action that should be performed before moving to next step */
  requiredAction?: "click" | "input" | "none";
  /** Optional delay before showing this step (ms) */
  delay?: number;
  /** Optional callback when step is completed */
  onComplete?: () => void;
}

export interface Tour {
  id: string;
  name: string;
  description: string;
  category: "beginner" | "advanced" | "feature";
  steps: TourStep[];
  /** Icon for the tour (emoji or component) */
  icon?: string;
  /** Estimated time to complete (minutes) */
  estimatedTime?: number;
}

export interface TourProgress {
  tourId: string;
  currentStep: number;
  completed: boolean;
  startedAt: string;
  completedAt?: string;
}

// ══════ PREDEFINED TOURS ══════

/** Beginner tour: First steps in MarketPlan */
export const TOUR_ONBOARDING: Tour = {
  id: "onboarding",
  name: "Знакомство с MarketPlan",
  description: "Изучите основные функции платформы за 5 минут",
  category: "beginner",
  icon: "🚀",
  estimatedTime: 5,
  steps: [
    {
      id: "welcome",
      selector: "[data-hotspot='sidebar-logo']",
      label: "Добро пожаловать!",
      description: "MarketPlan — ваш AI-помощник для маркетинга. Давайте начнём!",
      delay: 500,
    },
    {
      id: "projects",
      selector: "[data-hotspot='sidebar-projects']",
      label: "Проекты",
      description: "Здесь хранятся все ваши маркетинговые проекты",
    },
    {
      id: "analytics",
      selector: "[data-hotspot='sidebar-analytics']",
      label: "Аналитика",
      description: "Смотрите статистику, KPI и ROI в реальном времени",
    },
    {
      id: "content-studio",
      selector: "[data-hotspot='sidebar-content-studio']",
      label: "Content Studio",
      description: "Генерируйте тексты и изображения с помощью AI",
    },
    {
      id: "mascot",
      selector: "[data-hotspot='mascot-mark']",
      label: "Марк 🦊",
      description: "Ваш персональный AI-ассистент. Кликните, чтобы получить подсказки!",
      requiredAction: "click",
    },
  ],
};

/** Analytics dashboard tour */
export const TOUR_ANALYTICS: Tour = {
  id: "analytics-dashboard",
  name: "Дашборд аналитики",
  description: "Научитесь работать с аналитическими виджетами",
  category: "feature",
  icon: "📊",
  estimatedTime: 3,
  steps: [
    {
      id: "filters",
      selector: "[data-hotspot='dashboard-filters']",
      label: "Фильтры",
      description: "Фильтруйте данные по проектам и каналам",
    },
    {
      id: "customize",
      selector: "[data-hotspot='dashboard-customize']",
      label: "Настройка виджетов",
      description: "Перетаскивайте виджеты и скрывайте ненужные",
    },
    {
      id: "export-pdf",
      selector: "[data-hotspot='export-pdf']",
      label: "Экспорт в PDF",
      description: "Скачайте красивый PDF-отчёт с брендингом",
    },
    {
      id: "kpi-cards",
      selector: "[data-hotspot='kpi-cards']",
      label: "KPI-карточки",
      description: "Ключевые метрики: проекты, бюджет, конверсии, ROI",
    },
    {
      id: "channel-table",
      selector: "[data-hotspot='channel-table']",
      label: "Детализация",
      description: "Смотрите эффективность каждого канала",
    },
  ],
};

/** AI tools tour */
export const TOUR_AI_TOOLS: Tour = {
  id: "ai-tools",
  name: "AI-инструменты",
  description: "Освойте Content Studio и AI-генерацию",
  category: "feature",
  icon: "🤖",
  estimatedTime: 4,
  steps: [
    {
      id: "content-brief",
      selector: "[data-hotspot='content-brief']",
      label: "Бриф контента",
      description: "Опишите, что вы хотите создать: запуск продукта, акцию или обучающий материал",
      requiredAction: "input",
    },
    {
      id: "platform-select",
      selector: "[data-hotspot='platform-select']",
      label: "Выбор платформ",
      description: "Выберите, для каких соцсетей генерировать контент",
    },
    {
      id: "generate-button",
      selector: "[data-hotspot='generate-content']",
      label: "Генерация",
      description: "Нажмите, чтобы AI создал посты для всех выбранных платформ",
      requiredAction: "click",
    },
    {
      id: "brand-voice",
      selector: "[data-hotspot='brand-voice']",
      label: "Голос бренда",
      description: "Настройте тональность и стиль коммуникации",
    },
    {
      id: "hashtag-library",
      selector: "[data-hotspot='hashtag-library']",
      label: "Библиотека хештегов",
      description: "Сохраняйте наборы хештегов для быстрого использования",
    },
  ],
};

/** Marketing calendar tour */
export const TOUR_CALENDAR: Tour = {
  id: "marketing-calendar",
  name: "Календарь кампаний",
  description: "Планируйте публикации с drag-and-drop",
  category: "feature",
  icon: "📅",
  estimatedTime: 3,
  steps: [
    {
      id: "calendar-view",
      selector: "[data-hotspot='calendar-view']",
      label: "Календарь",
      description: "Все ваши публикации и кампании в одном месте",
    },
    {
      id: "add-post",
      selector: "[data-hotspot='add-post']",
      label: "Добавить публикацию",
      description: "Создайте новый пост или кампанию",
      requiredAction: "click",
    },
    {
      id: "drag-drop",
      selector: "[data-hotspot='calendar-post']",
      label: "Drag & Drop",
      description: "Перетаскивайте посты на другие даты",
    },
    {
      id: "status-filter",
      selector: "[data-hotspot='status-filter']",
      label: "Фильтр статусов",
      description: "Показывайте только черновики, запланированные или опубликованные",
    },
  ],
};

/** Metrics tree tour */
export const TOUR_METRICS_TREE: Tour = {
  id: "metrics-tree",
  name: "Дерево метрик",
  description: "Визуализируйте связи между KPI",
  category: "advanced",
  icon: "🌳",
  estimatedTime: 4,
  steps: [
    {
      id: "tree-root",
      selector: "[data-hotspot='metrics-tree-root']",
      label: "Корневая метрика",
      description: "Главная цель, которую вы хотите достичь (например, выручка)",
    },
    {
      id: "tree-branches",
      selector: "[data-hotspot='metrics-tree-branches']",
      label: "Ветви",
      description: "Метрики, влияющие на корневую (трафик, конверсия, средний чек)",
    },
    {
      id: "add-metric",
      selector: "[data-hotspot='add-metric']",
      label: "Добавить метрику",
      description: "Создайте новый узел в дереве",
      requiredAction: "click",
    },
    {
      id: "connections",
      selector: "[data-hotspot='metric-connections']",
      label: "Связи",
      description: "Линии показывают, как метрики влияют друг на друга",
    },
  ],
};

/** All available tours */
export const ALL_TOURS: Tour[] = [
  TOUR_ONBOARDING,
  TOUR_ANALYTICS,
  TOUR_AI_TOOLS,
  TOUR_CALENDAR,
  TOUR_METRICS_TREE,
];

// ══════ CUSTOM TOURS MANAGEMENT ══════

const CUSTOM_TOURS_KEY = "marketplan:custom_tours";

/** Get all custom tours from localStorage */
export function getCustomTours(): Tour[] {
  try {
    const stored = localStorage.getItem(CUSTOM_TOURS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/** Save custom tour */
export function saveCustomTour(tour: Tour) {
  const custom = getCustomTours();
  const existingIndex = custom.findIndex((t) => t.id === tour.id);
  
  if (existingIndex >= 0) {
    custom[existingIndex] = tour;
  } else {
    custom.push(tour);
  }
  
  localStorage.setItem(CUSTOM_TOURS_KEY, JSON.stringify(custom));
}

/** Delete custom tour */
export function deleteCustomTour(tourId: string) {
  const custom = getCustomTours();
  const filtered = custom.filter((t) => t.id !== tourId);
  localStorage.setItem(CUSTOM_TOURS_KEY, JSON.stringify(filtered));
}

/** Get all tours (predefined + custom) */
export function getAllTours(): Tour[] {
  return [...ALL_TOURS, ...getCustomTours()];
}

/** Check if tour is custom */
export function isCustomTour(tourId: string): boolean {
  return tourId.startsWith("custom-");
}

// ══════ STORAGE HELPERS ══════

const STORAGE_KEY = "marketplan:tour_progress";

export function getTourProgress(): Record<string, TourProgress> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveTourProgress(tourId: string, progress: TourProgress) {
  const all = getTourProgress();
  all[tourId] = progress;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function startTour(tourId: string): TourProgress {
  const progress: TourProgress = {
    tourId,
    currentStep: 0,
    completed: false,
    startedAt: new Date().toISOString(),
  };
  saveTourProgress(tourId, progress);
  return progress;
}

export function nextStep(tourId: string): TourProgress | null {
  const all = getTourProgress();
  const progress = all[tourId];
  if (!progress) return null;

  const tour = getAllTours().find((t) => t.id === tourId);
  if (!tour) return null;

  if (progress.currentStep < tour.steps.length - 1) {
    progress.currentStep++;
    saveTourProgress(tourId, progress);
    return progress;
  }

  // Tour completed
  progress.completed = true;
  progress.completedAt = new Date().toISOString();
  saveTourProgress(tourId, progress);
  return progress;
}

export function resetTour(tourId: string) {
  const all = getTourProgress();
  delete all[tourId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function isTourCompleted(tourId: string): boolean {
  const progress = getTourProgress()[tourId];
  return progress?.completed ?? false;
}

export function getCurrentStep(tourId: string): TourStep | null {
  const progress = getTourProgress()[tourId];
  if (!progress) return null;

  const tour = getAllTours().find((t) => t.id === tourId);
  if (!tour) return null;

  return tour.steps[progress.currentStep] || null;
}

// ══════ CONTEXTUAL HOTSPOTS ══════

/**
 * Returns contextual hotspots based on current page/route
 */
export function getContextualHotspots(path: string): SpotlightTarget[] {
  const hotspots: SpotlightTarget[] = [];

  // Analytics page
  if (path.includes("/analytics")) {
    hotspots.push(
      {
        selector: "[data-hotspot='dashboard-customize']",
        label: "Настройка виджетов",
        description: "Перетаскивайте и скрывайте виджеты",
      },
      {
        selector: "[data-hotspot='export-pdf']",
        label: "Экспорт PDF",
        description: "Скачать отчёт с брендингом",
      }
    );
  }

  // Content Studio
  if (path.includes("/content-studio")) {
    hotspots.push(
      {
        selector: "[data-hotspot='generate-content']",
        label: "AI-генерация",
        description: "Создайте контент для всех платформ",
      },
      {
        selector: "[data-hotspot='brand-voice']",
        label: "Голос бренда",
        description: "Настройте тональность",
      }
    );
  }

  // Calendar
  if (path.includes("/calendar")) {
    hotspots.push(
      {
        selector: "[data-hotspot='add-post']",
        label: "Новая публикация",
        description: "Добавьте пост в календарь",
      },
      {
        selector: "[data-hotspot='calendar-view']",
        label: "Просмотр календаря",
        description: "Переключайте месяц/неделю/день",
      }
    );
  }

  return hotspots;
}