/**
 * SpotlightOverlay — fullscreen overlay that highlights a real UI element
 * by creating a rectangular cutout with pulsing ring glow.
 *
 * Activated by clicking a hotspot dot inside mascot tips.
 * Shows a small tooltip label next to the spotlighted element.
 * Auto-dismisses after 4s, or on click/Escape.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MousePointerClick } from "lucide-react";

export interface SpotlightTarget {
  /** CSS selector for the target element, e.g. [data-hotspot="header-search"] */
  selector: string;
  /** Label shown next to the spotlight */
  label: string;
  /** Optional description under the label */
  description?: string;
}

interface SpotlightOverlayProps {
  target: SpotlightTarget | null;
  onClose: () => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 8; // padding around the target
const CORNER_R = 12;

export function SpotlightOverlay({ target, onClose }: SpotlightOverlayProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Find and measure the target element
  const measure = useCallback(() => {
    if (!target) { setRect(null); return; }
    const el = document.querySelector(target.selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }

    // Scroll element into view if needed
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

    // Delay measurement a tick to allow scroll to settle
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      setRect({
        x: r.left - PAD,
        y: r.top - PAD,
        w: r.width + PAD * 2,
        h: r.height + PAD * 2,
      });
    });
  }, [target]);

  useEffect(() => {
    measure();
    const handleResize = () => {
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
      measure();
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  // Auto-dismiss after 4s
  useEffect(() => {
    if (target && rect) {
      timerRef.current = setTimeout(onClose, 4500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [target, rect, onClose]);

  // Escape key
  useEffect(() => {
    if (!target) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [target, onClose]);

  // Tooltip positioning
  const tooltipPos = useCallback((): React.CSSProperties => {
    if (!rect) return {};
    const centerX = rect.x + rect.w / 2;
    const belowY = rect.y + rect.h + 16;
    const aboveY = rect.y - 16;
    const goBelow = belowY + 60 < windowSize.h;

    return {
      position: "fixed",
      left: Math.max(12, Math.min(centerX - 120, windowSize.w - 260)),
      top: goBelow ? belowY : undefined,
      bottom: !goBelow ? windowSize.h - aboveY : undefined,
      zIndex: 10002,
    };
  }, [rect, windowSize]);

  return (
    <AnimatePresence>
      {target && rect && (
        <>
          {/* Dark overlay with cutout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[10000] cursor-pointer"
            onClick={onClose}
            style={{ pointerEvents: "auto" }}
          >
            <svg width="100%" height="100%" className="absolute inset-0">
              <defs>
                <mask id="spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.w}
                    height={rect.h}
                    rx={CORNER_R}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.55)"
                mask="url(#spotlight-mask)"
              />
            </svg>
          </motion.div>

          {/* Pulsing ring around target */}
          <motion.div
            className="fixed z-[10001] pointer-events-none"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              borderRadius: CORNER_R,
            }}
          >
            {/* Outer glow pulse */}
            <motion.div
              className="absolute inset-0 rounded-[inherit]"
              animate={{
                boxShadow: [
                  "0 0 0 0px rgba(212,163,115,0.4), 0 0 16px 4px rgba(212,163,115,0.15)",
                  "0 0 0 6px rgba(212,163,115,0.15), 0 0 24px 8px rgba(212,163,115,0.08)",
                  "0 0 0 0px rgba(212,163,115,0.4), 0 0 16px 4px rgba(212,163,115,0.15)",
                ],
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{
                border: "2px solid rgba(212,163,115,0.7)",
                borderRadius: "inherit",
              }}
            />

            {/* Inner glow */}
            <div
              className="absolute inset-0 rounded-[inherit]"
              style={{
                background: "radial-gradient(ellipse at center, rgba(212,163,115,0.06) 0%, transparent 70%)",
              }}
            />
          </motion.div>

          {/* Tooltip label */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            style={tooltipPos()}
            className="pointer-events-none"
          >
            <div
              className="rounded-[14px] px-4 py-3 border max-w-[240px]"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                boxShadow:
                  "0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(212,163,115,0.15)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <MousePointerClick className="w-3.5 h-3.5 text-[#d4a373] shrink-0" />
                <span className="text-[12px] font-bold text-foreground leading-tight">
                  {target.label}
                </span>
              </div>
              {target.description && (
                <p className="text-[11px] text-muted-foreground leading-[1.5] ml-5.5">
                  {target.description}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-2 ml-5.5">
                <span className="text-[10px] text-muted-foreground">
                  Нажмите куда угодно для закрытия
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ═══ HotspotDot — clickable dot inside speech bubbles ═══ */
interface HotspotDotProps {
  target: SpotlightTarget;
  onClick: (target: SpotlightTarget) => void;
  index?: number;
}

export function HotspotDot({ target, onClick, index = 0 }: HotspotDotProps) {
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        onClick(target);
      }}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors group/dot cursor-pointer"
      style={{
        background: "rgba(212,163,115,0.08)",
        borderColor: "rgba(212,163,115,0.25)",
      }}
      whileHover={{
        background: "rgba(212,163,115,0.18)",
        borderColor: "rgba(212,163,115,0.5)",
        scale: 1.03,
      }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 + index * 0.1 }}
      title={`Подсветить: ${target.label}`}
    >
      {/* Pulsing dot */}
      <span className="relative flex items-center justify-center w-[14px] h-[14px]">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: "rgba(212,163,115,0.3)" }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <span
          className="relative w-[6px] h-[6px] rounded-full"
          style={{ background: "#d4a373" }}
        />
      </span>
      <span className="text-[10px] font-medium text-[#d4a373] group-hover/dot:text-[#c0854a] leading-none">
        {target.label}
      </span>
    </motion.button>
  );
}
