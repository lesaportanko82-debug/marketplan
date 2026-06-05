import { useState, useEffect, useCallback, startTransition } from "react";
import { useNavigate } from "react-router";
import {
  Plus, Search, Megaphone, Activity, Users, MoreVertical,
  Trash2, X, Check, Loader2, FolderKanban, Calendar, DollarSign,
  AlertTriangle, LayoutGrid, List, Zap, ArrowRight,
  Clock, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { type Project } from "../data/mock-data";
import { getData, saveData } from "../lib/api";
import { toast } from "sonner";
import { undoableDelete } from "../lib/undo";
import { useKV } from "../lib/useKV";
import { showMascotReaction, checkMilestone } from "../lib/mascot-reactions";
import { triggerMilestoneCheck } from "./MascotGames";
import { useModal } from "../hooks/useModal";
import { ModalOverlay } from "./ModalOverlay";
import { useUsage } from "../lib/useUsage";
import { checkServerUsage } from "../lib/api";
import { EmptyState } from "./EmptyState";

const PROJECTS_KEY = "projects:list";

const INDUSTRIES = [
  "E-commerce", "SaaS / B2B", "HoReCa", "Финтех", "Образование",
  "Медицина", "Недвижимость", "Ритейл", "Логистика", "Медиа", "Другое",
];

const STATUS_CONFIG = {
  active:    { label: "Активный",   color: "#22c55e", bg: "bg-emerald-500/10", text: "text-emerald-600", bar: "bg-emerald-500" },
  paused:    { label: "На паузе",   color: "#f59e0b", bg: "bg-amber-500/10",   text: "text-amber-600",   bar: "bg-amber-500" },
  completed: { label: "Завершён",   color: "#8a7d6e", bg: "bg-muted",           text: "text-muted-foreground", bar: "bg-muted-foreground" },
};

// Палитра для аватаров проектов
const AVATAR_GRADIENTS = [
  "from-[#1a7a6d] to-[#2eb8a4]",
  "from-[#d4a373] to-[#c08a40]",
  "from-[#0d7377] to-[#1a7a6d]",
  "from-[#2d6a4f] to-[#2eb8a4]",
  "from-[#c08a40] to-[#d4a373]",
  "from-[#0d7377] to-[#2d6a4f]",
];

const emptyProject = (): Project => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  name: "",
  description: "",
  status: "active",
  industry: "E-commerce",
  totalBudget: 500000,
  spentBudget: 0,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
  kpiSummary: "",
  metrics: [],
  campaigns: [],
  audiences: [],
  funnel: [
    { name: "Охват",      value: 0, conversion: 100 },
    { name: "Клики",      value: 0, conversion: 0 },
    { name: "Лиды",       value: 0, conversion: 0 },
    { name: "Конверсии",  value: 0, conversion: 0 },
  ],
});

function getAvatarGradient(id: string) {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "П";
}

