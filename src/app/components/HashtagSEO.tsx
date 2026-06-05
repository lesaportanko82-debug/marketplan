import { useState, useCallback } from "react";
import {
  Hash, Search, TrendingUp, Copy, Star, Plus, X, Loader2, Trash2,
  Sparkles, Globe, Instagram, BarChart3, Target, RefreshCw,
  CheckCircle2, ArrowUpRight, Tag, Zap, Filter, Download,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { aiGenerate } from "../lib/api";
import { useKV } from "../lib/useKV";
import { AddToProjectButton } from "./AddToProjectModal";
import { EmptyState } from "./EmptyState";

interface HashtagSet {
  id: string;
  name: string;
  hashtags: string[];
  platform: string;
  category: string;
  reach: string;
  starred: boolean;
  createdAt: string;
}

interface KeywordEntry {
  id: string;
  keyword: string;
  volume: string;
  difficulty: string;
  intent: string;
  suggestions: string[];
  createdAt: string;
}

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "VK", "Twitter/X", "LinkedIn"];
const CATEGORIES = ["Все", "Бренд", "Продукт", "Отрасль", "Тренд", "Локальный", "Нишевой"];
const REACH_LEVELS = [
  { label: "Высокий (100K+)", value: "high", color: "bg-emerald-500/10 text-emerald-600" },
  { label: "Средний (10K-100K)", value: "medium", color: "bg-amber-500/10 text-amber-600" },
  { label: "Нишевой (<10K)", value: "niche", color: "bg-teal-500/10 text-teal-600" },
];

const STORAGE_KEY = "smm:hashtags";
const KEYWORDS_KEY = "smm:keywords";

