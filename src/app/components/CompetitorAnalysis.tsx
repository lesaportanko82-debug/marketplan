import { useState, useEffect, useCallback } from "react";
import {
  Swords, Plus, Edit3, Trash2, Check, X, Search, ExternalLink, TrendingUp, TrendingDown,
  Eye, Users, Globe, Instagram, MessageCircle, Video, Star, BarChart3, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { showMascotReaction, checkMilestone } from "../lib/mascot-reactions";
import { triggerMilestoneCheck } from "./MascotGames";
import { getData, saveData } from "../lib/api";
import { AddToProjectButton } from "./AddToProjectModal";
import { MascotMessage } from "./Mascot";
import { EmptyState } from "./EmptyState";

interface Competitor {
  id: string;
  name: string;
  url: string;
  industry: string;
  description: string;
  logo: string;
  followers: { instagram: number; telegram: number; vk: number; youtube: number; tiktok: number };
  metrics: { traffic: number; dr: number; adSpend: number; contentFreq: string; avgEngagement: number };
  strengths: string[];
  weaknesses: string[];
  notes: string;
  threat: "low" | "medium" | "high";
  createdAt: string;
}

const STORAGE_KEY = "competitors:list";

const emptyCompetitor = (): Competitor => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  name: "", url: "", industry: "", description: "", logo: "",
  followers: { instagram: 0, telegram: 0, vk: 0, youtube: 0, tiktok: 0 },
  metrics: { traffic: 0, dr: 0, adSpend: 0, contentFreq: "", avgEngagement: 0 },
  strengths: [], weaknesses: [], notes: "",
  threat: "medium", createdAt: new Date().toISOString(),
});

const THREAT_COLORS = {
  low: "bg-emerald-500/10 text-emerald-600",
  medium: "bg-amber-500/10 text-amber-600",
  high: "bg-red-500/10 text-red-500",
};
const THREAT_LABELS = { low: "Низкая", medium: "Средняя", high: "Высокая" };
const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

const SOCIAL_ICONS: Record<string, any> = { instagram: Instagram, telegram: MessageCircle, vk: Globe, youtube: Video, tiktok: Video };
const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", telegram: "Telegram", vk: "VK", youtube: "YouTube", tiktok: "TikTok" };

