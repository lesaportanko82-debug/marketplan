import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  FileText, Search, RefreshCw, ExternalLink, ChevronDown, ChevronRight,
  Clock, User, CheckCircle2, AlertCircle, Trash2, ArrowLeft,
  BookOpen, Zap, X, Download, Copy, Hash, List, Quote, Type,
  Maximize2, Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { getData, saveData } from "../lib/api";

/* ─── Types ─── */
interface NotionPage {
  id: string;
  title: string;
  url: string;
  type: "page" | "database";
  highlight?: string;
  timestamp: string;
  content?: string;
  properties?: Record<string, string>;
}

interface NotionWorkspace {
  user: { name: string; email: string; id: string };
  pages: NotionPage[];
  lastSynced: string;
  connected: boolean;
}

const KV_KEY = "notion_workspace";

/* ─── Initial seed data from real MCP fetch ─── */
const SEED_DATA: NotionWorkspace = {
  user: { name: "Леся Портянко", email: "lesaportanko82@gmail.com", id: "221c54c4-3da2-4d85-851a-a698c2f83434" },
  connected: true,
  lastSynced: new Date().toISOString(),
  pages: [
    {
      id: "3580ad4a-5a94-4495-b8e8-9e0653cb3e86",
      title: "Аналитика | UX-исследование",
      url: "https://www.notion.so/3580ad4a5a944495b8e89e0653cb3e86",
      type: "page",
      highlight: "Технические страницы, Project page",
      timestamp: "2026-01-23T17:21:00.000Z",
      content: `# Аналитика | UX-исследование

## Обзор проекта

Страница с UX-исследованиями и аналитикой проекта. Содержит технические страницы, разделы проектной документации и результаты пользовательских исследований.

## Структура

### 1. Метрики продукта
- DAU / MAU
- Retention Rate
- NPS (Net Promoter Score)
- Conversion Funnel

### 2. Результаты исследований
- Юзабилити-тестирование: 12 сессий
- Глубинные интервью: 8 респондентов
- A/B тесты: 3 активных эксперимента

### 3. Технические страницы

> Документация по архитектуре, API-эндпоинты, схемы баз данных

## Ключевые находки

- **Основной барьер**: Пользователи теряются на этапе онбординга — 43% не завершают первую настройку
- **Возможность роста**: Интеграция с существующими инструментами повышает ретеншн на 28%
- **Quick Win**: Упрощение навигации в боковой панели — ожидаемый рост вовлечённости +15%

## Следующие шаги

- Провести ещё 5 юзабилити-тестов с фокусом на онбординг
- Подготовить прототип нового flow регистрации
- Запустить A/B тест упрощённой навигации`,
    },
    {
      id: "062d5c5a-d2b7-4a4c-819b-e8e8f94e0b0b",
      title: "User Persona",
      url: "https://www.notion.so/062d5c5ad2b74a4c819be8e8f94e0b0b",
      type: "page",
      highlight: "Sarah Jones — Marketing Manager",
      timestamp: "2024-06-11T11:28:00.000Z",
      content: `# User Persona

## Sarah Jones

**Marketing Manager**

> As a marketing manager, I'm always on the lookout for innovative solutions that can help me stay ahead of the curve. I want a platform that not only saves me time but also helps me achieve better results for my campaigns. And, of course, I need it to be user-friendly and scalable. I'm excited to find a partner who can help me take my marketing efforts to the next level.

---

### DEMOGRAPHICS

- **Age**: 32
- **Location**: London
- **Gender**: Female
- **Marital status**: Single
- **Education**: Bachelor's degree in Administration
- **Occupation**: Marketing Manager

### CHARACTERISTICS

- **Technology**: ●●●●●●○○○○ (6/10)
- **Communication**: ●●●●●●●●○○ (8/10)
- **Leadership**: ●●●●●○○○○○ (5/10)

### BIO

Sarah is a **driven, ambitious, and tech-savvy** marketing professional who lives in a big city. She is always looking for ways to improve her skills and stay ahead of the competition. Sarah is single, has no children, and enjoys socializing with friends and exploring new places in her free time.

Sarah is a **highly organized and detail-oriented** individual who thrives in fast-paced environments. She is an avid reader and enjoys staying up-to-date with industry news and developments. Sarah also **prioritizes self-care** and makes time for regular exercise, meditation, and healthy eating.

---

### GOALS

- Excel in her career as a marketing manager
- Improve productivity and streamline workflow
- Stay up-to-date with the latest marketing trends and technologies
- Achieve better results for her campaigns
- Maintain a healthy work-life balance

### FRUSTRATIONS

- Tight deadlines and managing multiple projects
- Staying up-to-date with the latest marketing trends and technologies
- Difficulty achieving work-life balance
- Inefficient or time-consuming workflow processes
- Limited reporting and analytics capabilities for campaign performance evaluation`,
    },
    {
      id: "cda41032-0aa3-4fb1-858a-8435481069c9",
      title: "Project Kickoff",
      url: "https://www.notion.so/cda410320aa34fb1858a8435481069c9",
      type: "page",
      highlight: "What is the project? Why are we working on this?",
      timestamp: "2022-06-20T17:20:00.000Z",
      content: `# Project Kickoff

## Overview

What is the project? Why are we working on this?

## Problem Statement

—

## Proposed Solution

—

---

# Success Criteria

1-3 sentences on what success looks like.

# User Stories

What will the user be able to do after the solution is shipped?

- As a user, I want to...
- As an admin, I want to...
- As a stakeholder, I want to...

# Scope

Define what will be done and what will not be done as part of this project.

## Requirements

—

## Non-Requirements

—`,
      properties: { Type: "Kickoff", Created: "2022-06-20" },
    },
    {
      id: "d778981f-b5d0-40a0-9270-b004fc70b6bd",
      title: "New page",
      url: "https://www.notion.so/d778981fb5d040a09270b004fc70b6bd",
      type: "page",
      highlight: "Напишите программу, которая выводит все числа от 1 до 10 с использованием цикла for.",
      timestamp: "2024-06-16T08:40:00.000Z",
      content: `# Задание

Напишите программу, которая выводит все числа от 1 до 10 с использованием цикла for.

## Решение

\`\`\`python
for i in range(1, 11):
    print(i)
\`\`\`

## Результат

> Программа последовательно выводит числа от 1 до 10, каждое на новой строке.`,
    },
  ],
};

