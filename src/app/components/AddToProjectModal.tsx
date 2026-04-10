import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, FolderKanban, Plus, Check, Search, Loader2, ChevronRight,
} from "lucide-react";
import { getData, saveData } from "../lib/api";
import { mockProjects, type Project } from "../data/mock-data";
import { toast } from "sonner";

// ════════════════════════════════════════
//  Types for project attachments
// ════════════════════════════════════════

export type AttachmentType =
  | "ab_test"
  | "smm_post"
  | "content_idea"
  | "competitor"
  | "unit_model"
  | "influencer"
  | "media_asset";

export interface ProjectAttachment {
  type: AttachmentType;
  itemId: string;
  title: string;
  addedAt: string;
}

const ATTACHMENT_LABELS: Record<AttachmentType, string> = {
  ab_test: "A/B Тест",
  smm_post: "SMM Пост",
  content_idea: "Идея контента",
  competitor: "Конкурент",
  unit_model: "Unit-модель",
  influencer: "Инфлюенсер",
  media_asset: "Бренд-ассет",
};

const ATTACHMENTS_KEY = (projectId: string) => `project_attachments:${projectId}`;
const PROJECTS_KEY = "projects:list";

// ════════════════════════════════════════
//  Utility functions
// ════════════════════════════════════════

export async function getProjectAttachments(projectId: string): Promise<ProjectAttachment[]> {
  const data = await getData<ProjectAttachment[]>(ATTACHMENTS_KEY(projectId));
  return (data && Array.isArray(data)) ? data : [];
}

export async function addAttachmentToProject(
  projectId: string,
  attachment: Omit<ProjectAttachment, "addedAt">
): Promise<boolean> {
  const existing = await getProjectAttachments(projectId);
  // Avoid duplicates
  if (existing.some(a => a.type === attachment.type && a.itemId === attachment.itemId)) {
    return true; // already linked
  }
  const next = [...existing, { ...attachment, addedAt: new Date().toISOString() }];
  return saveData(ATTACHMENTS_KEY(projectId), next);
}

export async function removeAttachmentFromProject(
  projectId: string,
  type: AttachmentType,
  itemId: string
): Promise<boolean> {
  const existing = await getProjectAttachments(projectId);
  const next = existing.filter(a => !(a.type === type && a.itemId === itemId));
  return saveData(ATTACHMENTS_KEY(projectId), next);
}

// ════════════════════════════════════════
//  Button (trigger)
// ════════════════════════════════════════

