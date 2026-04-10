import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Instagram, MessageCircle, Globe, Video, Mail, Plus, Edit3, Trash2, Check, X,
  ChevronLeft, ChevronRight, GripVertical, Loader2, Sparkles, Eye, FileText,
  BarChart3, LayoutDashboard, PieChart, Target, Users, Heart, Zap,
  Share2, TrendingUp, Calendar, CalendarRange, Download, Search, ArrowRight, Filter,
  PanelRightClose, PanelRightOpen, Lightbulb, Calculator, MousePointerClick,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { showMascotReaction, checkMilestone } from "../lib/mascot-reactions";
import { triggerMilestoneCheck } from "./MascotGames";
import { useUsage } from "../lib/useUsage";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { saveData, getData, aiGenerate, checkServerUsage } from "../lib/api";
import { useModal } from "../hooks/useModal";
import { exportToCSV } from "../lib/export-utils";
import { AddToProjectButton } from "./AddToProjectModal";
import { Mascot } from "./Mascot";
import { ModalOverlay } from "./ModalOverlay";

const PLATFORMS = ["Instagram", "Telegram", "VK", "YouTube", "TikTok", "Email", "Сайт"] as const;
const POST_TYPES = ["Пост", "Reels/Shorts", "Stories", "Карусель", "Статья", "Рассылка", "Видео"] as const;
const STATUSES = ["planned", "in_progress", "published", "cancelled"] as const;

const STATUS_LABELS: Record<string, string> = { planned: "Запланирован", in_progress: "В работе", published: "Опубликован", cancelled: "Отменён" };
const STATUS_COLORS: Record<string, string> = { planned: "bg-muted text-muted-foreground", in_progress: "bg-amber-500/10 text-amber-600", published: "bg-emerald-500/10 text-emerald-600", cancelled: "bg-red-500/10 text-red-500" };

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Telegram: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  VK: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  YouTube: "bg-red-500/10 text-red-600 border-red-500/20",
  TikTok: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  Email: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "Сайт": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

const PLATFORM_ICONS: Record<string, any> = { Instagram, Telegram: MessageCircle, VK: Globe, YouTube: Video, TikTok: Video, Email: Mail, "Сайт": Globe };

interface ContentPost {
  id: string;
  date: string;
  platforms: string[];
  type: string;
  topic: string;
  caption: string;
  status: (typeof STATUSES)[number];
  goals: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  saves: number;
  followers_gained: number;
}

interface ContentIdea {
  id: string; title: string; description: string; category: string;
  links: string[]; tags: string[]; starred: boolean; status: string; createdAt: string;
}

interface PeriodMetrics {
  targetReach: number; targetEngagement: number; targetFollowers: number; targetClicks: number; targetPosts: number;
  perPlatform: Record<string, { targetReach: number; targetPosts: number; targetEngagement: number }>;
}

const IDEA_DND_TYPE = "CONTENT_IDEA";

const createEmptyPost = (date: string): ContentPost => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  date, platforms: ["Instagram"], type: "Пост", topic: "", caption: "",
  status: "planned", goals: "", reach: 0, impressions: 0, likes: 0,
  comments: 0, shares: 0, clicks: 0, saves: 0, followers_gained: 0,
});

const createPostFromIdea = (idea: ContentIdea, date: string): ContentPost => ({
  ...createEmptyPost(date),
  topic: idea.title, caption: idea.description,
  type: idea.category === "Reels" ? "Reels/Shorts" : idea.category === "Stories" ? "Stories" : idea.category === "Видео" ? "Видео" : idea.category === "Статья" ? "Статья" : idea.category === "Email" ? "Рассылка" : "Пост",
  goals: idea.tags.join(", "),
});

const STORAGE_KEY = "smm_plan:posts"; // aligned with MarketingCalendar
const METRICS_KEY = "smm:period_metrics";
const IDEAS_KEY = "smm:content_ideas";

const fmtNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

const defaultPerPlatform = () => {
  const pp: Record<string, { targetReach: number; targetPosts: number; targetEngagement: number }> = {};
  PLATFORMS.forEach((p) => { pp[p] = { targetReach: 10000, targetPosts: 5, targetEngagement: 4 }; });
  return pp;
};

