import { useState, useRef } from "react";
import {
  Download, Upload, Shield, Clock, Database, AlertTriangle,
  CheckCircle2, Loader2, FileJson, HardDrive, X,
} from "lucide-react";
import { toast } from "sonner";
import { exportBackup, importBackup, type BackupData } from "../lib/api";
import { ModalOverlay } from "./ModalOverlay";
import { useModal } from "../hooks/useModal";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DataBackup() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<BackupData | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Export ── */
  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportBackup();
      if (!data) throw new Error("Нет данных для экспорта");

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `marketplan-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastExport(new Date().toISOString());
      toast.success("Бэкап создан", {
        description: `${data.count} записей, ${formatBytes(json.length)}`,
      });
    } catch (err: any) {
      toast.error("Ошибка экспорта", { description: err.message });
    } finally {
      setExporting(false);
    }
  };

  /* ── Import: file select ── */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Файл слишком большой", { description: "Максимум 10 МБ" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as BackupData;
        if (!parsed.entries || !Array.isArray(parsed.entries)) {
          throw new Error("Неверный формат файла");
        }
        setImportPreview(parsed);
        setShowConfirm(true);
      } catch (err: any) {
        toast.error("Ошибка чтения файла", { description: err.message });
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  /* ── Import: confirm ── */
  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const count = await importBackup(importPreview.entries);
      toast.success("Данные восстановлены", {
        description: `${count} записей импортировано. Перезагрузите страницу для применения.`,
        duration: 8000,
        action: {
          label: "Перезагрузить",
          onClick: () => window.location.reload(),
        },
      });
      setShowConfirm(false);
      setImportPreview(null);
    } catch (err: any) {
      toast.error("Ошибка импорта", { description: err.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#d4a373]/10 flex items-center justify-center">
          <Shield className="w-4.5 h-4.5 text-[#d4a373]" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">Резервное копироание</h3>
          <p className="text-[12px] text-muted-foreground">
            Экспортируйте все данные в JSON или восстановите из бэкапа
          </p>
        </div>
      </div>

      {/* Export / Import cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Export card */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Download className="w-4 h-4 text-emerald-500" /> Экспорт данных
          </div>
          <p className="text-[11px] text-muted-foreground">
            Скачает все проекты, настройки, контент-планы, метрики, историю AI и конфиги интеграций в один JSON-файл.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)",
              color: "#fff",
            }}
          >
            {exporting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Экспортирую...</>
            ) : (
              <><Download className="w-3.5 h-3.5" /> Скачать бэкап</>
            )}
          </button>
          {lastExport && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Последний экспорт: {new Date(lastExport).toLocaleString("ru-RU")}
            </p>
          )}
        </div>

        {/* Import card */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Upload className="w-4 h-4 text-teal-500" /> Восстановление
          </div>
          <p className="text-[11px] text-muted-foreground">
            Загрузите ранее экспортированный JSON-файл. Существующие данные будут перезаписаны.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-muted text-foreground rounded-lg text-[12px] font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            {importing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Импортирую...</>
            ) : (
              <><Upload className="w-3.5 h-3.5" /> Загрузить бэкап</>
            )}
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-[#d4a373]/[0.05] border border-[#d4a373]/15 rounded-lg p-3 flex items-start gap-2.5">
        <HardDrive className="w-4 h-4 text-[#d4a373] shrink-0 mt-0.5" />
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          <p>Бэкап включает: проекты, контент-планы, конкурентный анализ, A/B тесты, медиабиблиотеку, unit-экономику, настройки дашборда, историю AI, конфиги интеграций.</p>
          <p className="text-[#d4a373]/70">Рекомендуем делать бэкап перед крупными изменениями.</p>
        </div>
      </div>

      {/* Confirm import dialog */}
      {showConfirm && importPreview && (
        <ModalOverlay onClose={() => { setShowConfirm(false); setImportPreview(null); }}>
          <ConfirmImportDialog
            importPreview={importPreview}
            importing={importing}
            onConfirm={handleImportConfirm}
            onClose={() => { setShowConfirm(false); setImportPreview(null); }}
          />
        </ModalOverlay>
      )}
    </div>
  );
}

function ConfirmImportDialog({
  importPreview,
  importing,
  onConfirm,
  onClose,
}: {
  importPreview: BackupData;
  importing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const modalRef = useModal(onClose);

  return (
    <div
      ref={modalRef}
      className="bg-card border border-border rounded-xl p-6 max-w-[440px] w-full shadow-2xl space-y-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-import-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 id="confirm-import-title" className="text-[15px] font-semibold text-foreground">Подтвердите импорт</h3>
            <p className="text-[12px] text-muted-foreground">Существующие данные будут перезаписаны</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preview */}
      <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-[12px] text-foreground">
          <FileJson className="w-4 h-4 text-[#d4a373]" />
          <span className="font-medium">Содержимое бэкапа</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Database className="w-3 h-3" /> Записей: <span className="text-foreground font-medium">{importPreview.count}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="w-3 h-3" /> Дата: <span className="text-foreground font-medium">{new Date(importPreview.exportedAt).toLocaleDateString("ru-RU")}</span>
          </div>
        </div>
        {/* Key categories */}
        <div className="flex flex-wrap gap-1 mt-1">
          {Array.from(
            new Set(
              importPreview.entries.map((e) => {
                const parts = e.key.replace("mp:", "").split(":");
                return parts[0] || "other";
              })
            )
          ).slice(0, 8).map((cat) => (
            <span
              key={cat}
              className="px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground border border-border"
            >
              {cat}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 px-3 py-2.5 bg-muted text-muted-foreground rounded-lg text-[12px] font-medium hover:text-foreground transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={onConfirm}
          disabled={importing}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-500 text-white rounded-lg text-[12px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {importing ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Импортирую...</>
          ) : (
            <><Upload className="w-3.5 h-3.5" /> Восстановить</>
          )}
        </button>
      </div>
    </div>
  );
}