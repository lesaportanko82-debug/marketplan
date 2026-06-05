import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { Project, Campaign } from "../data/mock-data";
import { toast } from "sonner";
import { getData, saveData } from "../lib/api";
import {
  Plus,
  Filter,
  ArrowUpDown,
  TrendingUp,
  Pause,
  Play,
  CheckCircle2,
  Clock,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  GripVertical,
  Info,
  ListOrdered,
} from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const COLORS = [
  "#0d7377",
  "#1a7a6d",
  "#2eb8a4",
  "#06b6d4",
  "#f59e0b",
  "#10b981",
  "#d4a373",
  "#c08a40",
  "#38bdf8",
];

const CAMPAIGN_DND_TYPE = "CAMPAIGN_ROW";

const statusConfig: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  active: {
    label: "Активная",
    icon: Play,
    color: "bg-green-500/10 text-green-600",
  },
  paused: {
    label: "На паузе",
    icon: Pause,
    color: "bg-amber-500/10 text-amber-600",
  },
  completed: {
    label: "Завершена",
    icon: CheckCircle2,
    color: "bg-teal-500/10 text-teal-600",
  },
  planned: {
    label: "Запланирована",
    icon: Clock,
    color: "bg-muted text-muted-foreground",
  },
};

function DraggableCampaignRow({
  campaign,
  index,
  moveRow,
  formatNum,
  priorityMode,
}: {
  campaign: Campaign;
  index: number;
  moveRow: (dragIndex: number, hoverIndex: number) => void;
  formatNum: (n: number) => string;
  priorityMode: boolean;
}) {
  const ref = useRef<HTMLTableRowElement>(null);
  const cfg = statusConfig[campaign.status];
  const spentPercent =
    campaign.budget > 0 ? Math.round((campaign.spent / campaign.budget) * 100) : 0;

  const [{ isDragging }, drag, preview] = useDrag({
    type: CAMPAIGN_DND_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: priorityMode,
  });

  const [{ isOver }, drop] = useDrop({
    accept: CAMPAIGN_DND_TYPE,
    hover: (item: { index: number }) => {
      if (item.index === index) return;
      moveRow(item.index, index);
      item.index = index;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  // Compose refs properly - drop() and preview() return void in react-dnd v16
  const composedRef = useCallback(
    (el: HTMLTableRowElement | null) => {
      (ref as React.MutableRefObject<HTMLTableRowElement | null>).current = el;
      drop(el);
      preview(el);
    },
    [drop, preview]
  );

  return (
    <tr
      ref={composedRef}
      className={`border-b border-border last:border-0 transition-all ${
        isDragging ? "opacity-30" : ""
      } ${isOver ? "bg-primary/5" : "hover:bg-accent/30"}`}
    >
      {priorityMode && (
        <td className="py-3 px-2 w-12">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground w-4 text-center">
              {index + 1}
            </span>
            <div
              ref={drag}
              className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          </div>
        </td>
      )}
      <td className="py-3 px-4 text-foreground">{campaign.name}</td>
      <td className="py-3 px-4 text-muted-foreground">{campaign.channel}</td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] ${cfg.color}`}
        >
          <cfg.icon className="w-3 h-3" />
          {cfg.label}
        </span>
      </td>
      <td className="py-3 px-4 text-right text-foreground">
        {formatNum(campaign.budget)}
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-foreground">{formatNum(campaign.spent)}</span>
        <span className="text-muted-foreground text-[11px] ml-1">
          ({spentPercent}%)
        </span>
      </td>
      <td className="py-3 px-4 text-right text-foreground">
        {campaign.conversions.toLocaleString("ru-RU")}
      </td>
      <td className="py-3 px-4 text-right text-foreground">
        {campaign.cpa > 0 ? `${campaign.cpa} RUB` : "-"}
      </td>
      <td className="py-3 px-4 text-right">
        {campaign.roi > 0 ? (
          <span className="text-green-600 flex items-center gap-1 justify-end">
            <TrendingUp className="w-3.5 h-3.5" />
            {campaign.roi}%
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
    </tr>
  );
}

export function CampaignsTab({ project }: { project: Project }) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"budget" | "roi" | "name" | "priority">(
    "budget"
  );
  const [priorityMode, setPriorityMode] = useState(false);
  const [campaignOrder, setCampaignOrder] = useState<Campaign[]>(
    project.campaigns
  );

  // Load persisted campaign order
  useEffect(() => {
    getData<string[]>(`campaign_order:${project.id}`).then((savedOrder) => {
      if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
        // Reorder campaigns based on saved IDs
        const orderMap = new Map(savedOrder.map((id, i) => [id, i]));
        const reordered = [...project.campaigns].sort((a, b) => {
          const ai = orderMap.get(a.id) ?? 999;
          const bi = orderMap.get(b.id) ?? 999;
          return ai - bi;
        });
        setCampaignOrder(reordered);
        console.log(`Loaded persisted campaign order for project ${project.id}`);
      }
    });
  }, [project.id]);

  const filteredCampaigns = useMemo(() => {
    if (priorityMode) {
      let list = [...campaignOrder];
      if (filterStatus !== "all") {
        list = list.filter((c) => c.status === filterStatus);
      }
      return list;
    }
    let list = [...project.campaigns];
    if (filterStatus !== "all") {
      list = list.filter((c) => c.status === filterStatus);
    }
    if (sortBy !== "priority") {
      list.sort((a, b) => {
        if (sortBy === "budget") return b.budget - a.budget;
        if (sortBy === "roi") return b.roi - a.roi;
        return a.name.localeCompare(b.name);
      });
    }
    return list;
  }, [project.campaigns, campaignOrder, filterStatus, sortBy, priorityMode]);

  const moveRow = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      setCampaignOrder((prev) => {
        const updated = [...prev];
        const [removed] = updated.splice(dragIndex, 1);
        updated.splice(hoverIndex, 0, removed);
        // Persist order to Supabase
        const orderIds = updated.map((c) => c.id);
        saveData(`campaign_order:${project.id}`, orderIds).then((ok) => {
          if (ok) console.log("Campaign order persisted");
        });
        return updated;
      });
    },
    [project.id]
  );

  const totalBudget = project.campaigns.reduce((s, c) => s + c.budget, 0);
  const totalSpent = project.campaigns.reduce((s, c) => s + c.spent, 0);
  const totalConversions = project.campaigns.reduce(
    (s, c) => s + c.conversions,
    0
  );
  const avgCPA = totalSpent / (totalConversions || 1);

  const budgetByChannel = useMemo(() => {
    const map: Record<string, number> = {};
    project.campaigns.forEach((c) => {
      map[c.channel] = (map[c.channel] || 0) + c.budget;
    });
    return Object.entries(map).map(([name, value], idx) => ({ 
      id: `channel-${name}-${idx}`, 
      name, 
      value 
    }));
  }, [project.campaigns]);

  const roiByChannel = useMemo(() => {
    return project.campaigns
      .filter((c) => c.roi > 0)
      .map((c, idx) => ({ 
        id: `roi-${c.id}-${idx}`,
        name: c.name.slice(0, 20), 
        roi: c.roi, 
        cpa: c.cpa 
      }));
  }, [project.campaigns]);

  const formatNum = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}M`
      : n >= 1000
      ? `${Math.round(n / 1000)}K`
      : n.toString();

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-[13px] mb-2">
              <DollarSign className="w-4 h-4" />
              Общий бюджет
            </div>
            <p className="text-[24px] text-foreground">
              {formatNum(totalBudget)}
            </p>
            <p className="text-[12px] text-muted-foreground">
              Потрачено: {formatNum(totalSpent)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-[13px] mb-2">
              <TrendingUp className="w-4 h-4" />
              Конверсии
            </div>
            <p className="text-[24px] text-foreground">
              {formatNum(totalConversions)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-[13px] mb-2">
              <BarChart3 className="w-4 h-4" />
              Средний CPA
            </div>
            <p className="text-[24px] text-foreground">
              {Math.round(avgCPA)} RUB
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-[13px] mb-2">
              <PieChartIcon className="w-4 h-4" />
              Кампаний
            </div>
            <p className="text-[24px] text-foreground">
              {project.campaigns.length}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-foreground mb-4">
              Распределение бюджета по каналам
            </h3>
            <div suppressHydrationWarning>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={budgetByChannel}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    paddingAngle={3}
                    isAnimationActive={false}
                  >
                    {budgetByChannel.map((entry, idx) => (
                      <Cell key={entry.id} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => `${formatNum(val)} RUB`}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {budgetByChannel.map((item, i) => (
                <span
                  key={item.name}
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  {item.name}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-foreground mb-4">ROI по кампаниям</h3>
            <div suppressHydrationWarning>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={roiByChannel} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                  />
                  <XAxis
                    type="number"
                    tick={{
                      fontSize: 12,
                      fill: "var(--muted-foreground)",
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{
                      fontSize: 11,
                      fill: "var(--muted-foreground)",
                    }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <Bar
                    key="bar-roi"
                    dataKey="roi"
                    name="ROI %"
                    fill="var(--chart-2)"
                    radius={[0, 4, 4, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {["all", "active", "paused", "planned", "completed"].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                    filterStatus === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status === "all"
                    ? "Все"
                    : statusConfig[status]?.label || status}
                </button>
              )
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPriorityMode(!priorityMode);
                if (!priorityMode) setSortBy("priority");
                else setSortBy("budget");
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                priorityMode
                  ? "bg-emerald-700 text-white"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              {priorityMode ? "Приоритизация ON" : "Приоритизация"}
            </button>
            {!priorityMode && (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <ArrowUpDown className="w-4 h-4" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-muted rounded-lg px-2 py-1.5 text-foreground border-0 text-[13px]"
                >
                  <option value="budget">По бюджету</option>
                  <option value="roi">По ROI</option>
                  <option value="name">По имени</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Priority mode hint */}
        {priorityMode && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/5 border border-emerald-600/15 rounded-lg text-[13px] text-emerald-700 dark:text-emerald-400">
            <Info className="w-4 h-4 shrink-0" />
            Режим приоритизации: перетаскивайте строки за иконку ≡ чтобы
            изменить приоритет кампаний. Номер слева показывает текущий приоритет.
          </div>
        )}

        {/* Campaigns Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-border">
                  {priorityMode && (
                    <th className="py-3 px-2 text-muted-foreground text-[12px] w-12">
                      #
                    </th>
                  )}
                  <th className="text-left py-3 px-4 text-muted-foreground text-[12px]">
                    Кампания
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground text-[12px]">
                    Канал
                  </th>
                  <th className="text-left py-3 px-4 text-muted-foreground text-[12px]">
                    Статус
                  </th>
                  <th className="text-right py-3 px-4 text-muted-foreground text-[12px]">
                    Бюджет
                  </th>
                  <th className="text-right py-3 px-4 text-muted-foreground text-[12px]">
                    Потрачено
                  </th>
                  <th className="text-right py-3 px-4 text-muted-foreground text-[12px]">
                    Конверсии
                  </th>
                  <th className="text-right py-3 px-4 text-muted-foreground text-[12px]">
                    CPA
                  </th>
                  <th className="text-right py-3 px-4 text-muted-foreground text-[12px]">
                    ROI
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c, i) => (
                  <DraggableCampaignRow
                    key={c.id}
                    campaign={c}
                    index={i}
                    moveRow={moveRow}
                    formatNum={formatNum}
                    priorityMode={priorityMode}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Auto Budget Calculator */}
        <AutoBudgetCalculator
          campaigns={project.campaigns}
          totalBudget={project.totalBudget}
        />
      </div>
    </DndProvider>
  );
}

function AutoBudgetCalculator({
  campaigns,
  totalBudget,
}: {
  campaigns: Campaign[];
  totalBudget: number;
}) {
  const [targetConversions, setTargetConversions] = useState(15000);
  const [targetCPA, setTargetCPA] = useState(100);

  const activeCampaigns = campaigns.filter(
    (c) => c.status === "active" && c.roi > 0
  );
  const totalROI = activeCampaigns.reduce((s, c) => s + c.roi, 0);

  const recommendations = activeCampaigns.map((c) => {
    const roiShare = c.roi / (totalROI || 1);
    const recommendedBudget = Math.round(
      targetConversions * targetCPA * roiShare
    );
    return {
      name: c.name,
      channel: c.channel,
      currentBudget: c.budget,
      recommendedBudget,
      expectedConversions: Math.round(
        (recommendedBudget / (c.cpa || 100)) * 1
      ),
      roi: c.roi,
    };
  });

  const totalRecommended = recommendations.reduce(
    (s, r) => s + r.recommendedBudget,
    0
  );

  const formatNum = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}M`
      : n >= 1000
      ? `${Math.round(n / 1000)}K`
      : n.toString();

  return (
    <div className="bg-gradient-to-r from-emerald-600/5 to-teal-600/5 border border-emerald-600/20 rounded-xl p-6">
      <h3 className="text-foreground mb-1 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-emerald-700" />
        Автоматический расчёт бюджета
      </h3>
      <p className="text-muted-foreground text-[13px] mb-5">
        Укажите целевые показатели, и система рассчитает оптимальное
        распределение бюджета
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-[13px] text-muted-foreground block mb-1.5">
            Целевые конверсии
          </label>
          <input
            type="number"
            value={targetConversions}
            onChange={(e) => setTargetConversions(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground"
          />
        </div>
        <div>
          <label className="text-[13px] text-muted-foreground block mb-1.5">
            Целевой CPA (RUB)
          </label>
          <input
            type="number"
            value={targetCPA}
            onChange={(e) => setTargetCPA(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-foreground"
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-4 text-muted-foreground text-[12px]">
                Кампания
              </th>
              <th className="text-right py-2.5 px-4 text-muted-foreground text-[12px]">
                Текущий
              </th>
              <th className="text-right py-2.5 px-4 text-muted-foreground text-[12px]">
                Рекомендация
              </th>
              <th className="text-right py-2.5 px-4 text-muted-foreground text-[12px]">
                Разница
              </th>
              <th className="text-right py-2.5 px-4 text-muted-foreground text-[12px]">
                Конверсии (прогноз)
              </th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((r) => {
              const diff = r.recommendedBudget - r.currentBudget;
              return (
                <tr
                  key={r.name}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-2.5 px-4 text-foreground">{r.name}</td>
                  <td className="py-2.5 px-4 text-right text-muted-foreground">
                    {formatNum(r.currentBudget)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-foreground">
                    {formatNum(r.recommendedBudget)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right ${
                      diff >= 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {diff >= 0 ? "+" : ""}
                    {formatNum(diff)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-foreground">
                    {r.expectedConversions.toLocaleString("ru-RU")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-accent/30">
              <td className="py-2.5 px-4 text-foreground">Итого</td>
              <td className="py-2.5 px-4 text-right text-muted-foreground">
                {formatNum(
                  recommendations.reduce((s, r) => s + r.currentBudget, 0)
                )}
              </td>
              <td className="py-2.5 px-4 text-right text-foreground">
                {formatNum(totalRecommended)}
              </td>
              <td className="py-2.5 px-4" />
              <td className="py-2.5 px-4 text-right text-foreground">
                {recommendations
                  .reduce((s, r) => s + r.expectedConversions, 0)
                  .toLocaleString("ru-RU")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}