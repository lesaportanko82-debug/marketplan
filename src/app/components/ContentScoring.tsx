import { useState, useCallback } from "react";
import {
  BarChart3, Loader2, Sparkles, TrendingUp, Heart, MousePointerClick,
  Search, Shield, AlertTriangle, CheckCircle2, ArrowUp, ArrowDown,
  Minus, RefreshCw, Copy, Check, Lightbulb, Target, Zap,
  Instagram, MessageCircle, Mail, Video, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { aiGenerate } from "../lib/api";
import { useKV } from "../lib/useKV";
import { AddToProjectButton } from "./AddToProjectModal";

/* ========== TYPES ========== */
interface ScoreAxis {
  id: string;
  name: string;
  icon: any;
  color: string;
  score: number;
  maxScore: number;
  analysis: string;
  improvements: string[];
}

interface ScoringResult {
  id: string;
  text: string;
  platform: string;
  totalScore: number;
  grade: string;
  axes: ScoreAxis[];
  topRecommendation: string;
  improvedVersion: string;
  createdAt: string;
}

/* ========== CONSTANTS ========== */
const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: Instagram },
  { id: "telegram", name: "Telegram", icon: MessageCircle },
  { id: "email", name: "Email", icon: Mail },
  { id: "youtube", name: "YouTube", icon: Video },
  { id: "ad", name: "Реклама", icon: Zap },
  { id: "general", name: "Универсальный", icon: FileText },
];

const AXIS_ICONS: Record<string, any> = {
  virality: TrendingUp,
  engagement: Heart,
  conversion: MousePointerClick,
  seo: Search,
  brand_fit: Shield,
};

const AXIS_COLORS: Record<string, string> = {
  virality: "text-amber-600",
  engagement: "text-red-500",
  conversion: "text-emerald-500",
  seo: "text-teal-500",
  brand_fit: "text-teal-600",
};

function getGrade(score: number): { grade: string; color: string; bg: string } {
  if (score >= 90) return { grade: "A+", color: "text-emerald-500", bg: "bg-emerald-500" };
  if (score >= 80) return { grade: "A", color: "text-emerald-500", bg: "bg-emerald-500" };
  if (score >= 70) return { grade: "B+", color: "text-lime-500", bg: "bg-lime-500" };
  if (score >= 60) return { grade: "B", color: "text-amber-500", bg: "bg-amber-500" };
  if (score >= 50) return { grade: "C", color: "text-orange-500", bg: "bg-orange-500" };
  return { grade: "D", color: "text-red-500", bg: "bg-red-500" };
}

