import { useState, useEffect, useRef, useCallback, Suspense, startTransition } from "react";
import { useNavigate, useLocation, Outlet } from "react-router";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, FolderKanban, Calendar, CalendarRange, Wand2, Recycle,
  Lightbulb, Hash, Users, Swords, Radar, FlaskConical, Calculator, Palette,
  Volume2, BatteryLow, Target, GitBranch, MapPin, Film, Sparkles, BarChart3,
  DollarSign, MessageSquareQuote, Workflow, Settings, LogOut, Moon, Sun,
  Menu, X, Command, Loader2, MessageCircle, User, ChevronDown, Lock, Star,
  PanelLeft, PanelLeftClose, Zap, Search, Crown, WifiOff, Bell, Clock,
  HelpCircle, Info, CheckCircle2, AlertTriangle, type LucideIcon
} from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { PageTransition } from "./PageTransition";
import { AIChatAssistant } from "./AIChatAssistant";
import { ErrorBoundary } from "./ErrorBoundary";
import { AuthPages } from "./AuthPages";
import { toast } from "sonner";
import { useAuth } from "../lib/useAuth";
import { MascotTipProvider } from "./MascotTips";
import { OnboardingTour } from "./OnboardingTour";
import { MascotReactionsProvider } from "./MascotReactions";
import { MascotGamesProvider } from "./MascotGames";
import { trackDailyVisit, checkMilestone } from "../lib/mascot-reactions";
import { UsageLimitAlert } from "./UsageLimitAlert";
import { useAccess, PLAN_CONFIG, AI_PATHS } from "../lib/useAccess";
import { UpsellModal } from "./UpsellModal";

/* ─── Mobile bottom nav items ─── */
const MOBILE_NAV_ITEMS = [
  { icon: FolderKanban, label: "Проекты", path: "/app" },
  { icon: CalendarRange, label: "Контент", path: "/app/smm/plan" },
  { icon: Calendar, label: "Календарь", path: "/app/calendar" },
  { icon: Wand2, label: "Студия", path: "/app/content-studio" },
  { icon: Sparkles, label: "AI", path: "/app/tools/metrics" },
];

/* ─── Nav data ─── */
interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  badge?: string;
}

interface NavSection {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    id: "overview",
    title: "Обзор",
    icon: LayoutDashboard,
    items: [
      { icon: FolderKanban, label: "Проекты", path: "/app" },
      { icon: Calendar, label: "Календарь", path: "/app/calendar" },
    ],
  },
  {
    id: "smm",
    title: "Контент и SMM",
    icon: CalendarRange,
    items: [
      { icon: CalendarRange, label: "Контент-план", path: "/app/smm/plan" },
      { icon: Wand2, label: "Content Studio", path: "/app/content-studio", badge: "AI" },
      { icon: Recycle, label: "Repurpose", path: "/app/repurpose", badge: "AI" },
      { icon: Lightbulb, label: "Идеи", path: "/app/smm/ideas" },
      { icon: Hash, label: "Хештеги и SEO", path: "/app/smm/hashtags" },
      { icon: Users, label: "Инфлюенсеры", path: "/app/influencers" },
    ],
  },
  {
    id: "marketing",
    title: "Маркетинг",
    icon: Swords,
    items: [
      { icon: Swords, label: "Конкуренты", path: "/app/competitors" },
      { icon: Radar, label: "Competitor Spy", path: "/app/competitor-spy", badge: "AI" },
      { icon: FlaskConical, label: "A/B Тесты", path: "/app/ab-tests" },
      { icon: Calculator, label: "Unit-экономика", path: "/app/unit-economics" },
      { icon: Palette, label: "Бренд-ассеты", path: "/app/media" },
      { icon: Volume2, label: "Brand Voice", path: "/app/brand-voice", badge: "AI" },
      { icon: BatteryLow, label: "Fatigue Detector", path: "/app/fatigue-detector", badge: "AI" },
    ],
  },
  {
    id: "strategy",
    title: "Стратегия",
    icon: Target,
    items: [
      { icon: Target, label: "OKR", path: "/app/okr" },
      { icon: GitBranch, label: "Дерево метрик", path: "/app/metrics-tree" },
      { icon: MapPin, label: "CJM", path: "/app/cjm" },
      { icon: Users, label: "Personas", path: "/app/personas", badge: "AI" },
      { icon: Film, label: "Storyline", path: "/app/campaign-storyline", badge: "AI" },
    ],
  },
  {
    id: "ai",
    title: "AI Инструменты",
    icon: Sparkles,
    items: [
      { icon: BarChart3, label: "Content Scoring", path: "/app/content-scoring", badge: "AI" },
      { icon: BarChart3, label: "Метрики", path: "/app/tools/metrics", badge: "AI" },
      { icon: DollarSign, label: "Прогноз бюджета", path: "/app/tools/budget", badge: "AI" },
      { icon: Users, label: "ЦА и аватары", path: "/app/tools/audience", badge: "AI" },
      { icon: MessageSquareQuote, label: "Триггеры", path: "/app/tools/triggers", badge: "AI" },
    ],
  },
  {
    id: "system",
    title: "Система",
    icon: Workflow,
    items: [
      { icon: Workflow, label: "Автоматизации", path: "/app/automations" },
      { icon: Crown, label: "Тарифы", path: "/app/pricing" },
    ],
  },
];

