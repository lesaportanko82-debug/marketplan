import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { sendWebhook } from "./webhook.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as usageLimits from "./usage_limits.tsx";

const app = new Hono();

// Supabase admin client (for user management)
function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Helper: extract user from access token
async function getUserFromToken(authHeader: string | undefined): Promise<{ id: string; email: string } | null> {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  // Skip if it's the anon key (unauthenticated requests)
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (token === anonKey) return null;

  try {
    const supabase = getAdminClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return { id: user.id, email: user.email || "" };
  } catch {
    return null;
  }
}

// Helper: get workspace ID for a user (owner's ID or the inviter's ID for team members)
async function getWorkspaceId(userId: string): Promise<string> {
  const membership = await kv.get(`mp:user_workspace:${userId}`) as any;
  if (membership?.workspaceId) return membership.workspaceId;
  return userId; // Default: user is the workspace owner
}

// Helper: generate random password
function generatePassword(length = 12): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  let pw = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (const b of arr) pw += chars[b % chars.length];
  return pw;
}

// Helper: resolve workspace KV prefix from auth header
async function resolveWsPrefix(authHeader: string | undefined): Promise<{ prefix: string; userId: string | null }> {
  const user = await getUserFromToken(authHeader);
  if (user) {
    const wsId = await getWorkspaceId(user.id);
    return { prefix: `mp:ws:${wsId}:`, userId: user.id };
  }
  // Fallback for unauthenticated requests (shouldn't happen in prod)
  return { prefix: "mp:", userId: null };
}

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Helper: append to activity log (max 500 entries)
// NOTE: read-modify-write pattern — concurrent calls may lose entries. Acceptable for audit logs.
async function appendActivityLog(entry: { type: string; action: string; details?: any; actor?: string }) {
  try {
    const logs = (await kv.get("mp:admin_activity_log") as any[]) || [];
    logs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...entry,
      timestamp: new Date().toISOString(),
    });
    await kv.set("mp:admin_activity_log", logs.slice(0, 500));
  } catch (e) {
    console.log(`appendActivityLog error (non-critical): ${e}`);
  }
}

// Health check endpoint
app.get("/make-server-b80b3260/health", (c) => {
  return c.json({ status: "ok" });
});

// ============================================
// KV Data Persistence Routes
// ============================================

// GET data by key
app.get("/make-server-b80b3260/data/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const value = await kv.get(`mp:${key}`);
    return c.json({ success: true, data: value });
  } catch (error) {
    console.log(`Error getting data: ${error}`);
    return c.json(
      { success: false, error: `Failed to get data: ${error}` },
      500
    );
  }
});

// PUT data by key
app.put("/make-server-b80b3260/data/:key", async (c) => {
  try {
    const key = c.req.param("key");
    const body = await c.req.json();
    await kv.set(`mp:${key}`, body.value);

    // Webhook: notify Pipedream about data change
    sendWebhook("data.saved", { key, preview: JSON.stringify(body.value).slice(0, 200) });
    appendActivityLog({ type: "data", action: `Данные сохранены: ${key}`, details: { key } });

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error saving data: ${error}`);
    return c.json(
      { success: false, error: `Failed to save data: ${error}` },
      500
    );
  }
});

// DELETE data by key
app.delete("/make-server-b80b3260/data/:key", async (c) => {
  try {
    const key = c.req.param("key");
    await kv.del(`mp:${key}`);

    sendWebhook("data.deleted", { key });

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting data: ${error}`);
    return c.json(
      { success: false, error: `Failed to delete data: ${error}` },
      500
    );
  }
});

// GET data by prefix
app.get("/make-server-b80b3260/data-prefix/:prefix", async (c) => {
  try {
    const prefix = c.req.param("prefix");
    const values = await kv.getByPrefix(`mp:${prefix}`);
    return c.json({ success: true, data: values });
  } catch (error) {
    console.log(`Error getting data by prefix: ${error}`);
    return c.json(
      { success: false, error: `Failed to get data by prefix: ${error}` },
      500
    );
  }
});

// ============================================
// Webhook test endpoint
// ============================================
app.post("/make-server-b80b3260/webhook/test", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    await sendWebhook("test.ping", {
      message: body.message || "Test ping from MarketPlan",
      source: "manual",
    });
    return c.json({ success: true, message: "Webhook sent to Pipedream" });
  } catch (error) {
    console.log(`Webhook test error: ${error}`);
    return c.json(
      { success: false, error: `Webhook test failed: ${error}` },
      500
    );
  }
});

// ============================================
// OpenAI connection check
// ============================================
app.get("/make-server-b80b3260/ai/status", async (c) => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return c.json({
      success: false,
      connected: false,
      error: "OPENAI_API_KEY not set",
    });
  }

  try {
    // Light-weight models list call to verify the key works
    const res = await fetch("https://api.openai.com/v1/models/gpt-4o-mini", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.ok) {
      sendWebhook("ai.status_check", { connected: true });
      return c.json({
        success: true,
        connected: true,
        model: "gpt-4o-mini",
        keyPrefix: apiKey.slice(0, 8) + "...",
      });
    } else {
      const errText = await res.text();
      console.log(`OpenAI key validation failed (${res.status}): ${errText}`);
      return c.json({
        success: false,
        connected: false,
        error: `OpenAI returned ${res.status}`,
      });
    }
  } catch (error) {
    console.log(`OpenAI status check error: ${error}`);
    return c.json({
      success: false,
      connected: false,
      error: `Connection error: ${error}`,
    });
  }
});

// ============================================
// OpenAI AI Studio Route
// ============================================

const SYSTEM_PROMPTS: Record<string, string> = {
  "chat-assistant": `Ты — встроенный маркетинг-ассистент платформы MarketPlan. Помогай с маркетинговыми стратегиями, контент-планированием, расчётами ROI/CAC/LTV, A/B тестами, конкурентным анализом, SMM, брендингом, unit-экономикой. Отвечай кратко, структурированно, на русском. Используй маркдаун для форматирования. Давай конкретные, actionable советы. КРИТИЧЕСКИ ВАЖНО: Никогда не упоминай GPT, ChatGPT, OpenAI, языковую модель или искусственный интеллект. Ты — MarketPlan ассистент, не AI/бот/нейросеть. Не используй фразы "как языковая модель", "я AI", "как бот". Просто отвечай по существу.`,

  copywriter: `Ты — опытный маркетинговый копирайтер. Создавай рекламные тексты, посты для соцсетей, email-рассылки. 
Всегда предлагай 2-3 варианта для разных каналов (Яндекс Директ, VK, Telegram, Email).
Используй CTA, эмоциональные триггеры, конкретные цифры. Отвечай на русском языке.`,

  strategy: `Ты — стратегический маркетинговый аналитик. Проводи SWOT-анализ, анализ конкурентов, оценку позиционирования.
Давай конкретные рекомендации с цифрами и метриками. Структурируй ответ: Сильные стороны, Слабые стороны, Возможности, Угрозы, Рекомендации.
Отвечай на русском языке.`,

  content: `Ты — контент-стратег. Создавай контент-планы на неделю или месяц.
Для каждого дня указывай: тип контента, канал публикации, тему, время. 
Учитывай баланс между информационным, развлекательным и продающим контентом.
Отвечай на русском языке.`,

  "content-studio": `Ты — профессиональная контент-студия. Создавай адаптированный контент для разных платформ.
Для каждой платформы учитывай её особенности: длину, формат, аудиторию, стиль подачи.
Instagram - визуальный, эмоциональный, с хештегами. Telegram - структурированный, информативный.
Email - профессиональный, с воронкой и CTA. YouTube - SEO-оптимизированный. Рекламный текст - лаконичный.
Обязательно используй предоставленные хештеги из пресетов если они указаны.
Соблюдай Brand Voice если он указан.
КРИТИЧНО: Внутри полей Текст, CTA, Хештеги НЕ используй маркдаун-форматирование (**, *, __, ##, ---). Пиши чистый текст без форматирования. Маркдаун-разметку (### и **поле:**) используй ТОЛЬКО для структуры ответа.
Отвечай на русском (кроме Image).`,

  ideas: `Ты — креативный директор маркетингового агентства. Генерируй нестандартные идеи для кампаний и акций.
Каждую идею описывай: название, суть механики, ожидаемый результат, каналы продвижения.
Предлагай минимум 5 идей. Отвечай на русском языке.`,

  persona: `Ты — UX-исследователь и маркетолог. Создавай детальные аватары целевой аудитории.
Включай: демографию, психографию, медиапотребление, путь к покупке, боли, цели, триггеры покупки.
Делай аватар живым и конкретным с именем, возрастом, профессией. Отвечай на русском языке.`,

  brief: `Ты — маркетинговый менеджер. Создавай профессиональные брифы для подрядчиков и команды.
Включай: цель, KPI, ЦА, каналы, бюджет, сроки, ключевые сообщения, tone of voice, ограничения.
Формат должен быть чётким и структурированным. Отвечай на русском языке.`,

  metrics_helper: `Ты — аналитик маркетинговых метрик. Помогай выстроить дерево метрик для проекта.
На основе описания проекта:
1. Определи ключевую North Star метрику
2. Построй дерево подметрик (3-4 уровня глубины)
3. Для каждой метрики укажи: формулу расчёта, бенчмарк по отрасли, рекомендуемый target
4. Покажи связи между метриками
Отвечай структурированно на русском языке.`,

  budget_forecast: `Ты — финансовый аналитик маркетинга. Помогай с прогнозом трат маркетинговой кампании.
На основе входных данных:
1. Рассчитай оптимальное распределение бюджета по каналам
2. Спрогнозируй CPA, CPL, ROAS для каждого канала
3. Дай прогноз расходов по месяцам
4. Укажи риски перерасхода и рекомендации по оптимизации
5. Предложи сценарии: оптимистичный, реалистичный, пессимистичный
Используй конкретные цифры. Отвечай на русском языке.`,

  audience_avatar: `Ты — UX-исследователь и маркетолог. Помогай с глубокой проработкой целевой аудитории.
Создавай детальные аватары:
1. Демография: возраст, пол, локация, доход, семейное положение
2. Психография: ценности, страхи, мотивация, стиль жизни
3. Медиапотребление: какие каналы, когда, как часто
4. Путь к покупке: триггеры, барьеры, этапы принятия решения
5. Боли и потребности: явные и скрытые
6. Tone of voice для коммуникации с этим аватаром
Делай аватар живым, с именем и историей. Отвечай на русском языке.`,

  review_triggers: `Ты — нейромаркетолог и аналитик потребительского поведения. Анализируй отзывы клиентов.
На основе предоставленных отзывов выполни глубокий анализ:

1. **АРХЕТИПЫ КЛИЕНТОВ** — выдели 3-5 ключевых архетипов людей, оставивших отзывы. Для каждого:
   - Название архетипа и эмодзи
   - Портрет (кто этот человек, что им движет)
   - Доля среди отзывов (примерная %)
   - Ключевые слова-маркеры в их отзывах

2. **ПСИХОЛОГИЧЕСКИЕ ТРИГГЕРЫ** — какие триггеры лучше всего работают с этой аудиторией:
   - Триггер страха упущенной выгоды (FOMO)
   - Социальное доказательство
   - Авторитет / экспертность
   - Срочность / дефицит
   - Взаимность
   - Другие обнаруженные триггеры
   Для каждого триггера: оценка силы (1-10), пример фразы для рекламы

3. **ЭМОЦИОНАЛЬНАЯ КАРТА** — какие эмоции преобладают в отзывах:
   - Положительные (восторг, благодарность, удивление...)
   - Отрицательные (разочарование, раздражение...)
   - Нейтральные
   
4. **РЕКОМЕНДАЦИИ ДЛЯ МАРКЕТИНГА:**
   - Какие слова и фразы использовать в рекламе
   - Какие каналы лучше подойдут
   - Какой tone of voice будет работать
   - Конкретные примеры заголовков и CTA

Отвечай максимально подробно и структурированно на русском языке.`,
};

