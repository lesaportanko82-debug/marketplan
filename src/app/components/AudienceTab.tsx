import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Users,
  User,
  MapPin,
  Briefcase,
  Heart,
  AlertTriangle,
  Target,
  MessageCircle,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Zap,
  RefreshCw,
} from "lucide-react";
import type { Project, AudienceSegment, AudienceAvatar } from "../data/mock-data";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";

export function AudienceTab({ project }: { project: Project }) {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const generateTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const totalSize = project.audiences.reduce((s, a) => s + a.size, 0);

  const pieData = project.audiences.map((a) => ({
    id: a.id,
    name: a.name,
    value: a.percentage,
  }));

  const handleAIGenerate = () => {
    setIsGenerating(true);
    if (generateTimerRef.current) clearTimeout(generateTimerRef.current);
    generateTimerRef.current = setTimeout(() => {
      setIsGenerating(false);
      setShowAIPanel(true);
      toast.success("AI-анализ завершён", {
        description: "Рекомендации по сегментации обновлены",
      });
    }, 2000);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (generateTimerRef.current) clearTimeout(generateTimerRef.current); };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-foreground">Сегментация аудитории</h2>
          <p className="text-muted-foreground text-[14px] mt-1">
            AI-анализ целевой аудитории и проработка аватаров
          </p>
        </div>
        <button
          onClick={handleAIGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isGenerating ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isGenerating ? "Анализирую..." : "AI Сегментация"}
        </button>
      </div>

      {/* AI Insights Panel */}
      {showAIPanel && (
        <div className="bg-gradient-to-r from-emerald-600/5 to-teal-600/5 border border-emerald-600/20 rounded-xl p-4 md:p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-foreground mb-2">AI-рекомендации по аудитории</h3>
              <div className="space-y-3 text-[14px] text-foreground/80">
                <p>
                  <span className="text-emerald-700">Ключевой инсайт:</span> Сегмент
                  "{project.audiences[0]?.name}" показывает наибольший потенциал роста.
                  Рекомендуется увеличить инвестиции в этот сегмент на 20%.
                </p>
                <p>
                  <span className="text-emerald-700">Пересечение аудиторий:</span>{" "}
                  Обнаружено 15% пересечение между сегментами. Рекомендуется
                  исключить дублирование в таргетинге для оптимизации бюджета.
                </p>
                <p>
                  <span className="text-emerald-700">Новый сегмент:</span> На основе
                  поведенческих данных выявлен потенциальный сегмент "Early Adopters"
                  (~8K пользователей), который не покрыт текущими кампаниями.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-foreground mb-4">Распределение сегментов</h3>
          <div suppressHydrationWarning>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={3}
                  isAnimationActive={false}
                >
                  {project.audiences.map((a, i) => (
                    <Cell key={a.id} fill={a.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) => `${val}%`}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {project.audiences.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-foreground">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: a.color }}
                  />
                  {a.name}
                </span>
                <span className="text-muted-foreground">{a.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="w-4 h-4" />
              <span className="text-[13px]">Общий размер ЦА</span>
            </div>
            <p className="text-[28px] text-foreground">{totalSize.toLocaleString("ru-RU")}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Target className="w-4 h-4" />
              <span className="text-[13px]">Сегментов</span>
            </div>
            <p className="text-[28px] text-foreground">{project.audiences.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <User className="w-4 h-4" />
              <span className="text-[13px]">Аватаров проработано</span>
            </div>
            <p className="text-[28px] text-foreground">
              {project.audiences.reduce((s, a) => s + a.avatars.length, 0)}
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Zap className="w-4 h-4" />
              <span className="text-[13px]">Покрытие</span>
            </div>
            <p className="text-[28px] text-foreground">
              {project.audiences.reduce((s, a) => s + a.percentage, 0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Segments */}
      <div className="space-y-4">
        {project.audiences.map((segment) => (
          <SegmentCard
            key={segment.id}
            segment={segment}
            isOpen={selectedSegment === segment.id}
            onToggle={() =>
              setSelectedSegment(
                selectedSegment === segment.id ? null : segment.id
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function SegmentCard({
  segment,
  isOpen,
  onToggle,
}: {
  segment: AudienceSegment;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: `${segment.color}15`, color: segment.color }}
          >
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-foreground">{segment.name}</h3>
            <p className="text-muted-foreground text-[13px] mt-0.5">
              {segment.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-foreground">{segment.size.toLocaleString("ru-RU")}</p>
            <p className="text-[12px] text-muted-foreground">{segment.percentage}% ЦА</p>
          </div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Avatars */}
      {isOpen && (
        <div className="border-t border-border p-5">
          <h4 className="text-foreground mb-4 flex items-center gap-2">
            <User className="w-4 h-4" />
            Аватары клиентов
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {segment.avatars.map((avatar) => (
              <AvatarCard key={avatar.id} avatar={avatar} color={segment.color} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AvatarCard({
  avatar,
  color,
}: {
  avatar: AudienceAvatar;
  color: string;
}) {
  return (
    <div className="border border-border rounded-xl p-5 bg-accent/10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[32px]">{avatar.emoji}</span>
        <div>
          <h4 className="text-foreground">
            {avatar.name}, {avatar.age} лет
          </h4>
          <p className="text-muted-foreground text-[13px]">
            {avatar.gender} · {avatar.location} · {avatar.income}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3 text-[13px]">
        <div className="flex items-start gap-2">
          <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <span className="text-muted-foreground">Профессия: </span>
            <span className="text-foreground">{avatar.occupation}</span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Heart className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <span className="text-muted-foreground">Интересы: </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {avatar.interests.map((i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-[11px]"
                  style={{ background: `${color}15`, color }}
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <span className="text-muted-foreground">Боли: </span>
            <ul className="mt-1 space-y-0.5">
              {avatar.painPoints.map((p) => (
                <li key={p} className="text-foreground">
                  · {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Target className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          <div>
            <span className="text-muted-foreground">Цели: </span>
            <ul className="mt-1 space-y-0.5">
              {avatar.goals.map((g) => (
                <li key={g} className="text-foreground">
                  · {g}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <span className="text-muted-foreground">Каналы: </span>
            <span className="text-foreground">{avatar.channels.join(", ")}</span>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <ShoppingCart className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <span className="text-muted-foreground">Покупательское поведение: </span>
            <span className="text-foreground">{avatar.buyingBehavior}</span>
          </div>
        </div>
      </div>
    </div>
  );
}