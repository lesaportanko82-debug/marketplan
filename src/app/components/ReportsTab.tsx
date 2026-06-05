import { useState, useRef, useCallback, useEffect } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  Users,
  BarChart3,
  Megaphone,
  CheckCircle2,
  RefreshCw,
  Eye,
  Share2,
  Link2,
  Mail,
  Copy,
  X,
  MessageCircle,
  UserPlus,
  Lock,
  Globe,
} from "lucide-react";
import type { Project } from "../data/mock-data";
import { useModal } from "../hooks/useModal";
import { ModalOverlay } from "./ModalOverlay";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

const reportTypes = [
  { id: "monthly", label: "Ежемесячный отчёт", icon: Calendar },
  { id: "campaign", label: "Отчёт по кампаниям", icon: Megaphone },
  { id: "audience", label: "Анализ аудитории", icon: Users },
  { id: "budget", label: "Финансовый отчёт", icon: DollarSign },
];

export function ReportsTab({ project }: { project: Project }) {
  const [selectedReport, setSelectedReport] = useState("monthly");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const generateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    setGenerated(false);
    if (generateTimerRef.current) clearTimeout(generateTimerRef.current);
    generateTimerRef.current = setTimeout(() => {
      setIsGenerating(false);
      setGenerated(true);
      toast.success("Отчёт сгенерирован", {
        description: reportTypes.find((t) => t.id === selectedReport)?.label,
      });
    }, 2000);
  };

  // Cleanup generate timer on unmount
  useEffect(() => {
    return () => { if (generateTimerRef.current) clearTimeout(generateTimerRef.current); };
  }, []);

  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    try {
      // Clone the report content and remove charts to avoid oklab color issues
      const clone = reportRef.current.cloneNode(true) as HTMLElement;
      
      // Remove all recharts containers which may contain oklab colors
      const chartsContainers = clone.querySelectorAll('.recharts-wrapper, [class*="recharts"]');
      chartsContainers.forEach(el => {
        const parent = el.parentElement;
        if (parent) {
          const notice = document.createElement('div');
          notice.style.cssText = 'padding: 2rem; text-align: center; color: #666; background: #f5f5f5; border-radius: 8px; font-size: 14px;';
          notice.textContent = '📊 График доступен в веб-версии';
          parent.replaceChild(notice, el);
        }
      });

      // Create a temporary container
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position: absolute; left: -9999px; top: 0; background: white; padding: 40px;';
      document.body.appendChild(tempContainer);
      tempContainer.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      // Clean up
      document.body.removeChild(tempContainer);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Calculate scaling to fit page
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      // Add pages as needed
      let heightLeft = scaledHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, scaledHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - scaledHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
      }

      const reportName = reportTypes.find((t) => t.id === selectedReport)?.label || "Report";
      pdf.save(`${reportName} - ${project.name}.pdf`);
      toast.success("PDF экспортирован", {
        description: `${reportName} - ${project.name}`,
      });
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Ошибка экспорта PDF", {
        description: "Попробуйте упростить отчет или обратитесь в поддержку",
      });
    } finally {
      setIsExporting(false);
    }
  }, [selectedReport, project.name]);

  const totalSpent = project.campaigns.reduce((s, c) => s + c.spent, 0);
  const totalConversions = project.campaigns.reduce(
    (s, c) => s + c.conversions,
    0
  );
  const totalImpressions = project.campaigns.reduce(
    (s, c) => s + c.impressions,
    0
  );
  const avgROI =
    project.campaigns.filter((c) => c.roi > 0).reduce((s, c) => s + c.roi, 0) /
    (project.campaigns.filter((c) => c.roi > 0).length || 1);

  const formatNum = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}M`
      : n >= 1000
      ? `${Math.round(n / 1000)}K`
      : n.toString();

  const monthlyTrend = [
    { id: "jan", month: "Янв", conversions: 1200, spend: 180, leads: 3200 },
    { id: "feb", month: "Фев", conversions: 1800, spend: 280, leads: 4800 },
    { id: "mar", month: "Мар", conversions: 2400, spend: 350, leads: 5600 },
    { id: "apr", month: "Апр", conversions: 2100, spend: 220, leads: 4200 },
    { id: "may", month: "Май", conversions: 3100, spend: 310, leads: 6800 },
  ];

  const radarData = [
    { subject: "ROI", A: 78, fullMark: 100 },
    { subject: "Охват", A: 65, fullMark: 100 },
    { subject: "Конверсия", A: 82, fullMark: 100 },
    { subject: "CPA", A: 58, fullMark: 100 },
    { subject: "Retention", A: 45, fullMark: 100 },
    { subject: "Brand", A: 70, fullMark: 100 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-foreground">Генератор отчётов</h2>
          <p className="text-muted-foreground text-[14px] mt-1">
            Загрузите данные или используйте текущие для красивого отчёта
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-4 py-2.5 bg-muted rounded-lg text-[14px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
            <Download className="w-4 h-4" />
            Загрузить данные
            <input type="file" className="hidden" accept=".csv,.xlsx,.json" />
          </label>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isGenerating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {isGenerating ? "Генерация..." : "Сгенерировать отчёт"}
          </button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="flex gap-2 flex-wrap">
        {reportTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setSelectedReport(type.id);
              setGenerated(false);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] transition-colors ${
              selectedReport === type.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <type.icon className="w-4 h-4" />
            {type.label}
          </button>
        ))}
      </div>

      {/* Generated Report Preview */}
      {generated && (
        <div className="space-y-6">
          {/* Report Header with Actions */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 text-green-600 mb-3">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-[14px]">Отчёт сгенерирован</span>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-foreground">
                  {reportTypes.find((t) => t.id === selectedReport)?.label} -{" "}
                  {project.name}
                </h3>
                <p className="text-muted-foreground text-[13px] mt-1">
                  Период:{" "}
                  {new Date(project.startDate).toLocaleDateString("ru-RU")} -{" "}
                  {new Date().toLocaleDateString("ru-RU")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    showPreview
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  {showPreview ? "Скрыть превью" : "Предпросмотр"}
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-[13px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Поделиться
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isExporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isExporting ? "Экспорт..." : "Скачать PDF"}
                </button>
              </div>
            </div>
          </div>

          {/* PDF Preview Frame */}
          {showPreview && (
            <div className="border-2 border-dashed border-primary/30 rounded-xl p-2 bg-card">
              <div className="text-center text-[12px] text-muted-foreground mb-2 py-1 bg-muted/50 rounded">
                Предпросмотр PDF - так будет выглядеть экспортированный документ
              </div>
            </div>
          )}

          {/* Report Content (captured for PDF) */}
          <div ref={reportRef} className={showPreview ? "bg-white p-6 rounded-xl shadow-lg" : ""}>
            {/* Executive Summary */}
            <div className={`${showPreview ? "" : "bg-card border border-border"} rounded-xl p-6`}>
              <h3 className="text-foreground mb-4">Executive Summary</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-accent/30 rounded-lg p-4">
                  <p className="text-[12px] text-muted-foreground mb-1">
                    Расходы
                  </p>
                  <p className="text-[22px] text-foreground">
                    {formatNum(totalSpent)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {project.totalBudget > 0 ? Math.round((totalSpent / project.totalBudget) * 100) : 0}%
                    бюджета
                  </p>
                </div>
                <div className="bg-accent/30 rounded-lg p-4">
                  <p className="text-[12px] text-muted-foreground mb-1">
                    Конверсии
                  </p>
                  <p className="text-[22px] text-foreground">
                    {formatNum(totalConversions)}
                  </p>
                </div>
                <div className="bg-accent/30 rounded-lg p-4">
                  <p className="text-[12px] text-muted-foreground mb-1">
                    Охват
                  </p>
                  <p className="text-[22px] text-foreground">
                    {formatNum(totalImpressions)}
                  </p>
                </div>
                <div className="bg-accent/30 rounded-lg p-4">
                  <p className="text-[12px] text-muted-foreground mb-1">
                    Средний ROI
                  </p>
                  <p className="text-[22px] text-green-600">
                    {Math.round(avgROI)}%
                  </p>
                </div>
              </div>
              <p className="text-foreground/80 text-[14px] leading-relaxed">
                За отчётный период проект "{project.name}" продемонстрировал{" "}
                {avgROI > 200 ? "сильные" : "умеренные"} результаты. Общий
                бюджет использован на{" "}
                {project.totalBudget > 0 ? Math.round((totalSpent / project.totalBudget) * 100) : 0}%, при
                этом средний ROI составил {Math.round(avgROI)}%. Наиболее
                эффективным каналом по конверсиям является{" "}
                {
                  project.campaigns.length > 0
                    ? project.campaigns.reduce((best, c) =>
                        c.conversions > best.conversions ? c : best
                      ).channel
                    : "-"
                }
                . Рекомендуется{" "}
                {avgROI > 200
                  ? "увеличить бюджет на высокоэффективные каналы"
                  : "оптимизировать распределение бюджета"}
                .
              </p>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
              <div className={`${showPreview ? "" : "bg-card border border-border"} rounded-xl p-5`}>
                <h3 className="text-foreground mb-4">Динамика конверсий</h3>
                <div suppressHydrationWarning>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={monthlyTrend}>
                      <defs>
                        <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{
                          fontSize: 12,
                          fill: "var(--muted-foreground)",
                        }}
                      />
                      <YAxis
                        tick={{
                          fontSize: 12,
                          fill: "var(--muted-foreground)",
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 13,
                        }}
                      />
                      <Area
                        key="area-conversions"
                        type="monotone"
                        dataKey="conversions"
                        name="Конверсии"
                        stroke="var(--chart-1)"
                        fill="url(#colorConversions)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                      <Area
                        key="area-leads"
                        type="monotone"
                        dataKey="leads"
                        name="Лиды"
                        stroke="var(--chart-2)"
                        fill="url(#colorLeads)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`${showPreview ? "" : "bg-card border border-border"} rounded-xl p-5`}>
                <h3 className="text-foreground mb-4">
                  Эффективность маркетинга
                </h3>
                <div suppressHydrationWarning>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={radarData} layout="horizontal">
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="subject"
                        tick={{
                          fontSize: 12,
                          fill: "var(--muted-foreground)",
                        }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{
                          fontSize: 12,
                          fill: "var(--muted-foreground)",
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 13,
                        }}
                      />
                      <Bar
                        key="bar-effectiveness"
                        dataKey="A"
                        name="Показатель"
                        fill="var(--chart-1)"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Campaign Breakdown */}
            <div className={`${showPreview ? "" : "bg-card border border-border"} rounded-xl p-6 mt-6`}>
              <h3 className="text-foreground mb-4">Детализация по кампаниям</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 text-muted-foreground text-[12px]">
                        Кампания
                      </th>
                      <th className="text-left py-2.5 px-3 text-muted-foreground text-[12px]">
                        Канал
                      </th>
                      <th className="text-right py-2.5 px-3 text-muted-foreground text-[12px]">
                        Расход
                      </th>
                      <th className="text-right py-2.5 px-3 text-muted-foreground text-[12px]">
                        Показы
                      </th>
                      <th className="text-right py-2.5 px-3 text-muted-foreground text-[12px]">
                        Клики
                      </th>
                      <th className="text-right py-2.5 px-3 text-muted-foreground text-[12px]">
                        CTR
                      </th>
                      <th className="text-right py-2.5 px-3 text-muted-foreground text-[12px]">
                        Конверсии
                      </th>
                      <th className="text-right py-2.5 px-3 text-muted-foreground text-[12px]">
                        CPA
                      </th>
                      <th className="text-right py-2.5 px-3 text-muted-foreground text-[12px]">
                        ROI
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.campaigns.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2.5 px-3 text-foreground">
                          {c.name}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {c.channel}
                        </td>
                        <td className="py-2.5 px-3 text-right text-foreground">
                          {formatNum(c.spent)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {formatNum(c.impressions)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {formatNum(c.clicks)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {c.impressions > 0
                            ? ((c.clicks / c.impressions) * 100).toFixed(1)
                            : "0"}
                          %
                        </td>
                        <td className="py-2.5 px-3 text-right text-foreground">
                          {c.conversions.toLocaleString("ru-RU")}
                        </td>
                        <td className="py-2.5 px-3 text-right text-foreground">
                          {c.cpa > 0 ? `${c.cpa}` : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {c.roi > 0 ? (
                            <span className="text-green-600">{c.roi}%</span>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-gradient-to-r from-green-500/5 to-teal-500/5 border border-green-500/20 rounded-xl p-6 mt-6">
              <h3 className="text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Рекомендации
              </h3>
              <div className="space-y-3 text-[14px]">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-[12px] shrink-0">
                    1
                  </span>
                  <p className="text-foreground/80">
                    Перераспределить 15% бюджета с менее эффективных каналов на{" "}
                    {
                      project.campaigns.length > 0
                        ? project.campaigns.reduce((best, c) =>
                            c.roi > best.roi ? c : best
                          ).channel
                        : "лидирующий канал"
                    }{" "}
                    для максимизации ROI
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-[12px] shrink-0">
                    2
                  </span>
                  <p className="text-foreground/80">
                    Увеличить частоту A/B тестирования креативов для снижения CPA
                    на 10-15%
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-[12px] shrink-0">
                    3
                  </span>
                  <p className="text-foreground/80">
                    Запустить ретаргетинговые кампании для увеличения Retention
                    Rate с{" "}
                    {project.metrics.find((m) => m.name.includes("Retention"))
                      ?.value || 28}
                    % до{" "}
                    {project.metrics.find((m) => m.name.includes("Retention"))
                      ?.target || 40}
                    %
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when not generated */}
      {!generated && !isGenerating && (
        <div className="bg-card border border-border border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-foreground mb-2">Отчёт ещё не сгенерирован</h3>
          <p className="text-muted-foreground text-[14px] max-w-md">
            Выберите тип отчёта и нажмите "Сгенерировать отчёт" или загрузите
            свои данные в формате CSV/XLSX/JSON
          </p>
        </div>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-10 h-10 text-primary animate-spin mb-4" />
          <h3 className="text-foreground mb-2">Генерация отчёта...</h3>
          <p className="text-muted-foreground text-[14px]">
            Анализируем данные и формируем визуализации
          </p>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          project={project}
          reportType={
            reportTypes.find((t) => t.id === selectedReport)?.label || ""
          }
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

function ShareModal({
  project,
  reportType,
  onClose,
}: {
  project: Project;
  reportType: string;
  onClose: () => void;
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [access, setAccess] = useState<"private" | "link">("private");
  const [sharedWith, setSharedWith] = useState([
    {
      email: "anna@company.com",
      name: "Анна К.",
      role: "view" as const,
      avatar: "A",
    },
    {
      email: "dmitry@company.com",
      name: "Дмитрий П.",
      role: "edit" as const,
      avatar: "D",
    },
  ]);

  const shareLink = `https://marketplan.app/shared/rpt-${project.id}-${Date.now().toString(36)}`;

  const handleCopyLink = () => {
    copyToClipboard(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleInvite = () => {
    if (!email.trim()) return;
    setSharedWith((prev) => [
      ...prev,
      {
        email,
        name: email.split("@")[0],
        role: permission,
        avatar: email[0].toUpperCase(),
      },
    ]);
    setEmail("");
  };

  const handleRemove = (emailToRemove: string) => {
    setSharedWith((prev) => prev.filter((p) => p.email !== emailToRemove));
  };

  return (
    <ModalOverlay onClose={onClose} label="Поделиться отчётом">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-foreground flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Поделиться отчётом
            </h3>
            <p className="text-muted-foreground text-[13px] mt-0.5">
              {reportType} - {project.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Access Type */}
          <div>
            <label className="text-[13px] text-muted-foreground block mb-2">
              Доступ
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setAccess("private")}
                className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                  access === "private"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Lock className="w-4 h-4" />
                Только по приглашению
              </button>
              <button
                onClick={() => setAccess("link")}
                className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                  access === "link"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe className="w-4 h-4" />
                Доступ по ссылке
              </button>
            </div>
          </div>

          {/* Share Link */}
          {access === "link" && (
            <div>
              <label className="text-[13px] text-muted-foreground block mb-2">
                Ссылка для доступа
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted rounded-lg px-3 py-2.5 text-[13px] text-foreground truncate">
                  {shareLink}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-[13px] hover:opacity-90 transition-opacity shrink-0"
                >
                  {linkCopied ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {linkCopied ? "Скопировано!" : "Копировать"}
                </button>
              </div>
            </div>
          )}

          {/* Invite by email */}
          <div>
            <label className="text-[13px] text-muted-foreground block mb-2">
              Пригласить по email
            </label>
            <div className="flex gap-2">
              <div className="flex-1 flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@company.com"
                  className="flex-1 bg-muted border-0 rounded-lg px-3 py-2.5 text-foreground text-[13px] placeholder:text-muted-foreground"
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                />
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as any)}
                  className="bg-muted border-0 rounded-lg px-2 py-2.5 text-foreground text-[13px]"
                >
                  <option value="view">Просмотр</option>
                  <option value="edit">Редакт.</option>
                </select>
              </div>
              <button
                onClick={handleInvite}
                disabled={!email.trim()}
                className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg text-[13px] hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Shared With List */}
          {sharedWith.length > 0 && (
            <div>
              <label className="text-[13px] text-muted-foreground block mb-2">
                Участники ({sharedWith.length})
              </label>
              <div className="space-y-2">
                {sharedWith.map((person) => (
                  <div
                    key={person.email}
                    className="flex items-center gap-3 py-2 px-3 bg-accent/30 rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[13px] shrink-0">
                      {person.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-[13px] truncate">
                        {person.name}
                      </p>
                      <p className="text-muted-foreground text-[11px] truncate">
                        {person.email}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        person.role === "edit"
                          ? "bg-teal-500/10 text-teal-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {person.role === "edit" ? "Редакт." : "Просмотр"}
                    </span>
                    <button
                      onClick={() => handleRemove(person.email)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Share */}
          <div>
            <label className="text-[13px] text-muted-foreground block mb-2">
              Быстро отправить
            </label>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-4 py-2.5 bg-muted rounded-lg text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-muted rounded-lg text-[13px] text-muted-foreground hover:text-foreground transition-colors">
                <MessageCircle className="w-4 h-4" />
                Telegram
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 px-4 py-2.5 bg-muted rounded-lg text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Ссылка
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-muted rounded-lg text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Закрыть
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] hover:opacity-90 transition-opacity"
          >
            Готово
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}