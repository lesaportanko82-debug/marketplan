import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GripVertical,
  Info,
  Plus,
  TrendingDown,
  TrendingUp,
  Trash2,
  X,
  Save,
  Undo2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { getData, saveData } from "../lib/api";
import { type MetricNode, type Project } from "../data/mock-data";
import { ModalOverlay } from "./ModalOverlay";
import { useModal } from "../hooks/useModal";
import { EmptyState } from "./EmptyState";

const METRIC_DND_TYPE = "METRIC_TREE_NODE";
const TREE_KEY = "metrics_tree:global";

interface DragItem {
  id: string;
  parentId: string | null;
}

/* ─── Default metrics (empty by default) ─── */
function getDefaultMetrics(): MetricNode[] {
  return [];
}

/* ─── Build tree from flat list ─── */
function buildTree(metrics: MetricNode[]): MetricNode[] {
  const map = new Map<string, MetricNode>();
  const roots: MetricNode[] = [];
  metrics.forEach((m) => map.set(m.id, { ...m, children: [] }));
  metrics.forEach((m) => {
    const node = map.get(m.id)!;
    if (m.parentId && map.has(m.parentId)) {
      map.get(m.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/* ═══ Draggable tree node ═══ */
function DraggableNode({
  node,
  depth,
  isLast,
  onEdit,
  onMove,
  onDelete,
}: {
  node: MetricNode;
  depth: number;
  isLast: boolean;
  onEdit: (m: MetricNode) => void;
  onMove: (dragId: string, dropId: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const progress = node.target > 0 ? Math.min((node.value / node.target) * 100, 100) : 0;
  const isGood = progress >= 70;
  const isWarning = progress >= 40 && progress < 70;

  const nodeRef = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: METRIC_DND_TYPE,
    item: { id: node.id, parentId: node.parentId } as DragItem,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: METRIC_DND_TYPE,
    canDrop: (item: DragItem) => item.id !== node.id,
    drop: (item: DragItem) => onMove(item.id, node.id),
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  const composedRef = useCallback(
    (el: HTMLDivElement | null) => {
      (nodeRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      drop(el);
      preview(el);
    },
    [preview, drop]
  );

  const handleRef = useCallback(
    (el: HTMLDivElement | null) => { drag(el); },
    [drag]
  );

  const depthColor = depth === 0 ? "bg-[#1a7a6d]" : depth === 1 ? "bg-[#d4a373]" : "bg-[#2eb8a4]";

  return (
    <div className="relative">
      {/* Vertical connector */}
      {depth > 0 && (
        <div
          className="absolute top-0 w-px bg-border/60"
          style={{ left: 0, height: isLast ? "20px" : "100%" }}
        />
      )}
      {/* Horizontal connector */}
      {depth > 0 && (
        <div
          className="absolute bg-border/60"
          style={{ left: 0, top: "20px", width: "16px", height: "1px" }}
        />
      )}

      {/* Node row */}
      <div
        ref={composedRef}
        className={`flex items-center gap-2 py-2.5 px-3 rounded-lg transition-all cursor-pointer group relative ${
          depth === 0
            ? "bg-accent/40 border border-border/50 mb-1"
            : "hover:bg-accent/30"
        } ${isDragging ? "opacity-30 scale-[0.98]" : ""} ${
          isOver && canDrop ? "ring-2 ring-[#d4a373]/50 bg-[#d4a373]/5" : ""
        }`}
        style={{ marginLeft: depth > 0 ? 20 : 0 }}
        onClick={() => onEdit(node)}
      >
        {/* Drag handle */}
        <div
          ref={handleRef}
          className="text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 p-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <div className="w-[18px] shrink-0" />
        )}

        {/* Depth dot */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${depthColor}`} />

        {/* Name + formula */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`truncate ${depth === 0 ? "text-foreground text-[14px] font-semibold" : "text-foreground text-[13px]"}`}>
              {node.name}
            </span>
            {node.formula && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-mono hidden sm:inline-block">
                {node.formula}
              </span>
            )}
          </div>
        </div>

        {/* Value + progress */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <span className={`text-foreground ${depth === 0 ? "text-[15px] font-semibold" : "text-[13px]"}`}>
              {typeof node.value === "number" && node.value >= 1000 ? node.value.toLocaleString("ru-RU") : node.value}
            </span>
            <span className="text-muted-foreground text-[11px] ml-1">
              / {typeof node.target === "number" && node.target >= 1000 ? node.target.toLocaleString("ru-RU") : node.target} {node.unit}
            </span>
          </div>
          <div className="w-16 sm:w-20">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isGood ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-red-400"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className={`text-[12px] w-10 text-right font-medium ${isGood ? "text-emerald-600" : isWarning ? "text-amber-600" : "text-red-500"}`}>
            {Math.round(progress)}%
          </span>

          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all p-0.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Drop indicator */}
      {isOver && canDrop && (
        <div className="flex items-center gap-2 py-1 px-3" style={{ marginLeft: depth > 0 ? 20 : 0 }}>
          <ArrowRight className="w-3.5 h-3.5 text-[#d4a373]" />
          <span className="text-[11px] text-[#d4a373] font-medium">Переместить как дочернюю метрику</span>
        </div>
      )}

      {/* Children */}
      {hasChildren && expanded && (
        <div className="relative ml-4 pl-4" style={{ marginLeft: depth > 0 ? 20 : 16 }}>
          <div className="absolute left-0 top-0 w-px bg-border/60" style={{ bottom: 0 }} />
          {node.children!.map((child, idx) => (
            <DraggableNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isLast={idx === node.children!.length - 1}
              onEdit={onEdit}
              onMove={onMove}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ Add metric modal ═══ */
function AddMetricModal({
  metrics,
  onAdd,
  onClose,
}: {
  metrics: MetricNode[];
  onAdd: (m: MetricNode) => void;
  onClose: () => void;
}) {
  const modalRef = useModal(onClose);
  const [name, setName] = useState("");
  const [value, setValue] = useState(0);
  const [target, setTarget] = useState(100);
  const [unit, setUnit] = useState("");
  const [formula, setFormula] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!name.trim()) { toast.error("Введите название метрики"); return; }
    onAdd({
      id: `custom::${Date.now()}`,
      name: name.trim(),
      value,
      target,
      unit: unit.trim() || "units",
      parentId,
      formula: formula.trim() || undefined,
    });
    onClose();
    toast.success("Метрика добавлена");
  };

  return (
    <div
      ref={modalRef}
      className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-metric-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 id="add-metric-title" className="text-foreground text-[16px] font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#d4a373]" />
          Новая метрика
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Закрыть">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[12px] text-muted-foreground mb-1 block">Название *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Например: Revenue"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">Значение</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">Цель</label>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">Единица</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="RUB, %, pts..."
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground mb-1 block">Формула</label>
            <input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="A / B"
            />
          </div>
        </div>

        <div>
          <label className="text-[12px] text-muted-foreground mb-1 block">Родительская метрика</label>
          <select
            value={parentId || ""}
            onChange={(e) => setParentId(e.target.value || null)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Корневая (без родителя)</option>
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
          Отмена
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-[13px] rounded-lg font-medium text-white transition-colors"
          style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)" }}
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

/* ═══ Detail panel ═══ */
function MetricDetail({ metric, onClose }: { metric: MetricNode; onClose: () => void }) {
  const progress = metric.target > 0 ? Math.round((metric.value / metric.target) * 100) : 0;
  return (
    <div className="bg-card border border-[#d4a373]/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#d4a373]" />
          {metric.name}
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-[13px] px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
          Закрыть
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-accent/30 rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Текущее значение</p>
          <p className="text-[20px] text-foreground font-semibold">
            {metric.value.toLocaleString("ru-RU")}{" "}
            <span className="text-[13px] font-normal text-muted-foreground">{metric.unit}</span>
          </p>
        </div>
        <div className="bg-accent/30 rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Цель</p>
          <p className="text-[20px] text-foreground font-semibold">
            {metric.target.toLocaleString("ru-RU")}{" "}
            <span className="text-[13px] font-normal text-muted-foreground">{metric.unit}</span>
          </p>
        </div>
        <div className="bg-accent/30 rounded-lg p-3">
          <p className="text-[11px] text-muted-foreground mb-1">Прогресс</p>
          <p className="text-[20px] text-foreground font-semibold">{progress}%</p>
        </div>
        {metric.formula && (
          <div className="bg-accent/30 rounded-lg p-3">
            <p className="text-[11px] text-muted-foreground mb-1">Формула</p>
            <p className="text-[14px] text-foreground bg-muted px-3 py-1.5 rounded-lg inline-block font-mono">
              {metric.formula}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ Calculator mode ═══ */
function CalculatorMode({ metrics }: { metrics: MetricNode[] }) {
  const [simValues, setSimValues] = useState<Record<string, number>>({});
  const getVal = (m: MetricNode) => simValues[m.id] !== undefined ? simValues[m.id] : m.value;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-foreground mb-4 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Симулятор метрик
        </h3>
        <p className="text-muted-foreground text-[13px] mb-5">
          Двигайте ползунки, чтобы увидеть, как изменение одной метрики влияет на другие
        </p>
        <div className="space-y-5 max-h-[500px] overflow-y-auto pr-2">
          {metrics.map((m) => (
            <div key={m.id}>
              <div className="flex justify-between text-[13px] mb-2">
                <span className="text-foreground truncate mr-2">{m.name}</span>
                <span className="text-muted-foreground shrink-0">
                  {getVal(m).toLocaleString("ru-RU")} {m.unit}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={m.target * 1.5}
                step={m.target > 100 ? Math.round(m.target / 100) : 0.1}
                value={getVal(m)}
                onChange={(e) => setSimValues((p) => ({ ...p, [m.id]: parseFloat(e.target.value) }))}
                className="w-full accent-primary h-2 rounded-full appearance-none bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>0</span>
                <span className="text-amber-600">Цель: {m.target.toLocaleString("ru-RU")}</span>
                <span>{(m.target * 1.5).toLocaleString("ru-RU")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Расчётные показатели
        </h3>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {metrics.map((m) => {
            const simVal = getVal(m);
            const diff = simVal - m.value;
            const diffPct = m.value > 0 ? ((diff / m.value) * 100).toFixed(1) : "0";
            const toPct = m.target > 0 ? ((simVal / m.target) * 100).toFixed(0) : "0";
            return (
              <div key={m.id} className="p-4 rounded-lg bg-accent/30 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-foreground text-[14px]">{m.name}</span>
                  <span className={`text-[13px] flex items-center gap-1 ${diff >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {diff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {diff >= 0 ? "+" : ""}{diffPct}%
                  </span>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-[22px] text-foreground">{simVal.toLocaleString("ru-RU")}</span>
                  <span className="text-[13px] text-muted-foreground mb-1">{m.unit}</span>
                </div>
                <div className="mt-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${Number(toPct) >= 100 ? "bg-emerald-500" : Number(toPct) >= 70 ? "bg-amber-500" : "bg-red-400"}`}
                      style={{ width: `${Math.min(Number(toPct), 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground mt-1 block">{toPct}% от цели</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ MAIN PAGE ═══ */
export function MetricsTreePage() {
  const [metrics, setMetrics] = useState<MetricNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricNode | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "calculator">("tree");
  const [showAdd, setShowAdd] = useState(false);
  const [moveHistory, setMoveHistory] = useState<{ dragId: string; oldParent: string | null; newParent: string }[]>([]);
  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Stable ref so handleMove can read current metrics without stale closure
  const metricsRef = useRef<MetricNode[]>([]);
  metricsRef.current = metrics;

  // Load
  useEffect(() => {
    setIsLoading(true);
    getData<MetricNode[]>(TREE_KEY)
      .then((saved) => {
        if (saved && Array.isArray(saved) && saved.length > 0) {
          setMetrics(saved);
        } else {
          setMetrics(getDefaultMetrics());
        }
      })
      .catch(() => setMetrics(getDefaultMetrics()))
      .finally(() => setIsLoading(false));
  }, []);

  const tree = useMemo(() => buildTree(metrics), [metrics]);
  const rootCount = tree.length;
  const totalCount = metrics.length;
  const avgProgress = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + (m.target > 0 ? Math.min((m.value / m.target) * 100, 100) : 0), 0) / metrics.length)
    : 0;

  // Save
  const handleSave = useCallback(() => {
    saveData(TREE_KEY, metrics).then((ok) => {
      if (ok) { toast.success("Дерево метрик сохранено"); setHasUnsaved(false); }
      else toast.error("Ошибка сохранения");
    });
  }, [metrics]);

  // Move - side effects are intentionally kept OUTSIDE the setMetrics updater
  // to avoid React Strict Mode double-invocation of the pure updater function.
  const handleMove = useCallback((dragId: string, dropId: string) => {
    const prev = metricsRef.current;

    const isDesc = (pid: string, cid: string): boolean => {
      const ch = prev.filter((m) => m.parentId === pid);
      return ch.some((c) => c.id === cid || isDesc(c.id, cid));
    };
    if (isDesc(dragId, dropId)) return;

    const dm = prev.find((m) => m.id === dragId);
    if (!dm) return;

    const oldParent = dm.parentId;
    const dropM = prev.find((m) => m.id === dropId);

    setMetrics(prev.map((m) => (m.id === dragId ? { ...m, parentId: dropId } : m)));
    setMoveHistory((h) => [...h, { dragId, oldParent, newParent: dropId }]);
    setHasUnsaved(true);
    toast.success("Метрика перемещена", { description: `${dm.name} → ${dropM?.name || "корень"}` });
  }, []);

  // Undo
  const handleUndo = useCallback(() => {
    if (moveHistory.length === 0) return;
    const last = moveHistory[moveHistory.length - 1];
    setMetrics((prev) => prev.map((m) => (m.id === last.dragId ? { ...m, parentId: last.oldParent } : m)));
    setMoveHistory((h) => h.slice(0, -1));
    setHasUnsaved(true);
    toast.info("Перемещение отменено");
  }, [moveHistory]);

  // Add
  const handleAdd = useCallback((m: MetricNode) => {
    setMetrics((prev) => [...prev, m]);
    setHasUnsaved(true);
  }, []);

  // Delete
  const handleDelete = useCallback((id: string) => {
    setMetrics((prev) => {
      // Also orphan children to root
      return prev.filter((m) => m.id !== id).map((m) => (m.parentId === id ? { ...m, parentId: null } : m));
    });
    setHasUnsaved(true);
    toast("Метрика удалена");
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="p-4 sm:p-5 max-w-[1440px] mx-auto space-y-4 sm:space-y-5" data-hotspot="metrics-tree">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="min-w-0">
            <h1 className="text-foreground flex items-center gap-2.5">
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #1a7a6d 0%, #2eb8a4 100%)",
                  boxShadow: "0 2px 10px rgba(26,122,109,0.3)",
                }}
              >
                <GitBranch className="w-4 h-4 text-white" />
              </div>
              Дерево метрик
            </h1>
            <p className="text-muted-foreground text-[13px] mt-1 ml-11 hidden sm:block">
              Глобальное дерево всех метрик - перетаскивайте, добавляйте, симулируйте
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasUnsaved && (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
                style={{ background: "linear-gradient(135deg, #1a7a6d, #2eb8a4)" }}
              >
                <Save className="w-3.5 h-3.5" />
                Сохранить
              </button>
            )}
            {moveHistory.length > 0 && viewMode === "tree" && (
              <button
                onClick={handleUndo}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Отменить ({moveHistory.length})
              </button>
            )}
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] bg-[#d4a373]/10 text-[#d4a373] hover:bg-[#d4a373]/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                viewMode === "tree" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Дерево
            </button>
            <button
              onClick={() => setViewMode("calculator")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                viewMode === "calculator" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Калькулятор
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 flex-wrap text-[13px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="w-4 h-4" />
            <span><b className="text-foreground">{rootCount}</b> корневых</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="w-4 h-4" />
            <span><b className="text-foreground">{totalCount}</b> всего метрик</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="w-4 h-4" />
            <span>Ср. прогресс: <b className={avgProgress >= 70 ? "text-emerald-600" : avgProgress >= 40 ? "text-amber-600" : "text-red-500"}>{avgProgress}%</b></span>
          </div>
        </div>

        {viewMode === "tree" ? (
          <>
            {/* Hint */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a7a6d]/5 border border-[#1a7a6d]/15 rounded-lg text-[13px] text-[#1a7a6d] dark:text-[#2eb8a4]">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                Перетаскивайте метрики за{" "}
                <GripVertical className="w-3 h-3 inline-block align-middle opacity-60" />{" "}
                чтобы перестроить дерево. Нажмите на метрику для деталей. Кнопка{" "}
                <Trash2 className="w-3 h-3 inline-block align-middle opacity-60" />{" "}
                (при наведении) - удалить.
              </span>
            </div>

            {/* Tree */}
            {tree.length === 0 ? (
              <EmptyState
                title="Нет метрик"
                description="Нажмите «Добавить», чтобы создать первую метрику и начать строить дерево метрик"
                emotion="idle"
                action={{ label: "Добавить метрику", onClick: () => setShowAdd(true), icon: <Plus className="w-4 h-4" /> }}
              />
            ) : (
              <div className="bg-card border border-border rounded-xl p-4 space-y-1 overflow-x-auto">
                {tree.map((node, idx) => (
                  <DraggableNode
                    key={node.id}
                    node={node}
                    depth={0}
                    isLast={idx === tree.length - 1}
                    onEdit={(m) => setSelectedMetric(m)}
                    onMove={handleMove}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-1 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#1a7a6d]" /> Корневая
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#d4a373]" /> Ур. 1
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#2eb8a4]" /> Ур. 2+
              </div>
              <div className="mx-2 h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-1.5 rounded-full bg-emerald-500" /> &ge; 70%
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-1.5 rounded-full bg-amber-500" /> 40-70%
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-1.5 rounded-full bg-red-400" /> &lt; 40%
              </div>
            </div>

            {/* Detail */}
            {selectedMetric && (
              <MetricDetail metric={selectedMetric} onClose={() => setSelectedMetric(null)} />
            )}
          </>
        ) : (
          <CalculatorMode metrics={metrics} />
        )}

        {/* Add modal */}
        {showAdd && (
          <ModalOverlay onClose={() => setShowAdd(false)} label="Добавить метрику">
            <AddMetricModal metrics={metrics} onAdd={handleAdd} onClose={() => setShowAdd(false)} />
          </ModalOverlay>
        )}
      </div>
    </DndProvider>
  );
}