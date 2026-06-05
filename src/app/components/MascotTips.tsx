/**
 * 🦊 Марк - контекстные подсказки при первом посещении модуля.
 * Cloud-style speech bubble с интерактивными хотспотами:
 * кликабельные точки внутри облачка подсвечивают реальные UI-элементы.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useLocation } from "react-router";
import { Mascot, type MascotEmotion } from "./Mascot";
import { SpeechBubble } from "./SpeechBubble";
import {
  SpotlightOverlay,
  HotspotDot,
  type SpotlightTarget,
} from "./SpotlightOverlay";
import { playPop } from "../lib/mascot-sounds";

/* ═══ Tips content per route ═══ */
interface TipConfig {
  message: string;
  emotion: MascotEmotion;
  /** Interactive hotspot points - clicking them highlights a real UI element */
  hotspots?: SpotlightTarget[];
}

const TIPS: Record<string, TipConfig> = {
  "/": {
    message:
      "Привет! 🦊 Здесь живут все ваши проекты. Нажмите на точку ниже, чтобы я показал нужную кнопку!",
    emotion: "wave",
    hotspots: [
      {
        selector: '[data-hotspot="projects-add"]',
        label: "Новый проект",
        description: "Создайте проект с бюджетом, каналами и KPI",
      },
      {
        selector: '[data-hotspot="header-search"]',
        label: "Быстрый поиск",
        description: "Или нажмите Ctrl+K для поиска по всему приложению",
      },
    ],
  },
  "/dashboard": {
    message:
      "Аналитика - моё любимое! Перетаскивайте виджеты, чтобы настроить свой дашборд.",
    emotion: "love",
    hotspots: [
      {
        selector: '[data-hotspot="dashboard-customize"]',
        label: "Настроить виджеты",
        description: "Перетаскивайте, скрывайте и показывайте виджеты",
      },
      {
        selector: '[data-hotspot="header-notifications"]',
        label: "Уведомления",
        description: "Здесь появляются алерты о бюджетах и кампаниях",
      },
    ],
  },
  "/calendar": {
    message:
      "Маркетинговый календарь собирает события из всех модулей. Кликните на день, чтобы увидеть детали!",
    emotion: "idle",
    hotspots: [
      {
        selector: '[data-hotspot="header-search"]',
        label: "Поиск",
        description: "Ctrl+K - быстрый поиск событий и модулей",
      },
    ],
  },
  "/smm/plan": {
    message:
      "Контент-план - сердце SMM! Перетаскивайте идеи из банка прямо в таблицу.",
    emotion: "work",
    hotspots: [
      {
        selector: '[data-hotspot="smm-add-post"]',
        label: "Добавить пост",
        description: "Создайте пост вручную или сгенерируйте AI",
      },
    ],
  },
  "/content-studio": {
    message:
      "Content Studio - моя гордость! Выберите платформу, опишите тему - и я создам пост + изображение.",
    emotion: "celebrate",
    hotspots: [
      {
        selector: '[data-hotspot="studio-generate"]',
        label: "Сгенерировать",
        description: "AI создаст тексты для всех выбранных платформ",
      },
    ],
  },
  "/smm/ideas": {
    message:
      "Записывайте идеи на лету! Идеи можно перетащить в контент-план или добавить в проект кнопкой.",
    emotion: "think",
  },
  "/smm/hashtags": {
    message:
      "Хештеги и SEO-ключи - тайное оружие охватов. AI проанализирует нишу и подберёт лучшие!",
    emotion: "celebrate",
  },
  "/influencers": {
    message:
      "Ведите базу блогеров, отслеживайте ROI коллабораций и рейтинг каждого инфлюенсера.",
    emotion: "idle",
  },
  "/competitors": {
    message:
      "Знай врага в лицо! Добавляйте конкурентов, сравнивайте метрики и находите их слабые стороны.",
    emotion: "think",
  },
  "/competitor-spy": {
    message:
      "Competitor Spy - AI разведка! Я проанализирую стратегию конкурента и найду точки роста для вас.",
    emotion: "work",
  },
  "/ab-tests": {
    message:
      "A/B тесты - это как эксперименты, только прибыльные. Создайте гипотезу и проверьте на данных!",
    emotion: "think",
    hotspots: [
      {
        selector: '[data-hotspot="ab-tests-add"]',
        label: "Новый тест",
        description: "Создайте A/B тест с гипотезой и вариантами",
      },
    ],
  },
  "/unit-economics": {
    message:
      "Unit-экономика покажет, зарабатываете ли вы на каждом клиенте. CAC, LTV, маржа - всё тут.",
    emotion: "work",
  },
  "/media": {
    message:
      "Храните логотипы, шрифты, гайдлайны - всё, что делает бренд узнаваемым. Drag & drop файлов!",
    emotion: "idle",
  },
  "/brand-voice": {
    message:
      "Brand Voice - я запомню тональность вашего бренда и буду генерировать тексты в вашем стиле.",
    emotion: "love",
  },
  "/fatigue-detector": {
    message:
      "Fatigue Detector отслеживает усталость аудитории от контента. Я подскажу, когда пора менять формат!",
    emotion: "oops",
  },
  "/okr": {
    message:
      "OKR помогут синхронизировать маркетинг с бизнес-целями. Ставьте цели, отслеживайте прогресс!",
    emotion: "celebrate",
  },
  "/cjm": {
    message:
      "Customer Journey Map - путь клиента от первого касания до покупки. Найдите узкие места!",
    emotion: "think",
  },
  "/personas": {
    message:
      "Persona Builder создаст детальный портрет ЦА с помощью AI. Чем точнее - тем лучше конверсия!",
    emotion: "work",
  },
  "/campaign-storyline": {
    message:
      "Storyline поможет выстроить нарратив кампании: от тизера до кульминации. Расскажите историю!",
    emotion: "love",
  },
  "/content-scoring": {
    message:
      "Content Scoring оценит контент по 10+ метрикам. AI подскажет, что улучшить до публикации.",
    emotion: "think",
  },
  "/pricing": {
    message:
      "Тарифы MarketPlan! 🦊 Совет от Марка: начните с Демо, а когда AI-лимиты закончатся - переходите на Лайт.",
    emotion: "celebrate",
  },
  "/repurpose": {
    message:
      "Repurpose Engine переработает один пост в 5+ форматов для разных платформ. Экономия времени x5!",
    emotion: "celebrate",
  },
  "/tools/metrics": {
    message:
      "Проработка метрик - AI разберёт ваш бизнес и предложит KPI, которые реально влияют на прибыль.",
    emotion: "work",
  },
  "/tools/budget": {
    message:
      "Прогноз бюджета - я рассчитаю оптимальное распределение бюджета по каналам и прогноз ROI.",
    emotion: "think",
  },
  "/tools/audience": {
    message:
      "ЦА и аватары - AI создаст детальные портреты ваших клиентов для точного таргетинга.",
    emotion: "work",
  },
  "/tools/triggers": {
    message:
      "Триггеры из отзывов - AI найдёт болевые точки клиентов и превратит их в продающие аргументы.",
    emotion: "celebrate",
  },
  "/automations": {
    message:
      "Автоматизации избавят от рутины! Создайте цепочку действий - AI выполнит их по расписанию.",
    emotion: "work",
    hotspots: [
      {
        selector: '[data-hotspot="header-search"]',
        label: "Быстрый поиск",
        description: "Ctrl+K для поиска автоматизаций и шаблонов",
      },
    ],
  },
  "/integrations": {
    message:
      "Подключайте внешние сервисы: Telegram, аналитику, CRM. Всё в одном месте!",
    emotion: "idle",
  },
  "/notion": {
    message:
      "Notion Hub - мост между MarketPlan и вашим Notion. Синхронизируйте задачи и заметки!",
    emotion: "idle",
  },
  "/settings": {
    message:
      "Настройте MarketPlan под себя. Уведомления, интеграции, бэкап данных - всё здесь.",
    emotion: "idle",
    hotspots: [
      {
        selector: '[data-hotspot="header-help"]',
        label: "Помощь",
        description: "Документация и FAQ по MarketPlan",
      },
    ],
  },
};

