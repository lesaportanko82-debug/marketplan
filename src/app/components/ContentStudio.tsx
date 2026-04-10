import { useState, useCallback, useMemo } from "react";
import {
  Sparkles, Loader2, Copy, Check, Instagram, MessageCircle, Mail,
  Video, Globe, AlertTriangle, CheckCircle2, XCircle, Volume2,
  Hash, RefreshCw, Wand2, FileText, Eye, ChevronDown, ChevronRight,
  Smartphone, Monitor, X, Lightbulb, Zap, Palette, BookOpen, Star, Tag,
  FolderKanban, Image, SmilePlus, Send,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { aiGenerate, generateImage, type DALLEImage } from "../lib/api";
import { useKV } from "../lib/useKV";
import { AddToProjectButton } from "./AddToProjectModal";
import { showMascotReaction, checkMilestone } from "../lib/mascot-reactions";
import { triggerMilestoneCheck } from "./MascotGames";
import { useUsage } from "../lib/useUsage";
import { UsageMeter } from "./UsageMeter";
import { AIToolsPanel } from "./AIToolsPanel";

/* ========== TYPES ========== */
interface Platform {
  id: string;
  name: string;
  icon: any;
  color: string;
  bg: string;
  maxLength: number;
  features: string[];
}

interface GeneratedContent {
  platformId: string;
  text: string;
  hashtags: string;
  cta: string;
  format: string;
  imageUrl?: string;
  imagePrompt?: string;
}

interface BrandVoiceConfig {
  tonality: string[];
  style: string;
  personality: string;
  bannedWords: string[];
  preferredWords: string[];
  doExamples: string[];
  dontExamples: string[];
}

interface BrandViolation {
  word: string;
  type: "banned" | "tone";
  suggestion?: string;
}

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

interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
  industry?: string;
  kpiSummary?: string;
  status?: string;
}

