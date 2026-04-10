/**
 * 🤖 AI Tools — расширенные AI-инструменты для MarketPlan
 *
 * Новые функции:
 * - Content Repurposing (адаптация контента)
 * - Sentiment Analysis (анализ тональности)
 * - Competitor Content Analysis (анализ контента конкурентов)
 * - Trend Prediction (прогноз трендов)
 * - A/B Test Suggestions (идеи для A/B тестов)
 * - Content Enhancement (улучшение контента)
 * - Content Ideas Generator (генерация идей)
 *
 * NOTE: aiGenerate(toolId, prompt) → AIGenerateResult { content, model, usage }
 * All functions use result.content for JSON parsing.
 */

import { aiGenerate } from "./api";

// ══════ TYPES ══════

export interface ContentRepurposeRequest {
  originalContent: string;
  originalPlatform: string;
  targetPlatform: string;
  targetFormat?: "short" | "long" | "thread" | "carousel";
}

export interface ContentRepurposeResult {
  content: string;
  adaptations: string[];
  hashtags?: string;
  cta?: string;
  visualSuggestions?: string;
}

export interface SentimentAnalysisResult {
  score: number; // -1 to 1
  label: "positive" | "neutral" | "negative";
  confidence: number; // 0 to 1
  keywords: string[];
  suggestions: string[];
}

export interface CompetitorAnalysis {
  competitor: string;
  contentType: string;
  engagement: "high" | "medium" | "low";
  insights: string[];
  opportunities: string[];
}

export interface TrendPrediction {
  topic: string;
  confidence: number;
  timeframe: string;
  keywords: string[];
  recommendation: string;
}

export interface ABTestSuggestion {
  element: "headline" | "cta" | "image" | "copy" | "layout";
  variantA: string;
  variantB: string;
  hypothesis: string;
  expectedImpact: "high" | "medium" | "low";
}

// ══════ HELPER: extract JSON from AI response (tolerates markdown code fences) ══════
function extractJSON(raw: string): string {
  // Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // Find first [ or { and last ] or }
  const arrStart = raw.indexOf("[");
  const objStart = raw.indexOf("{");
  if (arrStart === -1 && objStart === -1) return raw.trim();
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    const end = raw.lastIndexOf("]");
    return end !== -1 ? raw.slice(arrStart, end + 1) : raw.trim();
  }
  const end = raw.lastIndexOf("}");
  return end !== -1 ? raw.slice(objStart, end + 1) : raw.trim();
}

// ══════ CONTENT REPURPOSING ══════

/**
 * Адаптирует контент для другой платформы
 */
export async function repurposeContent(
  request: ContentRepurposeRequest
): Promise<ContentRepurposeResult> {
  const prompt = `
Ты — эксперт по адаптации контента для разных социальных сетей.

Исходный контент для ${request.originalPlatform}:
"${request.originalContent}"

Адаптируй этот контент для ${request.targetPlatform} в формате "${request.targetFormat || "стандартный"}".

Учти особенности платформы:
- Instagram: визуальность, хештеги, эмодзи, короткие абзацы
- Telegram: форматирование markdown, длинные тексты, линки
- LinkedIn: профессиональный тон, экспертность, data-driven
- Twitter/X: краткость (280 символов), треды, актуальность
- YouTube: описание видео, таймкоды, SEO-оптимизация

Верни JSON:
{
  "content": "Адаптированный текст",
  "adaptations": ["Изменение 1", "Изменение 2"],
  "hashtags": "5-7 релевантных хештегов",
  "cta": "Призыв к действию",
  "visualSuggestions": "Идеи для визуала"
}
`;

  const result = await aiGenerate("content-studio", prompt);
  if (!result?.content) throw new Error("Пустой ответ AI при адаптации контента");

  try {
    return JSON.parse(extractJSON(result.content));
  } catch {
    return {
      content: result.content,
      adaptations: [],
    };
  }
}

// ══════ SENTIMENT ANALYSIS ══════

/**
 * Анализирует тональность контента
 */