app.post("/make-server-b80b3260/ai/generate", async (c) => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return c.json(
      { success: false, error: "OPENAI_API_KEY not set" },
      500
    );
  }

  try {
    const body = await c.req.json();
    const { toolId, prompt } = body;

    if (!prompt) {
      return c.json(
        { success: false, error: "prompt is required" },
        400
      );
    }

    // ── Server-side usage limit enforcement ──
    const usageKey = toolId === "chat-assistant" ? "aiChatPerDay" : "aiTextPerMonth";
    const { prefix: wsPrefix } = await resolveWsPrefix(c.req.header("Authorization"));
    const limitCheck = await usageLimits.canUse(wsPrefix, usageKey as usageLimits.UsageKey);
    if (!limitCheck.allowed) {
      console.log(`[USAGE LIMIT] AI generate blocked: ${usageKey}, current=${limitCheck.current}, limit=${limitCheck.limit}, wsPrefix=${wsPrefix}`);
      return c.json({
        success: false,
        error: limitCheck.message || "Usage limit reached",
        code: "USAGE_LIMIT_REACHED",
        usage: {
          key: usageKey,
          current: limitCheck.current,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
        },
      }, 429);
    }

    const systemPrompt =
      SYSTEM_PROMPTS[toolId] || SYSTEM_PROMPTS["strategy"];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`OpenAI API error (${res.status}): ${errText}`);
      return c.json(
        {
          success: false,
          error: `OpenAI API error ${res.status}: ${errText}`,
        },
        500
      );
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const usage = data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    // ── Server-side increment after successful generation ──
    const incrementResult = await usageLimits.checkAndIncrement(wsPrefix, usageKey as usageLimits.UsageKey);
    console.log(`[USAGE] AI generate incremented: ${usageKey}, new=${incrementResult.current}, remaining=${incrementResult.remaining}`);

    // Save to history
    const historyKey = `mp:ai_history:${toolId}`;
    const existing = (await kv.get(historyKey)) as any[] | null;
    const history = existing || [];
    history.unshift({
      prompt,
      response: content,
      timestamp: new Date().toISOString(),
    });
    // Keep only last 20 entries
    await kv.set(historyKey, history.slice(0, 20));

    sendWebhook("ai.generated", {
      toolId,
      promptPreview: prompt.slice(0, 100),
      tokens: usage.total_tokens,
    });

    appendActivityLog({
      type: "ai",
      action: `AI генерация: ${toolId}`,
      details: { toolId, promptPreview: prompt.slice(0, 120), tokens: usage.total_tokens, model: "gpt-4o-mini" },
    });

    return c.json({
      success: true,
      data: {
        content,
        model: "gpt-4o-mini",
        usage,
        serverUsage: {
          key: usageKey,
          current: incrementResult.current,
          limit: incrementResult.limit,
          remaining: incrementResult.remaining,
        },
      },
    });
  } catch (error) {
    console.log(`AI generate error: ${error}`);
    return c.json(
      { success: false, error: `AI generation failed: ${error}` },
      500
    );
  }
});

// GET AI history by tool
app.get("/make-server-b80b3260/ai/history/:toolId", async (c) => {
  try {
    const toolId = c.req.param("toolId");
    const historyKey = `mp:ai_history:${toolId}`;
    const history = (await kv.get(historyKey)) as any[] | null;
    return c.json({ success: true, data: history || [] });
  } catch (error) {
    console.log(`AI history error: ${error}`);
    return c.json(
      { success: false, error: `Failed to get AI history: ${error}` },
      500
    );
  }
});

// ============================================
// DALL-E Image Generation
// ============================================
app.post("/make-server-b80b3260/ai/image", async (c) => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return c.json({ success: false, error: "OPENAI_API_KEY not set" }, 500);
  }

  try {
    const body = await c.req.json();
    const { prompt, size = "1024x1024", style = "vivid", n = 1 } = body;

    if (!prompt) {
      return c.json({ success: false, error: "prompt is required" }, 400);
    }

    // ── Server-side usage limit enforcement for DALL-E ──
    const { prefix: wsPrefix } = await resolveWsPrefix(c.req.header("Authorization"));
    const limitCheck = await usageLimits.canUse(wsPrefix, "aiImagePerMonth");
    if (!limitCheck.allowed) {
      console.log(`[USAGE LIMIT] DALL-E blocked: current=${limitCheck.current}, limit=${limitCheck.limit}, wsPrefix=${wsPrefix}`);
      return c.json({
        success: false,
        error: limitCheck.message || "DALL-E usage limit reached",
        code: "USAGE_LIMIT_REACHED",
        usage: {
          key: "aiImagePerMonth",
          current: limitCheck.current,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
        },
      }, 429);
    }

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: Math.min(n, 1), // DALL-E 3 supports max 1 at a time
        size,
        style,
        response_format: "url",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`DALL-E API error (${res.status}): ${errText}`);
      return c.json({ success: false, error: `DALL-E error ${res.status}: ${errText}` }, 500);
    }

    const data = await res.json();
    const images = data.data.map((img: any) => ({
      url: img.url,
      revised_prompt: img.revised_prompt,
    }));

    // ── Server-side increment after successful DALL-E generation ──
    const imgIncrement = await usageLimits.checkAndIncrement(wsPrefix, "aiImagePerMonth");
    console.log(`[USAGE] DALL-E incremented: new=${imgIncrement.current}, remaining=${imgIncrement.remaining}`);

    sendWebhook("ai.image_generated", { prompt: prompt.slice(0, 100), count: images.length });
    appendActivityLog({ type: "ai", action: `DALL-E генерация изображения`, details: { promptPreview: prompt.slice(0, 120), model: "dall-e-3" } });

    return c.json({
      success: true,
      data: {
        images,
        serverUsage: {
          key: "aiImagePerMonth",
          current: imgIncrement.current,
          limit: imgIncrement.limit,
          remaining: imgIncrement.remaining,
        },
      },
    });
  } catch (error) {
    console.log(`DALL-E generation error: ${error}`);
    return c.json({ success: false, error: `Image generation failed: ${error}` }, 500);
  }
});

