import { useNavigate } from "react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Filter, Megaphone, Activity, Users, MoreVertical,
  Trash2, X, Check, Loader2, FolderKanban, Calendar, DollarSign, AlertTriangle,
} from "lucide-react";
import { mockProjects, type Project } from "../data/mock-data";
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

const PROJECTS_KEY = "projects:list";

const INDUSTRIES = [
  "E-commerce", "SaaS / B2B", "HoReCa", "Финтех", "Образование",
  "Медицина", "Недвижимость", "Ритейл", "Логистика", "Медиа", "Другое",
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
    { name: "Охват", value: 0, conversion: 100 },
    { name: "Клики", value: 0, conversion: 0 },
    { name: "Лиды", value: 0, conversion: 0 },
    { name: "Конверсии", value: 0, conversion: 0 },
  ],
});

export function ProjectsList() {
  const navigate = useNavigate();
  const { canUse, increment, decrement, syncCounter } = useUsage();
  const { data: projects, save: saveProjects, loading } = useKV<Project[]>(PROJECTS_KEY, []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Seed with mock data if empty on first load
  useEffect(() => {
    if (!loading && projects.length === 0) {
      getData<Project[]>(PROJECTS_KEY).then((d) => {
        if (!d || !Array.isArray(d) || d.length === 0) {
          saveProjects(mockProjects);
        }
      });
    }
  }, [loading]);

  const save = useCallback((next: Project[]) => {
    saveProjects(next);
  }, [saveProjects]);

  // Sync project count when projects change
  useEffect(() => {
    if (!loading && projects.length > 0) {
      syncCounter("projects", projects.length);
    }
  }, [projects.length, loading]);

  const handleAddProject = async (project: Project) => {
    // Client-side gate first (fast UX)
    if (!canUse("projects")) {
      showMascotReaction("error", "Лимит проектов исчерпан! Обновите план 🦊");
      toast.error("Лимит проектов исчерпан. Обновите план для создания новых.");
      return;
    }

    // Server-side validation (authoritative)
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
    const project = projects.find((p) => p.id === id);
    const prevProjects = [...projects];
    setDeleteConfirm(null);
    setMenuOpen(null);

    undoableDelete({
      label: `Проект «${project?.name}» удалён`,
      itemKey: PROJECTS_KEY,
      previousData: prevProjects,
      deleteFn: async () => { await saveData(PROJECTS_KEY, projects.filter((p) => p.id !== id)); },
      restoreFn: async (_key, data) => { await saveData(PROJECTS_KEY, data); },
      onOptimistic: () => save(projects.filter((p) => p.id !== id)),
      onRevert: () => save(prevProjects),
    });
  };

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.industry.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatBudget = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  const statusCounts = {
    all: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    paused: projects.filter((p) => p.status === "paused").length,
    completed: projects.filter((p) => p.status === "completed").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-5 max-w-[1440px] mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <FolderKanban className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            Проекты
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            {projects.length} проектов · {statusCounts.active} активных
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg text-[13px] hover:opacity-90 transition-opacity"
          data-hotspot="projects-add"
        >
          <Plus className="w-4 h-4" />
          Новый проект
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск проектов..."
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground placeholder:text-muted-foreground text-[13px]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(["all", "active", "paused", "completed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "Все" : s === "active" ? "Активные" : s === "paused" ? "На паузе" : "За��ершённые"}
              {" "}
              <span className="opacity-70">{statusCounts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="space-y-3">
        {filtered.map((project) => (
          <div
            key={project.id}
            onClick={() => navigate(`/project/${project.id}`)}
            className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/30 transition-colors group relative"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3 className="text-foreground group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[12px] shrink-0 ${
                      project.status === "active"
                        ? "bg-green-500/10 text-green-600"
                        : project.status === "paused"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {project.status === "active" ? "Активный" : project.status === "paused" ? "На паузе" : "Завершён"}
                  </span>
                  <span className="text-[12px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {project.industry}
                  </span>
                </div>
                <p className="text-muted-foreground text-[13px] line-clamp-1">
                  {project.description || "Без описания"}
                </p>
              </div>

              {/* Context menu */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === project.id ? null : project.id); }}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {menuOpen === project.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(null); }} />
                    <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-20 py-1 min-w-[160px]">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(null); navigate(`/project/${project.id}`); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-muted transition-colors"
                      >
                        <FolderKanban className="w-3.5 h-3.5" /> Открыть
                      </button>
                      <div className="h-px bg-border my-1" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(null); setDeleteConfirm(project.id); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-500 hover:bg-red-500/5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Удалить проект
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 mt-4 flex-wrap">
              {/* Budget */}
              <div className="min-w-[180px]">
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-muted-foreground">Бюджет</span>
                  <span className="text-foreground">
                    {formatBudget(project.spentBudget)} / {formatBudget(project.totalBudget)}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(project.totalBudget > 0 ? (project.spentBudget / project.totalBudget) * 100 : 0, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5" />
                  {project.campaigns.length} кампаний
                </span>
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  {project.metrics.length} метрик
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {project.audiences.length} сегментов
                </span>
              </div>

              <span className="text-[12px] text-muted-foreground ml-auto">
                {new Date(project.startDate).toLocaleDateString("ru-RU")} -{" "}
                {new Date(project.endDate).toLocaleDateString("ru-RU")}
              </span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-[14px]">Проекты не найдены</p>
            <p className="text-[12px] mt-1">Попробуйте изменить фильтр или <button onClick={() => setShowAddModal(true)} className="text-primary hover:underline">создайте новый</button></p>
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      {showAddModal && (
        <AddProjectModal
          onSave={handleAddProject}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <ModalOverlay onClose={() => setDeleteConfirm(null)} label="Удалить проект">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-foreground text-[15px]">Удалить проект?</h3>
                <p className="text-muted-foreground text-[13px]">
                  «{projects.find((p) => p.id === deleteConfirm)?.name}» - это действие нельзя отменить
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                Отмена
              </button>
              <button
                onClick={() => handleDeleteProject(deleteConfirm)}
                className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg text-[13px] hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Удалить
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// ==================== ADD PROJECT MODAL ====================
function AddProjectModal({ onSave, onClose }: { onSave: (p: Project) => void; onClose: () => void }) {
  const [form, setForm] = useState(emptyProject());
  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const isValid = form.name.trim().length > 0;

  return (
    <ModalOverlay onClose={onClose} label="Новый проект">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-foreground flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            Новый проект
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Закрыть"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Название проекта *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Например: Запуск мобильного приложения"
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[14px] placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Описание</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Краткое описание целей и задач проекта..."
              rows={3}
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">Отрасль</label>
              <select
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px]"
              >
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">Статус</label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px]"
              >
                <option value="active">Активный</option>
                <option value="paused">На паузе</option>
                <option value="completed">Завершён</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Общий бюджет (RUB)</label>
            <input
              type="number"
              value={form.totalBudget}
              onChange={(e) => set("totalBudget", Number(e.target.value))}
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">Дата начала</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px]"
              />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">Дата окончания</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">KPI / Ключевые цели</label>
            <textarea
              value={form.kpiSummary}
              onChange={(e) => set("kpiSummary", e.target.value)}
              placeholder="Описание ключевых KPI и целей проекта..."
              rows={2}
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-5 border-t border-border">
          <p className="text-[11px] text-muted-foreground">
            Метрики, кампании и аудитории можно добавить внутри проекта
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
              Отмена
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={!isValid}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> Создать проект
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}