/* ─── Notifications ─── */
interface Notification {
  id: string;
  text: string;
  type: "info" | "success" | "warn";
  time: string;
  read: boolean;
}

const DEMO_NOTIFICATIONS: Notification[] = [];

const NOTIF_ICONS = { info: Info, success: CheckCircle2, warn: AlertTriangle };
const NOTIF_COLORS = { info: "text-teal-400", success: "text-emerald-400", warn: "text-amber-400" };

/* ─── Persisted collapsed sections ─── */
function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("mp:sidebar:collapsed");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const toggle = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem("mp:sidebar:collapsed", JSON.stringify(next));
      return next;
    });
  }, []);

  return { collapsed, toggle };
}

/* ─── Persisted favorites ─── */
function useFavorites() {
  const [favs, setFavs] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("mp:sidebar:favorites");
      return stored ? JSON.parse(stored) : ["/smm/plan", "/content-studio"];
    } catch {
      return ["/smm/plan", "/content-studio"];
    }
  });

  const toggle = useCallback((path: string) => {
    setFavs(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path];
      localStorage.setItem("mp:sidebar:favorites", JSON.stringify(next));
      return next;
    });
  }, []);

  return { favs, toggle, isFav: (p: string) => favs.includes(p) };
}

/* ─── Tooltip ─── */
function Tooltip({ children, text, show }: { children: React.ReactNode; text: string; show: boolean }) {
  if (!show) return <>{children}</>;
  return (
    <div className="relative group/tip">
      {children}
      <div
        className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 z-50 shadow-xl border"
        style={{
          background: "var(--sidebar-bg)",
          color: "var(--sidebar-text)",
          borderColor: "var(--sidebar-border)",
        }}
      >
        {text}
      </div>
    </div>
  );
}

/* ─── Sidebar plan badge ─── */
function PlanBadge({ collapsed }: { collapsed: boolean }) {
  const { hasAccess, plan, expiresAt, isExpired, daysLeft, loading } = useAccess();
  const navigate = useNavigate();

  if (loading || !plan) {
    // Демо-режим: показываем "Тариф" ссылку
    return (
      <div className={`${collapsed ? "px-2" : "px-3"} py-2`}>
        <Tooltip text="Выбрать тариф" show={collapsed}>
          <button
            onClick={() => startTransition(() => navigate("/app/pricing"))}
            className={`w-full flex items-center rounded-lg transition-all duration-150 ${
              collapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-[7px]"
            }`}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <Crown className="w-[18px] h-[18px]" style={{ color: "var(--sidebar-icon)", opacity: 0.6 }} />
            {!collapsed && (
              <span className="text-[12px] font-medium" style={{ color: "var(--sidebar-text-muted)" }}>
                Выбрать тариф
              </span>
            )}
          </button>
        </Tooltip>
      </div>
    );
  }

  const cfg = PLAN_CONFIG[plan];
  const expDate = expiresAt ? new Date(expiresAt).toLocaleDateString("ru-RU") : null;

  if (collapsed) {
    return (
      <div className="px-2 py-2">
        <Tooltip text={`${cfg.label} · ${daysLeft !== null ? `${daysLeft} дн.` : ""}`} show={true}>
          <button
            onClick={() => startTransition(() => navigate("/app/pricing"))}
            className="w-full flex items-center justify-center p-1.5 rounded-lg transition-all"
            onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md text-white leading-tight"
              style={{ background: cfg.gradient }}
            >
              {cfg.badge}
            </span>
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => startTransition(() => navigate("/app/pricing"))}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-left"
        onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white shrink-0"
          style={{ background: cfg.gradient }}
        >
          {cfg.badge}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-medium truncate" style={{ color: "var(--sidebar-text)" }}>
              {cfg.label}
            </span>
            {isExpired ? (
              <span className="text-[10px] text-red-500 font-medium shrink-0">истёк</span>
            ) : (
              <span className="text-[10px] text-emerald-600 font-medium shrink-0">активен</span>
            )}
          </div>
          {expDate && daysLeft !== null && !isExpired && (
            <p className="text-[10px] truncate" style={{ color: "var(--sidebar-text-muted)" }}>
              {daysLeft} дн. · до {expDate}
            </p>
          )}
          {isExpired && expDate && (
            <p className="text-[10px] text-red-400 truncate">истёк {expDate}</p>
          )}
        </div>
      </button>
    </div>
  );
}

