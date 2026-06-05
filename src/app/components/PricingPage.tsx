/**
 * PricingPage - страница онбординга и тарифов MarketPlan
 */
import { useState } from "react";
import { motion } from "motion/react";
import {
  Check, X, Zap, Crown, Eye, Sparkles, ChevronRight,
  LayoutDashboard, Target, Gauge, PlayCircle,
} from "lucide-react";
import { useNavigate } from "react-router";
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
    description: "Базовый доступ без AI",
    icon: Zap,
    color: "#d4a373",
    gradient: "from-[#d4a373] to-[#c08a40]",
    badge: "Лучший старт",
    popular: true,
    features: [
      "До 2 проектов",
      "Маркетинговый календарь",
      "Планирование задач и идей",
      "Аналитика и экспорт",
    ],
    limitations: [
      "Без AI-инструментов",
    ],
    cta: "Начать",
  },
  {
    id: "pro",
    name: "Про",
    price: 700,
    period: "/ месяц",
    description: "Полный доступ ко всему",
    icon: Crown,
    color: "#1a7a6d",
    gradient: "from-[#1a7a6d] to-[#0d7377]",
    features: [
      "Безлимит проектов",
      "Все AI-инструменты",
      "Командная работа",
      "Приоритетная поддержка",
    ],
    limitations: [],
    cta: "Перейти на Про",
  },
  {
    id: "pro-plus",
    name: "Про+",
    price: 1500,
    period: "/ 3 месяца",
    description: "Полный доступ на квартал · ~500 ₽/мес",
    icon: Sparkles,
    color: "#7c3aed",
    gradient: "from-[#7c3aed] to-[#5b21b6]",
    badge: "Выгода 600 ₽",
    features: [
      "Всё из тарифа Про",
      "Оплата раз в 3 месяца",
      "Экономия 600 ₽ vs ежемесячно",
    ],
    limitations: [],
    cta: "Взять Про+ на квартал",
  },
];

/* ─── Features & Problem sections ─── */
const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Структура проектов",
    desc: "Разбивайте маркетинг на понятные этапы",
  },
  {
    icon: Gauge,
    title: "Простое планирование",
    desc: "Без перегруженных инструментов",
  },
  {
    icon: Target,
    title: "Фокус на результате",
    desc: "Делаете не \"много\", а \"по делу\"",
  },
  {
    icon: PlayCircle,
    title: "Быстрый старт",
    desc: "Без обучения и сложных настроек",
  },
];

const HOW_IT_WORKS = [
  { step: "1", text: "Создаёте проект" },
  { step: "2", text: "Делите на шаги" },
  { step: "3", text: "Двигаетесь по плану" },
];

const FOR_WHO = [
  "маркетологи",
  "фаундеры",
  "фрилансеры",
  "небольшие команды",
];

