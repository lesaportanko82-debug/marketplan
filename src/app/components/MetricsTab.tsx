import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import type { Project, MetricNode } from "../data/mock-data";
import { toast } from "sonner";
import { getData, saveData } from "../lib/api";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GripVertical,
  Info,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

const METRIC_DND_TYPE = "METRIC_NODE";

interface DragItem {
  id: string;
  parentId: string | null;
}

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

/* ═══ Tree node with DnD ═══ */
function DraggableMetricTreeNode({
  node,
  depth,
  isLast,
  onEdit,
  onMove,
}: {
  node: MetricNode;
  depth: number;
  isLast: boolean;
  onEdit: (m: MetricNode) => void;
  onMove: (dragId: string, dropId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const progress = node.target > 0 ? Math.min((node.value / node.target) * 100, 100) : 0;
  const isGood = progress >= 70;
  const isWarning = progress >= 40 && progress < 70;

  /* ─── DnD ─── */
  const nodeRef = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: METRIC_DND_TYPE,
    item: { id: node.id, parentId: node.parentId } as DragItem,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: METRIC_DND_TYPE,
    canDrop: (item: DragItem) => item.id !== node.id,
    drop: (item: DragItem) => {
      onMove(item.id, node.id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  // Compose refs properly via callback ref
  const composedRef = useCallback(
    (el: HTMLDivElement | null) => {
      (nodeRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      drop(el);
      preview(el);
    },
    [preview, drop]
  );

  const handleRef = useCallback(
    (el: HTMLDivElement | null) => {
      drag(el);
    },
    [drag]
  );

  return (
    <div className="relative">
      {/* ─── Vertical connector line from parent ─── */}
      {depth > 0 && (
        <div
          className="absolute top-0 w-px bg-border/60"
          style={{
            left: 0,
            height: isLast ? "20px" : "100%",
          }}
        />
      )}

      {/* ─── Horizontal connector line ─── */}
      {depth > 0 && (
        <div
          className="absolute bg-border/60"
          style={{
            left: 0,
            top: "20px",
            width: "16px",
            height: "1px",
          }}
        />
      )}

      {/* ─── Node row ─── */}
      <div
        ref={composedRef}
        className={`flex items-center gap-2 py-2.5 px-3 rounded-lg transition-all cursor-pointer group relative ${
          depth === 0
            ? "bg-accent/40 border border-border/50 mb-1"
            : "hover:bg-accent/30"
        } ${isDragging ? "opacity-30 scale-[0.98]" : ""} ${
          isOver && canDrop
            ? "ring-2 ring-[#d4a373]/50 bg-[#d4a373]/5"
            : ""
        }`}
        style={{ marginLeft: depth > 0 ? 20 : 0 }}
        onClick={() => onEdit(node)}
      >
        {/* Drag Handle */}
        <div
          ref={handleRef}
          className="text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 p-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <div className="w-[18px] shrink-0" />
        )}

        {/* Depth indicator dot */}
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            depth === 0
              ? "bg-[#1a7a6d]"
              : depth === 1
              ? "bg-[#d4a373]"
              : "bg-[#2eb8a4]"
          }`}
        />

        {/* Metric Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`truncate ${
                depth === 0
                  ? "text-foreground text-[14px] font-semibold"
                  : "text-foreground text-[13px]"
              }`}
            >
              {node.name}
            </span>
            {node.formula && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-mono hidden sm:inline-block">
                {node.formula}
              </span>
            )}
          </div>
        </div>

        {/* Value & Progress */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <span className={`text-foreground ${depth === 0 ? "text-[15px] font-semibold" : "text-[13px]"}`}>
              {typeof node.value === "number" && node.value >= 1000
                ? node.value.toLocaleString("ru-RU")
                : node.value}
            </span>
            <span className="text-muted-foreground text-[11px] ml-1">
              /{" "}
              {typeof node.target === "number" && node.target >= 1000
                ? node.target.toLocaleString("ru-RU")
                : node.target}{" "}
              {node.unit}
            </span>
          </div>
          <div className="w-16 sm:w-20">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isGood
                    ? "bg-emerald-500"
                    : isWarning
                    ? "bg-amber-500"
                    : "bg-red-400"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span
            className={`text-[12px] w-10 text-right font-medium ${
              isGood
                ? "text-emerald-600"
                : isWarning
                ? "text-amber-600"
                : "text-red-500"
            }`}
          >
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Drop zone indicator */}
      {isOver && canDrop && (
        <div
          className="flex items-center gap-2 py-1 px-3"
          style={{ marginLeft: depth > 0 ? 20 : 0 }}
        >
          <ArrowRight className="w-3.5 h-3.5 text-[#d4a373]" />
          <span className="text-[11px] text-[#d4a373] font-medium">
            Переместить как дочернюю метрику
          </span>
        </div>
      )}

      {/* Children */}
      {hasChildren && expanded && (
        <div className="relative ml-4 pl-4" style={{ marginLeft: depth > 0 ? 20 : 16 }}>
          {/* Vertical line connecting children */}
          <div
            className="absolute left-0 top-0 w-px bg-border/60"
            style={{ bottom: 0 }}
          />
          {node.children!.map((child, idx) => (
            <DraggableMetricTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isLast={idx === node.children!.length - 1}
              onEdit={onEdit}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ Main MetricsTab ═══ */
export function MetricsTab({ project }: { project: Project }) {
  const [selectedMetric, setSelectedMetric] = useState<MetricNode | null>(null);
  const [simulationValues, setSimulationValues] = useState<
    Record<string, number>
  >({});
  const [viewMode, setViewMode] = useState<"tree" | "calculator">("tree");
  const [metrics, setMetrics] = useState<MetricNode[]>(project.metrics);
  const [moveHistory, setMoveHistory] = useState<
    { dragId: string; oldParent: string | null; newParent: string }[]
  >([]);

  // Load persisted metrics tree on mount
  useEffect(() => {
    getData<MetricNode[]>(`metrics_tree:${project.id}`).then((saved) => {
      if (saved && Array.isArray(saved) && saved.length > 0) {
        setMetrics(saved);
        console.log(`Loaded persisted metrics tree for project ${project.id}`);
      }
    });
  }, [project.id]);

  const tree = useMemo(() => buildTree(metrics), [metrics]);

  const handleMove = useCallback(
    (dragId: string, dropId: string) => {
      setMetrics((prev) => {
        const isDescendant = (parentId: string, childId: string): boolean => {
          const children = prev.filter((m) => m.parentId === parentId);
          return children.some(
            (c) => c.id === childId || isDescendant(c.id, childId)
          );
        };
        if (isDescendant(dragId, dropId)) return prev;

        const dragMetric = prev.find((m) => m.id === dragId);
        if (!dragMetric) return prev;

        const oldParent = dragMetric.parentId;
        const dropMetric = prev.find((m) => m.id === dropId);

        setMoveHistory((h) => [
          ...h,
          { dragId, oldParent, newParent: dropId },
        ]);

        toast.success("Метрика перемещена", {
          description: `${dragMetric.name} → ${dropMetric?.name || "корень"}`,
        });

        const updated = prev.map((m) =>
          m.id === dragId ? { ...m, parentId: dropId } : m
        );

        // Persist to Supabase
        saveData(`metrics_tree:${project.id}`, updated).then((ok) => {
          if (ok) console.log("Metrics tree persisted");
        });

        return updated;
      });
    },
    [project.id]
  );

  const handleUndo = useCallback(() => {
    if (moveHistory.length === 0) return;
    const last = moveHistory[moveHistory.length - 1];
    setMetrics((prev) => {
      const updated = prev.map((m) =>
        m.id === last.dragId ? { ...m, parentId: last.oldParent } : m
      );
      // Persist undo
      saveData(`metrics_tree:${project.id}`, updated);
      return updated;
    });
    setMoveHistory((h) => h.slice(0, -1));
    toast.info("Перемещение отменено");
  }, [moveHistory, project.id]);

  const getSimValue = (m: MetricNode) =>
    simulationValues[m.id] !== undefined ? simulationValues[m.id] : m.value;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-foreground">Дерево метрик</h2>
            <p className="text-muted-foreground text-[14px] mt-1">
              Интерактивное управление и расчёт ключевых показателей
            </p>
          </div>
          <div className="flex items-center gap-2">
            {moveHistory.length > 0 && viewMode === "tree" && (
              <button
                onClick={handleUndo}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[14px] bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
              >
                Отменить ({moveHistory.length})
              </button>
            )}
            <button
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[14px] transition-colors ${
                viewMode === "tree"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Дерево
            </button>
            <button
              onClick={() => setViewMode("calculator")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[14px] transition-colors ${
                viewMode === "calculator"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calculator className="w-4 h-4" />
              Калькулятор
            </button>
          </div>
        </div>

        {viewMode === "tree" ? (
          <>
            {/* D&D hint */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a7a6d]/5 border border-[#1a7a6d]/15 rounded-lg text-[13px] text-[#1a7a6d] dark:text-[#2eb8a4]">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                Перетаскивайте метрики за{" "}
                <GripVertical className="w-3 h-3 inline-block align-middle opacity-60" />{" "}
                чтобы перестроить дерево. Нажмите на метрику для деталей.
              </span>
            </div>

            {/* Tree */}
            {tree.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-[14px]">Нет метрик</p>
                <p className="text-[12px] mt-1">
                  Добавьте метрики в проект, чтобы построить дерево
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-4 space-y-1 overflow-x-auto">
                {tree.map((node, idx) => (
                  <DraggableMetricTreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    isLast={idx === tree.length - 1}
                    onEdit={(m) => setSelectedMetric(m)}
                    onMove={handleMove}
                  />
                ))}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#1a7a6d]" />
                Корневая метрика
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#d4a373]" />
                Ур. 1
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#2eb8a4]" />
                Ур. 2+
              </div>
              <div className="mx-2 h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-1.5 rounded-full bg-emerald-500" />
                ≥ 70%
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-1.5 rounded-full bg-amber-500" />
                40–70%
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-1.5 rounded-full bg-red-400" />
                &lt; 40%
              </div>
            </div>
          </>
        ) : (
          /* Calculator Mode */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Simulation Panel */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-foreground mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Симулятор метрик
              </h3>
              <p className="text-muted-foreground text-[13px] mb-5">
                Двигайте ползунки, чтобы увидеть, как изменение одной метрики
                влияет на другие
              </p>
              <div className="space-y-5">
                {metrics.map((m) => (
                  <div key={m.id}>
                    <div className="flex justify-between text-[13px] mb-2">
                      <span className="text-foreground">{m.name}</span>
                      <span className="text-muted-foreground">
                        {getSimValue(m).toLocaleString("ru-RU")} {m.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={m.target * 1.5}
                      step={
                        m.target > 100 ? Math.round(m.target / 100) : 0.1
                      }
                      value={getSimValue(m)}
                      onChange={(e) =>
                        setSimulationValues((prev) => ({
                          ...prev,
                          [m.id]: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-primary h-2 rounded-full appearance-none bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                      <span>0</span>
                      <span className="text-amber-600">
                        Цель: {m.target.toLocaleString("ru-RU")}
                      </span>
                      <span>{(m.target * 1.5).toLocaleString("ru-RU")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Results Panel */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-foreground mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Расчётные показатели
              </h3>
              <div className="space-y-4">
                {metrics.map((m) => {
                  const simVal = getSimValue(m);
                  const diff = simVal - m.value;
                  const diffPercent =
                    m.value > 0
                      ? ((diff / m.value) * 100).toFixed(1)
                      : "0";
                  const toTarget = m.target > 0 ? ((simVal / m.target) * 100).toFixed(0) : "0";
                  return (
                    <div
                      key={m.id}
                      className="p-4 rounded-lg bg-accent/30 border border-border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-foreground text-[14px]">
                          {m.name}
                        </span>
                        <span
                          className={`text-[13px] flex items-center gap-1 ${
                            diff >= 0 ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {diff >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {diff >= 0 ? "+" : ""}
                          {diffPercent}%
                        </span>
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="text-[22px] text-foreground">
                          {simVal.toLocaleString("ru-RU")}
                        </span>
                        <span className="text-[13px] text-muted-foreground mb-1">
                          {m.unit}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              Number(toTarget) >= 100
                                ? "bg-emerald-500"
                                : Number(toTarget) >= 70
                                ? "bg-amber-500"
                                : "bg-red-400"
                            }`}
                            style={{
                              width: `${Math.min(Number(toTarget), 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-1 block">
                          {toTarget}% от цели
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Selected Metric Detail */}
        {selectedMetric && viewMode === "tree" && (
          <div className="bg-card border border-[#d4a373]/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-foreground flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#d4a373]" />
                {selectedMetric.name}
              </h3>
              <button
                onClick={() => setSelectedMetric(null)}
                className="text-muted-foreground hover:text-foreground text-[13px] px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                Закрыть
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-accent/30 rounded-lg p-3">
                <p className="text-[11px] text-muted-foreground mb-1">
                  Текущее значение
                </p>
                <p className="text-[20px] text-foreground font-semibold">
                  {selectedMetric.value.toLocaleString("ru-RU")}{" "}
                  <span className="text-[13px] font-normal text-muted-foreground">
                    {selectedMetric.unit}
                  </span>
                </p>
              </div>
              <div className="bg-accent/30 rounded-lg p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Цель</p>
                <p className="text-[20px] text-foreground font-semibold">
                  {selectedMetric.target.toLocaleString("ru-RU")}{" "}
                  <span className="text-[13px] font-normal text-muted-foreground">
                    {selectedMetric.unit}
                  </span>
                </p>
              </div>
              <div className="bg-accent/30 rounded-lg p-3">
                <p className="text-[11px] text-muted-foreground mb-1">
                  Прогресс
                </p>
                <p className="text-[20px] text-foreground font-semibold">
                  {selectedMetric.target > 0 ? Math.round(
                    (selectedMetric.value / selectedMetric.target) * 100
                  ) : 0}
                  %
                </p>
              </div>
              {selectedMetric.formula && (
                <div className="bg-accent/30 rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground mb-1">
                    Формула
                  </p>
                  <p className="text-[14px] text-foreground bg-muted px-3 py-1.5 rounded-lg inline-block font-mono">
                    {selectedMetric.formula}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
}