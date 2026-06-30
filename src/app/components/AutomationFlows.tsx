import { useState, useCallback, useMemo } from "react";
import {
  Workflow, Plus, Play, Pause, Trash2, X, Check, Edit3, Copy,
  Zap, Clock, FileText, FlaskConical, CalendarRange, MessageCircle,
  Mail, Globe, Target, Bell, ArrowRight, ArrowDown, ChevronDown,
  ChevronRight, Loader2, Save, GitBranch, Sparkles, AlertTriangle,
  CheckCircle2, Settings, Layers, MousePointerClick, MoreHorizontal,
  Eye, GripVertical, Plug, XCircle, History,
} from "lucide-react";
import { toast } from "sonner";
import { useKV } from "../lib/useKV";
import { executeAutomation, getAutomationLog, type AutomationExecutionResult } from "../lib/api";
import { MascotMessage } from "./Mascot";
import { showMascotReaction, checkMilestone } from "../lib/mascot-reactions";
import { triggerMilestoneCheck } from "./MascotGames";
import { useUsage } from "../lib/useUsage";
import { checkServerUsage } from "../lib/api";
import { ModalOverlay } from "./ModalOverlay";
import { useModal } from "../hooks/useModal";
import { EmptyState } from "./EmptyState";

/* ========== TYPES ========== */
type NodeType = "trigger" | "action" | "condition";

interface FlowNode {
  id: string;
  type: NodeType;
  subtype: string;
  label: string;
  config: Record<string, any>;
  x: number;
  y: number;
}

interface FlowConnection {
  from: string;
  to: string;
  label?: string;
}

interface AutomationFlow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  connections: FlowConnection[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  runsCount: number;
  lastRun?: string;
}

/* ========== NODE REGISTRY ========== */
interface NodeDef {
  subtype: string;
  label: string;
  icon: any;
  color: string;
  bg: string;
  type: NodeType;
  category: string;
  configFields: { key: string; label: string; type: "text" | "select" | "number"; options?: string[] }[];
}

