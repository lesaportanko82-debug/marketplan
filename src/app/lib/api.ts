import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b80b3260`;

// Auth token management - set by useAuth when user signs in
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${_authToken || publicAnonKey}`,
});

// ============================================
// Retry helper for cold-start resilience
// ============================================

async function fetchWithRetry(
  input: RequestInfo,
  init?: RequestInit,
  retries = 3,
  delayMs = 1000
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(input, init);
      return res;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      console.warn(
        `Fetch attempt ${attempt + 1}/${retries} failed, retrying in ${delayMs}ms...`
      );
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 1.5; // back-off
    }
  }
  throw new Error("fetchWithRetry: unreachable");
}

// ============================================
// KV Data Persistence
// ============================================

export async function getData<T = any>(key: string): Promise<T | null> {
  try {
    // Use workspace-scoped route when authenticated
    const prefix = _authToken ? "ws/data" : "data";
    const res = await fetchWithRetry(
      `${BASE_URL}/${prefix}/${encodeURIComponent(key)}`,
      { headers: headers() }
    );
    const json = await res.json();
    if (!json.success) {
      console.error(`getData error for key=${key}:`, json.error);
      return null;
    }
    return json.data as T;
  } catch (err) {
    console.error(`getData network error for key=${key}:`, err);
    return null;
  }
}

export async function saveData(key: string, value: any): Promise<boolean> {
  try {
    const prefix = _authToken ? "ws/data" : "data";
    const res = await fetchWithRetry(
      `${BASE_URL}/${prefix}/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ value }),
      }
    );
    const json = await res.json();
    if (!json.success) {
      console.error(`saveData error for key=${key}:`, json.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`saveData network error for key=${key}:`, err);
    return false;
  }
}

export async function deleteData(key: string): Promise<boolean> {
  try {
    const prefix = _authToken ? "ws/data" : "data";
    const res = await fetchWithRetry(
      `${BASE_URL}/${prefix}/${encodeURIComponent(key)}`,
      { method: "DELETE", headers: headers() }
    );
    const json = await res.json();
    return json.success;
  } catch (err) {
    console.error(`deleteData network error for key=${key}:`, err);
    return false;
  }
}

// ============================================
// AI Studio
// ============================================

export interface AIStatus {
  connected: boolean;
  model?: string;
  keyPrefix?: string;
  error?: string;
}

export async function checkAIStatus(): Promise<AIStatus> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/ai/status`, { headers: headers() });
    const json = await res.json();
    return {
      connected: json.connected ?? false,
      model: json.model,
      keyPrefix: json.keyPrefix,
      error: json.error,
    };
  } catch (err) {
    console.error("checkAIStatus error:", err);
    return { connected: false, error: String(err) };
  }
}

export interface AIGenerateResult {
  content: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  serverUsage?: { key: string; current: number; limit: number; remaining: number };
}

/** Thrown when server-side usage limit is hit (HTTP 429). */
export class UsageLimitError extends Error {
  code = "USAGE_LIMIT_REACHED";
  usage: { key: string; current: number; limit: number; remaining: number };
  constructor(message: string, usage: { key: string; current: number; limit: number; remaining: number }) {
    super(message);
    this.name = "UsageLimitError";
    this.usage = usage;
  }
}

export async function aiGenerate(
  toolId: string,
  prompt: string
): Promise<AIGenerateResult | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/ai/generate`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ toolId, prompt }),
    });
    const json = await res.json();

    // Handle server-side usage limit (429)
    if (res.status === 429 && json.code === "USAGE_LIMIT_REACHED") {
      console.warn(`[USAGE LIMIT] AI generate blocked by server: ${json.error}`, json.usage);
      throw new UsageLimitError(json.error || "Usage limit reached", json.usage);
    }

    if (!json.success) {
      console.error(`aiGenerate error:`, json.error);
      throw new Error(json.error || "AI generation failed");
    }
    return json.data as AIGenerateResult;
  } catch (err) {
    console.error(`aiGenerate error:`, err);
    throw err;
  }
}

export interface AIHistoryEntry {
  prompt: string;
  response: string;
  timestamp: string;
}

export async function getAIHistory(
  toolId: string
): Promise<AIHistoryEntry[]> {
  try {
    const res = await fetchWithRetry(
      `${BASE_URL}/ai/history/${encodeURIComponent(toolId)}`,
      { headers: headers() }
    );
    const json = await res.json();
    if (!json.success) return [];
    return json.data as AIHistoryEntry[];
  } catch {
    return [];
  }
}

// ============================================
// Webhook / Pipedream
// ============================================

export async function testWebhook(message?: string): Promise<boolean> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/webhook/test`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ message: message || "Manual test from UI" }),
    });
    const json = await res.json();
    return json.success;
  } catch (err) {
    console.error("testWebhook error:", err);
    return false;
  }
}