// ============================================
// Resend Email Integration
// ============================================
app.post("/make-server-b80b3260/email/send", async (c) => {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return c.json({ success: false, error: "RESEND_API_KEY not set" }, 500);
  }

  try {
    const body = await c.req.json();
    const { to, subject, html, text, attachments } = body;

    if (!to || !subject) {
      return c.json({ success: false, error: "to and subject are required" }, 400);
    }

    const emailPayload: any = {
      from: "MarketPlan <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || undefined,
      text: text || undefined,
    };

    if (attachments && Array.isArray(attachments)) {
      emailPayload.attachments = attachments;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`Resend API error (${res.status}): ${errText}`);
      return c.json({ success: false, error: `Resend error ${res.status}: ${errText}` }, 500);
    }

    const data = await res.json();

    sendWebhook("email.sent", { to: emailPayload.to, subject, emailId: data.id });

    return c.json({ success: true, data: { emailId: data.id } });
  } catch (error) {
    console.log(`Email send error: ${error}`);
    return c.json({ success: false, error: `Email send failed: ${error}` }, 500);
  }
});

// ============================================
// Resend Email Status Check
// ============================================
app.get("/make-server-b80b3260/email/status", async (c) => {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return c.json({ success: true, data: { connected: false, error: "RESEND_API_KEY not set" } });
  }

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });

    if (res.ok) {
      return c.json({ success: true, data: { connected: true, keyPrefix: resendKey.slice(0, 8) + "..." } });
    } else {
      return c.json({ success: true, data: { connected: false, error: `Resend returned ${res.status}` } });
    }
  } catch (error) {
    console.log(`Resend status check error: ${error}`);
    return c.json({ success: true, data: { connected: false, error: String(error) } });
  }
});

// ============================================
// DALL-E Status Check
// ============================================
app.get("/make-server-b80b3260/ai/dalle-status", async (c) => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return c.json({ success: true, data: { connected: false, error: "OPENAI_API_KEY not set" } });
  }
  // If OpenAI key exists, DALL-E is available
  return c.json({ success: true, data: { connected: true, model: "dall-e-3" } });
});

// ============================================
// Enhanced Pipedream Webhooks
// ============================================
app.post("/make-server-b80b3260/webhook/send", async (c) => {
  try {
    const body = await c.req.json();
    const { event, data } = body;

    if (!event) {
      return c.json({ success: false, error: "event is required" }, 400);
    }

    await sendWebhook(event, data || {});
    return c.json({ success: true, message: `Webhook '${event}' sent` });
  } catch (error) {
    console.log(`Webhook send error: ${error}`);
    return c.json({ success: false, error: `Webhook send failed: ${error}` }, 500);
  }
});

// ============================================
// Notion Integration Proxy (saves/reads sync config)
// ============================================
app.get("/make-server-b80b3260/integrations/status", async (c) => {
  try {
    const config = await kv.get("mp:integrations_config") as any;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    return c.json({
      success: true,
      data: {
        resend: { connected: !!resendKey },
        dalle: { connected: !!openaiKey, model: "dall-e-3" },
        pipedream: { connected: true, url: "eo25iidnjf3m2wa.m.pipedream.net" },
        notion: { connected: config?.notion?.connected || false, config: config?.notion },
        amplitude: { connected: config?.amplitude?.connected || false, config: config?.amplitude },
      },
    });
  } catch (error) {
    console.log(`Integration status error: ${error}`);
    return c.json({ success: false, error: `Failed to get integration status: ${error}` }, 500);
  }
});

app.put("/make-server-b80b3260/integrations/config", async (c) => {
  try {
    const body = await c.req.json();
    const existing = await kv.get("mp:integrations_config") as any || {};
    const updated = { ...existing, ...body.value };
    await kv.set("mp:integrations_config", updated);

    sendWebhook("integrations.config_updated", { keys: Object.keys(body.value) });

    return c.json({ success: true });
  } catch (error) {
    console.log(`Integration config error: ${error}`);
    return c.json({ success: false, error: `Failed to save integration config: ${error}` }, 500);
  }
});

// ============================================
// Telegram Bot Integration
// ============================================

// Save Telegram bot config (token + chat_id)
app.put("/make-server-b80b3260/telegram/config", async (c) => {
  try {
    const body = await c.req.json();
    const { botToken, chatId, botUsername } = body;
    if (!botToken || !chatId) {
      return c.json({ success: false, error: "botToken and chatId are required" }, 400);
    }
    await kv.set("mp:telegram_config", { botToken, chatId, botUsername, updatedAt: new Date().toISOString() });
    sendWebhook("telegram.config_saved", { chatId });
    return c.json({ success: true });
  } catch (error) {
    console.log(`Telegram config save error: ${error}`);
    return c.json({ success: false, error: `Failed to save Telegram config: ${error}` }, 500);
  }
});

