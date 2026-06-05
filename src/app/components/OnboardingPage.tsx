/**
 * OnboardingPage - публичная страница онбординга и тарифов MarketPlan
 */
import { useState } from "react";
import { motion } from "motion/react";
import {
  Check, X, Zap, Crown, Eye, ChevronRight,
  LayoutDashboard, Target, Gauge, PlayCircle, FolderKanban, Sparkles,
} from "lucide-react";
import { Mascot } from "./Mascot";

/* ─── Types ─── */
interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  icon: any;
  color: string;
  gradient: string;
  badge?: string;
  features: string[];
  limitations: string[];
  cta: string;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "start",
    name: "Старт",
    price: 500,
    period: "/ месяц",
    description: "Базовый доступ для тех, кто хочет начать планировать маркетинг без AI-функций.",
    icon: Zap,
    color: "#d4a373",
    gradient: "from-[#d4a373] to-[#c08a40]",
    badge: "Хороший старт",
    popular: true,
    features: [
      "до 2 проектов",
      "маркетинговый календарь",
      "планирование задач и идей",
      "аналитика и экспорт",
    ],
    limitations: [
      "без AI-инструментов",
    ],
    cta: "Выбрать Старт",
  },
  {
    id: "pro",
    name: "Про",
    price: 700,
    period: "/ месяц",
    description: "Полный доступ ко всем функциям, включая AI-инструменты и командную работу.",
    icon: Crown,
    color: "#1a7a6d",
    gradient: "from-[#1a7a6d] to-[#0d7377]",
    badge: "Лучший выбор",
    features: [
      "безлимит проектов",
      "все AI-инструменты",
      "командная работа",
      "приоритетная поддержка",
    ],
    limitations: [],
    cta: "Перейти на Про",
  },
  {
    id: "pro-plus",
    name: "Про+",
    price: 1500,
    period: "/ 3 месяца",
    description: "Всё из Про, но оплата раз в квартал. Экономия 600 ₽ по сравнению с ежемесячной оплатой.",
    icon: Sparkles,
    color: "#7c3aed",
    gradient: "from-[#7c3aed] to-[#5b21b6]",
    badge: "Выгода 600 ₽",
    features: [
      "всё из тарифа Про",
      "оплата раз в 3 месяца",
      "≈ 500 ₽ в месяц",
    ],
    limitations: [],
    cta: "Взять Про+ на квартал",
  },
];

/* ─── Features & Problem sections ─── */
const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Проекты",
    desc: "Разделяйте маркетинг по проектам: отдельный бренд, запуск, клиент или направление. Так всё остаётся в порядке, а нужные задачи не смешиваются между собой.",
  },
  {
    icon: Target,
    title: "Структура маркетингового плана",
    desc: "Не просто список задач, а понятная структура: что нужно сделать, зачем, в какой последовательности и к какому результату это должно привести.",
  },
  {
    icon: PlayCircle,
    title: "Задачи и шаги",
    desc: "Каждую идею можно превратить в конкретный шаг: что сделать, когда, для чего и в рамках какого проекта.",
  },
  {
    icon: Gauge,
    title: "Контроль выполнения",
    desc: "Видно, что уже сделано, что в процессе, а что ещё требует внимания. Это помогает не терять фокус и двигаться по плану.",
  },
  {
    icon: Zap,
    title: "Контент и кампании",
    desc: "Планируйте контент, акции, рассылки, рекламные активности и запуски в одной системе - без разбросанных заметок и забытых идей.",
  },
  {
    icon: Check,
    title: "Приоритеты",
    desc: "Выделяйте главное и не распыляйтесь. Marketing Planer помогает видеть, какие действия действительно двигают проект вперёд.",
  },
  {
    icon: FolderKanban,
    title: "Несколько проектов",
    desc: "Ведите несколько направлений отдельно: личный бренд, бизнес, клиентские проекты, запуски или разные продукты.",
  },
  {
    icon: Sparkles,
    title: "Простота",
    desc: "Без перегруза, сложных CRM и десятков лишних кнопок. Только то, что нужно, чтобы планировать маркетинг и действовать.",
  },
];

const HOW_IT_WORKS = [
  { step: "1", text: "Создайте проект", desc: "Определите бренд, направление или кампанию для структурированной работы" },
  { step: "2", text: "Добавьте идеи и задачи", desc: "Соберите все идеи в одном месте и превратите их в конкретные действия" },
  { step: "3", text: "Разбейте план на понятные шаги", desc: "Создайте чёткую последовательность работ с приоритетами и сроками" },
  { step: "4", text: "Двигайтесь по структуре и отслеживайте прогресс", desc: "Контролируйте выполнение и видьте, что реально продвигает проект" },
];