/* ─── Component ─── */
export function PricingPage() {
  const navigate = useNavigate();
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleCta = (planId: string) => {
    if (planId === "demo") {
      navigate("/app");
    } else {
      // В реальном проекте - интеграция с платёжной системой
      // Доступ открывается ТОЛЬКО после payment.succeeded
      navigate("/app");
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
              Наведи порядок в маркетинге
            </h1>
            <p className="text-muted-foreground text-[15px] md:text-[16px] max-w-[580px] mx-auto leading-relaxed">
              Marketing Planer помогает структурировать задачи, видеть картину целиком и доводить идеи до результата
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate("/app")}
              className="px-6 py-3 rounded-xl text-white font-semibold text-[14px] transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
              style={{ background: "linear-gradient(135deg, #d4a373 0%, #c08a40 100%)" }}
            >
              Начать бесплатно
            </button>
            <button
              onClick={() => handleCta("demo")}
              className="px-6 py-3 rounded-xl bg-muted text-foreground font-medium text-[14px] transition-all hover:bg-muted/80 active:scale-[0.98]"
            >
              Посмотреть демо
            </button>
          </div>
        </motion.section>

        {/* 2. ПРОБЛЕМА → РЕШЕНИЕ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-[680px] mx-auto"
        >
          <div className="bg-card border border-border rounded-2xl p-8 md:p-10 space-y-6">
            <div className="space-y-2 text-center">
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                Идеи есть, но они разбросаны<br />
                Планы есть, но не выполняются<br />
                Маркетинг есть, но нет системы
              </p>
            </div>
            <div className="flex justify-center">
              <ChevronRight className="w-6 h-6 text-primary rotate-90" />
            </div>
            <div className="text-center">
              <p className="text-foreground text-[15px] md:text-[16px] font-medium leading-relaxed">
                Marketing Planer помогает собрать всё в одну структуру и начать двигаться по понятному плану
              </p>
            </div>
          </div>
        </motion.section>

        {/* 3. ВОЗМОЖНОСТИ */}
        <section className="space-y-8">
          <h2 className="text-[24px] md:text-[28px] font-bold text-foreground text-center">
            Возможности
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  className="bg-card border border-border rounded-xl p-5 md:p-6 space-y-3 hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-foreground">{f.title}</h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* 4. КАК ЭТО РАБОТАЕТ */}
        <section className="max-w-[640px] mx-auto space-y-6">
          <h2 className="text-[24px] md:text-[28px] font-bold text-foreground text-center">
            Как это работает
          </h2>
          <div className="space-y-3">
            {HOW_IT_WORKS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 md:p-5"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-[16px] shrink-0"
                  style={{ background: "linear-gradient(135deg, #d4a373 0%, #c08a40 100%)" }}
                >
                  {item.step}
                </div>
                <p className="text-[15px] text-foreground font-medium">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 5. ДЛЯ КОГО */}
        <section className="max-w-[520px] mx-auto space-y-6">
          <h2 className="text-[24px] md:text-[28px] font-bold text-foreground text-center">
            Для кого
          </h2>
          <div className="bg-card border border-border rounded-xl p-6 md:p-8">
            <ul className="space-y-2.5">
              {FOR_WHO.map((who, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-[15px] text-foreground">{who}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>

        {/* 6. ТАРИФЫ */}
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
                      <h3 className="text-[18px] font-bold text-foreground">{plan.name}</h3>
                      <p className="text-[13px] text-muted-foreground mt-1">{plan.description}</p>
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

        {/* 7. ДОЖИМ (АПСЕЛЛ) */}
        <section className="max-w-[680px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-primary/5 to-[#d4a373]/5 border border-border rounded-2xl p-6 md:p-8 text-center space-y-3"
          >
            <p className="text-foreground text-[15px] md:text-[16px] font-medium leading-relaxed">
              2 проекта - достаточно, чтобы попробовать
            </p>
            <p className="text-foreground text-[15px] md:text-[16px] font-medium leading-relaxed">
              Безлимит - чтобы реально работать
            </p>
            <p className="text-muted-foreground text-[13px] pt-2 max-w-[520px] mx-auto">
              Если вы регулярно занимаетесь маркетингом - лимита в 2 проекта быстро станет мало
            </p>
          </motion.div>
        </section>

        {/* 8. ФИНАЛЬНЫЙ CTA */}
        <section className="max-w-[640px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-card border border-border rounded-2xl p-8 md:p-10 text-center space-y-6"
          >
            <Mascot emotion="wave" size={80} className="mx-auto" />
            <div className="space-y-2">
              <h2 className="text-[22px] md:text-[26px] font-bold text-foreground">
                Начните бесплатно и соберите первый маркетинговый план
              </h2>
            </div>
            <button
              onClick={() => navigate("/app")}
              className="px-8 py-3.5 rounded-xl text-white font-semibold text-[15px] transition-all hover:opacity-90 active:scale-[0.98] shadow-lg mx-auto flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #d4a373 0%, #c08a40 100%)" }}
            >
              Начать
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </motion.div>
        </section>

      {/* FOOTER */}
      <footer className="border-t border-border mt-16 py-6 px-6 text-center">
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
    </div>
  );
}