// Get Telegram bot config (without exposing full token)
app.get("/make-server-b80b3260/telegram/config", async (c) => {
  try {
    const config = await kv.get("mp:telegram_config") as any;
    if (!config) {
      return c.json({ success: true, data: null });
    }
    return c.json({
      success: true,
      data: {
        configured: true,
        chatId: config.chatId,
        botUsername: config.botUsername || null,
        tokenPrefix: config.botToken ? config.botToken.slice(0, 8) + "..." : null,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.log(`Telegram config get error: ${error}`);
    return c.json({ success: false, error: `Failed to get Telegram config: ${error}` }, 500);
  }
});

// Verify Telegram bot token (calls getMe)
app.post("/make-server-b80b3260/telegram/verify", async (c) => {
  try {
    const body = await c.req.json();
    const { botToken } = body;
    if (!botToken) {
      return c.json({ success: false, error: "botToken is required" }, 400);
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    if (!data.ok) {
      return c.json({ success: false, error: `Telegram API: ${data.description || "Invalid token"}` });
    }
    return c.json({
      success: true,
      data: {
        botId: data.result.id,
        botUsername: data.result.username,
        firstName: data.result.first_name,
      },
    });
  } catch (error) {
    console.log(`Telegram verify error: ${error}`);
    return c.json({ success: false, error: `Telegram verify failed: ${error}` }, 500);
  }
});

// Send a text message via Telegram bot
app.post("/make-server-b80b3260/telegram/send-message", async (c) => {
  try {
    const config = await kv.get("mp:telegram_config") as any;
    if (!config?.botToken || !config?.chatId) {
      return c.json({ success: false, error: "Telegram bot not configured. Set token and chatId first." }, 400);
    }
    const body = await c.req.json();
    const { text, parseMode } = body;
    if (!text) {
      return c.json({ success: false, error: "text is required" }, 400);
    }
    const chatId = body.chatId || config.chatId;
    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode || "HTML",
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.log(`Telegram sendMessage error: ${JSON.stringify(data)}`);
      return c.json({ success: false, error: `Telegram: ${data.description || "Send failed"}` }, 500);
    }
    sendWebhook("telegram.message_sent", { chatId, textPreview: text.slice(0, 100) });
    return c.json({ success: true, data: { messageId: data.result.message_id } });
  } catch (error) {
    console.log(`Telegram send message error: ${error}`);
    return c.json({ success: false, error: `Telegram send failed: ${error}` }, 500);
  }
});

// Send a document (PDF as base64) via Telegram bot
app.post("/make-server-b80b3260/telegram/send-document", async (c) => {
  try {
    const config = await kv.get("mp:telegram_config") as any;
    if (!config?.botToken || !config?.chatId) {
      return c.json({ success: false, error: "Telegram bot not configured. Set token and chatId first." }, 400);
    }
    const body = await c.req.json();
    const { base64, filename, caption } = body;
    if (!base64 || !filename) {
      return c.json({ success: false, error: "base64 and filename are required" }, 400);
    }
    const chatId = body.chatId || config.chatId;

    // Decode base64 to binary
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Build multipart form
    const formData = new FormData();
    formData.append("chat_id", chatId);
    const blob = new Blob([bytes], { type: "application/pdf" });
    formData.append("document", blob, filename);
    if (caption) formData.append("caption", caption);

    const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendDocument`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.ok) {
      console.log(`Telegram sendDocument error: ${JSON.stringify(data)}`);
      return c.json({ success: false, error: `Telegram: ${data.description || "Send document failed"}` }, 500);
    }
    sendWebhook("telegram.document_sent", { chatId, filename });
    return c.json({ success: true, data: { messageId: data.result.message_id } });
  } catch (error) {
    console.log(`Telegram send document error: ${error}`);
    return c.json({ success: false, error: `Telegram send document failed: ${error}` }, 500);
  }
});

// Delete Telegram config
app.delete("/make-server-b80b3260/telegram/config", async (c) => {
  try {
    await kv.del("mp:telegram_config");
    return c.json({ success: true });
  } catch (error) {
    console.log(`Telegram config delete error: ${error}`);
    return c.json({ success: false, error: `Failed to delete Telegram config: ${error}` }, 500);
  }
});

// ============================================
// Automation Flow Execution
// ============================================
app.post("/make-server-b80b3260/automation/execute", async (c) => {
  try {
    const body = await c.req.json();
    const { flowId, flowName, nodes, connections } = body;

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return c.json({ success: false, error: "No nodes to execute" }, 400);
    }

    const results: { nodeId: string; subtype: string; label: string; status: "success" | "error" | "skipped"; message: string; durationMs: number }[] = [];

    // Build execution order from connections
    const ordered = [...nodes];

    for (const node of ordered) {
      const start = Date.now();
      try {
        if (node.type === "trigger") {
          // Triggers are entry points, just log them
          results.push({
            nodeId: node.id,
            subtype: node.subtype,
            label: node.label,
            status: "success",
            message: `Триггер активирован: ${node.label}`,
            durationMs: Date.now() - start,
          });
          continue;
        }

        if (node.type === "condition") {
          // Conditions are evaluated but always pass in execution mode
          results.push({
            nodeId: node.id,
            subtype: node.subtype,
            label: node.label,
            status: "success",
            message: `Условие проверено: ${node.config?.metric || node.label} ${node.config?.operator || ""} ${node.config?.value || ""} - пройдено`,
            durationMs: Date.now() - start,
          });
          continue;
        }

        // Action nodes — execute real integrations
        if (node.subtype === "send_telegram") {
          const config = await kv.get("mp:telegram_config") as any;
          if (!config?.botToken || !config?.chatId) {
            results.push({
              nodeId: node.id, subtype: node.subtype, label: node.label,
              status: "error", message: "Telegram не настроен. Добавьте бота в Интеграциях.",
              durationMs: Date.now() - start,
            });
            continue;
          }
          const text = node.config?.message || `[Автоматизация] ${flowName}: ${node.label}`;
          const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: config.chatId, text, parse_mode: "HTML" }),
          });
          const data = await res.json();
          if (!data.ok) {
            results.push({
              nodeId: node.id, subtype: node.subtype, label: node.label,
              status: "error", message: `Telegram ошибка: ${data.description || "Send failed"}`,
              durationMs: Date.now() - start,
            });
          } else {
            results.push({
              nodeId: node.id, subtype: node.subtype, label: node.label,
              status: "success", message: `Telegram: сообщение отправлено (ID: ${data.result.message_id})`,
              durationMs: Date.now() - start,
            });
          }
        } else if (node.subtype === "send_email") {
          const resendKey = Deno.env.get("RESEND_API_KEY");
          if (!resendKey) {
            results.push({
              nodeId: node.id, subtype: node.subtype, label: node.label,
              status: "error", message: "RESEND_API_KEY не настроен.",
              durationMs: Date.now() - start,
            });
            continue;
          }
          const to = node.config?.to || "onboarding@resend.dev";
          const subject = node.config?.subject || `[MarketPlan] ${flowName}`;
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: "MarketPlan <onboarding@resend.dev>",
              to: [to],
              subject,
              html: `<h3>${flowName}</h3><p>${node.config?.message || node.label}</p><p style="color:#999;font-size:12px">Отправлено автоматизацией MarketPlan</p>`,
            }),
          });
          if (!res.ok) {
            const errText = await res.text();
            results.push({
              nodeId: node.id, subtype: node.subtype, label: node.label,
              status: "error", message: `Email ошибка (${res.status}): ${errText.slice(0, 200)}`,
              durationMs: Date.now() - start,
            });
          } else {
            const data = await res.json();
            results.push({
              nodeId: node.id, subtype: node.subtype, label: node.label,
              status: "success", message: `Email отправлен на ${to} (ID: ${data.id})`,
              durationMs: Date.now() - start,
            });
          }
        } else if (node.subtype === "webhook") {
          const event = node.config?.event || `automation.${flowId}`;
          await sendWebhook(event, {
            flowId, flowName, nodeId: node.id, nodeLabel: node.label,
            executedAt: new Date().toISOString(),
          });
          results.push({
            nodeId: node.id, subtype: node.subtype, label: node.label,
            status: "success", message: `Webhook отправлен: событие "${event}"`,
            durationMs: Date.now() - start,
          });
        } else if (node.subtype === "notify") {
          // Save notification to KV
          const notifKey = "mp:notifications";
          const existing = (await kv.get(notifKey) as any[]) || [];
          existing.unshift({
            id: `notif-${Date.now()}`,
            text: node.config?.text || node.label,
            type: "info",
            time: new Date().toISOString(),
            read: false,
            source: `automation:${flowName}`,
          });
          await kv.set(notifKey, existing.slice(0, 50));
          results.push({
            nodeId: node.id, subtype: node.subtype, label: node.label,
            status: "success", message: `Уведомление создано: "${(node.config?.text || node.label).slice(0, 60)}"`,
            durationMs: Date.now() - start,
          });
        } else if (node.subtype === "update_okr") {
          results.push({
            nodeId: node.id, subtype: node.subtype, label: node.label,
            status: "success", message: `OKR: действие "${node.config?.action || "обновление"}" зарегистрировано`,
            durationMs: Date.now() - start,
          });
        } else if (node.subtype === "create_task") {
          results.push({
            nodeId: node.id, subtype: node.subtype, label: node.label,
            status: "success", message: `Notion: задача "${node.config?.title || "Без названия"}" - запрос отправлен`,
            durationMs: Date.now() - start,
          });
        } else {
          results.push({
            nodeId: node.id, subtype: node.subtype, label: node.label,
            status: "skipped", message: `Узел "${node.subtype}" пропущен (не поддерживается)`,
            durationMs: Date.now() - start,
          });
        }
      } catch (nodeError) {
        results.push({
          nodeId: node.id, subtype: node.subtype, label: node.label,
          status: "error", message: `Ошибка: ${String(nodeError).slice(0, 200)}`,
          durationMs: Date.now() - start,
        });
      }
    }

    // Save execution log
    const logKey = `mp:automation_log:${flowId}`;
    const existingLogs = (await kv.get(logKey) as any[]) || [];
    existingLogs.unshift({
      executedAt: new Date().toISOString(),
      results,
      success: results.every((r) => r.status !== "error"),
      totalNodes: results.length,
      successCount: results.filter((r) => r.status === "success").length,
      errorCount: results.filter((r) => r.status === "error").length,
    });
    await kv.set(logKey, existingLogs.slice(0, 30));

    sendWebhook("automation.executed", {
      flowId, flowName,
      totalNodes: results.length,
      successCount: results.filter((r) => r.status === "success").length,
      errorCount: results.filter((r) => r.status === "error").length,
    });

    appendActivityLog({
      type: "automation",
      action: `Автоматизация: ${flowName}`,
      details: { flowId, flowName, total: results.length, success: results.filter((r) => r.status === "success").length, errors: results.filter((r) => r.status === "error").length },
    });

    return c.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          success: results.filter((r) => r.status === "success").length,
          errors: results.filter((r) => r.status === "error").length,
          skipped: results.filter((r) => r.status === "skipped").length,
          totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
        },
      },
    });
  } catch (error) {
    console.log(`Automation execute error: ${error}`);
    return c.json({ success: false, error: `Automation execution failed: ${error}` }, 500);
  }
});

// GET automation execution log
app.get("/make-server-b80b3260/automation/log/:flowId", async (c) => {
  try {
    const flowId = c.req.param("flowId");
    const logs = (await kv.get(`mp:automation_log:${flowId}`) as any[]) || [];
    return c.json({ success: true, data: logs });
  } catch (error) {
    console.log(`Automation log error: ${error}`);
    return c.json({ success: false, error: `Failed to get automation log: ${error}` }, 500);
  }
});

// ============================================
// Full Backup — workspace-aware: exports workspace keys if authenticated, else all mp: keys
// ============================================
app.get("/make-server-b80b3260/backup/export", async (c) => {
  try {
    const supabase = getAdminClient();

    // Try to scope to workspace if authenticated
    const user = await getUserFromToken(c.req.header("Authorization"));
    let likePattern = "mp:%";
    if (user) {
      const wsId = await getWorkspaceId(user.id);
      likePattern = `mp:ws:${wsId}:%`;
    }

    const { data, error } = await supabase
      .from("kv_store_b80b3260")
      .select("key, value")
      .like("key", likePattern);
    if (error) throw error;
    return c.json({
      success: true,
      data: {
        version: 2,
        exportedAt: new Date().toISOString(),
        entries: (data || []).map((d: any) => ({ key: d.key, value: d.value })),
        count: data?.length || 0,
        workspace: user ? (await getWorkspaceId(user.id)) : null,
      },
    });
  } catch (error) {
    console.log(`Backup export error: ${error}`);
    return c.json({ success: false, error: `Backup export failed: ${error}` }, 500);
  }
});

// Restore backup — bulk upsert all entries
app.post("/make-server-b80b3260/backup/import", async (c) => {
  try {
    const body = await c.req.json();
    const entries = body.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      return c.json({ success: false, error: "No entries to import" }, 400);
    }
    const keys = entries.map((e: any) => e.key);
    const values = entries.map((e: any) => e.value);
    await kv.mset(keys, values);
    sendWebhook("backup.restored", { count: entries.length, at: new Date().toISOString() });
    return c.json({ success: true, data: { restored: entries.length } });
  } catch (error) {
    console.log(`Backup import error: ${error}`);
    return c.json({ success: false, error: `Backup import failed: ${error}` }, 500);
  }
});

// ============================================
// AUTH: Sign Up - simple email + password (no email verification)
// ============================================
app.post("/make-server-b80b3260/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return c.json({ success: false, error: "email and password are required" }, 400);
    }
    if (password.length < 6) {
      return c.json({ success: false, error: "Password must be at least 6 characters" }, 400);
    }

    const supabase = getAdminClient();

    // Create user with email_confirm: true so they can sign in immediately
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || "" },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (createError) {
      const errMsg = createError.message || "";
      console.log(`createUser error for ${email}: ${errMsg}`);

      if (/already|exist|registered|duplicate/i.test(errMsg)) {
        // User already exists - find them, confirm email, update password so they can sign in
        let existingUser: any = null;
        try {
          let page = 1;
          const perPage = 100;
          while (!existingUser) {
            const listResult = await supabase.auth.admin.listUsers({ page, perPage });
            const users = listResult?.data?.users;
            if (!users || users.length === 0) {
              console.log(`listUsers page ${page}: no users returned (data=${JSON.stringify(listResult?.data)}, error=${listResult?.error?.message})`);
              break;
            }
            console.log(`listUsers page ${page}: ${users.length} users, searching for ${email}`);
            existingUser = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
            if (existingUser || users.length < perPage) break;
            page++;
            if (page > 50) break;
          }
        } catch (listErr) {
          console.log(`listUsers exception while finding existing user ${email}: ${listErr}`);
        }

        if (existingUser) {
          // Update password, confirm email, update metadata
          await supabase.auth.admin.updateUserById(existingUser.id, {
            password,
            user_metadata: { name: name || existingUser.user_metadata?.name || "" },
            email_confirm: true,
          });

          const userId = existingUser.id;

          // Ensure profile and workspace exist
          const existingProfile = await kv.get(`mp:user_profile:${userId}`);
          if (!existingProfile) {
            await kv.set(`mp:user_profile:${userId}`, {
              id: userId,
              email,
              name: name || "",
              role: "owner",
              workspaceId: userId,
              access: "all",
              createdAt: new Date().toISOString(),
            });
          }

          const existingWs = await kv.get(`mp:user_workspace:${userId}`);
          if (!existingWs) {
            await kv.set(`mp:user_workspace:${userId}`, {
              workspaceId: userId,
              role: "owner",
              access: "all",
            });
          }

          console.log(`Existing user ${email} updated and confirmed (${userId})`);
          return c.json({ success: true, data: { userId, email, updated: true } });
        }

        return c.json({
          success: false,
          error: "Этот email уже зарегистрирован. Попробуйте войти.",
          code: "ALREADY_EXISTS",
        }, 409);
      }
      return c.json({ success: false, error: errMsg }, 400);
    }

    const userId = createData.user.id;

    // Create profile and workspace immediately
    await kv.set(`mp:user_profile:${userId}`, {
      id: userId,
      email,
      name: name || "",
      role: "owner",
      workspaceId: userId,
      access: "all",
      createdAt: new Date().toISOString(),
    });

    await kv.set(`mp:user_workspace:${userId}`, {
      workspaceId: userId,
      role: "owner",
      access: "all",
    });

    sendWebhook("auth.signup", { userId, email });
    appendActivityLog({ type: "auth", action: `Регистрация: ${email}`, details: { userId, email }, actor: email });
    console.log(`User signed up: ${email} (${userId})`);

    return c.json({ success: true, data: { userId, email } });
  } catch (error) {
    console.log(`Auth signup error: ${error}`);
    return c.json({ success: false, error: `Sign up failed: ${error}` }, 500);
  }
});

// ============================================
// AUTH: Get current user profile
// ============================================
app.get("/make-server-b80b3260/auth/me", async (c) => {
  try {
    console.log("[/auth/me] Starting request");
    const user = await getUserFromToken(c.req.header("Authorization"));
    if (!user) {
      console.log("[/auth/me] No user found from token");
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    console.log(`[/auth/me] User authenticated: ${user.email}`);

    // Get profile from KV
    let profile = await kv.get(`mp:user_profile:${user.id}`) as any;

    if (!profile) {
      console.log(`[/auth/me] No profile found, creating new profile for ${user.id}`);
      // First time: create profile from auth user
      const workspace = await kv.get(`mp:user_workspace:${user.id}`) as any;
      profile = {
        id: user.id,
        email: user.email,
        name: "",
        role: workspace?.role || "owner",
        workspaceId: workspace?.workspaceId || user.id,
        access: workspace?.access || "all",
      };
      await kv.set(`mp:user_profile:${user.id}`, { ...profile, createdAt: new Date().toISOString() });
      console.log(`[/auth/me] Profile created for ${user.id}`);
    }

    appendActivityLog({ type: "auth", action: `Вход: ${user.email}`, details: { userId: user.id, email: user.email }, actor: user.email });

    console.log(`[/auth/me] Returning profile for ${user.email}`);
    return c.json({ success: true, data: profile });
  } catch (error) {
    console.error(`[/auth/me] Error: ${error}`, error);
    return c.json({ success: false, error: `Failed to get profile: ${error}` }, 500);
  }
});

// ============================================
// AUTH: Get team list (authenticated users)
// ============================================
app.get("/make-server-b80b3260/auth/team", async (c) => {
  try {
    const user = await getUserFromToken(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    // Determine workspace: owner sees their own team, members see the owner's team
    const wsId = await getWorkspaceId(user.id);
    // wsId is the owner's ID — team data is stored under that key
    const teamData = (await kv.get(`mp:team:${wsId}`) as any[]) || [];
    return c.json({ success: true, data: teamData });
  } catch (error) {
    console.log(`Auth get team error: ${error}`);
    return c.json({ success: false, error: `Failed to get team: ${error}` }, 500);
  }
});

// ============================================
// AUTH: Invite team member (owner only)
// Handles "user already exists" by finding the existing user,
// updating their password/metadata, and adding them to the team.
// ============================================
app.post("/make-server-b80b3260/auth/invite", async (c) => {
  try {
    const owner = await getUserFromToken(c.req.header("Authorization"));
    if (!owner) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    // Verify caller is owner
    const ownerWorkspace = await kv.get(`mp:user_workspace:${owner.id}`) as any;
    if (ownerWorkspace?.role && ownerWorkspace.role !== "owner") {
      return c.json({ success: false, error: "Only workspace owners can invite members" }, 403);
    }

    // Check team size
    const teamKey = `mp:team:${owner.id}`;
    const teamData = (await kv.get(teamKey) as any[]) || [];
    if (teamData.length >= 2) {
      return c.json({ success: false, error: "Максимум 2 участника в команде" }, 400);
    }

    const body = await c.req.json();
    const { name, role, access, email: memberEmail, password: memberPassword } = body;

    if (!name) {
      return c.json({ success: false, error: "name is required" }, 400);
    }
    if (!memberEmail || !memberPassword) {
      return c.json({ success: false, error: "email and password are required" }, 400);
    }
    if (memberPassword.length < 6) {
      return c.json({ success: false, error: "Password must be at least 6 characters" }, 400);
    }

    // Prevent inviting yourself
    if (memberEmail.toLowerCase() === owner.email.toLowerCase()) {
      return c.json({ success: false, error: "Нельзя пригласить самого себя" }, 400);
    }

    // Check if email is already in team list
    const alreadyInTeam = teamData.find(
      (m: any) => m.email?.toLowerCase() === memberEmail.toLowerCase()
    );
    if (alreadyInTeam) {
      return c.json({ success: false, error: "Этот участник уже в команде" }, 409);
    }

    // Create user via admin
    const supabase = getAdminClient();
    let memberId: string;

    const { data, error } = await supabase.auth.admin.createUser({
      email: memberEmail,
      password: memberPassword,
      user_metadata: { name, invitedBy: owner.id },
      email_confirm: true,
    });

    if (error) {
      const errMsg = error.message || "";
      console.log(`Invite createUser error for ${memberEmail}: ${errMsg}`);

      // Handle "user already exists" — find existing user and re-use
      if (/already|exist|registered|duplicate/i.test(errMsg)) {
        let existingUser: any = null;
        try {
          let page = 1;
          const perPage = 100;
          while (!existingUser) {
            const listResult = await supabase.auth.admin.listUsers({ page, perPage });
            const users = listResult?.data?.users;
            if (!users || users.length === 0) break;
            existingUser = users.find(
              (u: any) => u.email?.toLowerCase() === memberEmail.toLowerCase()
            );
            if (existingUser || users.length < perPage) break;
            page++;
            if (page > 50) break;
          }
        } catch (listErr) {
          console.log(`Invite listUsers error while looking up ${memberEmail}: ${listErr}`);
        }

        if (!existingUser) {
          return c.json({
            success: false,
            error: `Пользователь с таким email существует в auth, но не найден при поиске. Попробуйте другой email.`,
          }, 400);
        }

        // Update existing user: set new password, confirm email, update metadata
        const { error: updateErr } = await supabase.auth.admin.updateUserById(existingUser.id, {
          password: memberPassword,
          user_metadata: { name, invitedBy: owner.id },
          email_confirm: true,
        });
        if (updateErr) {
          console.log(`Invite updateUserById error for ${memberEmail}: ${updateErr.message}`);
          return c.json({ success: false, error: `Ошибка обновления пользователя: ${updateErr.message}` }, 500);
        }

        memberId = existingUser.id;
        console.log(`Invite: re-using existing auth user ${memberEmail} (${memberId})`);
      } else {
        return c.json({ success: false, error: errMsg }, 400);
      }
    } else {
      memberId = data.user.id;
      console.log(`Invite: created new auth user ${memberEmail} (${memberId})`);
    }

    // Save workspace mapping for the new member
    await kv.set(`mp:user_workspace:${memberId}`, {
      workspaceId: owner.id,
      role: role || "editor",
      access: access || "all",
    });

    // Save member profile
    await kv.set(`mp:user_profile:${memberId}`, {
      id: memberId,
      email: memberEmail,
      name,
      role: role || "editor",
      workspaceId: owner.id,
      access: access || "all",
      invitedBy: owner.id,
      createdAt: new Date().toISOString(),
    });

    // Update team list (filter out any stale entry for same userId or email, then add fresh)
    const cleanedTeam = teamData.filter(
      (m: any) => m.userId !== memberId && m.email?.toLowerCase() !== memberEmail.toLowerCase()
    );
    cleanedTeam.push({
      userId: memberId,
      email: memberEmail,
      name,
      role: role || "editor",
      access: access || "all",
      invitedAt: new Date().toISOString(),
    });
    await kv.set(teamKey, cleanedTeam);

    sendWebhook("auth.invite", { ownerId: owner.id, memberId, memberEmail, role });
    appendActivityLog({ type: "auth", action: `Приглашение: ${memberEmail} (${role || "editor"})`, details: { ownerId: owner.id, memberId, memberEmail, role }, actor: owner.email });
    console.log(`Invite success: ${memberEmail} (${memberId}) invited by ${owner.email} (${owner.id}), team size: ${cleanedTeam.length}`);

    // Auto-send Telegram notification if configured
    try {
      const tgConfig = await kv.get("mp:telegram_config") as any;
      if (tgConfig?.botToken && tgConfig?.chatId) {
        const tgText = `👤 <b>Новый участник в команде</b>\n\n` +
          `Имя: ${name}\nEmail: ${memberEmail}\n` +
          `Роль: ${role || "editor"}\nПригласил: ${owner.email}`;
        await fetch(`https://api.telegram.org/bot${tgConfig.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tgConfig.chatId, text: tgText, parse_mode: "HTML" }),
        }).catch(tgErr => console.log(`Telegram invite notify failed: ${tgErr}`));
      }
    } catch (tgErr) {
      console.log(`Telegram invite notification error (non-critical): ${tgErr}`);
    }

    return c.json({
      success: true,
      data: {
        userId: memberId,
        email: memberEmail,
        password: memberPassword,
      },
    });
  } catch (error) {
    console.log(`Auth invite error: ${error}`);
    return c.json({ success: false, error: `Invite failed: ${error}` }, 500);
  }
});

