/**
 * 🦊 Плавающие реакции Марка на действия пользователя.
 *
 * Cloud-style speech bubble с wobble-анимацией.
 * Пузырь-облачко появляется снизу слева, стакаются вверх.
 *
 * Вызов: showMascotReaction("save") из любого модуля.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mascot } from "./Mascot";
import { SpeechBubble } from "./SpeechBubble";
import {
  onMascotReaction,
  REACTION_CONFIGS,
  type ReactionEvent,
  type ReactionConfig,
} from "../lib/mascot-reactions";
import { playEmotionSound } from "../lib/mascot-sounds";

interface ActiveReaction {
  id: number;
  config: ReactionConfig;
  text: string;
  side: "left" | "right";
}

let reactionIdCounter = 0;
let sideToggle = false;

/* ═══ Wobble keyframes ═══ */
const WOBBLE_ROTATE = [0, -3, 2.5, -1.5, 0.7, 0];
const WOBBLE_TIMES = [0, 0.12, 0.3, 0.5, 0.72, 1];

export function MascotReactionsProvider() {
  const [reactions, setReactions] = useState<ActiveReaction[]>([]);
  const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const addReaction = useCallback((evt: ReactionEvent) => {
    const config = REACTION_CONFIGS[evt.type];
    if (!config) return;

    const id = ++reactionIdCounter;
    const text = evt.text || config.text;

    sideToggle = !sideToggle;
    const side: "left" | "right" = sideToggle ? "left" : "right";

    setReactions((prev) => {
      const next = prev.length >= 3 ? prev.slice(1) : [...prev];
      return [...next, { id, config, text, side }];
    });

    playEmotionSound(config.emotion);

    const timeout = setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
      timeoutsRef.current.delete(id);
    }, config.duration);

    timeoutsRef.current.set(id, timeout);
  }, []);

  useEffect(() => {
    const unsub = onMascotReaction(addReaction);
    return () => {
      unsub();
      timeoutsRef.current.forEach((t) => clearTimeout(t));
    };
  }, [addReaction]);

  return (
    <div className="fixed bottom-6 left-6 z-[46] flex flex-col-reverse gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {reactions.map((reaction) => {
          const isLeft = reaction.side === "left";
          const slideX = isLeft ? -30 : 30;
          return (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 0, x: slideX, scale: 0.7, y: 20, rotate: 0 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
                y: 0,
                rotate: WOBBLE_ROTATE,
              }}
              exit={{ opacity: 0, x: slideX * 0.6, scale: 0.85, y: -10 }}
              transition={{
                rotate: {
                  duration: 0.65,
                  ease: "easeOut",
                  times: WOBBLE_TIMES,
                },
                opacity: { type: "spring", damping: 18, stiffness: 280 },
                x: { type: "spring", damping: 18, stiffness: 280 },
                y: { type: "spring", damping: 18, stiffness: 280 },
                scale: { type: "spring", damping: 18, stiffness: 280 },
              }}
              style={{
                transformOrigin: isLeft ? "bottom left" : "bottom right",
              }}
              className="pointer-events-auto"
            >
              {/* Wrapper: cloud bubble on top, mascot below */}
              <div
                className={`flex flex-col ${
                  isLeft ? "items-start" : "items-end"
                }`}
              >
                {/* ─── Cloud Speech Bubble ─── */}
                <SpeechBubble
                  side={reaction.side}
                  size="sm"
                  accentColor={reaction.config.color}
                  progressDuration={reaction.config.duration / 1000}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Accent emoji/dot */}
                    <span className="text-[14px] leading-none shrink-0">
                      {reaction.config.emotion === "celebrate"
                        ? "🎉"
                        : reaction.config.emotion === "love"
                        ? "💚"
                        : reaction.config.emotion === "oops"
                        ? "😬"
                        : reaction.config.emotion === "think"
                        ? "💭"
                        : reaction.config.emotion === "work"
                        ? "🔧"
                        : reaction.config.emotion === "wave"
                        ? "👋"
                        : reaction.config.emotion === "sleep"
                        ? "💤"
                        : "🦊"}
                    </span>
                    <span className="text-[12px] font-semibold text-foreground leading-tight">
                      {reaction.text}
                    </span>
                  </div>
                </SpeechBubble>

                {/* ─── Mini Mascot ─── */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    damping: 12,
                    stiffness: 260,
                    delay: 0.08,
                  }}
                  className={`shrink-0 ${
                    isLeft ? "ml-1" : "mr-1"
                  } mt-1`}
                >
                  <Mascot
                    emotion={reaction.config.emotion}
                    size={36}
                    animate
                  />
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