/* ═══════════════════════════════ LAYOUT ═══════════════════════════════ */
export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { theme, setTheme } = useTheme();
  const notifRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const { user, loading, hasAccess, signOut } = useAuth();
  const { plan: userPlan, loading: accessLoading } = useAccess();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Preview mode: вошёл, но нет активного тарифа
  const isPreview = !accessLoading && user != null && !userPlan;
  // AI-страницы заблокированы для тарифа Старт
  const isAIPage = AI_PATHS.some(p => location.pathname.startsWith(p));
  const isAIBlocked = userPlan === "start" && isAIPage;

  // Попап апселла
  const [showUpsell, setShowUpsell] = useState(false);
  const [upsellIsAI, setUpsellIsAI] = useState(false);
  const upsellShownRef = useRef(false);

  // 30-секундный таймер для preview-режима
  useEffect(() => {
    if (!isPreview) { upsellShownRef.current = false; return; }
    if (upsellShownRef.current) return;
    const t = setTimeout(() => {
      upsellShownRef.current = true;
      setUpsellIsAI(false);
      setShowUpsell(true);
    }, 30_000);
    return () => clearTimeout(t);
  }, [isPreview]);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  /* Mobile drawer state */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const sectionState = useCollapsedSections();
  const favorites = useFavorites();

  const unreadCount = notifications.filter(n => !n.read).length;
  const markAllRead = () => setNotifications(notifications.map(n => ({ ...n, read: true })));

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    if (mobileMenuOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen, isMobile]);

  // Network status
  useEffect(() => {
    const goOnline = () => { setIsOnline(true); toast.success("Соединение восстановлено"); };
    const goOffline = () => { setIsOnline(false); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  // Track daily visit + check streak milestone
  useEffect(() => {
    const streak = trackDailyVisit();
    if (streak >= 7) {
      const m = checkMilestone("week_streak", streak);
      if (m) {
        window.dispatchEvent(new Event("mp:milestone:check"));
      }
    }
  }, []);

  // Close panels on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // All items flat for resolving favorites
  const allItems = navSections.flatMap(s => s.items);
  const favItems = favorites.favs.map(p => allItems.find(i => i.path === p)).filter(Boolean) as NavItem[];

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/app" && location.pathname.startsWith(path));

  /* ─── Render nav item ─── */
  const renderItem = (item: NavItem, compact = false) => {
    const active = isActive(item.path);
    const blocked = !hasAccess(item.path);
    const iconOnly = sidebarCollapsed && !isMobile;
    return (
      <Tooltip key={item.path} text={blocked ? `${item.label} (требуется апгрейд)` : item.label} show={iconOnly}>
        <button
          onClick={() => startTransition(() => navigate(item.path))}
          onContextMenu={e => {
            e.preventDefault();
            favorites.toggle(item.path);
            toast(favorites.isFav(item.path) ? "Убрано из избранного" : "Добавлено в избранное", { duration: 1500 });
          }}
          className={`group/item w-full flex items-center rounded-lg transition-all duration-150 ${
            iconOnly ? "justify-center p-3" : "gap-2.5 px-2.5 py-2.5"
          }`}
          style={{ background: active ? "var(--sidebar-accent)" : undefined }}
          onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--sidebar-hover)"; }}
          onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
        >
          <div className="relative shrink-0">
            <item.icon
              className="w-[18px] h-[18px] transition-colors"
              style={{ color: active ? "var(--sidebar-active)" : blocked ? "var(--sidebar-text-muted)" : "var(--sidebar-icon)" }}
            />
            {blocked && !iconOnly && (
              <Lock className="absolute -right-1 -bottom-1 w-2.5 h-2.5" style={{ color: "var(--sidebar-text-muted)" }} />
            )}
            {active && (
              <div
                className="absolute -left-[14px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                style={{ background: "linear-gradient(180deg, var(--sidebar-active), #c0854a)" }}
              />
            )}
          </div>
          {!iconOnly && (
            <>
              <span
                className="flex-1 text-[13px] text-left truncate transition-colors"
                style={{
                  color: active ? "var(--sidebar-text)" : "var(--sidebar-text-muted)",
                  fontWeight: active ? 600 : 400,
                  opacity: blocked ? 0.6 : 1,
                }}
              >
                {item.label}
              </span>
              {item.badge && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md tracking-wide"
                  style={{ background: "var(--sidebar-accent)", color: "var(--sidebar-active)" }}
                >
                  {item.badge}
                </span>
              )}
              {!compact && (
                <Star
                  className="w-3 h-3 opacity-0 group-hover/item:opacity-60 transition-opacity cursor-pointer"
                  style={{
                    color: favorites.isFav(item.path) ? "var(--sidebar-active)" : "var(--sidebar-fg)",
                    fill: favorites.isFav(item.path) ? "var(--sidebar-active)" : "none",
                    opacity: favorites.isFav(item.path) ? 1 : undefined,
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    favorites.toggle(item.path);
                  }}
                />
              )}
            </>
          )}
        </button>
      </Tooltip>
    );
  };

  /* ─── Render section ─── */
  const renderSection = (section: NavSection) => {
    const accessible = section.items.filter(i => hasAccess(i.path));
    if (accessible.length === 0) return null;
    const isSectionCollapsed = sectionState.collapsed[section.id];
    const hasActiveChild = accessible.some(i => isActive(i.path));

    if (sidebarCollapsed && !isMobile) {
      return (
        <div key={section.id} className="space-y-0.5 py-1">
          {accessible.map(item => renderItem(item))}
        </div>
      );
    }

    return (
      <div key={section.id} className="py-0.5">
        <button
          onClick={() => sectionState.toggle(section.id)}
          className="w-full flex items-center gap-2 px-2.5 py-[6px] rounded-lg transition-colors group/sec"
          onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <section.icon
            className="w-3.5 h-3.5 transition-colors"
            style={{ color: hasActiveChild ? "var(--sidebar-active)" : "var(--sidebar-section)" }}
          />
          <span
            className="flex-1 text-left text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors"
            style={{ color: "var(--sidebar-section)" }}
          >
            {section.title}
          </span>
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${isSectionCollapsed ? "-rotate-90" : ""}`}
            style={{ color: "var(--sidebar-section)" }}
          />
        </button>
        <div
          className={`overflow-hidden transition-all duration-200 ${
            isSectionCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
          }`}
        >
          <div className="space-y-0.5 pt-0.5 pl-1">
            {accessible.map(item => renderItem(item))}
          </div>
        </div>
      </div>
    );
  };

  // Auth guard: show loading or auth pages
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #d4a373 0%, #c0854a 50%, #a87040 100%)",
            boxShadow: "0 4px 20px rgba(212,163,115,0.3)",
          }}
        >
          <Zap className="w-6 h-6 text-white" />
        </div>
        <Loader2 className="w-5 h-5 text-[#d4a373] animate-spin" />
        <p className="text-[13px] text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPages />;
  }

  return (
    <div
      className="flex bg-background overflow-hidden"
      style={{ height: "100dvh", width: "100vw", maxWidth: "100vw", position: "relative" }}
    >
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed z-40"
          style={{ inset: 0, width: "100vw", height: "100dvh", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", touchAction: "none" }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside
        className={`${
          isMobile 
            ? `fixed top-0 left-0 bottom-0 w-[285px] z-50 transform transition-transform duration-300 ease-out ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}` 
            : `${sidebarCollapsed ? "w-[60px]" : "w-[240px]"} relative`
        } flex flex-col transition-all duration-300 ease-out shrink-0 overflow-hidden`}
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
          willChange: isMobile ? "transform" : "width",
        }}
      >
        {/* Subtle warm glow */}
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 120% 40% at 50% 0%, rgba(212,163,115,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col h-full">
          {/* ─ Logo ─ */}
          <div className={`h-[56px] flex items-center ${sidebarCollapsed && !isMobile ? "justify-center" : "px-4"} gap-3 shrink-0`}>
            <div
              className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #d4a373 0%, #b87a45 100%)",
                boxShadow: "0 2px 10px rgba(212,163,115,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              <Zap className="w-4 h-4 text-white drop-shadow-sm" />
            </div>
            {!(sidebarCollapsed && !isMobile) && (
              <div className="flex flex-col flex-1 min-w-0">
                <span
                  className="text-[15px] font-bold tracking-tight leading-none"
                  style={{ color: "var(--sidebar-text)" }}
                >
                  MarketPlan
                </span>
                <span
                  className="text-[9px] font-medium tracking-wider uppercase mt-0.5"
                  style={{ color: "var(--sidebar-text-muted)" }}
                >
                  маркетинговый планер
                </span>
              </div>
            )}
            {/* Mobile close button */}
            {isMobile && (
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg ml-auto shrink-0"
                style={{ color: "var(--sidebar-fg)" }}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* ─ Search ─ */}
          <div className={`${sidebarCollapsed && !isMobile ? "px-2" : "px-3"} mb-3`}>
            {sidebarCollapsed && !isMobile ? (
              <Tooltip text="Поиск  ⌘K" show>
                <button
                  onClick={() => setCmdOpen(true)}
                  className="w-full flex justify-center p-2 rounded-lg transition-colors"
                  style={{ color: "var(--sidebar-fg)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Search className="w-4 h-4" />
                </button>
              </Tooltip>
            ) : (
              <button
                onClick={() => setCmdOpen(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] transition-all"
                style={{
                  background: "var(--sidebar-hover)",
                  color: "var(--sidebar-fg)",
                  border: "1px solid var(--sidebar-border)",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
              >
                <Search className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">Поиск...</span>
                <kbd
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-mono"
                  style={{ background: "var(--sidebar-border)", color: "var(--sidebar-fg)" }}
                >
                  ⌘K
                </kbd>
              </button>
            )}
          </div>

          {/* ─ Favorites ─ */}
          {favItems.length > 0 && (
            <div className={`${sidebarCollapsed && !isMobile ? "px-2" : "px-3"} mb-1`}>
              {!(sidebarCollapsed && !isMobile) && (
                <div className="flex items-center gap-1.5 px-2.5 mb-1">
                  <Star className="w-3 h-3" style={{ color: "var(--sidebar-active)", fill: "var(--sidebar-active)", opacity: 0.5 }} />
                  <span
                    className="text-[10px] font-semibold tracking-[0.08em] uppercase"
                    style={{ color: "var(--sidebar-section)" }}
                  >
                    Избранное
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {favItems.filter(i => hasAccess(i.path)).map(item => renderItem(item, true))}
              </div>
              <div className="mx-2.5 mt-2 mb-1 h-[1px]" style={{ background: "var(--sidebar-border)" }} />
            </div>
          )}

          {/* ─ Navigation sections ─ */}
          <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed && !isMobile ? "px-2" : "px-3"} space-y-0.5 sidebar-scroll`}>
            {navSections.map(renderSection)}
          </nav>

          {/* ─ Bottom divider ─ */}
          <div className="mx-4 h-[1px]" style={{ background: "var(--sidebar-border)" }} />

          {/* ─ Subscription badge ─ */}
          <PlanBadge collapsed={sidebarCollapsed && !isMobile} />

          {/* ─ Bottom actions ─ */}
          <div className={`${sidebarCollapsed && !isMobile ? "px-2" : "px-3"} py-2 space-y-0.5`}>
            {/* Settings */}
            <Tooltip text="Настройки" show={sidebarCollapsed && !isMobile}>
              <button
                onClick={() => startTransition(() => navigate("/app/settings"))}
                className={`w-full flex items-center rounded-lg transition-all duration-150 ${
                  sidebarCollapsed && !isMobile ? "justify-center p-2" : "gap-2.5 px-2.5 py-[7px]"
                }`}
                style={{ background: isActive("/app/settings") ? "var(--sidebar-accent)" : undefined }}
                onMouseEnter={e => { if (!isActive("/app/settings")) e.currentTarget.style.background = "var(--sidebar-hover)"; }}
                onMouseLeave={e => { if (!isActive("/app/settings")) e.currentTarget.style.background = "transparent"; }}
              >
                <Settings className="w-[18px] h-[18px]" style={{ color: isActive("/app/settings") ? "var(--sidebar-active)" : "var(--sidebar-icon)" }} />
                {!(sidebarCollapsed && !isMobile) && (
                  <span className="text-[13px]" style={{ color: isActive("/app/settings") ? "var(--sidebar-text)" : "var(--sidebar-text-muted)", fontWeight: isActive("/app/settings") ? 600 : 400 }}>
                    Настройки
                  </span>
                )}
              </button>
            </Tooltip>

            {/* Collapse toggle - desktop only */}
            {!isMobile && (
              <Tooltip text={sidebarCollapsed ? "Развернуть" : "Свернуть"} show={sidebarCollapsed}>
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className={`w-full flex items-center rounded-lg transition-all duration-150 ${
                    sidebarCollapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-[7px]"
                  }`}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  {sidebarCollapsed
                    ? <PanelLeft className="w-[18px] h-[18px]" style={{ color: "var(--sidebar-fg)" }} />
                    : <PanelLeftClose className="w-[18px] h-[18px]" style={{ color: "var(--sidebar-fg)" }} />
                  }
                  {!sidebarCollapsed && <span className="text-[13px]" style={{ color: "var(--sidebar-text-muted)" }}>Свернуть</span>}
                </button>
              </Tooltip>
            )}
          </div>

          {/* ─ User card ─ */}
          <div className="mx-4 h-[1px]" style={{ background: "var(--sidebar-border)" }} />
          <div className={`${sidebarCollapsed && !isMobile ? "px-2" : "px-3"} py-3`} ref={userMenuRef}>
            <Tooltip text={user?.name || "Профиль"} show={sidebarCollapsed && !isMobile}>
              <button
                onClick={() => (sidebarCollapsed && !isMobile) ? startTransition(() => navigate("/app/profile")) : setUserMenuOpen(!userMenuOpen)}
                className={`w-full flex items-center rounded-xl transition-all duration-150 ${
                  sidebarCollapsed && !isMobile ? "justify-center p-2" : "gap-2.5 px-2.5 py-2"
                }`}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #d4a373, #a87040)",
                    boxShadow: "0 2px 8px rgba(212,163,115,0.25)",
                  }}
                >
                  {user?.avatarInitials || "МП"}
                </div>
                {!(sidebarCollapsed && !isMobile) && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[12px] font-medium truncate leading-tight" style={{ color: "var(--sidebar-text)" }}>
                      {user?.name || "Пользователь"}
                    </p>
                    <p className="text-[10px] truncate leading-tight mt-0.5" style={{ color: "var(--sidebar-text-muted)" }}>
                      {user?.email}
                    </p>
                  </div>
                )}
                {!(sidebarCollapsed && !isMobile) && (
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    style={{ color: "var(--sidebar-fg)" }}
                  />
                )}
              </button>
            </Tooltip>

            {/* User dropdown */}
            {userMenuOpen && !(sidebarCollapsed && !isMobile) && (
              <div
                className="mt-1.5 rounded-xl overflow-hidden shadow-lg border"
                style={{
                  background: "var(--sidebar-bg)",
                  borderColor: "var(--sidebar-border)",
                }}
              >
                <button
                  onClick={() => { startTransition(() => navigate("/app/profile")); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] transition-colors"
                  style={{ color: "var(--sidebar-text-muted)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--sidebar-hover)"; e.currentTarget.style.color = "var(--sidebar-text)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-text-muted)"; }}
                >
                  <User className="w-3.5 h-3.5" />
                  Личный кабинет
                  {user?.role === "owner" && <Crown className="w-3 h-3 ml-auto" style={{ color: "var(--sidebar-active)" }} />}
                </button>
                <div className="mx-2 h-[1px]" style={{ background: "var(--sidebar-border)" }} />
                <button
                  onClick={() => { signOut(); setUserMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-red-500 hover:bg-red-500/5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          minWidth: 0,
          paddingBottom: isMobile ? "calc(56px + env(safe-area-inset-bottom))" : 0,
        }}
      >
        {/* Offline indicator */}
        {!isOnline && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-center gap-2 shrink-0">
            <WifiOff className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[12px] text-red-500 font-medium">Нет подключения к интернету. Данные могут не сохраняться.</span>
          </div>
        )}

        {/* Header */}
        <header className="h-[52px] border-b border-border flex items-center justify-between px-3 md:px-5 shrink-0 relative"
          style={{ background: "linear-gradient(90deg, var(--card) 0%, var(--background) 100%)" }}
        >
          {/* Subtle glow line at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-px opacity-40" style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }} />
          <div className="flex items-center gap-1 text-[13px] text-muted-foreground min-w-0">
            {/* Mobile menu button */}
            {isMobile && (
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Открыть меню"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
            <button
              onClick={() => setCmdOpen(true)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden sm:flex"
              data-hotspot="header-search"
              aria-label="Поиск"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
              title={theme === "dark" ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications */}
            <div className="relative hidden sm:block" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative"
                data-hotspot="header-notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-card"
                    style={{ background: "#d4a373" }}
                  />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-[min(360px,calc(100vw-1rem))] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h4 className="text-foreground text-[13px] font-medium">Уведомления</h4>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[11px] text-[#d4a373] hover:underline">
                        Прочитать все
                      </button>
                    )}
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {notifications.map(n => {
                      const NIcon = NOTIF_ICONS[n.type];
                      return (
                        <div
                          key={n.id}
                          className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors ${!n.read ? "bg-[#d4a373]/[0.03]" : ""}`}
                        >
                          <NIcon className={`w-4 h-4 mt-0.5 shrink-0 ${NOTIF_COLORS[n.type]}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-foreground">{n.text}</p>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />{n.time}
                            </span>
                          </div>
                          {!n.read && (
                            <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: "#d4a373" }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" data-hotspot="header-help">
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => startTransition(() => navigate("/app/profile"))}
              title={user?.name || user?.email || "Профиль"}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-medium ml-2 cursor-pointer hover:ring-2 hover:ring-[#d4a373]/40 transition-all"
              style={{
                background: "linear-gradient(135deg, #d4a373 0%, #c0854a 50%, #a87040 100%)",
              }}
            >
              {user?.avatarInitials || "МП"}
            </button>
          </div>
        </header>

        <UsageLimitAlert />

        {/* Preview mode banner */}
        {isPreview && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2 text-[12px] font-medium border-b border-amber-500/20"
            style={{ background: "rgba(200,137,58,0.08)", color: "var(--foreground)" }}>
            <span className="text-amber-600 font-semibold">Режим просмотра</span>
            <span className="text-muted-foreground hidden sm:inline">Кнопки неактивны - выберите тариф для полного доступа</span>
            <button
              onClick={() => startTransition(() => navigate("/app/pricing"))}
              className="ml-auto shrink-0 px-3 py-1 rounded-lg text-white text-[11px] font-semibold hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg, #d4a373, #c08a40)" }}
            >
              Выбрать тариф
            </button>
          </div>
        )}

        {/* Start plan AI gate banner */}
        {isAIBlocked && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2 text-[12px] font-medium border-b border-primary/20"
            style={{ background: "rgba(26,122,109,0.06)", color: "var(--foreground)" }}>
            <span className="text-primary font-semibold">AI-инструменты</span>
            <span className="text-muted-foreground hidden sm:inline">Доступны с тарифом Про или Про+</span>
            <button
              onClick={() => { setUpsellIsAI(true); setShowUpsell(true); }}
              className="ml-auto shrink-0 px-3 py-1 rounded-lg text-white text-[11px] font-semibold hover:opacity-90 transition-opacity"
              style={{ background: "linear-gradient(135deg, #1a7a6d, #2eb8a4)" }}
            >
              Перейти на Про
            </button>
          </div>
        )}

        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          ref={mainContentRef}
          style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" as any }}
          // В preview-режиме клики по контенту (который pointer-events:none) всплывают сюда
          onClick={isPreview && location.pathname !== "/app/pricing"
            ? () => { setUpsellIsAI(false); setShowUpsell(true); }
            : undefined}
        >
          {/* AI gate overlay для тарифа Старт на AI-страницах */}
          {isAIBlocked && (
            <div
              className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
              onClick={() => { setUpsellIsAI(true); setShowUpsell(true); }}
            >
              <div
                className="bg-card border border-border rounded-2xl p-8 text-center space-y-4 max-w-sm mx-4 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ background: "linear-gradient(135deg, #1a7a6d, #2eb8a4)" }}>
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-[17px] font-bold text-foreground">Требуется тариф Про</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  AI-инструменты доступны с тарифом Про или Про+. Весь функционал за 700 ₽/мес.
                </p>
                <button
                  onClick={() => { setUpsellIsAI(true); setShowUpsell(true); }}
                  className="w-full px-5 py-2.5 rounded-xl text-white text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-md"
                  style={{ background: "linear-gradient(135deg, #1a7a6d, #2eb8a4)" }}
                >
                  Перейти на Про
                </button>
              </div>
            </div>
          )}

          {/* Content — pointer-events:none в preview (кроме страницы тарифов) */}
          <div style={{
            pointerEvents: (isPreview && location.pathname !== "/app/pricing") ? "none" : "auto"
          }}>
            <PageTransition key={location.pathname}>
              <ErrorBoundary>
                <Suspense fallback={
                  <div className="flex items-center justify-center h-64">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                }>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </PageTransition>
          </div>
        </main>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      {/* Upsell modal — preview mode & AI gate */}
      {showUpsell && (
        <UpsellModal
          aiOnly={upsellIsAI}
          onClose={() => setShowUpsell(false)}
        />
      )}

      {/* ═══ Mobile Bottom Navigation ═══ */}
      {isMobile && (
        <nav
          className="fixed left-0 right-0 z-30 border-t border-border"
          style={{
            bottom: 0,
            background: "var(--sidebar-bg)",
            width: "100vw",
            // fixed height for nav bar + safe area
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            // use will-change to prevent repaints on scroll
            willChange: "transform",
            // prevent the nav from being scrollable
            touchAction: "none",
          }}
        >
          <div className="flex items-stretch" style={{ height: 56 }}>
            {MOBILE_NAV_ITEMS.map(item => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => startTransition(() => navigate(item.path))}
                  className="relative flex-1 flex flex-col items-center justify-center gap-0.5"
                  style={{
                    color: active ? "var(--sidebar-active)" : "var(--sidebar-text-muted)",
                    minHeight: 44,
                    touchAction: "manipulation",
                  }}
                >
                  {active && (
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full"
                      style={{ background: "var(--sidebar-active)" }}
                    />
                  )}
                  <item.icon className="w-[22px] h-[22px]" style={{ color: active ? "var(--sidebar-active)" : "var(--sidebar-text-muted)" }} />
                  <span className="text-[10px] font-medium leading-none mt-0.5" style={{ color: active ? "var(--sidebar-active)" : "var(--sidebar-text-muted)" }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
            {/* More/Menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5"
              style={{ color: "var(--sidebar-text-muted)", minHeight: 44, touchAction: "manipulation" }}
            >
              <Menu className="w-[22px] h-[22px]" />
              <span className="text-[10px] font-medium leading-none mt-0.5">Ещё</span>
            </button>
          </div>
        </nav>
      )}

      <style>{`
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: var(--sidebar-border); border-radius: 3px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: var(--sidebar-fg); }
      `}</style>

      <AIChatAssistant isMobile={isMobile} />
      <MascotTipProvider />
      <OnboardingTour />
      <MascotReactionsProvider />
      <MascotGamesProvider />
    </div>
  );
}

/* ═══ Breadcrumbs ═══ */
function Breadcrumbs() {
  const location = useLocation();
  const path = location.pathname;

  const labels: Record<string, string> = {
    "/app/": "Проекты",
    "/app/smm/plan": "Контент-план",
    "/app/smm/ideas": "Идеи и заметки",
    "/app/smm/hashtags": "Хештеги и SEO",
    "/app/influencers": "Инфлюенс-маркетинг",
    "/app/competitors": "Конкуренты",
    "/app/competitor-spy": "Competitor Spy",
    "/app/ab-tests": "A/B Тесты",
    "/app/unit-economics": "Unit-экономика",
    "/app/media": "Бренд-ассеты",
    "/app/tools/metrics": "Проработка метрик",
    "/app/tools/budget": "Прогноз бюджета",
    "/app/tools/audience": "ЦА и аватары",
    "/app/tools/triggers": "Триггеры из отзывов",
    "/app/settings": "Настройки",
    "/app/brand-voice": "Brand Voice",
    "/app/okr": "OKR-трекинг",
    "/app/cjm": "Customer Journey Map",
    "/app/calendar": "Маркетинговый календарь",
    "/app/content-studio": "Content Studio",
    "/app/automations": "Автоматизации",
    "/app/repurpose": "Repurpose Engine",
    "/app/content-scoring": "Content Scoring",
    "/app/personas": "Persona Builder",
    "/app/fatigue-detector": "Fatigue Detector",
    "/app/campaign-storyline": "Campaign Storyline",
    "/app/profile": "Личный кабинет",
    "/app/metrics-tree": "Дерево метрик",
    "/app/pricing": "Тарифы",
    "/app/notion": "Notion Hub",
  };

  const isProjectDetail = path.startsWith("/app/project/");
  const label = isProjectDetail ? "Проект" : labels[path] || path;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-foreground font-medium">{label}</span>
    </div>
  );
}