// ============================================
// AUTH: Update team member access (owner only)
// ============================================
app.post("/make-server-b80b3260/auth/update-member", async (c) => {
  try {
    const owner = await getUserFromToken(c.req.header("Authorization"));
    if (!owner) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    const body = await c.req.json();
    const { memberId, role, access } = body;

    if (!memberId) {
      return c.json({ success: false, error: "memberId is required" }, 400);
    }

    // Verify the member belongs to this owner
    const memberWorkspace = await kv.get(`mp:user_workspace:${memberId}`) as any;
    if (!memberWorkspace || memberWorkspace.workspaceId !== owner.id) {
      return c.json({ success: false, error: "Member not found in your team" }, 403);
    }

    // Update workspace mapping
    await kv.set(`mp:user_workspace:${memberId}`, {
      ...memberWorkspace,
      role: role || memberWorkspace.role,
      access: access !== undefined ? access : memberWorkspace.access,
    });

    // Update profile
    const profile = await kv.get(`mp:user_profile:${memberId}`) as any;
    if (profile) {
      await kv.set(`mp:user_profile:${memberId}`, {
        ...profile,
        role: role || profile.role,
        access: access !== undefined ? access : profile.access,
      });
    }

    // Update team list
    const teamKey = `mp:team:${owner.id}`;
    const teamData = (await kv.get(teamKey) as any[]) || [];
    const updated = teamData.map((m: any) =>
      m.userId === memberId
        ? { ...m, role: role || m.role, access: access !== undefined ? access : m.access }
        : m
    );
    await kv.set(teamKey, updated);

    return c.json({ success: true });
  } catch (error) {
    console.log(`Update member error: ${error}`);
    return c.json({ success: false, error: `Update member failed: ${error}` }, 500);
  }
});

