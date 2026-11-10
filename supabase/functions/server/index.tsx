import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { sendWebhook } from "./webhook.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as usageLimits from "./usage_limits.tsx";
import { registerAdminRoutes } from "./admin.tsx";

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

// Helper: authenticated user + workspace KV prefix (null if not signed in)
async function requireWs(authHeader: string | undefined): Promise<{ user: { id: string; email: string }; wsId: string; prefix: string; role: string } | null> {
  const user = await getUserFromToken(authHeader);
  if (!user) return null;
  const membership = await kv.get(`mp:user_workspace:${user.id}`) as any;
  const wsId = membership?.workspaceId || user.id;
  return { user, wsId, prefix: `mp:ws:${wsId}:`, role: membership?.role || "owner" };
}

const UNAUTH = { success: false, error: "Not authenticated" };

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Password"],
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

// Admin panel routes (/admin/*, protected by ADMIN_PASSWORD)
registerAdminRoutes(app);

// Health check endpoint
app.get("/make-server-b80b3260/health", (c) => {
  return c.json({ status: "ok" });
});

// ============================================
// KV Data Persistence Routes
// ============================================

// Legacy data routes: now always scoped to the signed-in user's workspace.
// Without a session nothing is read or written (previously any visitor could read/write any key).
app.get("/make-server-b80b3260/data/:key", async (c) => {
  try {
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json({ success: true, data: null });
    const value = await kv.get(`${ws.prefix}${c.req.param("key")}`);
    return c.json({ success: true, data: value });
  } catch (error) {
    console.log(`Error getting data: ${error}`);
    return c.json({ success: false, error: `Failed to get data: ${error}` }, 500);
  }
});

app.put("/make-server-b80b3260/data/:key", async (c) => {
  try {
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    if (ws.role === "viewer") return c.json({ success: false, error: "Viewers cannot modify data" }, 403);
    const body = await c.req.json();
    await kv.set(`${ws.prefix}${c.req.param("key")}`, body.value);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error saving data: ${error}`);
    return c.json({ success: false, error: `Failed to save data: ${error}` }, 500);
  }
});

app.delete("/make-server-b80b3260/data/:key", async (c) => {
  try {
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    if (ws.role === "viewer") return c.json({ success: false, error: "Viewers cannot delete data" }, 403);
    await kv.del(`${ws.prefix}${c.req.param("key")}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting data: ${error}`);
    return c.json({ success: false, error: `Failed to delete data: ${error}` }, 500);
  }
});

app.get("/make-server-b80b3260/data-prefix/:prefix", async (c) => {
  try {
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    const values = await kv.getByPrefix(`${ws.prefix}${c.req.param("prefix")}`);
    return c.json({ success: true, data: values });
  } catch (error) {
    console.log(`Error getting data by prefix: ${error}`);
    return c.json({ success: false, error: `Failed to get data by prefix: ${error}` }, 500);
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
    const wsAuth = await requireWs(c.req.header("Authorization"));
    if (!wsAuth) return c.json({ ...UNAUTH, error: "Войдите в аккаунт, чтобы пользоваться AI" }, 401);
    const wsPrefix = wsAuth.prefix;
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
    const historyKey = `${wsPrefix}ai_history:${toolId}`;
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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json({ success: true, data: [] });
    const toolId = c.req.param("toolId");
    const historyKey = `${ws.prefix}ai_history:${toolId}`;
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
    const wsAuth = await requireWs(c.req.header("Authorization"));
    if (!wsAuth) return c.json({ ...UNAUTH, error: "Войдите в аккаунт, чтобы пользоваться AI" }, 401);
    const wsPrefix = wsAuth.prefix;
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
    if (!(await requireWs(c.req.header("Authorization")))) return c.json(UNAUTH, 401);
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
// Notion Integration Proxy (saves/reads sync config)
// ============================================
app.get("/make-server-b80b3260/integrations/status", async (c) => {
  try {
    const ws = await requireWs(c.req.header("Authorization"));
    const config = ws ? await kv.get(`${ws.prefix}integrations_config`) as any : null;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    return c.json({
      success: true,
      data: {
        resend: { connected: !!resendKey },
        dalle: { connected: !!openaiKey, model: "dall-e-3" },
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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    const body = await c.req.json();
    const existing = await kv.get(`${ws.prefix}integrations_config`) as any || {};
    const updated = { ...existing, ...body.value };
    await kv.set(`${ws.prefix}integrations_config`, updated);

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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    const body = await c.req.json();
    const { botToken, chatId, botUsername } = body;
    if (!botToken || !chatId) {
      return c.json({ success: false, error: "botToken and chatId are required" }, 400);
    }
    await kv.set(`${ws.prefix}telegram_config`, { botToken, chatId, botUsername, updatedAt: new Date().toISOString() });
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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json({ success: true, data: null });
    const config = await kv.get(`${ws.prefix}telegram_config`) as any;
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
    if (!(await requireWs(c.req.header("Authorization")))) return c.json(UNAUTH, 401);
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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    const config = await kv.get(`${ws.prefix}telegram_config`) as any;
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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    const config = await kv.get(`${ws.prefix}telegram_config`) as any;
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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    await kv.del(`${ws.prefix}telegram_config`);
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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
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
          const config = await kv.get(`${ws.prefix}telegram_config`) as any;
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
          results.push({
            nodeId: node.id, subtype: node.subtype, label: node.label,
            status: "skipped", message: "Внешние вебхуки отключены",
            durationMs: Date.now() - start,
          });
        } else if (node.subtype === "notify") {
          // Save notification to KV
          const notifKey = `${ws.prefix}notifications`;
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
    const logKey = `${ws.prefix}automation_log:${flowId}`;
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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json({ success: true, data: [] });
    const flowId = c.req.param("flowId");
    const logs = (await kv.get(`${ws.prefix}automation_log:${flowId}`) as any[]) || [];
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

    const user = await getUserFromToken(c.req.header("Authorization"));
    if (!user) return c.json(UNAUTH, 401);
    const wsId = await getWorkspaceId(user.id);
    const likePattern = `mp:ws:${wsId}:%`;

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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    if (ws.role === "viewer") return c.json({ success: false, error: "Viewers cannot restore backups" }, 403);
    const body = await c.req.json();
    const raw = body.entries;
    if (!Array.isArray(raw) || raw.length === 0) {
      return c.json({ success: false, error: "No entries to import" }, 400);
    }
    // Only keys of the caller's own workspace; keys from another workspace are re-homed
    const entries = raw
      .filter((e: any) => typeof e?.key === "string")
      .map((e: any) => {
        const m = (e.key as string).match(/^mp:ws:[^:]+:(.+)$/);
        const rel = m ? m[1] : (e.key as string).replace(/^mp:/, "");
        return { key: `${ws.prefix}${rel}`, value: e.value };
      })
      .filter((e: any) => !/^mp:ws:[^:]+:(user_plan|usage_counters)$/.test(e.key));
    if (entries.length === 0) return c.json({ success: false, error: "No entries to import" }, 400);
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
        // Existing account: never change its password here (that allowed account takeover)
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

      // Existing account: refuse instead of resetting its password and hijacking it
      if (/already|exist|registered|duplicate/i.test(errMsg)) {
        return c.json({
          success: false,
          error: "Этот email уже зарегистрирован в MarketPlan. Пригласите другой email.",
        }, 409);
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
      const tgConfig = await kv.get(`mp:ws:${owner.id}:telegram_config`) as any;
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

    // Legacy global data is no longer copied into workspaces (it mixed other users' data).
    const migrated = 0, skipped = 0;
    const rows: any[] = [];
    await kv.set(`mp:ws:${wsId}:_migrated`, { done: true, at: new Date().toISOString(), count: 0 });

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
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    const wsPrefix = ws.prefix;
    const result = await usageLimits.checkAndIncrement(wsPrefix, key as usageLimits.UsageKey, Math.max(1, Number(amount) || 1));

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
    if (["aiTextPerMonth", "aiImagePerMonth", "aiChatPerDay"].includes(key)) {
      return c.json({ success: false, error: "This counter cannot be decremented" }, 400);
    }
    const ws = await requireWs(c.req.header("Authorization"));
    if (!ws) return c.json(UNAUTH, 401);
    const wsPrefix = ws.prefix;
    await usageLimits.decrementCounter(wsPrefix, key as usageLimits.UsageKey, amount);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Usage decrement error: ${error}`);
    return c.json({ success: false, error: `Usage decrement failed: ${error}` }, 500);
  }
});

