/**
 * 🦊 OnboardingTour - полностью переработанный онбординг
 * Иммерсивный опыт: welcome-экран → 4 feature-карточки → quick-start
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronRight, ChevronLeft, X, Sparkles, Calendar,
  FolderKanban, Wand2, BarChart3, Command, MessageCircle,
  ArrowRight, CheckCircle2, Zap, Users, Target,
} from "lucide-react";
import { Mascot } from "./Mascot";
import { playCelebrate, playWave } from "../lib/mascot-sounds";

const STORAGE_KEY = "mp:onboarding:completed";

export function resetOnboarding() { localStorage.removeItem(STORAGE_KEY); }
export function isOnboardingCompleted(): boolean { return localStorage.getItem(STORAGE_KEY) === "true"; }

/* ─── Feature cards for steps 1-4 ─── */
const FEATURES = [
  {
    id: "projects",
    icon: FolderKanban,
    color: "#1a7a6d",
    bg: "from-[#1a7a6d]/20 to-[#2eb8a4]/5",
    badge: "Основа",
    title: "Проекты и дашборд",
    desc: "Создайте проект - добавьте бюджет, KPI, кампании. Дашборд с виджетами кастомизируется под вас.",
    details: ["Бюджет и расходы с прогрессом", "Воронка конверсий", "Метрики и аудитории", "Привязка всех модулей"],
  },
  {
    id: "ai",
    icon: Sparkles,
    color: "#d4a373",
    bg: "from-[#d4a373]/20 to-[#c08a40]/5",
    badge: "AI",
    title: "6 AI-инструментов",
    desc: "GPT-4o-mini и DALL-E 3 на каждом шаге: от идей до публикации, от аналитики до стратегии.",
    details: ["Content Studio + DALL-E 3", "Brand Voice Engine", "Persona Builder", "Campaign Storyline"],
  },
  {
    id: "calendar",
    icon: Calendar,
    color: "#0d7377",
    bg: "from-[#0d7377]/20 to-[#2eb8a4]/5",
    badge: "Планирование",
    title: "Контент и календарь",
    desc: "Контент-план с drag & drop, единый маркетинговый календарь, репёрпозирование и scoring постов.",
    details: ["Контент-план по платформам", "Маркетинговый календарь", "Repurpose Engine", "Content Scoring"],
  },
  {
    id: "strategy",
    icon: Target,
    color: "#2d6a4f",
    bg: "from-[#2d6a4f]/20 to-[#1a7a6d]/5",
    badge: "Стратегия",
    title: "OKR, CJM и конкуренты",
    desc: "Отслеживайте цели, стройте карту пути клиента, следите за конкурентами и запускайте A/B тесты.",
    details: ["OKR-трекинг по кварталам", "Customer Journey Map", "Competitor Spy", "A/B тесты"],
  },
];

/* ─── Quick start checklist ─── */
const QUICK_START = [
  { icon: FolderKanban, text: "Создайте первый проект", path: "/" },
  { icon: Wand2, text: "Попробуйте Content Studio", path: "/content-studio" },
  { icon: Calendar, text: "Добавьте пост в Контент-план", path: "/smm/plan" },
  { icon: Users, text: "Сгенерируйте персоны ЦА", path: "/personas" },
  { icon: BarChart3, text: "Настройте OKR на квартал", path: "/okr" },
];

/* ─── Step 0: Welcome ─── */
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col items-center text-center px-8 pt-10 pb-8"
    >
      {/* Animated mascot */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.1 }}
        className="relative mb-6"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#d4a373]/30 to-[#1a7a6d]/20 blur-2xl scale-150" />
        <Mascot emotion="wave" size={120} sound />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="inline-flex items-center gap-1.5 bg-[#d4a373]/10 text-[#c08a40] border border-[#d4a373]/20 px-3 py-1 rounded-full text-[11px] font-semibold mb-3 tracking-wide uppercase">
          <Sparkles className="w-3 h-3" />
          MarketPlan
        </div>
        <h1 className="text-[26px] font-bold text-foreground mb-3 leading-tight">
          Привет! Я Марк 🦊
        </h1>
        <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[320px] mx-auto">
          Ваш AI-помощник в маркетинге. Покажу возможности платформы за&nbsp;
          <span className="text-foreground font-medium">30 секунд</span> - обещаю, будет интересно!
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-7 w-full space-y-2"
      >
        <button
          onClick={onNext}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #d4a373 0%, #c08a40 100%)" }}
        >
          Погнали! <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-[11px] text-muted-foreground">← / → для навигации · Esc для пропуска</p>
      </motion.div>
    </motion.div>
  );
}