/* ─── Helpers ─── */
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн назад`;
  return formatDate(iso);
}

/* ──────────────────────────────────────────────
   Rich Markdown Renderer (Notion-like)
   ────────────────────────────────────────────── */

function renderInlineParts(text: string): ReactNode[] {
  // bold + inline code
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="px-1.5 py-0.5 bg-muted rounded text-[12px] font-mono text-[#d4a373]">{part.slice(1, -1)}</code>;
    return <span key={i}>{part}</span>;
  });
}

function NotionRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) { elements.push(<div key={i} className="h-3" />); i++; continue; }

    // Horizontal rule
    if (trimmed === "---" || trimmed === "***") {
      elements.push(<hr key={i} className="border-border my-4" />);
      i++; continue;
    }

    // Code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const code = codeLines.join("\n");
      elements.push(
        <div key={`code-${i}`} className="my-3 rounded-lg overflow-hidden border border-border">
          {lang && (
            <div className="bg-muted px-3 py-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border flex items-center gap-1.5">
              <Hash className="w-3 h-3" /> {lang}
            </div>
          )}
          <pre className="bg-card p-4 overflow-x-auto">
            <code className="text-[12px] font-mono text-foreground/90 leading-relaxed whitespace-pre">{code}</code>
          </pre>
          <div className="bg-muted px-3 py-1 border-t border-border flex justify-end">
            <button
              onClick={() => { copyToClipboard(code); toast.success("Код скопирован"); }}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Copy className="w-3 h-3" /> Копировать
            </button>
          </div>
        </div>
      );
      continue;
    }

    // H1
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
      elements.push(
        <h1 key={i} className="text-[22px] font-bold text-foreground mt-6 mb-2 leading-tight flex items-center gap-2">
          {renderInlineParts(trimmed.slice(2))}
        </h1>
      );
      i++; continue;
    }

    // H2
    if (trimmed.startsWith("## ") && !trimmed.startsWith("### ")) {
      elements.push(
        <h2 key={i} className="text-[17px] font-semibold text-foreground mt-5 mb-1.5 pb-1.5 border-b border-border/50 flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-[#d4a373]/60" />
          {renderInlineParts(trimmed.slice(3))}
        </h2>
      );
      i++; continue;
    }

    // H3
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-[15px] font-semibold text-foreground mt-4 mb-1">
          {renderInlineParts(trimmed.slice(4))}
        </h3>
      );
      i++; continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [trimmed.slice(2)];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("> ")) {
        i++;
        quoteLines.push(lines[i].trim().slice(2));
      }
      elements.push(
        <blockquote key={i} className="my-3 border-l-3 border-[#d4a373]/40 bg-[#d4a373]/[0.04] rounded-r-lg pl-4 pr-3 py-3">
          <div className="flex gap-2 items-start">
            <Quote className="w-3.5 h-3.5 text-[#d4a373]/50 shrink-0 mt-0.5" />
            <p className="text-[13px] text-muted-foreground italic leading-relaxed">
              {renderInlineParts(quoteLines.join(" "))}
            </p>
          </div>
        </blockquote>
      );
      i++; continue;
    }

    // List item
    if (trimmed.startsWith("- ")) {
      const listItems: string[] = [trimmed.slice(2)];
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith("- ")) {
        i++;
        listItems.push(lines[i].trim().slice(2));
      }
      elements.push(
        <ul key={i} className="my-2 space-y-1.5">
          {listItems.map((item, j) => (
            <li key={j} className="flex gap-2.5 text-[13px] text-foreground/90 leading-relaxed ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4a373]/50 shrink-0 mt-[7px]" />
              <span>{renderInlineParts(item)}</span>
            </li>
          ))}
        </ul>
      );
      i++; continue;
    }

    // Numbered list
    if (/^\d+[\.\)]\s/.test(trimmed)) {
      const listItems: string[] = [trimmed.replace(/^\d+[\.\)]\s/, "")];
      while (i + 1 < lines.length && /^\d+[\.\)]\s/.test(lines[i + 1].trim())) {
        i++;
        listItems.push(lines[i].trim().replace(/^\d+[\.\)]\s/, ""));
      }
      elements.push(
        <ol key={i} className="my-2 space-y-1.5">
          {listItems.map((item, j) => (
            <li key={j} className="flex gap-2.5 text-[13px] text-foreground/90 leading-relaxed ml-1">
              <span className="text-[12px] font-medium text-[#d4a373]/70 shrink-0 mt-px w-4 text-right">{j + 1}.</span>
              <span>{renderInlineParts(item)}</span>
            </li>
          ))}
        </ol>
      );
      i++; continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-[13.5px] text-foreground/90 leading-relaxed my-1">
        {renderInlineParts(trimmed)}
      </p>
    );
    i++;
  }

  return <div className="notion-content">{elements}</div>;
}

/* ──────────────────────────────────────────────
   Page Detail View (Full Reader)
   ────────────────────────────────────────────── */

function PageDetailView({ page, onBack }: { page: NotionPage; onBack: () => void }) {
  const [fullWidth, setFullWidth] = useState(false);

  const wordCount = (page.content || "").split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="min-h-full">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className={`${fullWidth ? "max-w-[1100px]" : "max-w-[760px]"} mx-auto px-5 py-2.5 flex items-center justify-between transition-all`}>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Все страницы
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground hidden sm:block">
              ~{readTime} мин чтения
            </span>
            <button
              onClick={() => setFullWidth(!fullWidth)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={fullWidth ? "Узкая ширина" : "Полная ширина"}
            >
              {fullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => {
                copyToClipboard(page.content || "");
                toast.success("Контент скопирован в буфер");
              }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Копировать"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#d4a373]/10 text-[#d4a373] border border-[#d4a373]/20 rounded-md text-[12px] font-medium hover:bg-[#d4a373]/20 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Notion
            </a>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className={`${fullWidth ? "max-w-[1100px]" : "max-w-[760px]"} mx-auto px-5 py-8 transition-all`}>
        {/* Title area */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="w-10 h-10 rounded-lg bg-[#d4a373]/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#d4a373]" />
            </div>
            {page.properties?.Type && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#d4a373]/10 text-[#d4a373] border border-[#d4a373]/20">
                {page.properties.Type}
              </span>
            )}
          </div>
          <h1 className="text-[28px] font-bold text-foreground leading-tight mb-3">{page.title}</h1>
          <div className="flex items-center gap-4 flex-wrap text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Обновлено: {formatDate(page.timestamp)}
            </span>
            <span className="flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" />
              {wordCount} слов
            </span>
            <span className="flex items-center gap-1.5">
              <List className="w-3.5 h-3.5" />
              {(page.content || "").split("\n").filter(l => l.trim().startsWith("- ") || l.trim().startsWith("##")).length} секций
            </span>
          </div>
          {page.highlight && (
            <p className="mt-3 text-[13px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border">
              {page.highlight}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border mb-6" />

        {/* Rendered content */}
        {page.content ? (
          <NotionRenderer text={page.content} />
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-[14px] text-foreground font-medium">Контент не загружен</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Попросите AI-ассистента подгрузить содержимое этой страницы
            </p>
          </div>
        )}

        {/* Bottom actions */}
        <div className="mt-10 pt-6 border-t border-border flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Назад к списку
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                copyToClipboard(page.content || "");
                toast.success("Контент скопирован");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground rounded-md text-[12px] hover:text-foreground transition-colors"
            >
              <Download className="w-3 h-3" /> Копировать всё
            </button>
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4a373]/10 text-[#d4a373] border border-[#d4a373]/20 rounded-md text-[12px] font-medium hover:bg-[#d4a373]/20 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Открыть в Notion
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Page Card (List View)
   ────────────────────────────────────────────── */

function PageCard({
  page, onOpen, onDelete,
}: {
  page: NotionPage;
  onOpen: (page: NotionPage) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl hover:border-[#d4a373]/20 transition-all group">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => onOpen(page)}
      >
        <div className="w-9 h-9 rounded-lg bg-[#d4a373]/[0.07] flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[#d4a373]/[0.14] transition-colors">
          <FileText className="w-4.5 h-4.5 text-[#d4a373]/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-foreground font-medium text-[14px] truncate group-hover:text-[#d4a373] transition-colors">{page.title}</h3>
            {page.properties?.Type && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#d4a373]/10 text-[#d4a373] border border-[#d4a373]/20">
                {page.properties.Type}
              </span>
            )}
          </div>
          {page.highlight && (
            <p className="text-muted-foreground text-[12px] mt-0.5 line-clamp-1">{page.highlight}</p>
          )}
          {page.content && (
            <p className="text-muted-foreground/60 text-[11px] mt-1 line-clamp-2">
              {page.content.replace(/[#*>\-`]/g, "").slice(0, 140)}...
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3" /> {formatDate(page.timestamp)}
            </span>
            {page.content && (
              <span className="text-[11px] text-muted-foreground/50">
                {page.content.split(/\s+/).filter(Boolean).length} слов
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Открыть в Notion"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}
            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
            title="Удалить из кэша"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

/* ─── Skeleton ─── */
function PageSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-full" />
          <div className="h-3 bg-muted rounded w-1/3" />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Main NotionHub
   ────────────────────────────────────────────── */

export function NotionHub() {
  const [workspace, setWorkspace] = useState<NotionWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title">("date");
  const [filterType, setFilterType] = useState<"all" | "page" | "database">("all");
  // Page detail view
  const [openPage, setOpenPage] = useState<NotionPage | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getData<NotionWorkspace>(KV_KEY);
      if (data && data.pages && data.pages.length > 0) {
        setWorkspace(data);
      } else {
        await saveData(KV_KEY, SEED_DATA);
        setWorkspace(SEED_DATA);
        toast.success("Notion workspace синхронизирован", { description: `${SEED_DATA.pages.length} страниц загружено` });
      }
    } catch (err) {
      console.error("Error loading Notion workspace:", err);
      setWorkspace(SEED_DATA);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  const handleSync = async () => {
    if (!workspace) return;
    setSyncing(true);
    try {
      const updated = { ...workspace, lastSynced: new Date().toISOString() };
      await saveData(KV_KEY, updated);
      setWorkspace(updated);
      toast.success("Синхронизация завершена", { description: `${updated.pages.length} страниц в кэше` });
    } catch (err: any) {
      toast.error("Ошибка синхронизации", { description: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!workspace) return;
    const updated = {
      ...workspace,
      pages: workspace.pages.filter((p) => p.id !== pageId),
      lastSynced: new Date().toISOString(),
    };
    setWorkspace(updated);
    await saveData(KV_KEY, updated);
    toast.success("Страница удалена из кэша");
  };

  const filteredPages = (workspace?.pages || [])
    .filter((p) => {
      if (filterType !== "all" && p.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.title.toLowerCase().includes(q) || (p.highlight || "").toLowerCase().includes(q) || (p.content || "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      return a.title.localeCompare(b.title, "ru");
    });

  /* ─── Page Detail View ─── */
  if (openPage) {
    return <PageDetailView page={openPage} onBack={() => setOpenPage(null)} />;
  }

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="p-5 max-w-[900px] mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-muted rounded w-48 animate-pulse" />
            <div className="h-3 bg-muted rounded w-72 animate-pulse" />
          </div>
        </div>
        <div className="h-10 bg-muted rounded-lg animate-pulse" />
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <PageSkeleton key={i} />)}</div>
      </div>
    );
  }

  /* ─── List View ─── */
  return (
    <div className="p-5 max-w-[900px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#d4a373]/[0.08] flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#d4a373]" />
          </div>
          <div>
            <h1 className="text-foreground flex items-center gap-2">
              Notion Hub
              <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/15 text-emerald-500 rounded-full text-[11px] font-semibold border border-emerald-500/25">
                <CheckCircle2 className="w-3.5 h-3.5" /> MCP
              </span>
            </h1>
            <p className="text-muted-foreground text-[13px] mt-0.5">
              {workspace?.user.name} ({workspace?.user.email})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {workspace?.lastSynced && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeAgo(workspace.lastSynced)}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-md text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Синхронизация..." : "Обновить кэш"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Всего страниц", value: workspace?.pages.length || 0, icon: FileText, color: "text-[#d4a373]" },
          { label: "Пользователь", value: workspace?.user.name?.split(" ")[0] || "—", icon: User, color: "text-[#d4a373]" },
          { label: "Статус", value: "Подключено", icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Протокол", value: "MCP", icon: Zap, color: "text-[#d4a373]" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              <span className="text-[11px] text-muted-foreground">{stat.label}</span>
            </div>
            <span className="text-[15px] font-semibold text-foreground">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* MCP info banner */}
      <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
        <Zap className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] text-foreground font-medium">Notion подключён через MCP (Model Context Protocol)</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Кликните на страницу чтобы прочитать её прямо здесь. Для обновления данных из Notion используйте <kbd className="px-1.5 py-0.5 bg-muted rounded text-[11px] font-mono">Ctrl+J</kbd> → AI-чат.
          </p>
        </div>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по страницам Notion..."
            className="w-full pl-10 pr-8 py-2.5 bg-card border border-border rounded-lg text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#d4a373]/40"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="bg-card border border-border rounded-lg px-3 py-2 text-[12px] text-foreground">
            <option value="date">По дате</option>
            <option value="title">По названию</option>
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="bg-card border border-border rounded-lg px-3 py-2 text-[12px] text-foreground">
            <option value="all">Все типы</option>
            <option value="page">Страницы</option>
            <option value="database">Базы данных</option>
          </select>
        </div>
      </div>

      {/* Pages list */}
      <div className="space-y-3">
        {filteredPages.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium text-[14px]">{search ? "Ничего не найдено" : "Нет страниц"}</p>
            <p className="text-muted-foreground text-[12px] mt-1">
              {search ? `По запросу «${search}» не найдено страниц` : "Используйте AI-чат (Ctrl+J) для синхронизации страниц из Notion"}
            </p>
          </div>
        ) : (
          filteredPages.map((page) => (
            <PageCard key={page.id} page={page} onOpen={setOpenPage} onDelete={handleDeletePage} />
          ))
        )}
      </div>

      {/* Footer tips */}
      <div className="bg-muted/50 rounded-lg p-4 border border-border space-y-2">
        <p className="text-[13px] text-foreground font-medium flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#d4a373]" /> Возможности Notion MCP
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            "Поиск по всему воркспейсу",
            "Чтение содержимого страниц",
            "Просмотр баз данных",
            "Информация о пользователях",
            "Комментарии и обсуждения",
            "Семантический поиск",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> {f}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Попросите AI-ассистента: «Найди в Notion страницу про маркетинг» или «Покажи содержимое User Persona из Notion»
        </p>
      </div>
    </div>
  );
}