// ============================================
// DALL-E Image Generation
// ============================================

export interface DALLEImage {
  url: string;
  revised_prompt: string;
}

export async function generateImage(
  prompt: string,
  options?: { size?: string; style?: "vivid" | "natural" }
): Promise<DALLEImage[]> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/ai/image`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        prompt,
        size: options?.size || "1024x1024",
        style: options?.style || "vivid",
      }),
    });
    const json = await res.json();

    // Handle server-side usage limit (429)
    if (res.status === 429 && json.code === "USAGE_LIMIT_REACHED") {
      console.warn(`[USAGE LIMIT] DALL-E blocked by server: ${json.error}`, json.usage);
      throw new UsageLimitError(json.error || "DALL-E usage limit reached", json.usage);
    }

    if (!json.success) {
      throw new Error(json.error || "Image generation failed");
    }
    return json.data.images as DALLEImage[];
  } catch (err) {
    console.error("generateImage error:", err);
    throw err;
  }
}

export async function checkDALLEStatus(): Promise<{ connected: boolean; model?: string; error?: string }> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/ai/dalle-status`, { headers: headers() });
    const json = await res.json();
    return json.data || { connected: false };
  } catch {
    return { connected: false, error: "Network error" };
  }
}

// ============================================
// Resend Email
// ============================================

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ emailId: string } | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/email/send`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!json.success) {
      console.error("sendEmail error:", json.error);
      throw new Error(json.error || "Email send failed");
    }
    return json.data;
  } catch (err) {
    console.error("sendEmail error:", err);
    throw err;
  }
}

export async function checkEmailStatus(): Promise<{ connected: boolean; keyPrefix?: string; error?: string }> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/email/status`, { headers: headers() });
    const json = await res.json();
    return json.data || { connected: false };
  } catch {
    return { connected: false, error: "Network error" };
  }
}

// ============================================
// Enhanced Webhooks (Pipedream)
// ============================================

export async function sendWebhookEvent(event: string, data: Record<string, any>): Promise<boolean> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/webhook/send`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ event, data }),
    });
    const json = await res.json();
    return json.success;
  } catch (err) {
    console.error("sendWebhookEvent error:", err);
    return false;
  }
}

// ============================================
// Integrations Hub
// ============================================

export interface IntegrationsStatus {
  resend: { connected: boolean };
  dalle: { connected: boolean; model?: string };
  pipedream: { connected: boolean; url?: string };
  notion: { connected: boolean; config?: any };
  amplitude: { connected: boolean; config?: any };
}

export async function getIntegrationsStatus(): Promise<IntegrationsStatus | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/integrations/status`, { headers: headers() });
    const json = await res.json();
    if (!json.success) return null;
    return json.data;
  } catch {
    return null;
  }
}

export async function saveIntegrationConfig(config: Record<string, any>): Promise<boolean> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/integrations/config`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ value: config }),
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

// ============================================
// Telegram Bot
// ============================================

export interface TelegramConfig {
  configured: boolean;
  chatId?: string;
  botUsername?: string | null;
  tokenPrefix?: string | null;
  updatedAt?: string;
}

export async function getTelegramConfig(): Promise<TelegramConfig | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/telegram/config`, { headers: headers() });
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function saveTelegramConfig(botToken: string, chatId: string, botUsername?: string): Promise<boolean> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/telegram/config`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ botToken, chatId, botUsername }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Failed to save Telegram config");
    }
    return true;
  } catch (err) {
    console.error("saveTelegramConfig error:", err);
    throw err;
  }
}

export async function verifyTelegramBot(botToken: string): Promise<{ botId: number; botUsername: string; firstName: string } | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/telegram/verify`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ botToken }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Bot verification failed");
    }
    return json.data;
  } catch (err) {
    console.error("verifyTelegramBot error:", err);
    throw err;
  }
}

export async function sendTelegramMessage(text: string): Promise<{ messageId: number } | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/telegram/send-message`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ text }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Telegram send failed");
    }
    return json.data;
  } catch (err) {
    console.error("sendTelegramMessage error:", err);
    throw err;
  }
}

export async function sendTelegramDocument(base64: string, filename: string, caption?: string): Promise<{ messageId: number } | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/telegram/send-document`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ base64, filename, caption }),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Telegram send document failed");
    }
    return json.data;
  } catch (err) {
    console.error("sendTelegramDocument error:", err);
    throw err;
  }
}