export function ProjectsList() {
  const navigate = useNavigate();
  const { canUse, increment, decrement, syncCounter } = useUsage();
  const { data: projects, save } = useKV<Project[]>(PROJECTS_KEY, []);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "completed">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    try { return (localStorage.getItem("mp:projects:view") as "list" | "grid") ?? "list"; } catch { return "list"; }
  });

  // Load & sync usage
  useEffect(() => {
    getData<Project[]>(PROJECTS_KEY).then(d => {
      if (d && Array.isArray(d)) save(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) syncCounter("projects", projects.length);
  }, [projects.length, loading]);

  const toggleView = (v: "list" | "grid") => {
    setViewMode(v);
    localStorage.setItem("mp:projects:view", v);
  };

  const handleAddProject = async (project: Project) => {
    if (!canUse("projects")) {
      showMascotReaction("error", "Лимит проектов исчерпан! Обновите план 🦊");
      toast.error("Лимит проектов исчерпан. Обновите план.");
      return;
    }
    try {
      const serverCheck = await checkServerUsage("projects");
      if (serverCheck && !serverCheck.allowed) {
        showMascotReaction("error", serverCheck.message || "Лимит проектов исчерпан (серверная проверка)");
        toast.error(serverCheck.message || "Лимит проектов исчерпан. Обновите план.");
        return;
      }
    } catch (err) {
      console.warn("[ProjectsList] Server usage check failed, proceeding with client check:", err);
    }
    save([project, ...projects]);
    setShowAddModal(false);
    increment("projects");
    toast.success(`Проект «${project.name}» создан`);
    showMascotReaction("save", `Проект «${project.name}» создан!`);
    const m = checkMilestone("first_project", projects.length + 1);
    if (m) triggerMilestoneCheck();
  };

  const handleDeleteProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    const prevProjects = [...projects];
    setDeleteConfirm(null);
    setMenuOpen(null);
    undoableDelete({
      label: `Проект «${project?.name}» удалён`,
      itemKey: PROJECTS_KEY,
      previousData: prevProjects,
      deleteFn: async () => { await saveData(PROJECTS_KEY, projects.filter(p => p.id !== id)); },
      restoreFn: async (_key, data) => { await saveData(PROJECTS_KEY, data); },
      onOptimistic: () => save(projects.filter(p => p.id !== id)),
      onRevert: () => save(prevProjects),
    });
  };

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.industry.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatBudget = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
    return v.toString();
  };

  const statusCounts = {
    all: projects.length,
    active: projects.filter(p => p.status === "active").length,
    paused: projects.filter(p => p.status === "paused").length,
    completed: projects.filter(p => p.status === "completed").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[#2eb8a4] flex items-center justify-center shrink-0 shadow-sm">
              <FolderKanban className="w-[18px] h-[18px] text-white" />
            </div>
            Проекты
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1 ml-[52px]">
            {projects.length} проектов · {statusCounts.active} активных
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => toggleView("list")}
              className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleView("grid")}
              className={`p-2 rounded-md transition-colors ${viewMode === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-sm"
            style={{ background: "linear-gradient(135deg, #1a7a6d 0%, #2eb8a4 100%)" }}
            data-hotspot="projects-add"
          >
            <Plus className="w-4 h-4" />
            Новый проект
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Всего проектов", value: statusCounts.all, icon: FolderKanban, color: "text-primary", bg: "bg-primary/10" },
            { label: "Активных", value: statusCounts.active, icon: Zap, color: "text-emerald-600", bg: "bg-emerald-500/10" },
            { label: "На паузе", value: statusCounts.paused, icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10" },
            { label: "Завершённых", value: statusCounts.completed, icon: Check, color: "text-muted-foreground", bg: "bg-muted" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-[20px] font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Search & Filter ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по названию, отрасли..."
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {(["all", "active", "paused", "completed"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-[12px] font-medium transition-all whitespace-nowrap shrink-0 ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {s === "all" ? "Все" : s === "active" ? "Активные" : s === "paused" ? "На паузе" : "Завершённые"}
              {" "}<span className="opacity-60">{statusCounts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Projects ── */}
      {filtered.length === 0 && projects.length === 0 && (
        <EmptyState
          title="Нет ни одного проекта"
          description="Создайте первый маркетинговый проект - добавьте бюджет, KPI и кампании. Марк поможет разобраться!"
          emotion="wave"
          action={{ label: "Создать первый проект", onClick: () => setShowAddModal(true), icon: <Plus className="w-4 h-4" /> }}
        />
      )}
      {filtered.length === 0 && projects.length > 0 && (
        <EmptyState
          title="Проекты не найдены"
          description="Попробуйте изменить фильтр или поисковый запрос"
          emotion="think"
          compact
          action={{ label: "Сбросить фильтры", onClick: () => { setSearch(""); setStatusFilter("all"); } }}
        />
      )}

      <AnimatePresence mode="wait">
        {viewMode === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filtered.map((project, idx) => (
              <ProjectGridCard
                key={project.id}
                project={project}
                idx={idx}
                onOpen={() => startTransition(() => navigate(`/project/${project.id}`))}
                onDelete={() => setDeleteConfirm(project.id)}
                menuOpen={menuOpen === project.id}
                onMenuToggle={() => setMenuOpen(menuOpen === project.id ? null : project.id)}
                onMenuClose={() => setMenuOpen(null)}
                formatBudget={formatBudget}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {filtered.map((project, idx) => (
              <ProjectListCard
                key={project.id}
                project={project}
                idx={idx}
                onOpen={() => startTransition(() => navigate(`/project/${project.id}`))}
                onDelete={() => setDeleteConfirm(project.id)}
                menuOpen={menuOpen === project.id}
                onMenuToggle={() => setMenuOpen(menuOpen === project.id ? null : project.id)}
                onMenuClose={() => setMenuOpen(null)}
                formatBudget={formatBudget}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      {showAddModal && (
        <AddProjectModal onSave={handleAddProject} onClose={() => setShowAddModal(false)} />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <ModalOverlay onClose={() => setDeleteConfirm(null)} label="Удалить проект">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-foreground text-[16px] font-semibold">Удалить проект?</h3>
                <p className="text-muted-foreground text-[13px] mt-1">
                  «{projects.find(p => p.id === deleteConfirm)?.name}» будет удалён. Это действие можно отменить через уведомление.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors">
                Отмена
              </button>
              <button
                onClick={() => handleDeleteProject(deleteConfirm)}
                className="px-4 py-2 text-[13px] font-semibold bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* ═══ List card ═══ */
function ProjectListCard({ project, idx, onOpen, onDelete, menuOpen, onMenuToggle, onMenuClose, formatBudget }: {
  project: Project; idx: number;
  onOpen: () => void; onDelete: () => void;
  menuOpen: boolean; onMenuToggle: () => void; onMenuClose: () => void;
  formatBudget: (v: number) => string;
}) {
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;
  const budgetPct = project.totalBudget > 0 ? Math.min((project.spentBudget / project.totalBudget) * 100, 100) : 0;
  const gradient = getAvatarGradient(project.id);
  const initials = getInitials(project.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04, duration: 0.25 }}
      onClick={onOpen}
      className="bg-card border border-border rounded-2xl cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group relative overflow-hidden"
    >
      {/* Status accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: status.color }} />

      <div className="p-4 md:p-5 pl-5 md:pl-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 text-white text-[15px] font-bold shadow-sm`}>
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-foreground font-semibold group-hover:text-primary transition-colors truncate">
                {project.name}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${status.bg} ${status.text}`}>
                {status.label}
              </span>
              {project.industry && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full hidden sm:inline">
                  {project.industry}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-[12.5px] line-clamp-1">
              {project.description || "Без описания"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onOpen(); }}
              className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              title="Открыть"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); onMenuToggle(); }}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={e => { e.stopPropagation(); onMenuClose(); }} />
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl z-20 py-1.5 min-w-[160px] overflow-hidden">
                    <button
                      onClick={e => { e.stopPropagation(); onMenuClose(); onOpen(); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-foreground hover:bg-muted transition-colors"
                    >
                      <FolderKanban className="w-3.5 h-3.5 text-primary" /> Открыть
                    </button>
                    <div className="h-px bg-border mx-2 my-1" />
                    <button
                      onClick={e => { e.stopPropagation(); onMenuClose(); onDelete(); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-red-500 hover:bg-red-500/5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Удалить
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Budget + stats */}
        <div className="mt-4 space-y-2.5">
          <div>
            <div className="flex justify-between text-[11.5px] mb-1.5">
              <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Бюджет</span>
              <span className="text-foreground font-medium">
                {formatBudget(project.spentBudget)} / {formatBudget(project.totalBudget)} ₽
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${status.bar}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Megaphone className="w-3 h-3" />{project.campaigns.length} кампаний
              </span>
              <span className="flex items-center gap-1.5">
                <Activity className="w-3 h-3" />{project.metrics.length} метрик
              </span>
              <span className="hidden sm:flex items-center gap-1.5">
                <Users className="w-3 h-3" />{project.audiences.length} аудиторий
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(project.endDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "2-digit" })}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══ Grid card ═══ */
function ProjectGridCard({ project, idx, onOpen, onDelete, menuOpen, onMenuToggle, onMenuClose, formatBudget }: {
  project: Project; idx: number;
  onOpen: () => void; onDelete: () => void;
  menuOpen: boolean; onMenuToggle: () => void; onMenuClose: () => void;
  formatBudget: (v: number) => string;
}) {
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;
  const budgetPct = project.totalBudget > 0 ? Math.min((project.spentBudget / project.totalBudget) * 100, 100) : 0;
  const gradient = getAvatarGradient(project.id);
  const initials = getInitials(project.name);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: idx * 0.05, duration: 0.25 }}
      onClick={onOpen}
      className="bg-card border border-border rounded-2xl cursor-pointer hover:border-primary/30 hover:shadow-lg transition-all group relative overflow-hidden flex flex-col"
    >
      {/* Top gradient bar */}
      <div className={`h-24 bg-gradient-to-br ${gradient} relative flex items-end p-4`}>
        <div className="absolute inset-0 bg-black/10" />
        {/* Status badge */}
        <span className={`relative px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 text-white backdrop-blur-sm`}>
          {status.label}
        </span>
        {/* Menu */}
        <div className="absolute top-3 right-3 relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { e.stopPropagation(); onMenuToggle(); }}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors backdrop-blur-sm"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={e => { e.stopPropagation(); onMenuClose(); }} />
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl z-20 py-1.5 min-w-[150px]">
                <button onClick={e => { e.stopPropagation(); onMenuClose(); onOpen(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-foreground hover:bg-muted transition-colors">
                  <FolderKanban className="w-3.5 h-3.5 text-primary" /> Открыть
                </button>
                <div className="h-px bg-border mx-2 my-1" />
                <button onClick={e => { e.stopPropagation(); onMenuClose(); onDelete(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-red-500 hover:bg-red-500/5 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Удалить
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Avatar */}
      <div className="px-4 -mt-6 mb-1 relative">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} border-2 border-card flex items-center justify-center text-white font-bold text-[15px] shadow-md`}>
          {initials}
        </div>
      </div>

      <div className="px-4 pb-4 flex-1 flex flex-col">
        <div className="mb-3">
          <h3 className="text-foreground font-semibold group-hover:text-primary transition-colors line-clamp-1">
            {project.name}
          </h3>
          {project.industry && (
            <span className="text-[11px] text-muted-foreground">{project.industry}</span>
          )}
          <p className="text-muted-foreground text-[12px] mt-1.5 line-clamp-2">
            {project.description || "Без описания"}
          </p>
        </div>

        {/* Budget */}
        <div className="mt-auto">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted-foreground">Бюджет</span>
            <span className="text-foreground font-medium">{Math.round(budgetPct)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
            <div className={`h-full rounded-full ${status.bar} transition-all`} style={{ width: `${budgetPct}%` }} />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{formatBudget(project.spentBudget)} / {formatBudget(project.totalBudget)} ₽</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><Megaphone className="w-3 h-3" />{project.campaigns.length}</span>
              <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{project.metrics.length}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══ Add Project Modal ═══ */
function AddProjectModal({ onSave, onClose }: { onSave: (p: Project) => void; onClose: () => void }) {
  const modalRef = useModal(onClose);
  const [project, setProject] = useState<Project>(emptyProject());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!project.name.trim()) e.name = "Введите название проекта";
    if (project.totalBudget < 0) e.totalBudget = "Бюджет не может быть отрицательным";
    if (project.startDate >= project.endDate) e.endDate = "Дата окончания должна быть позже даты начала";
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave(project);
  };

  const field = (key: keyof Project, label: string, type = "text", props?: object) => (
    <div>
      <label className="text-[12px] text-muted-foreground block mb-1.5 font-medium">{label}</label>
      <input
        type={type}
        value={String(project[key] ?? "")}
        onChange={e => setProject(p => ({ ...p, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
        className={`w-full bg-muted/40 border rounded-xl px-3.5 py-2.5 text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all ${errors[key] ? "border-red-400" : "border-border"}`}
        {...props}
      />
      {errors[key] && <p className="text-[11px] text-red-500 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <ModalOverlay onClose={onClose} label="Создать проект">
      <div
        ref={modalRef}
        className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[#2eb8a4] flex items-center justify-center">
              <FolderKanban className="w-4.5 h-4.5 text-white" />
            </div>
            <h3 className="text-foreground font-semibold">Новый проект</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {field("name", "Название проекта *", "text", { placeholder: "Например: Запуск нового продукта" })}

          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5 font-medium">Описание</label>
            <textarea
              value={project.description}
              onChange={e => setProject(p => ({ ...p, description: e.target.value }))}
              placeholder="Краткое описание проекта..."
              rows={2}
              className="w-full bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-foreground text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1.5 font-medium">Отрасль</label>
              <select
                value={project.industry}
                onChange={e => setProject(p => ({ ...p, industry: e.target.value }))}
                className="w-full bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1.5 font-medium">Статус</label>
              <select
                value={project.status}
                onChange={e => setProject(p => ({ ...p, status: e.target.value as Project["status"] }))}
                className="w-full bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="active">Активный</option>
                <option value="paused">На паузе</option>
                <option value="completed">Завершён</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field("totalBudget", "Общий бюджет (₽)", "number", { min: 0, placeholder: "500000" })}
            {field("spentBudget", "Потрачено (₽)", "number", { min: 0, placeholder: "0" })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field("startDate", "Дата начала", "date")}
            {field("endDate", "Дата окончания", "date")}
          </div>

          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5 font-medium">Ключевые KPI (необязательно)</label>
            <input
              type="text"
              value={project.kpiSummary}
              onChange={e => setProject(p => ({ ...p, kpiSummary: e.target.value }))}
              placeholder="ROI > 200%, 500 лидов, 50K подписчиков..."
              className="w-full bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors">
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white hover:opacity-90 active:scale-[0.98] transition-all"
            style={{ background: "linear-gradient(135deg, #1a7a6d 0%, #2eb8a4 100%)" }}
          >
            <Sparkles className="w-4 h-4" />
            Создать проект
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}