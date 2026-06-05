import { useEffect, useCallback, useState, startTransition } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router";
import {
  Search,
  FolderKanban,
  BarChart3,
  Users,
  Settings,
  Target,
  DollarSign,
  MessageSquareQuote,
  CalendarRange,
  Lightbulb,
  LayoutDashboard,
  Swords,
  FlaskConical,
  Palette,
  Calendar,
  Wand2,
  Workflow,
} from "lucide-react";
import { getData } from "../lib/api";
import { type Project } from "../data/mock-data";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    if (open) {
      getData<Project[]>("projects:list").then((d) => {
        const list = (d && Array.isArray(d) && d.length > 0) ? d : [];
        setProjects(list.map((p) => ({ id: p.id, label: p.name })));
      }).catch(() => {
        setProjects([]);
      });
    }
  }, [open]);

  const runCommand = useCallback(
    (command: () => void) => {
      onOpenChange(false);
      startTransition(() => {
        command();
      });
    },
    [onOpenChange]
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[560px] px-4">
        <Command
          className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          loop
        >
          <div className="flex items-center gap-3 px-4 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Command.Input
              placeholder="Поиск по проектам и инструментам..."
              className="flex-1 py-3.5 bg-transparent text-foreground text-[14px] placeholder:text-muted-foreground outline-none border-0"
              autoFocus
            />
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-muted-foreground text-[13px]">
              <div className="flex flex-col items-center gap-2">
                <span className="text-[28px]">🦊</span>
                <span>Марк ничего не нашёл. Попробуйте другой запрос.</span>
              </div>
            </Command.Empty>

            <Command.Group
              heading={
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2">
                  Навигация
                </span>
              }
            >
              {[
                { icon: FolderKanban, label: "Мои проекты", path: "/" },
                { icon: Calendar, label: "Календарь", path: "/calendar" },
                { icon: Settings, label: "Настройки", path: "/settings" },
              ].map((item) => (
                <Command.Item
                  key={item.path}
                  value={item.label}
                  onSelect={() => runCommand(() => navigate(item.path))}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-foreground cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:text-primary transition-colors"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="h-px bg-border my-2" />

            <Command.Group
              heading={
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2">
                  Проекты
                </span>
              }
            >
              {projects.map((p) => (
                <Command.Item
                  key={p.id}
                  value={p.label}
                  onSelect={() =>
                    runCommand(() => navigate(`/project/${p.id}`))
                  }
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-foreground cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:text-primary transition-colors"
                >
                  <Target className="w-4 h-4 text-muted-foreground" />
                  {p.label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="h-px bg-border my-2" />

            <Command.Group
              heading={
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2">
                  SMM
                </span>
              }
            >
              {[
                { icon: CalendarRange, label: "Контент-план", path: "/smm/plan" },
                { icon: Wand2, label: "Content Studio", path: "/content-studio" },
                { icon: Lightbulb, label: "Идеи и заметки", path: "/smm/ideas" },
                { icon: Users, label: "Инфлюенс-маркетинг", path: "/influencers" },
                { icon: Swords, label: "Конкуренты", path: "/competitors" },
                { icon: FlaskConical, label: "A/B Тесты", path: "/ab-tests" },
                { icon: Palette, label: "Бренд-ассеты", path: "/media" },
                { icon: Workflow, label: "Автоматизации", path: "/automations" },
              ].map((t) => (
                <Command.Item
                  key={t.path}
                  value={t.label}
                  onSelect={() => runCommand(() => navigate(t.path))}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-foreground cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:text-primary transition-colors"
                >
                  <t.icon className="w-4 h-4 text-muted-foreground" />
                  {t.label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="h-px bg-border my-2" />

            <Command.Group
              heading={
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2">
                  AI Инструменты
                </span>
              }
            >
              {[
                { icon: BarChart3, label: "Проработка метрик", path: "/tools/metrics" },
                { icon: DollarSign, label: "Прогноз бюджета", path: "/tools/budget" },
                { icon: Users, label: "ЦА и аватары", path: "/tools/audience" },
                { icon: MessageSquareQuote, label: "Триггеры из отзывов", path: "/tools/triggers" },
              ].map((t) => (
                <Command.Item
                  key={t.path}
                  value={t.label}
                  onSelect={() => runCommand(() => navigate(t.path))}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-foreground cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:text-primary transition-colors"
                >
                  <t.icon className="w-4 h-4 text-muted-foreground" />
                  {t.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>

          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
                ↑↓
              </kbd>{" "}
              навигация
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
                ↵
              </kbd>{" "}
              выбрать
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
                esc
              </kbd>{" "}
              закрыть
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}