/* ========== CONSTANTS ========== */
const PLATFORMS: Platform[] = [
  { id: "instagram", name: "Instagram", icon: Instagram, color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/30", maxLength: 2200, features: ["Карусели", "Reels", "Stories"] },
  { id: "telegram", name: "Telegram", icon: MessageCircle, color: "text-sky-500", bg: "bg-sky-500/10 border-sky-500/30", maxLength: 4096, features: ["Форматирование", "Кнопки", "Превью"] },
  { id: "email", name: "Email", icon: Mail, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30", maxLength: 5000, features: ["Тема письма", "Прехедер", "CTA"] },
  { id: "youtube", name: "YouTube", icon: Video, color: "text-red-500", bg: "bg-red-500/10 border-red-500/30", maxLength: 5000, features: ["Описание", "Теги", "Таймкоды"] },
  { id: "ad", name: "Рекламный текст", icon: Zap, color: "text-teal-600", bg: "bg-teal-600/10 border-teal-600/30", maxLength: 1000, features: ["Заголовок", "Описание", "CTA"] },
];

const BRIEF_TEMPLATES = [
  { label: "Запуск продукта", brief: "Запуск новой функции автоаналитики. Ключевые преимущества: AI-прогнозы, визуальные дашборды, интеграция с 10+ сервисами. Целевая аудитория: маркетологи и руководители." },
  { label: "Акция / скидка", brief: "Черная пятница: скидка 50% на все тарифы. Действует 3 дня. Промокод: BLACK50. Подчеркнуть ценность инструмента и ограниченность предложения." },
  { label: "Образовательный контент", brief: "Гайд: 5 ошибок в контент-маркетинге, которые убивают ROI. Разбор с конкретными примерами и решениями." },
  { label: "Кейс / результат", brief: "Кейс клиента: интернет-магазин увеличил ROMI на 280% за 3 месяца. Детали: оптимизация каналов, AI-подбор контента, автоматические отчёты." },
];

/* ========== COMPONENT ========== */
export function ContentStudio() {
  const { canUse, increment, checkAndWarn } = useUsage();
  const [brief, setBrief] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(
    new Set(["instagram", "telegram", "email"])
  );
  const [generating, setGenerating] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [results, setResults] = useState<GeneratedContent[]>([]);
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("mobile");
  const [checkingBrand, setCheckingBrand] = useState(false);
  const [brandViolations, setBrandViolations] = useState<Map<string, BrandViolation[]>>(new Map());
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedHashtagSets, setSelectedHashtagSets] = useState<Set<string>>(new Set());
  const [showHashtagPanel, setShowHashtagPanel] = useState(false);

  // New: Emoji toggle
  const [useEmoji, setUseEmoji] = useState(false);
  // New: Project context
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  // New: Company context (free text fallback)
  const [companyContext, setCompanyContext] = useState("");

  // Brand Voice config
  const { data: brandConfig } = useKV<BrandVoiceConfig>("brand_voice:config", {
    tonality: [], style: "", personality: "", bannedWords: [], preferredWords: [],
    doExamples: [], dontExamples: [],
  });

  // Hashtag presets from HashtagSEO module
  const { data: hashtagSets } = useKV<HashtagSet[]>("smm:hashtags", []);

  // Projects list
  const { data: projectsList } = useKV<ProjectInfo[]>("projects:list", []);

  // Selected project
  const selectedProject = useMemo(
    () => projectsList.find((p) => p.id === selectedProjectId) || null,
    [projectsList, selectedProjectId]
  );

  // Build hashtag context for AI prompt
  const selectedHashtags = useMemo(() => {
    if (!hashtagSets?.length || selectedHashtagSets.size === 0) return "";
    const selected = hashtagSets.filter((s) => selectedHashtagSets.has(s.id));
    if (selected.length === 0) return "";
    return selected.flatMap((s) => s.hashtags).join(" ");
  }, [hashtagSets, selectedHashtagSets]);

  // Auto-match hashtag sets by platform
  const matchingHashtagSets = useMemo(() => {
    if (!hashtagSets?.length) return [];
    const platformNames = PLATFORMS.filter((p) => selectedPlatforms.has(p.id)).map((p) => p.name);
    return hashtagSets.filter((s) =>
      platformNames.some((pn) => s.platform?.toLowerCase().includes(pn.toLowerCase())) ||
      s.platform === "Все" || !s.platform
    );
  }, [hashtagSets, selectedPlatforms]);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  const toggleHashtagSet = (id: string) => {
    setSelectedHashtagSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ====== TEXT CLEANUP ======
  // Strip markdown artifacts from AI output
  const cleanText = (raw: string): string => {
    return raw
      .replace(/\*\*([^*]+)\*\*/g, "$1")   // **bold** -> bold
      .replace(/\*([^*]+)\*/g, "$1")        // *italic* -> italic
      .replace(/__([^_]+)__/g, "$1")        // __underline__ -> underline
      .replace(/_([^_]+)_/g, "$1")          // _italic_ -> italic
      .replace(/~~([^~]+)~~/g, "$1")        // ~~strike~~ -> strike
      .replace(/^#{1,6}\s+/gm, "")          // ### heading -> heading
      .replace(/^[-*]\s+/gm, "- ")          // normalize list markers
      .replace(/^>\s+/gm, "")               // > blockquote -> text
      .replace(/`([^`]+)`/g, "$1")          // `code` -> code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) -> text
      .replace(/---+/g, "")                 // --- horizontal rules
      .replace(/\n{3,}/g, "\n\n")           // collapse excess newlines
      .trim();
  };

  const cleanField = (raw: string): string => {
    return raw
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
  };

  // ====== IMAGE GENERATION (defined before handleGenerate to avoid TDZ) ======
  const generateImagesForResults = useCallback(async (parsed: GeneratedContent[]) => {
    const withPrompts = parsed.filter((r) => r.imagePrompt && r.imagePrompt.length > 5);
    if (withPrompts.length === 0) {
      console.log("No valid image prompts found in parsed results");
      return;
    }

    // Usage gate: check AI image limit
    if (!canUse("aiImagePerMonth")) {
      showMascotReaction("error", "Лимит AI-изображений исчерпан! Обновите план 🦊");
      toast.error("Лимит DALL-E генераций исчерпан. Обновите план.");
      return;
    }

    setGeneratingImages(true);
    toast.info(`Генерация ${withPrompts.length} визуалов через DALL-E 3...`);
    const updatedResults = [...parsed];
    let successCount = 0;

    for (const item of withPrompts) {
      try {
        const imgPrompt = `${item.imagePrompt}. Professional marketing photo, clean composition, no text overlay, high quality.`;
        console.log(`[DALL-E] Generating for ${item.platformId}: "${imgPrompt.slice(0, 80)}..."`);
        const images = await generateImage(imgPrompt, { size: "1024x1024", style: "natural" });
        if (images && images.length > 0 && images[0].url) {
          const idx = updatedResults.findIndex((r) => r.platformId === item.platformId);
          if (idx >= 0) {
            updatedResults[idx] = { ...updatedResults[idx], imageUrl: images[0].url };
            successCount++;
            console.log(`[DALL-E] Success for ${item.platformId}`);
          }
        } else {
          console.warn(`[DALL-E] Empty result for ${item.platformId}`);
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.error(`[DALL-E] Error for ${item.platformId}:`, msg);
        if (err?.name === "UsageLimitError") {
          toast.error(err.message || "Лимит DALL-E исчерпан!");
          break;
        }
      }
    }

    setResults([...updatedResults]);
    setGeneratingImages(false);
    if (successCount > 0) {
      // Track AI image usage
      increment("aiImagePerMonth", successCount);
      toast.success(`Сгенерировано ${successCount} из ${withPrompts.length} визуалов`);
    } else if (withPrompts.length > 0) {
      toast.error("Не удалось сгенерировать визуалы. Проверьте настройку OpenAI API ключа.");
    }
  }, []);

  // ====== GENERATE ======
  const handleGenerate = useCallback(async () => {
    if (!brief.trim()) { toast.error("Введите бриф"); return; }
    if (selectedPlatforms.size === 0) { toast.error("Выберите хотя бы одну платформу"); return; }

    // Usage gate: check AI text limit
    if (!canUse("aiTextPerMonth")) {
      showMascotReaction("error", "Лимит AI-генераций исчерпан! Обновите план 🦊");
      toast.error("Лимит AI-генераций текста исчерпан. Обновите план для продолжения.");
      return;
    }

    setGenerating(true);
    setResults([]);
    setBrandViolations(new Map());

    try {
      const platformNames = PLATFORMS
        .filter((p) => selectedPlatforms.has(p.id))
        .map((p) => `${p.name} (макс. ${p.maxLength} символов, особенности: ${p.features.join(", ")})`);

      const brandContext = brandConfig.tonality.length
        ? `\n\nBrand Voice:\n- Тональность: ${brandConfig.tonality.join(", ")}\n- Стиль: ${brandConfig.style}\n- Запрещённые слова: ${brandConfig.bannedWords.join(", ") || "нет"}\n- Предпочтительные слова: ${brandConfig.preferredWords.join(", ") || "нет"}`
        : "";

      const hashtagContext = selectedHashtags
        ? `\n\nОбязательно включи эти хештеги из сохранённых пресетов (распредели по платформам): ${selectedHashtags}`
        : "";

      // Project / company context
      let projectContext = "";
      if (selectedProject) {
        projectContext = `\n\nКонтекст компании/проекта:
- Название: ${selectedProject.name}
- Отрасль: ${selectedProject.industry || "не указана"}
- Описание: ${selectedProject.description || "нет"}
- KPI: ${selectedProject.kpiSummary || "нет"}
Адаптируй тексты под эту компанию, используй релевантную лексику отрасли.`;
      } else if (companyContext.trim()) {
        projectContext = `\n\nКонтекст компании: ${companyContext}\nАдаптируй тексты под эту компанию.`;
      }

      // Emoji instruction
      const emojiInstruction = useEmoji
        ? "\n\nИспользуй уместные эмодзи в текстах для каждой платформы."
        : "\n\nКАТЕГОРИЧЕСКИ НЕ используй эмодзи ни в каком виде. Текст должен быть без единого эмодзи/смайла.";

      // Image prompt instruction
      const imageInstruction = `\n\nДля КАЖДОЙ платформы предложи описание визуала на английском (одно предложение).
Формат строго: **Image:** (one sentence in English describing the image)`;

      const prompt = `Ты - контент-студия. Создай контент-пакет по брифу для каждой платформы отдельно.
${brandContext}${hashtagContext}${projectContext}${emojiInstruction}${imageInstruction}

Бриф: ${brief}

Платформы: ${platformNames.join("; ")}

ВАЖНО: В тексте поста НЕ используй маркдаун-форматирование (никаких **, *, ___, ---, ##). Пиши чистый текст.

Для КАЖДОЙ платформы:
### [Название платформы]
**Текст:** (чистый текст поста без форматирования)
**Хештеги:** (через пробел)
**CTA:** (один призыв к действию)
**Формат:** (рекомендуемый формат)
**Image:** (one sentence in English describing a relevant photo/image for this post)

Адаптируй стиль, длину и подачу под каждую платформу. Instagram - визуальный, эмоциональный. Telegram - информативный, структурированный. Email - профессиональный, с чёткой воронкой. YouTube - SEO, таймкоды. Рекламный текст - лаконичный, с сильным CTA.
Пиши на русском (кроме Image).`;

      const result = await aiGenerate("content-studio", prompt);
      if (!result?.content) throw new Error("Пустой ответ AI");

      // Track AI text usage
      await increment("aiTextPerMonth");

      // Parse results per platform
      const parsed: GeneratedContent[] = [];
      const sections = result.content.split(/###\s+/);

      for (const section of sections) {
        if (!section.trim()) continue;
        const platformMatch = PLATFORMS.find((p) =>
          section.toLowerCase().startsWith(p.name.toLowerCase()) ||
          section.toLowerCase().includes(p.name.toLowerCase())
        );
        if (!platformMatch || !selectedPlatforms.has(platformMatch.id)) continue;

        const textMatch = section.match(/\*\*Текст:\*\*\s*([\s\S]*?)(?=\n\s*\*\*(?:Хештеги|CTA|Формат|Image|Визуал|Visual):|$)/i);
        const hashMatch = section.match(/\*\*Хештеги:\*\*\s*([\s\S]*?)(?=\n\s*\*\*(?:CTA|Формат|Image|Визуал|Visual):|$)/i);
        const ctaMatch = section.match(/\*\*CTA:\*\*\s*([\s\S]*?)(?=\n\s*\*\*(?:Формат|Image|Визуал|Visual):|$)/i);
        const formatMatch = section.match(/\*\*Формат:\*\*\s*([\s\S]*?)(?=\n\s*\*\*(?:Image|Визуал|Visual):|$)/i);
        const visualMatch = section.match(/\*\*(?:Image|Визуал|Visual):\*\*\s*([\s\S]*?)(?=\n\s*\*\*|$)/i);

        parsed.push({
          platformId: platformMatch.id,
          text: cleanText(textMatch?.[1]?.trim() || section.trim()),
          hashtags: cleanField(hashMatch?.[1]?.trim() || ""),
          cta: cleanField(ctaMatch?.[1]?.trim() || ""),
          format: cleanField(formatMatch?.[1]?.trim() || ""),
          imagePrompt: cleanField(visualMatch?.[1]?.trim() || ""),
        });
      }

      if (parsed.length === 0 && selectedPlatforms.size > 0) {
        const firstPlat = Array.from(selectedPlatforms)[0];
        parsed.push({ platformId: firstPlat, text: cleanText(result.content), hashtags: "", cta: "", format: "" });
      }

      setResults(parsed);
      setActivePlatform(parsed[0]?.platformId || null);
      toast.success(`Сгенерировано ${parsed.length} адаптаций`);
      showMascotReaction("ai_done", `${parsed.length} адаптаций готово! ✨`);
      const m = checkMilestone("first_ai", 1);
      if (m) triggerMilestoneCheck();

      // Auto-generate images in background
      const hasImagePrompts = parsed.some((p) => p.imagePrompt && p.imagePrompt.length > 5);
      if (hasImagePrompts) {
        // Run image generation after state updates
        setTimeout(() => generateImagesForResults(parsed), 100);
      }
    } catch (err: any) {
      console.error("Content Studio generation error:", err);
      if (err?.name === "UsageLimitError") {
        toast.error(err.message || "Лимит AI-генераций исчерпан. Обновите план.");
        showMascotReaction("error", "Лимит исчерпан! Обновите план 🦊");
      } else {
        toast.error("Ошибка генерации контента");
        showMascotReaction("error");
      }
    } finally {
      setGenerating(false);
    }
  }, [brief, selectedPlatforms, brandConfig, selectedHashtags, useEmoji, selectedProject, companyContext, generateImagesForResults]);

  // Regenerate single image
  const regenerateImage = useCallback(async (platformId: string) => {
    const item = results.find((r) => r.platformId === platformId);
    if (!item?.imagePrompt || item.imagePrompt.length < 5) {
      toast.error("Нет промпта для генерации визуала");
      return;
    }

    setGeneratingImages(true);
    try {
      const imgPrompt = `${item.imagePrompt}. Professional marketing photo, clean composition, no text overlay, high quality, different angle.`;
      console.log(`[DALL-E] Regenerating for ${platformId}: "${imgPrompt.slice(0, 80)}..."`);
      const images = await generateImage(imgPrompt, { size: "1024x1024", style: "natural" });
      if (images && images.length > 0 && images[0].url) {
        setResults((prev) =>
          prev.map((r) => r.platformId === platformId ? { ...r, imageUrl: images[0].url } : r)
        );
        toast.success("Изображение обновлено");
      } else {
        toast.error("Пустой ответ от DALL-E");
      }
    } catch (err: any) {
      console.error("Regenerate image error:", err?.message || err);
      if (err?.name === "UsageLimitError") {
        toast.error(err.message || "Лимит DALL-E исчерпан. Обновите план.");
      } else {
        toast.error(`Ошибка генерации: ${err?.message || "неизвестная ошибка"}`);
      }
    } finally {
      setGeneratingImages(false);
    }
  }, [results]);

  // Brand Voice check
  const handleBrandCheck = useCallback(async () => {
    if (results.length === 0) return;
    setCheckingBrand(true);
    const violations = new Map<string, BrandViolation[]>();
    for (const r of results) {
      const found: BrandViolation[] = [];
      if (brandConfig.bannedWords.length) {
        for (const word of brandConfig.bannedWords) {
          if (word && r.text.toLowerCase().includes(word.toLowerCase())) {
            found.push({ word, type: "banned", suggestion: `Замените "${word}"` });
          }
        }
      }
      violations.set(r.platformId, found);
    }
    setBrandViolations(violations);
    setCheckingBrand(false);
    const total = Array.from(violations.values()).reduce((s, v) => s + v.length, 0);
    if (total === 0) toast.success("Brand Voice - все тексты соответствуют!");
    else toast.warning(`Обнаружено ${total} нарушений Brand Voice`);
  }, [results, brandConfig]);

  const copyText = useCallback((platformId: string, text: string) => {
    copyToClipboard(text);
    setCopiedId(platformId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Скопировано в буфер");
  }, []);

  // Update image prompt for a specific platform result
  const updateImagePrompt = useCallback((platformId: string, newPrompt: string) => {
    setResults((prev) =>
      prev.map((r) => r.platformId === platformId ? { ...r, imagePrompt: newPrompt } : r)
    );
  }, []);

  // Generate image from custom prompt for a specific platform
  const generateFromPrompt = useCallback(async (platformId: string, prompt: string) => {
    if (!prompt || prompt.length < 5) {
      toast.error("Промпт слишком короткий (мин. 5 символов)");
      return;
    }
    setGeneratingImages(true);
    try {
      const imgPrompt = `${prompt}. Professional marketing photo, clean composition, no text overlay, high quality.`;
      console.log(`[DALL-E] Custom prompt for ${platformId}: "${imgPrompt.slice(0, 80)}..."`);
      const images = await generateImage(imgPrompt, { size: "1024x1024", style: "natural" });
      if (images && images.length > 0 && images[0].url) {
        setResults((prev) =>
          prev.map((r) => r.platformId === platformId ? { ...r, imageUrl: images[0].url } : r)
        );
        toast.success("Изображение сгенерировано");
      } else {
        toast.error("Пустой ответ от DALL-E");
      }
    } catch (err: any) {
      console.error("Custom prompt image error:", err?.message || err);
      if (err?.name === "UsageLimitError") {
        toast.error(err.message || "Лимит DALL-E исчерпан. Обновите план.");
      } else {
        toast.error(`Ошибка генерации: ${err?.message || "неизвестная ошибка"}`);
      }
    } finally {
      setGeneratingImages(false);
    }
  }, []);

  const activeResult = results.find((r) => r.platformId === activePlatform);
  const activePlatformConfig = PLATFORMS.find((p) => p.id === activePlatform);

  return (
    <div className="p-6 space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground flex items-center gap-2.5">
            <Wand2 className="w-6 h-6 text-[#d4a373]" />
            AI Content Studio
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            Один бриф - контент для всех платформ с проверкой Brand Voice и генерацией визуалов
          </p>
        </div>
        <AddToProjectButton itemType="content-studio" itemId="studio" itemTitle="Content Studio" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: Brief input */}
        <div className="lg:col-span-2 space-y-4">
          {/* Project / Company context */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#d4a373]" />
                Контекст компании
              </h3>
              {selectedProject && (
                <button onClick={() => setSelectedProjectId("")}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <X className="w-3 h-3" />Сбросить
                </button>
              )}
            </div>

            {/* Project selector */}
            {projectsList.length > 0 && (
              <div>
                <label className="text-[11px] text-muted-foreground font-medium">Из проекта:</label>
                <div className="relative mt-1">
                  <button
                    onClick={() => setShowProjectPicker(!showProjectPicker)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[12px] text-left transition-colors ${
                      selectedProject ? "border-[#d4a373]/30 bg-[#d4a373]/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <span className="truncate">{selectedProject ? selectedProject.name : "Выберите проект (необязательно)"}</span>
                    {showProjectPicker ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                  </button>
                  {showProjectPicker && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                      <button
                        onClick={() => { setSelectedProjectId(""); setShowProjectPicker(false); }}
                        className="w-full px-3 py-2 text-left text-[12px] text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        Без проекта
                      </button>
                      {projectsList.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedProjectId(p.id); setShowProjectPicker(false); setCompanyContext(""); }}
                          className={`w-full px-3 py-2 text-left text-[12px] hover:bg-muted/50 transition-colors ${
                            selectedProjectId === p.id ? "text-[#d4a373] font-medium bg-[#d4a373]/5" : "text-foreground"
                          }`}
                        >
                          <span className="block truncate">{p.name}</span>
                          {p.industry && <span className="text-[10px] text-muted-foreground">{p.industry}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Selected project info */}
            {selectedProject && (
              <div className="bg-[#d4a373]/5 rounded-lg p-2.5 space-y-1">
                <div className="text-[11px] font-medium text-[#d4a373]">{selectedProject.name}</div>
                {selectedProject.industry && <p className="text-[10px] text-muted-foreground">Отрасль: {selectedProject.industry}</p>}
                {selectedProject.description && <p className="text-[10px] text-muted-foreground line-clamp-2">{selectedProject.description}</p>}
              </div>
            )}

            {/* Free text company context (when no project selected) */}
            {!selectedProject && (
              <div>
                <label className="text-[11px] text-muted-foreground font-medium">Или опишите компанию:</label>
                <input
                  type="text"
                  value={companyContext}
                  onChange={(e) => setCompanyContext(e.target.value)}
                  placeholder="Например: SaaS для B2B, финтех-стартап, кофейня..."
                  className="w-full mt-1 px-3 py-2 text-[12px] bg-input-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
                />
              </div>
            )}
          </div>

          {/* Brief */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#d4a373]" />
                Бриф
              </h3>
              <button onClick={() => setShowTemplates(!showTemplates)}
                className="text-[11px] text-[#d4a373] hover:underline flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />Шаблоны
                {showTemplates ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            </div>

            {showTemplates && (
              <div className="grid grid-cols-2 gap-2">
                {BRIEF_TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => { setBrief(t.brief); setShowTemplates(false); }}
                    className="text-left p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <span className="text-[12px] font-medium text-foreground">{t.label}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.brief}</p>
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Опишите что нужно: тема, ключевые сообщения, целевая аудитория, тон..."
              rows={5}
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 text-[13px] text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
            />
            <p className="text-[11px] text-muted-foreground">{brief.length} симв.</p>
          </div>

          {/* Emoji toggle */}
          <div className="bg-card border border-border rounded-xl p-4">
            <button
              onClick={() => setUseEmoji(!useEmoji)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <SmilePlus className={`w-4 h-4 ${useEmoji ? "text-[#d4a373]" : "text-muted-foreground"}`} />
                <span className="text-[13px] font-medium text-foreground">Добавлять эмодзи?</span>
              </div>
              <div className={`w-10 h-5.5 rounded-full p-0.5 transition-colors ${useEmoji ? "bg-[#d4a373]" : "bg-muted"}`}>
                <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${useEmoji ? "translate-x-4.5" : "translate-x-0"}`}
                  style={{ width: 18, height: 18, transform: useEmoji ? "translateX(18px)" : "translateX(0)" }} />
              </div>
            </button>
            <p className="text-[10px] text-muted-foreground mt-1.5 pl-6">
              {useEmoji ? "AI буде�� добавлять уместные эмодзи" : "Тексты будут без эмодзи"}
            </p>
          </div>

          {/* Platform selection */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-foreground">Платформы</h3>
            <div className="space-y-2">
              {PLATFORMS.map((p) => {
                const active = selectedPlatforms.has(p.id);
                return (
                  <button key={p.id} onClick={() => togglePlatform(p.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                      active ? `${p.bg} border-current` : "border-border hover:bg-muted/30"
                    }`}>
                    <p.icon className={`w-4 h-4 ${active ? p.color : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <span className={`text-[13px] font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{p.name}</span>
                      <div className="flex gap-1.5 mt-0.5">
                        {p.features.map((f) => (
                          <span key={f} className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{f}</span>
                        ))}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      active ? "bg-[#d4a373] border-[#d4a373]" : "border-border"
                    }`}>
                      {active && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hashtag presets from HashtagSEO */}
          {hashtagSets.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                  <Hash className="w-4 h-4 text-[#d4a373]" />
                  Хештег-пресеты
                </h3>
                <button onClick={() => setShowHashtagPanel(!showHashtagPanel)}
                  className="text-[11px] text-[#d4a373] hover:underline flex items-center gap-1">
                  {selectedHashtagSets.size > 0 && (
                    <span className="bg-[#d4a373] text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{selectedHashtagSets.size}</span>
                  )}
                  {showHashtagPanel ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              </div>

              {!showHashtagPanel && matchingHashtagSets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {matchingHashtagSets.slice(0, 4).map((s) => {
                    const isSelected = selectedHashtagSets.has(s.id);
                    return (
                      <button key={s.id} onClick={() => toggleHashtagSet(s.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border transition-all ${
                          isSelected ? "bg-[#d4a373]/10 border-[#d4a373]/30 text-[#d4a373]" : "border-border text-muted-foreground hover:border-[#d4a373]/20"
                        }`}>
                        {s.starred && <Star className="w-2.5 h-2.5 text-amber-500" />}
                        <Tag className="w-2.5 h-2.5" />{s.name}
                        <span className="text-[9px] opacity-60">({s.hashtags.length})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {showHashtagPanel && (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {hashtagSets.map((s) => {
                    const isSelected = selectedHashtagSets.has(s.id);
                    return (
                      <button key={s.id} onClick={() => toggleHashtagSet(s.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all text-left ${
                          isSelected ? "bg-[#d4a373]/10 border-[#d4a373]/30" : "border-border hover:bg-muted/30"
                        }`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isSelected ? "bg-[#d4a373] border-[#d4a373]" : "border-border"
                        }`}>{isSelected && <Check className="w-3 h-3 text-white" />}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {s.starred && <Star className="w-2.5 h-2.5 text-amber-500" />}
                            <span className="text-[12px] font-medium text-foreground">{s.name}</span>
                            {s.platform && <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded">{s.platform}</span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {s.hashtags.slice(0, 5).join(" ")} {s.hashtags.length > 5 ? `+${s.hashtags.length - 5}` : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedHashtags && (
                <div className="bg-[#d4a373]/5 rounded-lg p-2">
                  <p className="text-[10px] text-[#d4a373] font-medium mb-1">Выбранные хештеги будут включены в генерацию:</p>
                  <p className="text-[10px] text-muted-foreground truncate">{selectedHashtags.slice(0, 100)}{selectedHashtags.length > 100 ? "..." : ""}</p>
                </div>
              )}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !brief.trim()}
            className="w-full py-3 bg-[#d4a373] hover:bg-[#c0854a] text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            data-hotspot="studio-generate"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Генерация {selectedPlatforms.size} платформ...</>
            ) : (
              <><Sparkles className="w-4 h-4" />Сгенерировать контент-пакет</>
            )}
          </button>

          {/* Usage meters */}
          <div className="space-y-2 mt-2">
            <UsageMeter usageKey="aiTextPerMonth" label="AI-тексты" variant="compact" />
            <UsageMeter usageKey="aiImagePerMonth" label="DALL-E" variant="compact" />
          </div>

          {/* Brand Voice check button */}
          {results.length > 0 && (
            <button onClick={handleBrandCheck} disabled={checkingBrand}
              className="w-full py-2.5 border border-border bg-card hover:bg-muted/50 text-foreground rounded-xl font-medium text-[13px] flex items-center justify-center gap-2 transition-colors">
              {checkingBrand ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4 text-[#d4a373]" />}
              Проверить Brand Voice
            </button>
          )}
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-3 space-y-4">
          {results.length === 0 && !generating ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center">
              <Wand2 className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-[14px] font-medium text-muted-foreground">Результаты появятся здесь</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">Заполните бриф и нажмите "Сгенерировать"</p>
            </div>
          ) : generating ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-[#d4a373] animate-spin mb-3" />
              <p className="text-[14px] font-medium text-foreground">Генерация контент-пакета...</p>
              <p className="text-[12px] text-muted-foreground mt-1">Адаптируем под {selectedPlatforms.size} платформ</p>
            </div>
          ) : (
            <>
              {/* Platform tabs */}
              <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
                {results.map((r) => {
                  const plat = PLATFORMS.find((p) => p.id === r.platformId);
                  if (!plat) return null;
                  const isActive = activePlatform === r.platformId;
                  const violations = brandViolations.get(r.platformId) || [];
                  return (
                    <button key={r.platformId} onClick={() => setActivePlatform(r.platformId)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                        isActive ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}>
                      <plat.icon className={`w-3.5 h-3.5 ${isActive ? plat.color : ""}`} />
                      {plat.name}
                      {r.imageUrl && <Image className="w-3 h-3 text-emerald-500" />}
                      {violations.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-500 text-[9px] flex items-center justify-center">{violations.length}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Images generating indicator */}
              {generatingImages && (
                <div className="bg-[#d4a373]/5 border border-[#d4a373]/20 rounded-xl p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-[#d4a373] animate-spin" />
                  <span className="text-[12px] text-[#d4a373] font-medium">Генерация визуалов DALL-E 3...</span>
                </div>
              )}

              {/* Active platform content */}
              {activeResult && activePlatformConfig && (
                <div className="space-y-4">
                  {/* Preview toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      <span className="text-[12px] text-muted-foreground font-medium">Превью</span>
                    </div>
                    <div className="flex bg-muted rounded-lg p-0.5">
                      <button onClick={() => setPreviewMode("mobile")}
                        className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                          previewMode === "mobile" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                        }`}><Smartphone className="w-3 h-3 inline mr-1" />Мобайл</button>
                      <button onClick={() => setPreviewMode("desktop")}
                        className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
                          previewMode === "desktop" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                        }`}><Monitor className="w-3 h-3 inline mr-1" />Десктоп</button>
                    </div>
                  </div>

                  {/* Platform-specific preview */}
                  <PlatformPreview
                    platform={activePlatformConfig}
                    content={activeResult}
                    mode={previewMode}
                    onRegenerateImage={() => regenerateImage(activeResult.platformId)}
                    generatingImage={generatingImages}
                  />

                  {/* Brand Voice violations */}
                  {brandViolations.has(activeResult.platformId) && (
                    <BrandViolationsPanel
                      violations={brandViolations.get(activeResult.platformId) || []}
                      platformName={activePlatformConfig.name}
                    />
                  )}

                  {/* Raw content card */}
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold text-foreground">Текст</h4>
                      <button
                        onClick={() => copyText(activeResult.platformId, `${activeResult.text}\n\n${activeResult.hashtags}\n\n${activeResult.cta}`)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        {copiedId === activeResult.platformId
                          ? <><Check className="w-3 h-3 text-emerald-500" /> Скопировано</>
                          : <><Copy className="w-3 h-3" /> Копировать</>
                        }
                      </button>
                    </div>
                    <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
                      {activeResult.text}
                    </div>
                    {activeResult.hashtags && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Hash className="w-3 h-3 text-[#d4a373]" />
                          <span className="text-[11px] font-medium text-muted-foreground">Хештеги</span>
                        </div>
                        <p className="text-[12px] text-teal-500">{activeResult.hashtags}</p>
                      </div>
                    )}
                    {activeResult.cta && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span className="text-[11px] font-medium text-muted-foreground">CTA</span>
                        </div>
                        <p className="text-[13px] text-foreground font-medium">{activeResult.cta}</p>
                      </div>
                    )}
                    {activeResult.format && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Palette className="w-3 h-3 text-teal-600" />
                          <span className="text-[11px] font-medium text-muted-foreground">Рекомендуемый формат</span>
                        </div>
                        <p className="text-[12px] text-muted-foreground">{activeResult.format}</p>
                      </div>
                    )}
                    {/* Editable image prompt */}
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Image className="w-3 h-3 text-emerald-500" />
                        <span className="text-[11px] font-medium text-muted-foreground">Промпт для визуала (EN)</span>
                        {activeResult.imageUrl && (
                          <span className="text-[9px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Сгенерировано</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={activeResult.imagePrompt || ""}
                          onChange={(e) => updateImagePrompt(activeResult.platformId, e.target.value)}
                          placeholder="Describe the image in English, e.g. Modern office with laptop..."
                          className="flex-1 px-2.5 py-1.5 text-[11px] bg-input-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-muted-foreground/50"
                        />
                        <button
                          onClick={() => generateFromPrompt(activeResult.platformId, activeResult.imagePrompt || "")}
                          disabled={generatingImages || !activeResult.imagePrompt || activeResult.imagePrompt.length < 5}
                          title="Сгенерировать изображение по промпту"
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0"
                        >
                          {generatingImages
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Send className="w-3 h-3" />
                          }
                          <span className="hidden sm:inline">DALL-E</span>
                        </button>
                        {activeResult.imageUrl && (
                          <button
                            onClick={() => regenerateImage(activeResult.platformId)}
                            disabled={generatingImages}
                            title="Перегенерировать"
                            className="px-2 py-1.5 border border-border hover:bg-muted/50 text-muted-foreground rounded-lg transition-colors shrink-0"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                      <span>{activeResult.text.length} / {activePlatformConfig.maxLength} симв.</span>
                      {activeResult.text.length > activePlatformConfig.maxLength && (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />Превышен лимит
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI Tools Panel - Advanced AI tools for content enhancement */}
                  <AIToolsPanel
                    content={activeResult.text}
                    platform={activePlatformConfig.name}
                    onApply={(newContent) => {
                      setResults((prev) =>
                        prev.map((r) =>
                          r.platformId === activeResult.platformId
                            ? { ...r, text: newContent }
                            : r
                        )
                      );
                      toast.success("Контент обновлён! ✨");
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========== PLATFORM PREVIEW ========== */
function PlatformPreview({ platform, content, mode, onRegenerateImage, generatingImage }: {
  platform: Platform; content: GeneratedContent; mode: "desktop" | "mobile";
  onRegenerateImage: () => void; generatingImage: boolean;
}) {
  const width = mode === "mobile" ? "max-w-[375px]" : "max-w-full";

  const ImageBlock = ({ aspectClass = "aspect-square" }: { aspectClass?: string }) => {
    if (content.imageUrl) {
      return (
        <div className={`${aspectClass} relative group overflow-hidden`}>
          <img src={content.imageUrl} alt="Generated visual" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <button
              onClick={(e) => { e.stopPropagation(); onRegenerateImage(); }}
              disabled={generatingImage}
              className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-white/90 text-[11px] font-medium rounded-lg flex items-center gap-1 text-gray-800"
            >
              {generatingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Перегенерировать
            </button>
          </div>
        </div>
      );
    }

    if (generatingImage) {
      return (
        <div className={`${aspectClass} bg-gradient-to-br from-[#d4a373]/10 to-[#d4a373]/5 flex items-center justify-center`}>
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-[#d4a373]/50 animate-spin mx-auto mb-2" />
            <span className="text-[11px] text-muted-foreground">Генерация визуала...</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`${aspectClass} bg-gradient-to-br from-[#d4a373]/20 to-[#d4a373]/5 flex items-center justify-center`}>
        <div className="text-center">
          <Image className="w-10 h-10 text-[#d4a373]/40 mx-auto mb-2" />
          <span className="text-[12px] text-muted-foreground">Визуал к посту</span>
        </div>
      </div>
    );
  };

  if (platform.id === "instagram") {
    return (
      <div className={`mx-auto ${width}`}>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 p-[2px]">
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                <span className="text-[10px] font-bold text-foreground">MP</span>
              </div>
            </div>
            <span className="text-[13px] font-semibold text-foreground">marketplan.ai</span>
          </div>
          <ImageBlock aspectClass="aspect-square" />
          <div className="px-4 py-3 space-y-2">
            <p className="text-[13px] text-foreground leading-relaxed line-clamp-4">{content.text}</p>
            {content.hashtags && <p className="text-[12px] text-teal-500">{content.hashtags}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (platform.id === "telegram") {
    return (
      <div className={`mx-auto ${width}`}>
        <div className="bg-[#0f1923] rounded-xl overflow-hidden p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#d4a373] flex items-center justify-center">
              <span className="text-[11px] font-bold text-white">MP</span>
            </div>
            <span className="text-[13px] font-semibold text-white">MarketPlan</span>
          </div>
          {content.imageUrl && (
            <div className="rounded-lg overflow-hidden relative group">
              <img src={content.imageUrl} alt="Visual" className="w-full h-auto max-h-[300px] object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <button onClick={(e) => { e.stopPropagation(); onRegenerateImage(); }} disabled={generatingImage}
                  className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-white/90 text-[11px] font-medium rounded-lg flex items-center gap-1 text-gray-800">
                  {generatingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Перегенерировать
                </button>
              </div>
            </div>
          )}
          <div className="bg-[#182533] rounded-xl p-3 max-w-[90%]">
            <p className="text-[13px] text-[#e4e6ea] leading-relaxed whitespace-pre-wrap">{content.text}</p>
            {content.hashtags && <p className="text-[12px] text-[#6ab2f2] mt-2">{content.hashtags}</p>}
            <div className="text-right mt-1"><span className="text-[10px] text-[#6d7f8f]">12:00</span></div>
          </div>
        </div>
      </div>
    );
  }

  if (platform.id === "email") {
    return (
      <div className={`mx-auto ${width}`}>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border space-y-1.5">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span>От:</span><span className="text-foreground font-medium">MarketPlan &lt;hello@marketplan.ai&gt;</span>
            </div>
            <div className="text-[14px] font-semibold text-foreground">{content.cta || "Тема письма"}</div>
          </div>
          {content.imageUrl && (
            <div className="relative group">
              <img src={content.imageUrl} alt="Email banner" className="w-full h-auto max-h-[250px] object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <button onClick={(e) => { e.stopPropagation(); onRegenerateImage(); }} disabled={generatingImage}
                  className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-white/90 text-[11px] font-medium rounded-lg flex items-center gap-1 text-gray-800">
                  {generatingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Перегенерировать
                </button>
              </div>
            </div>
          )}
          <div className="px-6 py-5 space-y-3">
            <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">{content.text}</p>
            {content.cta && (
              <div className="text-center py-3">
                <span className="inline-block px-6 py-2.5 bg-[#d4a373] text-white rounded-lg text-[13px] font-medium">{content.cta}</span>
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-border bg-muted/30 text-[10px] text-muted-foreground text-center">
            MarketPlan - AI-маркетинг планер
          </div>
        </div>
      </div>
    );
  }

  if (platform.id === "youtube") {
    return (
      <div className={`mx-auto ${width}`}>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {content.imageUrl ? (
            <div className="aspect-video relative group overflow-hidden">
              <img src={content.imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-14 h-10 rounded-xl bg-red-600/90 flex items-center justify-center">
                  <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[7px] border-y-transparent ml-1" />
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onRegenerateImage(); }} disabled={generatingImage}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-white/90 text-[10px] font-medium rounded-lg flex items-center gap-1 text-gray-800">
                {generatingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </button>
            </div>
          ) : (
            <div className="bg-black aspect-video flex items-center justify-center">
              <div className="w-14 h-10 rounded-xl bg-red-600 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[7px] border-y-transparent ml-1" />
              </div>
            </div>
          )}
          <div className="px-4 py-3 space-y-2">
            <h4 className="text-[14px] font-semibold text-foreground line-clamp-2">{content.cta || "Заголовок видео"}</h4>
            <p className="text-[12px] text-muted-foreground">MarketPlan - 0 просмотров - только что</p>
            <p className="text-[12px] text-foreground leading-relaxed line-clamp-3 whitespace-pre-wrap">{content.text}</p>
            {content.hashtags && <p className="text-[11px] text-teal-500">{content.hashtags}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Ad / default
  return (
    <div className={`mx-auto ${width}`}>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {content.imageUrl ? (
          <div className="relative group overflow-hidden" style={{ maxHeight: 250 }}>
            <img src={content.imageUrl} alt="Ad visual" className="w-full h-auto object-cover" />
            <button onClick={(e) => { e.stopPropagation(); onRegenerateImage(); }} disabled={generatingImage}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-white/90 text-[10px] font-medium rounded-lg flex items-center gap-1 text-gray-800">
              {generatingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-[#d4a373]/20 to-teal-600/20 p-6 text-center">
            <Zap className="w-8 h-8 text-[#d4a373] mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Рекламный блок</p>
          </div>
        )}
        <div className="p-4 space-y-2">
          <h4 className="text-[15px] font-bold text-foreground">{content.cta || "Заголовок"}</h4>
          <p className="text-[13px] text-foreground leading-relaxed">{content.text}</p>
          {content.cta && (
            <button className="mt-2 px-4 py-2 bg-[#d4a373] text-white rounded-lg text-[12px] font-medium w-full">
              {content.cta}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========== BRAND VIOLATIONS PANEL ========== */
function BrandViolationsPanel({ violations, platformName }: { violations: BrandViolation[]; platformName: string }) {
  if (violations.length === 0) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        <span className="text-[12px] text-emerald-600 font-medium">{platformName}: Brand Voice OK</span>
      </div>
    );
  }

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        <span className="text-[12px] text-red-600 font-medium">{platformName}: {violations.length} нарушений Brand Voice</span>
      </div>
      {violations.map((v, i) => (
        <div key={i} className="flex items-start gap-2 pl-6">
          <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-[11px] text-red-500">
              {v.type === "banned" ? "Запрещённое слово" : "Несоответствие тона"}: <strong>"{v.word}"</strong>
            </span>
            {v.suggestion && <p className="text-[10px] text-red-400/70">{v.suggestion}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}