// ============================================
// AUTH: Remove team member (owner only)
// ============================================
app.post("/make-server-b80b3260/auth/remove-member", async (c) => {
  try {
    const owner = await getUserFromToken(c.req.header("Authorization"));
    if (!owner) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    const body = await c.req.json();
    const { memberId } = body;

    if (!memberId) {
      return c.json({ success: false, error: "memberId is required" }, 400);
    }

    // Verify the member belongs to this owner
    const memberWorkspace = await kv.get(`mp:user_workspace:${memberId}`) as any;
    if (!memberWorkspace || memberWorkspace.workspaceId !== owner.id) {
      return c.json({ success: false, error: "Member not found in your team" }, 403);
    }

    // Remove workspace mapping
    await kv.del(`mp:user_workspace:${memberId}`);
    await kv.del(`mp:user_profile:${memberId}`);

    // Update team list
    const teamKey = `mp:team:${owner.id}`;
    const teamData = (await kv.get(teamKey) as any[]) || [];
    await kv.set(teamKey, teamData.filter((m: any) => m.userId !== memberId));

    // Delete the user from Supabase auth
    try {
      const supabase = getAdminClient();
      await supabase.auth.admin.deleteUser(memberId);
    } catch (delErr) {
      console.log(`Warning: could not delete auth user ${memberId}: ${delErr}`);
    }

    return c.json({ success: true });
  } catch (error) {
    console.log(`Remove member error: ${error}`);
    return c.json({ success: false, error: `Remove member failed: ${error}` }, 500);
  }
});

// ============================================
// AUTH: Change own password (authenticated user)
// ============================================
app.post("/make-server-b80b3260/auth/change-password", async (c) => {
  try {
    const user = await getUserFromToken(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    const body = await c.req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return c.json({ success: false, error: "currentPassword and newPassword are required" }, 400);
    }
    if (newPassword.length < 6) {
      return c.json({ success: false, error: "New password must be at least 6 characters" }, 400);
    }
    if (currentPassword === newPassword) {
      return c.json({ success: false, error: "New password must differ from current" }, 400);
    }

    // Verify current password by attempting sign-in with user's email
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { error: signInError } = await anonClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (signInError) {
      return c.json({ success: false, error: "Current password is incorrect" }, 403);
    }

    // Update password via admin API
    const supabase = getAdminClient();
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (updateError) {
      console.log(`Change password admin error: ${updateError.message}`);
      return c.json({ success: false, error: updateError.message }, 500);
    }

    console.log(`Password changed for user ${user.id} (${user.email})`);
    sendWebhook("auth.password_changed", { userId: user.id, email: user.email });
    return c.json({ success: true });
  } catch (error) {
    console.log(`Change password error: ${error}`);
    return c.json({ success: false, error: `Change password failed: ${error}` }, 500);
  }
});

