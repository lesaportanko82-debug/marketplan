/**
 * 🤖 AIToolsPanel - панель расширенных AI-инструментов
 * 
 * Интеграция новых AI-функций в Content Studio:
 * - Content Repurposing
 * - Sentiment Analysis
 * - Content Enhancement
 * - A/B Test Suggestions
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, ArrowRight, TrendingUp, TrendingDown, Minus,
  RefreshCw, Check, X, Loader2, Lightbulb, Zap, Star,
  BarChart3, MessageSquare, Wand2, Split,
} from "lucide-react";
import { toast } from "sonner";
import {
  repurposeContent,
  analyzeSentiment,
  enhanceContent,
  generateABTestIdeas,
  type ContentRepurposeResult,
  type SentimentAnalysisResult,
  type ABTestSuggestion,
} from "../lib/ai-tools";

interface AIToolsPanelProps {
  content?: string;
  platform?: string;
  onApply?: (newContent: string) => void;
}

export function AIToolsPanel({ content, platform, onApply }: AIToolsPanelProps) {
  const [activeTab, setActiveTab] = useState<"repurpose" | "sentiment" | "enhance" | "abtest">("sentiment");
  const [loading, setLoading] = useState(false);
  
  // Repurpose
  const [targetPlatform, setTargetPlatform] = useState("telegram");
  const [targetFormat, setTargetFormat] = useState<"short" | "long" | "thread" | "carousel">("short");
  const [repurposeResult, setRepurposeResult] = useState<ContentRepurposeResult | null>(null);

  // Sentiment
  const [sentimentResult, setSentimentResult] = useState<SentimentAnalysisResult | null>(null);

  // Enhance
  const [selectedImprovements, setSelectedImprovements] = useState<Set<"engagement" | "clarity" | "seo" | "cta" | "emotion">>(
    new Set(["engagement"])
  );
  const [enhancedContent, setEnhancedContent] = useState<string>("");
  const [enhanceChanges, setEnhanceChanges] = useState<string[]>([]);

  // A/B Tests
  const [abTestGoal, setAbTestGoal] = useState("Увеличить конверсию");
  const [abTestSuggestions, setAbTestSuggestions] = useState<ABTestSuggestion[]>([]);

  const handleRepurpose = async () => {
    if (!content?.trim()) {
      toast.error("Нет контента для адаптации");
      return;
    }

    setLoading(true);
    try {
      const result = await repurposeContent({
        originalContent: content,
        originalPlatform: platform || "instagram",
        targetPlatform,
        targetFormat,
      });
      setRepurposeResult(result);
      toast.success("Контент адаптирован! 🎯");
    } catch (error) {
      console.error("[Repurpose] Error:", error);
      toast.error("Ошибка при адаптации контента");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeSentiment = async () => {
    if (!content?.trim()) {
      toast.error("Нет контента для анализа");
      return;
    }

    setLoading(true);
    try {
      const result = await analyzeSentiment(content);
      setSentimentResult(result);
      toast.success("Тональность проанализирована! 📊");
    } catch (error) {
      console.error("[Sentiment] Error:", error);
      toast.error("Ошибка при анализе тональности");
    } finally {
      setLoading(false);
    }
  };

  const handleEnhance = async () => {
    if (!content?.trim()) {
      toast.error("Нет контента для улучшения");
      return;
    }

    if (selectedImprovements.size === 0) {
      toast.error("Выберите хотя бы одно улучшение");
      return;
    }

    setLoading(true);
    try {
      const result = await enhanceContent(content, Array.from(selectedImprovements));
      setEnhancedContent(result.enhanced);
      setEnhanceChanges(result.changes);
      toast.success("Контент улучшен! ✨");
    } catch (error) {
      console.error("[Enhance] Error:", error);
      toast.error("Ошибка при улучшении контента");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateABTests = async () => {
    if (!content?.trim()) {
      toast.error("Нет контента для A/B тестов");
      return;
    }

    setLoading(true);
    try {
      const result = await generateABTestIdeas(content, abTestGoal);
      setAbTestSuggestions(result);
      toast.success(`Сгенерировано ${result.length} идей для A/B тестов! 🧪`);
    } catch (error) {
      console.error("[A/B Test] Error:", error);
      toast.error("Ошибка при генерации A/B тестов");
    } finally {
      setLoading(false);
    }
  };

  const toggleImprovement = (improvement: "engagement" | "clarity" | "seo" | "cta" | "emotion") => {
    setSelectedImprovements((prev) => {
      const next = new Set(prev);
      if (next.has(improvement)) {
        next.delete(improvement);
      } else {
        next.add(improvement);
      }
      return next;
    });
  };

  const getSentimentIcon = () => {
    if (!sentimentResult) return null;
    if (sentimentResult.label === "positive") return <TrendingUp className="w-4 h-4 text-emerald-600" />;
    if (sentimentResult.label === "negative") return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-amber-600" />;
  };

  const getSentimentColor = () => {
    if (!sentimentResult) return "text-muted-foreground";
    if (sentimentResult.label === "positive") return "text-emerald-600";
    if (sentimentResult.label === "negative") return "text-red-600";
    return "text-amber-600";
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-[#d4a373]" />
        <h3 className="text-[15px] font-bold text-foreground">AI-Инструменты</h3>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {[
          { id: "sentiment" as const, label: "Тональность", icon: BarChart3 },
          { id: "repurpose" as const, label: "Адаптация", icon: RefreshCw },
          { id: "enhance" as const, label: "Улучшение", icon: Wand2 },
          { id: "abtest" as const, label: "A/B Тесты", icon: Split },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* SENTIMENT ANALYSIS */}
        {activeTab === "sentiment" && (
          <motion.div
            key="sentiment"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <p className="text-[12px] text-muted-foreground">
              Анализ эмоциональной окраски контента
            </p>

            <button
              onClick={handleAnalyzeSentiment}
              disabled={loading || !content}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-[13px] font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              Анализировать тональность
            </button>

            {sentimentResult && (
              <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                {/* Score */}
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">Оценка:</span>
                  <div className={`flex items-center gap-2 text-[14px] font-bold ${getSentimentColor()}`}>
                    {getSentimentIcon()}
                    {sentimentResult.label === "positive" ? "Позитивный" : sentimentResult.label === "negative" ? "Негативный" : "Нейтральный"}
                  </div>
                </div>

                {/* Confidence */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-muted-foreground">Уверенность:</span>
                    <span className="text-[11px] font-bold">{Math.round(sentimentResult.confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${sentimentResult.confidence * 100}%` }}
                    />
                  </div>
                </div>

                {/* Keywords */}
                {sentimentResult.keywords.length > 0 && (
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1.5">Ключевые слова:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {sentimentResult.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 rounded-md bg-primary/10 text-[10px] text-primary font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {sentimentResult.suggestions.length > 0 && (
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1.5">Рекомендации:</span>
                    <ul className="space-y-1">
                      {sentimentResult.suggestions.map((sug, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-foreground">
                          <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                          {sug}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* REPURPOSE */}
        {activeTab === "repurpose" && (
          <motion.div
            key="repurpose"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <p className="text-[12px] text-muted-foreground">
              Адаптируйте контент для другой платформы
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                  Целевая платформа
                </label>
                <select
                  value={targetPlatform}
                  onChange={(e) => setTargetPlatform(e.target.value)}
                  className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[12px]"
                >
                  <option value="telegram">Telegram</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="twitter">Twitter/X</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                  Формат
                </label>
                <select
                  value={targetFormat}
                  onChange={(e) => setTargetFormat(e.target.value as any)}
                  className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[12px]"
                >
                  <option value="short">Короткий</option>
                  <option value="long">Длинный</option>
                  <option value="thread">Тред</option>
                  <option value="carousel">Карусель</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleRepurpose}
              disabled={loading || !content}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-[13px] font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Адаптировать контент
            </button>

            {repurposeResult && (
              <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-foreground">Адаптированный контент</span>
                  <button
                    onClick={() => onApply?.(repurposeResult.content)}
                    className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-[11px] font-medium flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Применить
                  </button>
                </div>

                <div className="p-3 bg-card rounded-lg text-[12px] text-foreground leading-relaxed border border-border">
                  {repurposeResult.content}
                </div>

                {repurposeResult.hashtags && (
                  <div className="text-[11px] text-muted-foreground">
                    <strong>Хештеги:</strong> {repurposeResult.hashtags}
                  </div>
                )}

                {repurposeResult.adaptations && repurposeResult.adaptations.length > 0 && (
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1">Изменения:</span>
                    <ul className="space-y-0.5">
                      {repurposeResult.adaptations.map((adap, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-foreground">
                          <ArrowRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                          {adap}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ENHANCE */}
        {activeTab === "enhance" && (
          <motion.div
            key="enhance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <p className="text-[12px] text-muted-foreground">
              Улучшите контент по выбранным параметрам
            </p>

            <div className="space-y-2">
              {[
                { id: "engagement" as const, label: "Вовлечённость", desc: "Вопросы, факты, статистика" },
                { id: "clarity" as const, label: "Ясность", desc: "Упрощение, списки" },
                { id: "seo" as const, label: "SEO", desc: "Ключевые слова" },
                { id: "cta" as const, label: "CTA", desc: "Призыв к действию" },
                { id: "emotion" as const, label: "Эмоции", desc: "Сторителлинг, триггеры" },
              ].map((imp) => (
                <button
                  key={imp.id}
                  onClick={() => toggleImprovement(imp.id)}
                  className={`w-full px-3 py-2 rounded-lg border transition-all text-left ${
                    selectedImprovements.has(imp.id)
                      ? "bg-primary/10 border-primary"
                      : "bg-muted/20 border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selectedImprovements.has(imp.id)
                        ? "bg-primary border-primary"
                        : "border-border"
                    }`}>
                      {selectedImprovements.has(imp.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-[12px] font-medium text-foreground">{imp.label}</div>
                      <div className="text-[10px] text-muted-foreground">{imp.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleEnhance}
              disabled={loading || !content || selectedImprovements.size === 0}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-[13px] font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Улучшить контент
            </button>

            {enhancedContent && (
              <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-foreground">Улучшенная версия</span>
                  <button
                    onClick={() => onApply?.(enhancedContent)}
                    className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-[11px] font-medium flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Применить
                  </button>
                </div>

                <div className="p-3 bg-card rounded-lg text-[12px] text-foreground leading-relaxed border border-border max-h-64 overflow-y-auto">
                  {enhancedContent}
                </div>

                {enhanceChanges.length > 0 && (
                  <div>
                    <span className="text-[11px] text-muted-foreground block mb-1">Изменения:</span>
                    <ul className="space-y-0.5">
                      {enhanceChanges.map((change, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] text-foreground">
                          <Star className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* A/B TESTS */}
        {activeTab === "abtest" && (
          <motion.div
            key="abtest"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <p className="text-[12px] text-muted-foreground">
              Идеи для A/B тестирования
            </p>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                Цель теста
              </label>
              <input
                type="text"
                value={abTestGoal}
                onChange={(e) => setAbTestGoal(e.target.value)}
                placeholder="Например: Увеличить CTR на 20%"
                className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[12px]"
              />
            </div>

            <button
              onClick={handleGenerateABTests}
              disabled={loading || !content}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-[13px] font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4" />}
              Сгенерировать идеи
            </button>

            {abTestSuggestions.length > 0 && (
              <div className="space-y-2">
                {abTestSuggestions.map((suggestion, i) => (
                  <div key={i} className="p-3 bg-muted/30 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-foreground uppercase">
                        {suggestion.element}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        suggestion.expectedImpact === "high"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : suggestion.expectedImpact === "medium"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-blue-500/10 text-blue-600"
                      }`}>
                        {suggestion.expectedImpact === "high" ? "Высокий impact" : suggestion.expectedImpact === "medium" ? "Средний impact" : "Низкий impact"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 bg-card rounded border border-border">
                        <span className="text-muted-foreground block mb-1">Вариант A:</span>
                        <span className="text-foreground">{suggestion.variantA}</span>
                      </div>
                      <div className="p-2 bg-card rounded border border-primary/30">
                        <span className="text-muted-foreground block mb-1">Вариант B:</span>
                        <span className="text-foreground">{suggestion.variantB}</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-muted-foreground">
                      <strong>Гипотеза:</strong> {suggestion.hypothesis}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