/* ─── Steps 1-4: Feature slides ─── */
function FeatureStep({ feature, direction }: { feature: typeof FEATURES[0]; direction: number }) {
  const Icon = feature.icon;
  return (
    <motion.div
      key={feature.id}
      initial={{ opacity: 0, x: direction * 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction * -40 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="px-7 pt-6 pb-5"
    >
      {/* Feature header */}
      <div className={`rounded-2xl bg-gradient-to-br ${feature.bg} p-5 mb-5`}>
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
            style={{ background: `linear-gradient(135deg, ${feature.color}dd, ${feature.color}88)` }}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: feature.color + "22", color: feature.color }}
              >
                {feature.badge}
              </span>
            </div>
            <h2 className="text-[18px] font-bold text-foreground leading-tight">{feature.title}</h2>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{feature.desc}</p>
          </div>
        </div>
      </div>

      {/* Detail list */}
      <div className="grid grid-cols-2 gap-2">
        {feature.details.map((detail, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.2 }}
            className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2"
          >
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: feature.color }} />
            <span className="text-[12px] text-foreground">{detail}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Step 5: Quick start ─── */
function QuickStartStep({ direction }: { direction: number }) {
  return (
    <motion.div
      key="quickstart"
      initial={{ opacity: 0, x: direction * 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction * -40 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="px-7 pt-6 pb-5"
    >
      <div className="flex justify-center mb-5">
        <Mascot emotion="celebrate" size={92} sound />
      </div>

      <h2 className="text-[20px] font-bold text-foreground text-center mb-1">Вы готовы!</h2>
      <p className="text-[13px] text-muted-foreground text-center mb-5">
        Вот что сделать в первую очередь:
      </p>

      <div className="space-y-2 mb-5">
        {QUICK_START.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.22 }}
            className="flex items-center gap-3 bg-muted/40 hover:bg-muted/60 rounded-xl px-4 py-3 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[13px] text-foreground flex-1">{item.text}</span>
            <div className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center shrink-0">
              <div className="w-2 h-2 rounded-full" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Keyboard shortcuts */}
      <div className="bg-muted/30 rounded-xl p-3 flex items-center justify-around text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <kbd className="bg-card border border-border px-1.5 py-0.5 rounded text-[10px] font-mono">Ctrl K</kbd>
          <span>Поиск</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <kbd className="bg-card border border-border px-1.5 py-0.5 rounded text-[10px] font-mono">Ctrl J</kbd>
          <span>AI-чат</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5">
          <Command className="w-3 h-3" />
          <span>Марк помогает</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══ MAIN COMPONENT ═══ */
export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0); // 0 = welcome, 1-4 = features, 5 = quickstart
  const [direction, setDirection] = useState(1);
  const totalSteps = FEATURES.length + 2; // welcome + 4 features + quickstart

  useEffect(() => {
    if (!isOnboardingCompleted()) {
      const t = setTimeout(() => { setActive(true); playWave(); }, 900);
      return () => clearTimeout(t);
    }
  }, []);

  const close = useCallback((completed = false) => {
    localStorage.setItem(STORAGE_KEY, "true");
    setActive(false);
    if (completed) playCelebrate();
  }, []);

  const next = useCallback(() => {
    if (step < totalSteps - 1) {
      setDirection(1);
      setStep(s => s + 1);
    } else {
      close(true);
    }
  }, [step, totalSteps, close]);

  const prev = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  }, [step]);

  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || (e.key === "Enter" && step > 0)) { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, next, prev, close, step]);

  const isLast = step === totalSteps - 1;
  const isWelcome = step === 0;
  const isQuickStart = step === totalSteps - 1;
  const featureIdx = step - 1; // 0..3
  const currentFeature = featureIdx >= 0 && featureIdx < FEATURES.length ? FEATURES[featureIdx] : null;

  // Progress percent (excluding welcome step from bar)
  const progressSteps = totalSteps - 1;
  const progressPct = step === 0 ? 0 : Math.round((step / progressSteps) * 100);
  const barColor = currentFeature?.color ?? (isQuickStart ? "#2d6a4f" : "#d4a373");

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
            onClick={() => close()}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="relative w-full max-w-[460px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Progress bar */}
            <div className="h-[3px] bg-muted/60 relative">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${progressPct}%`, backgroundColor: barColor }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={() => close()}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors z-10"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content */}
            <div className="min-h-[360px]">
              <AnimatePresence mode="wait" custom={direction}>
                {isWelcome ? (
                  <WelcomeStep key="welcome" onNext={next} />
                ) : isQuickStart ? (
                  <QuickStartStep key="quickstart" direction={direction} />
                ) : currentFeature ? (
                  <FeatureStep key={currentFeature.id} feature={currentFeature} direction={direction} />
                ) : null}
              </AnimatePresence>
            </div>

            {/* Footer nav (не на welcome) */}
            {!isWelcome && (
              <div className="flex items-center justify-between px-7 pb-5 pt-2">
                {/* Dot indicators */}
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: progressSteps }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setDirection(i + 1 > step ? 1 : -1); setStep(i + 1); }}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i + 1 === step ? 20 : 6,
                        height: 6,
                        background: i + 1 === step ? barColor : i + 1 < step ? barColor + "66" : "var(--border)",
                      }}
                    />
                  ))}
                </div>

                {/* Prev / Next */}
                <div className="flex items-center gap-2">
                  {step > 1 && (
                    <button
                      onClick={prev}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={isLast ? () => close(true) : next}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ background: `linear-gradient(135deg, ${barColor}ee, ${barColor}aa)` }}
                  >
                    {isLast ? (
                      <><CheckCircle2 className="w-4 h-4" /> Начать работу</>
                    ) : (
                      <>Далее <ChevronRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}