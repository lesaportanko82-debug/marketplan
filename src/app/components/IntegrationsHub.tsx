import { useState, useEffect } from "react";
import {
  Globe, Mail, ImagePlus, Webhook, CheckCircle2, XCircle, RefreshCw,
  Send, Loader2, Zap, ExternalLink, Copy, Check,
  Settings2, BarChart3, FileText, X, Sparkles, Plug, MessageCircle,
  Trash2, Bot, FileDown, GitBranch, Kanban, LayoutList, Box,
  Search as SearchIcon, Layers, ClipboardList, PenTool, Table2,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import {
  getIntegrationsStatus,
  saveIntegrationConfig,
  checkAIStatus,
  checkEmailStatus,
  checkDALLEStatus,
  testWebhook,
  sendEmail,
  generateImage,
  sendWebhookEvent,
  getTelegramConfig,
  saveTelegramConfig,
  verifyTelegramBot,
  sendTelegramMessage,
  sendTelegramDocument,
  deleteTelegramConfig,
  type IntegrationsStatus,
  type AIStatus,
  type TelegramConfig,
} from "../lib/api";
import jsPDF from "jspdf";
import { useUsage } from "../lib/useUsage";
import { UsageMeter } from "./UsageMeter";
import { useModal } from "../hooks/useModal";
import { ModalOverlay } from "./ModalOverlay";

/* ===================================
   Email Modal
   =================================== */
function EmailModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Отчёт MarketPlan");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [reportType, setReportType] = useState<"custom" | "analytics" | "prd" | "brandbook">("custom");

  const TEMPLATES: Record<string, { subject: string; body: string }> = {
    analytics: {
      subject: "Аналитический отчёт MarketPlan",
      body: `<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#d4a373">Аналитический отчёт</h2><p>Добрый день!</p><p>Прикрепляем сводный отчёт по маркетинговой аналитике за текущий период.</p><ul><li>Общий бюджет: в рамках плана</li><li>ROI кампаний: положительная динамика</li><li>Конверсия воронки: рост</li></ul><p>Подробности доступны в <strong>MarketPlan</strong>.</p><p style="color:#888;font-size:12px">Отправлено из MarketPlan</p></div>`,
    },
    prd: {
      subject: "PRD MarketPlan — Описание проекта",
      body: `<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#d4a373">PRD — Product Requirements Document</h2><p>Прикрепляем актуальную версию PRD маркетингового планера MarketPlan.</p><p style="color:#888;font-size:12px">Отправлено из MarketPlan</p></div>`,
    },
    brandbook: {
      subject: "Брендбук MarketPlan",
      body: `<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto"><h2 style="color:#d4a373">Брендбук</h2><p>Прикрепляем актуальную версию брендбука.</p><p style="color:#888;font-size:12px">Отправлено из MarketPlan</p></div>`,
    },
    custom: { subject: "", body: "" },
  };

  useEffect(() => {
    if (reportType !== "custom") {
      setSubject(TEMPLATES[reportType].subject);
      setBody(TEMPLATES[reportType].body);
    }
  }, [reportType]);

  const handleSend = async () => {
    if (!to.trim()) { toast.error("Укажите email получателя"); return; }
    setSending(true);
    try {
      await sendEmail({ to: to.trim(), subject, html: body || undefined, text: !body ? "Отчёт MarketPlan" : undefined });
      toast.success("Email отправлен", { description: `Получатель: ${to}` });
      onClose();
    } catch (err: any) {
      toast.error("Ошибка отправки", { description: err.message });
    } finally { setSending(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-[520px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#d4a373]" /><h3 className="text-foreground font-medium text-[14px]">Отправить отчёт по Email</h3></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["custom", "analytics", "prd", "brandbook"] as const).map((k) => (
              <button key={k} onClick={() => setReportType(k)} className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${reportType === k ? "bg-[#d4a373]/15 text-[#d4a373] border border-[#d4a373]/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
                {{ custom: "Свободное", analytics: "Аналитика", prd: "PRD", brandbook: "Брендбук" }[k]}
              </button>
            ))}
          </div>
          <div><label className="text-[12px] text-muted-foreground block mb-1.5">Кому</label><input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@example.com" className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px]" /></div>
          <div><label className="text-[12px] text-muted-foreground block mb-1.5">Тема</label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px]" /></div>
          <div><label className="text-[12px] text-muted-foreground block mb-1.5">Содержание (HTML)</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px] resize-none" placeholder="HTML-содержимое письма..." /></div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground rounded-md">Отмена</button>
          <button onClick={handleSend} disabled={sending} className="flex items-center gap-2 px-4 py-2 bg-[#d4a373] text-white rounded-md text-[13px] font-medium hover:opacity-90 disabled:opacity-50">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}{sending ? "Отправка..." : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================================
   DALL-E Modal
   =================================== */
function DalleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [style, setStyle] = useState<"vivid" | "natural">("vivid");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ url: string; revised_prompt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const PROMPTS = [
    "Минималистичный баннер для маркетинговой кампании в тёплых тонах",
    "Иллюстрация для поста в Instagram о digital-маркетинге",
    "Обложка для Telegram-канала о бизнесе и аналитике",
    "Инфографика-стиль иллюстрация ROI и воронки продаж",
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error("Введите описание изображения"); return; }
    setGenerating(true); setResult(null);
    try {
      const images = await generateImage(prompt, { size, style });
      if (images.length > 0) { setResult(images[0]); toast.success("Изображение сгенерировано"); }
    } catch (err: any) { toast.error("Ошибка генерации", { description: err.message }); }
    finally { setGenerating(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-[600px] max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2"><ImagePlus className="w-4 h-4 text-[#d4a373]" /><h3 className="text-foreground font-medium text-[14px]">DALL-E 3 — Генерация изображений</h3></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-[12px] text-muted-foreground block mb-1.5">Описание</label><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px] resize-none" placeholder="Опишите, что нужно сгенерировать..." /></div>
          <div className="flex flex-wrap gap-1.5">{PROMPTS.map((t, i) => (<button key={i} onClick={() => setPrompt(t)} className="px-2 py-1 rounded text-[11px] bg-muted text-muted-foreground hover:text-foreground transition-colors truncate max-w-[280px]">{t}</button>))}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] text-muted-foreground block mb-1.5">Размер</label><select value={size} onChange={(e) => setSize(e.target.value)} className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px]"><option value="1024x1024">1024x1024</option><option value="1792x1024">1792x1024</option><option value="1024x1792">1024x1792</option></select></div>
            <div><label className="text-[12px] text-muted-foreground block mb-1.5">Стиль</label><select value={style} onChange={(e) => setStyle(e.target.value as any)} className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px]"><option value="vivid">Vivid</option><option value="natural">Natural</option></select></div>
          </div>
          {result && (
            <div className="space-y-2">
              <div className="rounded-lg overflow-hidden border border-border"><img src={result.url} alt="Generated" className="w-full" /></div>
              {result.revised_prompt && <p className="text-[11px] text-muted-foreground italic">{result.revised_prompt}</p>}
              <div className="flex gap-2">
                <button onClick={() => { copyToClipboard(result.url); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("URL скопирован"); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md text-[12px] text-muted-foreground hover:text-foreground">{copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}{copied ? "Скопировано" : "Копировать URL"}</button>
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md text-[12px] text-muted-foreground hover:text-foreground"><ExternalLink className="w-3 h-3" /> Открыть</a>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground rounded-md">Закрыть</button>
          <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-[#d4a373] text-white rounded-md text-[13px] font-medium hover:opacity-90 disabled:opacity-50">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}{generating ? "Генерация..." : "Сгенерировать"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================================
   Webhook Builder Modal
   =================================== */
function WebhookModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [event, setEvent] = useState("custom.event");
  const [jsonData, setJsonData] = useState('{\n  "message": "Hello from MarketPlan"\n}');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ event: string; time: string; ok: boolean }[]>([]);

  const PRESETS = [
    { event: "content.published", data: { platform: "Instagram", postId: "demo-001" } },
    { event: "ab_test.completed", data: { testId: "test-001", winner: "Вариант B" } },
    { event: "budget.alert", data: { projectId: "proj-001", spent: 80, limit: 100 } },
    { event: "report.generated", data: { type: "analytics", format: "PDF" } },
  ];

  const handleSend = async () => {
    setSending(true);
    try {
      const data = JSON.parse(jsonData);
      const ok = await sendWebhookEvent(event, data);
      setHistory((p) => [{ event, time: new Date().toLocaleTimeString("ru-RU"), ok }, ...p.slice(0, 9)]);
      ok ? toast.success(`Webhook '${event}' отправлен`) : toast.error("Ошибка отправки");
    } catch (err: any) { toast.error("Невалидный JSON", { description: err.message }); }
    finally { setSending(false); }
  };

  if (!open) return null;
  return (
    <ModalOverlay onClose={onClose} label="Pipedream Webhook Builder">
      <div className="bg-card border border-border rounded-xl w-full max-w-[600px] max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2"><Webhook className="w-4 h-4 text-[#d4a373]" /><h3 className="text-foreground font-medium text-[14px]">Pipedream Webhook Builder</h3></div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Закрыть"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-[12px] text-muted-foreground block mb-1.5">Пресеты</label><div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => (<button key={p.event} onClick={() => { setEvent(p.event); setJsonData(JSON.stringify(p.data, null, 2)); }} className="px-2 py-1 rounded text-[11px] bg-muted text-muted-foreground hover:text-foreground transition-colors">{p.event}</button>))}</div></div>
          <div><label htmlFor="webhook-event" className="text-[12px] text-muted-foreground block mb-1.5">Событие</label><input id="webhook-event" type="text" value={event} onChange={(e) => setEvent(e.target.value)} className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px] font-mono" /></div>
          <div><label htmlFor="webhook-json" className="text-[12px] text-muted-foreground block mb-1.5">JSON</label><textarea id="webhook-json" value={jsonData} onChange={(e) => setJsonData(e.target.value)} rows={5} className="w-full bg-uted border-0 rounded-md px-3 py-2 text-foreground text-[13px] font-mono resize-none" /></div>
          {history.length > 0 && (<div><label className="text-[12px] text-muted-foreground block mb-1.5">История</label><div className="space-y-1">{history.map((h, i) => (<div key={`wh-${i}`} className="flex items-center gap-2 text-[12px]">{h.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}<span className="text-muted-foreground font-mono">{h.event}</span><span className="text-muted-foreground ml-auto">{h.time}</span></div>))}</div></div>)}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground rounded-md">Закрыть</button>
          <button onClick={handleSend} disabled={sending} className="flex items-center gap-2 px-4 py-2 bg-[#d4a373] text-white rounded-md text-[13px] font-medium hover:opacity-90 disabled:opacity-50">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}{sending ? "Отправка..." : "Отправить"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ===================================
   Telegram Bot Modal — Setup + Send PDF
   =================================== */
function TelegramModal({ open, onClose, onConfigUpdate }: { open: boolean; onClose: () => void; onConfigUpdate: () => void }) {
  const [step, setStep] = useState<"loading" | "setup" | "connected">("loading");
  const [config, setConfig] = useState<TelegramConfig | null>(null);

  // Setup form
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [botInfo, setBotInfo] = useState<{ botUsername: string; firstName: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Send section
  const [testSending, setTestSending] = useState(false);
  const [pdfSending, setPdfSending] = useState(false);
  const [pdfType, setPdfType] = useState<"summary" | "analytics" | "prd">("summary");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadConfig();
  }, [open]);

  const loadConfig = async () => {
    setStep("loading");
    const cfg = await getTelegramConfig();
    setConfig(cfg);
    if (cfg?.configured) setStep("connected");
    else setStep("setup");
  };

  const handleVerify = async () => {
    if (!botToken.trim()) { toast.error("Введите токен бота"); return; }
    setVerifying(true);
    try {
      const info = await verifyTelegramBot(botToken.trim());
      if (info) {
        setBotInfo({ botUsername: info.botUsername, firstName: info.firstName });
        toast.success(`Бот @${info.botUsername} найден!`);
      }
    } catch (err: any) {
      toast.error("Невалидный токен", { description: err.message });
      setBotInfo(null);
    } finally { setVerifying(false); }
  };

  const handleSave = async () => {
    if (!botToken.trim() || !chatId.trim()) { toast.error("Заполните токен и Chat ID"); return; }
    setSaving(true);
    try {
      await saveTelegramConfig(botToken.trim(), chatId.trim(), botInfo?.botUsername);
      toast.success("Telegram бот подключён!");
      onConfigUpdate();
      loadConfig();
    } catch (err: any) {
      toast.error("Ошибка сохранения", { description: err.message });
    } finally { setSaving(false); }
  };

  const handleTestMessage = async () => {
    setTestSending(true);
    try {
      await sendTelegramMessage(
        `<b>MarketPlan</b>\n\nТестовое сообщение из MarketPlan.\nВаш бот успешно подключён!\n\n<i>${new Date().toLocaleString("ru-RU")}</i>`
      );
      toast.success("Тестовое сообщение отправлено в Telegram!");
    } catch (err: any) {
      toast.error("Ошибка отправки", { description: err.message });
    } finally { setTestSending(false); }
  };

  const handleSendPdf = async () => {
    setPdfSending(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const now = new Date().toLocaleString("ru-RU");
      const titles: Record<string, string> = {
        summary: "Сводный отчёт MarketPlan",
        analytics: "Аналитический отчёт MarketPlan",
        prd: "PRD MarketPlan",
      };

      // Build a quick summary PDF
      pdf.setFillColor(42, 36, 32);
      pdf.rect(0, 0, 210, 45, "F");
      pdf.setTextColor(212, 163, 115);
      pdf.setFontSize(22);
      pdf.text(titles[pdfType], 20, 28);
      pdf.setFontSize(10);
      pdf.setTextColor(180, 170, 160);
      pdf.text(now, 20, 38);

      pdf.setTextColor(40, 40, 40);
      pdf.setFontSize(12);
      let y = 60;

      if (pdfType === "summary") {
        const items = [
          "Активные проекты: данные из MarketPlan",
          "Бюджет: в рамках плановых показателей",
          "Контент-план: публикации по графику",
          "A/B тесты: идут по расписанию",
          "Конкурентный анализ: обновлён",
          "",
          "Отчёт сгенерирован автоматически из MarketPlan.",
        ];
        items.forEach((line) => { pdf.text(line, 20, y); y += 8; });
      } else if (pdfType === "analytics") {
        const items = [
          "KPI: положительная динамика по основным метрикам",
          "ROI: выше средних показателей по рынку",
          "Каналы: лидирует Telegram и Instagram",
          "Воронка: конверсия из лида в клиента — стабильна",
          "Бюджет: 67% от запланированного освоено",
          "",
          "Подробная аналитика доступна в дашборде MarketPlan.",
        ];
        items.forEach((line) => { pdf.text(line, 20, y); y += 8; });
      } else {
        const items = [
          "MarketPlan — AI-маркетинг планер",
          "Модули: Проекты, Аналитика, SMM, Конкуренты, A/B, Медиа",
          "AI-инструменты: Метрики, Бюджет, ЦА, Триггеры",
          "Интеграции: OpenAI, Resend, Pipedream, Telegram, DALL-E",
          "Технологии: React, Tailwind, Supabase, Recharts",
          "",
          "Полная версия PRD доступна в MarketPlan → PRD.",
        ];
        items.forEach((line) => { pdf.text(line, 20, y); y += 8; });
      }

      // Convert to base64
      const pdfBase64 = pdf.output("datauristring").split(",")[1];
      const filename = `MarketPlan-${pdfType}-${new Date().toISOString().slice(0, 10)}.pdf`;

      await sendTelegramDocument(pdfBase64, filename, `📊 ${titles[pdfType]}\n${now}`);
      toast.success("PDF отправлен в Telegram!");
    } catch (err: any) {
      toast.error("Ошибка отправки PDF", { description: err.message });
    } finally { setPdfSending(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await deleteTelegramConfig();
    setDeleting(false);
    if (ok) {
      toast.success("Telegram бот отключён");
      setConfig(null);
      setBotToken("");
      setChatId("");
      setBotInfo(null);
      setStep("setup");
      onConfigUpdate();
    } else toast.error("Ошибка удаления");
  };

  if (!open) return null;

  return (
    <ModalOverlay onClose={onClose} label="Telegram Bot">
      <div className="bg-card border border-border rounded-xl w-full max-w-[560px] max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#d4a373]" />
            <h3 className="text-foreground font-medium text-[14px]">Telegram Bot</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted" aria-label="Закрыть"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="p-5 space-y-5">
          {step === "loading" && (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#d4a373]" /></div>
          )}

          {/* ─── SETUP WIZARD ─── */}
          {step === "setup" && (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-[13px] text-foreground font-medium flex items-center gap-2"><Bot className="w-4 h-4 text-[#d4a373]" /> Как подключить бота</p>
                <ol className="text-[12px] text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Откройте <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-[#d4a373] underline">@BotFather</a> в Telegram</li>
                  <li>Отправьте <code className="bg-muted px-1 rounded text-[11px]">/newbot</code> и следуйте инструкциям</li>
                  <li>Скопируйте полученный <strong>токен</strong> и вставьте ниже</li>
                  <li>Для Chat ID: напишите своему боту, затем откройте <code className="bg-muted px-1 rounded text-[11px]">https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code></li>
                  <li>Найдите <code className="bg-muted px-1 rounded text-[11px]">"chat":{"{"}"id":...</code> — это ваш Chat ID</li>
                </ol>
              </div>

              {/* Token */}
              <div>
                <label htmlFor="telegram-token" className="text-[12px] text-muted-foreground block mb-1.5">Токен бота</label>
                <div className="flex gap-2">
                  <input id="telegram-token" type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyz" className="flex-1 bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px] font-mono" />
                  <button onClick={handleVerify} disabled={verifying || !botToken.trim()} className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-md text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50 shrink-0">
                    {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Проверить
                  </button>
                </div>
              </div>

              {/* Verified bot info */}
              {botInfo && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-[13px] text-foreground font-medium">@{botInfo.botUsername}</p>
                    <p className="text-[11px] text-muted-foreground">{botInfo.firstName}</p>
                  </div>
                </div>
              )}

              {/* Chat ID */}
              <div>
                <label htmlFor="telegram-chatid" className="text-[12px] text-muted-foreground block mb-1.5">Chat ID</label>
                <input id="telegram-chatid" type="text" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Ваш числовой Chat ID, например: 123456789" className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px] font-mono" />
              </div>

              <button onClick={handleSave} disabled={saving || !botToken.trim() || !chatId.trim()} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#d4a373] text-white rounded-md text-[13px] font-medium hover:opacity-90 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? "Сохранение..." : "Подключить бота"}
              </button>
            </>
          )}

          {/* ─── CONNECTED ─── */}
          {step === "connected" && config && (
            <>
              {/* Status */}
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground font-medium">
                    {config.botUsername ? `@${config.botUsername}` : "Бот подключён"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Chat ID: {config.chatId} · Токен: {config.tokenPrefix}
                  </p>
                </div>
              </div>

              {/* Test Message */}
              <div>
                <p className="text-[12px] text-muted-foreground mb-2">Тестовое сообщение</p>
                <button onClick={handleTestMessage} disabled={testSending} className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-md text-[12px] text-foreground hover:bg-muted/80 disabled:opacity-50">
                  {testSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {testSending ? "Отправка..." : "Отправить тест"}
                </button>
              </div>

              {/* Send PDF */}
              <div className="border-t border-border pt-4">
                <p className="text-[13px] text-foreground font-medium flex items-center gap-2 mb-3">
                  <FileDown className="w-4 h-4 text-[#d4a373]" /> Отправить PDF-отчёт в Telegram
                </p>
                <div className="flex gap-2 mb-3">
                  {(["summary", "analytics", "prd"] as const).map((t) => (
                    <button key={t} onClick={() => setPdfType(t)} className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${pdfType === t ? "bg-[#d4a373]/15 text-[#d4a373] border border-[#d4a373]/30" : "bg-muted text-muted-foreground border border-transparent"}`}>
                      {{ summary: "Сводный", analytics: "Аналитика", prd: "PRD" }[t]}
                    </button>
                  ))}
                </div>
                <button onClick={handleSendPdf} disabled={pdfSending} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#d4a373] text-white rounded-md text-[13px] font-medium hover:opacity-90 disabled:opacity-50">
                  {pdfSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                  {pdfSending ? "Генерация и отправка..." : "Отправить PDF в Telegram"}
                </button>
              </div>

              {/* Disconnect */}
              <div className="border-t border-border pt-4">
                <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-500/10 rounded-md text-[12px] transition-colors">
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Отключить бота
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground rounded-md">Закрыть</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ===================================
   Main Integrations Hub
   =================================== */
export function IntegrationsHub() {
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ connected: boolean } | null>(null);
  const [dalleStatus, setDalleStatus] = useState<{ connected: boolean } | null>(null);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { canUse, increment, getUsage, checkAndWarn } = useUsage();

  // Modals
  const [emailOpen, setEmailOpen] = useState(false);
  const [dalleOpen, setDalleOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);

  // Notion / Amplitude config
  const [notionDb, setNotionDb] = useState("");
  const [amplitudeKey, setAmplitudeKey] = useState("");
  const [savingNotion, setSavingNotion] = useState(false);
  const [savingAmplitude, setSavingAmplitude] = useState(false);

  // Google Sheets config
  const [sheetsId, setSheetsId] = useState("");
  const [savingSheets, setSavingSheets] = useState(false);

  const loadAll = async () => {
    const [s, ai, em, dl, tg] = await Promise.all([
      getIntegrationsStatus(),
      checkAIStatus(),
      checkEmailStatus(),
      checkDALLEStatus(),
      getTelegramConfig(),
    ]);
    setStatus(s);
    setAiStatus(ai);
    setEmailStatus(em);
    setDalleStatus(dl);
    setTelegramConfig(tg);
    if (s?.notion?.config?.databaseId) setNotionDb(s.notion.config.databaseId);
    if (s?.amplitude?.config?.apiKey) setAmplitudeKey(s.amplitude.config.apiKey);
    if (s?.googleSheets?.config?.spreadsheetId) setSheetsId(s.googleSheets.config.spreadsheetId);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); toast.success("Обновлено"); };
  const handleSaveNotion = async () => {
    if (notionDb && !canUse("integrations")) {
      toast.error("Лимит интеграций исчерпан. Обновите план.");
      checkAndWarn("integrations");
      return;
    }
    setSavingNotion(true);
    const ok = await saveIntegrationConfig({ notion: { connected: !!notionDb, databaseId: notionDb, syncedAt: new Date().toISOString() } });
    setSavingNotion(false);
    if (ok) {
      if (notionDb) await increment("integrations");
      toast.success("Notion сохранён");
    } else {
      toast.error("Ошибка");
    }
    loadAll();
  };
  const handleSaveAmplitude = async () => {
    if (amplitudeKey && !canUse("integrations")) {
      toast.error("Лимит интеграций исчерпан. Обновите план.");
      checkAndWarn("integrations");
      return;
    }
    setSavingAmplitude(true);
    const ok = await saveIntegrationConfig({ amplitude: { connected: !!amplitudeKey, apiKey: amplitudeKey, syncedAt: new Date().toISOString() } });
    setSavingAmplitude(false);
    if (ok) {
      if (amplitudeKey) await increment("integrations");
      toast.success("Amplitude сохранён");
    } else {
      toast.error("Ошибка");
    }
    loadAll();
  };
  const handleSaveSheets = async () => {
    if (sheetsId && !canUse("integrations")) {
      toast.error("Лимит интеграций исчерпан. Обновите план.");
      checkAndWarn("integrations");
      return;
    }
    setSavingSheets(true);
    const ok = await saveIntegrationConfig({ googleSheets: { connected: !!sheetsId, spreadsheetId: sheetsId, syncedAt: new Date().toISOString() } });
    setSavingSheets(false);
    if (ok) {
      if (sheetsId) await increment("integrations");
      toast.success("Google Sheets сохранён");
    } else {
      toast.error("Ошибка");
    }
    loadAll();
  };
  const handleTestWebhook = async () => { const ok = await testWebhook("Test from Integrations Hub"); ok ? toast.success("Webhook отправлен") : toast.error("Ошибка"); };

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><Loader2 className="w-5 h-5 text-[#d4a373] animate-spin" /></div>;

  const integrations = [
    {
      id: "telegram", name: "Telegram Bot", icon: MessageCircle,
      description: "Отправка PDF-отчётов (брендбук, аналитика, PRD) прямо в ваш Telegram",
      color: "bg-sky-500/10 text-sky-600", connected: !!telegramConfig?.configured,
      actions: [{ label: telegramConfig?.configured ? "Управление" : "Подключить", onClick: () => setTelegramOpen(true), icon: telegramConfig?.configured ? Settings2 : Bot }],
      features: ["Создайте бота через @BotFather", "Отправка PDF одной кнопкой", "Сводный / Аналитика / PRD", "Тест-сообщения"],
    },
    {
      id: "resend", name: "Resend Email", icon: Mail,
      description: "Отправка отчётов, брендбуков, аналитики на email",
      color: "bg-emerald-500/10 text-emerald-600", connected: emailStatus?.connected ?? false,
      actions: [{ label: "Отправить email", onClick: () => setEmailOpen(true), icon: Send }],
      features: ["Шаблоны (Аналитика, PRD, Брендбук)", "HTML-форматирование"],
    },
    {
      id: "dalle", name: "DALL-E 3", icon: ImagePlus,
      description: "AI-генерация изображений для контент-плана и медиабиблиотеки",
      color: "bg-teal-500/10 text-teal-600", connected: dalleStatus?.connected ?? false,
      actions: [{ label: "Генерировать", onClick: () => setDalleOpen(true), icon: Sparkles }],
      features: ["3 размера", "2 стиля (vivid, natural)", "Промпт-шаблоны"],
    },
    {
      id: "pipedream", name: "Pipedream Webhooks", icon: Webhook,
      description: "Автоматизации: Telegram/Slack-уведомления, Google Sheets",
      color: "bg-orange-500/10 text-orange-600", connected: true,
      actions: [{ label: "Webhook Builder", onClick: () => setWebhookOpen(true), icon: Settings2 }, { label: "Тест", onClick: handleTestWebhook, icon: Zap }],
      features: ["Пресеты событий", "Произвольный JSON", "История отправок"],
    },
    {
      id: "notion", name: "Notion", icon: FileText,
      description: "Двусторонняя синхронизация проектов и контент-планов",
      color: "bg-gray-500/10 text-gray-600", connected: status?.notion?.connected ?? false, actions: [],
      features: ["Синхронизация в Notion Database", "Экспорт контент-плана"],
      config: (
        <div className="mt-3 space-y-2">
          <label className="text-[12px] text-muted-foreground block">Database ID</label>
          <div className="flex gap-2">
            <input type="text" value={notionDb} onChange={(e) => setNotionDb(e.target.value)} placeholder="Notion Database ID" className="flex-1 bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px] font-mono" />
            <button onClick={handleSaveNotion} disabled={savingNotion} className="flex items-center gap-1.5 px-3 py-2 bg-[#d4a373] text-white rounded-md text-[12px] font-medium hover:opacity-90 disabled:opacity-50">{savingNotion ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}OK</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Подключите MCP-сервер Notion или укажите Database ID для webhook-синхронизации.</p>
        </div>
      ),
    },
    {
      id: "amplitude", name: "Amplitude", icon: BarChart3,
      description: "Импорт продуктовой аналитики в дашборд",
      color: "bg-amber-500/10 text-amber-600", connected: status?.amplitude?.connected ?? false, actions: [],
      features: ["Импорт событий", "Сегменты", "Воронки"],
      config: (
        <div className="mt-3 space-y-2">
          <label className="text-[12px] text-muted-foreground block">API Key</label>
          <div className="flex gap-2">
            <input type="password" value={amplitudeKey} onChange={(e) => setAmplitudeKey(e.target.value)} placeholder="Amplitude API Key" className="flex-1 bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px] font-mono" />
            <button onClick={handleSaveAmplitude} disabled={savingAmplitude} className="flex items-center gap-1.5 px-3 py-2 bg-[#d4a373] text-white rounded-md text-[12px] font-medium hover:opacity-90 disabled:opacity-50">{savingAmplitude ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}OK</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Подключите MCP-сервер Amplitude или укажите API Key.</p>
        </div>
      ),
    },
    {
      id: "gsheets", name: "Google Sheets", icon: Table2,
      description: "Экспорт контент-планов, метрик и отчётов в Google Таблицы",
      color: "bg-green-500/10 text-green-600", connected: status?.googleSheets?.connected ?? false, actions: [],
      features: ["Экспорт контент-плана", "Метрики и KPI", "Бюджеты и отчёты", "Google OAuth"],
      config: (
        <div className="mt-3 space-y-2">
          <label className="text-[12px] text-muted-foreground block">Spreadsheet ID</label>
          <div className="flex gap-2">
            <input type="text" value={sheetsId} onChange={(e) => setSheetsId(e.target.value)} placeholder="ID из URL таблицы: docs.google.com/spreadsheets/d/{ID}" className="flex-1 bg-muted border-0 rounded-md px-3 py-2 text-foreground text-[13px] font-mono" />
            <button onClick={handleSaveSheets} disabled={savingSheets} className="flex items-center gap-1.5 px-3 py-2 bg-[#d4a373] text-white rounded-md text-[12px] font-medium hover:opacity-90 disabled:opacity-50">{savingSheets ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}OK</button>
          </div>
          <p className="text-[11px] text-muted-foreground">Укажите Spreadsheet ID из URL вашей Google Таблицы. Google OAuth уже настроен через GOOGLE_CLIENT_ID.</p>
        </div>
      ),
    },
  ];

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div className="p-5 max-w-[900px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-3"><Plug className="w-6 h-6" /> Интеграции</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">{connectedCount} из {integrations.length} подключено</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-md text-[12px] text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Обновить
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Активных", count: connectedCount, color: "bg-emerald-500" },
          { label: "Ожидают", count: integrations.length - connectedCount, color: "bg-amber-500" },
          { label: "Всего", count: integrations.length, color: "bg-[#d4a373]" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1"><div className={`w-2 h-2 rounded-full ${s.color}`} /><span className="text-[12px] text-muted-foreground">{s.label}</span></div>
            <span className="text-xl font-semibold text-foreground">{s.count}</span>
          </div>
        ))}
      </div>

      {/* Usage meter for integrations */}
      <div className="bg-card border border-border rounded-lg p-4">
        <UsageMeter usageKey="integrations" label="Лимит интеграций" variant="card" />
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {integrations.map((intg) => (
          <div key={intg.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${intg.color}`}><intg.icon className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-foreground font-medium text-[14px]">{intg.name}</h3>
                  {intg.connected
                    ? <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-[11px] font-medium"><CheckCircle2 className="w-3 h-3" /> Подключено</span>
                    : <span className="flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground rounded text-[11px] font-medium">Не настроено</span>}
                </div>
                <p className="text-muted-foreground text-[12px] mt-0.5">{intg.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{intg.features.map((f, i) => (<span key={`${intg.id}-f-${i}`} className="px-2 py-0.5 rounded text-[11px] bg-muted text-muted-foreground">{f}</span>))}</div>
                {intg.actions.length > 0 && (
                  <div className="mt-3 flex gap-2">{intg.actions.map((a, i) => (
                    <button key={`${intg.id}-a-${i}`} onClick={a.onClick} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4a373]/10 text-[#d4a373] border border-[#d4a373]/20 rounded-md text-[12px] font-medium hover:bg-[#d4a373]/20 transition-colors"><a.icon className="w-3.5 h-3.5" />{a.label}</button>
                  ))}</div>
                )}
                {"config" in intg && intg.config}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* OpenAI base */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Zap className="w-5 h-5 text-emerald-600" /></div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-foreground font-medium text-[14px]">OpenAI GPT-4o-mini</h3>
              {aiStatus?.connected
                ? <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-[11px] font-medium"><CheckCircle2 className="w-3 h-3" /> Подключено</span>
                : <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[11px] font-medium"><XCircle className="w-3 h-3" /> Ошибка</span>}
            </div>
            <p className="text-muted-foreground text-[12px] mt-0.5">Базовая AI-модель для всех инструментов</p>
          </div>
          {aiStatus?.connected && <span className="text-[11px] text-muted-foreground font-mono">{aiStatus.keyPrefix}</span>}
        </div>
      </div>

      {/* MCP-Available External Services */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pt-2">
          <Globe className="w-5 h-5 text-[#d4a373]" />
          <div>
            <h2 className="text-foreground font-semibold text-[15px]">MCP-коннекторы</h2>
            <p className="text-muted-foreground text-[12px]">Подключите внешние сервисы через MCP (Model Context Protocol) для расширенной интеграции</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            { id: "notion-mcp", name: "Notion", icon: FileText, color: "bg-gray-500/10 text-gray-600", description: "Двусторонняя синхронизация проектов, контент-планов и баз знаний", features: ["Notion Database", "Экспорт контент-плана", "AI-доступ к данным", "Страницы и блоки"], url: "https://notion.so", connected: true },
            { id: "asana", name: "Asana", icon: ClipboardList, color: "bg-amber-500/10 text-amber-600", description: "Управление задачами и проектами", features: ["Синхронизация задач", "Проекты и спринты", "Статусы и дедлайны"], url: "https://asana.com", connected: false },
            { id: "monday", name: "Monday.com", icon: Kanban, color: "bg-amber-500/10 text-amber-600", description: "Work OS для маркетинговых команд", features: ["Доски и колонки", "Автоматизации", "Дашборды"], url: "https://monday.com", connected: false },
            { id: "atlassian", name: "Atlassian", icon: Layers, color: "bg-blue-500/10 text-blue-600", description: "Jira, Confluence — управление продуктом", features: ["Jira Issues", "Confluence Docs", "Спринты и бэклог"], url: "https://atlassian.com", connected: false },
            { id: "github", name: "GitHub", icon: GitBranch, color: "bg-gray-500/10 text-gray-600", description: "Репозитории, issues, CI/CD", features: ["Issues", "Pull Requests", "Actions"], url: "https://github.com", connected: false },
            { id: "linear", name: "Linear", icon: LayoutList, color: "bg-teal-500/10 text-teal-600", description: "Трекер задач для продуктовых команд", features: ["Issues и Projects", "Циклы", "Roadmap"], url: "https://linear.app", connected: false },
            { id: "box", name: "Box", icon: Box, color: "bg-sky-500/10 text-sky-600", description: "Облачное хранение и совместная работа", features: ["Файлы и папки", "Совместный доступ", "Версионирование"], url: "https://box.com", connected: false },
            { id: "dovetail", name: "Dovetail", icon: SearchIcon, color: "bg-emerald-500/10 text-emerald-600", description: "Исследования и аналитика пользователей", features: ["UX Research", "Заметки интервью", "Тематический анализ"], url: "https://dovetail.com", connected: false },
            { id: "zeroheight", name: "zeroheight", icon: PenTool, color: "bg-teal-500/10 text-teal-600", description: "Дизайн-система и документация", features: ["Стайлгайды", "Компоненты", "Токены"], url: "https://zeroheight.com", connected: false },
            { id: "airtable", name: "Airtable", icon: Table2, color: "bg-green-500/10 text-green-600", description: "Базы данных и автоматизация", features: ["Таблицы", "Формы", "Автоматизации"], url: "https://airtable.com", connected: false },
          ] as const).map((svc) => (
            <div key={svc.id} className={`bg-card border rounded-xl p-4 transition-colors ${svc.connected ? "border-emerald-500/40 bg-emerald-500/[0.03] shadow-[0_0_0_1px_rgba(16,185,129,0.15)]" : "border-border hover:border-[#d4a373]/30"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${svc.connected ? "bg-emerald-500/15" : svc.color}`}>
                  {svc.connected ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <svc.icon className="w-4.5 h-4.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-foreground font-medium text-[13px]">{svc.name}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#d4a373]/10 text-[#d4a373] border border-[#d4a373]/20">MCP</span>
                    {svc.connected && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-500 rounded-full text-[11px] font-semibold border border-emerald-500/25"><CheckCircle2 className="w-3.5 h-3.5" /> Подключено</span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-0.5">{svc.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {svc.features.map((f, i) => (
                      <span key={`${svc.id}-f-${i}`} className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">{f}</span>
                    ))}
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <a
                      href={svc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 bg-muted rounded-md text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Сайт
                    </a>
                    {svc.connected ? (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 rounded-md text-[11px] text-emerald-500 font-medium border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Активно
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-[#d4a373]/8 rounded-md text-[11px] text-[#d4a373]/80">
                        <Plug className="w-3 h-3" /> Готов к подключению
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <p className="text-[12px] text-muted-foreground">
            <strong className="text-foreground">Как подключить MCP-сервис:</strong> Перейдите в настройки Figma Make, найдите нужный сервис в списке MCP-серверов и авторизуйтесь. После подключения данные из сервиса станут доступны AI-ассистенту MarketPlan для анализа, синхронизации и автоматизации рабочих процессов.
          </p>
        </div>
      </div>

      {/* Modals */}
      <EmailModal open={emailOpen} onClose={() => setEmailOpen(false)} />
      <DalleModal open={dalleOpen} onClose={() => setDalleOpen(false)} />
      <WebhookModal open={webhookOpen} onClose={() => setWebhookOpen(false)} />
      <TelegramModal open={telegramOpen} onClose={() => setTelegramOpen(false)} onConfigUpdate={loadAll} />
    </div>
  );
}