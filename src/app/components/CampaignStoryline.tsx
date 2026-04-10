import { useState, useCallback } from "react";
import {
  Film, Loader2, Sparkles, Plus, ChevronRight, ChevronDown,
  Flame, Eye, Rocket, ThumbsUp, Clock, AlertTriangle,
  Copy, Check, X, ArrowRight, Target, Zap, Heart,
  MessageSquare, Star, FileText, Volume2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { aiGenerate } from "../lib/api";
import { useKV } from "../lib/useKV";
import { AddToProjectButton } from "./AddToProjectModal";

/* ========== TYPES ========== */
interface StorylineStage {
  id: string;
  phase: string;
  phaseName: string;
  icon: string;
  color: string;
  duration: string;
  goal: string;
  channels: string[];
  contentPieces: ContentPiece[];
  kpis: string[];
}

interface ContentPiece {
  platform: string;
  type: string;
  headline: string;
  description: string;
}

interface Campaign {
  id: string;
  name: string;
  objective: string;
  targetAudience: string;
  stages: StorylineStage[];
  totalDuration: string;
  createdAt: string;
}

/* ========== PHASE CONFIG ========== */
const PHASE_CONFIG: Record<string, { name: string; icon: any; color: string; bgColor: string }> = {
  warmup: { name: "Прогрев", icon: Flame, color: "text-orange-500", bgColor: "bg-orange-500" },
  intrigue: { name: "Интрига", icon: Eye, color: "text-teal-600", bgColor: "bg-teal-600" },
  launch: { name: "Запуск", icon: Rocket, color: "text-emerald-500", bgColor: "bg-emerald-500" },
  social_proof: { name: "Социальное док-во", icon: ThumbsUp, color: "text-teal-500", bgColor: "bg-teal-500" },
  followup: { name: "Дожим", icon: Target, color: "text-amber-500", bgColor: "bg-amber-500" },
  fomo: { name: "FOMO", icon: Clock, color: "text-red-500", bgColor: "bg-red-500" },
};

const CAMPAIGN_TEMPLATES = [
  { label: "Запуск продукта", objective: "Запуск нового продукта/фичи. Нужно создать ажиотаж, показать ценность, собрать первые продажи.", audience: "Маркетологи и предприниматели 25-45 лет" },
  { label: "Распродажа", objective: "Ограниченная распродажа (3-5 дней). Максимизировать продажи, создать срочность.", audience: "Существующие клиенты и подписчики" },
  { label: "Ребрендинг", objective: "Перезапуск бренда с новым позиционированием. Объяснить изменения, не потерять лояльных.", audience: "Текущие и потенциальные клиенты" },
  { label: "Вебинар/Ивент", objective: "Привлечь максимум регистраций на онлайн-мероприятие. Показать ценность участия.", audience: "Профессионалы индустрии" },
];

/* ========== COMPONENT ========== */
export function CampaignStoryline() {
  const [objective, setObjective] = useState("");
  const [audience, setAudience] = useState("");
  const [duration, setDuration] = useState("2 недели");
  const [generating, setGenerating] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [expandedPiece, setExpandedPiece] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: campaigns, save: saveCampaigns } = useKV<Campaign[]>("campaigns:storylines", []);

  const handleGenerate = useCallback(async () => {
    if (!objective.trim()) {
      toast.error("Опишите цель кампании");
      return;
    }

    setGenerating(true);
    setCampaign(null);

    try {
      const prompt = `Ты - Campaign Storyline Builder. Создай подробную раскадровку маркетинговой кампании как сценарий фильма: с фазами, нарастающим напряжением и кульминацией.

Цель кампании: ${objective}
Целевая аудитория: ${audience || "Широкая аудитория"}
Длительность: ${duration}

Создай кампанию из 6 фаз:
1. WARMUP (Прогрев) - создаём интерес, намекаем
2. INTRIGUE (Интрига) - тизеры, загадки, обратный отсчёт
3. LAUNCH (Запуск) - главное объявление, максимальный охват
4. SOCIAL_PROOF (Социальное доказательство) - отзывы, кейсы, цифры
5. FOLLOWUP (Дожим) - работа с сомневающимися, доп. аргументы
6. FOMO (Срочность) - дедлайны, ограниченность, финальный push

Для КАЖДОЙ фазы:

### PHASE: [WARMUP/INTRIGUE/LAUNCH/SOCIAL_PROOF/FOLLOWUP/FOMO]
**DURATION:** [сколько дней]
**GOAL:** [цель фазы одним предложением]
**CHANNELS:** [каналы через |: Instagram, Telegram, Email, YouTube и т.д.]
**KPI_1:** [метрика для отслеживания]
**KPI_2:** [метрика]

Далее 3-4 конкретных единицы контента:
**CONTENT_1_PLATFORM:** [платформа]
**CONTENT_1_TYPE:** [тип: пост, сторис, email, видео]
**CONTENT_1_HEADLINE:** [заголовок/хук]
**CONTENT_1_DESC:** [описание контента 2-3 предложения]

**CONTENT_2_PLATFORM:** [платформа]
**CONTENT_2_TYPE:** [тип]
**CONTENT_2_HEADLINE:** [заголовок]
**CONTENT_2_DESC:** [описание]

**CONTENT_3_PLATFORM:** [платформа]
**CONTENT_3_TYPE:** [тип]
**CONTENT_3_HEADLINE:** [заголовок]
**CONTENT_3_DESC:** [описание]

**TOTAL_DURATION:** [общая длительность кампании]

ВАЖНО: Каждая фаза должна логически вытекать из предыдущей. Создай ощущение нарастающей интриги. Пиши на русском. Без markdown.`;

      const result = await aiGenerate("campaign-storyline", prompt);
      if (!result?.content) throw new Error("Пустой ответ");

      const raw = result.content;
      const phases = raw.split(/###\s*PHASE:\s*/i).filter(Boolean);
      const stages: StorylineStage[] = [];

      for (const phase of phases) {
        const phaseId = phase.trim().split(/\s|\n/)[0]?.toUpperCase().replace(/[^A-Z_]/g, "");
        const config = PHASE_CONFIG[phaseId.toLowerCase()];
        if (!config) continue;

        const get = (key: string) => {
          const m = phase.match(new RegExp(`\\*\\*${key}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, "i"));
          return cleanMd(m?.[1]?.trim() || "");
        };

        const contentPieces: ContentPiece[] = [];
        for (let i = 1; i <= 4; i++) {
          const platform = get(`CONTENT_${i}_PLATFORM`);
          if (!platform) continue;
          contentPieces.push({
            platform,
            type: get(`CONTENT_${i}_TYPE`),
            headline: get(`CONTENT_${i}_HEADLINE`),
            description: get(`CONTENT_${i}_DESC`),
          });
        }

        stages.push({
          id: phaseId.toLowerCase(),
          phase: phaseId,
          phaseName: config.name,
          icon: phaseId.toLowerCase(),
          color: config.color,
          duration: get("DURATION") || "2-3 дня",
          goal: get("GOAL"),
          channels: get("CHANNELS").split("|").map(s => s.trim()).filter(Boolean),
          contentPieces,
          kpis: [get("KPI_1"), get("KPI_2")].filter(Boolean),
        });
      }

      if (stages.length === 0) throw new Error("Не удалось распарсить фазы");

      const totalDurMatch = raw.match(/\*\*TOTAL_DURATION:\*\*\s*([\s\S]*?)(?=\n|$)/i);

      const newCampaign: Campaign = {
        id: Date.now().toString(),
        name: objective.slice(0, 60),
        objective,
        targetAudience: audience,
        stages,
        totalDuration: cleanMd(totalDurMatch?.[1]?.trim() || duration),
        createdAt: new Date().toISOString(),
      };

      setCampaign(newCampaign);
      setActiveStage(stages[0]?.id || null);
      toast.success(`Кампания из ${stages.length} фаз создана`);

      await saveCampaigns([newCampaign, ...(campaigns || []).slice(0, 9)]);
    } catch (err: any) {
      console.error("Campaign storyline error:", err);
      toast.error(err?.name === "UsageLimitError" ? (err.message || "Лимит исчерпан") : "Ошибка генерации кампании");
    } finally {
      setGenerating(false);
    }
  }, [objective, audience, duration, campaigns, saveCampaigns]);

  const copyContent = (id: string, text: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Скопировано");
  };

  const activeStageData = campaign?.stages.find(s => s.id === activeStage);

  return (
    <div className="p-6 space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground flex items-center gap-2.5">
            <Film className="w-6 h-6 text-[#d4a373]" />
            Campaign Storyline Builder
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            Визуальная раскадровка кампании: от прогрева до FOMO
          </p>
        </div>
        <AddToProjectButton itemType="content-studio" itemId="storyline" itemTitle="Campaign Storyline" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground">Параметры кампании</h3>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-[11px] text-[#d4a373] hover:underline flex items-center gap-1"
              >
                <Star className="w-3 h-3" />Шаблоны
              </button>
            </div>

            {showTemplates && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                {CAMPAIGN_TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => { setObjective(t.objective); setAudience(t.audience); setShowTemplates(false); }}
                    className="text-left p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-[11px] font-medium text-foreground">{t.label}</span>
                    <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">{t.objective}</p>
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Цель кампании: что продвигаем, чего хотим добиться..."
              rows={4}
              className="w-full bg-input-background border border-border rounded-lg px-3 py-2.5 text-[13px] text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
            />
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Целевая аудитория (необязательно)"
              className="w-full px-3 py-2 text-[12px] bg-input-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Длительность:</span>
              {["1 неделя", "2 недели", "1 месяц", "2 месяца"].map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors ${
                    duration === d ? "border-[#d4a373]/40 bg-[#d4a373]/10 text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !objective.trim()}
            className="w-full py-3 bg-[#d4a373] hover:bg-[#c0854a] text-white rounded-xl font-medium text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Создаем сценарий...</>
            ) : (
              <><Film className="w-4 h-4" />Создать Storyline</>
            )}
          </button>

          {/* Past campaigns */}
          {campaigns.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground">Прошлые кампании</h3>
              {campaigns.slice(0, 4).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setCampaign(c); setActiveStage(c.stages[0]?.id || null); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left"
                >
                  <Film className="w-3.5 h-3.5 text-[#d4a373] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[9px] text-muted-foreground">{c.stages.length} фаз - {new Date(c.createdAt).toLocaleDateString("ru")}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Storyline */}
        <div className="lg:col-span-3 space-y-4">
          {!campaign && !generating ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center">
              <Film className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-[14px] font-medium text-muted-foreground">Раскадровка кампании</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">Опишите цель и нажмите "Создать"</p>
            </div>
          ) : generating ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-[#d4a373] animate-spin mb-3" />
              <p className="text-[14px] font-medium text-foreground">Пишем сценарий...</p>
            </div>
          ) : campaign && (
            <>
              {/* Timeline */}
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Film className="w-4 h-4 text-[#d4a373]" />
                  <h3 className="text-[13px] font-semibold text-foreground">Таймлайн: {campaign.totalDuration}</h3>
                </div>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
                  <div className="flex justify-between relative">
                    {campaign.stages.map((stage, i) => {
                      const config = PHASE_CONFIG[stage.id] || PHASE_CONFIG.warmup;
                      const Icon = config.icon;
                      const isActive = activeStage === stage.id;
                      return (
                        <button
                          key={stage.id}
                          onClick={() => setActiveStage(stage.id)}
                          className="flex flex-col items-center gap-1.5 relative z-10"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isActive
                              ? `${config.bgColor} text-white shadow-lg scale-110`
                              : "bg-muted text-muted-foreground hover:scale-105"
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`text-[9px] font-medium text-center max-w-[70px] leading-tight ${
                            isActive ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {stage.phaseName}
                          </span>
                          <span className="text-[8px] text-muted-foreground">{stage.duration}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Active stage detail */}
              {activeStageData && (() => {
                const config = PHASE_CONFIG[activeStageData.id] || PHASE_CONFIG.warmup;
                const Icon = config.icon;
                return (
                  <div className="space-y-3">
                    <div className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl ${config.bgColor} text-white flex items-center justify-center`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-[16px] font-bold text-foreground">{activeStageData.phaseName}</h3>
                          <p className="text-[12px] text-muted-foreground">{activeStageData.duration}</p>
                        </div>
                      </div>

                      {activeStageData.goal && (
                        <div className="bg-muted/30 rounded-lg p-3 mb-3">
                          <p className="text-[11px] text-muted-foreground font-medium mb-0.5">Цель фазы:</p>
                          <p className="text-[13px] text-foreground">{activeStageData.goal}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {activeStageData.channels.map((ch, i) => (
                          <span key={i} className="text-[10px] bg-teal-500/10 text-teal-500 px-2 py-0.5 rounded-full">{ch}</span>
                        ))}
                      </div>

                      {activeStageData.kpis.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {activeStageData.kpis.map((kpi, i) => (
                            <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Target className="w-2.5 h-2.5" />{kpi}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Content pieces */}
                    {activeStageData.contentPieces.map((piece, i) => (
                      <div key={i} className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{piece.platform}</span>
                            <span className="text-[10px] bg-[#d4a373]/10 text-[#d4a373] px-2 py-0.5 rounded-full">{piece.type}</span>
                          </div>
                          <button
                            onClick={() => copyContent(`${activeStageData.id}-${i}`, `${piece.headline}\n\n${piece.description}`)}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            {copiedId === `${activeStageData.id}-${i}`
                              ? <Check className="w-3 h-3 text-emerald-500" />
                              : <Copy className="w-3 h-3" />
                            }
                          </button>
                        </div>
                        <h4 className="text-[13px] font-semibold text-foreground mb-1">{piece.headline}</h4>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">{piece.description}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
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
