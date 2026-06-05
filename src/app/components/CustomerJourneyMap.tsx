import { useState, useCallback } from "react";
import {
  MapPin, Plus, Edit3, Trash2, X, Check, Loader2, Sparkles,
  ArrowRight, Smile, Meh, Frown, Heart, MessageCircle, Eye,
  ShoppingCart, Users, Star, ThumbsUp, Zap, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useKV } from "../lib/useKV";
import { aiGenerate } from "../lib/api";
import { AddToProjectButton } from "./AddToProjectModal";
import { ModalOverlay } from "./ModalOverlay";
import { useModal } from "../hooks/useModal";
import { EmptyState } from "./EmptyState";

interface Touchpoint {
  id: string;
  name: string;
  channel: string;
  emotion: "positive" | "neutral" | "negative";
  painPoints: string[];
  opportunities: string[];
  metrics: string;
}

interface JourneyStage {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  touchpoints: Touchpoint[];
}

interface JourneyMap {
  id: string;
  name: string;
  persona: string;
  stages: JourneyStage[];
  createdAt: string;
}

const STORAGE_KEY = "cjm:maps";

const DEFAULT_STAGES: JourneyStage[] = [
  { id: "awareness", name: "Осведомлённость", description: "Клиент узнаёт о бренде", emoji: "👀", color: "#d4a373", touchpoints: [] },
  { id: "consideration", name: "Рассмотрение", description: "Сравнивает варианты", emoji: "🤔", color: "#c0854a", touchpoints: [] },
  { id: "decision", name: "Решение", description: "Готов к покупке", emoji: "💡", color: "#a87040", touchpoints: [] },
  { id: "purchase", name: "Покупка", description: "Совершает транзакцию", emoji: "🛒", color: "#22c55e", touchpoints: [] },
  { id: "retention", name: "Удержание", description: "Повторные покупки", emoji: "❤️", color: "#0d7377", touchpoints: [] },
  { id: "advocacy", name: "Адвокатство", description: "Рекомендует другим", emoji: "⭐", color: "#d4a373", touchpoints: [] },
];

