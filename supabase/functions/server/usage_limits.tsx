/**
 * Server-side usage limits enforcement for MarketPlan.
 *
 * This module is the authoritative source of truth for plan limits.
 * The frontend has a mirror of these configs but CANNOT be trusted.
 * All costly operations (AI text, DALL-E, etc.) MUST be gated here.
 */
import * as kv from "./kv_store.tsx";

/* ═══ Plan types ═══ */
export type PlanId = "demo" | "light" | "medium";

export type UsageKey =
  | "projects"
  | "posts"
  | "aiTextPerMonth"
  | "aiImagePerMonth"
  | "storageMb"
  | "teamMembers"
  | "abTests"
  | "personas"
  | "automations"
  | "integrations"
  | "aiChatPerDay";

export interface PlanLimits {
  projects: number;
  posts: number;
  aiTextPerMonth: number;
  aiImagePerMonth: number;
  storageMb: number;
  teamMembers: number;
  abTests: number;
  personas: number;
  automations: number;
  integrations: number;
  aiChatPerDay: number;
}

/* ═══ Authoritative plan configs (server-side) ═══ */
const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  demo: {
    projects: 1,
    posts: 30,
    aiTextPerMonth: 5,
    aiImagePerMonth: 0,
    storageMb: 50,
    teamMembers: 1,
    abTests: 0,
    personas: 0,
    automations: 0,
    integrations: 0,
    aiChatPerDay: 5,
  },
  light: {
    projects: 5,
    posts: 300,
    aiTextPerMonth: 200,
    aiImagePerMonth: 20,
    storageMb: 2048,
    teamMembers: 3,
    abTests: 3,
    personas: 3,
    automations: 5,
    integrations: 2,
    aiChatPerDay: 50,
  },
  medium: {
    projects: Infinity,
    posts: Infinity,
    aiTextPerMonth: Infinity,
    aiImagePerMonth: 200,
    storageMb: 20480,
    teamMembers: 10,
    abTests: Infinity,
    personas: Infinity,
    automations: Infinity,
    integrations: Infinity,
    aiChatPerDay: Infinity,
  },
};

/* ═══ Counter structure (mirrors frontend UsageMeta) ═══ */
interface UsageCounters {
  projects: number;
  posts: number;
  aiTextPerMonth: number;
  aiImagePerMonth: number;
  storageMb: number;
  teamMembers: number;
  abTests: number;
  personas: number;
  automations: number;
  integrations: number;
  aiChatPerDay: number;
}

interface UsageMeta {
  counters: UsageCounters;
  monthKey: string;   // "2026-03"
  dayKey: string;     // "2026-03-09"
  updatedAt: string;
}

const EMPTY_COUNTERS: UsageCounters = {
  projects: 0,
  posts: 0,
  aiTextPerMonth: 0,
  aiImagePerMonth: 0,
  storageMb: 0,
  teamMembers: 0,
  abTests: 0,
  personas: 0,
  automations: 0,
  integrations: 0,
  aiChatPerDay: 0,
};

const MONTHLY_KEYS: UsageKey[] = ["aiTextPerMonth", "aiImagePerMonth"];
const DAILY_KEYS: UsageKey[] = ["aiChatPerDay"];

function nowMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
function nowDay(): string {
  return new Date().toISOString().slice(0, 10);
}

const KEY_LABELS: Record<UsageKey, string> = {
  projects: "проектов",
  posts: "постов",
  aiTextPerMonth: "AI-генераций текста в месяц",
  aiImagePerMonth: "AI-генераций изображений в месяц",
  storageMb: "хранилища (МБ)",
  teamMembers: "участников команды",
  abTests: "A/B тестов",
  personas: "персон",
  automations: "автоматизаций",
  integrations: "интеграций",
  aiChatPerDay: "сообщений AI-чата в день",
};

/* ═══ Resolve plan ID for a workspace ═══ */
export async function getWorkspacePlan(wsKvPrefix: string): Promise<PlanId> {
  try {
    const planData = await kv.get(`${wsKvPrefix}user_plan`) as { planId?: PlanId } | null;
    if (planData?.planId && PLAN_LIMITS[planData.planId]) {
      return planData.planId;
    }
  } catch (e) {
    console.log(`[usage_limits] getWorkspacePlan error: ${e}`);
  }
  return "demo";
}

/* ═══ Read counters with auto-reset ═══ */
export async function getCounters(wsKvPrefix: string): Promise<{ counters: UsageCounters; needsSave: boolean }> {
  try {
    const raw = await kv.get(`${wsKvPrefix}usage_counters`) as UsageMeta | null;
    if (!raw?.counters) {
      return { counters: { ...EMPTY_COUNTERS }, needsSave: false };
    }

    const fresh = { ...raw.counters };
    let needsSave = false;

    // Monthly reset
    if (raw.monthKey !== nowMonth()) {
      for (const k of MONTHLY_KEYS) {
        fresh[k] = 0;
      }
      needsSave = true;
    }

    // Daily reset
    if (raw.dayKey !== nowDay()) {
      for (const k of DAILY_KEYS) {
        fresh[k] = 0;
      }
      needsSave = true;
    }

    if (needsSave) {
      await saveCounters(wsKvPrefix, fresh);
    }

    return { counters: fresh, needsSave };
  } catch (e) {
    console.log(`[usage_limits] getCounters error: ${e}`);
    return { counters: { ...EMPTY_COUNTERS }, needsSave: false };
  }
}