export function HashtagSEO() {
  const { data: hashtagSets, save: saveHashtagSets } = useKV<HashtagSet[]>(STORAGE_KEY, []);
  const { data: keywords, save: saveKeywords } = useKV<KeywordEntry[]>(KEYWORDS_KEY, []);
  const [tab, setTab] = useState<"hashtags" | "keywords" | "trends">("hashtags");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Все");
  const [showAddSet, setShowAddSet] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState<string[]>([]);
  const [keywordPrompt, setKeywordPrompt] = useState("");
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [trendNiche, setTrendNiche] = useState("");
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendResult, setTrendResult] = useState("");

  // AI Hashtag Research
  const handleAIHashtags = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const result = await aiGenerate("hashtag_research", 
        `Ты - SMM-эксперт. Сгенерируй 30 релевантных хештегов для темы: "${aiPrompt}".
        
        Раздели на 3 группы:
        1. **Высокий охват** (популярные, >100K постов) - 10 штук
        2. **Средний охват** (10K-100K постов) - 10 штук  
        3. **Нишевые** (<10K постов, но точно целевые) - 10 штук
        
        Формат: верни ТОЛЬКО хештеги через запятую, без нумерации и пояснений. Каждая группа на новой строке с заголовком.`
      );
      if (result?.content) {
        const tags = result.content
          .split(/[,\n]/)
          .map((t: string) => t.trim())
          .filter((t: string) => t.startsWith("#"));
        setAiResult(tags);
        toast.success(`Найдено ${tags.length} хештегов`);
      }
    } catch (err: any) {
      toast.error(err?.name === "UsageLimitError" ? "Лимит исчерпан" : "Ошибка AI", { description: err.message });
    } finally {
      setAiLoading(false);
    }
  };

  // AI Keyword Research
  const handleKeywordResearch = async () => {
    if (!keywordPrompt.trim()) return;
    setKeywordLoading(true);
    try {
      const result = await aiGenerate("keyword_research",
        `Ты - SEO-эксперт. Для ниши/продукта: "${keywordPrompt}" проведи исследование ключевых слов.
        
        Верни 15 ключевых слов в формате JSON массива:
        [{"keyword":"...", "volume":"высокий/средний/низкий", "difficulty":"низкая/средняя/высокая", "intent":"информационный/транзакционный/навигационный", "suggestions":["связанное1","связанное2"]}]
        
        Только JSON, без markdown-обёртки.`
      );
      if (result?.content) {
        const match = result.content.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const entries: KeywordEntry[] = parsed.map((k: any) => ({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            ...k,
            createdAt: new Date().toISOString(),
          }));
          saveKeywords([...entries, ...keywords]);
          toast.success(`${entries.length} ключевых слов добавлено`);
        }
      }
    } catch (err: any) {
      toast.error(err?.name === "UsageLimitError" ? "Лимит исчерпан" : "Ошибка AI", { description: err.message });
    } finally {
      setKeywordLoading(false);
    }
  };

  // AI Trend Analysis
  const handleTrendAnalysis = async () => {
    if (!trendNiche.trim()) return;
    setTrendLoading(true);
    try {
      const result = await aiGenerate("trend_analysis",
        `Ты - аналитик трендов в digital-маркетинге. Для ниши "${trendNiche}" дай анализ текущих трендов (март 2026):
        
        1. **Актуальные тренды** - 5 трендов с описанием и рекомендациями
        2. **Растущие форматы контента** - какие форматы набирают популярность
        3. **Сезонные возможности** - что актуально в Q1-Q2 2026
        4. **Хештег-тренды** - 10 трендовых хештегов для этой ниши
        5. **Рекомендации по контент-стратегии** - 3 конкретных шага
        
        Формат: markdown с заголовками и списками.`
      );
      if (result?.content) {
        setTrendResult(result.content);
        toast.success("Анализ трендов готов");
      }
    } catch (err: any) {
      toast.error(err?.name === "UsageLimitError" ? "Лимит исчерпан" : "Ошибка AI", { description: err.message });
    } finally {
      setTrendLoading(false);
    }
  };

  // Save AI results as a set
  const saveAIAsSet = (name: string, tags: string[], platform: string) => {
    const newSet: HashtagSet = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      hashtags: tags,
      platform,
      category: "Тренд",
      reach: "medium",
      starred: false,
      createdAt: new Date().toISOString(),
    };
    saveHashtagSets([newSet, ...hashtagSets]);
    toast.success("Набор сохранён");
    setAiResult([]);
  };

  const copyTags = (tags: string[]) => {
    copyToClipboard(tags.join(" "));
    toast.success("Хештеги скопированы");
  };

  const toggleStar = (id: string) => {
    saveHashtagSets(hashtagSets.map((s) => (s.id === id ? { ...s, starred: !s.starred } : s)));
  };

  const deleteSet = (id: string) => {
    saveHashtagSets(hashtagSets.filter((s) => s.id !== id));
    toast.success("Набор удалён");
  };

  const deleteKeyword = (id: string) => {
    saveKeywords(keywords.filter((k) => k.id !== id));
  };

  const filteredSets = hashtagSets.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.hashtags.some((h) => h.toLowerCase().includes(search.toLowerCase()));
    const matchCat = categoryFilter === "Все" || s.category === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="p-4 md:p-5 max-w-[1440px] mx-auto space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-2.5">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#c0854a] flex items-center justify-center shrink-0">
              <Hash className="w-4 h-4 text-white" />
            </div>
            Хештеги и SEO
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            AI-исследование хештегов, ключевых слов и трендов
          </p>
        </div>
        <AddToProjectButton
          itemType="hashtag_seo"
          itemId="hashtag-seo-module"
          itemTitle="Хештеги и SEO"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto scrollbar-none">
        {[
          { key: "hashtags", label: "Хештеги", icon: Hash },
          { key: "keywords", label: "Ключевые слова", icon: Search },
          { key: "trends", label: "Тренды", icon: TrendingUp },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium transition-colors ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ===== HASHTAGS TAB ===== */}
      {tab === "hashtags" && (
        <div className="space-y-4">
          {/* AI Research */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#d4a373]" />
              <h3 className="text-[14px] font-semibold text-foreground">AI-подбор хештегов</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Введите тему, нишу или описание поста..."
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px] placeholder:text-muted-foreground"
                onKeyDown={(e) => e.key === "Enter" && handleAIHashtags()}
              />
              <button
                onClick={handleAIHashtags}
                disabled={aiLoading || !aiPrompt.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 transition-colors"
                style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Найти
              </button>
            </div>

            {/* AI Results */}
            {aiResult.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">{aiResult.length} хештегов найдено</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyTags(aiResult)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-muted rounded-md text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Копировать все
                    </button>
                    <button
                      onClick={() => saveAIAsSet(aiPrompt, aiResult, "Instagram")}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#d4a373]/10 text-[#d4a373] rounded-md text-[11px] font-medium hover:bg-[#d4a373]/20 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Сохранить набор
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {aiResult.map((tag, i) => (
                    <span
                      key={i}
                      onClick={() => { copyToClipboard(tag); toast.success(`${tag} скопирован`); }}
                      className="px-2 py-1 bg-[#d4a373]/8 text-[#d4a373] border border-[#d4a373]/15 rounded-md text-[11px] cursor-pointer hover:bg-[#d4a373]/15 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск хештегов..."
                className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-foreground text-[13px]"
              />
            </div>
            <div className="flex gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] transition-colors ${
                    categoryFilter === c
                      ? "bg-[#d4a373]/10 text-[#d4a373] font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Hashtag Sets */}
          {filteredSets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSets.map((set) => (
                <div key={set.id} className="bg-card border border-border rounded-xl p-4 space-y-3 group">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[13px] font-medium text-foreground truncate">{set.name}</h4>
                        <button onClick={() => toggleStar(set.id)}>
                          <Star className={`w-3.5 h-3.5 ${set.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px]">{set.platform}</span>
                        <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px]">{set.category}</span>
                        <span className="text-[10px] text-muted-foreground">{set.hashtags.length} тегов</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => copyTags(set.hashtags)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button onClick={() => deleteSet(set.id)} className="p-1 rounded hover:bg-red-500/10 text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {set.hashtags.slice(0, 12).map((tag, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px]">{tag}</span>
                    ))}
                    {set.hashtags.length > 12 && (
                      <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">+{set.hashtags.length - 12}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Hash className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-[14px]">Нет сохранённых наборов</p>
              <p className="text-[12px] mt-1">Используйте AI для подбора хештегов</p>
            </div>
          )}
        </div>
      )}

      {/* ===== KEYWORDS TAB ===== */}
      {tab === "keywords" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#d4a373]" />
              <h3 className="text-[14px] font-semibold text-foreground">AI-исследование ключевых слов</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywordPrompt}
                onChange={(e) => setKeywordPrompt(e.target.value)}
                placeholder="Ваша ниша, продукт или услуга..."
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px] placeholder:text-muted-foreground"
                onKeyDown={(e) => e.key === "Enter" && handleKeywordResearch()}
              />
              <button
                onClick={handleKeywordResearch}
                disabled={keywordLoading || !keywordPrompt.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
              >
                {keywordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Исследовать
              </button>
            </div>
          </div>

          {keywords.length > 0 ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_100px_120px_auto] gap-4 px-5 py-3 border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground">
                <span>Ключевое слово</span>
                <span>Объём</span>
                <span>Сложность</span>
                <span>Интент</span>
                <span></span>
              </div>
              {keywords.slice(0, 30).map((kw) => (
                <div key={kw.id} className="grid grid-cols-[1fr_100px_100px_120px_auto] gap-4 px-5 py-3 border-b border-border last:border-0 items-center text-[12px] group">
                  <div>
                    <p className="text-foreground font-medium">{kw.keyword}</p>
                    {kw.suggestions?.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {kw.suggestions.slice(0, 3).map((s, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[9px]">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] w-fit ${
                    kw.volume === "высокий" ? "bg-emerald-500/10 text-emerald-600" :
                    kw.volume === "средний" ? "bg-amber-500/10 text-amber-600" :
                    "bg-muted text-muted-foreground"
                  }`}>{kw.volume}</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] w-fit ${
                    kw.difficulty === "низкая" ? "bg-emerald-500/10 text-emerald-600" :
                    kw.difficulty === "средняя" ? "bg-amber-500/10 text-amber-600" :
                    "bg-red-500/10 text-red-500"
                  }`}>{kw.difficulty}</span>
                  <span className="text-muted-foreground">{kw.intent}</span>
                  <button onClick={() => deleteKeyword(kw.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-500 transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-[14px]">Нет ключевых слов</p>
              <p className="text-[12px] mt-1">Введите нишу для AI-исследования</p>
            </div>
          )}
        </div>
      )}

      {/* ===== TRENDS TAB ===== */}
      {tab === "trends" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#d4a373]" />
              <h3 className="text-[14px] font-semibold text-foreground">AI-анализ трендов</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={trendNiche}
                onChange={(e) => setTrendNiche(e.target.value)}
                placeholder="Ниша или индустрия для анализа трендов..."
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px] placeholder:text-muted-foreground"
                onKeyDown={(e) => e.key === "Enter" && handleTrendAnalysis()}
              />
              <button
                onClick={handleTrendAnalysis}
                disabled={trendLoading || !trendNiche.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
              >
                {trendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                Анализ
              </button>
            </div>
          </div>

          {trendResult && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="prose prose-sm max-w-none text-[13px] text-foreground leading-relaxed">
                {trendResult.split("\n").map((line, i) => {
                  if (line.startsWith("# ")) return <h2 key={i} className="text-[16px] font-bold mt-4 mb-2">{line.slice(2)}</h2>;
                  if (line.startsWith("## ")) return <h3 key={i} className="text-[14px] font-semibold mt-3 mb-1.5">{line.slice(3)}</h3>;
                  if (line.startsWith("**") && line.endsWith("**")) return <h3 key={i} className="text-[14px] font-semibold mt-3 mb-1.5">{line.replace(/\*\*/g, "")}</h3>;
                  if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 text-foreground">{line.slice(2)}</li>;
                  if (line.match(/^\d+\./)) return <li key={i} className="ml-4 text-foreground list-decimal">{line.replace(/^\d+\.\s*/, "")}</li>;
                  if (line.startsWith("#")) {
                    return <span key={i} className="inline-block px-1.5 py-0.5 bg-[#d4a373]/10 text-[#d4a373] rounded text-[11px] mr-1 mb-1">{line.trim()}</span>;
                  }
                  if (line.trim()) return <p key={i} className="text-muted-foreground mb-1">{line}</p>;
                  return <br key={i} />;
                })}
              </div>
            </div>
          )}

          {!trendResult && (
            <div className="text-center py-16 text-muted-foreground">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-[14px]">Введите нишу для анализа трендов</p>
              <p className="text-[12px] mt-1">AI покажет актуальные тренды, форматы и рекомендации</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}