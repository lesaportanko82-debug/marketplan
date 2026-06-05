import { useState, useCallback } from "react";
import {
  Battery, BatteryLow, BatteryWarning, BatteryFull, Loader2,
  Sparkles, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp,
  RefreshCw, MessageSquare, Image, Hash, Zap, BarChart3,
  Eye, Repeat, FileText, ArrowRight, Lightbulb, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { aiGenerate } from "../lib/api";
import { useKV } from "../lib/useKV";
import { AddToProjectButton } from "./AddToProjectModal";

/* ========== TYPES ========== */
interface FatigueCategory {
  id: string;
  name: string;
  icon: any;
  color: string;
  level: "low" | "medium" | "high" | "critical";
  score: number;
  findings: string[];
  recommendation: string;
}

interface FatigueReport {
  id: string;
  overallFatigue: number;
  overallLevel: "low" | "medium" | "high" | "critical";
  categories: FatigueCategory[];
  freshTopics: string[];
  contentCalendarSuggestion: string;
  createdAt: string;
}

/* ========== HELPERS ========== */
function getLevelInfo(level: string) {
  switch (level) {
    case "low": return { label: "Низкая", color: "text-emerald-500", bg: "bg-emerald-500", icon: BatteryFull };
    case "medium": return { label: "Средняя", color: "text-amber-500", bg: "bg-amber-500", icon: BatteryWarning };
    case "high": return { label: "Высокая", color: "text-orange-500", bg: "bg-orange-500", icon: BatteryLow };
    case "critical": return { label: "Критическая", color: "text-red-500", bg: "bg-red-500", icon: Battery };
    default: return { label: "Н/Д", color: "text-gray-500", bg: "bg-gray-500", icon: Battery };
  }
}

/* ========== COMPONENT ========== */
export function FatigueDetector() {
  const [contentInput, setContentInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<FatigueReport | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: reports, save: saveReports } = useKV<FatigueReport[]>("fatigue:reports", []);
  const { data: smmPosts } = useKV<any[]>("smm_plan:posts", []); // aligned with SmmPlan & MarketingCalendar
  const { data: contentIdeas } = useKV<any[]>("smm:content_ideas", []); // aligned with SmmPlan IDEAS_KEY

  // Auto-collect content from existing modules
  const collectExistingContent = useCallback(() => {
    const parts: string[] = [];
    if (smmPosts?.length) {
      parts.push("=== ПОСТЫ ИЗ КОНТЕНТ-ПЛАНА ===");
      smmPosts.slice(0, 30).forEach((p: any) => {
        // Support both old (platform string) and new (platforms array) field names
        const platformLabel = Array.isArray(p.platforms)
          ? p.platforms.join(", ")
          : (p.platform || "?");
        const textContent = p.topic || p.caption || p.text || p.title || p.content || "";
        parts.push(`[${platformLabel}] ${textContent}`);
      });
    }
    if (contentIdeas?.length) {
      parts.push("\n=== ИДЕИ ===");
      contentIdeas.slice(0, 20).forEach((i: any) => {
        parts.push(i.title || i.text || i.content || "");
      });
    }
    if (parts.length === 0) {
      toast.info("Нет контента в SMM-планере. Вставьте тексты вручную.");
      return;
    }
    setContentInput(parts.join("\n"));
    toast.success(`Собрано ${(smmPosts?.length || 0) + (contentIdeas?.length || 0)} единиц контента`);
  }, [smmPosts, contentIdeas]);

  const handleAnalyze = useCallback(async () => {
    if (!contentInput.trim() || contentInput.trim().length < 100) {
      toast.error("Добавьте больше контента для анализа (мин. 100 символов)");
      return;
    }

    setAnalyzing(true);
    setReport(null);

    try {
      const prompt = `Ты - Marketing Fatigue Detector. Проанализируй массив опубликованного контента бренда и найди признаки "усталости аудитории" - повторяющиеся паттерны, заезженные приёмы, однообразие.

Контент для анализа:
"""
${contentInput.slice(0, 5000)}
"""

Оцени усталость по 6 категориям (каждая 0-100, где 100 = максимальная усталость):

1. CTA_FATIGUE - одинаковые призывы к действию, повторяющиеся CTA
2. TOPIC_FATIGUE - одни и те же темы, нет разнообразия тематик
3. FORMAT_FATIGUE - однотипные форматы (только тексты, только карусели и т.д.)
4. HOOK_FATIGUE - одинаковые заходы/хуки в начале постов
5. VISUAL_FATIGUE - однотипные визуальные решения (если можно оценить по тексту)
6. TONE_FATIGUE - однообразный тон, нет эмоциональных перепадов

Формат ответа (строго):

**OVERALL_FATIGUE:** [число 0-100]
**OVERALL_LEVEL:** [low/medium/high/critical]

**CTA_FATIGUE_SCORE:** [0-100]
**CTA_FATIGUE_LEVEL:** [low/medium/high/critical]
**CTA_FATIGUE_FINDING_1:** [конкретный пример повторения]
**CTA_FATIGUE_FINDING_2:** [ещё пример]
**CTA_FATIGUE_FINDING_3:** [ещё пример]
**CTA_FATIGUE_REC:** [рекомендация по исправлению]

**TOPIC_FATIGUE_SCORE:** [0-100]
**TOPIC_FATIGUE_LEVEL:** [low/medium/high/critical]
**TOPIC_FATIGUE_FINDING_1:** [пример]
**TOPIC_FATIGUE_FINDING_2:** [пример]
**TOPIC_FATIGUE_FINDING_3:** [пример]
**TOPIC_FATIGUE_REC:** [рекомендация]

**FORMAT_FATIGUE_SCORE:** [0-100]
**FORMAT_FATIGUE_LEVEL:** [low/medium/high/critical]
**FORMAT_FATIGUE_FINDING_1:** [пример]
**FORMAT_FATIGUE_FINDING_2:** [пример]
**FORMAT_FATIGUE_FINDING_3:** [пример]
**FORMAT_FATIGUE_REC:** [рекомендация]

**HOOK_FATIGUE_SCORE:** [0-100]
**HOOK_FATIGUE_LEVEL:** [low/medium/high/critical]
**HOOK_FATIGUE_FINDING_1:** [пример]
**HOOK_FATIGUE_FINDING_2:** [пример]
**HOOK_FATIGUE_FINDING_3:** [пример]
**HOOK_FATIGUE_REC:** [рекомендация]

**VISUAL_FATIGUE_SCORE:** [0-100]
**VISUAL_FATIGUE_LEVEL:** [low/medium/high/critical]
**VISUAL_FATIGUE_FINDING_1:** [пример]
**VISUAL_FATIGUE_FINDING_2:** [пример]
**VISUAL_FATIGUE_FINDING_3:** [пример]
**VISUAL_FATIGUE_REC:** [рекомендация]

**TONE_FATIGUE_SCORE:** [0-100]
**TONE_FATIGUE_LEVEL:** [low/medium/high/critical]
**TONE_FATIGUE_FINDING_1:** [пример]
**TONE_FATIGUE_FINDING_2:** [пример]
**TONE_FATIGUE_FINDING_3:** [пример]
**TONE_FATIGUE_REC:** [рекомендация]

**FRESH_TOPIC_1:** [тема, о которой давно не писали или вообще не писали]
**FRESH_TOPIC_2:** [тема]
**FRESH_TOPIC_3:** [тема]
**FRESH_TOPIC_4:** [тема]
**FRESH_TOPIC_5:** [тема]

**CALENDAR_SUGGESTION:** [рекомендация по контент-плану на ближайшую неделю: что менять, какие форматы чередовать, какие темы поднять]

Будь честен и конкретен. Пиши на русском. Без markdown в содержимом.`;

      const result = await aiGenerate("fatigue-detector", prompt);
      if (!result?.content) throw new Error("Пустой ответ");

      const raw = result.content;
      const get = (key: string) => {
        const m = raw.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, "i"));
        return cleanMd(m?.[1]?.trim() || "");
      };

      const CATS = [
        { key: "CTA_FATIGUE", id: "cta", name: "CTA-усталость", icon: Zap, color: "text-amber-500" },
        { key: "TOPIC_FATIGUE", id: "topic", name: "Тематическая усталость", icon: FileText, color: "text-teal-500" },
        { key: "FORMAT_FATIGUE", id: "format", name: "Формат-усталость", icon: BarChart3, color: "text-teal-600" },
        { key: "HOOK_FATIGUE", id: "hook", name: "Хуки-усталость", icon: Eye, color: "text-amber-600" },
        { key: "VISUAL_FATIGUE", id: "visual", name: "Визуальная усталость", icon: Image, color: "text-emerald-500" },
        { key: "TONE_FATIGUE", id: "tone", name: "Тональная усталость", icon: MessageSquare, color: "text-orange-500" },
      ];

      const categories: FatigueCategory[] = CATS.map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        score: Math.min(100, Math.max(0, parseInt(get(`${c.key}_SCORE`) || "50"))),
        level: (get(`${c.key}_LEVEL`) || "medium") as any,
        findings: [get(`${c.key}_FINDING_1`), get(`${c.key}_FINDING_2`), get(`${c.key}_FINDING_3`)].filter(Boolean),
        recommendation: get(`${c.key}_REC`),
      }));

      const freshTopics = [1, 2, 3, 4, 5].map(i => get(`FRESH_TOPIC_${i}`)).filter(Boolean);

      const fatigueReport: FatigueReport = {
        id: Date.now().toString(),
        overallFatigue: Math.min(100, Math.max(0, parseInt(get("OVERALL_FATIGUE") || "50"))),
        overallLevel: (get("OVERALL_LEVEL") || "medium") as any,
        categories,
        freshTopics,
        contentCalendarSuggestion: get("CALENDAR_SUGGESTION"),
        createdAt: new Date().toISOString(),
      };

      setReport(fatigueReport);
      setSelectedCategory(categories[0]?.id || null);
      toast.success("Анализ усталости завершен");

      await saveReports([fatigueReport, ...(reports || []).slice(0, 9)]);
    } catch (err: any) {
      console.error("Fatigue analysis error:", err);
      toast.error(err?.name === "UsageLimitError" ? (err.message || "Лимит исчерпан") : "Ошибка анализа");
    } finally {
      setAnalyzing(false);
    }
  }, [contentInput, reports, saveReports]);

  const activeCat = report?.categories.find(c => c.id === selectedCategory);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-2.5">
            <BatteryLow className="w-5 h-5 text-[#d4a373] shrink-0" />
            Marketing Fatigue Detector
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1 hidden sm:block">
            Находит повторяющиеся паттерны и рекомендует свежие темы
          </p>
        </div>
        <AddToProjectButton itemType="content-studio" itemId="fatigue" itemTitle="Fatigue Detector" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
        {/* Left */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground">Контент для анализа</h3>
              <button
                onClick={collectExistingContent}
                className="text-[11px] text-[#d4a373] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />Собрать из SMM-планера
              </button>
            </div>
            <textarea
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              placeholder="Вставьте тексты опубликованных постов (каждый с новой строки), или нажмите 'Собрать из SMM-планера'..."
              rows={12}
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 text-[12px] text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground">{contentInput.length} симв.</p>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={analyzing || contentInput.trim().length < 100}
            className="w-full py-3 bg-[#d4a373] hover:bg-[#c0854a] text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {analyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Анализируем усталость...</>
            ) : (
              <><Sparkles className="w-4 h-4" />Запустить диагностику</>
            )}
          </button>
        </div>

        {/* Right */}
        <div className="lg:col-span-3 space-y-4">
          {!report && !analyzing ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center">
              <Battery className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-[14px] font-medium text-muted-foreground">Карта усталости появится здесь</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">Добавьте контент и запустите диагностику</p>
            </div>
          ) : analyzing ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-[#d4a373] animate-spin mb-3" />
              <p className="text-[14px] font-medium text-foreground">Сканируем контент...</p>
              <p className="text-[12px] text-muted-foreground mt-1">Ищем повторяющиеся паттерны</p>
            </div>
          ) : report && (
            <>
              {/* Overall score */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-4">
                  {(() => {
                    const info = getLevelInfo(report.overallLevel);
                    const Icon = info.icon;
                    return (
                      <>
                        <div className="relative">
                          <Icon className={`w-16 h-16 ${info.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[20px] font-bold text-foreground">Усталость аудитории</span>
                            <span className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-full ${info.color} ${info.bg}/10`}>
                              {info.label}
                            </span>
                          </div>
                          <div className="w-full h-3 bg-muted rounded-full mt-2 overflow-hidden">
                            <div className={`h-full rounded-full ${info.bg} transition-all`} style={{ width: `${report.overallFatigue}%` }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground mt-1 block">{report.overallFatigue}/100</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Category grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {report.categories.map((cat) => {
                  const info = getLevelInfo(cat.level);
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`p-3 rounded-xl border transition-all text-left ${
                        selectedCategory === cat.id
                          ? "border-[#d4a373]/40 bg-[#d4a373]/5 shadow-sm"
                          : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon className={`w-4 h-4 ${cat.color}`} />
                        <span className="text-[11px] font-semibold text-foreground truncate">{cat.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[18px] font-bold ${info.color}`}>{cat.score}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${info.color} ${info.bg}/10`}>{info.label}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${info.bg}`} style={{ width: `${cat.score}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected category detail */}
              {activeCat && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <activeCat.icon className={`w-4 h-4 ${activeCat.color}`} />
                    <h3 className="text-[14px] font-semibold text-foreground">{activeCat.name}</h3>
                  </div>
                  {activeCat.findings.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground font-medium">Находки:</p>
                      {activeCat.findings.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                          <span className="text-[12px] text-foreground">{f}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeCat.recommendation && (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                      <div className="flex items-start gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p className="text-[12px] text-foreground">{activeCat.recommendation}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Fresh topics */}
              {report.freshTopics.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#d4a373]" />
                    Свежие темы (о чем давно не писали)
                  </h3>
                  <div className="space-y-1.5">
                    {report.freshTopics.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#d4a373]/5 border border-[#d4a373]/20">
                        <TrendingUp className="w-3.5 h-3.5 text-[#d4a373] shrink-0" />
                        <span className="text-[12px] text-foreground">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calendar suggestion */}
              {report.contentCalendarSuggestion && (
                <div className="bg-[#d4a373]/5 border border-[#d4a373]/20 rounded-xl p-4">
                  <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-[#d4a373]" />
                    Рекомендация для контент-плана
                  </h3>
                  <p className="text-[12px] text-foreground leading-relaxed">{report.contentCalendarSuggestion}</p>
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
