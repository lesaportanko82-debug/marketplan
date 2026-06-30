import { useState, useMemo, useCallback } from "react";
import {
  BarChart3, Send, RefreshCw, Copy, CheckCircle2, AlertCircle,
  Sparkles, Download, Calculator, TrendingUp, DollarSign, Users,
  Target, Percent, ArrowUpRight, ArrowDownRight, Info, RotateCcw,
  Layers, Activity, Zap, PieChart,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { aiGenerate } from "../lib/api";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { exportToPDF } from "../lib/export-utils";

// ════════════════════════════════════════
//  FORMULA DEFINITIONS
// ════════════════════════════════════════

interface FormulaField {
  key: string;
  label: string;
  placeholder: string;
  suffix?: string;
  defaultValue?: number;
}

interface FormulaResult {
  label: string;
  value: number | string;
  suffix?: string;
  color?: "green" | "red" | "amber" | "teal" | "default";
  tooltip?: string;
}

interface FormulaGroup {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  color: string;
  description: string;
  fields: FormulaField[];
  calculate: (values: Record<string, number>) => FormulaResult[];
  formulaText: string;
}

const FORMULA_GROUPS: FormulaGroup[] = [
  {
    id: "unit_economics",
    title: "Unit-экономика",
    icon: DollarSign,
    color: "#22c55e",
    description: "CAC, LTV, LTV/CAC, Payback Period",
    formulaText: "CAC = Расходы / Клиенты · LTV = ARPU × Lifetime · LTV/CAC ≥ 3",
    fields: [
      { key: "marketing_spend", label: "Расходы на маркетинг", placeholder: "500000", suffix: "₽" },
      { key: "new_customers", label: "Новых клиентов", placeholder: "200" },
      { key: "avg_revenue_per_user", label: "Средний доход с клиента (мес.)", placeholder: "3000", suffix: "₽" },
      { key: "avg_lifetime_months", label: "Средний срок жизни клиента", placeholder: "12", suffix: "мес." },
      { key: "gross_margin", label: "Маржинальность", placeholder: "40", suffix: "%" },
    ],
    calculate: (v) => {
      const cac = v.new_customers > 0 ? v.marketing_spend / v.new_customers : 0;
      const ltv = v.avg_revenue_per_user * v.avg_lifetime_months;
      const ltvMargin = ltv * (v.gross_margin / 100);
      const ltvCacRatio = cac > 0 ? ltvMargin / cac : 0;
      const payback = v.avg_revenue_per_user > 0 ? cac / (v.avg_revenue_per_user * (v.gross_margin / 100)) : 0;
      return [
        { label: "CAC (стоимость привлечения)", value: Math.round(cac), suffix: "₽", color: cac > 0 ? "default" : "red" as any, tooltip: "Расходы на маркетинг ÷ Кол-во новых клиентов" },
        { label: "LTV (доход за жизнь клиента)", value: Math.round(ltv), suffix: "₽", tooltip: "ARPU × Средний срок жизни" },
        { label: "LTV с маржой", value: Math.round(ltvMargin), suffix: "₽", tooltip: "LTV × Маржинальность" },
        { label: "LTV/CAC", value: ltvCacRatio.toFixed(1), color: ltvCacRatio >= 3 ? "green" : ltvCacRatio >= 1 ? "amber" : "red", tooltip: ">=3 - хорошо, >=5 - отлично, <1 - убыток" },
        { label: "Payback Period", value: payback.toFixed(1), suffix: "мес.", color: payback <= 6 ? "green" : payback <= 12 ? "amber" : "red", tooltip: "CAC / (ARPU * Маржа). До 6 мес. - отлично" },
      ];
    },
  },
  {
    id: "campaign",
    title: "Эффективность кампании",
    icon: Target,
    color: "#0d7377",
    description: "ROI, ROMI, CPC, CPM, CTR, CR",
    formulaText: "ROI = (Доход − Расход) / Расход × 100% · ROMI = (Прибыль − Маркетинг) / Маркетинг × 100%",
    fields: [
      { key: "ad_spend", label: "Рекламный бюджет", placeholder: "300000", suffix: "₽" },
      { key: "impressions", label: "Показы", placeholder: "1000000" },
      { key: "clicks", label: "Клики", placeholder: "25000" },
      { key: "conversions", label: "Конверсии (лиды/продажи)", placeholder: "500" },
      { key: "revenue", label: "Доход от кампании", placeholder: "900000", suffix: "₽" },
    ],
    calculate: (v) => {
      const cpc = v.clicks > 0 ? v.ad_spend / v.clicks : 0;
      const cpm = v.impressions > 0 ? (v.ad_spend / v.impressions) * 1000 : 0;
      const ctr = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0;
      const cr = v.clicks > 0 ? (v.conversions / v.clicks) * 100 : 0;
      const cpa = v.conversions > 0 ? v.ad_spend / v.conversions : 0;
      const roi = v.ad_spend > 0 ? ((v.revenue - v.ad_spend) / v.ad_spend) * 100 : 0;
      const romi = roi; // same in this context
      return [
        { label: "CPC (цена клика)", value: cpc.toFixed(2), suffix: "₽", tooltip: "Бюджет ÷ Клики" },
        { label: "CPM (цена 1000 показов)", value: cpm.toFixed(2), suffix: "₽", tooltip: "(Бюджет ÷ Показы) × 1000" },
        { label: "CTR (кликабельность)", value: ctr.toFixed(2), suffix: "%", color: ctr >= 2 ? "green" : ctr >= 0.5 ? "amber" : "red", tooltip: "(Клики ÷ Показы) × 100%. Поиск ≥2%, баннеры ≥0.5%" },
        { label: "CR (конверсия)", value: cr.toFixed(2), suffix: "%", color: cr >= 3 ? "green" : cr >= 1 ? "amber" : "red", tooltip: "(Конверсии ÷ Клики) × 100%. E-com: 1–3%, SaaS: 3–7%" },
        { label: "CPA (цена конверсии)", value: Math.round(cpa), suffix: "₽", tooltip: "Бюджет ÷ Конверсии" },
        { label: "ROI / ROMI", value: roi.toFixed(1), suffix: "%", color: roi > 100 ? "green" : roi > 0 ? "amber" : "red", tooltip: "(Доход - Расход) / Расход * 100%. >100% - хорошо" },
      ];
    },
  },
  {
    id: "revenue",
    title: "Revenue-метрики",
    icon: TrendingUp,
    color: "#f59e0b",
    description: "ARPU, ARPPU, MRR, ARR, AOV",
    formulaText: "MRR = Платящих × ARPPU · ARR = MRR × 12 · AOV = Выручка / Заказы",
    fields: [
      { key: "total_users", label: "Всего пользователей", placeholder: "10000" },
      { key: "paying_users", label: "Платящих пользователей", placeholder: "1500" },
      { key: "total_revenue_month", label: "Выручка за месяц", placeholder: "4500000", suffix: "₽" },
      { key: "total_orders", label: "Заказов за месяц", placeholder: "2200" },
    ],
    calculate: (v) => {
      const arpu = v.total_users > 0 ? v.total_revenue_month / v.total_users : 0;
      const arppu = v.paying_users > 0 ? v.total_revenue_month / v.paying_users : 0;
      const mrr = v.total_revenue_month;
      const arr = mrr * 12;
      const aov = v.total_orders > 0 ? v.total_revenue_month / v.total_orders : 0;
      const payingRate = v.total_users > 0 ? (v.paying_users / v.total_users) * 100 : 0;
      return [
        { label: "ARPU (доход на пользователя)", value: Math.round(arpu), suffix: "₽", tooltip: "Выручка ÷ Все пользователи" },
        { label: "ARPPU (доход на платящего)", value: Math.round(arppu), suffix: "₽", tooltip: "Выручка ÷ Платящие пользователи" },
        { label: "MRR (мес. рекуррентный доход)", value: formatNumber(mrr), suffix: "₽", color: "teal", tooltip: "Выручка за месяц" },
        { label: "ARR (год. рекуррентный доход)", value: formatNumber(arr), suffix: "₽", color: "teal", tooltip: "MRR × 12" },
        { label: "AOV (средний чек)", value: Math.round(aov), suffix: "₽", tooltip: "Выручка ÷ Количество заказов" },
        { label: "Конверсия в платящих", value: payingRate.toFixed(1), suffix: "%", color: payingRate >= 5 ? "green" : payingRate >= 2 ? "amber" : "red", tooltip: "(Платящие ÷ Все) × 100%. Freemium: 2–5%" },
      ];
    },
  },
  {
    id: "retention",
    title: "Retention и Churn",
    icon: Activity,
    color: "#d4a373",
    description: "Churn Rate, Retention, NPS, DAU/MAU",
    formulaText: "Churn = Ушедших / Было × 100% · Retention = 100% − Churn · Stickiness = DAU / MAU",
    fields: [
      { key: "customers_start", label: "Клиентов на начало периода", placeholder: "1000" },
      { key: "customers_lost", label: "Ушедших за период", placeholder: "50" },
      { key: "customers_new", label: "Новых за период", placeholder: "120" },
      { key: "dau", label: "DAU (ежедн. активных)", placeholder: "3500" },
      { key: "mau", label: "MAU (ежемес. активных)", placeholder: "15000" },
      { key: "promoters", label: "Промоутеры (NPS 9–10)", placeholder: "200" },
      { key: "detractors", label: "Критики (NPS 0–6)", placeholder: "40" },
      { key: "total_respondents", label: "Всего опрошенных (NPS)", placeholder: "400" },
    ],
    calculate: (v) => {
      const churn = v.customers_start > 0 ? (v.customers_lost / v.customers_start) * 100 : 0;
      const retention = 100 - churn;
      const netGrowth = v.customers_new - v.customers_lost;
      const customersEnd = v.customers_start + netGrowth;
      const stickiness = v.mau > 0 ? (v.dau / v.mau) * 100 : 0;
      const nps = v.total_respondents > 0
        ? ((v.promoters - v.detractors) / v.total_respondents) * 100
        : 0;
      return [
        { label: "Churn Rate (отток)", value: churn.toFixed(2), suffix: "%", color: churn <= 3 ? "green" : churn <= 7 ? "amber" : "red", tooltip: "Ушедших ÷ Было × 100%. SaaS: <5% мес." },
        { label: "Retention Rate (удержание)", value: retention.toFixed(2), suffix: "%", color: retention >= 95 ? "green" : retention >= 90 ? "amber" : "red", tooltip: "100% − Churn Rate" },
        { label: "Чистый рост клиентов", value: netGrowth > 0 ? `+${netGrowth}` : String(netGrowth), color: netGrowth > 0 ? "green" : "red", tooltip: "Новых − Ушедших" },
        { label: "Клиентов на конец периода", value: customersEnd, tooltip: "Начало + Новые − Ушедшие" },
        { label: "DAU/MAU (Stickiness)", value: stickiness.toFixed(1), suffix: "%", color: stickiness >= 20 ? "green" : stickiness >= 10 ? "amber" : "red", tooltip: "DAU / MAU * 100%. >=20% - хороший показатель" },
        { label: "NPS (индекс лояльности)", value: Math.round(nps), color: nps >= 50 ? "green" : nps >= 0 ? "amber" : "red", tooltip: "(Промоутеры - Критики) / Всего * 100. ≥50 - отлично" },
      ];
    },
  },
  {
    id: "email",
    title: "Email-маркетинг",
    icon: Send,
    color: "#14b8a6",
    description: "Open Rate, Click Rate, Unsubscribe, RPE",
    formulaText: "OR = Открытий / Доставлено × 100% · RPE = Доход / Отправлено",
    fields: [
      { key: "emails_sent", label: "Писем отправлено", placeholder: "50000" },
      { key: "emails_delivered", label: "Доставлено", placeholder: "47500" },
      { key: "emails_opened", label: "Открыто", placeholder: "11400" },
      { key: "emails_clicked", label: "Кликнули по ссылке", placeholder: "2280" },
      { key: "emails_unsubscribed", label: "Отписалось", placeholder: "95" },
      { key: "email_revenue", label: "Доход от рассылки", placeholder: "380000", suffix: "₽" },
    ],
    calculate: (v) => {
      const deliverability = v.emails_sent > 0 ? (v.emails_delivered / v.emails_sent) * 100 : 0;
      const openRate = v.emails_delivered > 0 ? (v.emails_opened / v.emails_delivered) * 100 : 0;
      const clickRate = v.emails_delivered > 0 ? (v.emails_clicked / v.emails_delivered) * 100 : 0;
      const ctor = v.emails_opened > 0 ? (v.emails_clicked / v.emails_opened) * 100 : 0;
      const unsubRate = v.emails_delivered > 0 ? (v.emails_unsubscribed / v.emails_delivered) * 100 : 0;
      const rpe = v.emails_sent > 0 ? v.email_revenue / v.emails_sent : 0;
      return [
        { label: "Доставляемость", value: deliverability.toFixed(1), suffix: "%", color: deliverability >= 95 ? "green" : deliverability >= 90 ? "amber" : "red", tooltip: "Доставлено ÷ Отправлено × 100%" },
        { label: "Open Rate (открытия)", value: openRate.toFixed(1), suffix: "%", color: openRate >= 20 ? "green" : openRate >= 10 ? "amber" : "red", tooltip: "Открыто ÷ Доставлено × 100%. Средний: 15–25%" },
        { label: "Click Rate (клики)", value: clickRate.toFixed(2), suffix: "%", color: clickRate >= 3 ? "green" : clickRate >= 1 ? "amber" : "red", tooltip: "Клики ÷ Доставлено × 100%. Средний: 2–5%" },
        { label: "CTOR (клик-ту-опен)", value: ctor.toFixed(1), suffix: "%", color: ctor >= 15 ? "green" : ctor >= 8 ? "amber" : "red", tooltip: "Клики ÷ Открытия × 100%. ≥15% - хорошо" },
        { label: "Unsubscribe Rate", value: unsubRate.toFixed(3), suffix: "%", color: unsubRate <= 0.2 ? "green" : unsubRate <= 0.5 ? "amber" : "red", tooltip: "Отписки ÷ Доставлено × 100%. <0.2% - норма" },
        { label: "RPE (доход на письмо)", value: rpe.toFixed(2), suffix: "₽", tooltip: "Доход ÷ Отправлено" },
      ];
    },
  },
  {
    id: "social",
    title: "SMM-метрики",
    icon: Users,
    color: "#1a7a6d",
    description: "ER, Reach Rate, Virality, Cost per Follower",
    formulaText: "ER = (Лайки + Комменты) / Подписчики × 100% · Virality = Шеры / Показы × 100%",
    fields: [
      { key: "followers", label: "Подписчиков", placeholder: "25000" },
      { key: "post_likes", label: "Лайков (среднее на пост)", placeholder: "850" },
      { key: "post_comments", label: "Комментариев (среднее)", placeholder: "45" },
      { key: "post_shares", label: "Репостов (среднее)", placeholder: "30" },
      { key: "post_reach", label: "Охват поста (среднее)", placeholder: "8500" },
      { key: "smm_budget", label: "Бюджет на SMM", placeholder: "150000", suffix: "₽" },
      { key: "new_followers", label: "Новых подписчиков за период", placeholder: "1200" },
    ],
    calculate: (v) => {
      const er = v.followers > 0 ? ((v.post_likes + v.post_comments) / v.followers) * 100 : 0;
      const erReach = v.post_reach > 0 ? ((v.post_likes + v.post_comments) / v.post_reach) * 100 : 0;
      const reachRate = v.followers > 0 ? (v.post_reach / v.followers) * 100 : 0;
      const virality = v.post_reach > 0 ? (v.post_shares / v.post_reach) * 100 : 0;
      const cpf = v.new_followers > 0 ? v.smm_budget / v.new_followers : 0;
      const engTotal = v.post_likes + v.post_comments + v.post_shares;
      return [
        { label: "ER (по подписчикам)", value: er.toFixed(2), suffix: "%", color: er >= 3 ? "green" : er >= 1 ? "amber" : "red", tooltip: "(Лайки + Комменты) ÷ Подписчики × 100%. >3% - отлично" },
        { label: "ER (по охвату)", value: erReach.toFixed(2), suffix: "%", color: erReach >= 8 ? "green" : erReach >= 4 ? "amber" : "red", tooltip: "(Лайки + Комменты) ÷ Охват × 100%" },
        { label: "Reach Rate (охват)", value: reachRate.toFixed(1), suffix: "%", color: reachRate >= 30 ? "green" : reachRate >= 15 ? "amber" : "red", tooltip: "Охват ÷ Подписчики × 100%" },
        { label: "Virality Rate", value: virality.toFixed(3), suffix: "%", tooltip: "Репосты ÷ Охват × 100%" },
        { label: "Суммарный Engagement", value: formatNumber(engTotal), tooltip: "Лайки + Комменты + Репосты" },
        { label: "CPF (цена подписчика)", value: cpf.toFixed(2), suffix: "₽", color: cpf <= 50 ? "green" : cpf <= 150 ? "amber" : "red", tooltip: "Бюджет ÷ Новых подписчиков" },
      ];
    },
  },
];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(Math.round(n));
}

