import { useState, useCallback } from "react";
import {
  Users, Loader2, Plus, Trash2, Edit3, Save, X, Globe,
  Target, ShoppingCart, MessageSquare, Heart, AlertTriangle,
  Zap, ChevronDown, ChevronRight, Sparkles, Copy, Check,
  User, Briefcase, MapPin, Clock, Smartphone, Star,
} from "lucide-react";
import { toast } from "sonner";
import { aiGenerate } from "../lib/api";
import { useKV } from "../lib/useKV";
import { AddToProjectButton } from "./AddToProjectModal";
import { useUsage } from "../lib/useUsage";
import { checkServerUsage } from "../lib/api";
import { EmptyState } from "./EmptyState";

/* ========== TYPES ========== */
interface Persona {
  id: string;
  name: string;
  age: string;
  occupation: string;
  location: string;
  avatar: string;
  bio: string;
  pains: string[];
  goals: string[];
  triggers: string[];
  objections: string[];
  channels: string[];
  toneOfVoice: string;
  buyingBehavior: string;
  dayInLife: string;
  contentPrefs: string[];
  starred: boolean;
  createdAt: string;
}

interface PersonaProject {
  id: string;
  name: string;
  businessDescription: string;
  personas: Persona[];
  createdAt: string;
}

/* ========== AVATARS ========== */
const AVATAR_EMOJIS = ["👩‍💼", "👨‍💻", "👩‍🎨", "👨‍🔬", "👩‍💻", "🧑‍🏫", "👨‍💼", "👩‍🔧", "🧑‍🍳", "👨‍🎓", "👩‍⚕️", "🧑‍🚀"];