/* ========== COMPONENT ========== */
export function ContentScoring() {
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [copiedImproved, setCopiedImproved] = useState(false);
  const [showImproved, setShowImproved] = useState(false);

  const { data: scoringHistory, save: saveHistory } = useKV<ScoringResult[]>("content:scoring_history", []);

  const handleScore = useCallback(async () => {
    if (!text.trim() || text.trim().length < 20) {
      toast.error("Введите текст для оценки (мин. 20 символов)");
      return;
    }

    setScoring(true);
    setResult(null);
    setShowImproved(false);

    try {
      const platName = PLATFORMS.find(p => p.id === platform)?.name || platform;

      const prompt = `Ты - Predictive Content Scoring AI. Оцени маркетинговый контент ДО публикации по 5 осям. Дай числовые оценки и конкретные рекомендации по улучшению.

Платформа: ${platName}

Текст для оценки:
"""
${text.slice(0, 3000)}
"""

Оцени по 5 осям (каждая от 0 до 100):

1. VIRALITY (Виральность) - потенциал шеринга, эмоциональные триггеры, "хук" в начале, необычность
2. ENGAGEMENT (Вовлеченность) - вызывает ли реакции, комментарии, вопросы, интерактивность
3. CONVERSION (Конверсия) - наличие CTA, убедительность, выгоды для читателя, urgency
4. SEO (SEO-потенциал) - ключевые слова, структура, релевантность для поиска
5. BRAND_FIT (Соответствие бренду) - профессиональность, консистентность тона, доверие

ВАЖНО: Будь строгим и честным. Не завышай оценки. Средний пост в интернете должен получать 40-60 баллов.

Формат ответа (строго):
**VIRALITY_SCORE:** [число 0-100]
**VIRALITY_ANALYSIS:** [1-2 предложения анализа]
**VIRALITY_FIX_1:** [конкретная рекомендация]
**VIRALITY_FIX_2:** [конкретная рекомендация]

**ENGAGEMENT_SCORE:** [число 0-100]
**ENGAGEMENT_ANALYSIS:** [1-2 предложения]
**ENGAGEMENT_FIX_1:** [рекомендация]
**ENGAGEMENT_FIX_2:** [рекомендация]

**CONVERSION_SCORE:** [число 0-100]
**CONVERSION_ANALYSIS:** [1-2 предложения]
**CONVERSION_FIX_1:** [рекомендация]
**CONVERSION_FIX_2:** [рекомендация]

**SEO_SCORE:** [число 0-100]
**SEO_ANALYSIS:** [1-2 предложения]
**SEO_FIX_1:** [рекомендация]
**SEO_FIX_2:** [рекомендация]

**BRAND_FIT_SCORE:** [число 0-100]
**BRAND_FIT_ANALYSIS:** [1-2 предложения]
**BRAND_FIT_FIX_1:** [рекомендация]
**BRAND_FIT_FIX_2:** [рекомендация]

**TOP_RECOMMENDATION:** [главная рекомендация одним предложением, которая даст максимальный буст]

**IMPROVED_VERSION:** [полностью переписанная улучшенная версия текста с учётом всех рекомендаций, без markdown]

Пиши на русском, без markdown в содержимом полей.`;

      const aiResult = await aiGenerate("content-scoring", prompt);
      if (!aiResult?.content) throw new Error("Пустой ответ AI");

      const raw = aiResult.content;
      const axes: ScoreAxis[] = [];

      for (const axisId of ["virality", "engagement", "conversion", "seo", "brand_fit"]) {
        const upper = axisId.toUpperCase();
        const scoreMatch = raw.match(new RegExp(`\\*\\*${upper}_SCORE:\\*\\*\\s*(\\d+)`, "i"));
        const analysisMatch = raw.match(new RegExp(`\\*\\*${upper}_ANALYSIS:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, "i"));
        const fix1Match = raw.match(new RegExp(`\\*\\*${upper}_FIX_1:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, "i"));
        const fix2Match = raw.match(new RegExp(`\\*\\*${upper}_FIX_2:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, "i"));

        const names: Record<string, string> = {
          virality: "Виральность",
          engagement: "Вовлеченность",
          conversion: "Конверсия",
          seo: "SEO-потенциал",
          brand_fit: "Brand Fit",
        };

        const score = parseInt(scoreMatch?.[1] || "50");
        axes.push({
          id: axisId,
          name: names[axisId] || axisId,
          icon: AXIS_ICONS[axisId] || BarChart3,
          color: AXIS_COLORS[axisId] || "text-gray-500",
          score: Math.min(100, Math.max(0, score)),
          maxScore: 100,
          analysis: cleanMd(analysisMatch?.[1]?.trim() || ""),
          improvements: [
            cleanMd(fix1Match?.[1]?.trim() || ""),
            cleanMd(fix2Match?.[1]?.trim() || ""),
          ].filter(Boolean),
        });
      }

      const totalScore = Math.round(axes.reduce((s, a) => s + a.score, 0) / axes.length);
      const topRecMatch = raw.match(/\*\*TOP_RECOMMENDATION:\*\*\s*([\s\S]*?)(?=\n\s*\*\*|$)/i);
      const improvedMatch = raw.match(/\*\*IMPROVED_VERSION:\*\*\s*([\s\S]*?)$/i);

      const scoringResult: ScoringResult = {
        id: Date.now().toString(),
        text: text.slice(0, 500),
        platform,
        totalScore,
        grade: getGrade(totalScore).grade,
        axes,
        topRecommendation: cleanMd(topRecMatch?.[1]?.trim() || ""),
        improvedVersion: cleanMd(improvedMatch?.[1]?.trim() || ""),
        createdAt: new Date().toISOString(),
      };

      setResult(scoringResult);
      toast.success(`Оценка: ${totalScore}/100 (${scoringResult.grade})`);

      await saveHistory([scoringResult, ...(scoringHistory || []).slice(0, 19)]);
    } catch (err: any) {
      console.error("Scoring error:", err);
      if (err?.name === "UsageLimitError") {
        toast.error(err.message || "Лимит AI-генераций исчерпан. Обновите план.");
      } else {
        toast.error("Ошибка оценки контента");
      }
    } finally {
      setScoring(false);
    }
  }, [text, platform, scoringHistory, saveHistory]);

  const copyImproved = () => {
    if (result?.improvedVersion) {
      copyToClipboard(result.improvedVersion);
      setCopiedImproved(true);
      setTimeout(() => setCopiedImproved(false), 2000);
      toast.success("Улучшенная версия скопирована");
    }
  };

  return (
    <div className="p-6 space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground flex items-center gap-2.5">
            <Target className="w-6 h-6 text-[#d4a373]" />
            Predictive Content Scoring
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            Оценка контента до публикации по 5 осям + AI-рекомендации для буста метрик
          </p>
        </div>
        <AddToProjectButton itemType="content-studio" itemId="scoring" itemTitle="Content Scoring" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Input */}
        <div className="lg:col-span-2 space-y-4">
          {/* Platform */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-foreground">Платформа</h3>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] transition-all ${
                      platform === p.id
                        ? "border-[#d4a373]/40 bg-[#d4a373]/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text input */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-foreground">Текст для оценки</h3>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Вставьте текст поста, рассылки, рекламного объявления..."
              rows={8}
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 text-[13px] text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground">{text.length} симв.</p>
          </div>

          <button
            onClick={handleScore}
            disabled={scoring || text.trim().length < 20}
            className="w-full py-3 bg-[#d4a373] hover:bg-[#c0854a] text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {scoring ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Анализируем контент...</>
            ) : (
              <><Sparkles className="w-4 h-4" />Оценить контент</>
            )}
          </button>

          {/* History mini */}
          {scoringHistory.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground">Последние оценки</h3>
              {scoringHistory.slice(0, 5).map((h) => {
                const g = getGrade(h.totalScore);
                return (
                  <div key={h.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                    <span className={`text-[14px] font-bold ${g.color}`}>{h.grade}</span>
                    <span className="text-[11px] text-foreground truncate flex-1">{h.text.slice(0, 40)}...</span>
                    <span className="text-[10px] text-muted-foreground">{h.totalScore}/100</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-3 space-y-4">
          {!result && !scoring ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center">
              <Target className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-[14px] font-medium text-muted-foreground">Оценка появится здесь</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">Вставьте текст и нажмите "Оценить"</p>
            </div>
          ) : scoring ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-[#d4a373] animate-spin mb-3" />
              <p className="text-[14px] font-medium text-foreground">Анализируем контент...</p>
              <p className="text-[12px] text-muted-foreground mt-1">Проверяем по 5 осям</p>
            </div>
          ) : result && (
            <>
              {/* Total score */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor"
                        className={getGrade(result.totalScore).color}
                        strokeWidth="8" strokeDasharray={`${result.totalScore * 2.64} 264`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-[28px] font-bold ${getGrade(result.totalScore).color}`}>{result.totalScore}</span>
                      <span className="text-[10px] text-muted-foreground">/100</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[24px] font-bold ${getGrade(result.totalScore).color}`}>{result.grade}</span>
                      <span className="text-[13px] text-muted-foreground">
                        {result.totalScore >= 80 ? "Отлично" : result.totalScore >= 60 ? "Хорошо" : result.totalScore >= 40 ? "Средне" : "Слабо"}
                      </span>
                    </div>
                    {result.topRecommendation && (
                      <div className="bg-[#d4a373]/5 border border-[#d4a373]/20 rounded-lg p-2.5 mt-2">
                        <div className="flex items-start gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-[#d4a373] mt-0.5 shrink-0" />
                          <p className="text-[12px] text-foreground leading-relaxed">{result.topRecommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Axes breakdown */}
              <div className="space-y-3">
                {result.axes.map((axis) => {
                  const Icon = axis.icon;
                  const g = getGrade(axis.score);
                  return (
                    <div key={axis.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${axis.color}`} />
                          <span className="text-[13px] font-semibold text-foreground">{axis.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[18px] font-bold ${g.color}`}>{axis.score}</span>
                          <span className="text-[10px] text-muted-foreground">/100</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${g.bg}`}
                          style={{ width: `${axis.score}%` }}
                        />
                      </div>

                      {axis.analysis && (
                        <p className="text-[12px] text-muted-foreground">{axis.analysis}</p>
                      )}

                      {axis.improvements.length > 0 && (
                        <div className="space-y-1">
                          {axis.improvements.map((imp, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <ArrowUp className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                              <p className="text-[11px] text-foreground">{imp}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Improved version */}
              {result.improvedVersion && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowImproved(!showImproved)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#d4a373]" />
                      <span className="text-[13px] font-semibold text-foreground">Улучшенная версия</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">AI-rewrite</span>
                    </div>
                    {showImproved ? <ArrowDown className="w-4 h-4 text-muted-foreground" /> : <ArrowUp className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {showImproved && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed bg-emerald-500/5 rounded-lg p-4">
                        {result.improvedVersion}
                      </div>
                      <button onClick={copyImproved}
                        className="flex items-center gap-1 px-3 py-1.5 text-[11px] border border-border rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
                      >
                        {copiedImproved ? <><Check className="w-3 h-3 text-emerald-500" /> Скопировано</> : <><Copy className="w-3 h-3" /> Копировать улучшенную версию</>}
                      </button>
                    </div>
                  )}
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