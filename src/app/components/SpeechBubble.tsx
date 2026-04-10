/**
 * SpeechBubble — cloud-style thought bubble for Mascot «Марк» messages.
 *
 * Semi-transparent frosted glass background using CSS custom properties
 * (--bubble-bg, --bubble-border, etc.) defined in theme.css for proper
 * light/dark theme reactivity.
 *
 * Features: organic SVG tail, trailing cloud-puff dots, multi-layer shadow.
 */
import { type ReactNode } from "react";
import { motion } from "motion/react";

type BubbleSide = "left" | "right";
type BubbleSize = "sm" | "md";

/* ═══ Cloud-style SVG tail ═══ */
function CloudTail({ side, size = "md" }: { side: BubbleSide; size?: BubbleSize }) {
  const isRight = side === "right";
  const w = size === "sm" ? 22 : 30;
  const h = size === "sm" ? 20 : 26;

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 30 26"
      fill="none"
      className="absolute -bottom-[20px]"
      style={{
        [isRight ? "right" : "left"]: size === "sm" ? 10 : 22,
        transform: isRight ? "scaleX(-1)" : "none",
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.06))",
        ...(size === "sm" ? { bottom: -14 } : {}),
      }}
    >
      <path
        d="M4 2 C6 2, 8 4, 9 7 C10 10, 9 14, 7 18 C6 20, 4 22, 2 24 C5 21, 9 17, 12 14 C15 11, 20 6, 28 2 Z"
        fill="var(--bubble-tail)"
      />
      <path
        d="M4 2 C6 2, 8 4, 9 7 C10 10, 9 14, 7 18 C6 20, 4 22, 2 24"
        fill="none"
        stroke="var(--bubble-border)"
        strokeWidth="0.8"
      />
      <rect x="0" y="0" width="30" height="4" fill="var(--bubble-tail)" />
    </svg>
  );
}

/* ═══ Trailing thought-puff dots ═══ */
function CloudDots({ side }: { side: BubbleSide }) {
  const isRight = side === "right";
  return (
    <div
      className="absolute -bottom-[36px] flex flex-col gap-[4px]"
      style={{ [isRight ? "right" : "left"]: 16 }}
    >
      <div
        className="w-[8px] h-[8px] rounded-full"
        style={{
          background: "var(--bubble-dot-bg)",
          border: "1px solid var(--bubble-dot-border)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />
      <div
        className="w-[5px] h-[5px] rounded-full"
        style={{
          background: "var(--bubble-dot-bg)",
          border: "1px solid var(--bubble-dot-border)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          marginLeft: isRight ? -3 : 4,
        }}
      />
    </div>
  );
}

/* ═══ Main SpeechBubble ═══ */
interface SpeechBubbleProps {
  children: ReactNode;
  side?: BubbleSide;
  size?: BubbleSize;
  accentColor?: string;
  progressDuration?: number;
  showDots?: boolean;
  className?: string;
}

export function SpeechBubble({
  children,
  side = "left",
  size = "md",
  accentColor,
  progressDuration = 0,
  showDots = true,
  className = "",
}: SpeechBubbleProps) {
  const isSmall = size === "sm";

  return (
    <div className={`relative ${className}`}>
      {/* ─── Bubble body (frosted glass) ─── */}
      <div
        className={`relative overflow-hidden ${
          isSmall ? "rounded-[20px] px-3.5 py-2.5" : "rounded-[24px] px-5 pt-4 pb-3.5"
        }`}
        style={{
          background: "var(--bubble-bg)",
          border: "1px solid var(--bubble-border)",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
          boxShadow: [
            "0 2px 8px rgba(0,0,0,0.04)",
            "0 8px 32px rgba(0,0,0,0.07)",
            "0 16px 48px rgba(0,0,0,0.05)",
            "inset 0 1px 0 rgba(255,255,255,0.5)",
            "inset 0 -1px 0 rgba(0,0,0,0.02)",
            ...(accentColor
              ? [`0 0 28px ${accentColor}18`, `0 0 0 0.5px ${accentColor}20`]
              : ["0 0 20px rgba(212,163,115,0.08)"]),
          ].join(", "),
        }}
      >
        {/* Top cloud shine */}
        <div
          className="absolute inset-x-0 top-0 h-[55%] pointer-events-none rounded-t-[inherit]"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)",
          }}
        />

        {/* Scalloped cloud bumps along top edge */}
        <svg
          className="absolute -top-[1px] pointer-events-none"
          style={{ left: "10%", right: "10%", width: "80%" }}
          height="10"
          viewBox="0 0 200 10"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0,10 C18,10 22,3 38,3 C54,3 54,9 70,9 C86,9 86,2 102,2 C118,2 118,9 134,9 C150,9 150,3 166,3 C182,3 186,10 200,10"
            fill="rgba(255,255,255,0.12)"
          />
        </svg>

        {/* Content */}
        <div className="relative z-[1]">{children}</div>

        {/* Progress bar */}
        {progressDuration > 0 && (
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: progressDuration, ease: "linear" }}
            className={`absolute bottom-0 ${
              isSmall ? "left-2.5 right-2.5" : "left-4 right-4"
            } h-[2px] rounded-full origin-left`}
            style={{
              background: accentColor
                ? `linear-gradient(90deg, ${accentColor}, ${accentColor}80)`
                : "linear-gradient(90deg, #d4a373, #1a7a6d)",
            }}
          />
        )}
      </div>

      {/* ─── Tail ─── */}
      <CloudTail side={side} size={size} />

      {/* ─── Cloud dots ─── */}
      {showDots && <CloudDots side={side} />}
    </div>
  );
}
