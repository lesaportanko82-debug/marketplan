import { fireConfetti } from "../lib/confetti";
import { useState, useEffect, useCallback } from "react";
import {
  FlaskConical, Plus, Edit3, Trash2, Check, X, Search, Loader2,
  Play, Pause, CheckCircle2,
  BarChart3, Eye, Calendar,
  Trophy, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { getData, saveData } from "../lib/api";
import { AddToProjectButton } from "./AddToProjectModal";
import { MascotMessage } from "./Mascot";
import { showMascotReaction, checkMilestone } from "../lib/mascot-reactions";
import { triggerMilestoneCheck } from "./MascotGames";
import { useUsage } from "../lib/useUsage";
import { checkServerUsage } from "../lib/api";
import { EmptyState } from "./EmptyState";

interface Variant {
  name: string;
  description: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

interface AbTest {
  id: string;
  name: string;
  hypothesis: string;
  channel: string;
  status: "draft" | "running" | "paused" | "completed";
  startDate: string;
  endDate: string;
  metric: string;
  confidence: number;
  winner: string;
  variants: Variant[];
  notes: string;
  createdAt: string;
}

const STORAGE_KEY = "ab_tests:list";
const CHANNELS = ["Яндекс Директ", "VK Реклама", "Google Ads", "Email", "Landing Page", "Telegram", "Instagram", "SEO", "Другое"];
const STATUS_LABELS: Record<string, string> = { draft: "Черновик", running: "Активный", paused: "На паузе", completed: "Завершён" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-emerald-500/10 text-emerald-600",
  paused: "bg-amber-500/10 text-amber-600",
  completed: "bg-primary/10 text-primary",
};
const STATUS_ICONS: Record<string, any> = { draft: Clock, running: Play, paused: Pause, completed: CheckCircle2 };

const emptyTest = (): AbTest => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  name: "", hypothesis: "", channel: CHANNELS[0], status: "draft",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  metric: "Конверсия", confidence: 0, winner: "",
  variants: [
    { name: "Контроль (A)", description: "", impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
    { name: "Вариант B", description: "", impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  ],
  notes: "", createdAt: new Date().toISOString(),
});

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

export function AbTests() {
  const { canUse, increment, decrement } = useUsage();
  const [tests, setTests] = useState<AbTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<AbTest | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    getData<AbTest[]>(STORAGE_KEY).then(d => {
      if (d && Array.isArray(d)) setTests(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = useCallback((next: AbTest[]) => { setTests(next); saveData(STORAGE_KEY, next); }, []);
  const handleAdd = async (t: AbTest) => {
    if (!canUse("abTests")) { toast.error("Лимит A/B тестов исчерпан. Обновите план."); return; }
    try {
      const sc = await checkServerUsage("abTests");
      if (sc && !sc.allowed) { toast.error(sc.message || "Лимит A/B тестов исчерпан."); return; }
    } catch (e) { console.warn("[AbTests] Server check failed:", e); }
    save([t, ...tests]); setShowAdd(false); increment("abTests");
    toast.success(`Тест «${t.name}» создан`); showMascotReaction("save", `Тест «${t.name}» создан!`); const m = checkMilestone("tests_3", tests.length + 1); if (m) triggerMilestoneCheck();
  };
  const handleUpdate = (t: AbTest) => {
    const old = tests.find(x => x.id === t.id);
    save(tests.map(x => x.id === t.id ? t : x));
    setEditing(null);
    // Fire confetti when test is marked as completed
    if (t.status === "completed" && old?.status !== "completed") {
      fireConfetti();
      toast.success("Тест завершён! Победитель определён", { description: `«${t.name}»` });
    } else {
      toast.success("Тест обновлён");
    }
  };
  const handleDelete = (id: string) => { const t = tests.find(x => x.id === id); save(tests.filter(x => x.id !== id)); decrement("abTests"); toast.success(`«${t?.name}» удалён`); showMascotReaction("delete"); };

  const filtered = tests.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return t.name.toLowerCase().includes(s) || t.hypothesis.toLowerCase().includes(s) || t.channel.toLowerCase().includes(s);
  });

  const counts = { all: tests.length, draft: tests.filter(t => t.status === "draft").length, running: tests.filter(t => t.status === "running").length, paused: tests.filter(t => t.status === "paused").length, completed: tests.filter(t => t.status === "completed").length };

  const getWinnerVariant = (t: AbTest) => {
    if (t.variants.length < 2) return null;
    const sorted = [...t.variants].sort((a, b) => {
      const crA = a.impressions > 0 ? a.conversions / a.impressions : 0;
      const crB = b.impressions > 0 ? b.conversions / b.impressions : 0;
      return crB - crA;
    });
    return sorted[0];
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 md:p-5 max-w-[1440px] mx-auto space-y-4 md:space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-2.5">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center shrink-0"><FlaskConical className="w-4 h-4 text-white" /></div>
            A/B Тесты
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">{tests.length} экспериментов · {counts.running} активных</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg text-[13px] hover:opacity-90" data-hotspot="ab-tests-add">
          <Plus className="w-4 h-4" /> Новый тест
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-2 md:space-y-0 md:flex md:items-center md:gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск тестов..."
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground text-[13px] placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {(["all", "running", "draft", "paused", "completed"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {s === "all" ? "Все" : STATUS_LABELS[s]} <span className="opacity-70">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tests list */}
      {tests.length === 0 ? (
        <EmptyState
          title="Нет экспериментов"
          description="Создайте A/B тест, чтобы оптимизировать кампании и принимать решения на данных!"
          emotion="think"
          action={{ label: "Создать тест", onClick: () => setShowAdd(true), icon: <Plus className="w-4 h-4" /> }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(test => {
            const SIcon = STATUS_ICONS[test.status];
            const winner = getWinnerVariant(test);
            const totalImpressions = test.variants.reduce((s, v) => s + v.impressions, 0);
            const totalConversions = test.variants.reduce((s, v) => s + v.conversions, 0);
            return (
              <div key={test.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-foreground">{test.name || "Без названия"}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${STATUS_COLORS[test.status]}`}>
                        <SIcon className="w-3 h-3" />{STATUS_LABELS[test.status]}
                      </span>
                      <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{test.channel}</span>
                    </div>
                    {test.hypothesis && <p className="text-[12px] text-muted-foreground line-clamp-2 mb-2">{test.hypothesis}</p>}

                    {/* Variants mini-comparison */}
                    <div className="flex gap-3 flex-wrap">
                      {test.variants.map((v, i) => {
                        const cr = v.impressions > 0 ? ((v.conversions / v.impressions) * 100).toFixed(2) : "0.00";
                        const isWinner = test.status === "completed" && winner && v.name === winner.name;
                        return (
                          <div key={i} className={`flex-1 min-w-[140px] p-3 rounded-lg border ${isWinner ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/10"}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              {isWinner && <Trophy className="w-3 h-3 text-amber-500" />}
                              <span className="text-[12px] text-foreground font-medium">{v.name}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                              <span className="text-muted-foreground">Показы</span><span className="text-foreground text-right">{fmt(v.impressions)}</span>
                              <span className="text-muted-foreground">Клики</span><span className="text-foreground text-right">{fmt(v.clicks)}</span>
                              <span className="text-muted-foreground">Конверсии</span><span className="text-foreground text-right">{v.conversions}</span>
                              <span className="text-muted-foreground">CR</span><span className={`text-right font-medium ${Number(cr) >= 3 ? "text-emerald-600" : "text-foreground"}`}>{cr}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(test.startDate).toLocaleDateString("ru-RU")} - {new Date(test.endDate).toLocaleDateString("ru-RU")}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmt(totalImpressions)} показов</span>
                      {test.confidence > 0 && <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />Достоверность: {test.confidence}%</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <AddToProjectButton itemType="ab_test" itemId={test.id} itemTitle={test.name || "A/B Тест"} />
                    <button onClick={() => setEditing(test)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(test.id)} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {(showAdd || editing) && (
        <AbTestModal
          test={editing || emptyTest()}
          isNew={showAdd}
          onSave={t => showAdd ? handleAdd(t) : handleUpdate(t)}
          onClose={() => { setShowAdd(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function AbTestModal({ test, isNew, onSave, onClose }: { test: AbTest; isNew: boolean; onSave: (t: AbTest) => void; onClose: () => void }) {
  const [form, setForm] = useState(test);
  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));
  const setVariant = (index: number, key: string, val: any) => {
    setForm(f => ({ ...f, variants: f.variants.map((v, i) => i === index ? { ...v, [key]: val } : v) }));
  };
  const addVariant = () => {
    const letter = String.fromCharCode(65 + form.variants.length);
    set("variants", [...form.variants, { name: `Вариант ${letter}`, description: "", impressions: 0, clicks: 0, conversions: 0, revenue: 0 }]);
  };
  const removeVariant = (i: number) => { if (form.variants.length <= 2) return; set("variants", form.variants.filter((_, j) => j !== i)); };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-foreground">{isNew ? "Новый A/B тест" : "Редактировать тест"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-[12px] text-muted-foreground block mb-1">Название *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Тест CTA кнопки на лендинге" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" autoFocus /></div>
          <div><label className="text-[12px] text-muted-foreground block mb-1">Гипотеза</label>
            <textarea value={form.hypothesis} onChange={e => set("hypothesis", e.target.value)} placeholder="Если изменить CTA с 'Купить' на 'Попробовать бесплатно', то конверсия вырастет на 20%..." rows={2} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none" /></div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[12px] text-muted-foreground block mb-1">Канал</label>
              <select value={form.channel} onChange={e => set("channel", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]">
                {CHANNELS.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-[12px] text-muted-foreground block mb-1">Статус</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]">
                <option value="draft">Черновик</option><option value="running">Активный</option><option value="paused">На паузе</option><option value="completed">Завершён</option></select></div>
            <div><label className="text-[12px] text-muted-foreground block mb-1">Ключевая етрика</label>
              <input value={form.metric} onChange={e => set("metric", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[12px] text-muted-foreground block mb-1">Дата начала</label>
              <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" /></div>
            <div><label className="text-[12px] text-muted-foreground block mb-1">Дата окончания</label>
              <input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" /></div>
            <div><label className="text-[12px] text-muted-foreground block mb-1">Достоверность %</label>
              <input type="number" min="0" max="100" value={form.confidence} onChange={e => set("confidence", Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" /></div>
          </div>

          {/* Variants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[12px] text-muted-foreground">Варианты ({form.variants.length})</label>
              <button onClick={addVariant} className="text-[12px] text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />Добавить</button>
            </div>
            <div className="space-y-3">
              {form.variants.map((v, i) => (
                <div key={i} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <input value={v.name} onChange={e => setVariant(i, "name", e.target.value)} className="bg-transparent text-foreground text-[13px] font-medium border-none outline-none" />
                    {form.variants.length > 2 && <button onClick={() => removeVariant(i)} className="text-muted-foreground hover:text-red-500"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                  <input value={v.description} onChange={e => setVariant(i, "description", e.target.value)} placeholder="Описание варианта..." className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px] mb-2" />
                  <div className="grid grid-cols-4 gap-2">
                    {(["impressions", "clicks", "conversions", "revenue"] as const).map(key => (
                      <div key={key}><span className="text-[10px] text-muted-foreground">{key === "impressions" ? "Покзы" : key === "clicks" ? "Клики" : key === "conversions" ? "Конверсии" : "Выручка"}</span>
                        <input type="number" value={v[key]} onChange={e => setVariant(i, key, Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded px-2 py-1 text-foreground text-[12px] mt-0.5" /></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div><label className="text-[12px] text-muted-foreground block mb-1">Заметки</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none" /></div>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">Отмена</button>
          <button onClick={() => onSave(form)} disabled={!form.name.trim()} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] hover:opacity-90 disabled:opacity-50">
            <Check className="w-4 h-4" /> {isNew ? "Создать" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}