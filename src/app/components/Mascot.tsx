/**
 * 🦊 Марк — маскот MarketPlan
 * 
 * Хитрый лисёнок-маркетолог. Энергичный стратег с янтарной шерстью,
 * изумрудным шарфом и вечно горящими идеями.
 * 
 * Характер: дерзкий оптимист, обожает данные и креатив.
 * Всегда найдёт нужную метрику и придумает 10 идей для контента.
 * Немного хвастливый, но невероятно полезный.
 * 
 * Эмоции: idle, wave, think, celebrate, work, oops, sleep, love
 * Костюмы: auto (по дате), newyear, halloween, summer, spring, valentine, none
 * Звуки: Web Audio API, управляются через mascot-sounds.ts
 */

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { playEmotionSound } from "../lib/mascot-sounds";

export type MascotEmotion = "idle" | "wave" | "think" | "celebrate" | "work" | "oops" | "sleep" | "love";
export type MascotCostume = "auto" | "none" | "newyear" | "halloween" | "summer" | "spring" | "valentine";

interface MascotProps {
  emotion?: MascotEmotion;
  size?: number;
  className?: string;
  animate?: boolean;
  costume?: MascotCostume;
  sound?: boolean; // play sound on mount/emotion change
}

// ──── Color palette ────
const C = {
  fur:      "#d4a373",
  furDark:  "#b8874e",
  furLight: "#f0d4aa",
  belly:    "#faf0e0",
  nose:     "#3d2e1e",
  eyeWhite: "#fffdf9",
  pupil:    "#2c2418",
  scarf:    "#1a7a6d",
  scarfHi:  "#2eb8a4",
  blush:    "#e8a07a",
  inner:    "#f7c99b",
};

// ──── Seasonal costume detection ────
export function detectSeason(): MascotCostume {
  const now = new Date();
  const m = now.getMonth(); // 0-based
  const d = now.getDate();

  // New Year: Dec 15 – Jan 15
  if ((m === 11 && d >= 15) || (m === 0 && d <= 15)) return "newyear";
  // Valentine's: Feb 10–16
  if (m === 1 && d >= 10 && d <= 16) return "valentine";
  // Spring: Mar 1 – May 20
  if ((m === 2) || (m === 3) || (m === 4 && d <= 20)) return "spring";
  // Summer: Jun 1 – Aug 31
  if (m === 5 || m === 6 || m === 7) return "summer";
  // Halloween: Oct 20 – Nov 5
  if ((m === 9 && d >= 20) || (m === 10 && d <= 5)) return "halloween";

  return "none";
}

function getActiveCostume(costume: MascotCostume): Exclude<MascotCostume, "auto"> {
  return costume === "auto" ? detectSeason() : costume;
}