const EMOTION_ICONS = { positive: Smile, neutral: Meh, negative: Frown };
const EMOTION_COLORS = { positive: "text-emerald-500", neutral: "text-amber-500", negative: "text-red-500" };
const CHANNELS = ["Сайт", "Instagram", "Telegram", "Email", "Реклама", "YouTube", "TikTok", "VK", "Офлайн", "Саппорт", "Телефон", "SMS"];

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function CustomerJourneyMap() {
  const { data: maps, save: saveMaps } = useKV<JourneyMap[]>(STORAGE_KEY, []);
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [editingTP, setEditingTP] = useState<{ stageId: string; tp: Touchpoint } | null>(null);
  const [addingToStage, setAddingToStage] = useState<string | null>(null);

  const currentMap = maps.find((m) => m.id === selectedMap);

  const saveMap = useCallback(
    (updated: JourneyMap) => {
      saveMaps(maps.map((m) => (m.id === updated.id ? updated : m)));
    },
    [maps, saveMaps]
  );

  const createMap = (name: string, persona: string) => {
    const newMap: JourneyMap = {
      id: genId(), name, persona,
      stages: DEFAULT_STAGES.map((s) => ({ ...s, id: genId(), touchpoints: [] })),
      createdAt: new Date().toISOString(),
    };
    saveMaps([newMap, ...maps]);
    setSelectedMap(newMap.id);
    setShowCreate(false);
    toast.success("Карта создана");
  };

  const deleteMap = (id: string) => {
    saveMaps(maps.filter((m) => m.id !== id));
    if (selectedMap === id) setSelectedMap(null);
    toast.success("Карта удалена");
  };

  const addTouchpoint = (stageId: string, tp: Touchpoint) => {
    if (!currentMap) return;
    saveMap({
      ...currentMap,
      stages: currentMap.stages.map((s) =>
        s.id === stageId ? { ...s, touchpoints: [...s.touchpoints, tp] } : s
      ),
    });
    setAddingToStage(null);
    toast.success("Точка контакта добавлена");
  };

  const updateTouchpoint = (stageId: string, tp: Touchpoint) => {
    if (!currentMap) return;
    saveMap({
      ...currentMap,
      stages: currentMap.stages.map((s) =>
        s.id === stageId ? { ...s, touchpoints: s.touchpoints.map((t) => (t.id === tp.id ? tp : t)) } : s
      ),
    });
    setEditingTP(null);
  };

  const deleteTouchpoint = (stageId: string, tpId: string) => {
    if (!currentMap) return;
    saveMap({
      ...currentMap,
      stages: currentMap.stages.map((s) =>
        s.id === stageId ? { ...s, touchpoints: s.touchpoints.filter((t) => t.id !== tpId) } : s
      ),
    });
  };

  const handleAIGenerate = async () => {
    if (!currentMap) return;
    setAiLoading(true);
    try {
      const result = await aiGenerate("cjm_generate",
        `Сгенерируй Customer Journey Map для:
Название: ${currentMap.name}
Персона: ${currentMap.persona}

Для каждого из 6 этапов (Осведомлённость, Рассмотрение, Решение, Покупка, Удержание, Адвокатство)
создай 2-3 точки контакта в JSON:

{"stages": [{"stageName":"Осведомлённость", "touchpoints": [{"name":"...", "channel":"Instagram", "emotion":"positive|neutral|negative", "painPoints":["..."], "opportunities":["..."], "metrics":"CTR 2.5%"}]}]}

Только JSON, без markdown-обёртки.`
      );
      if (result?.content) {
        const match = result.content.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const stageNames = ["Осведомлённость", "Рассмотрение", "Решение", "Покупка", "Удержание", "Адвокатство"];
          const updatedStages = currentMap.stages.map((stage, idx) => {
            const aiStage = parsed.stages?.find((s: any) => 
              s.stageName === stageNames[idx] || s.stageName?.toLowerCase().includes(stage.name.toLowerCase())
            );
            if (aiStage?.touchpoints) {
              const newTPs: Touchpoint[] = aiStage.touchpoints.map((tp: any) => ({
                id: genId(), name: tp.name, channel: tp.channel || "Сайт",
                emotion: tp.emotion || "neutral",
                painPoints: tp.painPoints || [], opportunities: tp.opportunities || [],
                metrics: tp.metrics || "",
              }));
              return { ...stage, touchpoints: [...stage.touchpoints, ...newTPs] };
            }
            return stage;
          });
          saveMap({ ...currentMap, stages: updatedStages });
          toast.success("CJM заполнена AI-данными");
        }
      }
    } catch (err: any) {
      toast.error(err?.name === "UsageLimitError" ? "Лимит исчерпан" : "Ошибка AI", { description: err.message });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-[1440px] mx-auto space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#c0854a] flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            Customer Journey Map
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1 hidden sm:block">
            Визуальная карта пути клиента с точками контакта
          </p>
        </div>
        <div className="flex items-center gap-2">
          {currentMap && (
            <button
              onClick={handleAIGenerate}
              disabled={aiLoading}
              className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg text-[12px] font-medium hover:bg-muted/80 disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI заполнить
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-white"
            style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
          >
            <Plus className="w-3.5 h-3.5" /> Новая карта
          </button>
        </div>
      </div>

      {/* Map selector */}
      {maps.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {maps.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMap(m.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] border transition-colors group ${
                selectedMap === m.id
                  ? "bg-[#d4a373]/10 text-[#d4a373] border-[#d4a373]/30 font-medium"
                  : "bg-card text-muted-foreground border-border hover:border-[#d4a373]/20"
              }`}
            >
              <MapPin className="w-3 h-3" />
              {m.name}
              <span
                onClick={(e) => { e.stopPropagation(); deleteMap(m.id); }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); deleteMap(m.id); } }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/10 text-red-500/50 hover:text-red-500 cursor-pointer"
                aria-label="Удалить карту"
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Journey Map visualization */}
      {currentMap ? (
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-[1200px] pb-4">
            {currentMap.stages.map((stage, idx) => (
              <div key={stage.id} className="flex-1 min-w-[190px] flex flex-col">
                {/* Stage header */}
                <div
                  className="rounded-t-xl p-3 text-center border border-b-0"
                  style={{ borderColor: `${stage.color}30`, background: `${stage.color}08` }}
                >
                  <span className="text-[20px]">{stage.emoji}</span>
                  <h3 className="text-[13px] font-semibold text-foreground mt-1">{stage.name}</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stage.description}</p>
                </div>

                {/* Arrow connector */}
                {idx < currentMap.stages.length - 1 && (
                  <div className="hidden" /> // arrows handled by CSS
                )}

                {/* Touchpoints */}
                <div
                  className="flex-1 rounded-b-xl p-2 space-y-2 border border-t-0 min-h-[200px]"
                  style={{ borderColor: `${stage.color}20` }}
                >
                  {stage.touchpoints.map((tp) => {
                    const EmotionIcon = EMOTION_ICONS[tp.emotion];
                    return (
                      <div
                        key={tp.id}
                        className="bg-card border border-border rounded-lg p-2.5 space-y-1.5 group hover:border-[#d4a373]/30 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-1.5">
                            <EmotionIcon className={`w-3.5 h-3.5 ${EMOTION_COLORS[tp.emotion]}`} />
                            <span className="text-[11px] font-medium text-foreground">{tp.name}</span>
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingTP({ stageId: stage.id, tp: { ...tp } })}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={() => deleteTouchpoint(stage.id, tp.id)}
                              className="p-0.5 rounded hover:bg-red-500/10 text-red-500"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[9px]">{tp.channel}</span>
                        {tp.painPoints.length > 0 && (
                          <div className="space-y-0.5">
                            {tp.painPoints.map((p, i) => (
                              <div key={i} className="flex items-start gap-1 text-[9px] text-red-500/70">
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0 mt-0.5" />
                                <span>{p}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {tp.opportunities.length > 0 && (
                          <div className="space-y-0.5">
                            {tp.opportunities.map((o, i) => (
                              <div key={i} className="flex items-start gap-1 text-[9px] text-emerald-600/70">
                                <Zap className="w-2.5 h-2.5 shrink-0 mt-0.5" />
                                <span>{o}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {tp.metrics && (
                          <p className="text-[9px] text-muted-foreground">{tp.metrics}</p>
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={() => setAddingToStage(stage.id)}
                    className="w-full flex items-center justify-center gap-1 py-2 rounded-md border border-dashed border-border text-[10px] text-muted-foreground hover:text-foreground hover:border-[#d4a373]/30 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Добавить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Создайте первую CJM"
          description="Customer Journey Map поможет визуализировать путь клиента и найти точки роста"
          emotion="idle"
          action={{ label: "Создать карту", onClick: () => setShowCreate(true), icon: <Plus className="w-4 h-4" /> }}
        />
      )}

      {/* Create map modal */}
      {showCreate && (
        <ModalOverlay onClose={() => setShowCreate(false)}>
          <CreateMapModal onCreate={createMap} onClose={() => setShowCreate(false)} />
        </ModalOverlay>
      )}

      {/* Add/Edit touchpoint modal */}
      {(addingToStage || editingTP) && (
        <ModalOverlay onClose={() => { setAddingToStage(null); setEditingTP(null); }}>
          <TouchpointModal
            existing={editingTP?.tp}
            onSave={(tp) => {
              if (editingTP) {
                updateTouchpoint(editingTP.stageId, tp);
              } else if (addingToStage) {
                addTouchpoint(addingToStage, tp);
              }
            }}
            onClose={() => { setAddingToStage(null); setEditingTP(null); }}
          />
        </ModalOverlay>
      )}
    </div>
  );
}

function CreateMapModal({ onCreate, onClose }: { onCreate: (name: string, persona: string) => void; onClose: () => void }) {
  const modalRef = useModal(onClose);
  const [name, setName] = useState("");
  const [persona, setPersona] = useState("");

  return (
    <div
      ref={modalRef}
      className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-map-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 id="create-map-title" className="text-[14px] font-semibold text-foreground">Новая CJM</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Закрыть"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 space-y-3">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название карты..." className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px]" autoFocus />
        <textarea value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Описание персоны/ЦА..." rows={3} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[12px] resize-none" />
      </div>
      <div className="flex justify-end gap-2 p-4 border-t border-border">
        <button onClick={onClose} className="px-3 py-2 text-[12px] text-muted-foreground">Отмена</button>
        <button
          onClick={() => { if (name.trim()) onCreate(name.trim(), persona.trim()); }}
          disabled={!name.trim()}
          className="px-4 py-2 rounded-lg text-[12px] font-medium text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
        >
          Создать
        </button>
      </div>
    </div>
  );
}

function TouchpointModal({ existing, onSave, onClose }: { existing?: Touchpoint; onSave: (tp: Touchpoint) => void; onClose: () => void }) {
  const modalRef = useModal(onClose);
  const [form, setForm] = useState<Touchpoint>(existing || {
    id: genId(), name: "", channel: "Сайт", emotion: "neutral",
    painPoints: [], opportunities: [], metrics: "",
  });
  const [newPain, setNewPain] = useState("");
  const [newOpp, setNewOpp] = useState("");

  return (
    <div
      ref={modalRef}
      className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl max-h-[85vh] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="touchpoint-modal-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 id="touchpoint-modal-title" className="text-[14px] font-semibold text-foreground">{existing ? "Редактировать" : "Новая"} точка контакта</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Закрыть"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 space-y-3">
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Название..." className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px]" autoFocus />
        <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[13px]">
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Эмоция клиента</label>
          <div className="flex gap-2">
            {(["positive", "neutral", "negative"] as const).map((e) => {
              const Icon = EMOTION_ICONS[e];
              return (
                <button
                  key={e}
                  onClick={() => setForm({ ...form, emotion: e })}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] border transition-colors ${
                    form.emotion === e ? `${EMOTION_COLORS[e]} border-current` : "text-muted-foreground border-border"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {e === "positive" ? "Позитивная" : e === "neutral" ? "Нейтральная" : "Негативная"}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Боли клиента</label>
          {form.painPoints.map((p, i) => (
            <div key={i} className="flex items-center gap-1 mb-1">
              <span className="flex-1 text-[11px] text-red-500/70">{p}</span>
              <button onClick={() => setForm({ ...form, painPoints: form.painPoints.filter((_, j) => j !== i) })} className="text-red-500"><X className="w-3 h-3" /></button>
            </div>
          ))}
          <input type="text" value={newPain} onChange={(e) => setNewPain(e.target.value)} placeholder="+ добавить боль" className="w-full bg-muted/30 border border-border rounded px-2.5 py-1.5 text-[11px]"
            onKeyDown={(e) => { if (e.key === "Enter" && newPain.trim()) { setForm({ ...form, painPoints: [...form.painPoints, newPain.trim()] }); setNewPain(""); }}}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Возможности</label>
          {form.opportunities.map((o, i) => (
            <div key={i} className="flex items-center gap-1 mb-1">
              <span className="flex-1 text-[11px] text-emerald-600/70">{o}</span>
              <button onClick={() => setForm({ ...form, opportunities: form.opportunities.filter((_, j) => j !== i) })} className="text-red-500"><X className="w-3 h-3" /></button>
            </div>
          ))}
          <input type="text" value={newOpp} onChange={(e) => setNewOpp(e.target.value)} placeholder="+ добавить возможность" className="w-full bg-muted/30 border border-border rounded px-2.5 py-1.5 text-[11px]"
            onKeyDown={(e) => { if (e.key === "Enter" && newOpp.trim()) { setForm({ ...form, opportunities: [...form.opportunities, newOpp.trim()] }); setNewOpp(""); }}}
          />
        </div>
        <input type="text" value={form.metrics} onChange={(e) => setForm({ ...form, metrics: e.target.value })} placeholder="Метрики (CTR, конверсия...)" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2.5 text-foreground text-[12px]" />
      </div>
      <div className="flex justify-end gap-2 p-4 border-t border-border">
        <button onClick={onClose} className="px-3 py-2 text-[12px] text-muted-foreground">Отмена</button>
        <button
          onClick={() => { if (form.name.trim()) onSave(form); }}
          disabled={!form.name.trim()}
          className="px-4 py-2 rounded-lg text-[12px] font-medium text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
        >
          {existing ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </div>
  );
}