export function SmmPlan() {
  const { canUse, increment, decrement, syncCounter } = useUsage();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [periodMetrics, setPeriodMetrics] = useState<PeriodMetrics>({
    targetReach: 50000, targetEngagement: 5, targetFollowers: 500, targetClicks: 1000, targetPosts: 20,
    perPlatform: defaultPerPlatform(),
  });
  const [editingPost, setEditingPost] = useState<ContentPost | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });
  const [editingMetrics, setEditingMetrics] = useState(false);
  const [view, setView] = useState<"table" | "calendar" | "dashboard">("table");
  const [showIdeasPanel, setShowIdeasPanel] = useState(false);
  const [metricsCalculated, setMetricsCalculated] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  useEffect(() => {
    getData<ContentPost[]>(STORAGE_KEY).then((d) => {
      if (d && Array.isArray(d)) {
        // Migration: old posts with `platform` string → `platforms` array
        let needsSave = false;
        const migrated = d.map((p: any) => {
          if (typeof p.platform === "string" && !p.platforms) {
            needsSave = true;
            return { ...p, platforms: [p.platform] };
          }
          if (!p.platforms) {
            needsSave = true;
            return { ...p, platforms: ["Instagram"] };
          }
          return p;
        });
        setPosts(migrated);
        if (needsSave) saveData(STORAGE_KEY, migrated);
      }
    });
    getData<PeriodMetrics>(METRICS_KEY).then((d) => {
      if (d) setPeriodMetrics({ ...d, perPlatform: d.perPlatform || defaultPerPlatform() });
    });
    getData<ContentIdea[]>(IDEAS_KEY).then((d) => { if (d && Array.isArray(d)) setIdeas(d); });
  }, []);

  const savePosts = useCallback((next: ContentPost[]) => { setPosts(next); saveData(STORAGE_KEY, next); }, []);
  const saveMetrics = useCallback((m: PeriodMetrics) => { setPeriodMetrics(m); saveData(METRICS_KEY, m); }, []);

  const [year, month] = currentMonth.split("-").map(Number);
  const monthLabel = new Date(year, month - 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const prevMonth = () => { const d = new Date(year, month - 2); setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); setMetricsCalculated(false); };
  const nextMonth = () => { const d = new Date(year, month); setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); setMetricsCalculated(false); };

  const monthPosts = useMemo(() => {
    let filtered = posts.filter((p) => p.date.startsWith(currentMonth));
    if (platformFilter !== "all") filtered = filtered.filter((p) => p.platforms.includes(platformFilter));
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }, [posts, currentMonth, platformFilter]);

  const allMonthPosts = useMemo(() => posts.filter((p) => p.date.startsWith(currentMonth)).sort((a, b) => a.date.localeCompare(b.date)), [posts, currentMonth]);

  // Per-platform calculated metrics
  const platformStats = useMemo(() => {
    const stats: Record<string, { posts: number; published: number; reach: number; likes: number; comments: number; shares: number; clicks: number; followers: number; impressions: number }> = {};
    PLATFORMS.forEach((p) => { stats[p] = { posts: 0, published: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0, followers: 0, impressions: 0 }; });
    allMonthPosts.forEach((post) => {
      post.platforms.forEach((plat) => {
        if (!stats[plat]) return;
        stats[plat].posts++;
        if (post.status === "published") {
          stats[plat].published++;
          stats[plat].reach += post.reach;
          stats[plat].likes += post.likes;
          stats[plat].comments += post.comments;
          stats[plat].shares += post.shares;
          stats[plat].clicks += post.clicks;
          stats[plat].followers += post.followers_gained;
          stats[plat].impressions += post.impressions;
        }
      });
    });
    return stats;
  }, [allMonthPosts]);

  const calcMetrics = useMemo(() => {
    const published = allMonthPosts.filter((p) => p.status === "published");
    const totalReach = published.reduce((s, p) => s + p.reach, 0);
    const totalImpressions = published.reduce((s, p) => s + p.impressions, 0);
    const totalLikes = published.reduce((s, p) => s + p.likes, 0);
    const totalComments = published.reduce((s, p) => s + p.comments, 0);
    const totalShares = published.reduce((s, p) => s + p.shares, 0);
    const totalClicks = published.reduce((s, p) => s + p.clicks, 0);
    const totalFollowers = published.reduce((s, p) => s + p.followers_gained, 0);
    const totalPosts = allMonthPosts.length;
    const publishedCount = published.length;
    const engagement = totalReach > 0 ? ((totalLikes + totalComments + totalShares) / totalReach) * 100 : 0;
    return { totalReach, totalImpressions, totalLikes, totalComments, totalShares, totalClicks, totalFollowers, totalPosts, publishedCount, engagement };
  }, [allMonthPosts]);

  const handleAddPost = async (post: ContentPost) => {
    if (!canUse("posts")) { showMascotReaction("error", "Лимит постов исчерпан! Обновите план 🦊"); toast.error("Лимит постов исчерпан. Обновите план."); return; }
    // Server-side validation (authoritative)
    try {
      const serverCheck = await checkServerUsage("posts");
      if (serverCheck && !serverCheck.allowed) {
        showMascotReaction("error", serverCheck.message || "Лимит постов исчерпан");
        toast.error(serverCheck.message || "Лимит постов исчерпан. Обновите план.");
        return;
      }
    } catch (err) {
      console.warn("[SmmPlan] Server usage check failed, proceeding with client:", err);
    }
    savePosts([...posts, post]); setShowAddModal(false); increment("posts");
    toast.success("Пост добавлен"); showMascotReaction("save", "Пост добавлен!"); const count = posts.length + 1; const m5 = checkMilestone("posts_5", count); const m25 = checkMilestone("posts_25", count); if (m5 || m25) triggerMilestoneCheck();
  };
  const handleUpdatePost = (updated: ContentPost) => { savePosts(posts.map((p) => (p.id === updated.id ? updated : p))); setEditingPost(null); toast.success("Пост обновлён"); showMascotReaction("save"); };
  const handleDeletePost = (id: string) => { savePosts(posts.filter((p) => p.id !== id)); decrement("posts"); toast.success("Пост удалён"); showMascotReaction("delete"); };
  const handleIdeaDrop = useCallback((idea: ContentIdea) => { const today = new Date(); const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`; const p = createPostFromIdea(idea, date); setEditingPost(p); setShowAddModal(true); toast.info(`Идея "${idea.title}" → новый пост`); }, []);
  const handleIdeaDropOnDate = useCallback((idea: ContentIdea, date: string) => { const p = createPostFromIdea(idea, date); setEditingPost(p); setShowAddModal(true); }, []);

  const handleCalculateMetrics = () => { setMetricsCalculated(true); setView("dashboard"); toast.success("Метрики рассчитаны", { description: `${calcMetrics.publishedCount} опубликованных постов проанализировано` }); };

  // Active platforms (those with at least 1 post this month)
  const activePlatforms = useMemo(() => PLATFORMS.filter((p) => platformStats[p].posts > 0), [platformStats]);

  const metricCard = (label: string, actual: number, target: number, icon: any, format?: (n: number) => string) => {
    const Icon = icon;
    const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
    const isGood = pct >= 80; const isWarn = pct >= 50 && pct < 80;
    const fmt = format || fmtNum;
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] text-muted-foreground flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {label}</span>
          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${isGood ? "bg-emerald-500/10 text-emerald-600" : isWarn ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-500"}`}>{pct}%</span>
        </div>
        <p className="text-[20px] text-foreground">{fmt(actual)}</p>
        <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${isGood ? "bg-emerald-500" : isWarn ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Цель: {fmt(target)}</p>
      </div>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="p-5 max-w-[1440px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-foreground flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center"><CalendarRange className="w-4.5 h-4.5 text-white" /></div>
              Контент-план
            </h1>
            <p className="text-muted-foreground text-[13px] mt-1">Планируйте, публикуйте и анализируйте контент по площадкам</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowIdeasPanel(!showIdeasPanel)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${showIdeasPanel ? "bg-amber-500/10 text-amber-700 border border-amber-500/20" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {showIdeasPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              <Lightbulb className="w-3.5 h-3.5" />
              Банк идей {ideas.length > 0 && <span className="bg-amber-500/20 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full">{ideas.length}</span>}
            </button>
            <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
              {(["table", "calendar", "dashboard"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  {v === "table" ? "Таблица" : v === "calendar" ? "Календарь" : "Дашборд"}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg text-[13px] hover:opacity-90" data-hotspot="smm-add-post"><Plus className="w-4 h-4" /> Добавить пост</button>
            <button
              onClick={() => {
                const headers = ["Дата", "Площадки", "Тип", "Тема", "Статус", "Охват", "Лайки", "Комменты", "Клики"];
                const rows = monthPosts.map(p => [p.date, p.platforms.join(", "), p.type, p.topic, STATUS_LABELS[p.status], p.reach, p.likes, p.comments, p.clicks]);
                exportToCSV(headers, rows, `content-plan-${currentMonth}`);
                toast.success("CSV экспортирован");
              }}
              className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-2 rounded-lg text-[13px] hover:text-foreground"
              title="Экспорт в CSV"
            >
              <FileText className="w-4 h-4" /> CSV
            </button>
          </div>
        </div>

        {/* Month nav + Platform filter */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
            <h2 className="text-foreground capitalize min-w-[180px] text-center">{monthLabel}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Platform filter chips */}
            <div className="flex items-center gap-1 flex-wrap">
              <button onClick={() => setPlatformFilter("all")} className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors border ${platformFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}>Все</button>
              {PLATFORMS.map((p) => {
                const count = platformStats[p]?.posts || 0;
                if (count === 0 && platformFilter !== p) return null;
                const PIcon = PLATFORM_ICONS[p];
                return (
                  <button key={p} onClick={() => setPlatformFilter(platformFilter === p ? "all" : p)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-colors border ${platformFilter === p ? PLATFORM_COLORS[p] + " border" : "bg-card text-muted-foreground border-border hover:text-foreground"}`}>
                    <PIcon className="w-3 h-3" /> {p} <span className="opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="h-5 w-px bg-border" />
            <button onClick={() => setEditingMetrics(!editingMetrics)} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
              <Target className="w-3.5 h-3.5" /> {editingMetrics ? "Закрыть" : "Цели"}
            </button>
            <button onClick={handleCalculateMetrics} className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[12px] hover:opacity-90 transition-opacity shadow-sm">
              <Calculator className="w-3.5 h-3.5" /> Посчитать метрики
            </button>
          </div>
        </div>

        {/* Goals editor */}
        {editingMetrics && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-foreground text-[14px] flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Общие цели н�� период</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[{ key: "targetReach", label: "Охват" }, { key: "targetEngagement", label: "ER %" }, { key: "targetFollowers", label: "Подписчики" }, { key: "targetClicks", label: "Клики" }, { key: "targetPosts", label: "Постов" }].map((f) => (
                <div key={f.key}><label className="text-[12px] text-muted-foreground block mb-1">{f.label}</label>
                  <input type="number" value={(periodMetrics as any)[f.key]} onChange={(e) => saveMetrics({ ...periodMetrics, [f.key]: Number(e.target.value) })} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" /></div>
              ))}
            </div>
            <h4 className="text-foreground text-[13px] mt-3 flex items-center gap-2"><PieChart className="w-3.5 h-3.5 text-primary" /> Цели по площадкам</h4>
            <div className="space-y-2">
              {PLATFORMS.map((p) => {
                const pp = periodMetrics.perPlatform?.[p] || { targetReach: 10000, targetPosts: 5, targetEngagement: 4 };
                const PIcon = PLATFORM_ICONS[p];
                return (
                  <div key={p} className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 w-28 text-[12px] ${PLATFORM_COLORS[p]} px-2 py-1 rounded-lg border`}><PIcon className="w-3 h-3" /> {p}</div>
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1"><input type="number" placeholder="Охват" value={pp.targetReach} onChange={(e) => { const next = { ...periodMetrics, perPlatform: { ...periodMetrics.perPlatform, [p]: { ...pp, targetReach: Number(e.target.value) } } }; saveMetrics(next); }} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px]" /></div>
                      <div className="w-20"><input type="number" placeholder="Постов" value={pp.targetPosts} onChange={(e) => { const next = { ...periodMetrics, perPlatform: { ...periodMetrics.perPlatform, [p]: { ...pp, targetPosts: Number(e.target.value) } } }; saveMetrics(next); }} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px]" /></div>
                      <div className="w-20"><input type="number" step="0.1" placeholder="ER%" value={pp.targetEngagement} onChange={(e) => { const next = { ...periodMetrics, perPlatform: { ...periodMetrics.perPlatform, [p]: { ...pp, targetEngagement: Number(e.target.value) } } }; saveMetrics(next); }} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px]" /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Overall Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {metricCard("Охват", calcMetrics.totalReach, periodMetrics.targetReach, Eye)}
          {metricCard("ER (по охвату)", calcMetrics.engagement, periodMetrics.targetEngagement, Heart, (n) => n.toFixed(1) + "%")}
          {metricCard("Подписчики", calcMetrics.totalFollowers, periodMetrics.targetFollowers, Users)}
          {metricCard("Клики", calcMetrics.totalClicks, periodMetrics.targetClicks, MousePointerClick)}
          {metricCard("Постов", calcMetrics.totalPosts, periodMetrics.targetPosts, FileText, (n) => String(n))}
        </div>

        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            {/* TABLE */}
            {view === "table" && <TableDropZone posts={monthPosts} onEdit={setEditingPost} onDelete={handleDeletePost} onIdeaDrop={handleIdeaDrop} onAddClick={() => setShowAddModal(true)} />}
            {/* CALENDAR */}
            {view === "calendar" && <CalendarView posts={monthPosts} year={year} month={month} onEdit={setEditingPost} onAdd={(date) => { const p = createEmptyPost(date); setEditingPost(p); setShowAddModal(true); }} onIdeaDrop={handleIdeaDropOnDate} />}
            {/* DASHBOARD */}
            {view === "dashboard" && (
              <DashboardView
                allPosts={allMonthPosts}
                platformStats={platformStats}
                calcMetrics={calcMetrics}
                periodMetrics={periodMetrics}
                activePlatforms={activePlatforms}
                metricsCalculated={metricsCalculated}
                onCalculate={handleCalculateMetrics}
              />
            )}
          </div>
          {/* Ideas Panel */}
          {showIdeasPanel && (
            <div className="w-[280px] shrink-0">
              <div className="bg-card border border-border rounded-xl sticky top-0">
                <div className="p-3 border-b border-border">
                  <h3 className="text-foreground text-[13px] font-medium flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Банк идей</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Перетащите идею в план</p>
                </div>
                <div className="p-2 max-h-[500px] overflow-y-auto space-y-1.5">
                  {ideas.filter((i) => i.status !== "used").length === 0
                    ? <p className="text-[12px] text-muted-foreground text-center py-6">Нет доступных идей.<br />Создайте в разделе «Идеи»</p>
                    : ideas.filter((i) => i.status !== "used").map((idea) => <DraggableIdea key={idea.id} idea={idea} />)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal */}
        {(showAddModal || editingPost) && (
          <PostModal
            post={editingPost || createEmptyPost(currentMonth + "-01")}
            isNew={showAddModal}
            onSave={(p) => {
              if (showAddModal) {
                // Always add as new post when showAddModal is true (includes idea drops and calendar clicks)
                handleAddPost(p);
                setEditingPost(null);
              } else {
                handleUpdatePost(p);
              }
            }}
            onClose={() => { setShowAddModal(false); setEditingPost(null); }}
          />
        )}
      </div>
    </DndProvider>
  );
}

// ==================== DASHBOARD VIEW ====================
function DashboardView({ allPosts, platformStats, calcMetrics, periodMetrics, activePlatforms, metricsCalculated, onCalculate }: {
  allPosts: ContentPost[];
  platformStats: Record<string, { posts: number; published: number; reach: number; likes: number; comments: number; shares: number; clicks: number; followers: number; impressions: number }>;
  calcMetrics: any;
  periodMetrics: PeriodMetrics;
  activePlatforms: string[];
  metricsCalculated: boolean;
  onCalculate: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Summary header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-foreground flex items-center gap-2"><LayoutDashboard className="w-5 h-5 text-primary" /> Общий план</h3>
          {!metricsCalculated && (
            <button onClick={onCalculate} className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-700 text-white px-4 py-2 rounded-lg text-[13px] hover:opacity-90 shadow-sm">
              <Calculator className="w-4 h-4" /> Посчитать метрики
            </button>
          )}
        </div>

        {/* Plan overview by status */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {(["planned", "in_progress", "published", "cancelled"] as const).map((s) => {
            const count = allPosts.filter((p) => p.status === s).length;
            return (
              <div key={s} className="p-3 bg-muted/20 rounded-lg">
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]}</span>
                <p className="text-[22px] text-foreground mt-1">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Platforms breakdown */}
        <h4 className="text-foreground text-[13px] mb-3 flex items-center gap-2"><PieChart className="w-4 h-4 text-primary" /> По площадкам</h4>
        {activePlatforms.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">Нет постов за этот период</p>
        ) : (
          <div className="space-y-2">
            {activePlatforms.map((plat) => {
              const s = platformStats[plat];
              const pp = periodMetrics.perPlatform?.[plat] || { targetReach: 10000, targetPosts: 5, targetEngagement: 4 };
              const er = s.reach > 0 ? ((s.likes + s.comments + s.shares) / s.reach * 100) : 0;
              const reachPct = pp.targetReach > 0 ? Math.round(s.reach / pp.targetReach * 100) : 0;
              const postsPct = pp.targetPosts > 0 ? Math.round(s.posts / pp.targetPosts * 100) : 0;
              const erPct = pp.targetEngagement > 0 ? Math.round(er / pp.targetEngagement * 100) : 0;
              const PIcon = PLATFORM_ICONS[plat];

              return (
                <div key={plat} className="bg-muted/10 border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`flex items-center gap-1.5 text-[12px] font-medium ${PLATFORM_COLORS[plat]} px-2 py-1 rounded-lg border`}><PIcon className="w-3 h-3" /> {plat}</div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground ml-auto">
                      <span>{s.posts} постов</span>
                      <span>{s.published} опубл.</span>
                    </div>
                  </div>
                  {metricsCalculated && s.published > 0 && (
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <MiniMetric label="Охват" value={fmtNum(s.reach)} pct={reachPct} />
                      <MiniMetric label="ER" value={er.toFixed(1) + "%"} pct={erPct} />
                      <MiniMetric label="Клики" value={fmtNum(s.clicks)} pct={periodMetrics.targetClicks > 0 ? Math.round(s.clicks / periodMetrics.targetClicks * 100 * activePlatforms.length) : 0} />
                    </div>
                  )}
                  {metricsCalculated && s.published === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">Нет опубликованных - метрики недоступны</p>
                  )}
                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                      <span>Постов: {s.posts} / {pp.targetPosts}</span>
                      <span>{postsPct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${postsPct >= 80 ? "bg-emerald-500" : postsPct >= 50 ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${Math.min(postsPct, 100)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Insights / Weak-Strong analysis */}
      {metricsCalculated && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-foreground mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Анализ: сильные и слабые места</h3>
          <div className="space-y-2">
            {activePlatforms.map((plat) => {
              const s = platformStats[plat];
              const pp = periodMetrics.perPlatform?.[plat] || { targetReach: 10000, targetPosts: 5, targetEngagement: 4 };
              const er = s.reach > 0 ? ((s.likes + s.comments + s.shares) / s.reach * 100) : 0;
              const issues: { type: "good" | "warn" | "bad"; text: string }[] = [];

              if (s.published === 0 && s.posts > 0) issues.push({ type: "warn", text: `${plat}: ни один пост не опубликован` });
              if (s.reach >= pp.targetReach * 0.8) issues.push({ type: "good", text: `${plat}: охват на уровне цели (${fmtNum(s.reach)} / ${fmtNum(pp.targetReach)})` });
              else if (s.published > 0) issues.push({ type: "bad", text: `${plat}: охват ниже цели (${fmtNum(s.reach)} / ${fmtNum(pp.targetReach)}) - пробуйте Reels, коллаборации` });
              if (er >= pp.targetEngagement * 0.8 && s.published > 0) issues.push({ type: "good", text: `${plat}: ER ${er.toFixed(1)}% - аудитория вовлечена` });
              else if (s.published > 0 && er < pp.targetEngagement * 0.5) issues.push({ type: "bad", text: `${plat}: ER ${er.toFixed(1)}% - добавьте опросы, интерактив, CTA` });
              else if (s.published > 0) issues.push({ type: "warn", text: `${plat}: ER ${er.toFixed(1)}% - есть потенциал для роста` });
              if (s.posts < pp.targetPosts * 0.5 && pp.targetPosts > 0) issues.push({ type: "bad", text: `${plat}: мало контента (${s.posts} / ${pp.targetPosts} постов)` });

              return issues.map((issue, i) => (
                <div key={`${plat}-${i}`} className={`flex items-start gap-2 p-3 rounded-lg ${issue.type === "good" ? "bg-emerald-500/5 border border-emerald-500/15" : issue.type === "warn" ? "bg-amber-500/5 border border-amber-500/15" : "bg-red-500/5 border border-red-500/15"}`}>
                  {issue.type === "good" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${issue.type === "warn" ? "text-amber-500" : "text-red-500"}`} />}
                  <span className="text-[13px] text-foreground">{issue.text}</span>
                </div>
              ));
            })}
            {/* Global insights */}
            {calcMetrics.totalPosts >= periodMetrics.targetPosts ? (
              <div className="flex items-start gap-2 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span className="text-[13px] text-foreground">План по количеству постов выполнен ({calcMetrics.totalPosts} / {periodMetrics.targetPosts})</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-[13px] text-foreground">Недостаточно постов: {calcMetrics.totalPosts} / {periodMetrics.targetPosts}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full plan table */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-foreground mb-3 flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Полный план ({allPosts.length} постов)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-2 px-3">Дата</th><th className="text-left py-2 px-3">Площадки</th><th className="text-left py-2 px-3">Тип</th>
              <th className="text-left py-2 px-3">Тема</th><th className="text-left py-2 px-3">Статус</th>
              <th className="text-right py-2 px-3">Охват</th><th className="text-right py-2 px-3">ER</th>
            </tr></thead>
            <tbody>
              {allPosts.map((p) => {
                const er = p.reach > 0 ? ((p.likes + p.comments + p.shares) / p.reach * 100).toFixed(1) : null;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2 px-3 whitespace-nowrap text-foreground">{new Date(p.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1 flex-wrap">{p.platforms.map((pl) => <span key={pl} className={`px-1.5 py-0.5 rounded text-[10px] border ${PLATFORM_COLORS[pl]}`}>{pl}</span>)}</div>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{p.type}</td>
                    <td className="py-2 px-3 text-foreground truncate max-w-[200px]">{p.topic || "-"}</td>
                    <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded-full text-[10px] ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span></td>
                    <td className="py-2 px-3 text-right text-foreground">{p.reach > 0 ? fmtNum(p.reach) : "-"}</td>
                    <td className="py-2 px-3 text-right">{er ? <span className={Number(er) >= 5 ? "text-emerald-600" : Number(er) >= 2 ? "text-amber-600" : "text-red-500"}>{er}%</span> : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, pct }: { label: string; value: string; pct: number }) {
  const isGood = pct >= 80; const isWarn = pct >= 50 && pct < 80;
  return (
    <div>
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5"><span>{label}</span><span className={isGood ? "text-emerald-600" : isWarn ? "text-amber-600" : "text-red-500"}>{pct}%</span></div>
      <p className="text-[14px] text-foreground">{value}</p>
      <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden"><div className={`h-full rounded-full ${isGood ? "bg-emerald-500" : isWarn ? "bg-amber-500" : "bg-red-400"}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
    </div>
  );
}

// ==================== DRAGGABLE IDEA ====================
function DraggableIdea({ idea }: { idea: ContentIdea }) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag({ type: IDEA_DND_TYPE, item: { idea }, collect: (m) => ({ isDragging: m.isDragging() }) });
  drag(ref);
  return (
    <div ref={ref} className={`p-2.5 rounded-lg border border-border bg-card cursor-grab active:cursor-grabbing transition-all ${isDragging ? "opacity-30 scale-95" : "hover:border-amber-500/30 hover:bg-amber-500/5"}`}>
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-foreground font-medium truncate">{idea.title}</p>
          {idea.description && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{idea.description}</p>}
          <div className="flex items-center gap-1.5 mt-1"><span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{idea.category}</span>{idea.starred && <span className="text-[10px] text-amber-500">★</span>}</div>
        </div>
      </div>
    </div>
  );
}

// ==================== TABLE DROP ZONE ====================
function TableDropZone({ posts, onEdit, onDelete, onIdeaDrop, onAddClick }: { posts: ContentPost[]; onEdit: (p: ContentPost) => void; onDelete: (id: string) => void; onIdeaDrop: (idea: ContentIdea) => void; onAddClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isOver, canDrop }, drop] = useDrop({ accept: IDEA_DND_TYPE, drop: (item: { idea: ContentIdea }) => onIdeaDrop(item.idea), collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }) });
  drop(ref);
  return (
    <div ref={ref} className={`bg-card border rounded-xl overflow-hidden transition-colors ${isOver && canDrop ? "border-amber-500/50 bg-amber-500/5" : "border-border"}`}>
      {isOver && canDrop && <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-700 text-[12px] border-b border-amber-500/20"><Lightbulb className="w-4 h-4" /> Отпустите, чтобы создать пост из идеи</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-border text-muted-foreground text-[12px]">
            <th className="text-left py-3 px-4">Дата</th><th className="text-left py-3 px-4">Площадки</th><th className="text-left py-3 px-4">Тип</th>
            <th className="text-left py-3 px-4 min-w-[200px]">Тема</th><th className="text-left py-3 px-4">Статус</th>
            <th className="text-right py-3 px-4">Охват</th><th className="text-right py-3 px-4">ER</th><th className="text-right py-3 px-4">Клики</th>
            <th className="text-center py-3 px-4 w-20"></th>
          </tr></thead>
          <tbody>
            {posts.length === 0 && <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="bg-muted rounded-2xl px-4 py-2.5 mb-1 relative inline-block">
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="absolute -bottom-[9px] left-1/2 -translate-x-1/2">
                      <path d="M7 10 L0 0 L14 0 Z" fill="var(--muted)" />
                    </svg>
                    <p className="text-[12px] text-foreground">Контент-план пуст — давай его заполним!</p>
                  </div>
                </div>
                <Mascot emotion="wave" size={64} />
                <p className="text-[13px] mt-1"><button onClick={onAddClick} className="text-primary hover:underline font-medium">Добавить пост</button> или перетащите идею из банка</p>
              </div>
            </td></tr>}
            {posts.map((post) => {
              const er = post.reach > 0 ? (((post.likes + post.comments + post.shares) / post.reach) * 100).toFixed(1) : "-";
              return (
                <tr key={post.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 text-foreground whitespace-nowrap">{new Date(post.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 flex-wrap">{post.platforms.map((p) => <span key={p} className={`px-1.5 py-0.5 rounded text-[10px] border ${PLATFORM_COLORS[p]}`}>{p}</span>)}</div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{post.type}</td>
                  <td className="py-3 px-4"><div className="text-foreground truncate max-w-[250px]">{post.topic || "-"}</div>{post.goals && <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><Target className="w-3 h-3" />{post.goals}</div>}</td>
                  <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-[11px] ${STATUS_COLORS[post.status]}`}>{STATUS_LABELS[post.status]}</span></td>
                  <td className="py-3 px-4 text-right text-foreground">{post.reach > 0 ? fmtNum(post.reach) : "-"}</td>
                  <td className="py-3 px-4 text-right">{er !== "-" ? <span className={Number(er) >= 5 ? "text-emerald-600" : Number(er) >= 2 ? "text-amber-600" : "text-red-500"}>{er}%</span> : <span className="text-muted-foreground">-</span>}</td>
                  <td className="py-3 px-4 text-right text-foreground">{post.clicks > 0 ? post.clicks : "-"}</td>
                  <td className="py-3 px-4"><div className="flex items-center gap-1 justify-center">
                    <AddToProjectButton itemType="smm_post" itemId={post.id} itemTitle={post.topic || post.type} />
                    <button onClick={() => onEdit(post)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onDelete(post.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== CALENDAR ====================
function CalendarView({ posts, year, month, onEdit, onAdd, onIdeaDrop }: { posts: ContentPost[]; year: number; month: number; onEdit: (p: ContentPost) => void; onAdd: (date: string) => void; onIdeaDrop: (idea: ContentIdea, date: string) => void }) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="grid grid-cols-7 gap-1 mb-2">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => <div key={d} className="text-center text-[11px] text-muted-foreground font-medium py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((i) => <div key={`b-${i}`} />)}
        {days.map((day) => { const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const dayPosts = posts.filter((p) => p.date === dateStr); return <CalendarDayCell key={day} day={day} dateStr={dateStr} dayPosts={dayPosts} onEdit={onEdit} onAdd={onAdd} onIdeaDrop={onIdeaDrop} />; })}
      </div>
    </div>
  );
}

function CalendarDayCell({ day, dateStr, dayPosts, onEdit, onAdd, onIdeaDrop }: { day: number; dateStr: string; dayPosts: ContentPost[]; onEdit: (p: ContentPost) => void; onAdd: (date: string) => void; onIdeaDrop: (idea: ContentIdea, date: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const isToday = new Date().toISOString().slice(0, 10) === dateStr;
  const [{ isOver, canDrop }, drop] = useDrop({ accept: IDEA_DND_TYPE, drop: (item: { idea: ContentIdea }) => onIdeaDrop(item.idea, dateStr), collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }) });
  drop(ref);
  return (
    <div ref={ref} onClick={() => dayPosts.length > 0 ? onEdit(dayPosts[0]) : onAdd(dateStr)}
      className={`min-h-[80px] rounded-lg p-1.5 border cursor-pointer transition-all ${isOver && canDrop ? "border-amber-500/50 bg-amber-500/10" : isToday ? "border-primary/40 bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/20"}`}>
      <span className={`text-[12px] ${isToday ? "text-primary font-semibold" : "text-foreground"}`}>{day}</span>
      {isOver && canDrop && <div className="text-[9px] text-amber-600 mt-0.5">+ Бросить сюда</div>}
      <div className="mt-0.5 space-y-0.5">
        {dayPosts.slice(0, 3).map((p) => <div key={p.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${STATUS_COLORS[p.status]}`}>{p.platforms.join(", ")}: {p.topic || p.type}</div>)}
        {dayPosts.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayPosts.length - 3}</div>}
      </div>
    </div>
  );
}

// ==================== POST MODAL (multi-platform + AI) ====================
function PostModal({ post, isNew, onSave, onClose }: { post: ContentPost; isNew: boolean; onSave: (p: ContentPost) => void; onClose: () => void }) {
  const [form, setForm] = useState(post);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const togglePlatform = (p: string) => {
    const current = form.platforms;
    if (current.includes(p)) {
      if (current.length === 1) return; // at least 1
      set("platforms", current.filter((x) => x !== p));
    } else {
      set("platforms", [...current, p]);
    }
  };

  const handleAICaption = async () => {
    if (!form.topic.trim()) { toast.error("Сначала укажите тему поста"); return; }
    setAiLoading(true);
    setAiTip(null);
    try {
      const platNames = form.platforms.join(", ");
      const prompt = `Напиши текст для ${form.type} на платформы: ${platNames}.
Тема: ${form.topic}
${form.goals ? `Цель: ${form.goals}` : ""}
Требования:
- Подходящий формат для ${platNames}
- Включи релевантные хэштеги
- Добавь призыв к действию (CTA)
- Пиши на русском, стиль - вовлекающий, живой
- Если площадок несколько - адаптируй текст под основную (${form.platforms[0]})`;
      const res = await aiGenerate("copywriter", prompt);
      if (res) {
        set("caption", res.content);
        toast.success("Подпись сгенерирована");
        showMascotReaction("ai_generate", "Текст готов!");
        // Pick a random contextual tip from Марк
        const tips = [
          "Попробуй добавить вопрос в конце — это повысит ER!",
          "Первые 2 строки решают всё — зацепи читателя!",
          "Не забудь CTA — без него вовлечённость падает на 40%",
          "Хештеги лучше ставить в первом комментарии (для Instagram)",
          "Длинные посты работают лучше в Telegram, короткие — в Instagram",
        ];
        setAiTip(tips[Math.floor(Math.random() * tips.length)]);
      }
    } catch (err: any) {
      const isLimit = err?.name === "UsageLimitError";
      toast.error(isLimit ? "Лимит исчерпан" : "Ошибка генерации", { description: err.message });
    } finally { setAiLoading(false); }
  };

  return (
    <ModalOverlay onClose={onClose} label={isNew ? "Новый пост" : "Редактировать пост"}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-foreground">{isNew ? "Новый пост" : "Редактировать пост"}</h3>
          <button onClick={onClose} aria-label="Закрыть" className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Platforms multi-select */}
          <div>
            <label className="text-[12px] text-muted-foreground block mb-2">Площадки (выберите одну или несколько)</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const active = form.platforms.includes(p);
                const PIcon = PLATFORM_ICONS[p];
                return (
                  <button key={p} type="button" onClick={() => togglePlatform(p)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] border transition-all ${active ? PLATFORM_COLORS[p] + " border shadow-sm" : "bg-muted/30 text-muted-foreground border-border hover:border-foreground/20"}`}>
                    <PIcon className="w-3.5 h-3.5" />
                    {p}
                    {active && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[12px] text-muted-foreground block mb-1">Дата</label><input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" /></div>
            <div><label className="text-[12px] text-muted-foreground block mb-1">Тип контента</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]">{POST_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className="text-[12px] text-muted-foreground block mb-1">Статус</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]">{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></div>
          </div>

          <div><label className="text-[12px] text-muted-foreground block mb-1">Тема / Заголовок</label>
            <input type="text" value={form.topic} onChange={(e) => set("topic", e.target.value)} placeholder="О чём пост?" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" /></div>

          <div><label className="text-[12px] text-muted-foreground block mb-1">Цели поста</label>
            <input type="text" value={form.goals} onChange={(e) => set("goals", e.target.value)} placeholder="Увеличить охват, привести трафик на сайт..." className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" /></div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] text-muted-foreground">Текст / Подпись</label>
              <button onClick={handleAICaption} disabled={aiLoading || !form.topic.trim()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-gradient-to-r from-teal-600/10 to-emerald-600/10 text-teal-700 hover:from-teal-600/20 hover:to-emerald-600/20 disabled:opacity-50 border border-teal-600/15">
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {aiLoading ? "Генерирую..." : "AI подпись"}
              </button>
            </div>
            <textarea value={form.caption} onChange={(e) => set("caption", e.target.value)} rows={5} placeholder="Текст поста... Нажмите «AI подпись» для автогенерации"
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none" />
            {form.caption && <p className="text-[11px] text-muted-foreground mt-0.5">{form.caption.length} символов</p>}
            {aiTip && (
              <div className="flex items-start gap-2 mt-2 p-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                <Mascot emotion="celebrate" size={32} animate={false} />
                <div className="relative flex-1 min-w-0">
                  <div className="bg-muted rounded-xl rounded-tl-[4px] px-3 py-2 relative">
                    {/* Tail pointing to Марк */}
                    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="absolute -left-[7px] top-[6px]">
                      <path d="M8 0 C8 0, 0.5 2.5, 0 7 C1.5 4.5, 4 3, 8 12 Z" fill="var(--muted)" />
                    </svg>
                    <p className="text-[11px] text-foreground leading-snug">
                      <span className="text-[10px] font-bold text-[#d4a373]">Марк советует: </span>
                      {aiTip}
                    </p>
                  </div>
                </div>
                <button onClick={() => setAiTip(null)} className="p-0.5 text-muted-foreground hover:text-foreground shrink-0 mt-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {form.status === "published" && (
            <div>
              <p className="text-[12px] text-muted-foreground mb-2 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Метрики</p>
              <div className="grid grid-cols-4 gap-2">
                {[{ key: "reach", label: "Охват" }, { key: "impressions", label: "Показы" }, { key: "likes", label: "Лайки" }, { key: "comments", label: "Комменты" }, { key: "shares", label: "Репосты" }, { key: "clicks", label: "Клики" }, { key: "saves", label: "Сохранения" }, { key: "followers_gained", label: "Подписки" }].map((m) => (
                  <div key={m.key}><label className="text-[11px] text-muted-foreground">{m.label}</label>
                    <input type="number" value={(form as any)[m.key]} onChange={(e) => set(m.key, Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[13px]" /></div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">Отмена</button>
          <button onClick={() => onSave(form)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] hover:opacity-90"><Check className="w-4 h-4" /> {isNew ? "Добавить" : "Сохранить"}</button>
        </div>
      </div>
    </ModalOverlay>
  );
}