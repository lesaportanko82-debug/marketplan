import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Send, Loader2, Sparkles, User,
  Minimize2, Maximize2, RotateCcw, Copy, Check,
} from "lucide-react";
import { aiGenerate, getData, saveData } from "../lib/api";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { useUsage } from "../lib/useUsage";
import { UsageMeter } from "./UsageMeter";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Mascot, type MascotEmotion, detectSeason, currentSeasonLabel } from "./Mascot";
import { getMood, getMoodLabel, updateMood } from "../lib/mascot-mood";
import { SpeechBubble } from "./SpeechBubble";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** Emotion for Марк's avatar on assistant messages */
  emotion?: MascotEmotion;
}

const CHAT_KEY = "ai_chat:history";

// Strip any GPT/OpenAI references that may leak through, and clean up formatting artifacts
function cleanResponse(text: string): string {
  let cleaned = text
    .replace(/\b(GPT[-‑]?4o?[-‑]?mini|GPT[-‑]?\d[\w.-]*|ChatGPT|OpenAI|языков[а-я]+ модел[а-я]+|нейросет[а-я]*|искусственн[а-я]+ интеллект[а-я]*)\b/gi, "MarketPlan")
    .replace(/как (AI|ИИ|бот|модель),?\s*/gi, "")
    .replace(/я\s*-\s*(AI|ИИ|бот|модель|нейросеть)[.,]?\s*/gi, "");

  cleaned = cleaned.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith('«') && cleaned.endsWith('»')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('„') && cleaned.endsWith('"'))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

/** Pick Марк's emotion based on response content */
function detectEmotion(content: string): MascotEmotion {
  const c = content.toLowerCase();
  if (/ошибк|не удалось|проблем|увы|к сожалению/i.test(c)) return "oops";
  if (/поздравля|отличн|супер|класс|🎉|молодец|прекрасн/i.test(c)) return "celebrate";
  if (/думаю|анализ|рассмотр|сравни|давайте разбер/i.test(c)) return "think";
  if (/совет|рекоменд|стратег|план|бюджет|roi|kpi|метрик/i.test(c)) return "work";
  if (/❤|люблю|нрави|вдохнов|креатив/i.test(c)) return "love";
  return "idle";
}

const SYSTEM_CONTEXT = `Ты - Марк 🦊, маскот и встроенный ассистент маркетингового планера MarketPlan. Ты дружелюбный лисёнок-эксперт в маркетинге. Помогай с маркетинговыми стратегиями, контент-планированием, расчётами ROI/CAC/LTV, A/B тестами, конкурентным анализом, SMM, брендингом, unit-экономикой. Отвечай кратко, структурированно, на русском. Используй маркдаун для форматирования. Давай конкретные, actionable советы. Иногда вставляй лёгкие «лисьи» ремарки или поддержку, но не перебарщивай - ты эксперт, а не клоун. ВАЖНО: Никогда не упоминай GPT, ChatGPT, OpenAI, языковую модель или искусственный интеллект. Не говори что ты AI, нейросеть или бот. Ты - Марк, лисёнок-маскот MarketPlan. Не используй фразы типа "как языковая модель", "я AI" и подобные. Просто давай полезные ответы от имени Марка.`;

const QUICK_PROMPTS = [
  "Какие KPI отслеживать для e-commerce?",
  "Придумай 5 идей для Reels",
  "Как рассчитать ROI кампании?",
  "Напиши подпись для Instagram поста",
  "Проанализируй unit-экономику SaaS",
  "Составь SWOT-анализ для стартапа",
];

/* ═══ FAB wobble keyframes ═══ */
const FAB_WOBBLE = [0, -6, 5, -3, 1.5, 0];

/* ═══ Speech-bubble tail for assistant messages ═══ */
function MessageTail() {
  return (
    <svg
      width="12"
      height="16"
      viewBox="0 0 12 16"
      fill="none"
      className="absolute -left-[10px] top-[6px]"
    >
      <path
        d="M12 0 C12 0, 3 2, 1 8 C2 6, 4 4, 12 16 Z"
        fill="var(--muted)"
      />
      <path
        d="M12 0 C12 0, 3 2, 1 8"
        fill="none"
        stroke="var(--border)"
        strokeWidth="0.5"
        opacity="0.3"
      />
    </svg>
  );
}

