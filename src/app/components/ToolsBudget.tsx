import { useState } from "react";
import {
  DollarSign,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { aiGenerate } from "../lib/api";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { exportToPDF } from "../lib/export-utils";
import { Download } from "lucide-react";

export function ToolsBudget() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{
    prompt_tokens: number;
    completion_tokens: number;
  } | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Опишите кампанию и параметры");
      return;
    }
    setIsGenerating(true);
    setResult("");
    setError(null);
    setTokenUsage(null);
    try {
      const res = await aiGenerate("budget_forecast", prompt);
      if (res) {
        setResult(res.content);
        setTokenUsage(res.usage);
        toast.success("Прогноз готов", {
          description: `${res.usage.total_tokens} токенов`,
        });
      }
    } catch (err: any) {
      const isLimit = err?.name === "UsageLimitError";
      setError(isLimit ? (err.message || "Лимит AI-генераций исчерпан.") : (err.message || "Ошибка"));
      toast.error(isLimit ? "Лимит исчерпан" : "Ошибка прогнозирования");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    copyToClipboard(result);
    setCopied(true);
    toast.success("Скопировано");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-5 max-w-[1000px] mx-auto space-y-5">
      <div>
        <h1 className="text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <DollarSign className="w-4.5 h-4.5 text-white" />
          </div>
          Прогноз бюджета
        </h1>
        <p className="text-muted-foreground text-[13px] mt-1">
          AI рассчитает оптимальное распределение бюджета и спрогнозирует
          результаты по каналам
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <label className="text-[13px] text-muted-foreground block mb-2">
            Опишите кампанию: бюджет, каналы, цели, сроки
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
            }}
            placeholder="Бюджет 1.5M RUB на 3 месяца. Каналы: Яндекс Директ, VK Реклама, Telegram Ads, SEO. Цель: 3000 лидов по CPA не более 500 RUB. Ниша: онлайн-образование, курсы по программированию."
            className="w-full bg-muted/30 border border-border rounded-lg px-4 py-3 text-foreground resize-none h-28 text-[13px] placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            ⌘+Enter для генерации
          </p>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isGenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isGenerating ? "Рассчитываю..." : "Спрогнозировать"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-[13px] text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isGenerating && (
        <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center text-center">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-muted-foreground text-[13px]">
            AI рассчитывает прогноз бюджета...
          </p>
        </div>
      )}

      {result && !isGenerating && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Прогноз
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? "Скопировано" : "Копировать"}
              </button>
              <button
                onClick={() => exportToPDF("Прогноз бюджета", result, "budget-forecast")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          </div>
          <div className="bg-muted/20 border border-border rounded-lg p-5 text-[13px] text-foreground/90 leading-relaxed">
            <MarkdownRenderer content={result} />
          </div>
          {tokenUsage && (
            <p className="text-[11px] text-muted-foreground mt-2">
              {tokenUsage.prompt_tokens + tokenUsage.completion_tokens} токенов
            </p>
          )}
        </div>
      )}
    </div>
  );
}