export function CompetitorAnalysis() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Competitor | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    getData<Competitor[]>(STORAGE_KEY).then(d => {
      if (d && Array.isArray(d)) setCompetitors(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = useCallback((next: Competitor[]) => { setCompetitors(next); saveData(STORAGE_KEY, next); }, []);

  const handleAdd = (c: Competitor) => { save([c, ...competitors]); setShowAdd(false); toast.success(`Конкурент «${c.name}» добавлен`); showMascotReaction("save", `Конкурент «${c.name}» добавлен!`); const m = checkMilestone("competitors_3", competitors.length + 1); if (m) triggerMilestoneCheck(); };
  const handleUpdate = (c: Competitor) => { save(competitors.map(x => x.id === c.id ? c : x)); setEditing(null); toast.success("Обновлено"); showMascotReaction("save"); };
  const handleDelete = (id: string) => {
    const c = competitors.find(x => x.id === id);
    save(competitors.filter(x => x.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.success(`«${c?.name}» удалён`);
  };

  const filtered = competitors.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.industry.toLowerCase().includes(s) || c.url.toLowerCase().includes(s);
  });

  const selected = selectedId ? competitors.find(c => c.id === selectedId) : null;

  const totalFollowers = (c: Competitor) => Object.values(c.followers).reduce((s, v) => s + v, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 md:p-5 max-w-[1440px] mx-auto space-y-4 md:space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-2.5">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shrink-0"><Swords className="w-4 h-4 text-white" /></div>
            Конкуренты
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">{competitors.length} конкурентов · Отслеживайте рынок и позиционирование</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg text-[13px] hover:opacity-90">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline"> Добавить конкурента</span><span className="sm:hidden"> Добавить</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск конкурентов..."
          className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-foreground text-[13px] placeholder:text-muted-foreground" />
      </div>

      {competitors.length === 0 ? (
        <EmptyState
          title="Нет конкурентов"
          description="Добавьте первого конкурента для анализа рынка. Марк поможет найти их слабые места!"
          emotion="think"
          action={{ label: "Добавить конкурента", onClick: () => setShowAdd(true), icon: <Plus className="w-4 h-4" /> }}
        />
      ) : (
        <div className={`flex gap-4 ${isMobile ? "flex-col" : ""}`}>
          {/* List */}
          <div className="flex-1 space-y-2 min-w-0">
            {filtered.length === 0 ? (
              <EmptyState title="Конкуренты не найдены" description="Попробуйте изменить поисковый запрос" emotion="think" compact />
            ) : (
              filtered.map(c => (
                <div key={c.id} onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                  className={`bg-card border rounded-xl p-4 cursor-pointer transition-all ${selectedId === c.id ? "border-primary/40 shadow-sm" : "border-border hover:border-primary/20"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-foreground">{c.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${THREAT_COLORS[c.threat]}`}>
                          Угроза: {THREAT_LABELS[c.threat]}
                        </span>
                        {c.industry && <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{c.industry}</span>}
                      </div>
                      {c.description && <p className="text-[12px] text-muted-foreground line-clamp-1">{c.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{fmt(totalFollowers(c))} подписчиков</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmt(c.metrics.traffic)} трафик</span>
                        {c.url && (
                          <a href={c.url.startsWith("http") ? c.url : `https://${c.url}`} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-primary hover:underline">
                            <ExternalLink className="w-3 h-3" />{c.url.replace(/https?:\/\//, "").slice(0, 30)}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <AddToProjectButton itemType="competitor" itemId={c.id} itemTitle={c.name} />
                      <button onClick={e => { e.stopPropagation(); setEditing(c); }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Detail panel - on mobile: full-width below list, on desktop: fixed right column */}
          {selected && (
            <div className={isMobile ? "w-full" : "w-[380px] shrink-0"}>
              <div className="bg-card border border-border rounded-xl p-5 sticky top-0 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-foreground">{selected.name}</h3>
                  <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${THREAT_COLORS[selected.threat]}`}>Угроза: {THREAT_LABELS[selected.threat]}</span>

                {/* Social followers */}
                <div>
                  <h4 className="text-[12px] text-muted-foreground mb-2">Аудитория</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(selected.followers) as [string, number][]).filter(([, v]) => v > 0).map(([key, val]) => {
                      const SIcon = SOCIAL_ICONS[key] || Globe;
                      return (
                        <div key={key} className="flex items-center gap-2 text-[12px] text-foreground bg-muted/30 rounded-lg px-2.5 py-1.5">
                          <SIcon className="w-3.5 h-3.5 text-muted-foreground" /> {SOCIAL_LABELS[key]}: <span className="font-medium">{fmt(val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Metrics */}
                <div>
                  <h4 className="text-[12px] text-muted-foreground mb-2">Метрики</h4>
                  <div className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between"><span className="text-muted-foreground">Трафик</span><span className="text-foreground">{fmt(selected.metrics.traffic)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">DR (Domain Rating)</span><span className="text-foreground">{selected.metrics.dr}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Рекл. бюджет (оценка)</span><span className="text-foreground">{fmt(selected.metrics.adSpend)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Частота контента</span><span className="text-foreground">{selected.metrics.contentFreq || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Ср. ER</span><span className="text-foreground">{selected.metrics.avgEngagement}%</span></div>
                  </div>
                </div>

                {/* SWOT */}
                {selected.strengths.length > 0 && (
                  <div>
                    <h4 className="text-[12px] text-emerald-600 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Сильные стороны</h4>
                    <ul className="text-[12px] text-foreground space-y-0.5">{selected.strengths.map((s, i) => <li key={i} className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5">+</span>{s}</li>)}</ul>
                  </div>
                )}
                {selected.weaknesses.length > 0 && (
                  <div>
                    <h4 className="text-[12px] text-red-500 mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Слабые стороны</h4>
                    <ul className="text-[12px] text-foreground space-y-0.5">{selected.weaknesses.map((w, i) => <li key={i} className="flex items-start gap-1.5"><span className="text-red-400 mt-0.5">-</span>{w}</li>)}</ul>
                  </div>
                )}
                {selected.notes && (
                  <div>
                    <h4 className="text-[12px] text-muted-foreground mb-1">Заметки</h4>
                    <p className="text-[12px] text-foreground whitespace-pre-line">{selected.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {(showAdd || editing) && (
        <CompetitorModal
          competitor={editing || emptyCompetitor()}
          isNew={showAdd}
          onSave={c => showAdd ? handleAdd(c) : handleUpdate(c)}
          onClose={() => { setShowAdd(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function CompetitorModal({ competitor, isNew, onSave, onClose }: { competitor: Competitor; isNew: boolean; onSave: (c: Competitor) => void; onClose: () => void }) {
  const [form, setForm] = useState(competitor);
  const [strengthInput, setStrengthInput] = useState("");
  const [weaknessInput, setWeaknessInput] = useState("");
  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));
  const setFollower = (key: string, val: number) => setForm(f => ({ ...f, followers: { ...f.followers, [key]: val } }));
  const setMetric = (key: string, val: any) => setForm(f => ({ ...f, metrics: { ...f.metrics, [key]: val } }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-foreground">{isNew ? "Новый конкурент" : "Редактировать"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] text-muted-foreground block mb-1">Название *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" autoFocus /></div>
            <div><label className="text-[12px] text-muted-foreground block mb-1">Сайт</label>
              <input value={form.url} onChange={e => set("url", e.target.value)} placeholder="example.com" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] text-muted-foreground block mb-1">Отрасль</label>
              <input value={form.industry} onChange={e => set("industry", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" /></div>
            <div><label className="text-[12px] text-muted-foreground block mb-1">Уровень угрозы</label>
              <select value={form.threat} onChange={e => set("threat", e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]">
                <option value="low">Низкая</option><option value="medium">Средняя</option><option value="high">Высокая</option>
              </select></div>
          </div>
          <div><label className="text-[12px] text-muted-foreground block mb-1">Описание</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none" /></div>

          <div>
            <label className="text-[12px] text-muted-foreground block mb-2">Подписчики</label>
            <div className="grid grid-cols-3 gap-2">
              {(["instagram", "telegram", "vk", "youtube", "tiktok"] as const).map(key => (
                <div key={key}>
                  <span className="text-[11px] text-muted-foreground">{SOCIAL_LABELS[key]}</span>
                  <input type="number" value={form.followers[key]} onChange={e => setFollower(key, Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px] mt-0.5" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] text-muted-foreground block mb-2">Метрики</label>
            <div className="grid grid-cols-3 gap-2">
              <div><span className="text-[11px] text-muted-foreground">Трафик/мес</span><input type="number" value={form.metrics.traffic} onChange={e => setMetric("traffic", Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px] mt-0.5" /></div>
              <div><span className="text-[11px] text-muted-foreground">DR</span><input type="number" value={form.metrics.dr} onChange={e => setMetric("dr", Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px] mt-0.5" /></div>
              <div><span className="text-[11px] text-muted-foreground">Рекл. бюджет</span><input type="number" value={form.metrics.adSpend} onChange={e => setMetric("adSpend", Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px] mt-0.5" /></div>
              <div><span className="text-[11px] text-muted-foreground">Частота контента</span><input value={form.metrics.contentFreq} onChange={e => setMetric("contentFreq", e.target.value)} placeholder="3 поста/день" className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px] mt-0.5" /></div>
              <div><span className="text-[11px] text-muted-foreground">ER %</span><input type="number" step="0.1" value={form.metrics.avgEngagement} onChange={e => setMetric("avgEngagement", Number(e.target.value))} className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px] mt-0.5" /></div>
            </div>
          </div>

          {/* Strengths */}
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Сильные стороны</label>
            <div className="flex gap-2 mb-1.5">
              <input value={strengthInput} onChange={e => setStrengthInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && strengthInput.trim()) { set("strengths", [...form.strengths, strengthInput.trim()]); setStrengthInput(""); } }}
                placeholder="Добавить и Enter" className="flex-1 bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px]" />
            </div>
            <div className="flex flex-wrap gap-1">{form.strengths.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full text-[11px]">
                {s}<button onClick={() => set("strengths", form.strengths.filter((_, j) => j !== i))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            ))}</div>
          </div>
          {/* Weaknesses */}
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Слабые стороны</label>
            <div className="flex gap-2 mb-1.5">
              <input value={weaknessInput} onChange={e => setWeaknessInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && weaknessInput.trim()) { set("weaknesses", [...form.weaknesses, weaknessInput.trim()]); setWeaknessInput(""); } }}
                placeholder="Добавить и Enter" className="flex-1 bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground text-[12px]" />
            </div>
            <div className="flex flex-wrap gap-1">{form.weaknesses.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full text-[11px]">
                {w}<button onClick={() => set("weaknesses", form.weaknesses.filter((_, j) => j !== i))} className="hover:text-foreground"><X className="w-3 h-3" /></button>
              </span>
            ))}</div>
          </div>

          <div><label className="text-[12px] text-muted-foreground block mb-1">Заметки</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none" /></div>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground">Отмена</button>
          <button onClick={() => onSave(form)} disabled={!form.name.trim()} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] hover:opacity-90 disabled:opacity-50">
            <Check className="w-4 h-4" /> {isNew ? "Добавить" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}