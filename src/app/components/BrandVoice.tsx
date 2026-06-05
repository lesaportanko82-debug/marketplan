import { useState, useCallback } from "react";
import {
  MessageSquare, Plus, Edit3, Trash2, X, Check, Loader2, Sparkles,
  ShieldCheck, AlertTriangle, Copy, Volume2, Ban, ThumbsUp, BookOpen,
  CheckCircle2, XCircle, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { aiGenerate } from "../lib/api";
import { useKV } from "../lib/useKV";
import { AddToProjectButton } from "./AddToProjectModal";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface BrandVoiceConfig {
  tonality: string[];
  style: string;
  personality: string;
  values: string[];
  targetAudience: string;
  doExamples: string[];
  dontExamples: string[];
  bannedWords: string[];
  preferredWords: string[];
  sampleTexts: { label: string; text: string }[];
}

const DEFAULT_CONFIG: BrandVoiceConfig = {
  tonality: [],
  style: "",
  personality: "",
  values: [],
  targetAudience: "",
  doExamples: [],
  dontExamples: [],
  bannedWords: [],
  preferredWords: [],
  sampleTexts: [],
};

const TONALITY_OPTIONS = [
  "Дружелюбный", "Экспертный", "Формальный", "Неформальный", "Вдохновляющий",
  "Провокационный", "Минималистичный", "Эмоциональный", "Юмористический",
  "Серьёзный", "Тёплый", "Деловой",
];

const STORAGE_KEY = "brand:voice";

export function BrandVoice() {
  const { data: config, save: saveConfig } = useKV<BrandVoiceConfig>(STORAGE_KEY, DEFAULT_CONFIG);
  const [editing, setEditing] = useState<string | null>(null);
  const [checkText, setCheckText] = useState("");
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [newWord, setNewWord] = useState("");

  const update = useCallback(
    (partial: Partial<BrandVoiceConfig>) => {
      saveConfig({ ...config, ...partial });
    },
    [config, saveConfig]
  );

  // AI: Check text against brand voice
  const handleCheckText = async () => {
    if (!checkText.trim()) return;
    setCheckLoading(true);
    try {
      const result = await aiGenerate("brand_voice_check",
        `Ты - бренд-менеджер. Проверь текст на соответствие brand voice гайду.

Tone of voice: ${config.tonality.join(", ")}
Стиль: ${config.style}
Личность бренда: ${config.personality}
Ценности: ${config.values.join(", ")}
Целевая аудитория: ${config.targetAudience}
Запрещённые слова: ${config.bannedWords.join(", ")}
Предпочтительные слова: ${config.preferredWords.join(", ")}

ТЕКСТ ДЛЯ ПРОВЕРКИ:
"${checkText}"

Дай оценку по шкале 1-10 и подробный анализ:
1. **Оценка**: X/10
2. **Соответствие тональности**: ...
3. **Найденные проблемы**: ...
4. **Запрещённые слова**: найди совпадения
5. **Рекомендации по улучшению**: ...
6. **Улучшенная версия текста**: предложи вариант`
      );
      if (result?.content) setCheckResult(result.content);
    } catch (err: any) {
      toast.error(err?.name === "UsageLimitError" ? "Лимит исчерпан" : "Ошибка проверки", { description: err.message });
    } finally {
      setCheckLoading(false);
    }
  };

  // AI: Generate brand voice guide
  const handleGenerateGuide = async () => {
    setGenLoading(true);
    try {
      const result = await aiGenerate("brand_voice_generate",
        `На основе следующих параметров бренда сгенерируй развёрнутый Brand Voice Guide:

Тональность: ${config.tonality.join(", ")}
Стиль: ${config.style}
Личность: ${config.personality}
Ценности: ${config.values.join(", ")}
ЦА: ${config.targetAudience}

Сгенерируй по 3 примера текстов для каждого формата:
1. Пост в Instagram
2. Email-рассылка (тема + первый абзац)
3. Рекламный текст (до 100 символов)
4. Ответ на негативный отзыв

Формат: markdown с заголовками.`
      );
      if (result?.content) {
        update({
          sampleTexts: [
            ...config.sampleTexts,
            { label: "AI-гайд", text: result.content },
          ],
        });
        toast.success("Brand voice гайд сгенерирован");
      }
    } catch (err: any) {
      toast.error(err?.name === "UsageLimitError" ? "Лимит исчерпан" : "Ошибка генерации", { description: err.message });
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[1440px] mx-auto space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#c0854a] flex items-center justify-center shrink-0">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            Brand Voice
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1 hidden sm:block">
            Тон коммуникации, стиль и правила контента бренда
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateGuide}
            disabled={genLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
          >
            {genLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Сгенерировать гайд</span>
            <span className="sm:hidden">Гайд</span>
          </button>
          <AddToProjectButton itemType="brand_voice" itemId="brand-voice" itemTitle="Brand Voice" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Config */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tonality */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#d4a373]" /> Тональность
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {TONALITY_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    const next = config.tonality.includes(t)
                      ? config.tonality.filter((x) => x !== t)
                      : [...config.tonality, t];
                    update({ tonality: next });
                  }}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] border transition-colors ${
                    config.tonality.includes(t)
                      ? "bg-[#d4a373]/10 text-[#d4a373] border-[#d4a373]/30 font-medium"
                      : "bg-muted/30 text-muted-foreground border-border hover:border-[#d4a373]/30"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Style + Personality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-[#d4a373]" /> Стиль
              </h3>
              <textarea
                value={config.style}
                onChange={(e) => update({ style: e.target.value })}
                rows={3}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[12px] resize-none"
              />
            </div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-[#d4a373]" /> Личность бренда
              </h3>
              <textarea
                value={config.personality}
                onChange={(e) => update({ personality: e.target.value })}
                rows={3}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[12px] resize-none"
              />
            </div>
          </div>

          {/* Do / Don't */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" /> Так пишем
              </h3>
              {config.doExamples.map((ex, i) => (
                <div key={i} className="flex items-start gap-2 group">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-1 shrink-0" />
                  <span className="text-[12px] text-foreground flex-1">{ex}</span>
                  <button
                    onClick={() => update({ doExamples: config.doExamples.filter((_, j) => j !== i) })}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <input
                type="text"
                placeholder="Добавить пример..."
                className="w-full bg-muted/30 border border-border rounded-md px-2.5 py-1.5 text-[11px] text-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                    update({ doExamples: [...config.doExamples, (e.target as HTMLInputElement).value.trim()] });
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
            </div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <Ban className="w-3.5 h-3.5 text-red-500" /> Так НЕ пишем
              </h3>
              {config.dontExamples.map((ex, i) => (
                <div key={i} className="flex items-start gap-2 group">
                  <XCircle className="w-3 h-3 text-red-500 mt-1 shrink-0" />
                  <span className="text-[12px] text-foreground flex-1 line-through opacity-70">{ex}</span>
                  <button
                    onClick={() => update({ dontExamples: config.dontExamples.filter((_, j) => j !== i) })}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <input
                type="text"
                placeholder="Добавить антипример..."
                className="w-full bg-muted/30 border border-border rounded-md px-2.5 py-1.5 text-[11px] text-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                    update({ dontExamples: [...config.dontExamples, (e.target as HTMLInputElement).value.trim()] });
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
            </div>
          </div>

          {/* Word lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <Ban className="w-3.5 h-3.5 text-red-500" /> Запрещённые слова
              </h3>
              <div className="flex flex-wrap gap-1">
                {config.bannedWords.map((w, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-red-500/8 text-red-500 border border-red-500/15 rounded text-[10px] flex items-center gap-1 group"
                  >
                    {w}
                    <button onClick={() => update({ bannedWords: config.bannedWords.filter((_, j) => j !== i) })}>
                      <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="+ добавить слово"
                className="w-full bg-muted/30 border border-border rounded-md px-2.5 py-1.5 text-[11px] text-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                    update({ bannedWords: [...config.bannedWords, (e.target as HTMLInputElement).value.trim().toLowerCase()] });
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
            </div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" /> Предпочтительные слова
              </h3>
              <div className="flex flex-wrap gap-1">
                {config.preferredWords.map((w, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-emerald-500/8 text-emerald-600 border border-emerald-500/15 rounded text-[10px] flex items-center gap-1 group"
                  >
                    {w}
                    <button onClick={() => update({ preferredWords: config.preferredWords.filter((_, j) => j !== i) })}>
                      <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="+ добавить слово"
                className="w-full bg-muted/30 border border-border rounded-md px-2.5 py-1.5 text-[11px] text-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                    update({ preferredWords: [...config.preferredWords, (e.target as HTMLInputElement).value.trim().toLowerCase()] });
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
            </div>
          </div>

          {/* Generated guides */}
          {config.sampleTexts.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-[14px] font-semibold text-foreground">Сгенерированные гайды</h3>
              {config.sampleTexts.map((st, i) => (
                <div key={i} className="bg-muted/30 border border-border rounded-lg p-4 group relative">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { copyToClipboard(st.text); toast.success("Скопировано"); }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => update({ sampleTexts: config.sampleTexts.filter((_, j) => j !== i) })}
                      className="p-1 rounded hover:bg-red-500/10 text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <MarkdownRenderer content={st.text} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: AI Check */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3 lg:sticky lg:top-5">
            <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#d4a373]" /> Проверка текста
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Вставьте текст и AI проверит его на соответствие brand voice
            </p>
            <textarea
              value={checkText}
              onChange={(e) => setCheckText(e.target.value)}
              placeholder="Вставьте текст поста, рассылки или рекламы..."
              rows={6}
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[12px] resize-none"
            />
            <button
              onClick={handleCheckText}
              disabled={checkLoading || !checkText.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
            >
              {checkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Проверить
            </button>

            {checkResult && (
              <div className="mt-3 bg-muted/30 border border-border rounded-lg p-3">
                <MarkdownRenderer content={checkResult} />
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-[13px] font-semibold text-foreground">Профиль бренда</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">Тональность</span>
                <span className="text-foreground font-medium">{config.tonality.length} выбрано</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">Запрещённые слова</span>
                <span className="text-red-500 font-medium">{config.bannedWords.length}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">Предпочтительные</span>
                <span className="text-emerald-600 font-medium">{config.preferredWords.length}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">Примеры DO/DON'T</span>
                <span className="text-foreground font-medium">{config.doExamples.length} / {config.dontExamples.length}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">Гайды</span>
                <span className="text-foreground font-medium">{config.sampleTexts.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}