/**
 * 🦊 Visual usage meter - progress bar + label.
 *
 * Colors: green → amber → red based on percentage.
 * Supports inline (compact) and card (large) variants.
 */
import { useNavigate } from "react-router";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { useUsage, KEY_LABELS, type UsageKey } from "../lib/useUsage";

function formatValue(v: number): string {
  if (v === Infinity) return "∞";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

function getBarColor(pct: number): string {
  if (pct >= 90) return "#dc2626";       // red
  if (pct >= 80) return "#d97706";       // amber
  if (pct >= 60) return "#c8893a";       // warm amber
  return "#1a7a6d";                       // emerald
}

function getBarBg(pct: number): string {
  if (pct >= 90) return "rgba(220,38,38,0.1)";
  if (pct >= 80) return "rgba(217,119,6,0.1)";
  return "rgba(26,122,109,0.08)";
}

interface UsageMeterProps {
  usageKey: UsageKey;
  label?: string;
  /** "compact" = single-line inline, "card" = full card block, "bar" = just the bar */
  variant?: "compact" | "card" | "bar";
  showUpgrade?: boolean;
  className?: string;
}

export function UsageMeter({
  usageKey,
  label,
  variant = "compact",
  showUpgrade = true,
  className = "",
}: UsageMeterProps) {
  const navigate = useNavigate();
  const { getUsage } = useUsage();
  const info = getUsage(usageKey);
  const displayLabel = label || KEY_LABELS[usageKey];
  const color = getBarColor(info.percentage);

  if (info.isInfinite) {
    if (variant === "bar") return null;
    return (
      <div className={`flex items-center gap-2 text-[11px] text-muted-foreground ${className}`}>
        <span>{displayLabel}</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">∞ безлимит</span>
      </div>
    );
  }

  /* ─── Bar-only variant ─── */
  if (variant === "bar") {
    return (
      <div className={`w-full ${className}`}>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: getBarBg(info.percentage) }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(2, info.percentage)}%`, background: color }}
          />
        </div>
      </div>
    );
  }

  /* ─── Compact variant ─── */
  if (variant === "compact") {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{displayLabel}</span>
          <div className="flex items-center gap-1.5">
            {info.isReached && <AlertTriangle className="w-3 h-3 text-red-500" />}
            <span className="text-[11px] font-semibold" style={{ color }}>
              {formatValue(info.current)}<span className="text-muted-foreground font-normal"> / {formatValue(info.limit)}</span>
            </span>
          </div>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: getBarBg(info.percentage) }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(2, info.percentage)}%`, background: color }}
          />
        </div>
        {info.isReached && showUpgrade && (
          <button
            onClick={() => navigate("/settings")}
            className="text-[10px] font-medium hover:underline flex items-center gap-1"
            style={{ color }}
          >
            <TrendingUp className="w-3 h-3" />
            Лимит исчерпан - обновить план
          </button>
        )}
      </div>
    );
  }

  /* ─── Card variant ─── */
  return (
    <div
      className={`p-3 rounded-xl border transition-colors ${className}`}
      style={{ borderColor: info.isReached ? `${color}30` : "var(--border)", background: info.isReached ? `${color}05` : "transparent" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium text-foreground">{displayLabel}</span>
        <div className="flex items-center gap-1.5">
          {info.isReached && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
          {info.isNearLimit && !info.isReached && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          <span className="text-[13px] font-bold" style={{ color }}>
            {info.percentage}%
          </span>
        </div>
      </div>

      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: getBarBg(info.percentage) }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(2, info.percentage)}%`, background: color }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {formatValue(info.current)} из {formatValue(info.limit)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Осталось: {formatValue(info.remaining)}
        </span>
      </div>

      {info.isReached && showUpgrade && (
        <button
          onClick={() => navigate("/settings")}
          className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all hover:shadow-md"
          style={{ background: color }}
        >
          Обновить план →
        </button>
      )}
    </div>
  );
}

/**
 * Compact usage overview - grid of all tracked metrics.
 * Used in dashboard and settings.
 */
export function UsageOverview({ className = "" }: { className?: string }) {
  const { getUsage } = useUsage();

  const items: { key: UsageKey; label: string; icon: string }[] = [
    { key: "projects", label: "Проекты", icon: "📁" },
    { key: "posts", label: "Посты", icon: "📝" },
    { key: "aiTextPerMonth", label: "AI-тексты", icon: "🤖" },
    { key: "aiImagePerMonth", label: "AI-картинки", icon: "🎨" },
    { key: "aiChatPerDay", label: "AI-чат (день)", icon: "💬" },
    { key: "teamMembers", label: "Команда", icon: "👥" },
    { key: "abTests", label: "A/B тесты", icon: "🧪" },
    { key: "automations", label: "Автоматизации", icon: "⚡" },
  ];

  // Only show items that have non-zero limits (relevant for current plan)
  const relevantItems = items.filter(item => {
    const info = getUsage(item.key);
    return info.limit > 0 || info.current > 0;
  });

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {relevantItems.map(item => {
        const info = getUsage(item.key);
        const color = getBarColor(info.percentage);
        return (
          <div key={item.key} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
            <span className="text-[14px]">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground truncate">{item.label}</span>
                <span className="text-[10px] font-semibold" style={{ color: info.isInfinite ? "#1a7a6d" : color }}>
                  {info.isInfinite ? "∞" : `${formatValue(info.current)}/${formatValue(info.limit)}`}
                </span>
              </div>
              {!info.isInfinite && (
                <div className="h-1 rounded-full mt-0.5 overflow-hidden" style={{ background: getBarBg(info.percentage) }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(2, info.percentage)}%`, background: color }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}