/* ═══ Save counters ═══ */
async function saveCounters(wsKvPrefix: string, counters: UsageCounters): Promise<void> {
  const meta: UsageMeta = {
    counters,
    monthKey: nowMonth(),
    dayKey: nowDay(),
    updatedAt: new Date().toISOString(),
  };
  await kv.set(`${wsKvPrefix}usage_counters`, meta);
}

/* ═══ Check if action is allowed (no mutation) ═══ */
export async function canUse(
  wsKvPrefix: string,
  key: UsageKey,
  amount: number = 1,
): Promise<{ allowed: boolean; current: number; limit: number; remaining: number; message?: string }> {
  const planId = await getWorkspacePlan(wsKvPrefix);
  const limits = PLAN_LIMITS[planId];
  const limit = limits[key];
  const { counters } = await getCounters(wsKvPrefix);
  const current = counters[key];

  if (limit === Infinity) {
    return { allowed: true, current, limit: -1, remaining: -1 };
  }

  if (current + amount > limit) {
    return {
      allowed: false,
      current,
      limit,
      remaining: Math.max(0, limit - current),
      message: `Лимит ${KEY_LABELS[key]} исчерпан (${current}/${limit}). Текущий план: ${planId}. Обновите план для продолжения.`,
    };
  }

  return {
    allowed: true,
    current,
    limit,
    remaining: limit - current,
  };
}

/* ═══ Check + increment (returns updated counters) ═══ */
// NOTE: This is NOT truly atomic in a KV store — concurrent requests may
// read the same counter value before either writes. For a prototype this is
// acceptable; a production system should use Postgres `UPDATE … SET counter
// = counter + 1 WHERE counter < limit RETURNING counter`.
export async function checkAndIncrement(
  wsKvPrefix: string,
  key: UsageKey,
  amount: number = 1,
): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  message?: string;
}> {
  const planId = await getWorkspacePlan(wsKvPrefix);
  const limits = PLAN_LIMITS[planId];
  const limit = limits[key];
  const { counters } = await getCounters(wsKvPrefix);
  const current = counters[key];

  if (limit !== Infinity && current + amount > limit) {
    return {
      allowed: false,
      current,
      limit,
      remaining: Math.max(0, limit - current),
      message: `Лимит ${KEY_LABELS[key]} исчерпан (${current}/${limit}). Текущий план: ${planId}. Обновите план.`,
    };
  }

  // Increment (best-effort; see race-condition note above)
  counters[key] = current + amount;
  await saveCounters(wsKvPrefix, counters);

  const newRemaining = limit === Infinity ? -1 : limit - counters[key];
  return {
    allowed: true,
    current: counters[key],
    limit: limit === Infinity ? -1 : limit,
    remaining: newRemaining,
  };
}

/* ═══ Decrement (e.g., on delete) ═══ */
export async function decrementCounter(
  wsKvPrefix: string,
  key: UsageKey,
  amount: number = 1,
): Promise<void> {
  const { counters } = await getCounters(wsKvPrefix);
  counters[key] = Math.max(0, counters[key] - amount);
  await saveCounters(wsKvPrefix, counters);
}

/* ═══ Get full usage report ═══ */
export async function getUsageReport(wsKvPrefix: string): Promise<{
  planId: PlanId;
  counters: UsageCounters;
  limits: PlanLimits;
  details: Record<UsageKey, {
    current: number;
    limit: number;
    percentage: number;
    remaining: number;
    isReached: boolean;
    isNearLimit: boolean;
    isInfinite: boolean;
    label: string;
  }>;
}> {
  const planId = await getWorkspacePlan(wsKvPrefix);
  const limits = PLAN_LIMITS[planId];
  const { counters } = await getCounters(wsKvPrefix);

  const details = {} as any;
  for (const key of Object.keys(limits) as UsageKey[]) {
    const current = counters[key] || 0;
    const limit = limits[key];
    const isInfinite = limit === Infinity;
    const percentage = isInfinite ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((current / limit) * 100));
    details[key] = {
      current,
      limit: isInfinite ? -1 : limit,
      percentage,
      remaining: isInfinite ? -1 : Math.max(0, limit - current),
      isReached: !isInfinite && current >= limit,
      isNearLimit: !isInfinite && percentage >= 80,
      isInfinite,
      label: KEY_LABELS[key],
    };
  }

  return { planId, counters, limits: {
    ...limits,
    // Serialize Infinity as -1 for JSON
    ...Object.fromEntries(
      Object.entries(limits).map(([k, v]) => [k, v === Infinity ? -1 : v])
    ),
  } as any, details };
}

/* ═══ Export plan limits for reference ═══ */
export { PLAN_LIMITS, KEY_LABELS, EMPTY_COUNTERS };