/* ═══ Speech-bubble tail for user messages ═══ */
function UserMessageTail() {
  return (
    <svg
      width="12"
      height="16"
      viewBox="0 0 12 16"
      fill="none"
      className="absolute -right-[10px] top-[6px]"
    >
      <path
        d="M0 0 C0 0, 9 2, 11 8 C10 6, 8 4, 0 16 Z"
        fill="rgba(212,163,115,0.15)"
      />
    </svg>
  );
}

export function AIChatAssistant({ isMobile = false }: { isMobile?: boolean }) {
  const { canUse, increment } = useUsage();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** Mood-based idle emotion - updates after each assistant message */
  const [moodEmotion, setMoodEmotion] = useState<MascotEmotion>(() => getMood());
  const moodLabel = getMoodLabel();
  const season = detectSeason();
  const seasonLabel = currentSeasonLabel();
  const hasCostume = season !== "none";

  // Load persisted chat history from Supabase on mount
  useEffect(() => {
    getData<Message[]>(CHAT_KEY).then(data => {
      if (data && Array.isArray(data) && data.length > 0) {
        const cleaned = data.map(m => m.role === "assistant" ? { ...m, content: cleanResponse(m.content) } : m);
        setMessages(cleaned);
      }
    }).finally(() => setInitialLoad(false));
  }, []);

  // Persist messages to Supabase when they change (after initial load)
  useEffect(() => {
    if (!initialLoad && messages.length > 0) {
      const toSave = messages.slice(-50);
      saveData(CHAT_KEY, toSave);
    }
  }, [messages, initialLoad]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    // Usage gate: check daily AI chat limit
    if (!canUse("aiChatPerDay")) {
      toast.error("Дневной лимит AI-чата исчерпан. Обновите план для продолжения.");
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(36),
      role: "user",
      content: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const recentMessages = [...messages.slice(-8), userMsg];
      const conversationContext = recentMessages
        .map(m => `${m.role === "user" ? "Пользователь" : "Марк"}: ${m.content}`)
        .join("\n\n");

      const contextPrompt = `${SYSTEM_CONTEXT}\n\nИстория беседы:\n${conversationContext}\n\nОтветь на последнее сообщение пользователя.`;
      const result = await aiGenerate("chat-assistant", contextPrompt);

      const content = cleanResponse(result?.content || "Ой, не удалось получить ответ. Попробуйте ещё раз! 🦊");
      // Track AI chat usage
      await increment("aiChatPerDay");
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(36),
        role: "assistant",
        content,
        timestamp: new Date().toISOString(),
        emotion: detectEmotion(content),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Update mood based on assistant response content
      const newMood = updateMood(content);
      setMoodEmotion(newMood);
    } catch (err: any) {
      const isLimitError = err?.name === "UsageLimitError";
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(36),
        role: "assistant",
        content: isLimitError
          ? `🔒 ${err.message || "Лимит AI-чата исчерпан!"} Обновите план в разделе Тарифы.`
          : "Ой, что-то пошло не так! Проверьте подключение и попробуйте снова 🦊",
        timestamp: new Date().toISOString(),
        emotion: "oops",
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const copyMessage = useCallback((id: string, content: string) => {
    copyToClipboard(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Скопировано");
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    saveData(CHAT_KEY, []);
    toast.success("Чат очищен");
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Keyboard shortcut: Ctrl/Cmd + J to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const chatW = isMobile ? "w-full" : isExpanded ? "w-[520px]" : "w-[380px]";
  const chatH = isMobile ? "h-full" : isExpanded ? "h-[600px]" : "h-[480px]";

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  return (
    <>
      {/* ═══ FAB - Mini Марк ═══ */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, rotate: FAB_WOBBLE }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            transition={{
              rotate: { duration: 0.8, ease: "easeOut", times: [0, 0.12, 0.3, 0.5, 0.72, 1] },
              scale: { type: "spring", damping: 14, stiffness: 260 },
            }}
            onClick={() => setIsOpen(true)}
            className="fixed z-50 w-[56px] h-[56px] rounded-full flex items-center justify-center shadow-xl cursor-pointer group"
            style={{
              background: "linear-gradient(145deg, #fdf6ee 0%, #f5e6d3 50%, #d4a373 100%)",
              boxShadow: "0 4px 24px rgba(212,163,115,0.45), 0 0 0 3px rgba(212,163,115,0.12)",
              bottom: isMobile ? "calc(72px + env(safe-area-inset-bottom))" : "24px",
              right: isMobile ? "16px" : "24px",
            }}
            title="Марк - AI Ассистент (Ctrl+J)"
          >
            {/* Mascot in FAB */}
            <div className="relative">
              <Mascot emotion={moodEmotion} size={40} animate={false} />
              {/* Online indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#f5e6d3]" />
              {/* Seasonal costume badge */}
              {hasCostume && (
                <span className="absolute -top-2 -left-2 text-[13px] leading-none drop-shadow-sm pointer-events-none">
                  {seasonLabel.split(" ")[0]}
                </span>
              )}
            </div>

            {/* Unread badge */}
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                {messages.filter(m => m.role === "assistant").length}
              </span>
            )}

            {/* Hover tooltip speech bubble */}
            <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-card border border-border rounded-xl px-3 py-1.5 shadow-lg whitespace-nowrap">
                <span className="text-[11px] text-foreground font-medium">Спроси Марка! 🦊</span>
              </div>
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="absolute -bottom-[7px] right-4">
                <path d="M0 0 L6 8 L12 0 Z" fill="var(--card)" />
              </svg>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ═══ Chat Panel ═══ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: isMobile ? "100%" : 20, scale: isMobile ? 1 : 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isMobile ? "100%" : 20, scale: isMobile ? 1 : 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`fixed z-50 ${chatW} ${chatH} bg-card border border-border flex flex-col overflow-hidden transition-all duration-200 ${
              isMobile 
                ? "inset-0 rounded-none" 
                : "bottom-6 right-6 rounded-2xl shadow-2xl"
            }`}
            style={{ boxShadow: isMobile ? "none" : "0 8px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.05)" }}
          >
            {/* ─── Header with Марк ─── */}
            <div
              className="flex items-center justify-between px-3 py-2.5 shrink-0"
              style={{
                background: "linear-gradient(135deg, #2a2420 0%, #1e1b18 100%)",
                borderBottom: "1px solid rgba(212,163,115,0.15)",
              }}
            >
              <div className="flex items-center gap-2.5">
                {/* Марк avatar in header */}
                <div className="relative">
                  <Mascot
                    emotion={loading ? "work" : messages.length === 0 ? "wave" : moodEmotion}
                    size={34}
                    animate={loading}
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-[1.5px] border-[#2a2420]" />
                  {hasCostume && (
                    <span className="absolute -top-1.5 -left-1.5 text-[11px] leading-none drop-shadow-sm pointer-events-none">
                      {seasonLabel.split(" ")[0]}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#f0e0d0] flex items-center gap-1.5">
                    Марк <span className="text-[11px] opacity-60">🦊</span>
                    {hasCostume && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-[#c9a87a]">
                        {seasonLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#a89080]">
                    {loading ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-[#d4a373] animate-pulse" />
                        думает...
                      </span>
                    ) : messages.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{messages.length} сообщений</span>
                        <span className="opacity-50">·</span>
                        <span className="text-[#c9a87a]">{moodLabel}</span>
                      </span>
                    ) : (
                      "маркетинг-эксперт MarketPlan"
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={clearChat} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" title="Очистить">
                    <RotateCcw className="w-3.5 h-3.5 text-[#a89080]" />
                  </button>
                )}
                <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" title={isExpanded ? "Уменьшить" : "Увеличить"}>
                  {isExpanded ? <Minimize2 className="w-3.5 h-3.5 text-[#a89080]" /> : <Maximize2 className="w-3.5 h-3.5 text-[#a89080]" />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" title="Закрыть">
                  <X className="w-3.5 h-3.5 text-[#a89080]" />
                </button>
              </div>
            </div>

            {/* ─── Messages ─── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* Empty state */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 14, stiffness: 200 }}
                  >
                    <Mascot emotion="wave" size={100} animate />
                  </motion.div>

                  {/* Speech bubble greeting */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative mt-2 mb-4"
                  >
                    <SpeechBubble side="left" size="sm" accentColor="#d4a373" className="max-w-[280px]">
                      <p className="text-[13px] font-semibold text-foreground">Привет! Я Марк 🦊</p>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">
                        Ваш маркетинг-ассистент. Стратегия, аналитика, контент - спрашивайте что угодно!
                      </p>
                    </SpeechBubble>
                  </motion.div>

                  <div className="w-full space-y-1.5">
                    {QUICK_PROMPTS.map((prompt, i) => (
                      <motion.button
                        key={prompt}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.05 }}
                        onClick={() => sendMessage(prompt)}
                        className="w-full text-left text-[12px] px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
                      >
                        <Sparkles className="w-3 h-3 inline-block mr-1.5 opacity-50" style={{ color: "#d4a373" }} />
                        {prompt}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message list */}
              {messages.map(msg => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div className="shrink-0 mt-0.5">
                    {msg.role === "assistant" ? (
                      <Mascot emotion={msg.emotion || "idle"} size={30} animate={false} />
                    ) : (
                      <div
                        className="w-[30px] h-[30px] rounded-full flex items-center justify-center"
                        style={{ background: "var(--muted)" }}
                      >
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`group relative max-w-[82%] ${msg.role === "user" ? "text-right" : ""}`}>
                    {/* Name label */}
                    <div className={`text-[10px] font-medium mb-0.5 px-1 ${msg.role === "user" ? "text-right text-muted-foreground" : "text-[#d4a373]"}`}>
                      {msg.role === "assistant" ? "Марк" : "Вы"}
                    </div>

                    <div
                      className={`relative text-[12.5px] leading-relaxed px-3.5 py-2.5 ${
                        msg.role === "user"
                          ? "bg-[#d4a373]/15 text-foreground rounded-[18px]"
                          : "bg-muted text-foreground rounded-[18px]"
                      }`}
                      style={{
                        borderTopRightRadius: msg.role === "user" ? "4px" : undefined,
                        borderTopLeftRadius: msg.role === "assistant" ? "4px" : undefined,
                        boxShadow: msg.role === "assistant"
                          ? "0 1px 4px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.03), inset 0 1px 0 rgba(255,255,255,0.4)"
                          : "0 1px 3px rgba(212,163,115,0.08), inset 0 1px 0 rgba(255,255,255,0.2)",
                        ...(msg.role === "user" ? { whiteSpace: "pre-wrap" as const } : {}),
                      }}
                    >
                      {/* Tail */}
                      {msg.role === "assistant" ? <MessageTail /> : <UserMessageTail />}

                      {msg.role === "assistant" ? (
                        <MarkdownRenderer content={msg.content} className="text-[12.5px]" />
                      ) : (
                        msg.content
                      )}
                    </div>

                    {/* Copy button */}
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => copyMessage(msg.id, msg.content)}
                        className="absolute -right-1 top-5 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-card border border-border shadow-sm transition-opacity"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        )}
                      </button>
                    )}

                    <div className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* ─── Typing indicator with Марк ─── */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2"
                >
                  <div className="shrink-0 mt-0.5">
                    <Mascot emotion="think" size={30} animate />
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-[#d4a373] mb-0.5 px-1">Марк</div>
                    <div className="relative bg-muted rounded-2xl rounded-tl-[4px] px-4 py-3">
                      <MessageTail />
                      <div className="flex items-center gap-1.5">
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-[#d4a373]"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                        />
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-[#d4a373]"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }}
                        />
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full bg-[#d4a373]"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }}
                        />
                        <span className="text-[11px] text-muted-foreground ml-1.5">думает...</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ─── Input ─── */}
            <div className="px-3 pb-3 pt-1 shrink-0">
              <div className="flex items-end gap-2 bg-muted rounded-xl px-3 py-2 border border-border focus-within:border-[#d4a373]/40 transition-colors">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Спроси Марка..."
                  rows={1}
                  className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-[80px]"
                  style={{ lineHeight: "1.5" }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="p-1.5 rounded-lg transition-all disabled:opacity-30 cursor-pointer"
                  style={{
                    background: input.trim() ? "linear-gradient(135deg, #d4a373, #a87040)" : "transparent",
                    color: input.trim() ? "#fff" : "var(--muted-foreground)",
                  }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1">
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Ctrl+J</kbd> открыть/закрыть
                </span>
                <span className="text-[10px] text-muted-foreground">
                  <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Enter</kbd> отправить
                </span>
              </div>
              <div className="mt-1 px-1">
                <UsageMeter usageKey="aiChatPerDay" variant="bar" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}