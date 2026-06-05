/**
 * 🦊 Usage tracking system for MarketPlan.
 *
 * Tracks consumption counters per feature (projects, AI-texts, images, chat, etc.),
 * persists to Supabase KV, and auto-resets monthly/daily counters.
 *
 * Usage:
 *   <UsageProvider> wraps app
 *   const { canUse, increment, getUsage, checkAndWarn } = useUsage();
 */
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode,
} from "react";
import { getData, saveData } from "./api";
import { showMascotReaction } from "./mascot-reactions";
import { getServerUsage, type ServerUsageReport } from "./api";

/* ═══ Types ═══ */
export interface UsageLimits {
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

export type UsageKey = keyof UsageLimits;

export interface UsageCounters {
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

export interface UsageInfo {
  current: number;
  limit: number;
  percentage: number;       // 0–100
  remaining: number;
  isReached: boolean;
  isNearLimit: boolean;     // ≥80%
  isInfinite: boolean;
}

interface UsageMeta {
  counters: UsageCounters;
  monthKey: string;         // "2026-03"
  dayKey: string;           // "2026-03-09"
  updatedAt: string;
}

interface UsageContextValue {
  counters: UsageCounters;
  loading: boolean;
  /** Current plan identifier (e.g. "free", "starter", "pro"). */
  planId: string;
  /** Can the user perform one more action of this type? */
  canUse: (key: UsageKey) => boolean;
  /** Get detailed usage info for a key. */
  getUsage: (key: UsageKey) => UsageInfo;
  /** Increment counter. Returns true if allowed, false if limit reached. */
  increment: (key: UsageKey, amount?: number) => Promise<boolean>;
  /** Decrement counter (e.g., on delete). */
  decrement: (key: UsageKey, amount?: number) => Promise<void>;
  /** Check limit and show toast + mascot reaction if near or reached. */
  checkAndWarn: (key: UsageKey) => boolean;
  /** Force refresh counters from KV. */
  refresh: () => Promise<void>;
  /** Set a counter to an exact value (for syncing with actual data counts). */
  syncCounter: (key: UsageKey, value: number) => Promise<void>;
}

/* ═══ Constants ═══ */
const KV_KEY = "usage_counters";

// Default unlimited limits (can be customized later)
const DEFAULT_LIMITS: UsageLimits = {
  projects: Infinity,
  posts: Infinity,
  aiTextPerMonth: Infinity,
  aiImagePerMonth: Infinity,
  storageMb: Infinity,
  teamMembers: Infinity,
  abTests: Infinity,
  personas: Infinity,
  automations: Infinity,
  integrations: Infinity,
  aiChatPerDay: Infinity,
};

const USAGE_CTX_KEY = "__MARKETPLAN_USAGE_CTX__";
const UsageContext: React.Context<UsageContextValue | null> =
  (globalThis as any)[USAGE_CTX_KEY] ||
  ((globalThis as any)[USAGE_CTX_KEY] = createContext<UsageContextValue | null>(null));

/** Keys that reset monthly. */
const MONTHLY_KEYS: UsageKey[] = ["aiTextPerMonth", "aiImagePerMonth"];

/** Keys that reset daily. */
const DAILY_KEYS: UsageKey[] = ["aiChatPerDay"];

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

function nowMonth() {
  return new Date().toISOString().slice(0, 7); // "2026-03"
}
function nowDay() {
  return new Date().toISOString().slice(0, 10); // "2026-03-09"
}

/** Human-readable labels for usage keys (for toasts). */
export const KEY_LABELS: Record<UsageKey, string> = {
  projects: "проектов",
  posts: "постов",
  aiTextPerMonth: "AI-генераций текста",
  aiImagePerMonth: "AI-генераций изображений",
  storageMb: "хранилища (МБ)",
  teamMembers: "участников команды",
  abTests: "A/B тестов",
  personas: "персон",
  automations: "автоматизаций",
  integrations: "интеграций",
  aiChatPerDay: "сообщений AI-чата",
};

/* ═══ Provider ═══ */
export function UsageProvider({ children }: { children: ReactNode }) {
  const [counters, setCounters] = useState<UsageCounters>({ ...EMPTY_COUNTERS });
  const [loading, setLoading] = useState(true);
  const [limits] = useState<UsageLimits>(DEFAULT_LIMITS);
  const [planId, setPlanId] = useState<string>("free");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countersRef = useRef(counters);
  countersRef.current = counters;

  /* ─── Load from KV ─── */
  const loadCounters = useCallback(async () => {
    try {
      // Try server-side authoritative source first
      const serverReport = await getServerUsage();
      if (serverReport?.counters) {
        const fresh = { ...EMPTY_COUNTERS };
        for (const k of Object.keys(fresh) as UsageKey[]) {
          fresh[k] = (serverReport.counters as any)[k] ?? 0;
        }
        setCounters(fresh);
        // ✅ Fix: persist planId from server response
        if (serverReport.planId) {
          setPlanId(serverReport.planId);
        }
        setLoading(false);
        return;
      }

      // Fallback: load from client-side KV
      const data = await getData<UsageMeta>(KV_KEY);
      if (!data?.counters) {
        setLoading(false);
        return;
      }

      const fresh = { ...data.counters };
      let needsSave = false;

      // Monthly reset check
      if (data.monthKey !== nowMonth()) {
        for (const k of MONTHLY_KEYS) {
          fresh[k] = 0;
        }
        needsSave = true;
      }

      // Daily reset check
      if (data.dayKey !== nowDay()) {
        for (const k of DAILY_KEYS) {
          fresh[k] = 0;
        }
        needsSave = true;
      }

      setCounters(fresh);
      if (needsSave) {
        await persistCounters(fresh);
      }
    } catch (err) {
      console.error("[useUsage] loadCounters error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCounters();
  }, [loadCounters]);

  /* ─── Persist (debounced) ─── */
  const persistCounters = useCallback(async (c: UsageCounters) => {
    const meta: UsageMeta = {
      counters: c,
      monthKey: nowMonth(),
      dayKey: nowDay(),
      updatedAt: new Date().toISOString(),
    };
    await saveData(KV_KEY, meta);
  }, []);

  const debouncedSave = useCallback((c: UsageCounters) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistCounters(c);
    }, 800);
  }, [persistCounters]);

