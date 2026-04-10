import { useState, useMemo, useCallback } from "react";
import {
  CalendarRange, ChevronLeft, ChevronRight,
  FileText, FlaskConical, Target, Megaphone, Users, X,
  Sparkles, AlertTriangle, CheckCircle2, Loader2,
  LayoutGrid, List, Search,
} from "lucide-react";
import { toast } from "sonner";
import { useKV } from "../lib/useKV";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths,
  subMonths, format, isSameMonth, isSameDay, isToday, parseISO,
  eachDayOfInterval, addWeeks, subWeeks,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Mascot } from "./Mascot";

/* ========== TYPES ========== */
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  module: ModuleType;
  color: string;
  icon: any;
  meta?: Record<string, string>;
  sourceKey?: string;
}

type ModuleType = "content" | "ab_test" | "okr" | "campaign" | "influencer" | "cjm";

const MODULE_CONFIG: Record<ModuleType, { label: string; color: string; bg: string; icon: any }> = {
  content:    { label: "Контент-план", color: "text-amber-600",    bg: "bg-amber-500/10 border-amber-500/30",    icon: FileText },
  ab_test:    { label: "A/B Тесты",   color: "text-teal-600",  bg: "bg-teal-600/10 border-teal-600/30",  icon: FlaskConical },
  okr:        { label: "OKR",          color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30", icon: Target },
  campaign:   { label: "Кампании",     color: "text-teal-500",     bg: "bg-teal-500/10 border-teal-500/30",     icon: Megaphone },
  influencer: { label: "Инфлюенсеры", color: "text-amber-500",   bg: "bg-amber-500/10 border-amber-500/30",   icon: Users },
  cjm:        { label: "CJM",          color: "text-teal-500",    bg: "bg-teal-500/10 border-teal-500/30",    icon: Sparkles },
};

type ViewMode = "month" | "week";

/* ========== COMPONENT ========== */
export function MarketingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [visibleModules, setVisibleModules] = useState<Set<ModuleType>>(
    new Set(["content", "ab_test", "okr", "campaign", "influencer", "cjm"])
  );
  const [dragEvent, setDragEvent] = useState<CalendarEvent | null>(null);
  const [savingDrag, setSavingDrag] = useState(false);

  // Fetch data from all modules (with save for drag-and-drop persistence)
  const { data: contentPosts, save: saveContentPosts } = useKV<any[]>("smm_plan:posts", []);
  const { data: abTests, save: saveAbTests } = useKV<any[]>("ab_tests:list", []);
  const { data: okrObjectives } = useKV<any[]>("okr:objectives", []);
  const { data: projects, save: saveProjects } = useKV<any[]>("projects:list", []);
  const { data: influencers, save: saveInfluencers } = useKV<any[]>("influencers:list", []);

  // Build unified events
  const events: CalendarEvent[] = useMemo(() => {
    const evts: CalendarEvent[] = [];

    // Content plan posts
    if (contentPosts?.length) {
      contentPosts.forEach((p: any) => {
        if (!p.date) return;
        evts.push({
          id: `content-${p.id}`,
          title: p.topic || p.caption?.slice(0, 40) || "Пост",
          date: p.date,
          module: "content",
          color: "text-amber-600",
          icon: FileText,
          meta: {
            platforms: p.platforms?.join(", ") || "",
            status: p.status || "planned",
            type: p.type || "",
          },
        });
      });
    }

    // A/B Tests
    if (abTests?.length) {
      abTests.forEach((t: any) => {
        if (!t.startDate) return;
        evts.push({
          id: `ab-${t.id}`,
          title: t.name || "A/B Тест",
          date: t.startDate,
          endDate: t.endDate,
          module: "ab_test",
          color: "text-teal-600",
          icon: FlaskConical,
          meta: { status: t.status || "running", metric: t.metric || "" },
        });
      });
    }

    // OKR deadlines
    if (okrObjectives?.length) {
      okrObjectives.forEach((o: any) => {
        // Use quarter end as deadline
        const qMatch = o.quarter?.match(/Q(\d)\s+(\d{4})/);
        if (qMatch) {
          const q = parseInt(qMatch[1]);
          const y = parseInt(qMatch[2]);
          const endMonth = q * 3;
          const deadline = new Date(y, endMonth, 0); // last day of quarter
          evts.push({
            id: `okr-${o.id}`,
            title: o.title || "OKR",
            date: deadline.toISOString().slice(0, 10),
            module: "okr",
            color: "text-emerald-500",
            icon: Target,
            meta: {
              quarter: o.quarter || "",
              progress: o.keyResults?.length
                ? Math.round(o.keyResults.reduce((s: number, kr: any) => s + (kr.target > 0 ? (kr.current / kr.target) * 100 : 0), 0) / o.keyResults.length) + "%"
                : "0%",
            },
          });
        }
      });
    }

    // Campaigns from projects
    if (projects?.length) {
      projects.forEach((p: any) => {
        if (p.startDate) {
          evts.push({
            id: `campaign-${p.id}`,
            title: p.name || "Проект",
            date: p.startDate,
            endDate: p.endDate,
            module: "campaign",
            color: "text-teal-500",
            icon: Megaphone,
            meta: { budget: p.budget ? `${p.budget.toLocaleString("ru-RU")} RUB` : "", status: p.status || "" },
          });
        }
      });
    }

    // Influencer collaborations
    if (influencers?.length) {
      influencers.forEach((inf: any) => {
        if (inf.nextPost || inf.deadline) {
          evts.push({
            id: `inf-${inf.id}`,
            title: `${inf.name || "Инфлюенсер"}`,
            date: inf.nextPost || inf.deadline,
            module: "influencer",
            color: "text-amber-500",
            icon: Users,
            meta: { platform: inf.platform || "", followers: inf.followers || "" },
          });
        }
      });
    }

    return evts;
  }, [contentPosts, abTests, okrObjectives, projects, influencers]);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (!visibleModules.has(e.module)) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [events, visibleModules, search]);

  // Calendar grid days
  const calendarDays = useMemo(() => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calStart, end: calEnd });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  }, [currentDate, viewMode]);

  // Events for a given day
  const eventsForDay = useCallback(
    (day: Date) => {
      const dayStr = format(day, "yyyy-MM-dd");
      return filteredEvents.filter((e) => {
        const eDate = e.date?.slice(0, 10);
        if (eDate === dayStr) return true;
        // Range events (A/B tests, campaigns)
        if (e.endDate) {
          const start = e.date.slice(0, 10);
          const end = e.endDate.slice(0, 10);
          if (dayStr >= start && dayStr <= end) return true;
        }
        return false;
      });
    },
    [filteredEvents]
  );

  // Conflict detection
  const conflicts = useMemo(() => {
    const dayMap = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((e) => {
      const d = e.date?.slice(0, 10);
      if (!d) return;
      if (!dayMap.has(d)) dayMap.set(d, []);
      dayMap.get(d)!.push(e);
    });
    const result: { date: string; events: CalendarEvent[] }[] = [];
    dayMap.forEach((evts, date) => {
      if (evts.length >= 3) result.push({ date, events: evts });
    });
    return result;
  }, [filteredEvents]);

  const navigate = (dir: number) => {
    if (viewMode === "month") {
      setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else {
      setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    }
  };

  const goToday = () => setCurrentDate(new Date());

  const toggleModule = (m: ModuleType) => {
    setVisibleModules((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDragEvent(event);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = useCallback(async (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    if (!dragEvent || savingDrag) return;

    const newDate = format(day, "yyyy-MM-dd");
    const oldDate = dragEvent.date?.slice(0, 10);
    if (newDate === oldDate) { setDragEvent(null); return; }

    setSavingDrag(true);
    const eventTitle = dragEvent.title;
    const module = dragEvent.module;

    try {
      // Extract original item ID from event ID
      const rawId = dragEvent.id.replace(/^(content|ab|okr|campaign|inf)-/, "");

      if (module === "content") {
        const updated = contentPosts.map((p: any) =>
          p.id === rawId ? { ...p, date: newDate } : p
        );
        await saveContentPosts(updated);
      } else if (module === "ab_test") {
        const updated = abTests.map((t: any) => {
          if (t.id !== rawId) return t;
          // Shift endDate by the same delta
          const delta = new Date(newDate).getTime() - new Date(t.startDate).getTime();
          const newEnd = t.endDate ? format(new Date(new Date(t.endDate).getTime() + delta), "yyyy-MM-dd") : undefined;
          return { ...t, startDate: newDate, endDate: newEnd };
        });
        await saveAbTests(updated);
      } else if (module === "campaign") {
        const updated = projects.map((p: any) => {
          if (p.id !== rawId) return p;
          const delta = new Date(newDate).getTime() - new Date(p.startDate).getTime();
          const newEnd = p.endDate ? format(new Date(new Date(p.endDate).getTime() + delta), "yyyy-MM-dd") : undefined;
          return { ...p, startDate: newDate, endDate: newEnd };
        });
        await saveProjects(updated);
      } else if (module === "influencer") {
        const updated = influencers.map((inf: any) => {
          if (inf.id !== rawId) return inf;
          return { ...inf, nextPost: inf.nextPost ? newDate : inf.nextPost, deadline: inf.deadline ? newDate : inf.deadline };
        });
        await saveInfluencers(updated);
      } else {
        // OKR and CJM cannot be moved (quarter-based)
        toast.info("OKR/CJM события привязаны к кварталам и не перемещаются");
        setDragEvent(null);
        setSavingDrag(false);
        return;
      }

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>"{eventTitle}" перенесён на {format(day, "d MMM", { locale: ru })}</span>
        </div>,
        { description: `${MODULE_CONFIG[module].label}: дата сохранена в KV` }
      );
    } catch (err) {
      console.error("Calendar drag save error:", err);
      toast.error(`Ошибка сохранения: ${err}`);
    } finally {
      setDragEvent(null);
      setSavingDrag(false);
    }
  }, [dragEvent, savingDrag, contentPosts, abTests, projects, influencers, saveContentPosts, saveAbTests, saveProjects, saveInfluencers]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div className="p-6 space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-foreground flex items-center gap-2.5">
            <CalendarRange className="w-6 h-6 text-[#d4a373]" />
            Маркетинговый календарь
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1">
            Все события из {events.length} модулей на одной шкале
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-[12px] font-medium bg-[#d4a373]/10 text-[#d4a373] rounded-lg hover:bg-[#d4a373]/20 transition-colors"
          >
            Сегодня
          </button>
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                viewMode === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 inline mr-1" />Месяц
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                viewMode === "week" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-3.5 h-3.5 inline mr-1" />Неделя
            </button>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Module toggles */}
        {(Object.entries(MODULE_CONFIG) as [ModuleType, typeof MODULE_CONFIG[ModuleType]][]).map(([key, cfg]) => {
          const active = visibleModules.has(key);
          const count = events.filter((e) => e.module === key).length;
          return (
            <button
              key={key}
              onClick={() => toggleModule(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${
                active
                  ? `${cfg.bg} border-current`
                  : "bg-muted/50 text-muted-foreground border-transparent opacity-50"
              }`}
            >
              <cfg.icon className="w-3.5 h-3.5" />
              {cfg.label}
              {count > 0 && <span className="ml-1 text-[10px] opacity-70">({count})</span>}
            </button>
          );
        })}

        <div className="ml-auto relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск событий..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-[12px] bg-muted/50 border border-border rounded-lg w-48 focus:outline-none focus:ring-1 focus:ring-[#d4a373]/50 text-foreground"
          />
        </div>
      </div>

      {/* Conflicts warning */}
      {conflicts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-amber-600">Обнаружены конфликты расписания</p>
            <p className="text-[12px] text-amber-600/70 mt-0.5">
              {conflicts.map((c) => format(parseISO(c.date), "d MMM", { locale: ru })).join(", ")} - по 3+ событий в один день
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <h2 className="text-[16px] font-semibold text-foreground">
          {viewMode === "month"
            ? format(currentDate, "LLLL yyyy", { locale: ru })
            : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: ru })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: ru })}`
          }
        </h2>
        <button onClick={() => navigate(1)} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className={`grid grid-cols-7 ${viewMode === "week" ? "" : ""}`}>
          {calendarDays.map((day, idx) => {
            const dayEvents = eventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const _isToday = isToday(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const hasConflict = dayEvents.length >= 3;
            const MAX_VISIBLE = viewMode === "week" ? 8 : 3;

            return (
              <div
                key={idx}
                className={`border-b border-r border-border ${viewMode === "week" ? "min-h-[300px]" : "min-h-[110px]"} p-1.5 cursor-pointer transition-colors relative ${
                  !isCurrentMonth && viewMode === "month" ? "bg-muted/20 opacity-50" : ""
                } ${isSelected ? "bg-[#d4a373]/5 ring-1 ring-[#d4a373]/30 ring-inset" : "hover:bg-muted/30"}`}
                onClick={() => setSelectedDay(selectedDay && isSameDay(day, selectedDay) ? null : day)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[12px] font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      _isToday
                        ? "bg-[#d4a373] text-white"
                        : "text-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {hasConflict && (
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                  )}
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {dayEvents.slice(0, MAX_VISIBLE).map((evt) => {
                    const cfg = MODULE_CONFIG[evt.module];
                    return (
                      <div
                        key={evt.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, evt)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border truncate cursor-grab active:cursor-grabbing ${cfg.bg} ${cfg.color}`}
                        title={evt.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(day);
                        }}
                      >
                        <cfg.icon className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                        {evt.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > MAX_VISIBLE && (
                    <div className="text-[9px] text-muted-foreground text-center">
                      +{dayEvents.length - MAX_VISIBLE} ещё
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="bg-card border border-border rounded-xl p-5 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold text-foreground">
              {format(selectedDay, "d MMMM yyyy, EEEE", { locale: ru })}
            </h3>
            <button onClick={() => setSelectedDay(null)} className="p-1 hover:bg-muted rounded-lg">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {eventsForDay(selectedDay).length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Mascot emotion="sleep" size={70} />
              <p className="text-[12px] text-muted-foreground mt-2">Нет событий на этот день. Тишина и покой!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {eventsForDay(selectedDay).map((evt) => {
                const cfg = MODULE_CONFIG[evt.module];
                return (
                  <div
                    key={evt.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground truncate">{evt.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} shrink-0`}>{cfg.label}</span>
                      </div>
                      {evt.meta && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {Object.entries(evt.meta).filter(([, v]) => v).map(([k, v]) => (
                            <span key={k} className="text-[11px] text-muted-foreground">
                              <span className="opacity-60">{k}:</span> {v}
                            </span>
                          ))}
                        </div>
                      )}
                      {evt.endDate && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(parseISO(evt.date), "d MMM", { locale: ru })} - {format(parseISO(evt.endDate), "d MMM", { locale: ru })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stats footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {(Object.entries(MODULE_CONFIG) as [ModuleType, typeof MODULE_CONFIG[ModuleType]][]).map(([key, cfg]) => {
          const count = events.filter((e) => e.module === key).length;
          return (
            <div key={key} className="bg-card border border-border rounded-xl p-3 text-center">
              <cfg.icon className={`w-4 h-4 mx-auto mb-1 ${cfg.color}`} />
              <div className="text-[18px] font-bold text-foreground">{count}</div>
              <div className="text-[10px] text-muted-foreground">{cfg.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}