// ──── Eyes ────
function Eyes({ emotion, s }: { emotion: MascotEmotion; s: number }) {
  const ex = s * 0.35, ey = s * 0.38, er = s * 0.065, gap = s * 0.12;

  if (emotion === "sleep") {
    return (
      <g>
        <path d={`M${ex - gap - er},${ey} Q${ex - gap},${ey + er * 1.2} ${ex - gap + er},${ey}`}
          fill="none" stroke={C.nose} strokeWidth={s * 0.018} strokeLinecap="round" />
        <path d={`M${ex + gap - er},${ey} Q${ex + gap},${ey + er * 1.2} ${ex + gap + er},${ey}`}
          fill="none" stroke={C.nose} strokeWidth={s * 0.018} strokeLinecap="round" />
        <text x={ex + gap + er * 2.5} y={ey - er * 2} fill={C.scarf} fontSize={s * 0.08} fontWeight="700" fontFamily="monospace" opacity={0.6}>z</text>
        <text x={ex + gap + er * 3.5} y={ey - er * 4} fill={C.scarf} fontSize={s * 0.1} fontWeight="700" fontFamily="monospace" opacity={0.4}>Z</text>
      </g>
    );
  }
  if (emotion === "love") {
    return (
      <g>
        {[ex - gap, ex + gap].map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy={ey} r={er * 1.2} fill={C.eyeWhite} />
            <text x={cx} y={ey + er * 0.5} textAnchor="middle" fontSize={er * 1.6} fill="#e05555">♥</text>
          </g>
        ))}
      </g>
    );
  }
  if (emotion === "oops") {
    return (
      <g>
        {[ex - gap, ex + gap].map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy={ey} r={er * 1.3} fill={C.eyeWhite} />
            <circle cx={cx} cy={ey + er * 0.15} r={er * 0.55} fill={C.pupil} />
            <circle cx={cx + er * 0.15} cy={ey - er * 0.1} r={er * 0.18} fill="#fff" />
            <line x1={cx - er * 0.8} y1={ey - er * 1.6 + (i === 0 ? er * 0.3 : 0)}
              x2={cx + er * 0.8} y2={ey - er * 1.6 + (i === 0 ? 0 : er * 0.3)}
              stroke={C.nose} strokeWidth={s * 0.016} strokeLinecap="round" />
          </g>
        ))}
      </g>
    );
  }
  if (emotion === "think") {
    return (
      <g>
        <path d={`M${ex - gap - er},${ey} Q${ex - gap},${ey - er * 0.8} ${ex - gap + er},${ey}`}
          fill="none" stroke={C.nose} strokeWidth={s * 0.02} strokeLinecap="round" />
        <circle cx={ex + gap} cy={ey} r={er * 1.1} fill={C.eyeWhite} />
        <circle cx={ex + gap + er * 0.25} cy={ey - er * 0.25} r={er * 0.5} fill={C.pupil} />
        <circle cx={ex + gap + er * 0.4} cy={ey - er * 0.4} r={er * 0.16} fill="#fff" />
      </g>
    );
  }
  const lookX = emotion === "work" ? -er * 0.2 : 0;
  const lookY = emotion === "work" ? er * 0.15 : 0;
  return (
    <g>
      {[ex - gap, ex + gap].map((cx, i) => (
        <g key={i}>
          <circle cx={cx} cy={ey} r={er * 1.15} fill={C.eyeWhite} />
          <circle cx={cx + lookX} cy={ey + lookY} r={er * 0.52} fill={C.pupil} />
          <circle cx={cx + lookX + er * 0.18} cy={ey + lookY - er * 0.18} r={er * 0.16} fill="#fff" />
        </g>
      ))}
    </g>
  );
}

// ──── Mouth ────
function Mouth({ emotion, s }: { emotion: MascotEmotion; s: number }) {
  const mx = s * 0.35, my = s * 0.5, w = s * 0.06;
  if (emotion === "celebrate" || emotion === "love")
    return <path d={`M${mx - w * 1.2},${my - w * 0.3} Q${mx},${my + w * 1.8} ${mx + w * 1.2},${my - w * 0.3}`} fill={C.nose} />;
  if (emotion === "oops")
    return <ellipse cx={mx} cy={my + w * 0.3} rx={w * 0.5} ry={w * 0.65} fill={C.nose} />;
  if (emotion === "sleep")
    return <path d={`M${mx - w * 0.6},${my} Q${mx},${my + w * 0.5} ${mx + w * 0.6},${my}`} fill="none" stroke={C.nose} strokeWidth={s * 0.012} strokeLinecap="round" />;
  if (emotion === "think")
    return <path d={`M${mx - w * 0.3},${my} Q${mx + w * 0.3},${my} ${mx + w * 0.8},${my - w * 0.4}`} fill="none" stroke={C.nose} strokeWidth={s * 0.015} strokeLinecap="round" />;
  return <path d={`M${mx - w},${my} Q${mx},${my + w * 0.9} ${mx + w},${my}`} fill="none" stroke={C.nose} strokeWidth={s * 0.015} strokeLinecap="round" />;
}