  /* ─── Core helpers ─── */
  const getUsage = useCallback((key: UsageKey): UsageInfo => {
    const current = countersRef.current[key];
    const limit = limits[key];
    const isInfinite = limit === Infinity;
    const percentage = isInfinite ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((current / limit) * 100));
    return {
      current,
      limit,
      percentage,
      remaining: isInfinite ? Infinity : Math.max(0, limit - current),
      isReached: !isInfinite && current >= limit,
      isNearLimit: !isInfinite && percentage >= 80,
      isInfinite,
    };
  }, [limits]);

  const canUse = useCallback((key: UsageKey): boolean => {
    const { isReached, isInfinite } = getUsage(key);
    return isInfinite || !isReached;
  }, [getUsage]);

  const increment = useCallback(async (key: UsageKey, amount: number = 1): Promise<boolean> => {
    const info = getUsage(key);
    if (!info.isInfinite && info.current + amount > info.limit) {
      // Limit reached - show mascot reaction
      showMascotReaction("error", `Лимит ${KEY_LABELS[key]} исчерпан! 🦊`);
      return false;
    }

    const next = { ...countersRef.current, [key]: countersRef.current[key] + amount };
    setCounters(next);
    debouncedSave(next);

    // Warn if near limit (80%+)
    const newPct = info.isInfinite ? 0 : Math.round(((info.current + amount) / info.limit) * 100);
    if (!info.isInfinite && newPct >= 80 && newPct < 100) {
      showMascotReaction("error", `${KEY_LABELS[key]}: использовано ${newPct}%. Скоро лимит!`);
    }

    return true;
  }, [getUsage, debouncedSave]);

  const decrement = useCallback(async (key: UsageKey, amount: number = 1) => {
    const next = { ...countersRef.current, [key]: Math.max(0, countersRef.current[key] - amount) };
    setCounters(next);
    debouncedSave(next);
  }, [debouncedSave]);

  const checkAndWarn = useCallback((key: UsageKey): boolean => {
    const info = getUsage(key);
    if (info.isReached) {
      showMascotReaction("error", `Лимит ${KEY_LABELS[key]} исчерпан! 🦊`);
      return false;
    }
    if (info.isNearLimit) {
      showMascotReaction("error", `${KEY_LABELS[key]}: осталось ${info.remaining}.`);
    }
    return true;
  }, [getUsage]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadCounters();
  }, [loadCounters]);

  const syncCounter = useCallback(async (key: UsageKey, value: number) => {
    const next = { ...countersRef.current, [key]: value };
    setCounters(next);
    await persistCounters(next);
  }, [persistCounters]);

  const value: UsageContextValue = {
    counters,
    loading,
    planId,
    canUse,
    getUsage,
    increment,
    decrement,
    checkAndWarn,
    refresh,
    syncCounter,
  };

  return (
    <UsageContext.Provider value={value}>
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage(): UsageContextValue {
  const ctx = useContext(UsageContext);
  if (!ctx) {
    // Fallback outside provider
    return {
      counters: { ...EMPTY_COUNTERS },
      loading: true,
      planId: "free",
      canUse: () => true,
      getUsage: (key) => ({
        current: 0, limit: Infinity, percentage: 0,
        remaining: Infinity, isReached: false, isNearLimit: false, isInfinite: true,
      }),
      increment: async () => true,
      decrement: async () => {},
      checkAndWarn: () => true,
      refresh: async () => {},
      syncCounter: async () => {},
    };
  }
  return ctx;
}