const RESULT_COLORS: Record<string, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  red: "text-red-500 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  teal: "text-teal-600 dark:text-teal-400",
  default: "text-foreground",
};

const RESULT_BG: Record<string, string> = {
  green: "bg-emerald-500/8",
  red: "bg-red-500/8",
  amber: "bg-amber-500/8",
  teal: "bg-teal-500/8",
  default: "",
};

// ════════════════════════════════════════
//  CALCULATOR CARD COMPONENT
// ════════════════════════════════════════

function CalculatorCard({ group }: { group: FormulaGroup }) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    group.fields.forEach(f => { initial[f.key] = f.defaultValue ?? 0; });
    return initial;
  });
  const [expanded, setExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const results = useMemo(() => group.calculate(values), [values, group]);
  const hasInput = Object.values(values).some(v => v > 0);

  const handleChange = useCallback((key: string, raw: string) => {
    const num = parseFloat(raw.replace(/[^\d.-]/g, "")) || 0;
    setValues(prev => ({ ...prev, [key]: num }));
  }, []);

  const handleReset = useCallback(() => {
    const empty: Record<string, number> = {};
    group.fields.forEach(f => { empty[f.key] = 0; });
    setValues(empty);
  }, [group]);

  const handleFillExample = useCallback(() => {
    const example: Record<string, number> = {};
    group.fields.forEach(f => { example[f.key] = parseFloat(f.placeholder) || 0; });
    setValues(example);
    setExpanded(true);
  }, [group]);

  const Icon = group.icon;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden transition-all hover:shadow-md">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${group.color}18` }}
        >
          <Icon className="w-5 h-5" style={{ color: group.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-foreground">{group.title}</h3>
            {hasInput && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                рассчитано
              </span>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground truncate">{group.description}</p>
        </div>
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-foreground" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Formula hint */}
          <div className="px-5 py-2.5 bg-muted/20 border-b border-border">
            <p className="text-[11px] text-muted-foreground font-mono">{group.formulaText}</p>
          </div>

          {/* Input fields */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Входные данные</p>
              <div className="flex gap-1.5">
                <button
                  onClick={handleFillExample}
                  className="text-[11px] px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Заполнить пример
                </button>
                {hasInput && (
                  <button
                    onClick={handleReset}
                    className="text-[11px] px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Сбросить
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {group.fields.map(field => (
                <div key={field.key}>
                  <label className="text-[11px] text-muted-foreground block mb-1">{field.label}</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={values[field.key] || ""}
                      onChange={e => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:border-[color:var(--ring)]/50 focus:ring-1 focus:ring-[color:var(--ring)]/20 outline-none transition-all"
                    />
                    {field.suffix && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                        {field.suffix}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Results table */}
          {hasInput && (
            <div className="px-5 pb-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Результаты</p>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Метрика</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Значение</th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const colorCls = RESULT_COLORS[r.color || "default"];
                      const bgCls = RESULT_BG[r.color || "default"];
                      return (
                        <tr key={i} className={`border-t border-border ${bgCls} hover:bg-muted/20 transition-colors`}>
                          <td className="px-4 py-2.5 text-foreground">{r.label}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${colorCls}`}>
                            {r.value}{r.suffix ? ` ${r.suffix}` : ""}
                          </td>
                          <td className="px-3 py-2.5 text-center relative">
                            {r.tooltip && (
                              <button
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                onMouseEnter={() => setShowTooltip(`${group.id}-${i}`)}
                                onMouseLeave={() => setShowTooltip(null)}
                              >
                                <Info className="w-3.5 h-3.5" />
                                {showTooltip === `${group.id}-${i}` && (
                                  <div className="absolute right-0 bottom-full mb-2 w-56 bg-card border border-border rounded-lg shadow-xl p-2.5 text-left z-20">
                                    <p className="text-[11px] text-foreground leading-relaxed">{r.tooltip}</p>
                                  </div>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════

type TabType = "calculators" | "ai";

export function ToolsMetrics() {
  const [tab, setTab] = useState<TabType>("calculators");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{ prompt_tokens: number; completion_tokens: number } | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error("Опишите проект или задачу"); return; }
    setIsGenerating(true);
    setResult("");
    setError(null);
    setTokenUsage(null);
    try {
      const res = await aiGenerate("metrics_helper", prompt);
      if (res) {
        setResult(res.content);
        setTokenUsage(res.usage);
        toast.success("Дерево метрик готово", { description: `${res.usage.total_tokens} токенов` });
      }
    } catch (err: any) {
      const isLimit = err?.name === "UsageLimitError";
      setError(isLimit ? (err.message || "Лимит AI-генераций исчерпан.") : (err.message || "Ошибка"));
      toast.error(isLimit ? "Лимит исчерпан" : "Ошибка генерации");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    copyToClipboard(result);
    setCopied(true);
    toast.success("Скопировано");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-5 max-w-[1000px] mx-auto space-y-4 sm:space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <BarChart3 className="w-4.5 h-4.5 text-white" />
          </div>
          Проработка метрик
        </h1>
        <p className="text-muted-foreground text-[13px] mt-1">
          Калькуляторы маркетинговых формул и AI-генерация дерева метрик
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("calculators")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            tab === "calculators"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calculator className="w-4 h-4" />
          Калькуляторы
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{FORMULA_GROUPS.length}</span>
        </button>
        <button
          onClick={() => setTab("ai")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            tab === "ai"
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI-генерация
        </button>
      </div>

      {/* ══ TAB: Calculators ══ */}
      {tab === "calculators" && (
        <div className="space-y-3">
          {/* Quick info bar */}
          <div className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-xl text-[12px] text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 text-primary" />
            <span>
              Раскройте любой калькулятор, введите данные или нажмите «Заполнить пример» - формулы рассчитаются мгновенно.
              Наведите на <Info className="w-3 h-3 inline" /> для подсказки по бенчмаркам.
            </span>
          </div>

          {/* Calculator cards */}
          {FORMULA_GROUPS.map(group => (
            <CalculatorCard key={group.id} group={group} />
          ))}

          {/* Summary reference table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="text-[14px] font-semibold text-foreground">Справочник: все формулы</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Метрика</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Формула</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Бенчмарк</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Группа</th>
                  </tr>
                </thead>
                <tbody>
                  {REFERENCE_TABLE.map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/15 transition-colors">
                      <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                      <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{r.formula}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded ${r.benchColor}`}>
                          {r.benchmark}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.group}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: AI Generation ══ */}
      {tab === "ai" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <label className="text-[13px] text-muted-foreground block mb-2">
                Опишите проект, нишу и цели
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
                }}
                placeholder="Интернет-магазин электроники, бюджет 2.5M RUB, цель - увеличить выручку на 35% за полгода. Основные каналы: Яндекс Директ, VK Реклама, SEO, Email."
                className="w-full bg-muted/30 border border-border rounded-lg px-4 py-3 text-foreground resize-none h-28 text-[13px] placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                ⌘+Enter для генерации
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isGenerating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isGenerating ? "Генерирую..." : "Построить метрики"}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-[13px] text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {isGenerating && (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center text-center">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-muted-foreground text-[13px]">AI строит дерево метрик...</p>
            </div>
          )}

          {result && !isGenerating && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Дерево метрик
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? "Скопировано" : "Копировать"}
                  </button>
                  <button
                    onClick={() => exportToPDF("Дерево метрик", result, "metrics")}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </button>
                </div>
              </div>
              <div className="bg-muted/20 border border-border rounded-lg p-5 text-[13px] text-foreground/90 leading-relaxed">
                <MarkdownRenderer content={result} />
              </div>
              {tokenUsage && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  {tokenUsage.prompt_tokens + tokenUsage.completion_tokens} токенов
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════
//  REFERENCE TABLE DATA
// ════════════════════════════════════════

const REFERENCE_TABLE = [
  { name: "CAC", formula: "Маркетинг ÷ Новые клиенты", benchmark: "зависит от ниши", benchColor: "bg-muted text-muted-foreground", group: "Unit-экономика" },
  { name: "LTV", formula: "ARPU × Срок жизни", benchmark: "LTV/CAC ≥ 3", benchColor: "bg-emerald-500/10 text-emerald-600", group: "Unit-экономика" },
  { name: "Payback Period", formula: "CAC ÷ (ARPU × Маржа)", benchmark: "≤ 12 мес.", benchColor: "bg-emerald-500/10 text-emerald-600", group: "Unit-экономика" },
  { name: "ROI / ROMI", formula: "(Доход − Расход) ÷ Расход × 100%", benchmark: "> 100%", benchColor: "bg-emerald-500/10 text-emerald-600", group: "Кампании" },
  { name: "CTR", formula: "Клики ÷ Показы × 100%", benchmark: "Поиск ≥2%, баннеры ≥0.5%", benchColor: "bg-amber-500/10 text-amber-600", group: "Кампании" },
  { name: "CR", formula: "Конверсии ÷ Клики × 100%", benchmark: "E-com: 1–3%, SaaS: 3–7%", benchColor: "bg-amber-500/10 text-amber-600", group: "Кампании" },
  { name: "CPC", formula: "Бюджет ÷ Клики", benchmark: "зависит от канала", benchColor: "bg-muted text-muted-foreground", group: "Кампании" },
  { name: "CPM", formula: "(Бюджет ÷ Показы) × 1000", benchmark: "50–500₽", benchColor: "bg-muted text-muted-foreground", group: "Кампании" },
  { name: "ARPU", formula: "Выручка ÷ Все пользователи", benchmark: "зависит от модели", benchColor: "bg-muted text-muted-foreground", group: "Revenue" },
  { name: "MRR / ARR", formula: "Выручка мес. / × 12", benchmark: "рост ≥ 10% м/м", benchColor: "bg-teal-500/10 text-teal-600", group: "Revenue" },
  { name: "AOV", formula: "Выручка ÷ Заказы", benchmark: "зависит от ниши", benchColor: "bg-muted text-muted-foreground", group: "Revenue" },
  { name: "Churn Rate", formula: "Ушедших ÷ Было × 100%", benchmark: "SaaS: < 5% мес.", benchColor: "bg-emerald-500/10 text-emerald-600", group: "Retention" },
  { name: "NPS", formula: "(Промоутеры - Критики) / Всего * 100", benchmark: ">= 50 - отлично", benchColor: "bg-emerald-500/10 text-emerald-600", group: "Retention" },
  { name: "DAU/MAU", formula: "DAU ÷ MAU × 100%", benchmark: "≥ 20%", benchColor: "bg-emerald-500/10 text-emerald-600", group: "Retention" },
  { name: "Open Rate", formula: "Открытия ÷ Доставлено × 100%", benchmark: "15–25%", benchColor: "bg-amber-500/10 text-amber-600", group: "Email" },
  { name: "CTOR", formula: "Клики ÷ Открытия × 100%", benchmark: "≥ 15%", benchColor: "bg-emerald-500/10 text-emerald-600", group: "Email" },
  { name: "ER", formula: "(Лайки + Комменты) / Подписчики × 100%", benchmark: "> 3% - отлично", benchColor: "bg-emerald-500/10 text-emerald-600", group: "SMM" },
  { name: "CPF", formula: "Бюджет SMM ÷ Новые подписчик", benchmark: "≤ 50₽", benchColor: "bg-emerald-500/10 text-emerald-600", group: "SMM" },
];