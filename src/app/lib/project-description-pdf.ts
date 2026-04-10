import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface ScreenCapture {
  label: string;
  description: string;
  dataUrl: string;
}

// Only capture the 6 most visual/important routes
const KEY_ROUTES = [
  { route: "/", label: "Проекты", description: "CRUD-управление маркетинговыми проектами с карточками, бюджетами и прогресс-барами" },
  { route: "/dashboard", label: "Аналитика", description: "Recharts-дашборд с KPI, графиками бюджетов, воронкой и каналами" },
  { route: "/smm/plan", label: "Контент-план", description: "Мультиплатформенный SMM-менеджер с D&D, AI-подписями и тремя режимами" },
  { route: "/competitors", label: "Конкуренты", description: "Конкурентный анализ с SWOT через AI, метриками трафика и ER" },
  { route: "/media", label: "Бренд-ассеты", description: "Медиабиблиотека: цвета, шрифты, логотипы, шаблоны, хэштеги, брендбук PDF" },
  { route: "/tools/metrics", label: "AI Метрики", description: "AI-анализ CAC, LTV, ROI через GPT-4o-mini с рекомендациями" },
];

const ALL_FEATURES = [
  "13 модулей: проекты, аналитика, SMM (план + идеи + инфлюенсеры), конкуренты, A/B тесты, бренд-ассеты, 4 AI-инструмента, настройки",
  "CRUD проектов с табами: кампании, аудитории, метрики, отчёты",
  "Аналитический дашборд: KPI-карточки, Bar/Pie/Area-графики (Recharts)",
  "Контент-план: таблица + календарь + дашборд, 7 платформ, drag & drop идей, AI-подписи, CSV-экспорт",
  "Банк идей с AI-генерацией, категориями, тегами, переносом в план",
  "Инфлюенс-CRM: профили блогеров, статусы коллабораций, бюджет, ER",
  "Конкурентный анализ: SWOT через AI, трафик, DR, соцсети",
  "A/B тесты: конверсии, CTR, AOV, определение победителя",
  "Бренд-ассеты: 7 типов (цвета/шрифты/лого/шаблоны/гайдлайны/копирайт/хэштеги), генерация брендбука PDF",
  "4 AI-инструмента: метрики, бюджет, ЦА-аватары, триггеры из отзывов",
  "Command Palette (Cmd+K), центр уведомлений, тёмная/светлая тема",
  "PDF со скриншотами, CSV с BOM, Markdown-рендеринг, Motion-анимации",
  "Retry-логика API (3 попытки), Pipedream webhook, Google Fonts API",
];

const TECH_STACK = [
  ["React 18 + Router 7", "UI, Data Mode маршрутизация"],
  ["Tailwind CSS v4", "Утилитарные стили + CSS переменные"],
  ["Supabase", "Edge Functions, Hono, KV Store"],
  ["OpenAI GPT-4o-mini", "AI-генерация, анализ, SWOT"],
  ["Recharts", "Bar, Pie, Area графики"],
  ["react-dnd", "Drag & Drop в контент-плане"],
  ["jsPDF + html2canvas", "PDF экспорт со скриншотами"],
  ["Motion", "Анимации переходов"],
  ["cmdk / next-themes", "Command Palette / Темы"],
  ["Sonner / Lucide", "Тосты / Иконки"],
];