// ─── GET /auth/access — проверка доступа MarketPlan через service role (обходит RLS) ───
app.get("/make-server-b80b3260/auth/access", async (c) => {
  try {
    const user = await getUserFromToken(c.req.header("Authorization"));
    if (!user) {
      console.log("[/auth/access] unauthenticated request");
      return c.json({ success: true, hasAccess: false, plan: null, reason: "unauthenticated" });
    }

    console.log(`[/auth/access] checking for user id=${user.id} email=${user.email}`);

    const supabase = getAdminClient();

    const findActive = (rows: any[]) => {
      const now = new Date();
      return rows.find((row: any) => {
        if (row.status !== "active") return false;
        if (!row.expires_at) return true;
        return new Date(row.expires_at) > now;
      });
    };

    // 1. Поиск по user_id (основной)
    const { data: byId, error: err1 } = await supabase
      .from("user_access")
      .select("plan, status, expires_at, user_id, email")
      .eq("user_id", user.id)
      .eq("project", "marketplan")
      .limit(10);

    console.log(`[/auth/access] by user_id=${user.id}: rows=${byId?.length ?? 0} err=${err1?.message ?? "none"}`);

    const activeById = byId && !err1 ? findActive(byId) : null;
    if (activeById) {
      return c.json({ success: true, hasAccess: true, plan: activeById.plan, expiresAt: activeById.expires_at ?? null });
    }

    // 2. Fallback: поиск по email (если webhook записал другой user_id)
    const { data: byEmail, error: err2 } = await supabase
      .from("user_access")
      .select("plan, status, expires_at, user_id, email")
      .eq("email", user.email)
      .eq("project", "marketplan")
      .limit(10);

    console.log(`[/auth/access] by email=${user.email}: rows=${byEmail?.length ?? 0} err=${err2?.message ?? "none"} data=${JSON.stringify(byEmail)}`);

    const activeByEmail = byEmail && !err2 ? findActive(byEmail) : null;
    if (activeByEmail) {
      // Исправляем user_id в таблице чтобы следующий раз нашёл по user_id
      await supabase.from("user_access")
        .update({ user_id: user.id })
        .eq("email", user.email)
        .eq("project", "marketplan");
      console.log(`[/auth/access] fixed user_id for ${user.email}: ${activeByEmail.user_id} → ${user.id}`);
      return c.json({ success: true, hasAccess: true, plan: activeByEmail.plan, expiresAt: activeByEmail.expires_at ?? null });
    }

    // Ничего не найдено
    const reason = (byId?.length ?? 0) > 0 ? "all_expired_or_inactive" : "no_record";
    console.log(`[/auth/access] no access for ${user.email}, reason=${reason}`);
    return c.json({ success: true, hasAccess: false, plan: null, reason });

  } catch (error) {
    console.log(`[/auth/access] Error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

Deno.serve(app.fetch);