import { useParams, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  BarChart3,
  Megaphone,
  Users,
  FileText,
  Info,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  Loader2,
  Link2,
  FlaskConical,
  Lightbulb,
  Swords,
  Calculator,
  Palette,
  Trash2,
  ExternalLink,
  Filter,
} from "lucide-react";
import { type Project } from "../data/mock-data";
import { getData } from "../lib/api";
import { MetricsTab } from "./MetricsTab";
import { CampaignsTab } from "./CampaignsTab";
import { AudienceTab } from "./AudienceTab";
import { ReportsTab } from "./ReportsTab";
import { getProjectAttachments, removeAttachmentFromProject, type ProjectAttachment, type AttachmentType } from "./AddToProjectModal";
import { toast } from "sonner";

const PROJECTS_KEY = "projects:list";

const tabs = [
  { id: "summary", label: "Саммари", icon: Info },
  { id: "metrics", label: "Метрики", icon: BarChart3 },
  { id: "campaigns", label: "Кампании", icon: Megaphone },
  { id: "audience", label: "Аудитория", icon: Users },
  { id: "reports", label: "Отчёты", icon: FileText },
  { id: "linked", label: "Привязанные", icon: Link2 },
];

export function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("summary");
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);

  useEffect(() => {
    getData<Project[]>(PROJECTS_KEY).then((d) => {
      const list = (d && Array.isArray(d) && d.length > 0) ? d : [];
      const found = list.find((p) => p.id === id) || null;
      setProject(found);
    }).catch(() => {
      setProject(null);
    });
  }, [id]);

  useEffect(() => {
    if (project) {
      getProjectAttachments(project.id).then(setAttachments);
    }
  }, [project]);

  if (project === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 md:p-6 flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground mb-4">Проект не найден</p>
        <button
          onClick={() => navigate("/")}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg"
        >
          Вернуться
        </button>
      </div>
    );
  }

  const budgetPercent = Math.round(
    project.totalBudget > 0 ? (project.spentBudget / project.totalBudget) * 100 : 0
  );

  const formatNum = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}M`
      : n >= 1000
      ? `${(n / 1000).toFixed(0)}K`
      : n.toString();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 md:px-5 py-3">
        <div className="max-w-[1440px] mx-auto">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-[13px] mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-foreground truncate">{project.name}</h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[12px] shrink-0 ${
                    project.status === "active"
                      ? "bg-green-500/10 text-green-600"
                      : project.status === "paused"
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {project.status === "active"
                    ? "Активный"
                    : project.status === "paused"
                    ? "На паузе"
                    : "Завершён"}
                </span>
              </div>
              <p className="text-muted-foreground text-[13px] mt-0.5 line-clamp-1">
                {project.description}
              </p>
            </div>

            {/* Stats - desktop only */}
            <div className="hidden md:flex items-center gap-6 text-[13px] shrink-0">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(project.startDate).toLocaleDateString("ru-RU", {
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  -{" "}
                  {new Date(project.endDate).toLocaleDateString("ru-RU", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                <span>
                  {formatNum(project.spentBudget)} / {formatNum(project.totalBudget)} RUB
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 mt-3 -mb-3 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-colors whitespace-nowrap text-[13px] ${
                  activeTab === tab.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.slice(0, 6)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1440px] mx-auto p-4 md:p-5">
          {activeTab === "summary" && <SummaryContent project={project} />}
          {activeTab === "metrics" && <MetricsTab project={project} />}
          {activeTab === "campaigns" && <CampaignsTab project={project} />}
          {activeTab === "audience" && <AudienceTab project={project} />}
          {activeTab === "reports" && <ReportsTab project={project} />}
          {activeTab === "linked" && <LinkedContent project={project} attachments={attachments} />}
        </div>
      </div>
    </div>
  );
}

function SummaryContent({ project }: { project: Project }) {
  const formatNum = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}M`
      : n >= 1000
      ? `${Math.round(n / 1000)}K`
      : n.toString();

  const budgetPercent = Math.round(
    project.totalBudget > 0 ? (project.spentBudget / project.totalBudget) * 100 : 0
  );

  const totalImpressions = project.campaigns.reduce(
    (s, c) => s + c.impressions,
    0
  );
  const totalConversions = project.campaigns.reduce(
    (s, c) => s + c.conversions,
    0
  );
  const avgROI =
    project.campaigns.filter((c) => c.roi > 0).reduce((s, c) => s + c.roi, 0) /
    (project.campaigns.filter((c) => c.roi > 0).length || 1);

  return (
    <div className="space-y-6">
      {/* KPI Summary Card */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl p-4 md:p-6">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="text-foreground mb-2">KPI Саммари</h3>
            <p className="text-foreground/80 text-[15px] leading-relaxed">
              {project.kpiSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted-foreground text-[13px]">Бюджет использован</p>
          <p className="text-[24px] text-foreground mt-1">{budgetPercent}%</p>
          <div className="h-1.5 bg-muted rounded-full mt-2">
            <div
              className={`h-full rounded-full ${
                budgetPercent > 80 ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted-foreground text-[13px]">Общий охват</p>
          <p className="text-[24px] text-foreground mt-1">{formatNum(totalImpressions)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted-foreground text-[13px]">Конверсии</p>
          <p className="text-[24px] text-foreground mt-1">{formatNum(totalConversions)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-muted-foreground text-[13px]">Средний ROI</p>
          <p className="text-[24px] text-foreground mt-1">{Math.round(avgROI)}%</p>
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <h3 className="text-foreground mb-5">Воронка</h3>
        <div className="space-y-3">
          {project.funnel.map((stage, i) => {
            const maxVal = project.funnel[0].value || 1;
            const width = maxVal > 0 ? Math.max((stage.value / maxVal) * 100, 8) : 8;
            return (
              <div key={stage.name} className="flex items-center gap-4">
                <span className="text-[13px] text-muted-foreground w-28 shrink-0 text-right">
                  {stage.name}
                </span>
                <div className="flex-1 relative">
                  <div
                    className="h-10 rounded-lg flex items-center px-4 transition-all"
                    style={{
                      width: `${width}%`,
                      background: `linear-gradient(90deg, var(--primary) 0%, var(--chart-${
                        (i % 5) + 1
                      }) 100%)`,
                      opacity: 1 - i * 0.12,
                    }}
                  >
                    <span className="text-white text-[13px] whitespace-nowrap">
                      {formatNum(stage.value)}
                    </span>
                  </div>
                </div>
                {i > 0 && (
                  <span className="text-[12px] text-muted-foreground w-16 shrink-0">
                    {stage.conversion}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <h3 className="text-foreground mb-4">Последняя активность</h3>
        <div className="space-y-3">
          {[
            { text: "Кампания «Яндекс Директ» обновлена", time: "2 часа назад", icon: Megaphone },
            { text: "Добавлен новый сегмент аудитории", time: "5 часов назад", icon: Users },
            { text: "Метрика CAC обновлена: 1200 RUB", time: "вчера", icon: BarChart3 },
            { text: "Отчёт за февраль сгенерирован", time: "2 дня назад", icon: FileText },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2 border-b border-border last:border-0"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-[14px] text-foreground flex-1">{item.text}</span>
              <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LinkedContent({ project, attachments }: { project: Project; attachments: ProjectAttachment[] }) {
  const [items, setItems] = useState(attachments);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  useEffect(() => { setItems(attachments); }, [attachments]);
  const navigate = useNavigate();

  const TYPE_ICONS: Record<string, typeof Link2> = {
    ab_test: FlaskConical, smm_post: FileText, content_idea: Lightbulb,
    competitor: Swords, unit_model: Calculator, influencer: Users, media_asset: Palette,
  };
  const TYPE_LABELS: Record<string, string> = {
    ab_test: "A/B Тест", smm_post: "SMM Пост", content_idea: "Идея контента",
    competitor: "Конкурент", unit_model: "Unit-модель", influencer: "Инфлюенсер", media_asset: "Бренд-ассет",
  };
  const TYPE_COLORS: Record<string, string> = {
    ab_test: "bg-teal-600/10 text-teal-700", smm_post: "bg-teal-500/10 text-teal-600",
    content_idea: "bg-amber-500/10 text-amber-600", competitor: "bg-red-500/10 text-red-600",
    unit_model: "bg-emerald-500/10 text-emerald-600", influencer: "bg-amber-500/10 text-amber-700",
    media_asset: "bg-teal-500/10 text-teal-600",
  };
  const TYPE_ROUTES: Record<string, string> = {
    ab_test: "/ab-tests", smm_post: "/smm/plan", content_idea: "/smm/ideas",
    competitor: "/competitors", unit_model: "/unit-economics", influencer: "/influencers", media_asset: "/media",
  };

  const handleRemove = async (a: ProjectAttachment) => {
    const ok = await removeAttachmentFromProject(project.id, a.type, a.itemId);
    if (ok) { setItems(prev => prev.filter(x => !(x.type === a.type && x.itemId === a.itemId))); toast.success("Убрано из проекта"); }
  };

  // Unique types present
  const presentTypes = [...new Set(items.map(a => a.type))];
  const filtered = typeFilter === "all" ? items : items.filter(a => a.type === typeFilter);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-[14px]">Нет привязанных элементов</p>
        <p className="text-[12px] mt-1">Используйте кнопку «В проект» в любом модуле</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-foreground text-[15px] font-semibold">Привязанные элементы ({items.length})</h3>
        {presentTypes.length > 1 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
            <button
              onClick={() => setTypeFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${typeFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}
            >
              Все ({items.length})
            </button>
            {presentTypes.map(t => {
              const count = items.filter(a => a.type === t).length;
              const Icon = TYPE_ICONS[t] || Link2;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${typeFilter === t ? TYPE_COLORS[t] + " border" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}
                >
                  <Icon className="w-3 h-3" /> {TYPE_LABELS[t] || t} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="space-y-2">
        {filtered.map((a, idx) => {
          const Icon = TYPE_ICONS[a.type] || Link2;
          const route = TYPE_ROUTES[a.type];
          return (
            <div key={`${a.type}-${a.itemId}-${idx}`} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/20 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLORS[a.type] || "bg-muted"}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground font-medium truncate">{a.title}</p>
                <p className="text-[11px] text-muted-foreground">{TYPE_LABELS[a.type] || a.type} · {new Date(a.addedAt).toLocaleDateString("ru-RU")}</p>
              </div>
              {route && (
                <button
                  onClick={() => navigate(route)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted rounded-md transition-colors shrink-0"
                  title={`Перейти в ${TYPE_LABELS[a.type]}`}
                >
                  <ExternalLink className="w-3 h-3" /> Открыть
                </button>
              )}
              <button onClick={() => handleRemove(a)} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors shrink-0" title="Убрать из проекта">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}