import { useState, useMemo, useCallback, useEffect } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Calculator, Layers, ArrowUpRight,
  ArrowDownRight, Info, RotateCcw, Target, Users, Activity, Zap,
  PieChart, BarChart3, Percent, AlertTriangle, CheckCircle2, Minus,
  Save, Download, ChevronDown, ChevronUp, HelpCircle, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { getData, saveData } from "../lib/api";
import { exportToCSV } from "../lib/export-utils";
import { AddToProjectButton } from "./AddToProjectModal";

// ════════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════════

interface UnitModel {
  // Acquisition
  marketingSpend: number;
  salesSpend: number;
  newCustomers: number;
  organicCustomers: number;
  // Revenue
  avgPrice: number;
  avgPurchasesPerMonth: number;
  // Costs
  cogs: number; // % of revenue
  variableCostPerUser: number;
  fixedCostsMonthly: number;
  // Retention
  monthlyChurnRate: number;
  expansionRevenueRate: number; // % MoM expansion from existing
  // SaaS specifics
  mrrNew: number;
  mrrExpansion: number;
  mrrContraction: number;
  mrrChurned: number;
  // Cohort
  cohortSize: number;
  retentionByMonth: number[]; // 12 months, % retained
  // Break-even
  beFixedCosts: number;
  beVariableCostPerUnit: number;
  bePricePerUnit: number;
  // Scenario
  scenarioGrowthBase: number;
  scenarioGrowthOptimistic: number;
  scenarioGrowthPessimistic: number;
  scenarioMonths: number;
}

const DEFAULT_MODEL: UnitModel = {
  marketingSpend: 500000,
  salesSpend: 200000,
  newCustomers: 250,
  organicCustomers: 80,
  avgPrice: 2500,
  avgPurchasesPerMonth: 1.3,
  cogs: 30,
  variableCostPerUser: 150,
  fixedCostsMonthly: 800000,
  monthlyChurnRate: 4.5,
  expansionRevenueRate: 3,
  mrrNew: 450000,
  mrrExpansion: 85000,
  mrrContraction: 25000,
  mrrChurned: 65000,
  cohortSize: 1000,
  retentionByMonth: [100, 68, 52, 43, 37, 33, 29, 27, 25, 23, 22, 21],
  beFixedCosts: 1200000,
  beVariableCostPerUnit: 800,
  bePricePerUnit: 2500,
  scenarioGrowthBase: 8,
  scenarioGrowthOptimistic: 15,
  scenarioGrowthPessimistic: 2,
  scenarioMonths: 12,
};

const STORAGE_KEY = "unit_economics:model";

// ════════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════════

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

const fmtCurrency = (n: number) => fmt(n) + " ₽";
const fmtPct = (n: number) => n.toFixed(1) + "%";

type Tone = "good" | "warn" | "bad" | "neutral" | "info";
const toneColor: Record<Tone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-500 dark:text-red-400",
  neutral: "text-foreground",
  info: "text-teal-600 dark:text-teal-400",
};
const toneBg: Record<Tone, string> = {
  good: "bg-emerald-500/8",
  warn: "bg-amber-500/8",
  bad: "bg-red-500/8",
  neutral: "",
  info: "bg-teal-500/8",
};

// ════════════════════════════════════════════════════════════════
//  SECTION COMPONENTS
// ════════════════════════════════════════════════════════════════

function SectionCard({ title, icon: Icon, color, children, id }: {
  title: string; icon: React.ComponentType<any>; color: string; children: React.ReactNode; id: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div id={id} className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <h3 className="text-[14px] font-semibold text-foreground flex-1">{title}</h3>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  );
}

function ResultRow({ label, value, suffix, tone = "neutral", tooltip, bold }: {
  label: string; value: string | number; suffix?: string; tone?: Tone; tooltip?: string; bold?: boolean;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <tr className={`border-t border-border ${toneBg[tone]} hover:bg-muted/15 transition-colors`}>
      <td className={`px-4 py-2.5 text-[13px] ${bold ? "font-semibold text-foreground" : "text-foreground"}`}>
        {label}
      </td>
      <td className={`px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums ${toneColor[tone]}`}>
        {value}{suffix ? ` ${suffix}` : ""}
      </td>
      <td className="px-3 py-2.5 text-center w-8 relative">
        {tooltip && (
          <button className="text-muted-foreground hover:text-foreground" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
            <Info className="w-3.5 h-3.5" />
            {showTip && (
              <div className="absolute right-0 bottom-full mb-2 w-64 bg-card border border-border rounded-lg shadow-xl p-3 text-left z-30">
                <p className="text-[11px] text-foreground leading-relaxed">{tooltip}</p>
              </div>
            )}
          </button>
        )}
      </td>
    </tr>
  );
}