// ──── Seasonal costume overlays ────
function CostumeOverlay({ costume, s }: { costume: Exclude<MascotCostume, "auto">; s: number }) {
  if (costume === "none") return null;

  // All costumes are drawn relative to the head center at (s*0.35, s*0.37)
  const hx = s * 0.35, hy = s * 0.37;

  if (costume === "newyear") {
    // 🎅 Santa hat — red triangle with white pompom and white brim
    return (
      <g>
        {/* Hat body */}
        <path
          d={`M${hx - s * 0.17},${hy - s * 0.1}
              Q${hx - s * 0.05},${hy - s * 0.35} ${hx + s * 0.08},${hy - s * 0.32}
              L${hx + s * 0.15},${hy - s * 0.1} Z`}
          fill="#c0392b" stroke="#a93226" strokeWidth={s * 0.005}
        />
        {/* Hat highlight */}
        <path
          d={`M${hx - s * 0.1},${hy - s * 0.12}
              Q${hx - s * 0.02},${hy - s * 0.3} ${hx + s * 0.06},${hy - s * 0.28}`}
          fill="none" stroke="#e74c3c" strokeWidth={s * 0.015} strokeLinecap="round" opacity={0.5}
        />
        {/* White brim */}
        <ellipse cx={hx} cy={hy - s * 0.1} rx={s * 0.19} ry={s * 0.035} fill="#ecf0f1" stroke="#ddd" strokeWidth={s * 0.003} />
        {/* Pompom */}
        <circle cx={hx + s * 0.1} cy={hy - s * 0.33} r={s * 0.04} fill="#ecf0f1" stroke="#ddd" strokeWidth={s * 0.003} />
        {/* Snowflake on scarf */}
        <text x={s * 0.38} y={s * 0.54} fontSize={s * 0.045} fill="#ecf0f1" opacity={0.7}>❄</text>
      </g>
    );
  }

  if (costume === "halloween") {
    // 🎃 Witch hat + tiny pumpkin
    return (
      <g>
        {/* Witch hat brim */}
        <ellipse cx={hx} cy={hy - s * 0.1} rx={s * 0.2} ry={s * 0.03} fill="#2c2c2c" />
        {/* Witch hat cone */}
        <path
          d={`M${hx - s * 0.1},${hy - s * 0.11}
              L${hx + s * 0.02},${hy - s * 0.38}
              L${hx + s * 0.12},${hy - s * 0.11} Z`}
          fill="#2c2c2c" stroke="#1a1a1a" strokeWidth={s * 0.004}
        />
        {/* Hat buckle */}
        <rect x={hx - s * 0.04} y={hy - s * 0.16} width={s * 0.1} height={s * 0.035} rx={s * 0.005} fill="#d4a373" />
        <rect x={hx - s * 0.015} y={hy - s * 0.165} width={s * 0.04} height={s * 0.045} rx={s * 0.005} fill="none" stroke="#c08a40" strokeWidth={s * 0.006} />
        {/* Tiny pumpkin near body */}
        <circle cx={s * 0.55} cy={s * 0.72} r={s * 0.035} fill="#e67e22" />
        <rect x={s * 0.545} y={s * 0.68} width={s * 0.01} height={s * 0.02} rx={s * 0.003} fill="#27ae60" />
        {/* Pumpkin face */}
        <text x={s * 0.55} y={s * 0.73} textAnchor="middle" fontSize={s * 0.025} fill="#2c2c2c">⌓</text>
      </g>
    );
  }

  if (costume === "summer") {
    // 😎 Sunglasses + cold drink
    return (
      <g>
        {/* Sunglasses frame */}
        <path
          d={`M${hx - s * 0.18},${hy + s * 0.01}
              L${hx + s * 0.18},${hy + s * 0.01}`}
          fill="none" stroke="#2c2418" strokeWidth={s * 0.012} strokeLinecap="round"
        />
        {/* Left lens */}
        <ellipse cx={hx - s * 0.08} cy={hy + s * 0.02} rx={s * 0.065} ry={s * 0.045}
          fill="#1a1a2e" stroke="#2c2418" strokeWidth={s * 0.008} opacity={0.85} />
        {/* Right lens */}
        <ellipse cx={hx + s * 0.08} cy={hy + s * 0.02} rx={s * 0.065} ry={s * 0.045}
          fill="#1a1a2e" stroke="#2c2418" strokeWidth={s * 0.008} opacity={0.85} />
        {/* Lens glare */}
        <ellipse cx={hx - s * 0.06} cy={hy + s * 0.005} rx={s * 0.02} ry={s * 0.012}
          fill="white" opacity={0.25} transform={`rotate(-20 ${hx - s * 0.06} ${hy + s * 0.005})`} />
        <ellipse cx={hx + s * 0.1} cy={hy + s * 0.005} rx={s * 0.02} ry={s * 0.012}
          fill="white" opacity={0.25} transform={`rotate(-20 ${hx + s * 0.1} ${hy + s * 0.005})`} />
        {/* Ear hooks */}
        <line x1={hx - s * 0.18} y1={hy + s * 0.01} x2={hx - s * 0.2} y2={hy + s * 0.06}
          stroke="#2c2418" strokeWidth={s * 0.008} strokeLinecap="round" />
        <line x1={hx + s * 0.18} y1={hy + s * 0.01} x2={hx + s * 0.2} y2={hy + s * 0.06}
          stroke="#2c2418" strokeWidth={s * 0.008} strokeLinecap="round" />
        {/* Cold drink in right paw */}
        <rect x={s * 0.52} y={s * 0.55} width={s * 0.06} height={s * 0.1} rx={s * 0.008} fill="#5dade2" opacity={0.7} />
        <rect x={s * 0.515} y={s * 0.54} width={s * 0.07} height={s * 0.02} rx={s * 0.005} fill="#85c1e9" />
        {/* Straw */}
        <line x1={s * 0.545} y1={s * 0.42} x2={s * 0.555} y2={s * 0.56} stroke="#e74c3c" strokeWidth={s * 0.006} strokeLinecap="round" />
        {/* Lemon slice */}
        <circle cx={s * 0.57} cy={s * 0.57} r={s * 0.015} fill="#f1c40f" stroke="#e67e22" strokeWidth={s * 0.003} />
      </g>
    );
  }

  if (costume === "spring") {
    // 🌸 Flower crown
    return (
      <g>
        {/* Vine base */}
        <path
          d={`M${hx - s * 0.16},${hy - s * 0.08}
              Q${hx - s * 0.08},${hy - s * 0.17} ${hx},${hy - s * 0.15}
              Q${hx + s * 0.08},${hy - s * 0.17} ${hx + s * 0.16},${hy - s * 0.08}`}
          fill="none" stroke="#27ae60" strokeWidth={s * 0.01} strokeLinecap="round"
        />
        {/* Flowers */}
        {[
          { x: hx - s * 0.12, y: hy - s * 0.13, c: "#f39c12", size: 1 },
          { x: hx - s * 0.04, y: hy - s * 0.16, c: "#e74c3c", size: 1.2 },
          { x: hx + s * 0.04, y: hy - s * 0.16, c: "#d4a373", size: 1.1 },
          { x: hx + s * 0.12, y: hy - s * 0.13, c: "#2eb8a4", size: 0.9 },
        ].map((f, i) => {
          const r = s * 0.018 * f.size;
          return (
            <g key={i}>
              {/* Petals */}
              {[0, 72, 144, 216, 288].map((angle, j) => {
                const rad = (angle * Math.PI) / 180;
                const px = f.x + Math.cos(rad) * r * 0.8;
                const py = f.y + Math.sin(rad) * r * 0.8;
                return <circle key={j} cx={px} cy={py} r={r * 0.55} fill={f.c} opacity={0.85} />;
              })}
              {/* Center */}
              <circle cx={f.x} cy={f.y} r={r * 0.4} fill="#f9e79f" />
            </g>
          );
        })}
        {/* Tiny leaves */}
        <ellipse cx={hx - s * 0.08} cy={hy - s * 0.1} rx={s * 0.015} ry={s * 0.008} fill="#27ae60"
          transform={`rotate(-30 ${hx - s * 0.08} ${hy - s * 0.1})`} />
        <ellipse cx={hx + s * 0.08} cy={hy - s * 0.1} rx={s * 0.015} ry={s * 0.008} fill="#27ae60"
          transform={`rotate(30 ${hx + s * 0.08} ${hy - s * 0.1})`} />
      </g>
    );
  }

  if (costume === "valentine") {
    // 💕 Bow tie with hearts
    return (
      <g>
        {/* Bow tie */}
        <path
          d={`M${hx},${s * 0.52}
              L${hx - s * 0.06},${s * 0.49}
              L${hx - s * 0.06},${s * 0.55}Z`}
          fill="#e05555"
        />
        <path
          d={`M${hx},${s * 0.52}
              L${hx + s * 0.06},${s * 0.49}
              L${hx + s * 0.06},${s * 0.55}Z`}
          fill="#c0392b"
        />
        <circle cx={hx} cy={s * 0.52} r={s * 0.012} fill="#e74c3c" />
        {/* Floating hearts around */}
        <text x={s * 0.06} y={s * 0.18} fontSize={s * 0.04} fill="#e05555" opacity={0.5}>♥</text>
        <text x={s * 0.58} y={s * 0.22} fontSize={s * 0.035} fill="#d4a373" opacity={0.4}>♥</text>
        <text x={s * 0.12} y={s * 0.7} fontSize={s * 0.03} fill="#e05555" opacity={0.3}>♥</text>
      </g>
    );
  }

  return null;
}