const NODE_REGISTRY: NodeDef[] = [
  { subtype: "content_published", label: "Контент опубликован", icon: FileText, color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/40", type: "trigger", category: "События", configFields: [{ key: "platform", label: "Платформа", type: "select", options: ["Любая", "Instagram", "Telegram", "VK", "YouTube", "Email"] }] },
  { subtype: "ab_test_complete", label: "A/B тест завершён", icon: FlaskConical, color: "text-teal-600", bg: "bg-teal-600/10 border-teal-600/40", type: "trigger", category: "События", configFields: [{ key: "result", label: "Результат", type: "select", options: ["Любой", "Победитель найден", "Нет разницы"] }] },
  { subtype: "schedule", label: "По расписанию", icon: Clock, color: "text-amber-600", bg: "bg-amber-600/10 border-amber-600/40", type: "trigger", category: "Расписание", configFields: [{ key: "cron", label: "Расписание", type: "select", options: ["Каждый час", "Ежедневно 9:00", "Каждый понедельник", "1-е числа месяца"] }] },
  { subtype: "manual", label: "Ручной запуск", icon: MousePointerClick, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/40", type: "trigger", category: "Расписание", configFields: [] },
  { subtype: "metric_threshold", label: "Метрика превысила порог", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/40", type: "trigger", category: "События", configFields: [{ key: "metric", label: "Метрика", type: "select", options: ["CAC", "ROI", "ER", "CTR", "Бюджет"] }, { key: "threshold", label: "Порог", type: "number" }] },

  { subtype: "send_telegram", label: "Отправить в Telegram", icon: MessageCircle, color: "text-sky-500", bg: "bg-sky-500/10 border-sky-500/40", type: "action", category: "Уведомления", configFields: [{ key: "message", label: "Сообщение", type: "text" }] },
  { subtype: "send_email", label: "Отправить Email", icon: Mail, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/40", type: "action", category: "Уведомления", configFields: [{ key: "to", label: "Кому", type: "text" }, { key: "subject", label: "Тема", type: "text" }] },
  { subtype: "webhook", label: "Webhook (Pipedream)", icon: Globe, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/40", type: "action", category: "Интеграции", configFields: [{ key: "event", label: "Событие", type: "text" }] },
  { subtype: "update_okr", label: "Обновить OKR", icon: Target, color: "text-teal-500", bg: "bg-teal-500/10 border-teal-500/40", type: "action", category: "Данные", configFields: [{ key: "action", label: "Действие", type: "select", options: ["Увеличить прогресс", "Отметить как выполнено", "Добавить комментарий"] }] },
  { subtype: "create_task", label: "Создать задачу в Notion", icon: Layers, color: "text-gray-500", bg: "bg-gray-500/10 border-gray-500/40", type: "action", category: "Интеграции", configFields: [{ key: "title", label: "Заголовок", type: "text" }] },
  { subtype: "notify", label: "Системное уведомление", icon: Bell, color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/40", type: "action", category: "Уведомления", configFields: [{ key: "text", label: "Текст", type: "text" }] },

  { subtype: "if_metric", label: "Если метрика", icon: GitBranch, color: "text-teal-600", bg: "bg-teal-600/10 border-teal-600/40", type: "condition", category: "Логика", configFields: [{ key: "metric", label: "Метрика", type: "select", options: ["ER", "CTR", "ROI", "CAC", "Охват"] }, { key: "operator", label: "Условие", type: "select", options: [">", "<", ">=", "<=", "=="] }, { key: "value", label: "Значение", type: "number" }] },
  { subtype: "if_platform", label: "Если платформа", icon: GitBranch, color: "text-teal-600", bg: "bg-teal-600/10 border-teal-600/40", type: "condition", category: "Логика", configFields: [{ key: "platform", label: "Платформа", type: "select", options: ["Instagram", "Telegram", "VK", "YouTube", "Email"] }] },
];

const FLOW_TEMPLATES: Omit<AutomationFlow, "id" | "createdAt" | "updatedAt" | "runsCount">[] = [
  {
    name: "Еженедельный дайджест",
    description: "Каждый понедельник отправляет сводку метрик в Telegram и Email",
    active: false,
    nodes: [
      { id: "t1", type: "trigger", subtype: "schedule", label: "Каждый понедельник", config: { cron: "Каждый понедельник" }, x: 50, y: 50 },
      { id: "a1", type: "action", subtype: "send_telegram", label: "Telegram дайджест", config: { message: "Еженедельная сводка MarketPlan" }, x: 50, y: 170 },
      { id: "a2", type: "action", subtype: "send_email", label: "Email дайджест", config: { to: "team@company.com", subject: "Недельная сводка" }, x: 50, y: 290 },
    ],
    connections: [{ from: "t1", to: "a1" }, { from: "a1", to: "a2" }],
  },
  {
    name: "Алерт при высоком CAC",
    description: "Уведомляет, когда CAC превышает порог, и обновляет OKR",
    active: false,
    nodes: [
      { id: "t1", type: "trigger", subtype: "metric_threshold", label: "CAC > 2000", config: { metric: "CAC", threshold: 2000 }, x: 50, y: 50 },
      { id: "c1", type: "condition", subtype: "if_metric", label: "Если ROI < 100%", config: { metric: "ROI", operator: "<", value: 100 }, x: 50, y: 170 },
      { id: "a1", type: "action", subtype: "send_telegram", label: "Алерт в Telegram", config: { message: "CAC превысил 2000 RUB, ROI ниже 100%" }, x: 50, y: 290 },
      { id: "a2", type: "action", subtype: "update_okr", label: "Пометить OKR", config: { action: "Добавить комментарий" }, x: 50, y: 410 },
    ],
    connections: [{ from: "t1", to: "c1" }, { from: "c1", to: "a1", label: "Да" }, { from: "a1", to: "a2" }],
  },
  {
    name: "Контент -> Telegram + Webhook",
    description: "При публикации конента отправляет уведомление и триггерит Pipedream",
    active: false,
    nodes: [
      { id: "t1", type: "trigger", subtype: "content_published", label: "Контент опубликован", config: { platform: "Любая" }, x: 50, y: 50 },
      { id: "a1", type: "action", subtype: "send_telegram", label: "Уведомить команду", config: { message: "Новый пост опубликован!" }, x: 50, y: 170 },
      { id: "a2", type: "action", subtype: "webhook", label: "Pipedream триггер", config: { event: "content_published" }, x: 50, y: 290 },
    ],
    connections: [{ from: "t1", to: "a1" }, { from: "a1", to: "a2" }],
  },
  {
    name: "Результат A/B теста",
    description: "По завершении A/B теста уведомляет команду и создаёт задачу в Notion",
    active: false,
    nodes: [
      { id: "t1", type: "trigger", subtype: "ab_test_complete", label: "A/B тест завершён", config: { result: "Любой" }, x: 50, y: 50 },
      { id: "a1", type: "action", subtype: "notify", label: "Уведомление", config: { text: "A/B тест завершён, проверьте результаты" }, x: 50, y: 170 },
      { id: "a2", type: "action", subtype: "create_task", label: "Задача в Notion", config: { title: "Внедрить результат A/B теста" }, x: 50, y: 290 },
    ],
    connections: [{ from: "t1", to: "a1" }, { from: "a1", to: "a2" }],
  },
];

const STORAGE_KEY = "automation:flows";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ========== COMPONENT ========== */
export function AutomationFlows() {
  const { canUse, increment, decrement } = useUsage();
  const { data: flows, save } = useKV<AutomationFlow[]>(STORAGE_KEY, []);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [addAfterNode, setAddAfterNode] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [nameEdit, setNameEdit] = useState<{ id: string; name: string } | null>(null);
  // Execution state
  const [executing, setExecuting] = useState(false);
  const [lastExecResult, setLastExecResult] = useState<AutomationExecutionResult | null>(null);
  const [showExecLog, setShowExecLog] = useState(false);
  const [execLogs, setExecLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const activeFlow = flows.find((f) => f.id === selectedFlow);

  const createFlow = useCallback(async (template?: typeof FLOW_TEMPLATES[number]) => {
    if (!canUse("automations")) {
      toast.error("Лимит автоматизаций исчерпан. Обновите план.");
      return;
    }
    try {
      const sc = await checkServerUsage("automations");
      if (sc && !sc.allowed) { toast.error(sc.message || "Лимит автоматизаций исчерпан."); return; }
    } catch (e) { console.warn("[AutomationFlows] Server check failed:", e); }
    const newFlow: AutomationFlow = {
      id: genId(),
      name: template?.name || "Новая автоматизация",
      description: template?.description || "",
      nodes: template?.nodes || [],
      connections: template?.connections || [],
      active: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runsCount: 0,
    };
    save([...flows, newFlow]);
    setSelectedFlow(newFlow.id);
    setShowTemplates(false);
    increment("automations");
    toast.success(`Создана: ${newFlow.name}`);
    showMascotReaction("save", `Автоматизация «${newFlow.name}» создана!`);
    const m = checkMilestone("automations_1", flows.length + 1);
    if (m) triggerMilestoneCheck();
  }, [flows, save, canUse, increment]);

  const deleteFlow = useCallback((id: string) => {
    save(flows.filter((f) => f.id !== id));
    if (selectedFlow === id) setSelectedFlow(null);
    decrement("automations");
    toast.success("Автоматизация удалена");
    showMascotReaction("delete");
  }, [flows, save, selectedFlow, decrement]);

  const toggleActive = useCallback((id: string) => {
    const updated = flows.map((f) => f.id === id ? { ...f, active: !f.active, updatedAt: new Date().toISOString() } : f);
    save(updated);
    const flow = updated.find((f) => f.id === id);
    toast.success(flow?.active ? `"${flow.name}" активирована` : `"${flow?.name}" приостановлена`);
  }, [flows, save]);

  const duplicateFlow = useCallback((id: string) => {
    const source = flows.find((f) => f.id === id);
    if (!source) return;
    const newFlow: AutomationFlow = {
      ...source, id: genId(), name: `${source.name} (копия)`, active: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), runsCount: 0,
    };
    save([...flows, newFlow]);
    toast.success("Копия создана");
  }, [flows, save]);

  const addNode = useCallback((def: NodeDef, afterNodeId?: string) => {
    if (!activeFlow) return;
    const lastNode = activeFlow.nodes[activeFlow.nodes.length - 1];
    const newNode: FlowNode = {
      id: genId(), type: def.type, subtype: def.subtype, label: def.label,
      config: {}, x: 50, y: lastNode ? lastNode.y + 120 : 50,
    };
    const updatedNodes = [...activeFlow.nodes, newNode];
    const updatedConns = [...activeFlow.connections];
    if (afterNodeId) updatedConns.push({ from: afterNodeId, to: newNode.id });
    else if (lastNode) updatedConns.push({ from: lastNode.id, to: newNode.id });

    save(flows.map((f) => f.id === activeFlow.id
      ? { ...f, nodes: updatedNodes, connections: updatedConns, updatedAt: new Date().toISOString() }
      : f
    ));
    setShowNodePicker(false);
    setAddAfterNode(null);
    toast.success(`Добавлен: ${def.label}`);
  }, [activeFlow, flows, save]);

  const removeNode = useCallback((nodeId: string) => {
    if (!activeFlow) return;
    save(flows.map((f) => f.id !== activeFlow.id ? f : {
      ...f,
      nodes: f.nodes.filter((n) => n.id !== nodeId),
      connections: f.connections.filter((c) => c.from !== nodeId && c.to !== nodeId),
      updatedAt: new Date().toISOString(),
    }));
    if (editingNode === nodeId) setEditingNode(null);
  }, [activeFlow, flows, save, editingNode]);

  const updateNodeConfig = useCallback((nodeId: string, config: Record<string, any>) => {
    if (!activeFlow) return;
    save(flows.map((f) => f.id !== activeFlow.id ? f : {
      ...f,
      nodes: f.nodes.map((n) => n.id === nodeId ? { ...n, config, label: config._label || n.label } : n),
      updatedAt: new Date().toISOString(),
    }));
  }, [activeFlow, flows, save]);

  const saveName = useCallback(() => {
    if (!nameEdit) return;
    save(flows.map((f) => f.id === nameEdit.id ? { ...f, name: nameEdit.name, updatedAt: new Date().toISOString() } : f));
    setNameEdit(null);
  }, [nameEdit, flows, save]);

  // ====== REAL EXECUTION ======
  const runFlow = useCallback(async (id: string) => {
    const flow = flows.find((f) => f.id === id);
    if (!flow || flow.nodes.length === 0) {
      toast.error("Нечего выполнять - добавьте узлы");
      return;
    }

    setExecuting(true);
    setLastExecResult(null);

    try {
      const result = await executeAutomation(flow.id, flow.name, flow.nodes, flow.connections);
      if (!result) throw new Error("Пустой ответ сервера");

      setLastExecResult(result);

      // Update flow stats
      save(flows.map((f) =>
        f.id === id ? { ...f, runsCount: f.runsCount + 1, lastRun: new Date().toISOString(), updatedAt: new Date().toISOString() } : f
      ));

      const { summary } = result;
      if (summary.errors === 0) {
        toast.success(`"${flow.name}" выполнена`, {
          description: `${summary.success} узлов за ${summary.totalDurationMs}ms`,
        });
      } else {
        toast.warning(`"${flow.name}" выполнена с ошибками`, {
          description: `${summary.success} OK, ${summary.errors} ошибок`,
        });
      }
    } catch (err) {
      console.error("Automation run error:", err);
      toast.error(`Ошибка выполнения: ${err}`);
    } finally {
      setExecuting(false);
    }
  }, [flows, save]);

  // Load execution logs
  const loadLogs = useCallback(async (flowId: string) => {
    setLoadingLogs(true);
    try {
      const logs = await getAutomationLog(flowId);
      setExecLogs(logs);
    } catch {
      setExecLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-2.5">
            <Workflow className="w-5 h-5 text-[#d4a373] shrink-0" />
            Автоматизации
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1 hidden sm:block">
            Визуальный конструктор маркетинговых цепочек с реальным выполнением
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowTemplates(true)}
            className="px-2.5 py-2 text-[12px] font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#d4a373]" /><span className="hidden sm:inline">Из шаблона</span>
          </button>
          <button onClick={() => createFlow()}
            className="px-2.5 py-2 text-[12px] font-medium bg-[#d4a373] text-white rounded-lg hover:bg-[#c0854a] transition-colors flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Новая</span>
          </button>
        </div>
      </div>

      {/* Templates modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowTemplates(false)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-foreground">Шаблоны автоматизаций</h3>
              <button onClick={() => setShowTemplates(false)} className="p-1 hover:bg-muted rounded-lg"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-2">
              {FLOW_TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => createFlow(t)}
                  className="w-full text-left p-3 rounded-xl border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-[#d4a373]" />
                    <span className="text-[13px] font-semibold text-foreground">{t.name}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-1">{t.description}</p>
                  <div className="flex gap-1.5 mt-2">
                    {t.nodes.map((n) => {
                      const def = NODE_REGISTRY.find((d) => d.subtype === n.subtype);
                      return def ? <span key={n.id} className={`text-[9px] px-1.5 py-0.5 rounded ${def.bg} ${def.color}`}>{def.label}</span> : null;
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Flow list */}
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Мои автоматизации ({flows.length})</h3>
          {flows.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-4 md:p-6 text-center">
              <MascotMessage
                emotion="work"
                message="Нет автоматизаций"
                subtext="Создайте первую или выберите шаблон - Марк всё выполнит!"
                size={80}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {flows.map((flow) => (
                <div key={flow.id} onClick={() => setSelectedFlow(flow.id)}
                  className={`bg-card border rounded-xl p-3 cursor-pointer transition-all ${selectedFlow === flow.id ? "border-[#d4a373]/50 ring-1 ring-[#d4a373]/20" : "border-border hover:border-border/80"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {nameEdit?.id === flow.id ? (
                        <input value={nameEdit.name} onChange={(e) => setNameEdit({ ...nameEdit, name: e.target.value })}
                          onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && saveName()}
                          className="text-[13px] font-medium text-foreground bg-transparent border-b border-[#d4a373] outline-none w-full"
                          autoFocus onClick={(e) => e.stopPropagation()} />
                      ) : (
                        <span className="text-[13px] font-medium text-foreground truncate"
                          onDoubleClick={(e) => { e.stopPropagation(); setNameEdit({ id: flow.id, name: flow.name }); }}>
                          {flow.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); toggleActive(flow.id); }}
                        className={`p-1 rounded-md transition-colors ${flow.active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}
                        title={flow.active ? "Приостановить" : "Активировать"}>
                        {flow.active ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); duplicateFlow(flow.id); }}
                        className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Дублировать">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteFlow(flow.id); }}
                        className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors" title="Удалить">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className={`flex items-center gap-1 ${flow.active ? "text-emerald-500" : ""}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${flow.active ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
                      {flow.active ? "Активна" : "Пауза"}
                    </span>
                    <span>{flow.nodes.length} улов</span>
                    <span>{flow.runsCount} запусков</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {flow.nodes.slice(0, 5).map((n) => {
                      const def = NODE_REGISTRY.find((d) => d.subtype === n.subtype);
                      if (!def) return null;
                      return <span key={n.id} className={`text-[9px] px-1.5 py-0.5 rounded ${def.bg} ${def.color}`}>{n.label}</span>;
                    })}
                    {flow.nodes.length > 5 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+{flow.nodes.length - 5}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Flow editor */}
        <div className="lg:col-span-2">
          {!activeFlow ? (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <Workflow className="w-14 h-14 text-muted-foreground/20 mb-3" />
              <p className="text-[15px] font-medium text-muted-foreground">Выберите автоматизацию</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">Или создайте новую из шаблона</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Flow header */}
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-foreground">{activeFlow.name}</h3>
                    {activeFlow.description && <p className="text-[12px] text-muted-foreground mt-0.5">{activeFlow.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { loadLogs(activeFlow.id); setShowExecLog(true); }}
                      className="px-3 py-1.5 text-[11px] font-medium bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors flex items-center gap-1"
                    >
                      <History className="w-3 h-3" />Логи
                    </button>
                    <button
                      onClick={() => runFlow(activeFlow.id)}
                      disabled={executing || activeFlow.nodes.length === 0}
                      className="px-3 py-1.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      {executing ? "Выполнение..." : "Запустить"}
                    </button>
                    <button onClick={() => toggleActive(activeFlow.id)}
                      className={`px-3 py-1.5 text-[11px] font-medium rounded-lg flex items-center gap-1 transition-colors ${activeFlow.active ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20" : "bg-[#d4a373]/10 text-[#d4a373] hover:bg-[#d4a373]/20"}`}>
                      {activeFlow.active ? <><Pause className="w-3 h-3" />Пауза</> : <><Zap className="w-3 h-3" />Активировать</>}
                    </button>
                  </div>
                </div>
                {activeFlow.lastRun && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Последний запуск: {new Date(activeFlow.lastRun).toLocaleString("ru-RU")}
                  </p>
                )}
              </div>

              {/* Execution result */}
              {lastExecResult && (
                <div className={`border rounded-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200 ${
                  lastExecResult.summary.errors === 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {lastExecResult.summary.errors === 0
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <AlertTriangle className="w-4 h-4 text-amber-500" />
                      }
                      <span className="text-[13px] font-semibold text-foreground">
                        Результат выполнения
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-emerald-600">{lastExecResult.summary.success} OK</span>
                      {lastExecResult.summary.errors > 0 && <span className="text-red-500">{lastExecResult.summary.errors} ошибок</span>}
                      <span className="text-muted-foreground">{lastExecResult.summary.totalDurationMs}ms</span>
                      <button onClick={() => setLastExecResult(null)} className="p-0.5 hover:bg-muted rounded"><X className="w-3 h-3 text-muted-foreground" /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {lastExecResult.results.map((r, i) => {
                      const def = NODE_REGISTRY.find((d) => d.subtype === r.subtype);
                      return (
                        <div key={i} className="flex items-start gap-2 text-[12px]">
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                            r.status === "success" ? "bg-emerald-500/10" :
                            r.status === "error" ? "bg-red-500/10" : "bg-muted"
                          }`}>
                            {r.status === "success" ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> :
                             r.status === "error" ? <XCircle className="w-3 h-3 text-red-500" /> :
                             <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground">{r.label}</span>
                            <p className={`text-[11px] mt-0.5 ${r.status === "error" ? "text-red-500" : "text-muted-foreground"}`}>{r.message}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{r.durationMs}ms</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Flow canvas */}
              <div className="bg-card border border-border rounded-xl p-5 min-h-[400px] relative overflow-auto"
                style={{ background: "radial-gradient(circle, var(--border) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
                {activeFlow.nodes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <Plus className="w-10 h-10 text-muted-foreground/30 mb-2" />
                    <p className="text-[13px] text-muted-foreground">Добавьте первый узел</p>
                    <button onClick={() => setShowNodePicker(true)}
                      className="mt-3 px-4 py-2 text-[12px] bg-[#d4a373]/10 text-[#d4a373] rounded-lg hover:bg-[#d4a373]/20 transition-colors">
                      Добавить триггер
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activeFlow.nodes.map((node, idx) => {
                      const def = NODE_REGISTRY.find((d) => d.subtype === node.subtype);
                      if (!def) return null;
                      const isEditing = editingNode === node.id;
                      const conn = activeFlow.connections.find((c) => c.to === node.id);
                      // Execution status indicator
                      const execStatus = lastExecResult?.results.find((r) => r.nodeId === node.id);

                      return (
                        <div key={node.id}>
                          {idx > 0 && (
                            <div className="flex flex-col items-center py-1">
                              <div className="w-px h-4 bg-border" />
                              <ArrowDown className="w-4 h-4 text-muted-foreground/50" />
                              {conn?.label && <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded -mt-0.5 mb-0.5">{conn.label}</span>}
                            </div>
                          )}

                          <div className={`border rounded-xl p-3 transition-all ${isEditing ? "ring-2 ring-[#d4a373]/30 " + def.bg : def.bg} max-w-md mx-auto relative`}>
                            {/* Execution status dot */}
                            {execStatus && (
                              <div className={`absolute -right-1 -top-1 w-4 h-4 rounded-full flex items-center justify-center ${
                                execStatus.status === "success" ? "bg-emerald-500" : execStatus.status === "error" ? "bg-red-500" : "bg-gray-400"
                              }`}>
                                {execStatus.status === "success" ? <Check className="w-2.5 h-2.5 text-white" /> : <X className="w-2.5 h-2.5 text-white" />}
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${def.bg}`}>
                                <def.icon className={`w-3.5 h-3.5 ${def.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                                    node.type === "trigger" ? "bg-amber-500/20 text-amber-600" :
                                    node.type === "condition" ? "bg-teal-600/20 text-teal-700" : "bg-emerald-500/20 text-emerald-600"
                                  }`}>
                                    {node.type === "trigger" ? "Триггер" : node.type === "condition" ? "Условие" : "Действие"}
                                  </span>
                                </div>
                                <span className="text-[12px] font-medium text-foreground block mt-0.5">{node.label}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => setEditingNode(isEditing ? null : node.id)}
                                  className="p-1 rounded-md hover:bg-white/20 text-muted-foreground transition-colors">
                                  <Settings className="w-3 h-3" />
                                </button>
                                <button onClick={() => removeNode(node.id)}
                                  className="p-1 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {Object.keys(node.config).length > 0 && !isEditing && (
                              <div className="flex flex-wrap gap-1 mt-2 pl-9">
                                {Object.entries(node.config).filter(([k]) => !k.startsWith("_")).map(([k, v]) => (
                                  <span key={k} className="text-[10px] bg-white/10 dark:bg-black/10 px-1.5 py-0.5 rounded text-foreground/70">
                                    {k}: {String(v)}
                                  </span>
                                ))}
                              </div>
                            )}

                            {isEditing && def.configFields.length > 0 && (
                              <div className="mt-3 pl-9 space-y-2 border-t border-white/10 pt-3">
                                {def.configFields.map((field) => (
                                  <div key={field.key}>
                                    <label className="text-[10px] text-muted-foreground font-medium">{field.label}</label>
                                    {field.type === "select" ? (
                                      <select value={node.config[field.key] || ""}
                                        onChange={(e) => updateNodeConfig(node.id, { ...node.config, [field.key]: e.target.value })}
                                        className="w-full mt-0.5 px-2 py-1 text-[11px] bg-white/10 dark:bg-black/10 border border-white/10 rounded-md text-foreground focus:outline-none">
                                        <option value="">Выберите...</option>
                                        {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    ) : (
                                      <input type={field.type === "number" ? "number" : "text"} value={node.config[field.key] || ""}
                                        onChange={(e) => updateNodeConfig(node.id, { ...node.config, [field.key]: e.target.value })}
                                        className="w-full mt-0.5 px-2 py-1 text-[11px] bg-white/10 dark:bg-black/10 border border-white/10 rounded-md text-foreground focus:outline-none"
                                        placeholder={field.label} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {idx === activeFlow.nodes.length - 1 && (
                            <div className="flex flex-col items-center py-2">
                              <div className="w-px h-4 bg-border" />
                              <button onClick={() => { setAddAfterNode(node.id); setShowNodePicker(true); }}
                                className="w-8 h-8 rounded-full border-2 border-dashed border-border hover:border-[#d4a373] hover:bg-[#d4a373]/5 flex items-center justify-center transition-colors group">
                                <Plus className="w-4 h-4 text-muted-foreground group-hover:text-[#d4a373]" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Триггеров", val: activeFlow.nodes.filter((n) => n.type === "trigger").length },
                  { label: "Действий", val: activeFlow.nodes.filter((n) => n.type === "action").length },
                  { label: "Условий", val: activeFlow.nodes.filter((n) => n.type === "condition").length },
                  { label: "Запусков", val: activeFlow.runsCount },
                ].map((s) => (
                  <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
                    <div className="text-[16px] font-bold text-foreground">{s.val}</div>
                    <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Node Picker Modal */}
      {showNodePicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setShowNodePicker(false); setAddAfterNode(null); }}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-foreground">Добавить узел</h3>
              <button onClick={() => { setShowNodePicker(false); setAddAfterNode(null); }} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {(["trigger", "condition", "action"] as NodeType[]).map((type) => {
              const typeDefs = NODE_REGISTRY.filter((d) => d.type === type);
              const typeLabel = type === "trigger" ? "Триггеры" : type === "condition" ? "Условия" : "Действия";
              const typeColor = type === "trigger" ? "text-amber-500" : type === "condition" ? "text-teal-600" : "text-emerald-500";
              return (
                <div key={type} className="mb-4">
                  <h4 className={`text-[12px] font-semibold uppercase tracking-wider mb-2 ${typeColor}`}>{typeLabel}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {typeDefs.map((def) => (
                      <button key={def.subtype} onClick={() => addNode(def, addAfterNode || undefined)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left hover:scale-[1.02] ${def.bg}`}>
                        <def.icon className={`w-4 h-4 ${def.color} shrink-0`} />
                        <div>
                          <span className="text-[12px] font-medium text-foreground block">{def.label}</span>
                          <span className="text-[10px] text-muted-foreground">{def.category}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Execution Logs Modal */}
      {showExecLog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowExecLog(false)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-[#d4a373]" />
                Журнал выполнений
              </h3>
              <button onClick={() => setShowExecLog(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {loadingLogs ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-[#d4a373] animate-spin" />
              </div>
            ) : execLogs.length === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-10">Нет записей выполнения</p>
            ) : (
              <div className="space-y-3">
                {execLogs.slice(0, 10).map((log: any, i: number) => (
                  <div key={i} className={`border rounded-xl p-3 ${log.success ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {log.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                        <span className="text-[12px] font-medium text-foreground">
                          {new Date(log.executedAt).toLocaleString("ru-RU")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="text-emerald-600">{log.successCount} OK</span>
                        {log.errorCount > 0 && <span className="text-red-500">{log.errorCount} ошибок</span>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {log.results?.slice(0, 5).map((r: any, j: number) => (
                        <div key={j} className="flex items-center gap-2 text-[11px]">
                          {r.status === "success" ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" /> :
                           r.status === "error" ? <XCircle className="w-2.5 h-2.5 text-red-500 shrink-0" /> :
                           <ArrowRight className="w-2.5 h-2.5 text-muted-foreground shrink-0" />}
                          <span className="text-foreground truncate">{r.label}: </span>
                          <span className={`truncate ${r.status === "error" ? "text-red-500" : "text-muted-foreground"}`}>{r.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}