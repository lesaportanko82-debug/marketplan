import { useState, useEffect } from "react";
import {
  History, ChevronDown, ChevronRight, RotateCcw, Trash2, X,
  Clock, FileText, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getVersions, deleteVersion, type VersionEntry } from "../lib/version-history";
import { ModalOverlay } from "./ModalOverlay";
import { useModal } from "../hooks/useModal";

interface VersionHistoryProps {
  entityType: string;
  entityId: string;
  /** Label shown in header, e.g. "Контент-план" */
  label: string;
  /** Called when user wants to restore a version */
  onRestore: (data: any) => void;
  /** Compact inline trigger (default: full panel) */
  trigger?: boolean;
}

export function VersionHistory({ entityType, entityId, label, onRestore, trigger }: VersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const v = await getVersions(entityType, entityId);
    setVersions(v);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, entityType, entityId]);

  const handleRestore = (entry: VersionEntry) => {
    onRestore(entry.data);
    toast.success("Версия восстановлена", {
      description: `${entry.label} от ${new Date(entry.timestamp).toLocaleString("ru-RU")}`,
    });
    setOpen(false);
  };

  const handleDelete = async (versionId: string) => {
    await deleteVersion(entityType, entityId, versionId);
    setVersions((v) => v.filter((e) => e.id !== versionId));
    toast.success("Версия удалена");
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "только что";
    if (diffMin < 60) return `${diffMin} мин назад`;
    if (diffHr < 24) return `${diffHr} ч назад`;
    if (diffDay < 7) return `${diffDay} дн назад`;
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  // Trigger button
  if (trigger !== false) {
    return (
      <>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground bg-muted rounded-md transition-colors"
          title="История версий"
        >
          <History className="w-3.5 h-3.5" />
          История
        </button>

        {open && (
          <VersionPanel
            label={label}
            versions={versions}
            loading={loading}
            expanded={expanded}
            setExpanded={setExpanded}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onClose={() => setOpen(false)}
            formatTime={formatTime}
          />
        )}
      </>
    );
  }

  return null;
}

function VersionPanel({
  label, versions, loading, expanded, setExpanded,
  onRestore, onDelete, onClose, formatTime,
}: {
  label: string;
  versions: VersionEntry[];
  loading: boolean;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  onRestore: (entry: VersionEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  formatTime: (ts: string) => string;
}) {
  const modalRef = useModal(onClose);

  return (
    <ModalOverlay onClose={onClose}>
      <div
        ref={modalRef}
        className="bg-card border border-border rounded-xl w-full max-w-[520px] shadow-2xl max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#d4a373]/10 flex items-center justify-center">
              <History className="w-4 h-4 text-[#d4a373]" />
            </div>
            <div>
              <h3 id="version-history-title" className="text-[14px] font-semibold text-foreground">История версий</h3>
              <p className="text-[11px] text-muted-foreground">{label} · {versions.length} версий</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" aria-label="Закрыть">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[13px]">Нет сохранённых версий</p>
              <p className="text-[11px] mt-1">Версии создаются автоматически при редактировании</p>
            </div>
          ) : (
            versions.map((entry, idx) => (
              <div
                key={entry.id}
                className="bg-muted/30 border border-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                >
                  {expanded === entry.id ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-foreground truncate">
                        {entry.label}
                      </span>
                      {idx === 0 && (
                        <span className="px-1.5 py-0.5 bg-[#d4a373]/10 text-[#d4a373] rounded text-[9px] font-medium shrink-0">
                          Последняя
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                </button>

                {expanded === entry.id && (
                  <div className="px-3 pb-3 space-y-2">
                    {/* Data preview */}
                    <div className="bg-background border border-border rounded-md p-2 max-h-[150px] overflow-auto">
                      <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                        {JSON.stringify(entry.data, null, 2).slice(0, 800)}
                        {JSON.stringify(entry.data).length > 800 && "\n..."}
                      </pre>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onRestore(entry)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors"
                        style={{
                          background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)",
                          color: "#fff",
                        }}
                      >
                        <RotateCcw className="w-3 h-3" /> Восстановить
                      </button>
                      <button
                        onClick={() => onDelete(entry.id)}
                        className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-red-500 hover:bg-red-500/5 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Удалить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}