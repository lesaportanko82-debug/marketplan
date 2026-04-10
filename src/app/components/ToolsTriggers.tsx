import { useState, useRef } from "react";
import {
  MessageSquareQuote,
  Upload,
  FileText,
  Send,
  RefreshCw,
  Copy,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Sparkles,
  FileUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { aiGenerate } from "../lib/api";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { exportToPDF } from "../lib/export-utils";
import { Download } from "lucide-react";

export function ToolsTriggers() {
  const [reviewsText, setReviewsText] = useState("");
  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{
    prompt_tokens: number;
    completion_tokens: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    for (const file of Array.from(fileList)) {
      try {
        const text = await file.text();
        setFiles((prev) => [...prev, { name: file.name, content: text }]);
        toast.success(`Файл загружен: ${file.name}`);
      } catch (err) {
        toast.error(`Ошибка чтения файла: ${file.name}`);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getAllReviews = () => {
    const parts: string[] = [];
    if (reviewsText.trim()) parts.push(reviewsText.trim());
    files.forEach((f) => {
      if (f.content.trim()) parts.push(`--- Из файла "${f.name}" ---\n${f.content.trim()}`);
    });
    return parts.join("\n\n");
  };

  const handleAnalyze = async () => {
    const allReviews = getAllReviews();
    if (!allReviews) {
      toast.error("Добавьте отзывы для анализа");
      return;
    }

    setIsAnalyzing(true);
    setResult("");
    setError(null);
    setTokenUsage(null);

    try {
      const res = await aiGenerate(
        "review_triggers",
        `Вот отзывы клиентов для анализа:\n\n${allReviews}`
      );
      if (res) {
        setResult(res.content);
        setTokenUsage(res.usage);
        toast.success("Анализ завершён", {
          description: `${res.usage.total_tokens} токенов · ${res.model}`,
        });
      }
    } catch (err: any) {
      const isLimit = err?.name === "UsageLimitError";
      const msg = isLimit
        ? (err.message || "Лимит AI-генераций исчерпан. Обновите план.")
        : (err.message || "Ошибка анализа");
      setError(msg);
      toast.error(isLimit ? "Лимит исчерпан" : "Ошибка анализа отзывов", { description: msg });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = () => {
    copyToClipboard(result);
    setCopied(true);
    toast.success("Скопировано");
    setTimeout(() => setCopied(false), 2000);
  };

  const reviewCount = getAllReviews().split("\n").filter((l) => l.trim().length > 10).length;

  return (
    <div className="p-5 max-w-[1000px] mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-foreground flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
            <MessageSquareQuote className="w-4.5 h-4.5 text-white" />
          </div>
          Триггеры из отзывов
        </h1>
        <p className="text-muted-foreground text-[13px] mt-1">
          Загрузите отзывы - AI построит архетипы клиентов и определит лучшие
          психологические триггеры для маркетинга
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        {/* Text input */}
        <div>
          <label className="text-[13px] text-muted-foreground block mb-2">
            Вставьте отзывы (каждый с новой строки или через абзац)
          </label>
          <textarea
            value={reviewsText}
            onChange={(e) => setReviewsText(e.target.value)}
            placeholder={`Отличный магазин! Заказал ноутбук, доставили за 2 дня. Упаковка идеальная.\n\nДолго выбирала между вами и конкурентами. В итоге решилась из-за отзывов. Не пожалела!\n\nЦены выше среднего, но качество сервиса того стоит. Менеджер Алексей помог с выбором.\n\nЗаказал второй раз. В первый раз были проблемы с доставкой, но во второй - всё идеально.`}
            className="w-full bg-muted/30 border border-border rounded-lg px-4 py-3 text-foreground resize-none h-40 text-[13px] placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all"
          />
        </div>

        {/* File upload */}
        <div>
          <label className="text-[13px] text-muted-foreground block mb-2">
            Или загрузите файл с отзывами (.txt, .csv)
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/30 hover:bg-muted/20 transition-all"
          >
            <FileUp className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">
              Перетащите файлы сюда или{" "}
              <span className="text-primary">выберите</span>
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              TXT, CSV - каждый отзыв с новой строки
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.csv,.text"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Uploaded files */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-[12px] text-muted-foreground font-medium">
              Загруженные файлы:
            </p>
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2"
              >
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-[13px] text-foreground flex-1 truncate">
                  {f.name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {f.content.length} символов
                </span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-[12px] text-muted-foreground">
            {reviewCount > 0 ? `~${reviewCount} отзывов для анализа` : "Нет отзывов"}
          </span>
          <div className="flex items-center gap-2">
            {(reviewsText || files.length > 0) && (
              <button
                onClick={() => {
                  setReviewsText("");
                  setFiles([]);
                  setResult("");
                  setError(null);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Очистить
              </button>
            )}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || (!reviewsText.trim() && files.length === 0)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isAnalyzing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isAnalyzing ? "Анализирую..." : "Анализировать"}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-[13px] text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Ошибка анализа</p>
            <p className="text-[12px] mt-0.5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isAnalyzing && (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
          <h3 className="text-foreground mb-1">Анализирую отзывы...</h3>
          <p className="text-muted-foreground text-[13px]">
            Строю архетипы клиентов и определяю психологические триггеры
          </p>
        </div>
      )}

      {/* Result */}
      {result && !isAnalyzing && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Результат анализа
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
                onClick={() => exportToPDF("Анализ триггеров", result, "review-triggers")}
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
              использовано
            </p>
          )}
        </div>
      )}
    </div>
  );
}