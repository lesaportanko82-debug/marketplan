import { useState, useCallback, type ReactNode } from "react";
import {
  Radar, Loader2, Sparkles, Plus, Globe, Trash2,
  Eye, Shield, Crosshair, TrendingUp, TrendingDown,
  MessageSquare, Zap, Copy, Check, ArrowRight, Target,
  AlertTriangle, CheckCircle2, BarChart3, Clock,
  ChevronDown, ChevronRight, Swords, Star, Hash,
  FileText, Lightbulb, RefreshCw, X, Instagram, Youtube,
  Send, Facebook, Twitter, Link2, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { aiGenerate } from "../lib/api";
import { useKV } from "../lib/useKV";
import { AddToProjectButton } from "./AddToProjectModal";
import { EmptyState } from "./EmptyState";

/* ========== TYPES ========== */
interface CompetitorLinks {
  website: string;
  instagram: string;
  telegram: string;
  youtube: string;
  facebook: string;
  tiktok: string;
  other: string;
}

interface CompetitorProfile {
  name: string;
  links: CompetitorLinks;
  notes: string;
}

interface CreativeAnalysis {
  hooks: string[];
  toneDescription: string;
  postingFrequency: string;
  topFormats: string[];
  strengths: string[];
  weaknesses: string[];
  uniqueAngles: string[];
}

interface CounterContent {
  platform: string;
  type: string;
  headline: string;
  description: string;
  targetWeakness: string;
}

interface SpyReport {
  id: string;
  competitor: CompetitorProfile;
  analysis: CreativeAnalysis;
  counterContent: CounterContent[];
  overallThreat: number;
  opportunityScore: number;
  createdAt: string;
}

const EMPTY_LINKS: CompetitorLinks = {
  website: "",
  instagram: "",
  telegram: "",
  youtube: "",
  facebook: "",
  tiktok: "",
  other: "",
};

const LINK_FIELDS: { key: keyof CompetitorLinks; label: string; placeholder: string; icon: any; color: string }[] = [
  { key: "website", label: "Сайт", placeholder: "https://example.com", icon: Globe, color: "text-teal-500" },
  { key: "instagram", label: "Instagram", placeholder: "@username или ссылка", icon: Instagram, color: "text-amber-600" },
  { key: "telegram", label: "Telegram", placeholder: "@channel или t.me/...", icon: Send, color: "text-sky-500" },
  { key: "youtube", label: "YouTube", placeholder: "Ссылка на канал", icon: Youtube, color: "text-red-500" },
  { key: "facebook", label: "Facebook", placeholder: "Ссылка на страницу", icon: Facebook, color: "text-blue-600" },
  { key: "tiktok", label: "TikTok", placeholder: "@username", icon: Zap, color: "text-foreground" },
  { key: "other", label: "Другое", placeholder: "X/Twitter, LinkedIn, VK...", icon: Link2, color: "text-muted-foreground" },
];

/* ========== COMPONENT ========== */
export function CompetitorSpy() {
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([
    { name: "", links: { ...EMPTY_LINKS }, notes: "" },
  ]);
  const [myBusiness, setMyBusiness] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [currentCompIdx, setCurrentCompIdx] = useState(0);
  const [reports, setReports] = useState<SpyReport[]>([]);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string>("hooks");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [rawDebug, setRawDebug] = useState<string | null>(null);

  const { data: savedReports, save: saveReports } = useKV<SpyReport[]>("competitor:spy_reports", []);

  const addCompetitor = () => {
    setCompetitors(prev => [...prev, { name: "", links: { ...EMPTY_LINKS }, notes: "" }]);
    setCurrentCompIdx(competitors.length);
  };

  const removeCompetitor = (i: number) => {
    if (competitors.length <= 1) return;
    const next = competitors.filter((_, idx) => idx !== i);
    setCompetitors(next);
    setCurrentCompIdx(Math.min(currentCompIdx, next.length - 1));
  };

  const updateName = (i: number, val: string) => {
    setCompetitors(prev => prev.map((c, idx) => idx === i ? { ...c, name: val } : c));
  };

  const updateLink = (i: number, key: keyof CompetitorLinks, val: string) => {
    setCompetitors(prev =>
      prev.map((c, idx) => idx === i ? { ...c, links: { ...c.links, [key]: val } } : c)
    );
  };

  const updateNotes = (i: number, val: string) => {
    setCompetitors(prev => prev.map((c, idx) => idx === i ? { ...c, notes: val } : c));
  };

  const isCompValid = (c: CompetitorProfile) => {
    return c.name.trim() || Object.values(c.links).some(v => v.trim()) || c.notes.trim();
  };

  /* ========== PARSE HELPER ========== */
  function parseField(raw: string, key: string): string {
    // Try **KEY:** pattern first
    const r1 = new RegExp("\\*\\*" + key + ":\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*[A-Z_]+:|$)", "i");
    const m1 = raw.match(r1);
    if (m1?.[1]?.trim()) return cleanMd(m1[1].trim());

    // Fallback: KEY: pattern (no bold)
    const r2 = new RegExp("^" + key + ":\\s*(.+)", "im");
    const m2 = raw.match(r2);
    if (m2?.[1]?.trim()) return cleanMd(m2[1].trim());

    return "";
  }

  function parseList(raw: string, prefix: string, count: number): string[] {
    const items: string[] = [];
    for (let i = 1; i <= count; i++) {
      const val = parseField(raw, `${prefix}_${i}`);
      if (val) items.push(val);
    }
    return items;
  }

  /* ========== ANALYZE ========== */
  const handleAnalyze = useCallback(async () => {
    const validCompetitors = competitors.filter(isCompValid);
    if (validCompetitors.length === 0) {
      toast.error("Добавьте хотя бы одного конкурента");
      return;
    }

    setAnalyzing(true);
    setReports([]);
    setRawDebug(null);

    try {
      const allReports: SpyReport[] = [];

      for (const comp of validCompetitors) {
        const linkLines: string[] = [];
        if (comp.links.website) linkLines.push("Сайт: " + comp.links.website);
        if (comp.links.instagram) linkLines.push("Instagram: " + comp.links.instagram);
        if (comp.links.telegram) linkLines.push("Telegram: " + comp.links.telegram);
        if (comp.links.youtube) linkLines.push("YouTube: " + comp.links.youtube);
        if (comp.links.facebook) linkLines.push("Facebook: " + comp.links.facebook);
        if (comp.links.tiktok) linkLines.push("TikTok: " + comp.links.tiktok);
        if (comp.links.other) linkLines.push("Другое: " + comp.links.other);

        const compContext = [
          comp.name && ("Название: " + comp.name),
          linkLines.length > 0 && ("Ссылки:\n" + linkLines.join("\n")),
          comp.notes && ("Заметки/контент: " + comp.notes),
        ].filter(Boolean).join("\n\n");

        const prompt = [
          "Ты - Competitor Creative Spy AI. Проанализируй конкурента и создай стратегию контратаки.",
          "",
          "МОЙ БИЗНЕС: " + (myBusiness || "Не указан"),
          "",
          "КОНКУРЕНТ:",
          compContext,
          "",
          "На основе названия, ссылок на соцсети и сайт, а также любых заметок - проанализируй вероятную контент-стратегию конкурента. По ссылкам определи нишу, позиционирование, tone of voice. Если данных мало, делай обоснованные предположения.",
          "",
          "Ответь СТРОГО в таком формате (каждое поле с новой строки):",
          "",
          "HOOKS_1: типичный хук/заход конкурента",
          "HOOKS_2: ещё хук",
          "HOOKS_3: ещё хук",
          "HOOKS_4: ещё хук",
          "",
          "TONE: описание тональности их контента 2-3 предложения",
          "POSTING_FREQ: оценка частоты постинга",
          "",
          "FORMAT_1: популярный формат контента",
          "FORMAT_2: формат",
          "FORMAT_3: формат",
          "",
          "STRENGTH_1: сильная сторона их контента",
          "STRENGTH_2: сильная сторона",
          "STRENGTH_3: сильная сторона",
          "",
          "WEAKNESS_1: слабая сторона или упущение",
          "WEAKNESS_2: слабая сторона",
          "WEAKNESS_3: слабая сторона",
          "",
          "ANGLE_1: уникальный угол или подход конкурента",
          "ANGLE_2: угол",
          "",
          "THREAT_SCORE: число от 0 до 100",
          "OPPORTUNITY_SCORE: число от 0 до 100",
          "",
          "COUNTER_1_PLATFORM: платформа",
          "COUNTER_1_TYPE: тип контента",
          "COUNTER_1_HEADLINE: заголовок или хук",
          "COUNTER_1_DESC: описание 2-3 предложения",
          "COUNTER_1_TARGET: какую слабость конкурента эксплуатирует",
          "",
          "COUNTER_2_PLATFORM: платформа",
          "COUNTER_2_TYPE: тип",
          "COUNTER_2_HEADLINE: заголовок",
          "COUNTER_2_DESC: описание",
          "COUNTER_2_TARGET: слабость",
          "",
          "COUNTER_3_PLATFORM: платформа",
          "COUNTER_3_TYPE: тип",
          "COUNTER_3_HEADLINE: заголовок",
          "COUNTER_3_DESC: описание",
          "COUNTER_3_TARGET: слабость",
          "",
          "COUNTER_4_PLATFORM: платформа",
          "COUNTER_4_TYPE: тип",
          "COUNTER_4_HEADLINE: заголовок",
          "COUNTER_4_DESC: описание",
          "COUNTER_4_TARGET: слабость",
          "",
          "ВАЖНО: НЕ используй markdown (** ## и т.д.). Пиши чистый текст. Каждое поле начинай с его имени и двоеточия. Пиши на русском. Будь конкретен.",
        ].join("\n");

        const result = await aiGenerate("competitor-spy", prompt);
        if (!result?.content) {
          console.error("CompetitorSpy: empty AI response for", comp.name);
          toast.error("Пустой ответ AI для " + (comp.name || "конкурента"));
          continue;
        }

        const raw = result.content;
        console.log("CompetitorSpy raw response:", raw.substring(0, 500));
        setRawDebug(raw);

        const analysis: CreativeAnalysis = {
          hooks: parseList(raw, "HOOKS", 4),
          toneDescription: parseField(raw, "TONE"),
          postingFrequency: parseField(raw, "POSTING_FREQ"),
          topFormats: parseList(raw, "FORMAT", 3),
          strengths: parseList(raw, "STRENGTH", 3),
          weaknesses: parseList(raw, "WEAKNESS", 3),
          uniqueAngles: parseList(raw, "ANGLE", 3),
        };

        // Check if we got meaningful data
        const totalFields = analysis.hooks.length + analysis.strengths.length + analysis.weaknesses.length;
        if (totalFields === 0) {
          console.warn("CompetitorSpy: regex parse got 0 fields, trying line-based fallback");
          // Fallback: try splitting by lines and matching KEY: VALUE
          const lines = raw.split("\n");
          for (const line of lines) {
            const m = line.match(/^(?:\*\*)?([A-Z_]+\d*)(?:\*\*)?:\s*(.+)/);
            if (!m) continue;
            const [, k, v] = m;
            const val = cleanMd(v.trim());
            if (!val) continue;
            if (k.startsWith("HOOKS_")) analysis.hooks.push(val);
            else if (k === "TONE") analysis.toneDescription = val;
            else if (k === "POSTING_FREQ") analysis.postingFrequency = val;
            else if (k.startsWith("FORMAT_")) analysis.topFormats.push(val);
            else if (k.startsWith("STRENGTH_")) analysis.strengths.push(val);
            else if (k.startsWith("WEAKNESS_")) analysis.weaknesses.push(val);
            else if (k.startsWith("ANGLE_")) analysis.uniqueAngles.push(val);
          }
        }

        const counterContent: CounterContent[] = [];
        for (let i = 1; i <= 4; i++) {
          const platform = parseField(raw, `COUNTER_${i}_PLATFORM`);
          if (!platform) {
            // Fallback line scan
            const lines = raw.split("\n");
            let pf = "", tp = "", hl = "", ds = "", tg = "";
            for (const line of lines) {
              const m = line.match(/^(?:\*\*)?COUNTER_(\d)_([A-Z]+)(?:\*\*)?:\s*(.+)/);
              if (!m || m[1] !== String(i)) continue;
              const val = cleanMd(m[3].trim());
              if (m[2] === "PLATFORM") pf = val;
              else if (m[2] === "TYPE") tp = val;
              else if (m[2] === "HEADLINE") hl = val;
              else if (m[2] === "DESC") ds = val;
              else if (m[2] === "TARGET") tg = val;
            }
            if (pf) counterContent.push({ platform: pf, type: tp, headline: hl, description: ds, targetWeakness: tg });
            continue;
          }
          counterContent.push({
            platform,
            type: parseField(raw, `COUNTER_${i}_TYPE`),
            headline: parseField(raw, `COUNTER_${i}_HEADLINE`),
            description: parseField(raw, `COUNTER_${i}_DESC`),
            targetWeakness: parseField(raw, `COUNTER_${i}_TARGET`),
          });
        }

        const threatStr = parseField(raw, "THREAT_SCORE") || "50";
        const opporStr = parseField(raw, "OPPORTUNITY_SCORE") || "50";

        allReports.push({
          id: "spy-" + Date.now() + "-" + allReports.length,
          competitor: comp,
          analysis,
          counterContent,
          overallThreat: Math.min(100, Math.max(0, parseInt(threatStr) || 50)),
          opportunityScore: Math.min(100, Math.max(0, parseInt(opporStr) || 50)),
          createdAt: new Date().toISOString(),
        });
      }

      if (allReports.length === 0) {
        toast.error("Не удалось проанализировать конкурентов");
        return;
      }

      setReports(allReports);
      setActiveReport(allReports[0]?.id || null);
      toast.success("Проанализировано " + allReports.length + " конкурентов");

      await saveReports([...allReports, ...(savedReports || []).slice(0, 15)]);
    } catch (err: any) {
      console.error("Competitor spy error:", err);
      toast.error("Ошибка анализа: " + (err?.message || "неизвестная ошибка"));
    } finally {
      setAnalyzing(false);
    }
  }, [competitors, myBusiness, savedReports, saveReports]);

  const copyText = (id: string, text: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Скопировано");
  };

  const report = reports.find(r => r.id === activeReport);
  const comp = competitors[currentCompIdx];

  // Determine which link fields to show (always show top 3, rest on toggle)
  const primaryLinks = LINK_FIELDS.slice(0, 3);
  const secondaryLinks = LINK_FIELDS.slice(3);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 animate-in fade-in duration-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-2.5">
            <Radar className="w-5 h-5 text-[#d4a373] shrink-0" />
            Competitor Creative Spy
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1 hidden sm:block">
            Добавьте ссылки на сайт, Instagram, Telegram конкурента - AI проведёт разведку
          </p>
        </div>
        <AddToProjectButton itemType="competitor" itemId="spy" itemTitle="Competitor Spy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
        {/* Left */}
        <div className="lg:col-span-2 space-y-4">
          {/* My business */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#d4a373]" />
              Мой бизнес
            </h3>
            <textarea
              value={myBusiness}
              onChange={(e) => setMyBusiness(e.target.value)}
              placeholder="Кратко: что делаете, для кого, в чём сила. Это поможет AI создать более точные контратаки."
              rows={2}
              className="w-full px-3 py-2 text-[12px] bg-input-background border border-border rounded-lg text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
            />
          </div>

          {/* Competitor tabs */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-red-500" />
                Конкуренты
              </h3>
              <button onClick={addCompetitor} className="text-[11px] text-[#d4a373] hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" />Добавить ещё
              </button>
            </div>

            {/* Competitor pills */}
            {competitors.length > 1 && (
              <div className="flex gap-1.5 flex-wrap">
                {competitors.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentCompIdx(i)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all ${
                      currentCompIdx === i
                        ? "border-[#d4a373]/40 bg-[#d4a373]/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <Building2 className="w-3 h-3" />
                    {c.name || "Конкурент " + (i + 1)}
                    {competitors.length > 1 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); removeCompetitor(i); }}
                        className="ml-1 hover:text-red-500 cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Active competitor form */}
            {comp && (
              <div className="space-y-3 pt-1">
                {/* Name */}
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Название компании</label>
                  <input
                    type="text"
                    value={comp.name}
                    onChange={(e) => updateName(currentCompIdx, e.target.value)}
                    placeholder="Например: Тинькофф, Wildberries, SkyEng..."
                    className="w-full px-3 py-2 text-[13px] bg-input-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
                  />
                </div>

                {/* Links */}
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-2 block flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    Ссылки на площадки конкурента
                  </label>
                  <div className="space-y-2">
                    {primaryLinks.map(({ key, label, placeholder, icon: Icon, color }) => (
                      <div key={key} className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${color} shrink-0`} />
                        <input
                          type="text"
                          value={comp.links[key]}
                          onChange={(e) => updateLink(currentCompIdx, key, e.target.value)}
                          placeholder={placeholder}
                          className="flex-1 px-2.5 py-1.5 text-[12px] bg-input-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
                        />
                      </div>
                    ))}

                    {showAllLinks && secondaryLinks.map(({ key, label, placeholder, icon: Icon, color }) => (
                      <div key={key} className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${color} shrink-0`} />
                        <input
                          type="text"
                          value={comp.links[key]}
                          onChange={(e) => updateLink(currentCompIdx, key, e.target.value)}
                          placeholder={placeholder}
                          className="flex-1 px-2.5 py-1.5 text-[12px] bg-input-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
                        />
                      </div>
                    ))}

                    <button
                      onClick={() => setShowAllLinks(!showAllLinks)}
                      className="text-[10px] text-[#d4a373] hover:underline flex items-center gap-1"
                    >
                      {showAllLinks ? (
                        <><ChevronDown className="w-3 h-3" />Свернуть</>
                      ) : (
                        <><ChevronRight className="w-3 h-3" />YouTube, Facebook, TikTok, другое...</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
                    Заметки (необязательно)
                  </label>
                  <textarea
                    value={comp.notes}
                    onChange={(e) => updateNotes(currentCompIdx, e.target.value)}
                    placeholder="Вставьте примеры постов конкурента, слоганы, заголовки рекламы, или опишите что знаете об их стратегии..."
                    rows={3}
                    className="w-full px-2.5 py-1.5 text-[11px] bg-input-background border border-border rounded-lg text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 placeholder:text-muted-foreground"
                  />
                </div>

                {/* Filled status */}
                {(() => {
                  const filledLinks = Object.values(comp.links).filter(v => v.trim()).length;
                  return filledLinks > 0 ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-500">
                      <CheckCircle2 className="w-3 h-3" />
                      {filledLinks} {filledLinks === 1 ? "ссылка" : filledLinks <= 4 ? "ссылки" : "ссылок"} добавлено
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={analyzing || competitors.every(c => !isCompValid(c))}
            className="w-full py-3.5 bg-[#d4a373] hover:bg-[#c0854a] text-white rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-[#d4a373]/20"
          >
            {analyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Анализируем конкурентов...</>
            ) : (
              <><Radar className="w-4 h-4" />Запустить разведку ({competitors.filter(isCompValid).length})</>
            )}
          </button>

          {/* Saved reports */}
          {savedReports.length > 0 && reports.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-[13px] font-semibold text-foreground">Прошлые отчёты</h3>
              {savedReports.slice(0, 5).map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setReports([r]); setActiveReport(r.id); }}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left"
                >
                  <Radar className="w-3.5 h-3.5 text-[#d4a373] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate">
                      {r.competitor.name || "Конкурент"}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      Угроза {r.overallThreat}/100 - {new Date(r.createdAt).toLocaleDateString("ru")}
                    </p>
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right */}
        <div className="lg:col-span-3 space-y-4">
          {reports.length === 0 && !analyzing ? (
            <EmptyState
              title="Разведданные появятся здесь"
              description="Добавьте ссылки на сайт, Instagram или Telegram конкурента - система проанализирует их контент-стратегию и предложит контратаки"
              emotion="think"
              compact
            />
          ) : analyzing ? (
            <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-[#d4a373] animate-spin mb-3" />
              <p className="text-[15px] font-medium text-foreground">Анализируем конкурентов...</p>
              <p className="text-[12px] text-muted-foreground mt-1">Изучаем хуки, тональность, слабости</p>
            </div>
          ) : (
            <>
              {/* Report tabs */}
              {reports.length > 1 && (
                <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
                  {reports.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setActiveReport(r.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
                        activeReport === r.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <Crosshair className="w-3 h-3" />
                      {r.competitor.name || "Конкурент"}
                    </button>
                  ))}
                </div>
              )}

              {report && (
                <>
                  {/* Competitor header */}
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <Crosshair className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[16px] font-bold text-foreground">
                          {report.competitor.name || "Конкурент"}
                        </h3>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Object.entries(report.competitor.links).map(([k, v]) => {
                            if (!v) return null;
                            const field = LINK_FIELDS.find(f => f.key === k);
                            return (
                              <span key={k} className="text-[9px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                {field?.label || k}: {v.length > 30 ? v.slice(0, 30) + "..." : v}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Threat & Opportunity */}
                  <div className="grid grid-cols-2 gap-3">
                    <ScoreCard
                      icon={AlertTriangle}
                      iconColor="text-red-500"
                      label="Уровень угрозы"
                      score={report.overallThreat}
                      getColor={(s) => s >= 70 ? "text-red-500" : s >= 40 ? "text-amber-500" : "text-emerald-500"}
                      getBg={(s) => s >= 70 ? "bg-red-500" : s >= 40 ? "bg-amber-500" : "bg-emerald-500"}
                    />
                    <ScoreCard
                      icon={Target}
                      iconColor="text-emerald-500"
                      label="Возможности"
                      score={report.opportunityScore}
                      getColor={(s) => s >= 70 ? "text-emerald-500" : s >= 40 ? "text-amber-500" : "text-red-500"}
                      getBg={(s) => s >= 70 ? "bg-emerald-500" : s >= 40 ? "bg-amber-500" : "bg-red-500"}
                    />
                  </div>

                  {/* Analysis sections */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
                    {report.analysis.hooks.length > 0 && (
                      <SectionToggle
                        id="hooks" title={"Хуки конкурента (" + report.analysis.hooks.length + ")"} icon={Eye}
                        expanded={expandedSection} onToggle={setExpandedSection}
                      >
                        <div className="space-y-1.5">
                          {report.analysis.hooks.map((h, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30">
                              <span className="text-[10px] text-muted-foreground font-mono mt-0.5">#{i + 1}</span>
                              <span className="text-[12px] text-foreground italic">"{h}"</span>
                            </div>
                          ))}
                        </div>
                      </SectionToggle>
                    )}

                    {report.analysis.toneDescription && (
                      <SectionToggle
                        id="tone" title="Тональность" icon={MessageSquare}
                        expanded={expandedSection} onToggle={setExpandedSection}
                      >
                        <p className="text-[12px] text-foreground leading-relaxed">{report.analysis.toneDescription}</p>
                        {report.analysis.postingFrequency && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">Частота: {report.analysis.postingFrequency}</span>
                          </div>
                        )}
                        {report.analysis.topFormats.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {report.analysis.topFormats.map((f, i) => (
                              <span key={i} className="text-[10px] bg-teal-600/10 text-teal-600 px-2 py-0.5 rounded-full">{f}</span>
                            ))}
                          </div>
                        )}
                      </SectionToggle>
                    )}

                    {report.analysis.strengths.length > 0 && (
                      <SectionToggle
                        id="strengths" title={"Сильные стороны (" + report.analysis.strengths.length + ")"} icon={TrendingUp}
                        expanded={expandedSection} onToggle={setExpandedSection}
                      >
                        <div className="space-y-1.5">
                          {report.analysis.strengths.map((s, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                              <span className="text-[12px] text-foreground">{s}</span>
                            </div>
                          ))}
                        </div>
                      </SectionToggle>
                    )}

                    {report.analysis.weaknesses.length > 0 && (
                      <SectionToggle
                        id="weaknesses" title={"Слабые стороны (" + report.analysis.weaknesses.length + ")"} icon={TrendingDown}
                        expanded={expandedSection} onToggle={setExpandedSection}
                      >
                        <div className="space-y-1.5">
                          {report.analysis.weaknesses.map((w, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                              <span className="text-[12px] text-foreground">{w}</span>
                            </div>
                          ))}
                        </div>
                      </SectionToggle>
                    )}

                    {report.analysis.uniqueAngles.length > 0 && (
                      <SectionToggle
                        id="angles" title="Уникальные подходы" icon={Lightbulb}
                        expanded={expandedSection} onToggle={setExpandedSection}
                      >
                        <div className="space-y-1.5">
                          {report.analysis.uniqueAngles.map((a, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <Lightbulb className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                              <span className="text-[12px] text-foreground">{a}</span>
                            </div>
                          ))}
                        </div>
                      </SectionToggle>
                    )}
                  </div>

                  {/* Counter-content */}
                  {report.counterContent.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                        <Swords className="w-4 h-4 text-[#d4a373]" />
                        Контратаки ({report.counterContent.length})
                      </h3>
                      {report.counterContent.map((cc, i) => (
                        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{cc.platform}</span>
                              <span className="text-[10px] bg-[#d4a373]/10 text-[#d4a373] px-2 py-0.5 rounded-full">{cc.type}</span>
                            </div>
                            <button
                              onClick={() => copyText("counter-" + i, cc.headline + "\n\n" + cc.description)}
                              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              {copiedId === "counter-" + i ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          <h4 className="text-[13px] font-semibold text-foreground">{cc.headline}</h4>
                          <p className="text-[12px] text-muted-foreground leading-relaxed">{cc.description}</p>
                          {cc.targetWeakness && (
                            <div className="flex items-center gap-1.5 pt-1">
                              <Crosshair className="w-3 h-3 text-red-400" />
                              <span className="text-[10px] text-red-400">Бьёт по: {cc.targetWeakness}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No data fallback */}
                  {report.analysis.hooks.length === 0 &&
                   report.analysis.strengths.length === 0 &&
                   report.counterContent.length === 0 && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-[13px] font-semibold text-foreground">Мало данных для анализа</span>
                      </div>
                      <p className="text-[12px] text-muted-foreground">
                        Попробуйте добавить больше ссылок или вставить примеры постов конкурента в поле "Заметки".
                        Чем больше контекста - тем точнее анализ.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========== HELPERS ========== */

function ScoreCard({ icon: Icon, iconColor, label, score, getColor, getBg }: {
  icon: any; iconColor: string; label: string; score: number;
  getColor: (s: number) => string; getBg: (s: number) => string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={"w-4 h-4 " + iconColor} />
        <span className="text-[12px] font-semibold text-foreground">{label}</span>
      </div>
      <span className={"text-[28px] font-bold " + getColor(score)}>{score}</span>
      <span className="text-[11px] text-muted-foreground">/100</span>
      <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
        <div className={"h-full rounded-full " + getBg(score)} style={{ width: score + "%" }} />
      </div>
    </div>
  );
}

function SectionToggle({ id, title, icon: Icon, expanded, onToggle, children }: {
  id: string; title: string; icon: any; expanded: string; onToggle: (id: string) => void; children: ReactNode;
}) {
  const isOpen = expanded === id;
  return (
    <div>
      <button
        onClick={() => onToggle(isOpen ? "" : id)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-[#d4a373]" />
          <span className="text-[12px] font-semibold text-foreground">{title}</span>
        </div>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {isOpen && <div className="px-4 pb-3">{children}</div>}
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