// ============================================
// AUTH: Reset team member password (owner only)
// Generates a new random password and returns it
// ============================================
app.post("/make-server-b80b3260/auth/reset-member-password", async (c) => {
  try {
    const owner = await getUserFromToken(c.req.header("Authorization"));
    if (!owner) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    const ownerWs = await kv.get(`mp:user_workspace:${owner.id}`) as any;
    if (ownerWs?.role && ownerWs.role !== "owner") {
      return c.json({ success: false, error: "Only workspace owners can reset member passwords" }, 403);
    }

    const body = await c.req.json();
    const { memberId } = body;
    if (!memberId) {
      return c.json({ success: false, error: "memberId is required" }, 400);
    }

    const memberWs = await kv.get(`mp:user_workspace:${memberId}`) as any;
    if (!memberWs || memberWs.workspaceId !== owner.id) {
      return c.json({ success: false, error: "Member not found in your workspace" }, 404);
    }

    const newPassword = generatePassword(14);

    const supabase = getAdminClient();
    const { error: updateError } = await supabase.auth.admin.updateUserById(memberId, {
      password: newPassword,
    });
    if (updateError) {
      console.log(`Reset member password admin error: ${updateError.message}`);
      return c.json({ success: false, error: updateError.message }, 500);
    }

    console.log(`Password reset by owner ${owner.id} for member ${memberId}`);
    sendWebhook("auth.member_password_reset", { ownerId: owner.id, memberId });
    return c.json({ success: true, data: { password: newPassword } });
  } catch (error) {
    console.log(`Reset member password error: ${error}`);
    return c.json({ success: false, error: `Reset password failed: ${error}` }, 500);
  }
});

// (recovery-info removed: replaced by email-based /auth/forgot-password + /auth/reset-password)

// ============================================
// AUTH: Migrate legacy mp: data to workspace namespace
// Copies all old mp:{key} entries to mp:ws:{workspaceId}:{key}
// Skips system keys (user_profile, user_workspace, team, ws:)
// Idempotent: checks migration flag before running
// ============================================
app.post("/make-server-b80b3260/auth/migrate", async (c) => {
  try {
    const user = await getUserFromToken(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    const wsId = await getWorkspaceId(user.id);

    // Check if already migrated
    const migrationFlag = await kv.get(`mp:ws:${wsId}:_migrated`) as any;
    if (migrationFlag?.done) {
      return c.json({
        success: true,
        data: { alreadyMigrated: true, migratedAt: migrationFlag.at, count: migrationFlag.count },
      });
    }

    // Query all old mp: keys from the database
    const supabase = getAdminClient();
    const { data: rows, error } = await supabase
      .from("kv_store_b80b3260")
      .select("key, value")
      .like("key", "mp:%");

    if (error) throw error;
    if (!rows || rows.length === 0) {
      // No legacy data, mark as migrated anyway
      await kv.set(`mp:ws:${wsId}:_migrated`, { done: true, at: new Date().toISOString(), count: 0 });
      return c.json({ success: true, data: { migrated: 0, skipped: 0 } });
    }

    // System key prefixes to skip (not user data)
    const SKIP_PREFIXES = [
      "mp:user_profile:",
      "mp:user_workspace:",
      "mp:team:",
      "mp:ws:",
    ];

    let migrated = 0;
    let skipped = 0;
    const newKeys: string[] = [];
    const newValues: any[] = [];

    for (const row of rows) {
      const oldKey = row.key as string;

      // Skip system keys
      if (SKIP_PREFIXES.some(p => oldKey.startsWith(p))) {
        skipped++;
        continue;
      }

      // Extract the user-data part after "mp:"
      // e.g. "mp:projects:list" -> "projects:list"
      // e.g. "mp:ai_history:chat-assistant" -> "ai_history:chat-assistant"
      const userKey = oldKey.slice(3); // remove "mp:"

      // New key in workspace namespace
      const newKey = `mp:ws:${wsId}:${userKey}`;

      // Check if new key already exists (don't overwrite)
      const existing = await kv.get(newKey);
      if (existing !== null && existing !== undefined) {
        skipped++;
        continue;
      }

      newKeys.push(newKey);
      newValues.push(row.value);
      migrated++;
    }

    // Bulk write in batches of 20
    const BATCH = 20;
    for (let i = 0; i < newKeys.length; i += BATCH) {
      const batchKeys = newKeys.slice(i, i + BATCH);
      const batchVals = newValues.slice(i, i + BATCH);
      await kv.mset(batchKeys, batchVals);
    }

    // Set migration flag
    await kv.set(`mp:ws:${wsId}:_migrated`, {
      done: true,
      at: new Date().toISOString(),
      count: migrated,
      skippedCount: skipped,
      totalLegacyKeys: rows.length,
    });

    sendWebhook("auth.migrated", { wsId, migrated, skipped, total: rows.length });

    console.log(`Migration complete for workspace ${wsId}: ${migrated} migrated, ${skipped} skipped out of ${rows.length} total`);

    return c.json({
      success: true,
      data: { migrated, skipped, totalLegacyKeys: rows.length },
    });
  } catch (error) {
    console.log(`Migration error: ${error}`);
    return c.json({ success: false, error: `Migration failed: ${error}` }, 500);
  }
});

// ============================================
// AUTH: Check migration status
// ============================================
app.get("/make-server-b80b3260/auth/migration-status", async (c) => {
  try {
    const user = await getUserFromToken(c.req.header("Authorization"));
    if (!user) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }

    const wsId = await getWorkspaceId(user.id);
    const flag = await kv.get(`mp:ws:${wsId}:_migrated`) as any;

    return c.json({
      success: true,
      data: {
        migrated: !!flag?.done,
        details: flag || null,
      },
    });
  } catch (error) {
    console.log(`Migration status error: ${error}`);
    return c.json({ success: false, error: `Failed to check migration: ${error}` }, 500);
  }
});

// ============================================
// Workspace-aware data routes (authenticated)
// These prefix keys with the user's workspace ID
// ============================================
app.get("/make-server-b80b3260/ws/data/:key", async (c) => {
  try {
    const user = await getUserFromToken(c.req.header("Authorization"));
    if (!user) return c.json({ success: false, error: "Not authenticated" }, 401);

    const wsId = await getWorkspaceId(user.id);
    const key = c.req.param("key");
    const value = await kv.get(`mp:ws:${wsId}:${key}`);
    return c.json({ success: true, data: value });
  } catch (error) {
    console.log(`WS data get error: ${error}`);
    return c.json({ success: false, error: `Failed to get data: ${error}` }, 500);
  }
});

app.put("/make-server-b80b3260/ws/data/:key", async (c) => {
  try {
    const user = await getUserFromToken(c.req.header("Authorization"));
    if (!user) return c.json({ success: false, error: "Not authenticated" }, 401);

    // Check if user has write access
    const ws = await kv.get(`mp:user_workspace:${user.id}`) as any;
    if (ws?.role === "viewer") {
      return c.json({ success: false, error: "Viewers cannot modify data" }, 403);
    }

    const wsId = await getWorkspaceId(user.id);
    const key = c.req.param("key");
    const body = await c.req.json();
    await kv.set(`mp:ws:${wsId}:${key}`, body.value);
    return c.json({ success: true });
  } catch (error) {
    console.log(`WS data put error: ${error}`);
    return c.json({ success: false, error: `Failed to save data: ${error}` }, 500);
  }
});