// ──── Main component ────
export function Mascot({ emotion = "idle", size = 120, className = "", animate = true, costume = "auto", sound = false }: MascotProps) {
  const s = size;
  const activeCostume = getActiveCostume(costume);
  const lastEmotionRef = useRef(emotion);

  // Play sound on emotion change
  useEffect(() => {
    if (sound && animate && emotion !== lastEmotionRef.current) {
      playEmotionSound(emotion);
    }
    lastEmotionRef.current = emotion;
  }, [emotion, sound, animate]);

  // Play sound on first mount (non-idle)
  useEffect(() => {
    if (sound && animate && emotion !== "idle") {
      const t = setTimeout(() => playEmotionSound(emotion), 200);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bodyAnim = animate ? {
    idle:      { y: [0, -2, 0], transition: { repeat: Infinity, duration: 3, ease: "easeInOut" } },
    wave:      { y: [0, -3, 0], rotate: [0, -2, 2, 0], transition: { repeat: Infinity, duration: 2, ease: "easeInOut" } },
    think:     { y: [0, -1, 0], transition: { repeat: Infinity, duration: 4, ease: "easeInOut" } },
    celebrate: { y: [0, -8, 0], scale: [1, 1.05, 1], transition: { repeat: Infinity, duration: 0.6, ease: "easeInOut" } },
    work:      { y: [0, -1, 0], transition: { repeat: Infinity, duration: 2, ease: "easeInOut" } },
    oops:      { y: [0, 1, 0], transition: { repeat: Infinity, duration: 1.5, ease: "easeInOut" } },
    sleep:     { y: [0, 1, 0], rotate: [0, 2, 0], transition: { repeat: Infinity, duration: 4, ease: "easeInOut" } },
    love:      { y: [0, -4, 0], scale: [1, 1.03, 1], transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut" } },
  }[emotion] : undefined;

  const tailAnim = animate ? { rotate: [-15, 15, -15], transition: { repeat: Infinity, duration: emotion === "celebrate" ? 0.4 : 1.5, ease: "easeInOut" } } : undefined;

  return (
    <motion.div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: s, height: s * 0.95 }}
      animate={bodyAnim}
    >
      <svg viewBox={`0 0 ${s * 0.7} ${s * 0.85}`} width={s * 0.7} height={s * 0.85} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Tail */}
        <motion.g animate={tailAnim} style={{ transformOrigin: `${s * 0.48}px ${s * 0.6}px` }}>
          <path d={`M${s * 0.45},${s * 0.58} Q${s * 0.62},${s * 0.45} ${s * 0.6},${s * 0.32} Q${s * 0.59},${s * 0.28} ${s * 0.55},${s * 0.3} Q${s * 0.56},${s * 0.42} ${s * 0.43},${s * 0.55}`}
            fill={C.fur} stroke={C.furDark} strokeWidth={s * 0.005} />
          <path d={`M${s * 0.6},${s * 0.32} Q${s * 0.59},${s * 0.29} ${s * 0.56},${s * 0.3}`}
            fill={C.furLight} stroke="none" />
        </motion.g>

        {/* Body */}
        <ellipse cx={s * 0.35} cy={s * 0.63} rx={s * 0.18} ry={s * 0.19} fill={C.fur} />
        <ellipse cx={s * 0.35} cy={s * 0.66} rx={s * 0.12} ry={s * 0.13} fill={C.belly} />

        {/* Legs */}
        <ellipse cx={s * 0.27} cy={s * 0.79} rx={s * 0.05} ry={s * 0.04} fill={C.furDark} />
        <ellipse cx={s * 0.43} cy={s * 0.79} rx={s * 0.05} ry={s * 0.04} fill={C.furDark} />

        {/* Left arm */}
        {emotion === "wave" ? (
          <motion.g
            animate={animate ? { rotate: [-5, 25, -5], transition: { repeat: Infinity, duration: 0.5, ease: "easeInOut" } } : undefined}
            style={{ transformOrigin: `${s * 0.22}px ${s * 0.55}px` }}
          >
            <ellipse cx={s * 0.18} cy={s * 0.5} rx={s * 0.04} ry={s * 0.08} fill={C.fur} transform={`rotate(-30 ${s * 0.18} ${s * 0.5})`} />
            <circle cx={s * 0.14} cy={s * 0.45} r={s * 0.025} fill={C.furDark} />
          </motion.g>
        ) : emotion === "think" ? (
          <g>
            <ellipse cx={s * 0.28} cy={s * 0.5} rx={s * 0.035} ry={s * 0.07} fill={C.fur} transform={`rotate(15 ${s * 0.28} ${s * 0.5})`} />
            <circle cx={s * 0.3} cy={s * 0.46} r={s * 0.022} fill={C.furDark} />
          </g>
        ) : (
          <ellipse cx={s * 0.22} cy={s * 0.62} rx={s * 0.04} ry={s * 0.065} fill={C.fur} transform={`rotate(10 ${s * 0.22} ${s * 0.62})`} />
        )}

        {/* Right arm */}
        {emotion === "work" ? (
          <motion.g
            animate={animate ? { rotate: [-3, 3, -3], transition: { repeat: Infinity, duration: 0.3 } } : undefined}
            style={{ transformOrigin: `${s * 0.48}px ${s * 0.58}px` }}
          >
            <ellipse cx={s * 0.48} cy={s * 0.58} rx={s * 0.04} ry={s * 0.065} fill={C.fur} transform={`rotate(-15 ${s * 0.48} ${s * 0.58})`} />
          </motion.g>
        ) : (
          <ellipse cx={s * 0.48} cy={s * 0.62} rx={s * 0.04} ry={s * 0.065} fill={C.fur} transform={`rotate(-10 ${s * 0.48} ${s * 0.62})`} />
        )}

        {/* Head */}
        <ellipse cx={s * 0.35} cy={s * 0.37} rx={s * 0.19} ry={s * 0.17} fill={C.fur} />

        {/* Ears */}
        <motion.g
          animate={animate && emotion === "idle" ? { rotate: [0, -3, 0], transition: { repeat: Infinity, duration: 3, delay: 0.5 } } : undefined}
          style={{ transformOrigin: `${s * 0.22}px ${s * 0.28}px` }}
        >
          <polygon points={`${s * 0.17},${s * 0.12} ${s * 0.12},${s * 0.3} ${s * 0.26},${s * 0.28}`} fill={C.fur} />
          <polygon points={`${s * 0.175},${s * 0.16} ${s * 0.15},${s * 0.28} ${s * 0.24},${s * 0.27}`} fill={C.inner} />
        </motion.g>
        <motion.g
          animate={animate && (emotion === "idle" || emotion === "think") ? { rotate: [0, 4, 0], transition: { repeat: Infinity, duration: 2.5 } } : undefined}
          style={{ transformOrigin: `${s * 0.48}px ${s * 0.28}px` }}
        >
          <polygon points={`${s * 0.53},${s * 0.12} ${s * 0.44},${s * 0.28} ${s * 0.58},${s * 0.3}`} fill={C.fur} />
          <polygon points={`${s * 0.525},${s * 0.16} ${s * 0.46},${s * 0.27} ${s * 0.55},${s * 0.28}`} fill={C.inner} />
        </motion.g>

        {/* Face fur */}
        <ellipse cx={s * 0.35} cy={s * 0.42} rx={s * 0.14} ry={s * 0.1} fill={C.belly} />

        {/* Blush */}
        <circle cx={s * 0.21} cy={s * 0.44} r={s * 0.03} fill={C.blush} opacity={emotion === "love" || emotion === "celebrate" ? 0.6 : 0.3} />
        <circle cx={s * 0.49} cy={s * 0.44} r={s * 0.03} fill={C.blush} opacity={emotion === "love" || emotion === "celebrate" ? 0.6 : 0.3} />

        {/* Eyes — render ONLY for non-sunglasses costumes */}
        {activeCostume !== "summer" && <Eyes emotion={emotion} s={s} />}

        {/* Nose */}
        <ellipse cx={s * 0.35} cy={s * 0.46} rx={s * 0.025} ry={s * 0.018} fill={C.nose} />

        {/* Mouth */}
        <Mouth emotion={emotion} s={s} />

        {/* Scarf (skip for valentine — bow tie replaces it) */}
        {activeCostume !== "valentine" && (
          <g>
            <path d={`M${s * 0.2},${s * 0.5} Q${s * 0.35},${s * 0.54} ${s * 0.5},${s * 0.5}`}
              fill="none" stroke={C.scarf} strokeWidth={s * 0.035} strokeLinecap="round" />
            <path d={`M${s * 0.2},${s * 0.5} Q${s * 0.35},${s * 0.545} ${s * 0.5},${s * 0.5}`}
              fill="none" stroke={C.scarfHi} strokeWidth={s * 0.012} strokeLinecap="round" opacity={0.5} />
            <path d={`M${s * 0.48},${s * 0.5} Q${s * 0.52},${s * 0.56} ${s * 0.47},${s * 0.62}`}
              fill="none" stroke={C.scarf} strokeWidth={s * 0.028} strokeLinecap="round" />
          </g>
        )}

        {/* Celebrate sparkles */}
        {emotion === "celebrate" && (
          <g>
            <motion.text animate={animate ? { opacity: [0, 1, 0], y: [-2, -8], transition: { repeat: Infinity, duration: 0.8 } } : undefined}
              x={s * 0.08} y={s * 0.2} fontSize={s * 0.07} fill="#d4a373">✦</motion.text>
            <motion.text animate={animate ? { opacity: [0, 1, 0], y: [-2, -10], transition: { repeat: Infinity, duration: 1, delay: 0.3 } } : undefined}
              x={s * 0.56} y={s * 0.15} fontSize={s * 0.06} fill="#2eb8a4">✦</motion.text>
            <motion.text animate={animate ? { opacity: [0, 1, 0], y: [-2, -6], transition: { repeat: Infinity, duration: 0.7, delay: 0.5 } } : undefined}
              x={s * 0.6} y={s * 0.35} fontSize={s * 0.05} fill="#c08a40">★</motion.text>
          </g>
        )}

        {/* Work: laptop */}
        {emotion === "work" && (
          <g>
            <rect x={s * 0.26} y={s * 0.7} width={s * 0.18} height={s * 0.02} rx={s * 0.005} fill="#555" />
            <rect x={s * 0.28} y={s * 0.64} width={s * 0.14} height={s * 0.06} rx={s * 0.008} fill="#444" />
            <rect x={s * 0.3} y={s * 0.65} width={s * 0.1} height={s * 0.04} rx={s * 0.004} fill={C.scarfHi} opacity={0.3} />
          </g>
        )}

        {/* Love: floating hearts */}
        {emotion === "love" && animate && (
          <g>
            <motion.text animate={{ opacity: [0, 1, 0], y: [-2, -12] }} transition={{ repeat: Infinity, duration: 1.2 }}
              x={s * 0.06} y={s * 0.25} fontSize={s * 0.06} fill="#e05555">♥</motion.text>
            <motion.text animate={{ opacity: [0, 1, 0], y: [-2, -10] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
              x={s * 0.55} y={s * 0.2} fontSize={s * 0.05} fill="#d4a373">♥</motion.text>
          </g>
        )}

        {/* ═══ Seasonal costume overlay ═══ */}
        <CostumeOverlay costume={activeCostume} s={s} />
      </svg>
    </motion.div>
  );
}

/* ═══ Convenience: Mascot with message bubble ═══ */
interface MascotMessageProps {
  emotion?: MascotEmotion;
  message: string;
  subtext?: string;
  size?: number;
  action?: React.ReactNode;
  className?: string;
}

export function MascotMessage({ emotion = "idle", message, subtext, size = 100, action, className = "" }: MascotMessageProps) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <Mascot emotion={emotion} size={size} />
      <div className="mt-2 max-w-[300px]">
        <p className="text-[14px] font-semibold text-foreground leading-snug">{message}</p>
        {subtext && <p className="text-[12px] text-muted-foreground mt-1">{subtext}</p>}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ═══ Name badge ═══ */
export function MascotBadge({ size = 48, showName = true, className = "" }: { size?: number; showName?: boolean; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Mascot emotion="idle" size={size} animate={false} />
      {showName && (
        <div>
          <span className="text-[13px] font-bold text-foreground">Марк</span>
          <span className="text-[11px] text-muted-foreground block">маскот MarketPlan</span>
        </div>
      )}
    </div>
  );
}

/* ═══ Season label helper ═══ */
export function currentSeasonLabel(): string {
  const c = detectSeason();
  const labels: Record<string, string> = {
    newyear: "🎄 Новогодний",
    halloween: "🎃 Хэллоуин",
    summer: "☀️ Летний",
    spring: "🌸 Весенний",
    valentine: "💕 Валентинов",
    none: "Обычный",
  };
  return labels[c] || "Обычный";
}