import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Plus, Edit3, Trash2, Check, X, Search, Star, Lightbulb,
  Sparkles, RefreshCw, Link2, CalendarPlus,
} from "lucide-react";
import { toast } from "sonner";
import { getData, saveData, aiGenerate } from "../lib/api";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { useModal } from "../hooks/useModal";
import { AddToProjectButton } from "./AddToProjectModal";
import { ModalOverlay } from "./ModalOverlay";
import { EmptyState } from "./EmptyState";

interface ContentIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  links: string[];
  tags: string[];
  starred: boolean;
  status: "idea" | "in_progress" | "used" | "archived";
  createdAt: string;
}

const CATEGORIES = ["Все", "Пост", "Reels", "Stories", "Статья", "Видео", "Email", "Акция", "Коллаборация"];
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  idea: { label: "Идея", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "В работе", color: "bg-amber-500/10 text-amber-600" },
  used: { label: "Использована", color: "bg-emerald-500/10 text-emerald-600" },
  archived: { label: "Архив", color: "bg-muted text-muted-foreground" },
};

const STORAGE_KEY = "smm:content_ideas";

export function ContentIdeas() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Все");
  const [showStarred, setShowStarred] = useState(false);
  const [editingIdea, setEditingIdea] = useState<ContentIdea | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");

  useEffect(() => {
    getData<ContentIdea[]>(STORAGE_KEY).then((d) => {
      if (d && Array.isArray(d)) setIdeas(d);
    });
  }, []);

  const save = useCallback((next: ContentIdea[]) => {
    setIdeas(next);
    saveData(STORAGE_KEY, next);
  }, []);

  const addIdea = (idea: ContentIdea) => { save([idea, ...ideas]); setShowAdd(false); toast.success("Идея добавлена"); };
  const updateIdea = (idea: ContentIdea) => { save(ideas.map((i) => (i.id === idea.id ? idea : i))); setEditingIdea(null); toast.success("Идея обновлена"); };
  const deleteIdea = (id: string) => { save(ideas.filter((i) => i.id !== id)); toast.success("Идея удалена"); };
  const toggleStar = (id: string) => { save(ideas.map((i) => (i.id === id ? { ...i, starred: !i.starred } : i))); };

  const sendToPlan = async (idea: ContentIdea) => {
    // Mark idea as used
    save(ideas.map((i) => (i.id === idea.id ? { ...i, status: "used" as const } : i)));
    
    // Create a new post in the content plan KV store
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const newPost = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date,
      platforms: ["Instagram"],
      type: idea.category === "Reels" ? "Reels/Shorts" : idea.category === "Stories" ? "Stories" : idea.category === "Видео" ? "Видео" : idea.category === "Статья" ? "Статья" : idea.category === "Email" ? "Рассылка" : "Пост",
      topic: idea.title,
      caption: idea.description,
      status: "planned",
      goals: idea.tags.join(", "),
      reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, saves: 0, followers_gained: 0,
    };
    
    // Load existing posts, append new one, save back (aligned with SmmPlan STORAGE_KEY)
    const existingPosts = await getData<any[]>("smm_plan:posts");
    const updatedPosts = [...(existingPosts || []), newPost];
    await saveData("smm_plan:posts", updatedPosts);
    
    toast.success(`"${idea.title}" добавлена в контент-план`, { description: "Пост создан - настройте дату и площадки" });
    navigate("/smm/plan");
  };

  const filtered = ideas.filter((i) => {
    if (showStarred && !i.starred) return false;
    if (category !== "Все" && i.category !== category) return false;
    if (search) {
      const s = search.toLowerCase();
      return i.title.toLowerCase().includes(s) || i.description.toLowerCase().includes(s) || i.tags.some((t) => t.toLowerCase().includes(s));
    }
    return true;
  });

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) { toast.error("Опишите тему"); return; }
    setAiLoading(true); setAiResult("");
    try {
      const res = await aiGenerate("ideas", `Сгенерируй 10 идей для контента. Тематика: ${aiPrompt}`);
      if (res) { setAiResult(res.content); toast.success("Идеи сгенерированы"); }
    } catch (err: any) { toast.error(err?.name === "UsageLimitError" ? "Лимит исчерпан" : (err.message || "Ошибка")); }
    finally { setAiLoading(false); }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[1440px] mx-auto space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shrink-0">
              <Lightbulb className="w-4 h-4 text-white" />
            </div>
            Генерация контента
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1 hidden sm:block">Идеи, заметки, ссылки - всё в одном месте</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg text-[13px] hover:opacity-90 transition-opacity shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Новая идея</span>
          <span className="sm:hidden">Идея</span>
        </button>
      </div>

      {/* AI Generator */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-[13px] text-foreground font-medium">AI-генератор идей</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleAIGenerate(); }}
            placeholder="Тема: фитнес-студия, аудитория - женщины 25-35..."
            className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] placeholder:text-muted-foreground/50" />
          <button onClick={handleAIGenerate} disabled={aiLoading}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] hover:opacity-90 disabled:opacity-50 shrink-0">
            {aiLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Сгенерировать
          </button>
        </div>
        {aiResult && (
          <div className="mt-3 bg-muted/20 border border-border rounded-lg p-4 text-[13px] text-foreground/90 leading-relaxed max-h-[300px] overflow-y-auto">
            <MarkdownRenderer content={aiResult} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск идей..."
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-foreground text-[13px] placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-2.5 py-1.5 rounded-lg text-[12px] transition-colors whitespace-nowrap shrink-0 ${category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {c}
            </button>
          ))}
        </div>
        <button onClick={() => setShowStarred(!showStarred)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors shrink-0 ${showStarred ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}>
          <Star className="w-3.5 h-3.5" /> Избранное
        </button>
      </div>

      {/* Ideas Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title={ideas.length === 0 ? "Банк идей пуст" : "Ничего не найдено"}
          description={ideas.length === 0 ? "Добавьте первую идею контента или используйте AI для генерации идей" : "Попробуйте изменить поисковый запрос или фильтры"}
          emotion={ideas.length === 0 ? "idle" : "think"}
          action={ideas.length === 0 ? { label: "Добавить идею", onClick: () => setShowAdd(true), icon: <Plus className="w-4 h-4" /> } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((idea) => (
            <div key={idea.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-foreground text-[14px] truncate">{idea.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${STATUS_MAP[idea.status].color}`}>{STATUS_MAP[idea.status].label}</span>
                    <span className="text-[11px] text-muted-foreground">{idea.category}</span>
                  </div>
                </div>
                <button onClick={() => toggleStar(idea.id)} className="text-muted-foreground hover:text-amber-500 transition-colors shrink-0">
                  {idea.starred ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : <Star className="w-4 h-4" />}
                </button>
              </div>

              {idea.description && <p className="text-[12px] text-muted-foreground line-clamp-3 mb-3">{idea.description}</p>}

              {idea.links.length > 0 && (
                <div className="space-y-1 mb-3">
                  {idea.links.slice(0, 2).map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-primary hover:underline truncate">
                      <Link2 className="w-3 h-3 shrink-0" />{link}
                    </a>
                  ))}
                  {idea.links.length > 2 && <span className="text-[11px] text-muted-foreground">+{idea.links.length - 2} ещё</span>}
                </div>
              )}

              {idea.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {idea.tags.map((tag) => <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">#{tag}</span>)}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[11px] text-muted-foreground">
                  {new Date(idea.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <AddToProjectButton itemType="content_idea" itemId={idea.id} itemTitle={idea.title} />
                  <button onClick={() => sendToPlan(idea)} title="Отправить в контент-план"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <CalendarPlus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingIdea(idea)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteIdea(idea.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {(showAdd || editingIdea) && (
        <IdeaModal
          idea={editingIdea || { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: "", description: "", category: "Пост", links: [], tags: [], starred: false, status: "idea", createdAt: new Date().toISOString() }}
          isNew={showAdd && !editingIdea}
          onSave={(i) => { if (showAdd && !editingIdea) addIdea(i); else updateIdea(i); }}
          onClose={() => { setShowAdd(false); setEditingIdea(null); }}
        />
      )}
    </div>
  );
}

function IdeaModal({ idea, isNew, onSave, onClose }: { idea: ContentIdea; isNew: boolean; onSave: (i: ContentIdea) => void; onClose: () => void }) {
  const [form, setForm] = useState(idea);
  const [newLink, setNewLink] = useState("");
  const [newTag, setNewTag] = useState("");
  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const addLink = () => { if (newLink.trim()) { set("links", [...form.links, newLink.trim()]); setNewLink(""); } };
  const addTag = () => { if (newTag.trim() && !form.tags.includes(newTag.trim())) { set("tags", [...form.tags, newTag.trim()]); setNewTag(""); } };

  return (
    <ModalOverlay onClose={onClose} label={isNew ? "Новая идея" : "Редактировать идею"}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-foreground">{isNew ? "Новая идея" : "Редактировать"}</h3>
          <button onClick={onClose} aria-label="Закрыть" className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Название</label>
            <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Идея для поста..."
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">Категория</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]">
                {CATEGORIES.filter((c) => c !== "Все").map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">Статус</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]">
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Описание / Заметки</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} placeholder="Подробности..."
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none" />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Ссылки</label>
            {form.links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5 bg-muted/20 rounded-lg px-3 py-1.5">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-[12px] text-foreground truncate flex-1">{link}</span>
                <button onClick={() => set("links", form.links.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500"><X className="w-3 h-3" /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input type="text" value={newLink} onChange={(e) => setNewLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()} placeholder="https://..."
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-foreground text-[12px]" />
              <button onClick={addLink} className="px-3 py-1.5 bg-muted rounded-lg text-[12px] text-muted-foreground hover:text-foreground"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Теги</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {form.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-[11px] text-foreground">
                  #{tag}
                  <button onClick={() => set("tags", form.tags.filter((t) => t !== tag))} className="text-muted-foreground hover:text-red-500"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="Добавить тег..."
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-foreground text-[12px]" />
              <button onClick={addTag} className="px-3 py-1.5 bg-muted rounded-lg text-[12px] text-muted-foreground hover:text-foreground"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground">Отмена</button>
          <button onClick={() => onSave(form)} disabled={!form.title.trim()}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] hover:opacity-90 disabled:opacity-50">
            <Check className="w-4 h-4" /> {isNew ? "Добавить" : "Сохранить"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}