/* ═══ Side assignment per route ═══ */
type BubbleSide = "left" | "right";

function routeSide(path: string): BubbleSide {
  let h = 0;
  for (let i = 0; i < path.length; i++)
    h = (h * 31 + path.charCodeAt(i)) | 0;
  return h % 2 === 0 ? "right" : "left";
}

const STORAGE_KEY = "mp:mascot:seen_tips";

function getSeenTips(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markSeen(path: string) {
  const seen = getSeenTips();
  seen.add(path);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

export function resetAllTips() {
  localStorage.removeItem(STORAGE_KEY);
}

/* ═══════════ Wobble keyframes ═══════════ */
const WOBBLE_ROTATE = [0, -2.5, 2, -1.2, 0.6, 0];
const WOBBLE_TRANSITION = {
  rotate: {
    duration: 0.7,
    ease: "easeOut" as const,
    times: [0, 0.15, 0.35, 0.55, 0.75, 1],
  },
  opacity: { type: "spring" as const, damping: 22, stiffness: 320 },
  y: { type: "spring" as const, damping: 22, stiffness: 320 },
  scale: { type: "spring" as const, damping: 22, stiffness: 320 },
};

/* ═══ Emotion to accent color mapping ═══ */
const EMOTION_COLORS: Record<MascotEmotion, string> = {
  idle: "#1a7a6d",
  wave: "#d4a373",
  think: "#5ba3c9",
  celebrate: "#d4a373",
  work: "#1a7a6d",
  oops: "#e07a5f",
  sleep: "#8a9bb0",
  love: "#e07a5f",
};

export function MascotTipProvider() {
  const location = useLocation();
  const [currentTip, setCurrentTip] = useState<
    (TipConfig & { path: string }) | null
  >(null);
  const [dismissed, setDismissed] = useState(false);
  const [spotlightTarget, setSpotlightTarget] =
    useState<SpotlightTarget | null>(null);

  const side = useMemo<BubbleSide>(() => {
    if (!currentTip) return "right";
    return routeSide(currentTip.path);
  }, [currentTip]);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/project/") || path === "/profile") return;

    const tip = TIPS[path];
    if (!tip) {
      setCurrentTip(null);
      return;
    }

    const seen = getSeenTips();
    if (seen.has(path)) {
      setCurrentTip(null);
      return;
    }

    setDismissed(false);
    setSpotlightTarget(null);
    const timer = setTimeout(() => {
      setCurrentTip({ ...tip, path });
      playPop();
    }, 800);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const dismiss = useCallback(() => {
    if (currentTip) {
      markSeen(currentTip.path);
      setDismissed(true);
      setSpotlightTarget(null);
      setTimeout(() => setCurrentTip(null), 350);
    }
  }, [currentTip]);

  // Extend auto-dismiss when spotlight is active
  useEffect(() => {
    if (!currentTip || dismissed) return;
    // Don't auto-dismiss if spotlight is active
    if (spotlightTarget) return;
    const timer = setTimeout(dismiss, 12000);
    return () => clearTimeout(timer);
  }, [currentTip, dismissed, dismiss, spotlightTarget]);

  const handleHotspotClick = useCallback(
    (target: SpotlightTarget) => {
      setSpotlightTarget(target);
    },
    []
  );

  const handleSpotlightClose = useCallback(() => {
    setSpotlightTarget(null);
  }, []);

  const isRight = side === "right";
  const hasHotspots =
    currentTip?.hotspots && currentTip.hotspots.length > 0;

  return (
    <>
      <AnimatePresence>
        {currentTip && !dismissed && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.85, rotate: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: WOBBLE_ROTATE }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={WOBBLE_TRANSITION}
            className="fixed bottom-6 z-[45]"
            style={{
              [isRight ? "right" : "left"]: 24,
              transformOrigin: isRight ? "bottom right" : "bottom left",
            }}
          >
            {/* ─── Speech Bubble + Mascot Container ─── */}
            <div
              className={`flex flex-col ${
                isRight ? "items-end" : "items-start"
              }`}
            >
              {/* ─── Cloud Bubble ─── */}
              <SpeechBubble
                side={side}
                size="md"
                accentColor={EMOTION_COLORS[currentTip.emotion]}
                progressDuration={spotlightTarget ? 0 : 12}
                showDots
                className="max-w-[360px]"
              >
                {/* Close */}
                <button
                  onClick={dismiss}
                  className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-1.5 mb-2 pr-6">
                  <span className="text-[14px] leading-none">🦊</span>
                  <span className="text-[11px] font-bold text-[#d4a373] tracking-wide uppercase">
                    Марк подсказывает
                  </span>
                </div>

                {/* Message */}
                <p className="text-[12.5px] text-foreground leading-[1.6] pr-2">
                  {currentTip.message}
                </p>

                {/* ─── Interactive Hotspots ─── */}
                {hasHotspots && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-border/50">
                    {currentTip.hotspots!.map((hs, i) => (
                      <HotspotDot
                        key={hs.selector}
                        target={hs}
                        onClick={handleHotspotClick}
                        index={i}
                      />
                    ))}
                  </div>
                )}

                {/* Dismiss link */}
                <button
                  onClick={dismiss}
                  className="mt-3 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  Понятно, спасибо!
                </button>
              </SpeechBubble>

              {/* ─── Mascot beneath the tail ─── */}
              <motion.div
                initial={{ scale: 0, rotate: isRight ? -20 : 20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  damping: 14,
                  stiffness: 200,
                  delay: 0.15,
                }}
                className={`${isRight ? "mr-3" : "ml-3"} mt-3 cursor-pointer`}
                onClick={dismiss}
                title="Закрыть подсказку"
              >
                <Mascot emotion={currentTip.emotion} size={58} animate />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Spotlight Overlay (renders above everything) ─── */}
      <SpotlightOverlay
        target={spotlightTarget}
        onClose={handleSpotlightClose}
      />
    </>
  );
}