/**
 * useAccess — глобальный хук доступа к тарифам MarketPlan.
 * Источник истины: таблица user_access в Supabase.
 * Никакого localStorage — только live-запрос к БД.
 */
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
  type ReactNode,
} from "react";
import { supabase } from "./useAuth";
import { useAuth } from "./useAuth";
import { projectId, publicAnonKey } from "/utils/supabase/info";

export type AccessPlan = "start" | "pro" | "pro_plus" | null;

/** Все пути с AI-инструментами (Старт не имеет доступа) */
export const AI_PATHS = [
  "/app/content-studio",
  "/app/repurpose",
  "/app/competitor-spy",
  "/app/brand-voice",
  "/app/fatigue-detector",
  "/app/personas",
  "/app/campaign-storyline",
  "/app/content-scoring",
  "/app/tools/metrics",
  "/app/tools/budget",
  "/app/tools/audience",
  "/app/tools/triggers",
  "/app/smm/ideas",
  "/app/influencers",
  "/app/ab-tests",
  "/app/cjm",
  "/app/okr",
];

export interface AccessState {
  loading: boolean;
  authenticated: boolean;
  hasAccess: boolean;
  /** null = нет плана (preview-режим) */
  plan: AccessPlan;
  expiresAt: string | null;
  isExpired: boolean;
  daysLeft: number | null;
  refresh: () => Promise<void>;
}

// ─── Plan config ────────────────────────────────────────────────────────────

export const PLAN_CONFIG = {
  start: {
    label: "Старт",
    badge: "СТАРТ",
    color: "#d4a373",
    gradient: "linear-gradient(135deg, #d4a373, #c08a40)",
    maxProjects: 2,
    hasAI: false,
    hasTeam: false,
  },
  pro: {
    label: "Про",
    badge: "PRO",
    color: "#1a7a6d",
    gradient: "linear-gradient(135deg, #1a7a6d, #2eb8a4)",
    maxProjects: Infinity,
    hasAI: true,
    hasTeam: true,
  },
  pro_plus: {
    label: "Про+",
    badge: "PRO+",
    color: "#7c3aed",
    gradient: "linear-gradient(135deg, #7c3aed, #a855f7)",
    maxProjects: Infinity,
    hasAI: true,
    hasTeam: true,
  },
} as const;

// ─── Core check function ─────────────────────────────────────────────────────
// Запрашивает через сервер (service role, обходит RLS), fallback — прямой запрос.

const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-b80b3260`;

async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || publicAnonKey;
}

export async function checkMarketPlanAccess(userId: string): Promise<{
  hasAccess: boolean;
  plan: AccessPlan;
  expiresAt: string | null;
  isExpired: boolean;
}> {
  const token = await getAuthToken();
  const none = { hasAccess: false, plan: null as AccessPlan, expiresAt: null, isExpired: false };

  const parseRows = (rows: any[]) => {
    const now = new Date();
    const active = rows.find(r => {
      if (r.status !== "active") return false;
      if (!r.expires_at) return true;
      return new Date(r.expires_at) > now;
    });
    if (!active) return none;
    return {
      hasAccess: true,
      plan: active.plan as AccessPlan,
      expiresAt: active.expires_at as string | null,
      isExpired: false,
    };
  };

  // 1. Через сервер (service role, минует RLS) — основной путь
  try {
    const res = await fetch(`${SERVER_BASE}/auth/access`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      console.log("[access] server:", json);
      if (json.success && json.hasAccess) {
        const expiresAt = json.expiresAt ?? null;
        const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
        return { hasAccess: !isExpired, plan: isExpired ? null : json.plan as AccessPlan, expiresAt, isExpired };
      }
      if (json.success && !json.hasAccess) return none;
    }
  } catch (err) {
    console.warn("[access] server failed, trying Supabase direct:", err);
  }

  // 2. Прямой запрос — фильтр по user_id (работает если RLS разрешает)
  try {
    const { data, error } = await supabase
      .from("user_access")
      .select("plan, status, expires_at")
      .eq("user_id", userId)
      .eq("project", "marketplan")
      .order("starts_at", { ascending: false })
      .limit(10);

    console.log("[access] direct by user_id:", { data, error: error?.message });
    if (!error && data && data.length > 0) return parseRows(data as any[]);
  } catch (err) {
    console.warn("[access] direct by user_id failed:", err);
  }

  // 3. Fallback — запрос без user_id, RLS сам применит auth.uid()
  try {
    const { data, error } = await supabase
      .from("user_access")
      .select("plan, status, expires_at")
      .eq("project", "marketplan")
      .order("starts_at", { ascending: false })
      .limit(10);

    console.log("[access] direct by RLS only:", { data, error: error?.message });
    if (!error && data && data.length > 0) return parseRows(data as any[]);
  } catch (err) {
    console.warn("[access] RLS-only query failed:", err);
  }

  return none;
}

// ─── Payment initiation ──────────────────────────────────────────────────────

const PAYMENT_URL =
  "https://bjhsgjsxhvwtuerahuha.supabase.co/functions/v1/create-payment-marketplan";

export async function initiatePayment(
  userId: string,
  email: string,
  plan: string
): Promise<{ confirmationUrl: string; paymentId: string }> {
  const res = await fetch(PAYMENT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, email, plan }),
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Ошибка сервера (${res.status})`);
  }

  if (!res.ok || !json.success) {
    throw new Error(json.error || `Ошибка создания платежа (${res.status})`);
  }

  const confirmationUrl: string =
    json.confirmationUrl ?? json.data?.confirmationUrl ?? json.data?.confirmation_url;

  if (!confirmationUrl) {
    throw new Error("Сервер не вернул ссылку на оплату");
  }

  return { confirmationUrl, paymentId: json.paymentId ?? json.data?.paymentId ?? "" };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AccessContext = createContext<AccessState | null>(null);