export async function analyzeSentiment(
  content: string
): Promise<SentimentAnalysisResult> {
  const prompt = `
Проанализируй тональность этого текста:

"${content}"

Оцени:
1. Sentiment score от -1 (негативный) до 1 (позитивный)
2. Label: positive/neutral/negative
3. Confidence: уверенность в оценке (0-1)
4. Keywords: ключевые слова, влияющие на тональность
5. Suggestions: как улучшить тональность для маркетинга

Верни JSON (только JSON, без markdown):
{
  "score": 0.7,
  "label": "positive",
  "confidence": 0.85,
  "keywords": ["отличный", "проблема", "решение"],
  "suggestions": ["Усилить позитив", "Добавить конкретные преимущества"]
}
`;

  const result = await aiGenerate("content-studio", prompt);
  if (!result?.content) throw new Error("Пустой ответ AI при анализе тональности");

  try {
    return JSON.parse(extractJSON(result.content));
  } catch {
    return {
      score: 0,
      label: "neutral",
      confidence: 0.5,
      keywords: [],
      suggestions: ["Не удалось проанализировать тональность"],
    };
  }
}

// ══════ COMPETITOR ANALYSIS ══════

/**
 * Анализирует контент конкурента
 */
export async function analyzeCompetitorContent(
  competitorName: string,
  contentSample: string
): Promise<CompetitorAnalysis> {
  const prompt = `
Ты — эксперт по конкурентному анализу в маркетинге.

Конкурент: ${competitorName}

Пример их контента:
"${contentSample}"

Проанализируй:
1. Тип контента (обучающий, продающий, развлекательный, новостной)
2. Уровень вовлечённости (high/medium/low)
3. Insights: что они делают хорошо
4. Opportunities: что мы можем сделать лучше

Верни JSON (только JSON, без markdown):
{
  "competitor": "${competitorName}",
  "contentType": "образовательный контент с продуктовыми вставками",
  "engagement": "high",
  "insights": ["Используют сторителлинг", "Много визуала"],
  "opportunities": ["Добавить больше данных", "Сделать короче"]
}
`;

  const result = await aiGenerate("strategy", prompt);
  if (!result?.content) throw new Error("Пустой ответ AI при анализе конкурента");

  try {
    return JSON.parse(extractJSON(result.content));
  } catch {
    return {
      competitor: competitorName,
      contentType: "Неизвестно",
      engagement: "medium",
      insights: [],
      opportunities: [],
    };
  }
}

// ══════ TREND PREDICTION ══════

/**
 * Предсказывает тренды на основе данных
 */
export async function predictTrends(
  industry: string,
  keywords: string[]
): Promise<TrendPrediction[]> {
  const prompt = `
Ты — аналитик трендов в ${industry}.

Ключевые слова: ${keywords.join(", ")}

Предскажи 3-5 актуальных трендов на ближайшие 3-6 месяцев.

Для каждого тренда укажи:
1. Topic: название тренда
2. Confidence: уверенность в прогнозе (0-1)
3. Timeframe: когда будет актуально
4. Keywords: связанные ключевые слова
5. Recommendation: как использовать в маркетинге

Верни JSON массив (только JSON, без markdown):
[
  {
    "topic": "AI-персонализация",
    "confidence": 0.9,
    "timeframe": "Q2-Q3 2026",
    "keywords": ["AI", "персонализация", "автоматизация"],
    "recommendation": "Внедрить AI-чатбота и персональные рекомендации"
  }
]
`;

  const result = await aiGenerate("strategy", prompt);
  if (!result?.content) throw new Error("Пустой ответ AI при прогнозе трендов");

  try {
    return JSON.parse(extractJSON(result.content));
  } catch {
    return [];
  }
}

// ══════ A/B TEST SUGGESTIONS ══════

/**
 * Генерирует идеи для A/B тестов
 */