export function AddToProjectButton({
  itemType,
  itemId,
  itemTitle,
  size = "sm",
}: {
  itemType: AttachmentType;
  itemId: string;
  itemTitle: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`flex items-center gap-1.5 rounded-lg transition-colors ${
          size === "sm"
            ? "px-2 py-1 text-[11px] bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground"
            : "px-3 py-1.5 text-[12px] bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
        }`}
        title="Добавить в проект"
      >
        <FolderKanban className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span>В проект</span>
      </button>

      <AnimatePresence>
        {open && (
          <AddToProjectModal
            itemType={itemType}
            itemId={itemId}
            itemTitle={itemTitle}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ════════════════════════════════════════
//  Modal
// ════════════════════════════════════════

function AddToProjectModal({
  itemType,
  itemId,
  itemTitle,
  onClose,
}: {
  itemType: AttachmentType;
  itemId: string;
  itemTitle: string;
  onClose: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [linkedProjects, setLinkedProjects] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState("E-commerce");

  const INDUSTRIES = ["E-commerce", "SaaS / B2B", "HoReCa", "Финтех", "Образование", "Медицина", "Недвижимость", "Ритейл", "Логистика", "Медиа", "Другое"];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const projData = await getData<Project[]>(PROJECTS_KEY);
      const projs = (projData && Array.isArray(projData) && projData.length > 0) ? projData : mockProjects;
      setProjects(projs);

      // Check which projects already have this item linked
      const linked = new Set<string>();
      await Promise.all(projs.map(async (p) => {
        const attachments = await getProjectAttachments(p.id);
        if (attachments.some(a => a.type === itemType && a.itemId === itemId)) {
          linked.add(p.id);
        }
      }));
      setLinkedProjects(linked);
    } catch (err) {
      console.log(`Failed to load linked projects: ${err}`);
    }
    setLoading(false);
  };

  const handleLink = useCallback(async (projectId: string) => {
    setSaving(projectId);
    const ok = await addAttachmentToProject(projectId, { type: itemType, itemId, title: itemTitle });
    setSaving(null);
    if (ok) {
      setLinkedProjects(prev => new Set([...prev, projectId]));
      const projName = projects.find(p => p.id === projectId)?.name || "проект";
      toast.success(`«${itemTitle}» добавлено в «${projName}»`);
    } else {
      toast.error("Ошибка привязки");
    }
  }, [itemType, itemId, itemTitle, projects]);

  const handleUnlink = useCallback(async (projectId: string) => {
    setSaving(projectId);
    const ok = await removeAttachmentFromProject(projectId, itemType, itemId);
    setSaving(null);
    if (ok) {
      setLinkedProjects(prev => { const next = new Set(prev); next.delete(projectId); return next; });
      toast.success("Убрано из проекта");
    }
  }, [itemType, itemId]);

  const handleCreateAndLink = useCallback(async () => {
    if (!newName.trim()) return;
    setSaving("new");
    const newProject: Project = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: newName.trim(),
      description: "",
      status: "active",
      industry: newIndustry,
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
    };
    const allProjects = [...projects, newProject];
    await saveData(PROJECTS_KEY, allProjects);
    await addAttachmentToProject(newProject.id, { type: itemType, itemId, title: itemTitle });
    setProjects(allProjects);
    setLinkedProjects(prev => new Set([...prev, newProject.id]));
    setShowNewProject(false);
    setNewName("");
    setSaving(null);
    toast.success(`Проект «${newProject.name}» создан и элемент привязан`);
  }, [newName, newIndustry, projects, itemType, itemId, itemTitle]);

  const filtered = projects.filter(p => {
    if (!search) return true;
    return p.name.toLowerCase().includes(search.toLowerCase()) || p.industry.toLowerCase().includes(search.toLowerCase());
  });

  const statusLabels: Record<string, string> = { active: "Активный", paused: "На паузе", completed: "Завершён" };
  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600",
    paused: "bg-amber-500/10 text-amber-600",
    completed: "bg-muted text-muted-foreground",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-primary" />
              Добавить в проект
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {ATTACHMENT_LABELS[itemType]}: «{itemTitle.length > 40 ? itemTitle.slice(0, 40) + "..." : itemTitle}»
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск проекта..."
              className="w-full bg-muted/30 border border-border rounded-lg pl-9 pr-4 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-[color:var(--ring)]/40 outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* Project List */}
        <div className="px-5 pb-2 max-h-[300px] overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-[13px]">
              {search ? "Ничего не найдено" : "Нет проектов"}
            </div>
          ) : (
            filtered.map(p => {
              const isLinked = linkedProjects.has(p.id);
              const isSaving = saving === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => isLinked ? handleUnlink(p.id) : handleLink(p.id)}
                  disabled={!!saving}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    isLinked
                      ? "bg-primary/8 border border-primary/20"
                      : "bg-muted/20 border border-transparent hover:bg-muted/40"
                  } ${saving ? "opacity-60" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isLinked ? "bg-primary/15" : "bg-muted"
                  }`}>
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    ) : isLinked ? (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <FolderKanban className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-foreground font-medium truncate">{p.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${statusColors[p.status]}`}>
                        {statusLabels[p.status]}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{p.industry}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              );
            })
          )}
        </div>

        {/* Create new project */}
        <div className="px-5 pb-4 pt-2 border-t border-border">
          {!showNewProject ? (
            <button
              onClick={() => setShowNewProject(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border text-[12px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Создать новый проект и привязать
            </button>
          ) : (
            <div className="space-y-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Название нового проекта..."
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <select
                  value={newIndustry}
                  onChange={e => setNewIndustry(e.target.value)}
                  className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-[12px] text-foreground"
                >
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
                <button
                  onClick={handleCreateAndLink}
                  disabled={!newName.trim() || !!saving}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[12px] hover:opacity-90 disabled:opacity-50"
                >
                  {saving === "new" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Создать
                </button>
                <button
                  onClick={() => { setShowNewProject(false); setNewName(""); }}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}