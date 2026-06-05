/**
 * 🦊 Usage Limit Alert - visual header alert when any usage counter ≥ 80%.
 *
 * Shows a compact amber/red banner with the most critical counters,
 * auto-hides after dismissal (per session), and links to /pricing.
 */
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, X, ArrowUpRight, Flame, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useUsage, KEY_LABELS, type UsageKey } from "../lib/useUsage";

/* ─── Plan display metadata ─── */
const PLAN_META: Record<string, { name: string; emoji: string }> = {
  free:       { name: "Free",       emoji: "🌱" },
  starter:    { name: "Starter",    emoji: "⚡" },
  growth:     { name: "Growth",     emoji: "🚀" },
  pro:        { name: "Pro",        emoji: "💎" },
  enterprise: { name: "Enterprise", emoji: "🏢" },
};

const TRACKED_KEYS: UsageKey[] = [
  "aiTextPerMonth",
  "aiImagePerMonth",
  "aiChatPerDay",
  "projects",
  "posts",
  "abTests",
  "personas",
  "automations",
  "integrations",
  "teamMembers",
  "storageMb",
];

interface AlertItem {
  key: UsageKey;
  label: string;
  current: number;
  limit: number;
  percentage: number;
  isReached: boolean;
}

export function UsageLimitAlert() {
  const { getUsage, loading, planId } = useUsage();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // ✅ Fix: derive plan from planId with safe fallback
  const plan = PLAN_META[planId] ?? { name: planId, emoji: "📦" };

  const alerts: AlertItem[] = useMemo(() => {
    if (loading) return [];
    const items: AlertItem[] = [];
    for (const key of TRACKED_KEYS) {
      const info = getUsage(key);
      if (info.isInfinite) continue;
      if (info.percentage >= 80) {
        items.push({
          key,
          label: KEY_LABELS[key],
          current: info.current,
          limit: info.limit,
          percentage: info.percentage,
          isReached: info.isReached,
        });
      }
    }
    // Sort: reached first, then by percentage desc
    items.sort((a, b) => {
      if (a.isReached !== b.isReached) return a.isReached ? -1 : 1;
      return b.percentage - a.percentage;
    });
    return items;
  }, [getUsage, loading]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const handleUpgrade = useCallback(() => {
    navigate("/settings");
  }, [navigate]);

  if (dismissed || alerts.length === 0) return null;

  const hasCritical = alerts.some((a) => a.isReached);
  const topAlerts = alerts.slice(0, 3);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden shrink-0"
      >
        <div
          className={`flex items-center gap-3 px-5 py-2 border-b text-[12px] ${
            hasCritical
              ? "bg-red-500/[0.06] border-red-500/20 dark:bg-red-500/[0.08]"
              : "bg-amber-500/[0.06] border-amber-500/20 dark:bg-amber-500/[0.08]"
          }`}
        >
          {/* Icon */}
          <div
            className={`flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${
              hasCritical
                ? "bg-red-500/15 text-red-500"
                : "bg-amber-500/15 text-amber-600"
            }`}
          >
            {hasCritical ? (
              <Flame className="w-3 h-3" />
            ) : (
              <AlertTriangle className="w-3 h-3" />
            )}
          </div>

          {/* Counters */}
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-none">
            <span
              className={`font-medium shrink-0 ${
                hasCritical ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
              }`}
            >
              {hasCritical ? "Лимит исчерпан:" : "Приближение к лимиту:"}
            </span>

            {topAlerts.map((a) => (
              <span
                key={a.key}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0 font-medium ${
                  a.isReached
                    ? "bg-red-500/15 text-red-600 dark:text-red-400"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                }`}
              >
                {a.isReached ? (
                  <Flame className="w-2.5 h-2.5" />
                ) : (
                  <Zap className="w-2.5 h-2.5" />
                )}
                {a.label}{" "}
                <span className="font-mono text-[11px]">
                  {a.current}/{a.limit}
                </span>
              </span>
            ))}

            {alerts.length > 3 && (
              <span className="text-muted-foreground shrink-0">
                +{alerts.length - 3} ещё
              </span>
            )}
          </div>

          {/* Upgrade CTA */}
          <button
            onClick={handleUpgrade}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-semibold shrink-0 transition-colors ${
              hasCritical
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-amber-500 text-white hover:bg-amber-600"
            }`}
          >
            <ArrowUpRight className="w-3 h-3" />
            Апгрейд
          </button>

          {/* Plan badge */}
          <span className="text-muted-foreground shrink-0">
            {plan.emoji} {plan.name}
          </span>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            title="Скрыть до следующего обновления"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}