export async function deleteTelegramConfig(): Promise<boolean> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/telegram/config`, {
      method: "DELETE",
      headers: headers(),
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

// ============================================
// Automation Execution
// ============================================

export interface AutomationExecutionResult {
  results: {
    nodeId: string;
    subtype: string;
    label: string;
    status: "success" | "error" | "skipped";
    message: string;
    durationMs: number;
  }[];
  summary: {
    total: number;
    success: number;
    errors: number;
    skipped: number;
    totalDurationMs: number;
  };
}

export async function executeAutomation(
  flowId: string,
  flowName: string,
  nodes: any[],
  connections: any[]
): Promise<AutomationExecutionResult | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/automation/execute`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ flowId, flowName, nodes, connections }),
    });
    const json = await res.json();
    if (!json.success) {
      console.error("executeAutomation error:", json.error);
      throw new Error(json.error || "Automation execution failed");
    }
    return json.data as AutomationExecutionResult;
  } catch (err) {
    console.error("executeAutomation error:", err);
    throw err;
  }
}

export async function getAutomationLog(flowId: string): Promise<any[]> {
  try {
    const res = await fetchWithRetry(
      `${BASE_URL}/automation/log/${encodeURIComponent(flowId)}`,
      { headers: headers() }
    );
    const json = await res.json();
    if (!json.success) return [];
    return json.data || [];
  } catch {
    return [];
  }
}

// ============================================
// Backup / Restore
// ============================================

export interface BackupData {
  version: number;
  exportedAt: string;
  entries: { key: string; value: any }[];
  count: number;
}

export async function exportBackup(): Promise<BackupData | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/backup/export`, {
      headers: headers(),
    });
    const json = await res.json();
    if (!json.success) {
      console.error("exportBackup error:", json.error);
      throw new Error(json.error || "Export failed");
    }
    return json.data as BackupData;
  } catch (err) {
    console.error("exportBackup error:", err);
    throw err;
  }
}

export async function importBackup(
  entries: { key: string; value: any }[]
): Promise<number> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/backup/import`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ entries }),
    });
    const json = await res.json();
    if (!json.success) {
      console.error("importBackup error:", json.error);
      throw new Error(json.error || "Import failed");
    }
    return json.data.restored;
  } catch (err) {
    console.error("importBackup error:", err);
    throw err;
  }
}

// ============================================
// Server-side Usage Limits API
// ============================================

export interface ServerUsageReport {
  planId: string;
  counters: Record<string, number>;
  limits: Record<string, number>;
  details: Record<string, {
    current: number;
    limit: number;
    percentage: number;
    remaining: number;
    isReached: boolean;
    isNearLimit: boolean;
    isInfinite: boolean;
    label: string;
  }>;
}

/** Get the authoritative server-side usage report (counters + limits). */
export async function getServerUsage(): Promise<ServerUsageReport | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/usage`, { headers: headers() });
    const json = await res.json();
    if (!json.success) {
      console.error("getServerUsage error:", json.error);
      return null;
    }
    return json.data as ServerUsageReport;
  } catch (err) {
    console.error("getServerUsage error:", err);
    return null;
  }
}

/** Server-side check: is a specific action allowed? (read-only, no mutation) */
export async function checkServerUsage(key: string, amount: number = 1): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  message?: string;
} | null> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/usage/check`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ key, amount }),
    });
    const json = await res.json();
    if (!json.success && json.code !== "USAGE_LIMIT_REACHED") {
      console.error("checkServerUsage error:", json.error);
      return null;
    }
    return json.data;
  } catch (err) {
    console.error("checkServerUsage error:", err);
    return null;
  }
}

/** Server-side atomic check + increment. Returns result or throws UsageLimitError. */
export async function incrementServerUsage(key: string, amount: number = 1): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
}> {
  const res = await fetchWithRetry(`${BASE_URL}/usage/increment`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ key, amount }),
  });
  const json = await res.json();

  if (res.status === 429 && json.code === "USAGE_LIMIT_REACHED") {
    throw new UsageLimitError(
      json.error || "Usage limit reached",
      json.data || { key, current: 0, limit: 0, remaining: 0 }
    );
  }

  if (!json.success) {
    throw new Error(json.error || "Usage increment failed");
  }
  return json.data;
}

/** Server-side decrement (e.g., on deletion). */
export async function decrementServerUsage(key: string, amount: number = 1): Promise<boolean> {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/usage/decrement`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ key, amount }),
    });
    const json = await res.json();
    return json.success;
  } catch (err) {
    console.error("decrementServerUsage error:", err);
    return false;
  }
}