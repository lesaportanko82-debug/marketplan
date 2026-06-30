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

export async function checkMarketPlanAccess(userId: string): Promise<{
  hasAccess: boolean;
  plan: AccessPlan;
  expiresAt: string | null;
  isExpired: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from("user_access")
      .select("plan, status, expires_at")
      .eq("user_id", userId)
      .eq("project", "marketplan")
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      console.error("[checkMarketPlanAccess] query error:", error.message);
      return { hasAccess: false, plan: null, expiresAt: null, isExpired: false };
    }

    if (!data) {
      return { hasAccess: false, plan: null, expiresAt: null, isExpired: false };
    }

    const expiresAt = data.expires_at as string | null;
    const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;

    return {
      hasAccess: !isExpired,
      plan: isExpired ? null : (data.plan as AccessPlan),
      expiresAt,
      isExpired,
    };
  } catch (err) {
    console.error("[checkMarketPlanAccess] unexpected error:", err);
    return { hasAccess: false, plan: null, expiresAt: null, isExpired: false };
  }
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
