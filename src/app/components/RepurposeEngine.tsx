import { useState, useCallback, useMemo } from "react";
import {
  Recycle, Loader2, Copy, Check, ChevronDown, ChevronRight,
  Instagram, MessageCircle, Mail, Video, Zap, FileText, Twitter,
  Newspaper, BookOpen, Mic, Image, Smartphone, Sparkles, ArrowRight,
  GitBranch, LayoutList, X, FolderKanban,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { aiGenerate } from "../lib/api";
import { useKV } from "../lib/useKV";
import { AddToProjectButton } from "./AddToProjectModal";

/* ========== TYPES ========== */
interface OutputFormat {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
}

interface RepurposedItem {
  formatId: string;
  title: string;
  content: string;
  notes: string;
}

interface RepurposeSession {
  id: string;
  sourceTitle: string;
  sourceType: string;
  sourceExcerpt: string;
  outputs: RepurposedItem[];
  createdAt: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
  industry?: string;
}

/* ========== CONSTANTS ========== */
const SOURCE_TYPES = [
  { id: "blog", label: "Блог-пост / Статья", icon: Newspaper },
  { id: "video_script", label: "Видеоскрипт", icon: Video },
  { id: "podcast", label: "Подкаст / Транскрипт", icon: Mic },
  { id: "presentation", label: "Презентация", icon: FileText },
  { id: "case_study", label: "Кейс / Исследование", icon: BookOpen },
  { id: "newsletter", label: "Рассылка / Email", icon: Mail },
];

const OUTPUT_FORMATS: OutputFormat[] = [
  { id: "twitter_thread", name: "Twitter/X Тред", icon: Twitter, color: "text-sky-400", description: "5-10 твитов с хуками" },
  { id: "instagram_carousel", name: "Instagram Карусель", icon: Instagram, color: "text-amber-600", description: "8-10 слайдов с текстом" },
  { id: "telegram_post", name: "Telegram Пост", icon: MessageCircle, color: "text-sky-500", description: "Структурированный пост" },
  { id: "youtube_shorts", name: "YouTube Shorts Скрипт", icon: Video, color: "text-red-500", description: "60-секундный скрипт" },
  { id: "linkedin_article", name: "LinkedIn Статья", icon: Newspaper, color: "text-blue-600", description: "Профессиональный формат" },
  { id: "email_digest", name: "Email-дайджест", icon: Mail, color: "text-amber-500", description: "Тема + прехедер + тело" },
  { id: "stories_quotes", name: "Stories-цитаты", icon: Smartphone, color: "text-teal-600", description: "5-8 цитат для сторис" },
  { id: "ad_copy", name: "Рекламные тексты", icon: Zap, color: "text-orange-500", description: "3 варианта объявлений" },
  { id: "infographic", name: "Инфографика-текст", icon: Image, color: "text-emerald-500", description: "Структура для дизайнера" },
  { id: "podcast_outline", name: "Подкаст-аутлайн", icon: Mic, color: "text-teal-600", description: "План эпизода + тезисы" },
];

/* ========== COMPONENT ========== */
export function RepurposeEngine() {
  const [sourceText, setSourceText] = useState("");
  const [sourceType, setSourceType] = useState("blog");
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(
    new Set(["twitter_thread", "instagram_carousel", "telegram_post", "stories_quotes"])
  );
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<RepurposedItem[]>([]);
  const [activeFormat, setActiveFormat] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTree, setShowTree] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const { data: history, save: saveHistory } = useKV<RepurposeSession[]>("repurpose:history", []);
  const { data: projectsList } = useKV<ProjectInfo[]>("projects:list", []);

  const toggleFormat = (id: string) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = useCallback(async () => {
    if (!sourceText.trim() || sourceText.trim().length < 50) {
      toast.error("Введите исходный текст (минимум 50 символов)");
      return;
    }
    if (selectedFormats.size === 0) {
      toast.error("Выберите хотя бы один формат");
      return;
    }

    setGenerating(true);
    setResults([]);
    try {
      const formatNames = OUTPUT_FORMATS
        .filter((f) => selectedFormats.has(f.id))
        .map((f) => `${f.name} (${f.description})`);

      const sourceLabel = SOURCE_TYPES.find(s => s.id === sourceType)?.label || sourceType;

      const prompt = `Ты - Content Repurpose Engine. Твоя задача: взять один исходный контент и адаптировать его в несколько разных форматов, сохраняя ключевые идеи но полностью переформатируя подачу.

Тип исходника: ${sourceLabel}

Исходный контент:
"""
${sourceText.slice(0, 4000)}
"""

Создай контент для каждого из этих форматов:
${formatNames.map((f, i) => `${i + 1}. ${f}`).join("\n")}

ВАЖНО:
- Не копируй текст дословно, а переосмысливай для каждого формата
- Для Twitter-треда: начни с сильного хука, нумерованные твиты
- Для Instagram-карусели: пиши текст для каждого слайда отдельно [Слайд 1], [Слайд 2]...
- Для YouTube Shorts: таймкоды + что говорить
- Для Stories-цитат: короткие яркие фразы для визуальных карточек
- Для инфографики: структурированные блоки данных
- Адаптируй длину и стиль под каждый формат
- НЕ используй markdown (**, ##, и т.д.) - чистый текст
- Пиши на русском

Формат ответа для КАЖДОГО:
### [Название формата]
**Заголовок:** (краткий заголовок для этого формата)
**Контент:** (полный адаптированный контент)
**Заметки:** (1-2 рекомендации для публикации)`;

      const result = await aiGenerate("repurpose-engine", prompt);
      if (!result?.content) throw new Error("Пустой ответ AI");

      const parsed: RepurposedItem[] = [];
      const sections = result.content.split(/###\s+/);

      for (const section of sections) {
        if (!section.trim()) continue;
        const format = OUTPUT_FORMATS.find((f) =>
          section.toLowerCase().includes(f.name.toLowerCase()) ||
          section.toLowerCase().includes(f.id.replace(/_/g, " "))
        );
        if (!format || !selectedFormats.has(format.id)) continue;

        const titleMatch = section.match(/\*\*Заголовок:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Контент:|$)/i);
        const contentMatch = section.match(/\*\*Контент:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Заметки:|$)/i);
        const notesMatch = section.match(/\*\*Заметки:\*\*\s*([\s\S]*?)(?=\n\s*###|$)/i);

        parsed.push({
          formatId: format.id,
          title: cleanMd(titleMatch?.[1]?.trim() || format.name),
          content: cleanMd(contentMatch?.[1]?.trim() || section.trim()),
          notes: cleanMd(notesMatch?.[1]?.trim() || ""),
        });
      }

      if (parsed.length === 0) {
        parsed.push({
          formatId: Array.from(selectedFormats)[0],
          title: "Контент",
          content: cleanMd(result.content),
          notes: "",
        });
      }

      setResults(parsed);
      setActiveFormat(parsed[0]?.formatId || null);
      toast.success(`Контент адаптирован в ${parsed.length} форматов`);

      // Save to history
      const session: RepurposeSession = {
        id: Date.now().toString(),
        sourceTitle: sourceText.slice(0, 60).trim() + (sourceText.length > 60 ? "..." : ""),
        sourceType,
        sourceExcerpt: sourceText.slice(0, 200),
        outputs: parsed,
        createdAt: new Date().toISOString(),
      };
      await saveHistory([session, ...(history || []).slice(0, 19)]);
    } catch (err: any) {
      console.error("Repurpose error:", err);
      if (err?.name === "UsageLimitError") {
        toast.error(err.message || "Лимит AI-генераций исчерпан. Обновите план.");
      } else {
        toast.error("Ошибка генерации");
      }
    } finally {
      setGenerating(false);
    }
  }, [sourceText, sourceType, selectedFormats, history, saveHistory]);

  const copyText = useCallback((id: string, text: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Скопировано");
  }, []);

  const loadFromHistory = (session: RepurposeSession) => {
    setSourceText(session.sourceExcerpt);
    setSourceType(session.sourceType);
    setResults(session.outputs);
    setActiveFormat(session.outputs[0]?.formatId || null);
    setShowHistory(false);
    toast.info("Сессия загружена");
  };

  const activeResult = results.find((r) => r.formatId === activeFormat);
  const activeFormatConfig = OUTPUT_FORMATS.find((f) => f.id === activeFormat);

  return (
    <div className="p-6 space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground flex items-center gap-2.5">
            <Recycle className="w-6 h-6 text-[#d4a373]" />
            Content Repurpose Engine
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            Один контент - десять форматов. Введите текст и получите готовый контент-план на неделю
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1.5 text-[12px] border border-border rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
          >
            История ({history.length})
          </button>
          <AddToProjectButton itemType="content-studio" itemId="repurpose" itemTitle="Repurpose Engine" />
        </div>
      </div>

      {/* History panel */}
      {showHistory && history.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h3 className="text-[13px] font-semibold text-foreground mb-2">Последние сессии</h3>
          {history.slice(0, 5).map((s) => (
            <button
              key={s.id}
              onClick={() => loadFromHistory(s)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left"
            >
              <Recycle className="w-4 h-4 text-[#d4a373] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-foreground truncate">{s.sourceTitle}</p>
                <p className="text-[10px] text-muted-foreground">
                  {s.outputs.length} форматов - {new Date(s.createdAt).toLocaleDateString("ru")}
                </p>
              </div>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Source input */}
        <div className="lg:col-span-2 space-y-4">
          {/* Source type */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#d4a373]" />
              Тип исходника
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {SOURCE_TYPES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSourceType(s.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] transition-all ${
                    sourceType === s.id
                      ? "border-[#d4a373]/40 bg-[#d4a373]/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  <s.icon className="w-3.5 h-3.5" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source text */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-foreground">Исходный контент</h3>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Вставьте текст статьи, скрипт видео, транскрипт подкаста или любой другой контент, который нужно адаптировать..."
              rows={10}
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 text-[13px] text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground">{sourceText.length} симв. (мин. 50)</p>
          </div>

          {/* Output formats */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground">Форматы на выходе</h3>
              <span className="text-[11px] text-muted-foreground">{selectedFormats.size} выбрано</span>
            </div>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {OUTPUT_FORMATS.map((f) => {
                const active = selectedFormats.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFormat(f.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left ${
                      active ? "border-[#d4a373]/30 bg-[#d4a373]/5" : "border-border hover:bg-muted/30"
                    }`}
                  >
                    <f.icon className={`w-4 h-4 ${active ? f.color : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <span className={`text-[12px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {f.name}
                      </span>
                      <p className="text-[10px] text-muted-foreground">{f.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                      active ? "bg-[#d4a373] border-[#d4a373]" : "border-border"
                    }`}>
                      {active && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={generating || sourceText.trim().length < 50}
            className="w-full py-3 bg-[#d4a373] hover:bg-[#c0854a] text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Адаптация в {selectedFormats.size} форматов...</>
            ) : (
              <><Recycle className="w-4 h-4" />Repurpose контент</>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-3 space-y-4">
          {results.length === 0 && !generating ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center">
              <GitBranch className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-[14px] font-medium text-muted-foreground">Дерево контента появится здесь</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">Вставьте текст и выберите форматы</p>
            </div>
          ) : generating ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-[#d4a373] animate-spin mb-3" />
              <p className="text-[14px] font-medium text-foreground">Адаптируем контент...</p>
              <p className="text-[12px] text-muted-foreground mt-1">Создаем {selectedFormats.size} уникальных версий</p>
            </div>
          ) : (
            <>
              {/* Visual tree */}
              {showTree && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-[#d4a373]" />
                      Дерево контента
                    </h3>
                    <button onClick={() => setShowTree(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-start gap-3">
                    {/* Source node */}
                    <div className="bg-[#d4a373]/10 border border-[#d4a373]/30 rounded-lg p-2.5 min-w-[140px] shrink-0">
                      <p className="text-[10px] text-[#d4a373] font-medium uppercase tracking-wider">Исходник</p>
                      <p className="text-[11px] text-foreground font-medium mt-1 line-clamp-2">
                        {sourceText.slice(0, 50)}...
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-1">
                        {SOURCE_TYPES.find(s => s.id === sourceType)?.label}
                      </p>
                    </div>
                    {/* Arrow */}
                    <div className="flex flex-col items-center justify-center pt-4">
                      <ArrowRight className="w-5 h-5 text-[#d4a373]" />
                    </div>
                    {/* Output nodes */}
                    <div className="flex flex-wrap gap-2 flex-1">
                      {results.map((r) => {
                        const fmt = OUTPUT_FORMATS.find(f => f.id === r.formatId);
                        if (!fmt) return null;
                        const Icon = fmt.icon;
                        return (
                          <button
                            key={r.formatId}
                            onClick={() => setActiveFormat(r.formatId)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-all ${
                              activeFormat === r.formatId
                                ? "border-[#d4a373]/40 bg-[#d4a373]/10 text-foreground shadow-sm"
                                : "border-border text-muted-foreground hover:bg-muted/30"
                            }`}
                          >
                            <Icon className={`w-3 h-3 ${fmt.color}`} />
                            {fmt.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Format tabs */}
              <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
                {results.map((r) => {
                  const fmt = OUTPUT_FORMATS.find(f => f.id === r.formatId);
                  if (!fmt) return null;
                  const Icon = fmt.icon;
                  const isActive = activeFormat === r.formatId;
                  return (
                    <button
                      key={r.formatId}
                      onClick={() => setActiveFormat(r.formatId)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                        isActive ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? fmt.color : ""}`} />
                      {fmt.name}
                    </button>
                  );
                })}
              </div>

              {/* Content card */}
              {activeResult && activeFormatConfig && (
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <activeFormatConfig.icon className={`w-5 h-5 ${activeFormatConfig.color}`} />
                      <div>
                        <h3 className="text-[15px] font-semibold text-foreground">{activeResult.title}</h3>
                        <p className="text-[11px] text-muted-foreground">{activeFormatConfig.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyText(activeResult.formatId, activeResult.content)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] border border-border rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
                    >
                      {copiedId === activeResult.formatId
                        ? <><Check className="w-3 h-3 text-emerald-500" /> Скопировано</>
                        : <><Copy className="w-3 h-3" /> Копировать</>
                      }
                    </button>
                  </div>

                  <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed bg-muted/20 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                    {activeResult.content}
                  </div>

                  {activeResult.notes && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                      <p className="text-[11px] text-amber-600 font-medium mb-1">Рекомендации:</p>
                      <p className="text-[11px] text-muted-foreground">{activeResult.notes}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-[11px] text-muted-foreground">{activeResult.content.length} симв.</span>
                    <AddToProjectButton itemType="content-studio" itemId={`repurpose-${activeResult.formatId}`} itemTitle={`Repurpose: ${activeFormatConfig.name}`} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function cleanMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}