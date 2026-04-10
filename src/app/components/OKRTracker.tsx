import { useState, useCallback, useMemo } from "react";
import {
  Target, Plus, Edit3, Trash2, X, Check, Loader2, ChevronDown, ChevronRight,
  TrendingUp, Calendar, AlertTriangle, CheckCircle2, Clock, ArrowUpRight,
  Sparkles, BarChart3, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { useKV } from "../lib/useKV";
import { aiGenerate } from "../lib/api";
import { AddToProjectButton } from "./AddToProjectModal";
import { ModalOverlay } from "./ModalOverlay";
import { useModal } from "../hooks/useModal";

interface KeyResult {
  id: string;
  title: string;
  metric: string;
  current: number;
  target: number;
  unit: string;
  status: "on_track" | "at_risk" | "behind" | "completed";
}

interface Objective {
  id: string;
  title: string;
  description: string;
  quarter: string;
  category: string;
  keyResults: KeyResult[];
  createdAt: string;
}

const STORAGE_KEY = "okr:objectives";
const QUARTERS = ["Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026"];
const CATEGORIES = ["Рост", "Продукт", "Маркетинг", "Продажи", "Бренд", "Операции"];
const CATEGORY_COLORS: Record<string, string> = {
  "Рост": "bg-emerald-500/10 text-emerald-600",
  "Продукт": "bg-teal-500/10 text-teal-600",
  "Маркетинг": "bg-[#d4a373]/10 text-[#d4a373]",
  "Продажи": "bg-emerald-500/10 text-emerald-600",
  "Бренд": "bg-amber-500/10 text-amber-700",
  "Операции": "bg-amber-500/10 text-amber-600",
};

const STATUS_CONFIG = {
  on_track: { label: "В плане", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
  at_risk: { label: "Под угрозой", color: "bg-amber-500/10 text-amber-600", icon: AlertTriangle },
  behind: { label: "Отстаём", color: "bg-red-500/10 text-red-500", icon: AlertTriangle },
  completed: { label: "Достигнуто", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
};

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function getKRStatus(kr: KeyResult): KeyResult["status"] {
  if (kr.current >= kr.target) return "completed";
  const pct = kr.target > 0 ? (kr.current / kr.target) * 100 : 0;
  if (pct >= 70) return "on_track";
  if (pct >= 40) return "at_risk";
  return "behind";
}

function getObjectiveProgress(obj: Objective) {
  if (obj.keyResults.length === 0) return 0;
  const total = obj.keyResults.reduce((sum, kr) => {
    const pct = kr.target > 0 ? Math.min((kr.current / kr.target) * 100, 100) : 0;
    return sum + pct;
  }, 0);
  return Math.round(total / obj.keyResults.length);
}

export function OKRTracker() {
  const { data: objectives, save: saveObjectives } = useKV<Objective[]>(STORAGE_KEY, []);
  const [quarterFilter, setQuarterFilter] = useState("Q1 2026");
  const [showAdd, setShowAdd] = useState(false);
  const [editingOKR, setEditingOKR] = useState<Objective | null>(null);
  const [expandedOKR, setExpandedOKR] = useState<string | null>(null);
  const [editingKR, setEditingKR] = useState<{ okrId: string; kr: KeyResult } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const filtered = useMemo(
    () => objectives.filter((o) => o.quarter === quarterFilter),
    [objectives, quarterFilter]
  );

  const overallProgress = useMemo(() => {
    if (filtered.length === 0) return 0;
    return Math.round(filtered.reduce((s, o) => s + getObjectiveProgress(o), 0) / filtered.length);
  }, [filtered]);

  const save = useCallback((next: Objective[]) => saveObjectives(next), [saveObjectives]);

  const addObjective = (obj: Objective) => {
    save([obj, ...objectives]);
    setShowAdd(false);
    toast.success("OKR создан");
  };

  const updateObjective = (obj: Objective) => {
    save(objectives.map((o) => (o.id === obj.id ? obj : o)));
    setEditingOKR(null);
  };

  const deleteObjective = (id: string) => {
    save(objectives.filter((o) => o.id !== id));
    toast.success("OKR удалён");
  };

  const updateKR = (okrId: string, kr: KeyResult) => {
    kr.status = getKRStatus(kr);
    save(objectives.map((o) =>
      o.id === okrId ? { ...o, keyResults: o.keyResults.map((k) => (k.id === kr.id ? kr : k)) } : o
    ));
    setEditingKR(null);
    toast.success("Ключевой результат обновлён");
  };

  const addKR = (okrId: string) => {
    const newKR: KeyResult = {
      id: genId(), title: "Новый KR", metric: "", current: 0, target: 100, unit: "%", status: "behind",
    };
    save(objectives.map((o) =>
      o.id === okrId ? { ...o, keyResults: [...o.keyResults, newKR] } : o
    ));
  };

  const deleteKR = (okrId: string, krId: string) => {
    save(objectives.map((o) =>
      o.id === okrId ? { ...o, keyResults: o.keyResults.filter((k) => k.id !== krId) } : o
    ));
  };

  const handleAISuggest = async () => {
    setAiLoading(true);
    try {
      const result = await aiGenerate("okr_suggest",
        `Ты — стратег по маркетингу. Предложи 3 маркетинговых OKR для ${quarterFilter} в формате JSON:
        [{"title":"Objective...", "description":"...", "category":"Маркетинг", "keyResults":[{"title":"KR...", "metric":"...", "target":100, "unit":"%"}]}]
        Каждый OKR должен иметь 3-4 измеримых ключевых результата. Только JSON.`
      );
      if (result?.content) {
        const match = result.content.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const newOKRs: Objective[] = parsed.map((o: any) => ({
            id: genId(),
            title: o.title,
            description: o.description || "",
            quarter: quarterFilter,
            category: o.category || "Маркетинг",
            keyResults: (o.keyResults || []).map((kr: any) => ({
              id: genId(), title: kr.title, metric: kr.metric || "",
              current: 0, target: kr.target || 100, unit: kr.unit || "%", status: "behind" as const,
            })),
            createdAt: new Date().toISOString(),
          }));
          save([...newOKRs, ...objectives]);
          toast.success(`${newOKRs.length} OKR добавлено`);
        }
      }
    } catch (err: any) {
      toast.error(err?.name === "UsageLimitError" ? "Лимит исчерпан" : "Ошибка AI", { description: err.message });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-5 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#c0854a] flex items-center justify-center">
              <Target className="w-4.5 h-4.5 text-white" />
            </div>
            OKR-трекинг
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            Цели и ключевые результаты маркетинга
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAISuggest}
            disabled={aiLoading}
            className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg text-[12px] font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            AI предложит OKR
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-white"
            style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Добавить OKR
          </button>
        </div>
      </div>

      {/* Quarter selector + Overview */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {QUARTERS.map((q) => (
            <button
              key={q}
              onClick={() => setQuarterFilter(q)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                quarterFilter === q ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${overallProgress}%`,
                  background: overallProgress >= 70 ? "#22c55e" : overallProgress >= 40 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
            <span className="text-[12px] font-medium text-foreground">{overallProgress}%</span>
          </div>
          <span className="text-[12px] text-muted-foreground">{filtered.length} целей</span>
        </div>
      </div>

      {/* OKR List */}
      <div className="space-y-3">
        {filtered.map((obj) => {
          const progress = getObjectiveProgress(obj);
          const isExpanded = expandedOKR === obj.id;

          return (
            <div key={obj.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Objective header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedOKR(isExpanded ? null : obj.id)}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[14px] font-semibold text-foreground">{obj.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${CATEGORY_COLORS[obj.category] || "bg-muted text-muted-foreground"}`}>
                      {obj.category}
                    </span>
                  </div>
                  {obj.description && (
                    <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{obj.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          background: progress >= 70 ? "#22c55e" : progress >= 40 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                    <span className="text-[12px] font-medium text-foreground w-8">{progress}%</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{obj.keyResults.length} KR</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteObjective(obj.id); }}
                    className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Key Results */}
              {isExpanded && (
                <div className="border-t border-border">
                  {obj.keyResults.map((kr) => {
                    const pct = kr.target > 0 ? Math.min(Math.round((kr.current / kr.target) * 100), 100) : 0;
                    const StatusIcon = STATUS_CONFIG[kr.status]?.icon || Clock;
                    const isEditingThis = editingKR?.okrId === obj.id && editingKR?.kr.id === kr.id;

                    return (
                      <div key={kr.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${STATUS_CONFIG[kr.status]?.color.split(" ")[1] || "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          {isEditingThis ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingKR.kr.title}
                                onChange={(e) => setEditingKR({ ...editingKR, kr: { ...editingKR.kr, title: e.target.value } })}
                                className="flex-1 bg-muted/30 border border-border rounded px-2 py-1 text-[12px] text-foreground"
                              />
                              <input
                                type="number"
                                value={editingKR.kr.current}
                                onChange={(e) => setEditingKR({ ...editingKR, kr: { ...editingKR.kr, current: Number(e.target.value) } })}
                                className="w-16 bg-muted/30 border border-border rounded px-2 py-1 text-[12px] text-foreground"
                              />
                              <span className="text-[11px] text-muted-foreground">/</span>
                              <input
                                type="number"
                                value={editingKR.kr.target}
                                onChange={(e) => setEditingKR({ ...editingKR, kr: { ...editingKR.kr, target: Number(e.target.value) } })}
                                className="w-16 bg-muted/30 border border-border rounded px-2 py-1 text-[12px] text-foreground"
                              />
                              <input
                                type="text"
                                value={editingKR.kr.unit}
                                onChange={(e) => setEditingKR({ ...editingKR, kr: { ...editingKR.kr, unit: e.target.value } })}
                                className="w-12 bg-muted/30 border border-border rounded px-2 py-1 text-[12px] text-foreground"
                                placeholder="%"
                              />
                              <button onClick={() => updateKR(obj.id, editingKR.kr)} className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingKR(null)} className="p-1 text-muted-foreground hover:bg-muted rounded">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="text-[12px] text-foreground">{kr.title}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_CONFIG[kr.status]?.color}`}>
                                {STATUS_CONFIG[kr.status]?.label}
                              </span>
                            </div>
                          )}
                        </div>
                        {!isEditingThis && (
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444",
                                }}
                              />
                            </div>
                            <span className="text-[11px] text-foreground font-medium w-16 text-right">
                              {kr.current}/{kr.target} {kr.unit}
                            </span>
                            <button onClick={() => setEditingKR({ okrId: obj.id, kr: { ...kr } })} className="p-1 rounded hover:bg-muted text-muted-foreground">
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteKR(obj.id, kr.id)} className="p-1 rounded hover:bg-red-500/10 text-red-500/50 hover:text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={() => addKR(obj.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Добавить KR
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-[14px]">Нет целей для {quarterFilter}</p>
            <p className="text-[12px] mt-1">Создайте OKR или попросите AI предложить</p>
          </div>
        )}
      </div>

      {/* Add OKR Modal */}
      {showAdd && (
        <ModalOverlay onClose={() => setShowAdd(false)}>
          <AddOKRModal
            quarter={quarterFilter}
            onSave={addObjective}
            onClose={() => setShowAdd(false)}
          />
        </ModalOverlay>
      )}
    </div>
  );
}

function AddOKRModal({ quarter, onSave, onClose }: { quarter: string; onSave: (o: Objective) => void; onClose: () => void }) {
  const modalRef = useModal(onClose);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Маркетинг");

  return (
    <div
      ref={modalRef}
      className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-okr-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 id="add-okr-title" className="text-[14px] font-semibold text-foreground">Новый OKR — {quarter}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Закрыть"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Цель (Objective)..."
          className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px]"
          autoFocus
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание..."
          rows={2}
          className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[12px] resize-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px]"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 p-4 border-t border-border">
        <button onClick={onClose} className="px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground">Отмена</button>
        <button
          onClick={() => {
            if (!title.trim()) return;
            onSave({
              id: genId(), title, description, quarter, category, keyResults: [], createdAt: new Date().toISOString(),
            });
          }}
          disabled={!title.trim()}
          className="px-4 py-2 rounded-lg text-[12px] font-medium text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
        >
          Создать
        </button>
      </div>
    </div>
  );
}