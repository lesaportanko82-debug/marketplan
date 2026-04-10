/**
 * 🦊 Мини-игры с Марком при достижении milestone.
 *
 * Два типа:
 *   1. Скретч-карточка — стирайте пальцем/мышью, чтобы открыть награду
 *   2. Колесо фортуны — крутите и получайте маркетинговый совет
 *
 * Модалка появляется автоматически при milestone или по кнопке в UI.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Trophy, Sparkles, RotateCcw } from "lucide-react";
import { Mascot } from "./Mascot";
import {
  getPendingGame,
  markGameShown,
  type Milestone,
} from "../lib/mascot-reactions";
import { playCelebrate, playPop, playSuccess } from "../lib/mascot-sounds";
import { fireConfetti } from "../lib/confetti";

/* ═══════════ SCRATCH CARD ═══════════ */
function ScratchCard({ reward, onDone }: { reward: string; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const scratchedRef = useRef(0);
  const isDrawing = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const CARD_W = 320;
  const CARD_H = 180;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Draw scratch-off coating
    const grd = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    grd.addColorStop(0, "#d4a373");
    grd.addColorStop(0.5, "#c08a40");
    grd.addColorStop(1, "#b8874e");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Sparkle dots
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(Math.random() * CARD_W, Math.random() * CARD_H, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Instruction text
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `bold ${14}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("✨ Сотрите, чтобы открыть награду! ✨", CARD_W / 2, CARD_H / 2 - 4);
    ctx.font = `${11}px system-ui, sans-serif`;
    ctx.fillText("Зажмите мышь и проведите по карточке", CARD_W / 2, CARD_H / 2 + 16);
  }, []);

  const scratch = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    // Check % scratched
    scratchedRef.current += 1;
    if (scratchedRef.current > 35 && !revealed) {
      setRevealed(true);
      playSuccess();
      fireConfetti(2000);
      timerRef.current = setTimeout(onDone, 2500);
    }
  }, [revealed, onDone]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  return (
    <div className="relative" style={{ width: CARD_W, height: CARD_H }}>
      {/* Reward underneath */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border-2 border-dashed overflow-hidden"
        style={{ borderColor: "#1a7a6d", background: "linear-gradient(135deg, #faf7f2 0%, #f5f0e8 100%)" }}
      >
        <Mascot emotion="celebrate" size={60} />
        <p className="text-[13px] text-foreground font-semibold text-center px-6 mt-1 leading-snug max-w-[280px]">
          {reward}
        </p>
      </div>

      {/* Canvas overlay */}
      <canvas
        ref={canvasRef}
        width={CARD_W}
        height={CARD_H}
        className="absolute inset-0 rounded-xl cursor-pointer"
        style={{ touchAction: "none" }}
        onMouseDown={() => { isDrawing.current = true; }}
        onMouseUp={() => { isDrawing.current = false; }}
        onMouseLeave={() => { isDrawing.current = false; }}
        onMouseMove={(e) => { if (isDrawing.current) { const p = getPos(e); if (p) scratch(p.x, p.y); } }}
        onTouchStart={() => { isDrawing.current = true; }}
        onTouchEnd={() => { isDrawing.current = false; }}
        onTouchMove={(e) => { if (isDrawing.current) { const p = getPos(e); if (p) scratch(p.x, p.y); } }}
      />
    </div>
  );
}

/* ═══════════ FORTUNE WHEEL ═══════════ */
const WHEEL_TIPS = [
  "Попробуйте A/B тест заголовков — это даст +20% CTR!",
  "Запустите ретаргетинг на тёплую аудиторию!",
  "Снимите Reels — охваты x3 гарантированы!",
  "Обновите Brand Voice — тренды меняются!",
  "Проведите конкурс — UGC бесплатный контент!",
  "Напишите кейс — это лучший лид-магнит!",
  "Проанализируйте CJM и найдите узкое место!",
  "Попросите отзыв у 3 клиентов прямо сейчас!",
];

const WHEEL_COLORS = ["#d4a373", "#1a7a6d", "#c08a40", "#2eb8a4", "#b8874e", "#0d7377", "#d4a373", "#2d6a4f"];

function FortuneWheel({ onDone }: { onDone: (tip: string) => void }) {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup spin timer on unmount
  useEffect(() => {
    return () => { if (spinTimerRef.current) clearTimeout(spinTimerRef.current); };
  }, []);

  const spin = useCallback(() => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    playPop();

    const idx = Math.floor(Math.random() * WHEEL_TIPS.length);
    const segAngle = 360 / WHEEL_TIPS.length;
    // Spin multiple full rotations + land on segment
    const extraSpins = 4 + Math.floor(Math.random() * 3);
    const targetAngle = extraSpins * 360 + (360 - idx * segAngle - segAngle / 2);
    setRotation(prev => prev + targetAngle);

    spinTimerRef.current = setTimeout(() => {
      setSpinning(false);
      setResult(WHEEL_TIPS[idx]);
      playCelebrate();
    }, 3500);
  }, [spinning]);

  const SIZE = 260;
  const R = SIZE / 2;
  const segAngle = (2 * Math.PI) / WHEEL_TIPS.length;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: SIZE + 20, height: SIZE + 20 }}>
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
          <div
            className="w-0 h-0"
            style={{
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: "18px solid #d4a373",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
            }}
          />
        </div>

        {/* Wheel */}
        <motion.div
          animate={{ rotate: rotation }}
          transition={{ duration: 3.5, ease: [0.17, 0.67, 0.12, 0.99] }}
          className="p-[10px]"
        >
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {WHEEL_TIPS.map((tip, i) => {
              const startAngle = i * segAngle - Math.PI / 2;
              const endAngle = startAngle + segAngle;
              const x1 = R + R * Math.cos(startAngle);
              const y1 = R + R * Math.sin(startAngle);
              const x2 = R + R * Math.cos(endAngle);
              const y2 = R + R * Math.sin(endAngle);
              const largeArc = segAngle > Math.PI ? 1 : 0;

              // Label position
              const midAngle = startAngle + segAngle / 2;
              const labelR = R * 0.65;
              const lx = R + labelR * Math.cos(midAngle);
              const ly = R + labelR * Math.sin(midAngle);
              const angleDeg = (midAngle * 180) / Math.PI;

              return (
                <g key={i}>
                  <path
                    d={`M${R},${R} L${x1},${y1} A${R},${R} 0 ${largeArc},1 ${x2},${y2} Z`}
                    fill={WHEEL_COLORS[i % WHEEL_COLORS.length]}
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth={1.5}
                  />
                  <text
                    x={lx} y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={9}
                    fontWeight={600}
                    transform={`rotate(${angleDeg}, ${lx}, ${ly})`}
                    style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.15)", strokeWidth: 2 }}
                  >
                    {tip.length > 20 ? tip.slice(0, 18) + "…" : tip}
                  </text>
                </g>
              );
            })}
            {/* Center circle */}
            <circle cx={R} cy={R} r={R * 0.15} fill="#faf7f2" stroke="#d4a373" strokeWidth={3} />
            <text x={R} y={R + 1} textAnchor="middle" dominantBaseline="middle" fontSize={16} fill="#d4a373">🦊</text>
          </svg>
        </motion.div>
      </div>

      {result ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1a7a6d]/10 border border-[#1a7a6d]/20 rounded-xl p-4 max-w-[300px] text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-[#1a7a6d]" />
            <span className="text-[12px] font-bold text-[#1a7a6d]">Совет от Марка</span>
          </div>
          <p className="text-[13px] text-foreground leading-relaxed">{result}</p>
          <button
            onClick={() => onDone(result)}
            className="mt-3 text-[11px] text-[#1a7a6d] hover:underline"
          >
            Спасибо, Марк! ✕
          </button>
        </motion.div>
      ) : (
        <button
          onClick={spin}
          disabled={spinning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 shadow-lg"
          style={{
            background: "linear-gradient(135deg, #d4a373, #c08a40)",
            boxShadow: "0 4px 16px rgba(212,163,115,0.3)",
          }}
        >
          <RotateCcw className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
          {spinning ? "Крутится..." : "Крутить колесо!"}
        </button>
      )}
    </div>
  );
}

/* ═══════════ GAME MODAL ═══════════ */
interface GameModalProps {
  milestone: Milestone;
  onClose: () => void;
}

function GameModal({ milestone, onClose }: GameModalProps) {
  const [gameType] = useState<"scratch" | "wheel">(() => Math.random() > 0.5 ? "scratch" : "wheel");
  const [gameComplete, setGameComplete] = useState(false);

  useEffect(() => {
    playCelebrate();
  }, []);

  const handleGameDone = useCallback(() => {
    setGameComplete(true);
    markGameShown(milestone.id);
  }, [milestone.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Мини-игра: достижение"
      className="fixed inset-0 z-[110] flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", damping: 20, stiffness: 250 }}
        className="relative w-full max-w-md mx-4"
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Top bar */}
          <div
            className="h-1.5"
            style={{ background: "linear-gradient(90deg, #d4a373, #1a7a6d, #2eb8a4)" }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-4 right-4 p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="px-6 pt-6 pb-2">
            {/* Achievement badge */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-[#d4a373]/10 border border-[#d4a373]/20">
                {milestone.icon}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-[#d4a373]" />
                  <span className="text-[11px] font-bold text-[#d4a373] uppercase tracking-wide">Достижение!</span>
                </div>
                <h3 className="text-[17px] font-bold text-foreground">{milestone.label}</h3>
                <p className="text-[11px] text-muted-foreground">{milestone.description}</p>
              </div>
            </div>
          </div>

          {/* Game area */}
          <div className="px-6 pb-6 flex flex-col items-center">
            {gameType === "scratch" ? (
              <>
                <p className="text-[12px] text-muted-foreground mb-3 text-center">
                  Марк спрятал для вас подарок! Сотрите карточку:
                </p>
                <ScratchCard reward={milestone.reward} onDone={handleGameDone} />
              </>
            ) : (
              <>
                <p className="text-[12px] text-muted-foreground mb-3 text-center">
                  Марк приготовил колесо советов! Крутите:
                </p>
                <FortuneWheel onDone={() => handleGameDone()} />
              </>
            )}

            {gameComplete && gameType === "scratch" && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={onClose}
                className="mt-4 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Закрыть
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════ MAIN PROVIDER ═══════════ */
export function MascotGamesProvider() {
  const [pendingMilestone, setPendingMilestone] = useState<Milestone | null>(null);

  // Check for pending games on mount and periodically
  useEffect(() => {
    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const check = () => {
      const pending = getPendingGame();
      if (pending && mounted) {
        // Delay a moment so page renders first
        const t = setTimeout(() => { if (mounted) setPendingMilestone(pending); }, 1200);
        timers.push(t);
      }
    };
    check();

    // Listen for milestone events
    const handler = () => {
      const t = setTimeout(check, 500);
      timers.push(t);
    };
    window.addEventListener("mp:milestone:check", handler);
    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      window.removeEventListener("mp:milestone:check", handler);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (pendingMilestone) {
      markGameShown(pendingMilestone.id);
    }
    setPendingMilestone(null);
    // Re-check for more pending
    setTimeout(() => {
      const next = getPendingGame();
      if (next) setTimeout(() => setPendingMilestone(next), 800);
    }, 500);
  }, [pendingMilestone]);

  return (
    <AnimatePresence>
      {pendingMilestone && (
        <GameModal
          key={pendingMilestone.id}
          milestone={pendingMilestone}
          onClose={handleClose}
        />
      )}
    </AnimatePresence>
  );
}

/** Trigger milestone check from any module */
export function triggerMilestoneCheck() {
  window.dispatchEvent(new Event("mp:milestone:check"));
}