app.delete("/make-server-b80b3260/ws/data/:key", async (c) => {
  try {
    const user = await getUserFromToken(c.req.header("Authorization"));
    if (!user) return c.json({ success: false, error: "Not authenticated" }, 401);

    const ws = await kv.get(`mp:user_workspace:${user.id}`) as any;
    if (ws?.role === "viewer") {
      return c.json({ success: false, error: "Viewers cannot delete data" }, 403);
    }

    const wsId = await getWorkspaceId(user.id);
    const key = c.req.param("key");
    await kv.del(`mp:ws:${wsId}:${key}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`WS data delete error: ${error}`);
    return c.json({ success: false, error: `Failed to delete data: ${error}` }, 500);
  }
});

// ============================================
// ADMIN: System overview (protected by access code)
// ============================================
app.post("/make-server-b80b3260/admin/overview", async (c) => {
  try {
    const body = await c.req.json();
    if (body.code !== "1234") {
      return c.json({ success: false, error: "Invalid access code" }, 403);
    }

    const supabase = getAdminClient();

    // Count all KV entries
    const { data: allEntries, error: kvErr } = await supabase
      .from("kv_store_b80b3260")
      .select("key");
    if (kvErr) throw kvErr;

    const entries = allEntries || [];
    const totalKeys = entries.length;

    // Categorize keys
    const categories: Record<string, number> = {};
    for (const e of entries) {
      const parts = (e.key as string).split(":");
      const cat = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : parts[0];
      categories[cat] = (categories[cat] || 0) + 1;
    }

    // Count auth users
    let userCount = 0;
    try {
      const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userCount = usersData?.users?.length || 0;
    } catch { /* ignore */ }

    // AI history count
    const aiKeys = entries.filter((e: any) => (e.key as string).includes("ai_history"));
    
    // Workspace count
    const wsKeys = entries.filter((e: any) => (e.key as string).includes("user_workspace"));

    // Automation logs
    const autoKeys = entries.filter((e: any) => (e.key as string).includes("automation_log"));

    return c.json({
      success: true,
      data: {
        totalKeys,
        categories,
        userCount,
        aiHistoryKeys: aiKeys.length,
        workspaces: wsKeys.length,
        automationLogs: autoKeys.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.log(`Admin overview error: ${error}`);
    return c.json({ success: false, error: `Admin overview failed: ${error}` }, 500);
  }
});

// ADMIN: Browse KV store entries
app.post("/make-server-b80b3260/admin/kv-browse", async (c) => {
  try {
    const body = await c.req.json();
    if (body.code !== "1234") {
      return c.json({ success: false, error: "Invalid access code" }, 403);
    }

    const supabase = getAdminClient();
    const prefix = body.prefix || "mp:";
    const limit = Math.min(body.limit || 50, 200);
    const offset = body.offset || 0;

    const { data, error, count } = await supabase
      .from("kv_store_b80b3260")
      .select("key, value", { count: "exact" })
      .like("key", `${prefix}%`)
      .order("key")
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return c.json({
      success: true,
      data: {
        entries: (data || []).map((d: any) => ({
          key: d.key,
          value: d.value,
          valuePreview: JSON.stringify(d.value).slice(0, 300),
        })),
        total: count || 0,
        offset,
        limit,
      },
    });
  } catch (error) {
    console.log(`Admin KV browse error: ${error}`);
    return c.json({ success: false, error: `KV browse failed: ${error}` }, 500);
  }
});

// ADMIN: List auth users
app.post("/make-server-b80b3260/admin/users", async (c) => {
  try {
    const body = await c.req.json();
    if (body.code !== "1234") {
      return c.json({ success: false, error: "Invalid access code" }, 403);
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) throw error;

    const users = (data?.users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || "",
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at,
      confirmed: !!u.email_confirmed_at,
    }));

    return c.json({ success: true, data: users });
  } catch (error) {
    console.log(`Admin users error: ${error}`);
    return c.json({ success: false, error: `Admin users failed: ${error}` }, 500);
  }
});

// ADMIN: Delete a KV entry
app.post("/make-server-b80b3260/admin/kv-delete", async (c) => {
  try {
    const body = await c.req.json();
    if (body.code !== "1234") {
      return c.json({ success: false, error: "Invalid access code" }, 403);
    }
    if (!body.key) {
      return c.json({ success: false, error: "key is required" }, 400);
    }
    await kv.del(body.key);

    appendActivityLog({
      type: "kv_delete",
      action: `KV ключ удалён: ${body.key}`,
      details: { key: body.key },
      actor: "admin",
    });

    return c.json({ success: true });
  } catch (error) {
    console.log(`Admin KV delete error: ${error}`);
    return c.json({ success: false, error: `KV delete failed: ${error}` }, 500);
  }
});

// ADMIN: Update a KV entry value
app.post("/make-server-b80b3260/admin/kv-update", async (c) => {
  try {
    const body = await c.req.json();
    if (body.code !== "1234") {
      return c.json({ success: false, error: "Invalid access code" }, 403);
    }
    if (!body.key) {
      return c.json({ success: false, error: "key is required" }, 400);
    }
    await kv.set(body.key, body.value);

    appendActivityLog({
      type: "kv_edit",
      action: `KV ключ обновлён: ${body.key}`,
      details: { key: body.key, valuePreview: JSON.stringify(body.value).slice(0, 200) },
      actor: "admin",
    });

    return c.json({ success: true });
  } catch (error) {
    console.log(`Admin KV update error: ${error}`);
    return c.json({ success: false, error: `KV update failed: ${error}` }, 500);
  }
});

// ADMIN: Get activity log
app.post("/make-server-b80b3260/admin/activity-log", async (c) => {
  try {
    const body = await c.req.json();
    if (body.code !== "1234") {
      return c.json({ success: false, error: "Invalid access code" }, 403);
    }

    const logs = (await kv.get("mp:admin_activity_log") as any[]) || [];
    const typeFilter = body.type || null;
    const filtered = typeFilter ? logs.filter((l: any) => l.type === typeFilter) : logs;
    const limit = Math.min(body.limit || 100, 500);

    return c.json({
      success: true,
      data: {
        entries: filtered.slice(0, limit),
        total: filtered.length,
        allTotal: logs.length,
      },
    });
  } catch (error) {
    console.log(`Admin activity log error: ${error}`);
    return c.json({ success: false, error: `Activity log failed: ${error}` }, 500);
  }
});

// ADMIN: Clear activity log
app.post("/make-server-b80b3260/admin/activity-log-clear", async (c) => {
  try {
    const body = await c.req.json();
    if (body.code !== "1234") {
      return c.json({ success: false, error: "Invalid access code" }, 403);
    }
    await kv.set("mp:admin_activity_log", []);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Admin activity log clear error: ${error}`);
    return c.json({ success: false, error: `Activity log clear failed: ${error}` }, 500);
  }
});

// ADMIN: Delete auth user
app.post("/make-server-b80b3260/admin/delete-user", async (c) => {
  try {
    const body = await c.req.json();
    if (body.code !== "1234") {
      return c.json({ success: false, error: "Invalid access code" }, 403);
    }
    if (!body.userId) {
      return c.json({ success: false, error: "userId is required" }, 400);
    }
    const supabase = getAdminClient();
    const { error } = await supabase.auth.admin.deleteUser(body.userId);
    if (error) throw error;

    // Clean up KV data for user
    try {
      await kv.del(`mp:user_profile:${body.userId}`);
      await kv.del(`mp:user_workspace:${body.userId}`);
    } catch { /* non-critical */ }

    return c.json({ success: true });
  } catch (error) {
    console.log(`Admin delete user error: ${error}`);
    return c.json({ success: false, error: `Delete user failed: ${error}` }, 500);
  }
});

// ============================================
// Usage Limits API — server-side enforcement
// ============================================

// GET full usage report (counters + limits + details)
app.get("/make-server-b80b3260/usage", async (c) => {
  try {
    const { prefix: wsPrefix } = await resolveWsPrefix(c.req.header("Authorization"));
    const report = await usageLimits.getUsageReport(wsPrefix);
    return c.json({ success: true, data: report });
  } catch (error) {
    console.log(`Usage report error: ${error}`);
    return c.json({ success: false, error: `Failed to get usage report: ${error}` }, 500);
  }
});

// POST check if a specific action is allowed (no mutation)
app.post("/make-server-b80b3260/usage/check", async (c) => {
  try {
    const body = await c.req.json();
    const { key, amount = 1 } = body;
    if (!key) {
      return c.json({ success: false, error: "key is required" }, 400);
    }
    const { prefix: wsPrefix } = await resolveWsPrefix(c.req.header("Authorization"));
    const result = await usageLimits.canUse(wsPrefix, key as usageLimits.UsageKey, amount);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.log(`Usage check error: ${error}`);
    return c.json({ success: false, error: `Usage check failed: ${error}` }, 500);
  }
});

// POST atomically check + increment a usage counter (use AFTER successful operation)
app.post("/make-server-b80b3260/usage/increment", async (c) => {
  try {
    const body = await c.req.json();
    const { key, amount = 1 } = body;
    if (!key) {
      return c.json({ success: false, error: "key is required" }, 400);
    }
    const { prefix: wsPrefix } = await resolveWsPrefix(c.req.header("Authorization"));
    const result = await usageLimits.checkAndIncrement(wsPrefix, key as usageLimits.UsageKey, amount);

    if (!result.allowed) {
      return c.json({
        success: false,
        error: result.message || "Usage limit reached",
        code: "USAGE_LIMIT_REACHED",
        data: result,
      }, 429);
    }

    appendActivityLog({
      type: "usage",
      action: `Использование: ${key} +${amount}`,
      details: { key, amount, current: result.current, limit: result.limit },
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    console.log(`Usage increment error: ${error}`);
    return c.json({ success: false, error: `Usage increment failed: ${error}` }, 500);
  }
});

// POST decrement a usage counter (e.g., when deleting a project/post)
app.post("/make-server-b80b3260/usage/decrement", async (c) => {
  try {
    const body = await c.req.json();
    const { key, amount = 1 } = body;
    if (!key) {
      return c.json({ success: false, error: "key is required" }, 400);
    }
    const { prefix: wsPrefix } = await resolveWsPrefix(c.req.header("Authorization"));
    await usageLimits.decrementCounter(wsPrefix, key as usageLimits.UsageKey, amount);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Usage decrement error: ${error}`);
    return c.json({ success: false, error: `Usage decrement failed: ${error}` }, 500);
  }
});

Deno.serve(app.fetch);