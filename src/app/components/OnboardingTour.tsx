/**
 * 🦊 Марк — Онбординг-тур для новых пользователей.
 * 
 * Показывается один раз при первом входе (localStorage-флаг).
 * 7 шагов с анимацией, разными эмоциями маскота и описанием ключевых фич.
 * Можно перезапустить из настроек.
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, ChevronLeft, X, Rocket, SkipForward } from "lucide-react";
import { useNavigate } from "react-router";
import { Mascot, type MascotEmotion } from "./Mascot";
import { SpeechBubble } from "./SpeechBubble";
import { playStep, playCelebrate, playWave } from "../lib/mascot-sounds";

/* ═══ Tour steps ═══ */
interface TourStep {
  title: string;
  description: string;
  emotion: MascotEmotion;
  highlight?: string; // path to navigate to on this step
  badge?: string;
  color: string;
}

const STEPS: TourStep[] = [
  {
    title: "Добро пожаловать в MarketPlan! 🎉",
    description: "Я Марк — ваш персональный маркетинг-лисёнок. Проведу быстрый тур по основным возможностям. Это займёт меньше минуты!",
    emotion: "wave",
    color: "#d4a373",
  },
  {
    title: "📊 Проекты и Аналитика",
    description: "Создавайте проекты с бюджетами, каналами и KPI. Кастомизируйте дашборд — перетаскивайте виджеты, скрывайте ненужные. Всё как в Amplitude, только для маркетинга!",
    emotion: "work",
    highlight: "/dashboard",
    badge: "Дашборд",
    color: "#1a7a6d",
  },
  {
    title: "📝 Контент и SMM",
    description: "Контент-план с drag & drop, AI-генерация постов в Content Studio (включая картинки через DALL-E 3), банк идей, хештеги и SEO. Весь контент — в одном месте.",
    emotion: "celebrate",
    highlight: "/smm/plan",
    badge: "Контент",
    color: "#d4a373",
  },
  {
    title: "🤖 AI Инструменты",
    description: "6+ AI-модулей: проработка метрик, прогноз бюджета, портреты ЦА, триггеры из отзывов, Brand Voice, Content Scoring. Каждый результат можно добавить в проект!",
    emotion: "think",
    highlight: "/tools/metrics",
    badge: "AI",
    color: "#0d7377",
  },
  {
    title: "📅 Календарь и Автоматизации",
    description: "Маркетинговый календарь объединяет события из всех модулей. Автоматизации выполняют цепочки действий по расписанию — от генерации до публикации.",
    emotion: "idle",
    highlight: "/calendar",
    badge: "Календарь",
    color: "#2d6a4f",
  },
  {
    title: "⚔️ Конкуренты и Стратегия",
    description: "Анализ конкурентов, A/B тесты, OKR-трекинг, Customer Journey Map, Persona Builder, Campaign Storyline. Стройте стратегию на данных, а не на догадках!",
    emotion: "love",
    highlight: "/competitors",
    badge: "Стратегия",
    color: "#c08a40",
  },
  {
    title: "🚀 Вы готовы!",
    description: "Используйте Ctrl+K для быстрого поиска, Ctrl+J для AI-чата, правый клик в сайдбаре для избранного. Я буду рядом — подсказывать при первом посещении каждого модуля. Удачи!",
    emotion: "celebrate",
    color: "#1a7a6d",
  },
];

const STORAGE_KEY = "mp:onboarding:completed";

export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isOnboardingCompleted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      // Delay slightly for initial page load
      const t = setTimeout(() => {
        setActive(true);
        playWave();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setActive(false);
    navigate("/");
  }, [navigate]);

  const skip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setActive(false);
  }, []);

  const nextStep = useCallback(() => {
    if (step < STEPS.length - 1) {
      const next = step + 1;
      setStep(next);
      playStep();
      if (STEPS[next].highlight) {
        navigate(STEPS[next].highlight!);
      }
    } else {
      playCelebrate();
      complete();
    }
  }, [step, navigate, complete]);

  const prevStep = useCallback(() => {
    if (step > 0) {
      const prev = step - 1;
      setStep(prev);
      if (STEPS[prev].highlight) {
        navigate(STEPS[prev].highlight!);
      }
    }
  }, [step, navigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); nextStep(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prevStep(); }
      if (e.key === "Escape") { e.preventDefault(); skip(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, nextStep, prevStep, skip]);

  if (!active) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={skip} />

        {/* Card */}
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[480px] mx-4"
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Top gradient bar */}
            <div
              className="h-1.5"
              style={{
                background: `linear-gradient(90deg, ${current.color}, ${current.color}88)`,
              }}
            />

            {/* Skip button */}
            {!isLast && (
              <button
                onClick={skip}
                className="absolute top-4 right-4 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors z-10"
              >
                <SkipForward className="w-3 h-3" />
                Пропустить тур
              </button>
            )}

            {/* Content */}
            <div className="px-8 pt-8 pb-6">
              {/* Mascot */}
              <div className="flex flex-col items-center mb-5">
                <motion.div
                  key={`mascot-${step}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.15, damping: 15 }}
                >
                  <Mascot emotion={current.emotion} size={isFirst || isLast ? 130 : 100} sound />
                </motion.div>
              </div>

              {/* Badge */}
              {current.badge && (
                <div className="flex justify-center mb-3">
                  <span
                    className="px-3 py-1 rounded-full text-[11px] font-semibold text-white"
                    style={{ background: current.color }}
                  >
                    {current.badge}
                  </span>
                </div>
              )}

              {/* Title */}
              <motion.h2
                key={`title-${step}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-[20px] font-bold text-foreground text-center mb-3"
              >
                {current.title}
              </motion.h2>

              {/* Description */}
              <motion.div
                key={`desc-${step}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center"
              >
                <SpeechBubble side="left" size="sm" accentColor={current.color} className="max-w-[380px]">
                  <p className="text-[13.5px] text-foreground leading-relaxed text-center">
                    {current.description}
                  </p>
                </SpeechBubble>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="px-8 pb-6">
              {/* Progress dots */}
              <div className="flex items-center justify-center gap-2 mb-5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setStep(i);
                      if (STEPS[i].highlight) navigate(STEPS[i].highlight!);
                    }}
                    className="transition-all"
                  >
                    <div
                      className={`rounded-full transition-all duration-300 ${
                        i === step ? "w-6 h-2" : "w-2 h-2"
                      }`}
                      style={{
                        background: i === step ? current.color : i < step ? `${current.color}60` : "var(--muted)",
                      }}
                    />
                  </button>
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between gap-3">
                {!isFirst ? (
                  <button
                    onClick={prevStep}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Назад
                  </button>
                ) : (
                  <div />
                )}

                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${current.color}, ${current.color}cc)`,
                    boxShadow: `0 4px 16px ${current.color}40`,
                  }}
                >
                  {isLast ? (
                    <>
                      <Rocket className="w-4 h-4" />
                      Начать работу!
                    </>
                  ) : (
                    <>
                      Далее
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Keyboard hint */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono">←→</kbd>
                  навигация
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono">Esc</kbd>
                  пропустить
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}