export async function generateABTestIdeas(
  campaign: string,
  goal: string
): Promise<ABTestSuggestion[]> {
  const prompt = `
Ты — эксперт по A/B тестированию в digital-маркетинге.

Кампания/контент: ${campaign}
Цель: ${goal}

Предложи 5 идей для A/B тестов, которые помогут улучшить конверсию.

Для каждого теста укажи:
1. Element: что тестируем (headline/cta/image/copy/layout)
2. VariantA: вариант А
3. VariantB: вариант Б
4. Hypothesis: гипотеза
5. ExpectedImpact: ожидаемое влияние (high/medium/low)

Верни JSON массив (только JSON, без markdown):
[
  {
    "element": "headline",
    "variantA": "Увеличьте продажи на 30%",
    "variantB": "Как мы помогли 1000+ компаниям вырасти",
    "hypothesis": "Социальное доказательство сработает лучше обещания",
    "expectedImpact": "high"
  }
]
`;

  const result = await aiGenerate("strategy", prompt);
  if (!result?.content) throw new Error("Пустой ответ AI при генерации A/B тестов");

  try {
    return JSON.parse(extractJSON(result.content));
  } catch {
    return [];
  }
}

// ══════ CONTENT ENHANCEMENT ══════

/**
 * Улучшает существующий контент
 */
export async function enhanceContent(
  content: string,
  improvements: ("engagement" | "clarity" | "seo" | "cta" | "emotion")[]
): Promise<{
  enhanced: string;
  changes: string[];
  seoScore?: number;
}> {
  const improvementsText = improvements
    .map((i) => {
      switch (i) {
        case "engagement": return "увеличить вовлечённость";
        case "clarity":    return "сделать понятнее";
        case "seo":        return "оптимизировать для SEO";
        case "cta":        return "усилить призыв к действию";
        case "emotion":    return "добавить эмоциональности";
        default:           return i;
      }
    })
    .join(", ");

  const prompt = `
Улучши этот контент: ${improvementsText}

Исходный текст:
"${content}"

Требования:
${improvements.includes("engagement") ? "- Добавь вопросы, статистику или интересные факты\n" : ""}${improvements.includes("clarity") ? "- Упрости сложные предложения, используй списки\n" : ""}${improvements.includes("seo") ? "- Добавь ключевые слова естественным образом\n" : ""}${improvements.includes("cta") ? "- Усиль призыв к действию, сделай его конкретным\n" : ""}${improvements.includes("emotion") ? "- Добавь эмоциональные триггеры и сторителлинг\n" : ""}
Верни JSON (только JSON, без markdown):
{
  "enhanced": "Улучшенный текст",
  "changes": ["Добавлены цифры", "Упрощена структура"],
  "seoScore": 8.5
}
`;

  const result = await aiGenerate("content-studio", prompt);
  if (!result?.content) throw new Error("Пустой ответ AI при улучшении контента");

  try {
    return JSON.parse(extractJSON(result.content));
  } catch {
    return {
      enhanced: content,
      changes: ["Не удалось улучшить контент"],
    };
  }
}

// ══════ CONTENT IDEAS GENERATOR ══════

/**
 * Генерирует идеи для контента
 */
export async function generateContentIdeas(
  topic: string,
  audience: string,
  count: number = 10
): Promise<Array<{
  title: string;
  type: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedEngagement: "high" | "medium" | "low";
}>> {
  const prompt = `
Сгенерируй ${count} идей контента на тему "${topic}" для аудитории "${audience}".

Для каждой идеи укажи:
1. Title: заголовок
2. Type: тип контента (статья, видео, инфографика, кейс, чек-лист и т.д.)
3. Description: краткое описание (1-2 предложения)
4. Difficulty: сложность создания (easy/medium/hard)
5. EstimatedEngagement: ожидаемое вовлечение (high/medium/low)

Верни JSON массив с ${count} идеями (только JSON, без markdown).
`;

  const result = await aiGenerate("ideas", prompt);
  if (!result?.content) throw new Error("Пустой ответ AI при генерации идей");

  try {
    return JSON.parse(extractJSON(result.content));
  } catch {
    return [];
  }
}