/* ========== COMPONENT ========== */
export function PersonaBuilder() {
  const { canUse, increment, decrement } = useUsage();
  const [businessInput, setBusinessInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("pains");
  const [personaCount, setPersonaCount] = useState(3);

  const { data: projects, save: saveProjects } = useKV<PersonaProject[]>("personas:projects", []);
  const { data: projectsList } = useKV<any[]>("projects:list", []);

  const currentProject = projects[0];
  const personas = currentProject?.personas || [];
  const activePersona = personas.find(p => p.id === selectedPersona);

  const handleGenerate = useCallback(async () => {
    if (!businessInput.trim() && !urlInput.trim()) {
      toast.error("Опишите бизнес или введите URL сайта");
      return;
    }

    // Usage gate: check personas limit (client + server)
    if (!canUse("personas")) {
      toast.error("Лимит персон исчерпан. Обновите план.");
      return;
    }
    try {
      const sc = await checkServerUsage("personas");
      if (sc && !sc.allowed) { toast.error(sc.message || "Лимит персон исчерпан."); return; }
    } catch (e) { console.warn("[PersonaBuilder] Server check failed:", e); }

    // Usage gate: check AI text limit
    if (!canUse("aiTextPerMonth")) {
      toast.error("Лимит AI-генераций текста исчерпан. Обновите план.");
      return;
    }

    setGenerating(true);
    try {
      const context = urlInput.trim()
        ? `URL сайта: ${urlInput}\nОписание: ${businessInput || "Проанализируй сайт и определи бизнес"}`
        : `Описание бизнеса: ${businessInput}`;

      const prompt = `Ты - AI-эксперт по созданию маркетинговых персон. Создай ${personaCount} детальных персон целевой аудитории.

${context}

Для КАЖДОЙ персоны создай ПОЛНЫЙ профиль. Персоны должны быть РАЗНЫМИ: разный возраст, разный сегмент ЦА, разные мотивации.

ФОРМАТ (строго для каждой персоны):

### PERSONA_START
**NAME:** [Реалистичное имя на русском]
**AGE:** [возраст или диапазон, например "28-34"]
**OCCUPATION:** [должность/профессия]
**LOCATION:** [город/регион]
**BIO:** [2-3 предложения - кто этот человек, его жизненная ситуация]
**PAINS:** [3-4 боли через |, например: Нехватка времени | Сложные инструменты | Высокая стоимость]
**GOALS:** [3-4 цели через |]
**TRIGGERS:** [3-4 триггера покупки через | - что подталкивает к покупке]
**OBJECTIONS:** [3-4 возражения через | - почему может НЕ купить]
**CHANNELS:** [3-4 канала через | - где обитает: Instagram, Telegram, YouTube, Email и т.д.]
**TONE:** [каким тоном с ней/ним говорить - 1 предложение]
**BUYING:** [описание покупательского поведения - 1-2 предложения]
**DAY_IN_LIFE:** [типичный день - 2-3 предложения]
**CONTENT_PREFS:** [3-4 типа контента через | - что потребляет: видеообзоры, кейсы, чеклисты и т.д.]
### PERSONA_END

Создай ровно ${personaCount} персон. Пиши на русском. Без markdown в содержимом полей.`;

      const result = await aiGenerate("persona-builder", prompt);
      if (!result?.content) throw new Error("Пустой ответ AI");

      const raw = result.content;
      const personaBlocks = raw.split(/###\s*PERSONA_START/).filter(Boolean);
      const parsed: Persona[] = [];

      for (const block of personaBlocks) {
        const get = (key: string) => {
          const m = block.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|###|$)`, "i"));
          return cleanMd(m?.[1]?.trim() || "");
        };
        const getList = (key: string) => get(key).split("|").map(s => s.trim()).filter(Boolean);

        const name = get("NAME");
        if (!name) continue;

        parsed.push({
          id: `persona-${Date.now()}-${parsed.length}`,
          name,
          age: get("AGE"),
          occupation: get("OCCUPATION"),
          location: get("LOCATION"),
          avatar: AVATAR_EMOJIS[parsed.length % AVATAR_EMOJIS.length],
          bio: get("BIO"),
          pains: getList("PAINS"),
          goals: getList("GOALS"),
          triggers: getList("TRIGGERS"),
          objections: getList("OBJECTIONS"),
          channels: getList("CHANNELS"),
          toneOfVoice: get("TONE"),
          buyingBehavior: get("BUYING"),
          dayInLife: get("DAY_IN_LIFE"),
          contentPrefs: getList("CONTENT_PREFS"),
          starred: false,
          createdAt: new Date().toISOString(),
        });
      }

      if (parsed.length === 0) throw new Error("Не удалось распарсить персон");

      const project: PersonaProject = {
        id: Date.now().toString(),
        name: businessInput.slice(0, 50) || urlInput.slice(0, 50),
        businessDescription: businessInput || urlInput,
        personas: parsed,
        createdAt: new Date().toISOString(),
      };

      await saveProjects([project, ...(projects || []).slice(0, 9)]);
      setSelectedPersona(parsed[0]?.id || null);
      await increment("personas", parsed.length);
      await increment("aiTextPerMonth");
      toast.success(`Создано ${parsed.length} персон`);
    } catch (err: any) {
      console.error("Persona generation error:", err);
      toast.error(err?.name === "UsageLimitError" ? (err.message || "Лимит исчерпан") : "Ошибка генерации персон");
    } finally {
      setGenerating(false);
    }
  }, [businessInput, urlInput, personaCount, projects, saveProjects, canUse, increment]);

  const toggleStar = async (personaId: string) => {
    if (!currentProject) return;
    const updated = {
      ...currentProject,
      personas: currentProject.personas.map(p =>
        p.id === personaId ? { ...p, starred: !p.starred } : p
      ),
    };
    await saveProjects([updated, ...projects.slice(1)]);
  };

  const deletePersona = async (personaId: string) => {
    if (!currentProject) return;
    const updated = {
      ...currentProject,
      personas: currentProject.personas.filter(p => p.id !== personaId),
    };
    await saveProjects([updated, ...projects.slice(1)]);
    if (selectedPersona === personaId) setSelectedPersona(updated.personas[0]?.id || null);
    await decrement("personas");
    toast.success("Персона удалена");
  };

  const Section = ({ id, title, icon: Icon, children }: { id: string; title: string; icon: any; children: React.ReactNode }) => {
    const isOpen = expandedSection === id;
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setExpandedSection(isOpen ? null : id)}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-[#d4a373]" />
            <span className="text-[12px] font-semibold text-foreground">{title}</span>
          </div>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        {isOpen && <div className="px-3 pb-3 pt-1">{children}</div>}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#d4a373] shrink-0" />
            Audience Persona Builder
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1 hidden sm:block">
            AI генерирует живые персоны ЦА с болями, триггерами и покупательским поведением
          </p>
        </div>
        <AddToProjectButton itemType="content-studio" itemId="personas" itemTitle="Persona Builder" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
        {/* Left */}
        <div className="lg:col-span-2 space-y-4">
          {/* Input */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#d4a373]" />
              Опишите бизнес
            </h3>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="URL сайта (необязательно)"
              className="w-full px-3 py-2 text-[12px] bg-input-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
            />
            <textarea
              value={businessInput}
              onChange={(e) => setBusinessInput(e.target.value)}
              placeholder="Опишите ваш бизнес: что продаёте, кому, в чем ценность, сегмент рынка..."
              rows={4}
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 text-[13px] text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">Кол-во персон:</span>
              {[2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setPersonaCount(n)}
                  className={`w-8 h-8 rounded-lg text-[12px] font-medium transition-colors ${
                    personaCount === n
                      ? "bg-[#d4a373] text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || (!businessInput.trim() && !urlInput.trim())}
            className="w-full py-3 bg-[#d4a373] hover:bg-[#c0854a] text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Создаем {personaCount} персон...</>
            ) : (
              <><Sparkles className="w-4 h-4" />Сгенерировать персон</>
            )}
          </button>

          {/* Persona cards */}
          {personas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground">Персоны ({personas.length})</h3>
              {personas.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPersona(p.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    selectedPersona === p.id
                      ? "border-[#d4a373]/40 bg-[#d4a373]/5 shadow-sm"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <span className="text-[28px]">{p.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground">{p.name}</span>
                      {p.starred && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{p.age} - {p.occupation}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{p.bio}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(p.id); }}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <Star className={`w-3 h-3 ${p.starred ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deletePersona(p.id); }}
                      className="p-1 hover:bg-red-500/10 rounded"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Persona detail */}
        <div className="lg:col-span-3">
          {!activePersona && !generating ? (
            <EmptyState
              title="Персоны появятся здесь"
              description="Опишите ваш бизнес и нажмите «Создать персоны» - AI составит детальные портреты ЦА"
              emotion="idle"
              compact
            />
          ) : generating ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-[#d4a373] animate-spin mb-3" />
              <p className="text-[14px] font-medium text-foreground">Создаем персон...</p>
            </div>
          ) : activePersona && (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <span className="text-[48px]">{activePersona.avatar}</span>
                  <div className="flex-1">
                    <h2 className="text-[20px] font-bold text-foreground">{activePersona.name}</h2>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />{activePersona.age}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        <Briefcase className="w-3 h-3" />{activePersona.occupation}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        <MapPin className="w-3 h-3" />{activePersona.location}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed">{activePersona.bio}</p>
                  </div>
                </div>

                {/* Channels */}
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
                  {activePersona.channels.map((ch, i) => (
                    <span key={i} className="text-[10px] bg-teal-500/10 text-teal-500 px-2 py-0.5 rounded-full">{ch}</span>
                  ))}
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-2">
                <Section id="pains" title="Боли и проблемы" icon={AlertTriangle}>
                  <div className="space-y-1.5">
                    {activePersona.pains.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <span className="text-[12px] text-foreground">{p}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section id="goals" title="Цели и желания" icon={Target}>
                  <div className="space-y-1.5">
                    {activePersona.goals.map((g, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span className="text-[12px] text-foreground">{g}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section id="triggers" title="Триггеры покупки" icon={Zap}>
                  <div className="space-y-1.5">
                    {activePersona.triggers.map((t, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Zap className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-[12px] text-foreground">{t}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section id="objections" title="Возражения" icon={ShoppingCart}>
                  <div className="space-y-1.5">
                    {activePersona.objections.map((o, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <X className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                        <span className="text-[12px] text-foreground">{o}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section id="tone" title="Тон коммуникации" icon={MessageSquare}>
                  <p className="text-[12px] text-foreground leading-relaxed">{activePersona.toneOfVoice}</p>
                </Section>

                <Section id="buying" title="Покупательское поведение" icon={ShoppingCart}>
                  <p className="text-[12px] text-foreground leading-relaxed">{activePersona.buyingBehavior}</p>
                </Section>

                <Section id="dayinlife" title="Типичный день" icon={Clock}>
                  <p className="text-[12px] text-foreground leading-relaxed">{activePersona.dayInLife}</p>
                </Section>

                <Section id="content" title="Контент-предпочтения" icon={Heart}>
                  <div className="flex flex-wrap gap-1.5">
                    {activePersona.contentPrefs.map((c, i) => (
                      <span key={i} className="text-[11px] bg-teal-600/10 text-teal-600 px-2 py-1 rounded-lg">{c}</span>
                    ))}
                  </div>
                </Section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cleanMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}