function InputField({ label, value, onChange, suffix, min, max, step, small }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; min?: number; max?: number; step?: number; small?: boolean;
}) {
  return (
    <div className={small ? "" : ""}>
      <label className="text-[11px] text-muted-foreground block mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value || ""}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          min={min} max={max} step={step || 1}
          className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:border-[color:var(--ring)]/50 focus:ring-1 focus:ring-[color:var(--ring)]/20 outline-none transition-all"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}

function Verdict({ tone, text }: { tone: Tone; text: string }) {
  const icons: Record<Tone, typeof CheckCircle2> = { good: CheckCircle2, warn: AlertTriangle, bad: AlertTriangle, neutral: Info, info: Info };
  const borders: Record<Tone, string> = { good: "border-emerald-500/30", warn: "border-amber-500/30", bad: "border-red-500/30", neutral: "border-border", info: "border-teal-500/30" };
  const Icon = icons[tone];
  return (
    <div className={`mt-3 flex items-start gap-2.5 px-4 py-3 rounded-lg border ${borders[tone]} ${toneBg[tone]}`}>
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${toneColor[tone]}`} />
      <p className="text-[12px] leading-relaxed text-foreground/85">{text}</p>
    </div>
  );
}

function TableWrapper({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-muted/40">
            {headers.map((h, i) => (
              <th key={i} className={`px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

type TabId = "overview" | "saas" | "cohort" | "breakeven" | "scenario";

const TABS: { id: TabId; label: string; icon: React.ComponentType<any> }[] = [
  { id: "overview", label: "Unit P&L", icon: DollarSign },
  { id: "saas", label: "SaaS-метрики", icon: Activity },
  { id: "cohort", label: "Когорты", icon: Users },
  { id: "breakeven", label: "Break-even", icon: Target },
  { id: "scenario", label: "Сценарии", icon: Layers },
];

export function UnitEconomics() {
  const [m, setM] = useState<UnitModel>(DEFAULT_MODEL);
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load from Supabase
  useEffect(() => {
    getData<UnitModel>(STORAGE_KEY).then(data => {
      if (data) setM(prev => ({ ...prev, ...data }));
    }).finally(() => setLoading(false));
  }, []);

  const set = useCallback((key: keyof UnitModel, val: number) => {
    setM(prev => ({ ...prev, [key]: val }));
  }, []);

  const setRetention = useCallback((idx: number, val: number) => {
    setM(prev => {
      const arr = [...prev.retentionByMonth];
      arr[idx] = Math.max(0, Math.min(100, val));
      return { ...prev, retentionByMonth: arr };
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const ok = await saveData(STORAGE_KEY, m);
    setSaving(false);
    if (ok) toast.success("Модель сохранена в облако");
    else toast.error("Ошибка сохранения");
  }, [m]);

  const handleReset = useCallback(() => {
    setM(DEFAULT_MODEL);
    toast.success("Сброшено к примеру");
  }, []);

  // ──── CALCULATIONS ────

  // Unit P&L
  const calc = useMemo(() => {
    const totalPaidCustomers = m.newCustomers;
    const totalCustomers = m.newCustomers + m.organicCustomers;
    const totalAcqSpend = m.marketingSpend + m.salesSpend;
    const blendedCAC = totalCustomers > 0 ? totalAcqSpend / totalCustomers : 0;
    const paidCAC = totalPaidCustomers > 0 ? totalAcqSpend / totalPaidCustomers : 0;
    const organicShare = totalCustomers > 0 ? (m.organicCustomers / totalCustomers) * 100 : 0;

    const arpu = m.avgPrice * m.avgPurchasesPerMonth;
    const revenuePerCustomer = arpu;
    const cogsPerCustomer = arpu * (m.cogs / 100);
    const grossProfit = arpu - cogsPerCustomer;
    const grossMargin = arpu > 0 ? (grossProfit / arpu) * 100 : 0;
    const contributionMargin = grossProfit - m.variableCostPerUser;
    const cmPercent = arpu > 0 ? (contributionMargin / arpu) * 100 : 0;

    const avgLifetimeMonths = m.monthlyChurnRate > 0 ? 1 / (m.monthlyChurnRate / 100) : 999;
    const ltv = arpu * avgLifetimeMonths;
    const ltvGross = grossProfit * avgLifetimeMonths;
    const ltvNet = contributionMargin * avgLifetimeMonths;
    const ltvCacRatio = blendedCAC > 0 ? ltvNet / blendedCAC : 0;
    const paybackMonths = contributionMargin > 0 ? blendedCAC / contributionMargin : 999;

    // Total monthly
    const totalMRR = arpu * totalCustomers;
    const totalGrossProfit = grossProfit * totalCustomers;
    const totalContribution = contributionMargin * totalCustomers;
    const opProfit = totalContribution - m.fixedCostsMonthly;
    const opMargin = totalMRR > 0 ? (opProfit / totalMRR) * 100 : 0;

    // CAC breakdown
    const marketingCACShare = totalAcqSpend > 0 ? (m.marketingSpend / totalAcqSpend) * 100 : 0;

    return {
      totalCustomers, blendedCAC, paidCAC, organicShare, totalAcqSpend,
      arpu, revenuePerCustomer, cogsPerCustomer, grossProfit, grossMargin,
      contributionMargin, cmPercent, variableCostPerUser: m.variableCostPerUser,
      avgLifetimeMonths, ltv, ltvGross, ltvNet, ltvCacRatio, paybackMonths,
      totalMRR, totalGrossProfit, totalContribution, opProfit, opMargin,
      marketingCACShare,
    };
  }, [m]);

  // SaaS metrics
  const saas = useMemo(() => {
    const startMRR = calc.totalMRR;
    const endMRR = startMRR + m.mrrNew + m.mrrExpansion - m.mrrContraction - m.mrrChurned;
    const netNewMRR = m.mrrNew + m.mrrExpansion - m.mrrContraction - m.mrrChurned;
    const grossChurnRate = startMRR > 0 ? (m.mrrChurned / startMRR) * 100 : 0;
    const netRevenueRetention = startMRR > 0 ? ((startMRR + m.mrrExpansion - m.mrrContraction - m.mrrChurned) / startMRR) * 100 : 0;
    const grossRetention = startMRR > 0 ? ((startMRR - m.mrrChurned) / startMRR) * 100 : 0;
    const quickRatio = (m.mrrContraction + m.mrrChurned) > 0
      ? (m.mrrNew + m.mrrExpansion) / (m.mrrContraction + m.mrrChurned)
      : 999;
    const arr = endMRR * 12;
    const ltvFromMrr = calc.arpu > 0 && m.monthlyChurnRate > 0
      ? (calc.arpu * (calc.grossMargin / 100)) / (m.monthlyChurnRate / 100)
      : 0;
    const magicNumber = m.salesSpend > 0 ? (netNewMRR * 12) / (m.marketingSpend + m.salesSpend) : 0;
    const burnMultiple = netNewMRR > 0 ? (m.fixedCostsMonthly + m.marketingSpend + m.salesSpend - calc.totalContribution) / netNewMRR : 999;
    const rule40 = (calc.opMargin > 0 ? calc.opMargin : 0) + m.scenarioGrowthBase;

    return {
      startMRR, endMRR, netNewMRR, grossChurnRate, netRevenueRetention,
      grossRetention, quickRatio, arr, ltvFromMrr, magicNumber, burnMultiple, rule40,
    };
  }, [m, calc]);

  // Cohort LTV
  const cohort = useMemo(() => {
    const rows = m.retentionByMonth.map((ret, i) => {
      const activeUsers = Math.round(m.cohortSize * (ret / 100));
      const monthRevenue = activeUsers * calc.arpu;
      return { month: i, retention: ret, activeUsers, monthRevenue };
    });
    let cumRevenue = 0;
    const withCum = rows.map(r => {
      cumRevenue += r.monthRevenue;
      return { ...r, cumRevenue, cumLTV: m.cohortSize > 0 ? cumRevenue / m.cohortSize : 0 };
    });
    const totalCohortRevenue = cumRevenue;
    const cohortLTV = m.cohortSize > 0 ? totalCohortRevenue / m.cohortSize : 0;
    const cacPaybackMonth = withCum.findIndex(r => r.cumLTV >= calc.blendedCAC);
    return { rows: withCum, totalCohortRevenue, cohortLTV, cacPaybackMonth };
  }, [m, calc]);

  // Break-even
  const breakeven = useMemo(() => {
    const cm = m.bePricePerUnit - m.beVariableCostPerUnit;
    const bepUnits = cm > 0 ? Math.ceil(m.beFixedCosts / cm) : Infinity;
    const bepRevenue = bepUnits * m.bePricePerUnit;
    const cmRatio = m.bePricePerUnit > 0 ? (cm / m.bePricePerUnit) * 100 : 0;
    const safetyMargin = (units: number) => bepUnits > 0 && bepUnits < Infinity ? ((units - bepUnits) / units) * 100 : 0;
    // Sensitivity: +/- 10%, 20%
    const sensitivity = [-20, -10, 0, 10, 20].map(delta => {
      const adjPrice = m.bePricePerUnit * (1 + delta / 100);
      const adjCm = adjPrice - m.beVariableCostPerUnit;
      const adjBep = adjCm > 0 ? Math.ceil(m.beFixedCosts / adjCm) : Infinity;
      return { delta, price: adjPrice, bep: adjBep, revenue: adjBep * adjPrice };
    });
    return { cm, bepUnits, bepRevenue, cmRatio, safetyMargin, sensitivity };
  }, [m]);

  // Scenario projection
  const scenarios = useMemo(() => {
    const buildScenario = (growthPct: number, label: string) => {
      const rows = [];
      let customers = calc.totalCustomers;
      let mrr = calc.totalMRR;
      let cumProfit = 0;
      for (let month = 1; month <= m.scenarioMonths; month++) {
        const newCust = Math.round(customers * (growthPct / 100));
        const churned = Math.round(customers * (m.monthlyChurnRate / 100));
        customers = customers + newCust - churned;
        mrr = customers * calc.arpu;
        const grossProfit = mrr * (calc.grossMargin / 100);
        const opProfit = grossProfit - (customers * m.variableCostPerUser) - m.fixedCostsMonthly;
        cumProfit += opProfit;
        rows.push({ month, customers, mrr, grossProfit, opProfit, cumProfit });
      }
      return { label, growthPct, rows };
    };
    return [
      buildScenario(m.scenarioGrowthPessimistic, "Пессимистичный"),
      buildScenario(m.scenarioGrowthBase, "Базовый"),
      buildScenario(m.scenarioGrowthOptimistic, "Оптимистичный"),
    ];
  }, [m, calc]);

  // ──── EXPORT ────
  const handleExportCSV = useCallback(() => {
    const headers = ["Метрика", "Значение"];
    const rows: (string | number)[][] = [
      ["Blended CAC", Math.round(calc.blendedCAC)],
      ["ARPU (мес.)", Math.round(calc.arpu)],
      ["Gross Margin %", calc.grossMargin.toFixed(1)],
      ["Contribution Margin", Math.round(calc.contributionMargin)],
      ["LTV (net)", Math.round(calc.ltvNet)],
      ["LTV/CAC", calc.ltvCacRatio.toFixed(2)],
      ["Payback (мес.)", calc.paybackMonths.toFixed(1)],
      ["Op. Profit (мес.)", Math.round(calc.opProfit)],
      ["NRR %", saas.netRevenueRetention.toFixed(1)],
      ["Quick Ratio", saas.quickRatio.toFixed(2)],
      ["BEP (ед.)", breakeven.bepUnits],
    ];
    exportToCSV(headers, rows, "unit-economics");
    toast.success("CSV экспортирован");
  }, [calc, saas, breakeven]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-5 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Calculator className="w-4.5 h-4.5 text-white" />
            </div>
            Unit-экономика
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            Комплексная модель бизнес-метрик с расчётом в реальном времени
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddToProjectButton itemType="unit_model" itemId="unit-economics-model" itemTitle="Unit-экономика модель" size="md" />
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-[12px] text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-lg text-[12px] text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Пример
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[12px] hover:opacity-90 disabled:opacity-50 transition-opacity">
            <Save className="w-3.5 h-3.5" /> {saving ? "Сохраняю..." : "Сохранить"}
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <MiniKPI label="Blended CAC" value={fmtCurrency(calc.blendedCAC)} tone={calc.blendedCAC < calc.ltvNet / 3 ? "good" : "warn"} />
        <MiniKPI label="ARPU" value={fmtCurrency(calc.arpu)} tone="neutral" />
        <MiniKPI label="LTV (net)" value={fmtCurrency(calc.ltvNet)} tone="info" />
        <MiniKPI label="LTV/CAC" value={calc.ltvCacRatio.toFixed(1) + "x"} tone={calc.ltvCacRatio >= 3 ? "good" : calc.ltvCacRatio >= 1 ? "warn" : "bad"} />
        <MiniKPI label="Payback" value={calc.paybackMonths < 999 ? calc.paybackMonths.toFixed(1) + " мес." : "∞"} tone={calc.paybackMonths <= 6 ? "good" : calc.paybackMonths <= 12 ? "warn" : "bad"} />
        <MiniKPI label="NRR" value={fmtPct(saas.netRevenueRetention)} tone={saas.netRevenueRetention >= 110 ? "good" : saas.netRevenueRetention >= 100 ? "warn" : "bad"} />
        <MiniKPI label="Op. Margin" value={fmtPct(calc.opMargin)} tone={calc.opMargin > 15 ? "good" : calc.opMargin > 0 ? "warn" : "bad"} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all ${
                tab === t.id ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ══════ TAB: Unit P&L ══════ */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Inputs - left column */}
          <div className="lg:col-span-2 space-y-4">
            <SectionCard title="Привлечение клиентов" icon={Users} color="#0d7377" id="acq">
              <div className="p-4 grid grid-cols-2 gap-3">
                <InputField label="Маркетинг (мес.)" value={m.marketingSpend} onChange={v => set("marketingSpend", v)} suffix="₽" />
                <InputField label="Продажи (мес.)" value={m.salesSpend} onChange={v => set("salesSpend", v)} suffix="₽" />
                <InputField label="Новых платных" value={m.newCustomers} onChange={v => set("newCustomers", v)} />
                <InputField label="Органических" value={m.organicCustomers} onChange={v => set("organicCustomers", v)} />
              </div>
            </SectionCard>

            <SectionCard title="Доход и затраты" icon={DollarSign} color="#22c55e" id="rev">
              <div className="p-4 grid grid-cols-2 gap-3">
                <InputField label="Средний чек" value={m.avgPrice} onChange={v => set("avgPrice", v)} suffix="₽" />
                <InputField label="Покупок / мес." value={m.avgPurchasesPerMonth} onChange={v => set("avgPurchasesPerMonth", v)} step={0.1} />
                <InputField label="Себестоимость (COGS)" value={m.cogs} onChange={v => set("cogs", v)} suffix="%" min={0} max={100} />
                <InputField label="Перем. расход на юзера" value={m.variableCostPerUser} onChange={v => set("variableCostPerUser", v)} suffix="₽" />
                <div className="col-span-2">
                  <InputField label="Постоянные расходы (мес.)" value={m.fixedCostsMonthly} onChange={v => set("fixedCostsMonthly", v)} suffix="₽" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Удержание" icon={Activity} color="#d4a373" id="ret">
              <div className="p-4 grid grid-cols-2 gap-3">
                <InputField label="Месячный Churn" value={m.monthlyChurnRate} onChange={v => set("monthlyChurnRate", v)} suffix="%" step={0.1} min={0} max={100} />
                <InputField label="Expansion Revenue" value={m.expansionRevenueRate} onChange={v => set("expansionRevenueRate", v)} suffix="% MoM" step={0.5} />
              </div>
            </SectionCard>
          </div>

          {/* Results - right column */}
          <div className="lg:col-span-3 space-y-4">
            {/* CAC Waterfall */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-teal-600" /> CAC Waterfall
              </h4>
              <TableWrapper headers={["Метрика", "Значение", ""]}>
                <ResultRow label="Маркетинг" value={fmtCurrency(m.marketingSpend)} tone="neutral" tooltip={`${calc.marketingCACShare.toFixed(0)}% от общего`} />
                <ResultRow label="Продажи" value={fmtCurrency(m.salesSpend)} tone="neutral" />
                <ResultRow label="Общие расходы на привлечение" value={fmtCurrency(calc.totalAcqSpend)} bold tone="neutral" />
                <ResultRow label="Платных клиентов" value={m.newCustomers} tone="neutral" />
                <ResultRow label="Органических клиентов" value={m.organicCustomers} tone="neutral" tooltip={`${calc.organicShare.toFixed(0)}% от всех`} />
                <ResultRow label="Paid CAC" value={fmtCurrency(calc.paidCAC)} tone={calc.paidCAC > calc.ltvNet ? "bad" : "neutral"} tooltip="Расходы ÷ Только платные клиенты" />
                <ResultRow label="Blended CAC" value={fmtCurrency(calc.blendedCAC)} bold tone={calc.blendedCAC > calc.ltvNet / 3 ? "warn" : "good"} tooltip="Расходы ÷ Все клиенты (вкл. органику)" />
              </TableWrapper>
              <Verdict tone={calc.blendedCAC < calc.ltvNet / 3 ? "good" : calc.blendedCAC < calc.ltvNet ? "warn" : "bad"} text={calc.blendedCAC < calc.ltvNet / 3 ? `CAC в здоровой зоне — ${fmtCurrency(calc.blendedCAC)} составляет менее трети LTV (${fmtCurrency(calc.ltvNet)}). Органика ${calc.organicShare.toFixed(0)}% — хороший признак.` : calc.blendedCAC < calc.ltvNet ? `CAC (${fmtCurrency(calc.blendedCAC)}) приближается к критической зоне — более трети LTV. Оптимизируйте каналы или наращивайте органику.` : `CAC (${fmtCurrency(calc.blendedCAC)}) превышает LTV — каждый клиент убыточен. Срочно пересмотрите модель привлечения.`} />
            </div>

            {/* Unit P&L */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4 text-emerald-500" /> Unit P&L (на 1 клиента / месяц)
              </h4>
              <TableWrapper headers={["Статья", "Сумма", ""]}>
                <ResultRow label="Revenue (ARPU)" value={fmtCurrency(calc.arpu)} bold tone="info" tooltip="Средний чек × Покупок/мес." />
                <ResultRow label="− COGS" value={`−${fmtCurrency(calc.cogsPerCustomer)}`} tone="bad" tooltip={`${m.cogs}% от revenue`} />
                <ResultRow label="= Gross Profit" value={fmtCurrency(calc.grossProfit)} bold tone={calc.grossMargin >= 60 ? "good" : calc.grossMargin >= 40 ? "warn" : "bad"} tooltip={`Gross Margin: ${fmtPct(calc.grossMargin)}`} />
                <ResultRow label="− Variable Costs" value={`−${fmtCurrency(m.variableCostPerUser)}`} tone="bad" />
                <ResultRow label="= Contribution Margin" value={fmtCurrency(calc.contributionMargin)} bold tone={calc.cmPercent >= 40 ? "good" : calc.cmPercent >= 20 ? "warn" : "bad"} tooltip={`CM%: ${fmtPct(calc.cmPercent)}. Покрывает пост. расходы`} />
              </TableWrapper>
              <Verdict tone={calc.contributionMargin > 0 ? (calc.cmPercent >= 40 ? "good" : "warn") : "bad"} text={calc.contributionMargin > 0 ? `Каждый клиент приносит ${fmtCurrency(calc.contributionMargin)} CM (${fmtPct(calc.cmPercent)}). ${calc.grossMargin >= 60 ? "Валовая маржа высокая — структура затрат эффективна." : "Рассмотрите снижение COGS или переменных расходов."}` : `CM отрицательный — бизнес теряет ${fmtCurrency(Math.abs(calc.contributionMargin))} на клиенте до постоянных расходов. Пересмотрите цены или затраты.`} />
            </div>

            {/* LTV Engine */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-amber-500" /> LTV Engine
              </h4>
              <TableWrapper headers={["Метрика", "Значение", ""]}>
                <ResultRow label="Avg Lifetime" value={calc.avgLifetimeMonths < 999 ? calc.avgLifetimeMonths.toFixed(1) + " мес." : "∞"} tone="neutral" tooltip="1 ÷ Monthly Churn Rate" />
                <ResultRow label="LTV (revenue)" value={fmtCurrency(calc.ltv)} tone="neutral" tooltip="ARPU × Lifetime" />
                <ResultRow label="LTV (gross)" value={fmtCurrency(calc.ltvGross)} tone="neutral" tooltip="Gross Profit × Lifetime" />
                <ResultRow label="LTV (net = CM-based)" value={fmtCurrency(calc.ltvNet)} bold tone="info" tooltip="Contribution Margin × Lifetime. Основной показатель" />
                <ResultRow label="LTV / CAC" value={calc.ltvCacRatio.toFixed(2) + "x"} bold tone={calc.ltvCacRatio >= 3 ? "good" : calc.ltvCacRatio >= 1.5 ? "warn" : "bad"} tooltip="≥3x хорошо, ≥5x отлично. <1x — убыток" />
                <ResultRow label="Payback Period" value={calc.paybackMonths < 999 ? calc.paybackMonths.toFixed(1) + " мес." : "∞"} bold tone={calc.paybackMonths <= 6 ? "good" : calc.paybackMonths <= 12 ? "warn" : "bad"} tooltip="CAC ÷ CM. SaaS норма: 12–18 мес." />
              </TableWrapper>
              <Verdict tone={calc.ltvCacRatio >= 3 ? "good" : calc.ltvCacRatio >= 1.5 ? "warn" : "bad"} text={calc.ltvCacRatio >= 3 ? `LTV/CAC = ${calc.ltvCacRatio.toFixed(1)}x, payback ${calc.paybackMonths.toFixed(1)} мес. — экономика здорова. ${calc.ltvCacRatio >= 5 ? "Можно агрессивнее инвестировать в привлечение." : "Запас прочности достаточный, фокус на снижение churn для роста LTV."}` : calc.ltvCacRatio >= 1.5 ? `LTV/CAC = ${calc.ltvCacRatio.toFixed(1)}x — ниже целевых 3x. Payback ${calc.paybackMonths.toFixed(1)} мес. создаёт кассовый разрыв. Приоритет: снижение churn с ${fmtPct(m.monthlyChurnRate)}.` : `LTV/CAC = ${calc.ltvCacRatio.toFixed(1)}x — критическая ситуация. ${calc.ltvCacRatio < 1 ? "Каждый клиент убыточен." : "Экономика на грани."} Пересмотрите модель.`} />
            </div>

            {/* Monthly Totals */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-teal-500" /> Месячные итоги ({calc.totalCustomers} клиентов)
              </h4>
              <TableWrapper headers={["Статья", "Сумма", ""]}>
                <ResultRow label="Выручка (MRR)" value={fmtCurrency(calc.totalMRR)} bold tone="info" />
                <ResultRow label="Gross Profit" value={fmtCurrency(calc.totalGrossProfit)} tone="neutral" />
                <ResultRow label="Total Contribution" value={fmtCurrency(calc.totalContribution)} tone="neutral" />
                <ResultRow label="− Fixed Costs" value={`−${fmtCurrency(m.fixedCostsMonthly)}`} tone="bad" />
                <ResultRow label="= Operating Profit" value={fmtCurrency(calc.opProfit)} bold tone={calc.opProfit > 0 ? "good" : "bad"} tooltip={`Op. Margin: ${fmtPct(calc.opMargin)}`} />
              </TableWrapper>
              <Verdict tone={calc.opProfit > 0 ? (calc.opMargin > 15 ? "good" : "warn") : "bad"} text={calc.opProfit > 0 ? `Бизнес прибылен: ${fmtCurrency(calc.opProfit)}/мес. (маржа ${fmtPct(calc.opMargin)}). ${calc.opMargin > 20 ? "Запас позволяет масштабировать." : "Маржа тонкая — контролируйте фикс при росте."}` : `Убыток ${fmtCurrency(Math.abs(calc.opProfit))}/мес. ${calc.totalContribution > 0 ? `CM положительный — нужно ещё ~${Math.ceil(m.fixedCostsMonthly / calc.contributionMargin - calc.totalCustomers)} клиентов для нуля.` : "CM отрицательный — пересмотрите цены."}`} />
            </div>
          </div>
        </div>
      )}

      {/* ══════ TAB: SaaS Metrics ══════ */}
      {tab === "saas" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <SectionCard title="MRR-движение" icon={Activity} color="#0d7377" id="mrr-input">
              <div className="p-4 space-y-3">
                <InputField label="New MRR (новые клиенты)" value={m.mrrNew} onChange={v => set("mrrNew", v)} suffix="₽" />
                <InputField label="Expansion MRR (апсейл)" value={m.mrrExpansion} onChange={v => set("mrrExpansion", v)} suffix="₽" />
                <InputField label="Contraction MRR (даунгрейд)" value={m.mrrContraction} onChange={v => set("mrrContraction", v)} suffix="₽" />
                <InputField label="Churned MRR (отток)" value={m.mrrChurned} onChange={v => set("mrrChurned", v)} suffix="₽" />
              </div>
            </SectionCard>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {/* MRR Bridge */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-teal-600" /> MRR Bridge
              </h4>
              <TableWrapper headers={["Компонент", "Сумма", ""]}>
                <ResultRow label="Starting MRR" value={fmtCurrency(saas.startMRR)} bold tone="neutral" />
                <ResultRow label="+ New MRR" value={`+${fmtCurrency(m.mrrNew)}`} tone="good" />
                <ResultRow label="+ Expansion MRR" value={`+${fmtCurrency(m.mrrExpansion)}`} tone="good" />
                <ResultRow label="− Contraction MRR" value={`−${fmtCurrency(m.mrrContraction)}`} tone="warn" />
                <ResultRow label="− Churned MRR" value={`−${fmtCurrency(m.mrrChurned)}`} tone="bad" />
                <ResultRow label="= Net New MRR" value={fmtCurrency(saas.netNewMRR)} bold tone={saas.netNewMRR > 0 ? "good" : "bad"} />
                <ResultRow label="= Ending MRR" value={fmtCurrency(saas.endMRR)} bold tone="info" />
                <ResultRow label="ARR (×12)" value={fmtCurrency(saas.arr)} bold tone="info" />
              </TableWrapper>
              <Verdict tone={saas.netNewMRR > 0 ? "good" : "bad"} text={saas.netNewMRR > 0 ? `MRR растёт на ${fmtCurrency(saas.netNewMRR)}/мес. ${m.mrrExpansion > m.mrrChurned ? "Expansion превышает отток — признак product-market fit." : "Отток превышает expansion — работайте над upsell и retention."}` : `MRR сокращается на ${fmtCurrency(Math.abs(saas.netNewMRR))}/мес. Отток (${fmtCurrency(m.mrrContraction + m.mrrChurned)}) превышает приход. Приоритет — снижение churn.`} />
            </div>

            {/* SaaS Health Metrics */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-amber-500" /> SaaS Health Dashboard
              </h4>
              <TableWrapper headers={["Метрика", "Значение", ""]}>
                <ResultRow label="Gross MRR Churn Rate" value={fmtPct(saas.grossChurnRate)} tone={saas.grossChurnRate <= 2 ? "good" : saas.grossChurnRate <= 5 ? "warn" : "bad"} tooltip="Churned MRR ÷ Starting MRR. B2B SaaS: <2% мес." />
                <ResultRow label="Gross Revenue Retention (GRR)" value={fmtPct(saas.grossRetention)} tone={saas.grossRetention >= 90 ? "good" : saas.grossRetention >= 80 ? "warn" : "bad"} tooltip="(Starting − Churned) ÷ Starting × 100%. Top SaaS: >90%" />
                <ResultRow label="Net Revenue Retention (NRR)" value={fmtPct(saas.netRevenueRetention)} bold tone={saas.netRevenueRetention >= 120 ? "good" : saas.netRevenueRetention >= 100 ? "warn" : "bad"} tooltip="(Starting + Expansion − Contraction − Churned) ÷ Starting. Топ: >120%" />
                <ResultRow label="Quick Ratio" value={saas.quickRatio < 100 ? saas.quickRatio.toFixed(2) : "∞"} bold tone={saas.quickRatio >= 4 ? "good" : saas.quickRatio >= 2 ? "warn" : "bad"} tooltip="(New + Expansion) ÷ (Contraction + Churned). ≥4 — отлично, ≥2 — здоровый рост" />
                <ResultRow label="Magic Number" value={saas.magicNumber.toFixed(2)} tone={saas.magicNumber >= 1 ? "good" : saas.magicNumber >= 0.5 ? "warn" : "bad"} tooltip="Net New ARR ÷ S&M Spend. ≥1 — масштабируйтесь. <0.5 — оптимизируйте" />
                <ResultRow label="Burn Multiple" value={saas.burnMultiple < 100 ? saas.burnMultiple.toFixed(1) + "x" : "∞"} tone={saas.burnMultiple <= 1.5 ? "good" : saas.burnMultiple <= 3 ? "warn" : "bad"} tooltip="Net Burn ÷ Net New ARR. <1.5x — отлично (Bessemer)" />
                <ResultRow label="Rule of 40" value={saas.rule40.toFixed(0) + "%"} bold tone={saas.rule40 >= 40 ? "good" : saas.rule40 >= 20 ? "warn" : "bad"} tooltip="Growth Rate + Profit Margin. ≥40% — лидер рынка" />
                <ResultRow label="LTV (SaaS-формула)" value={fmtCurrency(saas.ltvFromMrr)} tone="info" tooltip="ARPU × Gross Margin ÷ Monthly Churn" />
              </TableWrapper>
              <Verdict tone={saas.rule40 >= 40 ? "good" : saas.rule40 >= 20 ? "warn" : "bad"} text={`${saas.netRevenueRetention >= 120 ? "NRR >120% — топ SaaS" : saas.netRevenueRetention >= 100 ? "NRR >100% — когорты растут" : `NRR ${fmtPct(saas.netRevenueRetention)} — когорты сжимаются`}. Quick Ratio ${saas.quickRatio < 100 ? saas.quickRatio.toFixed(1) : "∞"} — ${saas.quickRatio >= 4 ? "отличный" : saas.quickRatio >= 2 ? "здоровый" : "рост неустойчив"}. Rule of 40: ${saas.rule40.toFixed(0)}% — ${saas.rule40 >= 40 ? "лидер рынка" : saas.rule40 >= 20 ? "зона роста" : "ниже нормы"}. ${saas.magicNumber >= 1 ? "Magic Number ≥1 — пора масштабировать S&M." : saas.magicNumber >= 0.5 ? "Magic Number умеренный." : "Magic Number <0.5 — S&M неэффективен."}`} />
            </div>
          </div>
        </div>
      )}

      {/* ══════ TAB: Cohort ══════ */}
      {tab === "cohort" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" /> Когортный Retention (размер когорты: {m.cohortSize})
              </h4>
              <InputField label="" value={m.cohortSize} onChange={v => set("cohortSize", v)} small />
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">Введите % удержания для каждого месяца. Месяц 0 = 100% (регистрация).</p>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-2 mb-4">
              {m.retentionByMonth.map((ret, i) => (
                <div key={i}>
                  <label className="text-[10px] text-muted-foreground block text-center">M{i}</label>
                  <input
                    type="number" min={0} max={100} value={ret}
                    onChange={e => setRetention(i, parseFloat(e.target.value) || 0)}
                    className={`w-full text-center bg-muted/30 border border-border rounded-lg px-1 py-1.5 text-[12px] font-mono ${
                      i === 0 ? "text-muted-foreground" : "text-foreground"
                    } focus:border-[color:var(--ring)]/50 outline-none`}
                    disabled={i === 0}
                  />
                </div>
              ))}
            </div>

            {/* Retention Heatmap Bar */}
            <div className="flex gap-0.5 mb-4">
              {m.retentionByMonth.map((ret, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm relative group"
                  style={{
                    height: 32,
                    background: ret > 50 ? `rgba(34,197,94,${ret / 150})` : ret > 20 ? `rgba(245,158,11,${ret / 120})` : `rgba(239,68,68,${Math.max(ret, 10) / 100})`,
                  }}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    {ret}%
                  </span>
                </div>
              ))}
            </div>

            {/* Cohort Revenue Table */}
            <div className="overflow-x-auto">
              <TableWrapper headers={["Месяц", "Retention", "Активных", "Revenue мес.", "Revenue кум.", "LTV кум.", ""]}>
                {cohort.rows.map(r => (
                  <tr key={r.month} className={`border-t border-border hover:bg-muted/15 transition-colors ${
                    cohort.cacPaybackMonth === r.month ? "bg-emerald-500/5" : ""
                  }`}>
                    <td className="px-4 py-2 text-[12px] text-foreground font-medium">M{r.month}</td>
                    <td className="px-4 py-2 text-[12px] text-right tabular-nums">
                      <span className={r.retention >= 50 ? "text-emerald-600" : r.retention >= 20 ? "text-amber-600" : "text-red-500"}>
                        {r.retention}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[12px] text-right text-foreground tabular-nums">{r.activeUsers.toLocaleString("ru-RU")}</td>
                    <td className="px-4 py-2 text-[12px] text-right text-foreground tabular-nums">{fmtCurrency(r.monthRevenue)}</td>
                    <td className="px-4 py-2 text-[12px] text-right text-foreground tabular-nums font-medium">{fmtCurrency(r.cumRevenue)}</td>
                    <td className="px-4 py-2 text-[12px] text-right tabular-nums font-semibold">
                      <span className={r.cumLTV >= calc.blendedCAC ? "text-emerald-600" : "text-foreground"}>
                        {fmtCurrency(r.cumLTV)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center w-8">
                      {cohort.cacPaybackMonth === r.month && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-semibold whitespace-nowrap">
                          CAC payback
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </TableWrapper>
            </div>

            <div className="mt-4 flex gap-6 text-[12px]">
              <div>
                <span className="text-muted-foreground">Cohort LTV: </span>
                <span className="text-foreground font-semibold">{fmtCurrency(cohort.cohortLTV)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Revenue: </span>
                <span className="text-foreground font-semibold">{fmtCurrency(cohort.totalCohortRevenue)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">CAC Payback: </span>
                <span className={`font-semibold ${cohort.cacPaybackMonth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {cohort.cacPaybackMonth >= 0 ? `M${cohort.cacPaybackMonth}` : "не окупается"}
                </span>
              </div>
            </div>
            <Verdict tone={cohort.cacPaybackMonth >= 0 ? (cohort.cacPaybackMonth <= 3 ? "good" : cohort.cacPaybackMonth <= 6 ? "warn" : "info") : "bad"} text={cohort.cacPaybackMonth >= 0 ? `CAC окупается на M${cohort.cacPaybackMonth}. 12-мес. LTV когорты: ${fmtCurrency(cohort.cohortLTV)}. Retention к M11: ${m.retentionByMonth[11]}% — ${m.retentionByMonth[11] >= 25 ? "в норме для подписок." : "ниже бенчмарков, работайте над удержанием M1-M3."}` : `CAC (${fmtCurrency(calc.blendedCAC)}) не окупается за 12 мес. Когортный LTV лишь ${fmtCurrency(cohort.cohortLTV)}. Повышайте retention на ранних этапах (M1: ${m.retentionByMonth[1]}%, M3: ${m.retentionByMonth[3]}%).`} />
          </div>
        </div>
      )}

      {/* ══════ TAB: Break-even ══════ */}
      {tab === "breakeven" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <SectionCard title="Параметры" icon={Target} color="#ef4444" id="be-input">
              <div className="p-4 space-y-3">
                <InputField label="Постоянные расходы (мес.)" value={m.beFixedCosts} onChange={v => set("beFixedCosts", v)} suffix="₽" />
                <InputField label="Переменные расходы / ед." value={m.beVariableCostPerUnit} onChange={v => set("beVariableCostPerUnit", v)} suffix="₽" />
                <InputField label="Цена продажи / ед." value={m.bePricePerUnit} onChange={v => set("bePricePerUnit", v)} suffix="₽" />
              </div>
            </SectionCard>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-red-500" /> Точка безубыточности (BEP)
              </h4>
              <TableWrapper headers={["Метрика", "Значение", ""]}>
                <ResultRow label="Contribution Margin / ед." value={fmtCurrency(breakeven.cm)} tone={breakeven.cm > 0 ? "good" : "bad"} tooltip="Цена − Переменные расходы" />
                <ResultRow label="CM Ratio" value={fmtPct(breakeven.cmRatio)} tone={breakeven.cmRatio >= 50 ? "good" : breakeven.cmRatio >= 30 ? "warn" : "bad"} tooltip="CM ÷ Цена × 100%" />
                <ResultRow label="BEP (единицы)" value={breakeven.bepUnits < Infinity ? breakeven.bepUnits.toLocaleString("ru-RU") : "∞"} bold tone={breakeven.bepUnits < Infinity ? "info" : "bad"} tooltip="Пост. расходы ÷ CM на единицу" />
                <ResultRow label="BEP (выручка)" value={breakeven.bepRevenue < Infinity ? fmtCurrency(breakeven.bepRevenue) : "∞"} bold tone="info" tooltip="BEP (ед.) × Цена" />
              </TableWrapper>
              <Verdict tone={breakeven.cm > 0 ? (breakeven.bepUnits <= calc.totalCustomers ? "good" : "warn") : "bad"} text={breakeven.cm > 0 ? (breakeven.bepUnits <= calc.totalCustomers ? `За точкой безубыточности: BEP ${breakeven.bepUnits.toLocaleString("ru-RU")} ед., база ${calc.totalCustomers} клиентов. Запас прочности ${fmtPct(((calc.totalCustomers - breakeven.bepUnits) / calc.totalCustomers) * 100)}.` : `Нужно ${breakeven.bepUnits.toLocaleString("ru-RU")} ед. при ${calc.totalCustomers} клиентах — дефицит ${(breakeven.bepUnits - calc.totalCustomers).toLocaleString("ru-RU")}. CM Ratio ${fmtPct(breakeven.cmRatio)} — ${breakeven.cmRatio >= 50 ? "масштабирование поможет." : "рассмотрите повышение цены."}`) : `CM отрицательный — каждая единица увеличивает убыток. Цена не покрывает переменные расходы.`} />
            </div>

            {/* Sensitivity Analysis */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-amber-500" /> Анализ чувствительности (изменение цены)
              </h4>
              <div className="overflow-x-auto">
                <TableWrapper headers={["Δ Цены", "Цена / ед.", "BEP (ед.)", "BEP (выручка)", ""]}>
                  {breakeven.sensitivity.map(s => (
                    <tr key={s.delta} className={`border-t border-border hover:bg-muted/15 transition-colors ${s.delta === 0 ? "bg-primary/5 font-semibold" : ""}`}>
                      <td className="px-4 py-2 text-[12px] text-foreground">
                        <span className={s.delta > 0 ? "text-emerald-600" : s.delta < 0 ? "text-red-500" : "text-foreground"}>
                          {s.delta > 0 ? "+" : ""}{s.delta}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[12px] text-right text-foreground tabular-nums">{fmtCurrency(s.price)}</td>
                      <td className="px-4 py-2 text-[12px] text-right text-foreground tabular-nums">{s.bep < Infinity ? s.bep.toLocaleString("ru-RU") : "∞"}</td>
                      <td className="px-4 py-2 text-[12px] text-right text-foreground tabular-nums">{s.revenue < Infinity ? fmtCurrency(s.revenue) : "∞"}</td>
                      <td className="px-3 py-2 w-8">
                        {s.delta === 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">текущая</span>}
                      </td>
                    </tr>
                  ))}
                </TableWrapper>
              </div>
              <Verdict tone="info" text={`При -20% цены BEP: ${breakeven.sensitivity[0].bep < Infinity ? breakeven.sensitivity[0].bep.toLocaleString("ru-RU") : "∞"} ед., при +20%: ${breakeven.sensitivity[4].bep < Infinity ? breakeven.sensitivity[4].bep.toLocaleString("ru-RU") : "∞"} ед. ${breakeven.sensitivity[0].bep < Infinity && breakeven.sensitivity[4].bep < Infinity && breakeven.sensitivity[4].bep > 0 ? (breakeven.sensitivity[0].bep / breakeven.sensitivity[4].bep > 2 ? "Высокая чувствительность к цене — ценообразование критично." : "Умеренная чувствительность — модель устойчива.") : "Модель сильно зависит от ценообразования."}`} />
            </div>
          </div>
        </div>
      )}

      {/* ══════ TAB: Scenario Planner ══════ */}
      {tab === "scenario" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h4 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-500" /> Сценарное планирование
              </h4>
              <div className="flex items-center gap-3">
                <InputField label="Пессим. рост" value={m.scenarioGrowthPessimistic} onChange={v => set("scenarioGrowthPessimistic", v)} suffix="% мес." />
                <InputField label="Базовый рост" value={m.scenarioGrowthBase} onChange={v => set("scenarioGrowthBase", v)} suffix="% мес." />
                <InputField label="Оптим. рост" value={m.scenarioGrowthOptimistic} onChange={v => set("scenarioGrowthOptimistic", v)} suffix="% мес." />
                <InputField label="Горизонт" value={m.scenarioMonths} onChange={v => set("scenarioMonths", Math.max(1, Math.min(36, v)))} suffix="мес." />
              </div>
            </div>

            {/* Scenario comparison table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Мес.</th>
                    {scenarios.map(sc => (
                      <th key={sc.label} colSpan={3} className="px-3 py-2.5 text-center font-semibold text-muted-foreground border-l border-border">
                        {sc.label} ({sc.growthPct}% м/м)
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-muted/20 border-b border-border">
                    <th className="px-3 py-1.5"></th>
                    {scenarios.flatMap(sc => [
                      <th key={sc.label + "-customers"} className="px-3 py-1.5 text-right text-muted-foreground border-l border-border">Клиенты</th>,
                      <th key={sc.label + "-mrr"} className="px-3 py-1.5 text-right text-muted-foreground">MRR</th>,
                      <th key={sc.label + "-profit"} className="px-3 py-1.5 text-right text-muted-foreground">Op. Profit</th>
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {scenarios[0].rows.map((_, mi) => (
                    <tr key={mi} className="border-t border-border hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-2 text-foreground font-medium">M{scenarios[0].rows[mi].month}</td>
                      {scenarios.flatMap((sc, si) => {
                        const r = sc.rows[mi];
                        return [
                          <td key={`${si}-customers`} className="px-3 py-2 text-right text-foreground tabular-nums border-l border-border">{r.customers.toLocaleString("ru-RU")}</td>,
                          <td key={`${si}-mrr`} className="px-3 py-2 text-right text-foreground tabular-nums">{fmtCurrency(r.mrr)}</td>,
                          <td key={`${si}-profit`} className={`px-3 py-2 text-right tabular-nums font-medium ${r.opProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {fmtCurrency(r.opProfit)}
                          </td>
                        ];
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                    <td className="px-3 py-2.5 text-foreground">Итого</td>
                    {scenarios.flatMap((sc, si) => {
                      const last = sc.rows[sc.rows.length - 1];
                      return [
                        <td key={`${si}-customers`} className="px-3 py-2.5 text-right text-foreground tabular-nums border-l border-border">{last.customers.toLocaleString("ru-RU")}</td>,
                        <td key={`${si}-mrr`} className="px-3 py-2.5 text-right text-foreground tabular-nums">{fmtCurrency(last.mrr)}</td>,
                        <td key={`${si}-profit`} className={`px-3 py-2.5 text-right tabular-nums ${last.cumProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {fmtCurrency(last.cumProfit)}
                        </td>
                      ];
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Scenario summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scenarios.map(sc => {
              const last = sc.rows[sc.rows.length - 1];
              const profitableMonth = sc.rows.findIndex(r => r.cumProfit > 0);
              return (
                <div key={sc.label} className="bg-card border border-border rounded-xl p-5">
                  <h4 className="text-[12px] font-semibold text-foreground mb-3">{sc.label} ({sc.growthPct}% рост)</h4>
                  <div className="space-y-2 text-[12px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Клиентов к M{m.scenarioMonths}</span>
                      <span className="text-foreground font-medium">{last.customers.toLocaleString("ru-RU")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">MRR к M{m.scenarioMonths}</span>
                      <span className="text-foreground font-medium">{fmtCurrency(last.mrr)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ARR к M{m.scenarioMonths}</span>
                      <span className="text-foreground font-medium">{fmtCurrency(last.mrr * 12)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cum. Profit</span>
                      <span className={`font-medium ${last.cumProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {fmtCurrency(last.cumProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Выход в плюс</span>
                      <span className={`font-medium ${profitableMonth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {profitableMonth >= 0 ? `M${sc.rows[profitableMonth].month}` : `не в горизонте ${m.scenarioMonths} мес.`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Verdict
            tone={scenarios[1].rows[scenarios[1].rows.length - 1].cumProfit > 0 ? "good" : "warn"}
            text={(() => {
              const base = scenarios[1].rows[scenarios[1].rows.length - 1];
              const pess = scenarios[0].rows[scenarios[0].rows.length - 1];
              const opt = scenarios[2].rows[scenarios[2].rows.length - 1];
              const baseProfitable = scenarios[1].rows.findIndex(r => r.cumProfit > 0);
              return `Базовый сценарий (${m.scenarioGrowthBase}% м/м): ${base.cumProfit >= 0 ? `кумулятивная прибыль ${fmtCurrency(base.cumProfit)} к M${m.scenarioMonths}` : `убыток ${fmtCurrency(Math.abs(base.cumProfit))}`}${baseProfitable >= 0 ? `, выход в плюс на M${scenarios[1].rows[baseProfitable].month}` : ""}. Пессимистичный: ${pess.cumProfit >= 0 ? "прибылен" : `убыток ${fmtCurrency(Math.abs(pess.cumProfit))}`}. Оптимистичный: MRR ${fmtCurrency(opt.mrr)}, ARR ${fmtCurrency(opt.mrr * 12)}. ${pess.cumProfit < 0 && base.cumProfit >= 0 ? "Бизнес-модель чувствительна к темпу роста — следите за метриками привлечения." : pess.cumProfit >= 0 ? "Модель устойчива даже при пессимистичном сценарии." : "Все сценарии убыточны — пересмотрите структуру затрат."}`;
            })()}
          />
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MINI KPI
// ════════════════════════════════════════════════════════════════

function MiniKPI({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className={`rounded-xl border border-border p-3 ${toneBg[tone]}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-[17px] font-semibold tabular-nums ${toneColor[tone]}`}>{value}</p>
    </div>
  );
}