const FOR_WHO = [
  { role: "Маркетологам", desc: "Чтобы вести кампании, идеи и задачи в одном рабочем пространстве." },
  { role: "Предпринимателям", desc: "Чтобы видеть маркетинг бизнеса системно, а не держать всё в голове." },
  { role: "Фрилансерам и экспертам", desc: "Чтобы планировать продвижение, контент и клиентские проекты отдельно." },
  { role: "Командам", desc: "Чтобы быстрее договориться, что делаем, зачем и в какой последовательности." },
];

/* ─── Component ─── */
export function OnboardingPage() {
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleCta = (planId: string) => {
    if (planId === "demo") {
      window.location.href = "/app";
    } else {
      // В реальном проекте - интеграция с платёжной системой
      // Доступ открывается ТОЛЬКО после payment.succeeded
      window.location.href = "/app";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1120px] mx-auto px-4 md:px-6 py-8 md:py-12 space-y-20 md:space-y-24">

        {/* 1. HERO */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <Mascot emotion="celebrate" size={96} className="mx-auto" />
          <div className="space-y-3">
            <h1 className="text-[32px] md:text-[44px] font-bold text-foreground leading-tight">
              Маркетинг без хаоса: от идеи до понятного плана
            </h1>
            <p className="text-muted-foreground text-[15px] md:text-[16px] max-w-[620px] mx-auto leading-relaxed">
              Собирайте идеи, планируйте кампании, разбивайте задачи на шаги и контролируйте продвижение - без таблиц, хаоса и бесконечных заметок
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => window.location.href = "/app"}
              className="px-6 py-3 rounded-xl text-white font-semibold text-[14px] transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
              style={{ background: "linear-gradient(135deg, #d4a373 0%, #c08a40 100%)" }}
            >
              Начать бесплатно
            </button>
            <button
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="px-6 py-3 rounded-xl bg-muted text-foreground font-medium text-[14px] transition-all hover:bg-muted/80 active:scale-[0.98]"
            >
              Посмотреть тарифы
            </button>
          </div>
        </motion.section>

        {/* 2. VALUE BLOCK */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-[780px] mx-auto"
        >
          <div className="bg-card border border-border rounded-2xl p-8 md:p-10 space-y-5">
            <h2 className="text-[20px] md:text-[24px] font-bold text-foreground text-center">
              Marketing Planer помогает:
            </h2>
            <div className="space-y-3">
              {[
                "видеть всю маркетинговую картину целиком",
                "не терять идеи и задачи",
                "превращать хаотичные заметки в конкретный план",
                "вести несколько проектов отдельно",
                "быстрее переходить от «надо что-то сделать» к понятным действиям",
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <Check className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                  <p className="text-[15px] text-foreground leading-relaxed">{item}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* 3. ПРОБЛЕМА → РЕЗУЛЬТАТ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="max-w-[880px] mx-auto"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Before */}
            <div className="bg-card border border-border rounded-2xl p-6 md:p-7 space-y-4">
              <div className="flex items-center gap-2">
                <X className="w-5 h-5 text-red-500/80" />
                <h3 className="text-[16px] font-semibold text-foreground">Было</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  "идеи разбросаны по заметкам",
                  "задачи теряются",
                  "непонятно, с чего начать",
                  "маркетинг делается рывками",
                  "нет общей картины",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[14px] text-muted-foreground">
                    <span className="text-red-500/60 shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* After */}
            <div className="bg-card border border-border rounded-2xl p-6 md:p-7 space-y-4">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-primary" />
                <h3 className="text-[16px] font-semibold text-foreground">Стало</h3>
              </div>
              <ul className="space-y-2.5">
                {[
                  "всё собрано в одном месте",
                  "каждый проект имеет структуру",
                  "задачи понятны",
                  "легче держать фокус",
                  "проще доводить идеи до результата",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[14px] text-foreground">
                    <span className="text-primary shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        {/* 4. ВОЗМОЖНОСТИ */}
        <section className="space-y-8">
          <h2 className="text-[24px] md:text-[28px] font-bold text-foreground text-center">
            Что внутри
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="bg-card border border-border rounded-xl p-5 md:p-6 space-y-3 hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-foreground">{f.title}</h3>
                  <p className="text-[13.5px] text-muted-foreground leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* 5. КАК ЭТО РАБОТАЕТ */}
        <section className="max-w-[720px] mx-auto space-y-6">
          <h2 className="text-[24px] md:text-[28px] font-bold text-foreground text-center">
            Как это работает
          </h2>
          <div className="space-y-4">
            {HOW_IT_WORKS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.08 }}
                className="bg-card border border-border rounded-xl p-5 md:p-6"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-[16px] shrink-0"
                    style={{ background: "linear-gradient(135deg, #d4a373 0%, #c08a40 100%)" }}
                  >
                    {item.step}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-[15px] text-foreground font-semibold">{item.text}</p>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 6. ДЛЯ КОГО */}
        <section className="max-w-[840px] mx-auto space-y-6">
          <h2 className="text-[24px] md:text-[28px] font-bold text-foreground text-center">
            Для кого
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FOR_WHO.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="bg-card border border-border rounded-xl p-5 md:p-6 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4.5 h-4.5 text-primary shrink-0" />
                  <h3 className="text-[15px] font-semibold text-foreground">{item.role}</h3>
                </div>
                <p className="text-[13.5px] text-muted-foreground leading-relaxed pl-6.5">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 7. ТАРИФЫ */}
        <section className="space-y-8" id="pricing">
          <div className="text-center space-y-2">
            <h2 className="text-[24px] md:text-[32px] font-bold text-foreground">
              Тарифы
            </h2>
            <p className="text-muted-foreground text-[14px] max-w-[520px] mx-auto">
              Старт - без AI. Про - всё включено. Про+ - квартал со скидкой.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 max-w-[960px] mx-auto">
            {PLANS.map((plan, i) => {
              const Icon = plan.icon;
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  className={`relative bg-card border rounded-2xl overflow-hidden flex flex-col ${
                    plan.popular ? "border-[#d4a373] shadow-lg shadow-[#d4a373]/15 scale-[1.03]" : "border-border"
                  }`}
                >
                  {plan.badge && (
                    <div
                      className="absolute top-0 right-0 text-[10px] font-semibold text-white px-3 py-1.5 rounded-bl-xl z-10"
                      style={{ background: plan.color }}
                    >
                      {plan.badge}
                    </div>
                  )}

                  <div className="p-6 space-y-4">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center`}
                    >
                      <Icon className="w-5.5 h-5.5 text-white" />
                    </div>

                    <div>
                      <h3 className="text-[18px] font-bold text-foreground mb-2">{plan.name}</h3>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">{plan.description}</p>
                    </div>

                    <div className="pt-2">
                      {plan.price === 0 ? (
                        <div className="text-[32px] font-bold text-foreground">0 ₽</div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-[32px] font-bold text-foreground">
                            {plan.price.toLocaleString("ru-RU")} ₽
                          </span>
                          {plan.period && (
                            <span className="text-muted-foreground text-[13px]">{plan.period}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mx-6 border-t border-border" />

                  <div className="p-6 pt-5 flex-1 space-y-3">
                    {plan.features.map((f, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                        <span className="text-[13px] text-foreground">{f}</span>
                      </div>
                    ))}
                    {plan.limitations.map((l, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <X className="w-4 h-4 mt-0.5 text-muted-foreground/50 shrink-0" />
                        <span className="text-[13px] text-muted-foreground/70 line-through">{l}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-6 pt-3">
                    <button
                      onClick={() => handleCta(plan.id)}
                      className={`w-full py-3 rounded-xl text-[14px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] ${
                        plan.popular
                          ? "text-white shadow-md"
                          : plan.id === "demo"
                          ? "bg-muted text-foreground hover:bg-muted/80"
                          : "text-white"
                      }`}
                      style={
                        plan.id !== "demo"
                          ? { background: `linear-gradient(135deg, ${plan.color}, ${plan.color}dd)` }
                          : undefined
                      }
                    >
                      {plan.cta}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* 8. UPGRADE MOTIVATION */}
        <section className="max-w-[720px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-gradient-to-br from-primary/5 to-[#d4a373]/5 border border-border rounded-2xl p-7 md:p-9 text-center space-y-4"
          >
            <p className="text-foreground text-[15.5px] md:text-[17px] font-medium leading-relaxed">
              Старт - без AI. Про - всё включено. Про+ - квартал со скидкой.
            </p>
            <p className="text-muted-foreground text-[14px] leading-relaxed max-w-[580px] mx-auto">
              Если маркетинг - часть вашей ежедневной работы, безлимит проектов быстро становится не удобством, а необходимостью.
            </p>
          </motion.div>
        </section>

        {/* 9. ФИНАЛЬНЫЙ CTA */}
        <section className="max-w-[720px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border rounded-2xl p-8 md:p-10 text-center space-y-6"
          >
            <Mascot emotion="wave" size={80} className="mx-auto" />
            <div className="space-y-3">
              <h2 className="text-[23px] md:text-[28px] font-bold text-foreground leading-tight">
                Соберите маркетинг в понятную систему
              </h2>
              <p className="text-muted-foreground text-[14.5px] leading-relaxed max-w-[580px] mx-auto">
                Начните с демо или сразу создайте первые проекты - Marketing Planer поможет превратить идеи в действия
              </p>
            </div>
            <button
              onClick={() => window.location.href = "/app"}
              className="px-8 py-3.5 rounded-xl text-white font-semibold text-[15px] transition-all hover:opacity-90 active:scale-[0.98] shadow-lg mx-auto flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #d4a373 0%, #c08a40 100%)" }}
            >
              Начать сейчас
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </motion.div>
        </section>

      </div>{/* end max-w content */}

      {/* FOOTER */}
      <footer className="border-t border-border py-6 px-6 text-center">
        <p className="text-[12px] text-muted-foreground">
          © {new Date().getFullYear()} MarketPlan · {" "}
          <button
            onClick={() => setShowPrivacy(true)}
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Политика конфиденциальности
          </button>
        </p>
      </footer>

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPrivacy(false)}>
          <div className="bg-card border border-border rounded-2xl max-w-[600px] w-full max-h-[80vh] overflow-y-auto p-8 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-foreground">Политика конфиденциальности</h2>
              <button onClick={() => setShowPrivacy(false)} className="text-muted-foreground hover:text-foreground text-[20px] leading-none">×</button>
            </div>
            <div className="space-y-4 text-[13px] text-muted-foreground leading-relaxed">
              <p className="text-[12px] text-muted-foreground/60">Последнее обновление: {new Date().toLocaleDateString("ru-RU")}</p>
              <section className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">1. Общие положения</h3>
                <p>Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей сервиса MarketPlan. Используя сервис, вы соглашаетесь с условиями настоящей Политики.</p>
              </section>
              <section className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">2. Какие данные мы собираем</h3>
                <p>Мы собираем данные, которые вы предоставляете при регистрации: адрес электронной почты и имя. В процессе использования сервиса автоматически фиксируются данные об активности: просматриваемые страницы, используемые функции и временные метки действий.</p>
              </section>
              <section className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">3. Цели обработки данных</h3>
                <p>Данные используются для предоставления функций сервиса, улучшения продукта, отправки уведомлений, связанных с работой аккаунта, а также для технической поддержки.</p>
              </section>
              <section className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">4. Передача данных третьим лицам</h3>
                <p>Мы не продаём и не передаём ваши персональные данные третьим лицам, за исключением случаев, предусмотренных законодательством, или с вашего явного согласия. Для хранения данных используется инфраструктура Supabase с серверами в соответствии с GDPR.</p>
              </section>
              <section className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">5. Хранение данных</h3>
                <p>Данные хранятся в течение всего срока действия вашего аккаунта. После удаления аккаунта данные удаляются в течение 30 дней, если иное не предусмотрено законодательством.</p>
              </section>
              <section className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">6. Ваши права</h3>
                <p>Вы вправе запросить доступ к своим данным, их исправление или удаление. Для этого свяжитесь с нами через форму обратной связи внутри сервиса.</p>
              </section>
              <section className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">7. Cookie</h3>
                <p>Сервис использует cookies для обеспечения работы авторизации и аналитики. Вы можете отключить cookies в настройках браузера, однако это может повлиять на работу отдельных функций.</p>
              </section>
              <section className="space-y-1.5">
                <h3 className="text-[14px] font-semibold text-foreground">8. Изменения политики</h3>
                <p>Мы оставляем за собой право обновлять настоящую Политику. Актуальная версия всегда доступна на этой странице. Продолжение использования сервиса после изменений означает ваше согласие с новой редакцией.</p>
              </section>
            </div>
            <button
              onClick={() => setShowPrivacy(false)}
              className="w-full py-2.5 rounded-xl bg-muted hover:bg-muted/70 text-foreground text-[13px] font-medium transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