// Persist context across HMR
const CTX_KEY = "__MARKETPLAN_ACCESS_CTX__";
const StableAccessContext: React.Context<AccessState | null> =
  (globalThis as any)[CTX_KEY] ||
  ((globalThis as any)[CTX_KEY] = AccessContext);

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const refreshingRef = useRef(false);

  const [state, setState] = useState<Omit<AccessState, "refresh">>({
    loading: true,
    authenticated: false,
    hasAccess: false,
    plan: null,
    expiresAt: null,
    isExpired: false,
    daysLeft: null,
  });

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    if (!user) {
      setState({
        loading: false,
        authenticated: false,
        hasAccess: false,
        plan: null,
        expiresAt: null,
        isExpired: false,
        daysLeft: null,
      });
      refreshingRef.current = false;
      return;
    }

    setState(s => ({ ...s, loading: true }));

    try {
      const result = await checkMarketPlanAccess(user.id);

      const daysLeft =
        result.expiresAt && !result.isExpired
          ? Math.max(0, Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / 86_400_000))
          : null;

      setState({
        loading: false,
        authenticated: true,
        hasAccess: result.hasAccess,
        plan: result.plan,
        expiresAt: result.expiresAt,
        isExpired: result.isExpired,
        daysLeft,
      });
    } catch (err) {
      console.error("[AccessProvider] refresh error:", err);
      setState(s => ({ ...s, loading: false, authenticated: true }));
    } finally {
      refreshingRef.current = false;
    }
  }, [user]);

  // Re-check on auth change
  useEffect(() => {
    if (!authLoading) {
      refresh();
    }
  }, [user?.id, authLoading]);

  // Realtime: слушаем изменения в user_access для текущего пользователя
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user_access:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_access",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("[AccessProvider] user_access changed:", payload);
          refresh();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[AccessProvider] Realtime subscribed for user:", user.id);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Polling как fallback: проверяем каждые 30 сек пока нет активного доступа
  useEffect(() => {
    if (!user || state.hasAccess) return;

    const interval = setInterval(() => {
      refresh();
    }, 30_000);

    return () => clearInterval(interval);
  }, [user?.id, state.hasAccess]);

  return (
    <StableAccessContext.Provider value={{ ...state, refresh }}>
      {children}
    </StableAccessContext.Provider>
  );
}

export function useAccess(): AccessState {
  const ctx = useContext(StableAccessContext);
  if (!ctx) throw new Error("useAccess must be used within AccessProvider");
  return ctx;
}