export async function downloadProjectDescriptionPDF(
  navigateFn: (path: string) => void,
  mainContentRef: HTMLElement | null,
  onProgress?: (step: string, current: number, total: number) => void,
): Promise<number> {
  const total = KEY_ROUTES.length + 2;
  let cur = 0;
  const originalPath = window.location.pathname;

  // 1. Capture screenshots
  const captures: ScreenCapture[] = [];
  for (const r of KEY_ROUTES) {
    cur++;
    onProgress?.(`${r.label}`, cur, total);
    navigateFn(r.route);
    await sleep(1000);

    let dataUrl = "";
    if (mainContentRef) {
      try {
        mainContentRef.scrollTop = 0;
        await sleep(300);
        const canvas = await html2canvas(mainContentRef, {
          scale: 1.5,
          useCORS: true,
          backgroundColor: null,
          logging: false,
          width: mainContentRef.clientWidth,
          height: Math.min(mainContentRef.scrollHeight, 800),
        });
        dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      } catch (e) {
        console.warn(`Capture failed: ${r.route}`, e);
      }
    }
    captures.push({ label: r.label, description: r.description, dataUrl });
  }
  navigateFn(originalPath);

  // 2. Build PDF HTML
  cur++;
  onProgress?.("Сборка PDF", cur, total);

  const A = "#d4a373";
  const AD = "#a87040";
  const BG = "#faf7f4";
  const DK = "#2a2420";
  const G = "#7a7a7a";
  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const scCount = captures.filter(c => c.dataUrl).length;

  let html = "";

  // ── COVER ──
  html += `
    <div style="background:linear-gradient(135deg,${DK} 0%,#1a1a1a 100%);padding:60px;min-height:420px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px;">
          <div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,${A},${AD});display:flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-size:24px;font-weight:800;">MP</span>
          </div>
          <div>
            <div style="font-size:36px;font-weight:800;color:#f0e0d0;letter-spacing:-0.5px;">MarketPlan</div>
            <div style="font-size:14px;color:rgba(240,224,208,0.6);">AI-powered Marketing Planner</div>
          </div>
        </div>
        <div style="width:60px;height:3px;background:${A};border-radius:2px;margin-bottom:24px;"></div>
        <div style="font-size:13px;color:rgba(240,224,208,0.35);text-transform:uppercase;letter-spacing:2px;">Документация · ${today}</div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${badge("Версия", "1.0")}${badge("Стек", "React + Supabase")}${badge("AI", "GPT-4o-mini")}${badge("Модулей", "13")}${badge("Скриншоты", String(scCount))}
      </div>
    </div>
  `;

  // ── ABOUT + ARCHITECTURE ──
  html += `
    <div style="padding:40px 60px;">
      ${secH("1", "О проекте")}
      <p style="font-size:13px;color:#3a3a3a;margin:0 0 24px;line-height:1.7;">
        <strong>MarketPlan</strong> - маркетинговый планер нового поколения из 13 модулей, объединяющий
        стратегическое планирование, SMM, аналитику, конкурентный анализ, A/B тестирование,
        бренд-менеджмент и AI-инструменты в data-dense интерфейсе с тёплой графитно-янтарной палитрой.
      </p>

      ${secH("2", "Архитектура")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;">
        ${archBox("Frontend", "React 18, Router 7 (Data Mode), Tailwind v4, Motion")}
        ${archBox("Backend", "Supabase Edge Functions, Hono, KV Store")}
        ${archBox("AI Engine", "GPT-4o-mini, серверные прокси, retry back-off")}
        ${archBox("Toolkit", "Recharts, react-dnd, cmdk, Sonner, Lucide, next-themes")}
      </div>

      ${secH("3", "Все возможности")}
      <div style="margin-bottom:24px;">
        ${ALL_FEATURES.map(f => feat(f)).join("")}
      </div>
    </div>
  `;

  // ── SCREENSHOTS ──
  const screensWithData = captures.filter(c => c.dataUrl);
  if (screensWithData.length > 0) {
    html += `<div style="padding:0 60px 8px;">
      ${secH("4", "Экраны приложения")}
      <p style="font-size:12px;color:${G};margin:0 0 16px;">Скриншоты ${scCount} ключевых разделов, сделанные в реальном времени.</p>
    </div>`;

    screensWithData.forEach((cap, i) => {
      html += `
        <div style="padding:8px 60px 20px;">
          <div style="font-size:13px;font-weight:700;color:${DK};margin-bottom:6px;">${cap.label}</div>
          <div style="font-size:11px;color:${G};margin-bottom:8px;">${cap.description}</div>
          <div style="border:1px solid #e0d8d0;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="background:${DK};padding:5px 12px;display:flex;align-items:center;gap:5px;">
              <div style="width:7px;height:7px;border-radius:50%;background:#ff5f57;"></div>
              <div style="width:7px;height:7px;border-radius:50%;background:#febc2e;"></div>
              <div style="width:7px;height:7px;border-radius:50%;background:#28c840;"></div>
              <span style="font-size:9px;color:rgba(255,255,255,0.4);margin-left:8px;">${cap.label}</span>
            </div>
            <img src="${cap.dataUrl}" style="width:100%;display:block;" />
          </div>
        </div>
      `;
    });
  }

  // ── TECH STACK ──
  html += `
    <div style="padding:24px 60px;">
      ${secH("5", "Технологический стек")}
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
        <thead><tr style="background:${DK};color:#f0e0d0;">
          <th style="padding:7px 14px;text-align:left;border-radius:6px 0 0 0;">Технология</th>
          <th style="padding:7px 14px;text-align:left;border-radius:0 6px 0 0;">Назначение</th>
        </tr></thead>
        <tbody>
          ${TECH_STACK.map(([tech, desc], i) => `
            <tr style="background:${i % 2 ? BG : "#fff"};">
              <td style="padding:6px 14px;border-bottom:1px solid #ede6df;font-weight:600;color:${DK};">${tech}</td>
              <td style="padding:6px 14px;border-bottom:1px solid #ede6df;color:#5a5a5a;">${desc}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      ${secH("6", "Поток данных")}
      <div style="background:${BG};border:1px solid #e0d8d0;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
        <div style="font-size:11px;font-family:monospace;color:${AD};padding:8px 12px;background:#fff;border-radius:5px;border:1px solid #e0d8d0;margin-bottom:10px;">
          Frontend (React) → fetchWithRetry (3x back-off) → Hono Edge Function → KV Store / OpenAI
        </div>
        <p style="font-size:11px;color:#5a5a5a;margin:0;line-height:1.5;">
          Ключи: projects:list, smm:content_plan, influencers:list, competitors:list, abtests:list, brand:assets.
          AI-запросы проксируются через серверные эндпоинты.
        </p>
      </div>

      <div style="border-top:2px solid ${A};padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:13px;font-weight:700;color:${AD};">MarketPlan</span>
          <span style="font-size:11px;color:${G};margin-left:6px;">13 модулей · ${scCount} скриншотов</span>
        </div>
        <span style="font-size:10px;color:${G};">${today}</span>
      </div>
    </div>
  `;

  // ── RENDER ──
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a1a;line-height:1.5;";
  container.innerHTML = `<div style="padding:0;margin:0;">${html}</div>`;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
    document.body.removeChild(container);

    cur++;
    onProgress?.("Сохранение", cur, total);

    const imgData = canvas.toDataURL("image/jpeg", 0.90);
    const pdf = new jsPDF("p", "mm", "a4");
    const pW = 210, pH = 297;
    const iW = pW;
    const iH = (canvas.height * pW) / canvas.width;
    let pos = 0, page = 0;
    while (pos < iH) {
      if (page > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, -pos, iW, iH);
      pos += pH;
      page++;
    }
    pdf.save(`MarketPlan-${new Date().toISOString().slice(0, 10)}.pdf`);
    return page;
  } catch (err) {
    document.body.removeChild(container);
    throw err;
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function badge(l: string, v: string) {
  return `<div style="background:rgba(212,163,115,0.12);border:1px solid rgba(212,163,115,0.2);border-radius:6px;padding:6px 14px;">
    <div style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;">${l}</div>
    <div style="font-size:14px;color:#f0e0d0;font-weight:700;margin-top:1px;">${v}</div>
  </div>`;
}

function secH(n: string, t: string) {
  return `<div style="display:flex;align-items:center;gap:10px;margin:6px 0 12px;">
    <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#d4a373,#a87040);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0;">${n}</div>
    <div style="font-size:18px;font-weight:700;color:#2a2420;">${t}</div>
    <div style="flex:1;height:2px;background:linear-gradient(90deg,#d4a373,transparent);"></div>
  </div>`;
}

function archBox(l: string, d: string) {
  return `<div style="background:#faf7f4;border:1px solid #e0d8d0;border-radius:8px;padding:10px 14px;">
    <div style="font-size:10px;font-weight:700;color:#a87040;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">${l}</div>
    <div style="font-size:11px;color:#4a4a4a;line-height:1.4;">${d}</div>
  </div>`;
}

function feat(t: string) {
  return `<div style="display:flex;align-items:flex-start;gap:7px;padding:2.5px 0;">
    <div style="width:4px;height:4px;border-radius:50%;background:#d4a373;margin-top:6px;flex-shrink:0;"></div>
    <span style="font-size:11.5px;color:#3a3a3a;line-height:1.4;">${t}</span>
  </div>`;
}