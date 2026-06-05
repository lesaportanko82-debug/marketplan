import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Edit3, Trash2, Search, X, Check, Loader2, FolderOpen, Tag, Copy,
  Palette, FileText, Grid3X3, List, Star, Hash, Type, Image, Eye,
  Download, ExternalLink, RefreshCw, Maximize2, ChevronDown, BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "../lib/clipboard";
import { getData, saveData } from "../lib/api";
import { AddToProjectButton } from "./AddToProjectModal";
import { generateBrandbookPDF } from "../lib/brandbook-pdf";
import { EmptyState } from "./EmptyState";

interface BrandAsset {
  id: string;
  name: string;
  type: "color" | "font" | "logo" | "template" | "guideline" | "copy" | "hashtag";
  value: string;
  description: string;
  tags: string[];
  starred: boolean;
  category: string;
  createdAt: string;
}

const STORAGE_KEY = "brand:assets";
const ASSET_TYPES = [
  { type: "color", label: "Цвет", icon: Palette },
  { type: "font", label: "Шрифт", icon: Type },
  { type: "logo", label: "Логотип", icon: Image },
  { type: "template", label: "Шаблон", icon: FileText },
  { type: "guideline", label: "Гайдлайн", icon: FolderOpen },
  { type: "copy", label: "Копирайт", icon: Copy },
  { type: "hashtag", label: "Хэштеги", icon: Hash },
] as const;

const TYPE_ICONS: Record<string, any> = { color: Palette, font: Type, logo: Image, template: FileText, guideline: FolderOpen, copy: Copy, hashtag: Hash };
const TYPE_LABELS: Record<string, string> = { color: "Цвет", font: "Шрифт", logo: "Логотип", template: "Шаблон", guideline: "Гайдлайн", copy: "Копирайт", hashtag: "Хэштеги" };
const TYPE_COLORS: Record<string, string> = {
  color: "bg-amber-500/10 text-amber-700", font: "bg-teal-500/10 text-teal-600", logo: "bg-teal-500/10 text-teal-600",
  template: "bg-amber-500/10 text-amber-600", guideline: "bg-emerald-500/10 text-emerald-600", copy: "bg-orange-500/10 text-orange-600",
  hashtag: "bg-teal-500/10 text-teal-600",
};
const CATEGORIES = ["Все", "Бренд", "Соцсети", "Реклама", "Email", "Сайт", "Печать", "Другое"];

const FONT_SAMPLES = "Быстрая коричневая лиса AaBb 123";
const GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Montserrat", "Lato", "Raleway", "Poppins",
  "Nunito", "Oswald", "Playfair Display", "Merriweather", "PT Sans", "Rubik",
  "Ubuntu", "Fira Code", "JetBrains Mono", "Source Code Pro", "Noto Sans",
  "Mulish", "Quicksand", "Comfortaa", "Pacifico", "Lobster", "Caveat",
  "Dancing Script", "Permanent Marker", "Satisfy", "Bebas Neue", "Abril Fatface",
  "Righteous", "Russo One", "Bungee",
  "Josefin Sans", "Jost", "Manrope", "DM Sans", "Work Sans", "Space Grotesk",
  "IBM Plex Sans", "IBM Plex Mono", "Outfit", "Sora", "Lexend", "Figtree",
];
const SYSTEM_FONTS = [
  "Arial", "Georgia", "Times New Roman", "Courier New", "Verdana",
  "Trebuchet MS", "Impact", "Tahoma", "Segoe UI", "Helvetica",
];
const ALL_FONTS = [...GOOGLE_FONTS, ...SYSTEM_FONTS];

const emptyAsset = (): BrandAsset => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  name: "", type: "color", value: "#1a7a6d", description: "", tags: [],
  starred: false, category: "Бренд", createdAt: new Date().toISOString(),
});


  // (removed demo data)\n\nВы сделали отличный выбор. Вот что вас ждёт:\n\n1. AI-аналитика маркетинга\n2. Умный контент-план\n3. Отслеживание конкурентов\n\nС наилучшими пожеланиями,\nКоманда MarketPlan", description: "Приветственное письмо для новых пользователей", tags: ["email", "welcome"], starred: false, category: "Email", createdAt: new Date().toISOString() },
  // (removed demo data 2) сложное простыми словами\n• Дружелюбно, но профессионально - без панибратства\n• Уверенно, но не высокомерно - делимся знаниями, а не хвастаемся\n\nМы НЕ используем:\n• Канцеляризмы и бюрократический язык\n• Сленг и жаргон без необходимости\n• Негативные формулировки ('не упустите' → 'успейте')\n\nПримеры:\n✅ 'Разберём 5 стратегий, которые помогут вашему бизнесу расти'\n❌ 'ТОП-5 СЕКРЕТОВ для ВЗРЫВА продаж!!!'", description: "Руководство по тону коммуникации бренда", tags: ["голос", "тон", "стиль"], starred: true, category: "Бренд", createdAt: new Date().toISOString() },
// Load Google Font dynamically
function loadGoogleFont(fontName: string) {
  const id = `gfont-${fontName.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

export function MediaLibrary() {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("Все");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<BrandAsset | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [preview, setPreview] = useState<BrandAsset | null>(null);
  const [showBrandbook, setShowBrandbook] = useState(false);

  useEffect(() => {
    getData<BrandAsset[]>(STORAGE_KEY).then(d => {
      if (d && Array.isArray(d) && d.length > 0) setAssets(d);
      else setAssets([]);
      setLoading(false);
    }).catch(() => { setAssets([]); setLoading(false); });
  }, []);

  useEffect(() => {
    assets.filter(a => a.type === "font").forEach(a => loadGoogleFont(a.value));
  }, [assets]);

  const save = useCallback((next: BrandAsset[]) => { setAssets(next); saveData(STORAGE_KEY, next); }, []);
  const handleAdd = (a: BrandAsset) => { save([a, ...assets]); setShowAdd(false); toast.success(`Ассет «${a.name}» добавлен`); };
  const handleUpdate = (a: BrandAsset) => { save(assets.map(x => x.id === a.id ? a : x)); setEditing(null); toast.success("Обновлено"); };
  const handleDelete = (id: string) => { save(assets.filter(x => x.id !== id)); setPreview(null); toast.success("Ассет удалён"); };
  const toggleStar = (id: string) => { save(assets.map(a => a.id === id ? { ...a, starred: !a.starred } : a)); };

  const filtered = assets.filter(a => {
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (catFilter !== "Все" && a.category !== catFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return a.name.toLowerCase().includes(s) || a.value.toLowerCase().includes(s) || a.tags.some(t => t.toLowerCase().includes(s)) || a.description.toLowerCase().includes(s);
  });

  const copyValue = (val: string, label?: string) => {
    copyToClipboard(val).then(() => toast.success(label || "Скопировано в буфер"));
  };

  const stats = {
    total: assets.length,
    colors: assets.filter(a => a.type === "color").length,
    fonts: assets.filter(a => a.type === "font").length,
    logos: assets.filter(a => a.type === "logo").length,
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 sm:p-5 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-foreground text-xl font-semibold flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-[#d4a373] to-[#a87040] flex items-center justify-center shrink-0">
              <Palette className="w-4 h-4 text-white" />
            </div>
            Бренд-ассеты
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1 ml-11 hidden sm:block">
            {stats.total} ассетов · {stats.colors} цветов · {stats.fonts} шрифтов · {stats.logos} лого
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowBrandbook(true)} className="flex items-center gap-2 h-9 bg-card border border-border text-foreground px-3 rounded-lg text-[13px] hover:bg-muted transition-colors">
            <BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Брендбук</span> PDF
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 h-9 bg-primary text-primary-foreground px-3.5 rounded-lg text-[13px] hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Search + view */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск ассетов..."
              className="w-full h-9 bg-card border border-border rounded-lg pl-9 pr-3 text-foreground text-[13px] placeholder:text-muted-foreground" />
          </div>
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
            <button onClick={() => setView("grid")} className={`p-1.5 rounded-md transition-colors ${view === "grid" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><Grid3X3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => setView("list")} className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><List className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        {/* Type filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button onClick={() => setTypeFilter("all")}
            className={`shrink-0 h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${typeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            Все
          </button>
          {ASSET_TYPES.map(t => (
            <button key={t.type} onClick={() => setTypeFilter(typeFilter === t.type ? "all" : t.type)}
              className={`shrink-0 h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${typeFilter === t.type ? TYPE_COLORS[t.type] : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="w-3 h-3" />{t.label}
            </button>
          ))}
        </div>
        {/* Category tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              className={`shrink-0 h-7 px-3 rounded-md text-[12px] transition-colors ${catFilter === c ? "bg-card text-foreground border border-border shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState
          title={assets.length === 0 ? "Библиотека бренда пуста" : "Ничего не найдено"}
          description={assets.length === 0 ? "Добавьте цвета, шрифты, шаблоны и хэштеги вашего бренда" : "Попробуйте изменить фильтры или поисковый запрос"}
          emotion={assets.length === 0 ? "idle" : "think"}
          action={assets.length === 0 ? { label: "Добавить ассет", onClick: () => setShowAdd(true), icon: <Plus className="w-4 h-4" /> } : undefined}
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(asset => (
            <AssetCard key={asset.id} asset={asset} onToggleStar={toggleStar} onEdit={setEditing} onDelete={handleDelete} onCopy={copyValue} onPreview={setPreview} />
          ))}
        </div>
      ) : (
        <AssetListView assets={filtered} onToggleStar={toggleStar} onEdit={setEditing} onDelete={handleDelete} onCopy={copyValue} onPreview={setPreview} />
      )}

      {/* Modals */}
      {(showAdd || editing) && (
        <AssetModal asset={editing || emptyAsset()} isNew={showAdd} onSave={a => showAdd ? handleAdd(a) : handleUpdate(a)} onClose={() => { setShowAdd(false); setEditing(null); }} />
      )}
      {preview && (
        <PreviewModal asset={preview} onClose={() => setPreview(null)} onCopy={copyValue} onEdit={(a) => { setPreview(null); setEditing(a); }} />
      )}
      {showBrandbook && (
        <BrandbookModal assets={assets} onClose={() => setShowBrandbook(false)} />
      )}
    </div>
  );
}

// ========================
// Brandbook Generator Modal
// ========================
function BrandbookModal({ assets, onClose }: { assets: BrandAsset[]; onClose: () => void }) {
  const [brandName, setBrandName] = useState("MarketPlan");
  const [tagline, setTagline] = useState("AI-powered Marketing Planner");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [sections, setSections] = useState({
    includeColors: true,
    includeFonts: true,
    includeLogos: true,
    includeCopy: true,
    includeTemplates: true,
    includeGuidelines: true,
    includeHashtags: true,
  });

  const counts = {
    colors: assets.filter(a => a.type === "color").length,
    fonts: assets.filter(a => a.type === "font").length,
    logos: assets.filter(a => a.type === "logo").length,
    copy: assets.filter(a => a.type === "copy").length,
    templates: assets.filter(a => a.type === "template").length,
    guidelines: assets.filter(a => a.type === "guideline").length,
    hashtags: assets.filter(a => a.type === "hashtag").length,
  };

  const totalIncluded = Object.entries(sections).reduce((sum, [key, val]) => {
    if (!val) return sum;
    const map: Record<string, keyof typeof counts> = {
      includeColors: "colors", includeFonts: "fonts", includeLogos: "logos",
      includeCopy: "copy", includeTemplates: "templates", includeGuidelines: "guidelines", includeHashtags: "hashtags",
    };
    return sum + (counts[map[key]] || 0);
  }, 0);

  const sectionItems = [
    { key: "includeColors", label: "Цветовая палитра", count: counts.colors, icon: Palette, color: "text-amber-600" },
    { key: "includeFonts", label: "Типографика", count: counts.fonts, icon: Type, color: "text-teal-500" },
    { key: "includeLogos", label: "Логотипы", count: counts.logos, icon: Image, color: "text-teal-600" },
    { key: "includeCopy", label: "Ключевые сообщения", count: counts.copy, icon: Copy, color: "text-orange-500" },
    { key: "includeTemplates", label: "Шаблоны контента", count: counts.templates, icon: FileText, color: "text-amber-500" },
    { key: "includeGuidelines", label: "Гайдлайны", count: counts.guidelines, icon: FolderOpen, color: "text-emerald-500" },
    { key: "includeHashtags", label: "Хэштег-наборы", count: counts.hashtags, icon: Hash, color: "text-teal-500" },
  ];

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress("Подготовка...");
    try {
      const pages = await generateBrandbookPDF(assets, { brandName, tagline, ...sections }, setProgress);
      toast.success(`Брендбук скачан - ${pages} стр.`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Ошибка генерации брендбука");
    } finally {
      setGenerating(false);
      setProgress("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4a373] to-[#a87040] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-foreground text-[15px] font-semibold">Сформировать брендбук</h3>
              <p className="text-muted-foreground text-[12px]">Экспорт бренд-ассетов в PDF</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Brand info */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">Название бренда</label>
              <input value={brandName} onChange={e => setBrandName(e.target.value)}
                className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 text-foreground text-[14px] font-medium" />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">Подзаголовок / слоган</label>
              <input value={tagline} onChange={e => setTagline(e.target.value)}
                className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 text-foreground text-[13px]" />
            </div>
          </div>

          {/* Sections toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-muted-foreground font-medium">Разделы брендбука</span>
              <span className="text-[11px] text-muted-foreground">{totalIncluded} ассетов</span>
            </div>
            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
              {sectionItems.map(item => {
                const checked = sections[item.key as keyof typeof sections];
                const Icon = item.icon;
                return (
                  <label key={item.key} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? "bg-card" : "bg-muted/20 opacity-60"}`}>
                    <input type="checkbox" checked={checked}
                      onChange={e => setSections(s => ({ ...s, [item.key]: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded border-border accent-[#d4a373] shrink-0" />
                    <Icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                    <span className="text-[13px] text-foreground flex-1">{item.label}</span>
                    <span className={`text-[11px] tabular-nums px-2 py-0.5 rounded-full shrink-0 ${item.count > 0 ? "bg-muted text-muted-foreground" : "bg-red-500/10 text-red-500"}`}>
                      {item.count}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Preview tree */}
          <div className="bg-muted/20 rounded-lg p-3 border border-border text-[12px]">
            <div className="text-muted-foreground mb-1.5">Структура документа:</div>
            <div className="text-foreground font-medium mb-1">📘 {brandName}</div>
            <div className="text-muted-foreground pl-4 space-y-0.5">
              <div>├ Обложка</div>
              <div>├ Содержание</div>
              {sectionItems.filter(s => sections[s.key as keyof typeof sections] && s.count > 0).map((s, i, arr) => (
                <div key={s.key}>{i === arr.length - 1 ? "└" : "├"} {s.label} ({s.count})</div>
              ))}
            </div>
          </div>

          {generating && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-primary/5 rounded-lg border border-primary/10">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              <span className="text-[13px] text-foreground">{progress}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <span className="text-[11px] text-muted-foreground">~{Math.max(2, Math.ceil(totalIncluded / 3))} стр.</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-9 px-4 text-[13px] text-muted-foreground hover:text-foreground transition-colors">Отмена</button>
            <button
              onClick={handleGenerate}
              disabled={generating || totalIncluded === 0 || !brandName.trim()}
              className="flex items-center gap-2 h-9 bg-gradient-to-r from-[#d4a373] to-[#a87040] text-white px-5 rounded-lg text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерация...</> : <><Download className="w-4 h-4" /> Скачать</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================
// Asset Card (Grid)
// ========================
function AssetCard({ asset, onToggleStar, onEdit, onDelete, onCopy, onPreview }: {
  asset: BrandAsset; onToggleStar: (id: string) => void; onEdit: (a: BrandAsset) => void;
  onDelete: (id: string) => void; onCopy: (val: string, label?: string) => void; onPreview: (a: BrandAsset) => void;
}) {
  const TIcon = TYPE_ICONS[asset.type] || FileText;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/20 transition-all group flex flex-col">
      {/* Preview Area - fixed height */}
      <div className="h-28 shrink-0 cursor-pointer" onClick={() => onPreview(asset)}>
        {asset.type === "color" && <ColorPreview value={asset.value} />}
        {asset.type === "font" && <FontPreview value={asset.value} />}
        {asset.type === "logo" && <LogoPreview value={asset.value} name={asset.name} />}
        {asset.type === "template" && <TemplatePreview value={asset.value} />}
        {asset.type === "guideline" && <GuidelinePreview value={asset.value} />}
        {asset.type === "copy" && <CopyPreview value={asset.value} />}
        {asset.type === "hashtag" && <HashtagPreview value={asset.value} />}
      </div>
      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex-1 min-w-0">
            <h4 className="text-foreground text-[13px] font-medium truncate leading-tight">{asset.name}</h4>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLORS[asset.type]}`}>
                <TIcon className="w-2.5 h-2.5" />{TYPE_LABELS[asset.type]}
              </span>
              <span className="text-[10px] text-muted-foreground">{asset.category}</span>
            </div>
          </div>
          <button onClick={() => onToggleStar(asset.id)} className={`p-0.5 shrink-0 ${asset.starred ? "text-amber-500" : "text-muted-foreground/30 group-hover:text-muted-foreground"}`}>
            <Star className="w-3.5 h-3.5" fill={asset.starred ? "currentColor" : "none"} />
          </button>
        </div>
        {asset.description && <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-snug">{asset.description}</p>}
        {asset.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2">
            {asset.tags.slice(0, 3).map(t => <span key={t} className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">{t}</span>)}
            {asset.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{asset.tags.length - 3}</span>}
          </div>
        )}
        {/* Actions */}
        <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-border">
          <button onClick={() => onCopy(asset.value, `«${asset.name}» скопирован`)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <Copy className="w-3 h-3" />Копировать
          </button>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <AddToProjectButton itemType="media_asset" itemId={asset.id} itemTitle={asset.name} />
            <button onClick={() => onPreview(asset)} className="p-1 text-muted-foreground hover:text-foreground"><Eye className="w-3 h-3" /></button>
            <button onClick={() => onEdit(asset)} className="p-1 text-muted-foreground hover:text-foreground"><Edit3 className="w-3 h-3" /></button>
            <button onClick={() => onDelete(asset.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================
// Type-specific Previews
// ========================
function ColorPreview({ value }: { value: string }) {
  const rgb = hexToRgb(value);
  const hsl = hexToHsl(value);
  return (
    <div className="h-full relative" style={{ background: value }}>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2.5">
        <div className="text-white text-[13px] font-mono font-semibold">{value.toUpperCase()}</div>
        <div className="text-white/70 text-[10px] font-mono">
          {rgb && `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`} · {hsl && `HSL(${hsl.h}°, ${hsl.s}%, ${hsl.l}%)`}
        </div>
      </div>
    </div>
  );
}

function FontPreview({ value }: { value: string }) {
  return (
    <div className="h-full bg-muted/30 p-3 flex flex-col justify-between">
      <div style={{ fontFamily: `"${value}", sans-serif` }} className="text-foreground text-[22px] font-semibold leading-tight truncate">Aa Бб Вв</div>
      <div style={{ fontFamily: `"${value}", sans-serif` }} className="text-foreground/70 text-[12px] leading-tight truncate">{FONT_SAMPLES}</div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{value}</span>
        <div className="flex gap-1">
          <span style={{ fontFamily: `"${value}", sans-serif`, fontWeight: 400 }} className="text-[10px] text-muted-foreground">Reg</span>
          <span style={{ fontFamily: `"${value}", sans-serif`, fontWeight: 700 }} className="text-[10px] text-foreground font-bold">Bold</span>
        </div>
      </div>
    </div>
  );
}

function LogoPreview({ value, name }: { value: string; name: string }) {
  const [error, setError] = useState(false);
  return (
    <div className="h-full bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[length:16px_16px] flex items-center justify-center p-3">
      {!error ? (
        <img src={value} alt={name} className="max-h-full max-w-full object-contain rounded" onError={() => setError(true)} />
      ) : (
        <div className="flex flex-col items-center gap-1 text-muted-foreground"><Image className="w-6 h-6 opacity-40" /><span className="text-[10px]">Ошибка загрузки</span></div>
      )}
    </div>
  );
}

function TemplatePreview({ value }: { value: string }) {
  return (
    <div className="h-full bg-muted/20 p-3 overflow-hidden relative">
      <div className="text-[11px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{value.slice(0, 180)}</div>
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent" />
      <div className="absolute top-2 right-2"><FileText className="w-4 h-4 text-amber-500/40" /></div>
    </div>
  );
}

function GuidelinePreview({ value }: { value: string }) {
  return (
    <div className="h-full bg-emerald-500/5 p-3 overflow-hidden relative border-l-[3px] border-emerald-500/30">
      <div className="text-[10px] text-foreground/70 whitespace-pre-wrap leading-relaxed font-mono">{value.slice(0, 200)}</div>
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent" />
      <div className="absolute top-2 right-2"><FolderOpen className="w-4 h-4 text-emerald-500/40" /></div>
    </div>
  );
}

function CopyPreview({ value }: { value: string }) {
  return (
    <div className="h-full bg-orange-500/5 p-3 overflow-hidden relative flex items-center">
      <div className="text-[13px] text-foreground/90 italic leading-relaxed line-clamp-3">
        &ldquo;{value}&rdquo;
      </div>
    </div>
  );
}

function HashtagPreview({ value }: { value: string }) {
  const tags = value.split(/\s+/).filter(t => t.startsWith("#"));
  return (
    <div className="h-full bg-teal-500/5 p-3 overflow-hidden relative">
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, 8).map((tag, i) => (
          <span key={i} className="inline-block bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-full text-[11px]">{tag}</span>
        ))}
        {tags.length > 8 && <span className="text-[11px] text-muted-foreground">+{tags.length - 8}</span>}
      </div>
      <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">{tags.length} тегов</div>
    </div>
  );
}

// ========================
// List View
// ========================
function AssetListView({ assets, onToggleStar, onEdit, onDelete, onCopy, onPreview }: {
  assets: BrandAsset[]; onToggleStar: (id: string) => void; onEdit: (a: BrandAsset) => void;
  onDelete: (id: string) => void; onCopy: (val: string, label?: string) => void; onPreview: (a: BrandAsset) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-x-auto">
      <table className="w-full text-[12px] min-w-[640px]">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2.5 px-3 w-8"></th>
            <th className="py-2.5 px-3 w-14">Превью</th>
            <th className="py-2.5 px-3">Название</th>
            <th className="py-2.5 px-3 w-24">Тип</th>
            <th className="py-2.5 px-3 w-24">Категория</th>
            <th className="py-2.5 px-3 w-32">Теги</th>
            <th className="py-2.5 px-3 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {assets.map(asset => {
            const TIcon = TYPE_ICONS[asset.type];
            return (
              <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-muted/20 group">
                <td className="py-2 px-3">
                  <button onClick={() => onToggleStar(asset.id)} className={asset.starred ? "text-amber-500" : "text-muted-foreground/30 group-hover:text-muted-foreground"}>
                    <Star className="w-3 h-3" fill={asset.starred ? "currentColor" : "none"} />
                  </button>
                </td>
                <td className="py-2 px-3">
                  <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => onPreview(asset)}>
                    {asset.type === "color" ? (
                      <div className="w-full h-full rounded-lg border border-border" style={{ background: asset.value }} />
                    ) : asset.type === "font" ? (
                      <div className="w-full h-full bg-muted/30 flex items-center justify-center" style={{ fontFamily: `"${asset.value}", sans-serif` }}>
                        <span className="text-[14px] font-semibold text-foreground">Аа</span>
                      </div>
                    ) : asset.type === "logo" ? (
                      <img src={asset.value} alt="" className="w-full h-full object-cover rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${TYPE_COLORS[asset.type]} rounded-lg`}>
                        <TIcon className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3">
                  <div className="text-foreground font-medium cursor-pointer hover:underline truncate max-w-[200px]" onClick={() => onPreview(asset)}>{asset.name}</div>
                  {asset.description && <div className="text-muted-foreground text-[11px] truncate max-w-[200px]">{asset.description}</div>}
                </td>
                <td className="py-2 px-3">
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${TYPE_COLORS[asset.type]}`}>
                    <TIcon className="w-2.5 h-2.5" />{TYPE_LABELS[asset.type]}
                  </span>
                </td>
                <td className="py-2 px-3 text-muted-foreground">{asset.category}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-1 flex-wrap">
                    {asset.tags.slice(0, 2).map(t => <span key={t} className="bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">{t}</span>)}
                    {asset.tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{asset.tags.length - 2}</span>}
                  </div>
                </td>
                <td className="py-2 px-3">
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <AddToProjectButton itemType="media_asset" itemId={asset.id} itemTitle={asset.name} />
                    <button onClick={() => onCopy(asset.value, `«${asset.name}» скопирован`)} className="p-1 text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                    <button onClick={() => onPreview(asset)} className="p-1 text-muted-foreground hover:text-foreground"><Eye className="w-3 h-3" /></button>
                    <button onClick={() => onEdit(asset)} className="p-1 text-muted-foreground hover:text-foreground"><Edit3 className="w-3 h-3" /></button>
                    <button onClick={() => onDelete(asset.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ========================
// Preview Modal
// ========================
function PreviewModal({ asset, onClose, onCopy, onEdit }: {
  asset: BrandAsset; onClose: () => void; onCopy: (val: string, label?: string) => void; onEdit: (a: BrandAsset) => void;
}) {
  const TIcon = TYPE_ICONS[asset.type] || FileText;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLORS[asset.type]}`}>
              <TIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-foreground text-[15px] font-semibold truncate">{asset.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLORS[asset.type]}`}>{TYPE_LABELS[asset.type]}</span>
                <span className="text-[11px] text-muted-foreground">{asset.category}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          {asset.type === "color" && <ColorFullPreview value={asset.value} />}
          {asset.type === "font" && <FontFullPreview value={asset.value} />}
          {asset.type === "logo" && <LogoFullPreview value={asset.value} name={asset.name} />}
          {asset.type === "template" && <TextFullPreview value={asset.value} />}
          {asset.type === "guideline" && <TextFullPreview value={asset.value} />}
          {asset.type === "copy" && <CopyFullPreview value={asset.value} />}
          {asset.type === "hashtag" && <HashtagFullPreview value={asset.value} onCopy={onCopy} />}
          {asset.description && (
            <div className="mt-4 p-3 bg-muted/20 rounded-lg">
              <p className="text-[12px] text-muted-foreground">{asset.description}</p>
            </div>
          )}
          {asset.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-3">
              {asset.tags.map(t => <span key={t} className="bg-muted px-2 py-0.5 rounded-full text-[11px] text-muted-foreground">{t}</span>)}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between p-5 border-t border-border">
          <span className="text-[11px] text-muted-foreground">Создан: {new Date(asset.createdAt).toLocaleDateString("ru-RU")}</span>
          <div className="flex gap-2">
            <button onClick={() => onCopy(asset.value, `«${asset.name}» скопирован`)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Copy className="w-3.5 h-3.5" />Копировать
            </button>
            <button onClick={() => onEdit(asset)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
              <Edit3 className="w-3.5 h-3.5" />Редактировать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Full preview components
function ColorFullPreview({ value }: { value: string }) {
  const rgb = hexToRgb(value);
  const hsl = hexToHsl(value);
  const tints = generateTints(value, 5);
  const shades = generateShades(value, 5);
  return (
    <div className="space-y-4">
      <div className="h-32 rounded-xl relative overflow-hidden" style={{ background: value }}>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4">
          <span className="text-white text-[18px] font-mono font-bold">{value.toUpperCase()}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/20 rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground mb-1">HEX</div>
          <div className="text-[13px] text-foreground font-mono">{value.toUpperCase()}</div>
        </div>
        <div className="bg-muted/20 rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground mb-1">RGB</div>
          <div className="text-[13px] text-foreground font-mono">{rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : "-"}</div>
        </div>
        <div className="bg-muted/20 rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground mb-1">HSL</div>
          <div className="text-[13px] text-foreground font-mono">{hsl ? `${hsl.h}°, ${hsl.s}%, ${hsl.l}%` : "-"}</div>
        </div>
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground mb-1.5">Оттенки (Tints)</div>
        <div className="flex rounded-lg overflow-hidden h-8">{tints.map((c, i) => <div key={i} className="flex-1" style={{ background: c }} title={c} />)}</div>
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground mb-1.5">Тени (Shades)</div>
        <div className="flex rounded-lg overflow-hidden h-8">{shades.map((c, i) => <div key={i} className="flex-1" style={{ background: c }} title={c} />)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg p-4 flex items-center justify-center" style={{ background: value }}>
          <span className="text-white text-[13px] font-semibold">Белый текст</span>
        </div>
        <div className="rounded-lg p-4 flex items-center justify-center" style={{ background: value }}>
          <span className="text-black text-[13px] font-semibold">Чёрный текст</span>
        </div>
      </div>
    </div>
  );
}

function FontFullPreview({ value }: { value: string }) {
  return (
    <div className="space-y-4">
      <div className="bg-muted/20 rounded-xl p-6" style={{ fontFamily: `"${value}", sans-serif` }}>
        <div className="text-foreground text-[36px] font-bold leading-tight mb-2">Аа Бб Вв Гг</div>
        <div className="text-foreground/80 text-[24px] mb-2">АБВГДЕЖЗИКЛМН</div>
        <div className="text-foreground/70 text-[18px] mb-2">абвгдежзиклмнопрстуфхцчшщъыьэюя</div>
        <div className="text-foreground/60 text-[14px]">AaBbCcDdEeFfGg 0123456789 !@#$%</div>
      </div>
      <div className="space-y-0">
        <div className="text-[11px] text-muted-foreground mb-2">Начертания</div>
        {[{ weight: 300, name: "Light" }, { weight: 400, name: "Regular" }, { weight: 500, name: "Medium" }, { weight: 600, name: "Semibold" }, { weight: 700, name: "Bold" }].map(w => (
          <div key={w.weight} className="flex items-baseline gap-3 py-1.5 border-b border-border last:border-0">
            <span className="text-[11px] text-muted-foreground w-24 shrink-0 tabular-nums">{w.name} ({w.weight})</span>
            <span className="text-foreground text-[15px] truncate" style={{ fontFamily: `"${value}", sans-serif`, fontWeight: w.weight }}>
              Быстрая коричневая лиса прыгает через ленивую собаку
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <div className="text-[11px] text-muted-foreground mb-1">Размеры</div>
        {[12, 14, 18, 24, 32].map(size => (
          <div key={size} className="flex items-baseline gap-3">
            <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0 tabular-nums">{size}px</span>
            <span className="text-foreground truncate" style={{ fontFamily: `"${value}", sans-serif`, fontSize: `${size}px` }}>MarketPlan - AI маркетинг</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogoFullPreview({ value, name }: { value: string; name: string }) {
  const [error, setError] = useState(false);
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] text-muted-foreground mb-1.5">На белом фоне</div>
        <div className="bg-card rounded-xl p-8 flex items-center justify-center min-h-[140px] border border-border">
          {!error ? (
            <img src={value} alt={name} className="max-h-[120px] max-w-full object-contain" onError={() => setError(true)} />
          ) : (
            <div className="text-center text-muted-foreground">
              <Image className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-[12px]">Не удалось загрузить</p>
            </div>
          )}
        </div>
      </div>
      {!error && (
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">На тёмном фоне</div>
          <div className="bg-[#1a1a1a] rounded-xl p-8 flex items-center justify-center min-h-[140px]">
            <img src={value} alt={name} className="max-h-[120px] max-w-full object-contain" />
          </div>
        </div>
      )}
      <div className="bg-muted/20 rounded-lg p-3">
        <div className="text-[10px] text-muted-foreground mb-1">URL</div>
        <div className="text-[12px] text-foreground font-mono break-all">{value}</div>
      </div>
    </div>
  );
}

function TextFullPreview({ value }: { value: string }) {
  return (
    <div className="bg-muted/20 rounded-xl p-5">
      <pre className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed font-sans">{value}</pre>
    </div>
  );
}

function CopyFullPreview({ value }: { value: string }) {
  return (
    <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-6">
      <div className="text-[40px] text-orange-500/20 leading-none mb-1">&ldquo;</div>
      <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap -mt-4 pl-4">{value}</p>
      <div className="text-[40px] text-orange-500/20 leading-none text-right -mb-2">&rdquo;</div>
    </div>
  );
}

function HashtagFullPreview({ value, onCopy }: { value: string; onCopy: (val: string, label?: string) => void }) {
  const tags = value.split(/\s+/).filter(t => t.startsWith("#"));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <button key={i} onClick={() => onCopy(tag, `${tag} скопирован`)}
            className="inline-flex items-center gap-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 px-3 py-1.5 rounded-full text-[13px] transition-colors cursor-pointer">
            {tag}<Copy className="w-3 h-3 opacity-50" />
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between bg-muted/20 rounded-lg p-3">
        <span className="text-[12px] text-muted-foreground">{tags.length} хэштегов · {value.length} символов</span>
        <button onClick={() => onCopy(value, "Все хэштеги скопированы")}
          className="flex items-center gap-1 text-[12px] text-primary hover:underline"><Copy className="w-3 h-3" />Копировать все</button>
      </div>
    </div>
  );
}

// ========================
// Font Picker
// ========================
function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [category, setCategory] = useState<"all" | "google" | "system">("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const fontsToShow = (category === "google" ? GOOGLE_FONTS : category === "system" ? SYSTEM_FONTS : ALL_FONTS)
    .filter(f => !search || f.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => { if (showDropdown) GOOGLE_FONTS.forEach(f => loadGoogleFont(f)); }, [showDropdown]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setShowDropdown(false); };
    if (showDropdown) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="relative">
        <input value={showDropdown ? search : value}
          onChange={e => { setSearch(e.target.value); if (!showDropdown) setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)} placeholder="Поиск шрифта..."
          className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 pr-8 text-foreground text-[13px]" />
        <button onClick={() => setShowDropdown(!showDropdown)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5">
          <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
        </button>
      </div>
      {showDropdown && (
        <div className="border border-border rounded-lg bg-card shadow-xl overflow-hidden">
          <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/20">
            {([["all", "Все"], ["google", "Google"], ["system", "Системные"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setCategory(key)}
                className={`h-6 px-2 rounded text-[11px] transition-colors ${category === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-muted-foreground">{fontsToShow.length}</span>
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {fontsToShow.length === 0 ? (
              <div className="p-4 text-center text-[12px] text-muted-foreground">Не найден</div>
            ) : fontsToShow.map(font => {
              const isSelected = value === font;
              const isGoogle = GOOGLE_FONTS.includes(font);
              return (
                <button key={font} onClick={() => { onChange(font); loadGoogleFont(font); setShowDropdown(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors border-b border-border/30 last:border-0 ${isSelected ? "bg-primary/10" : "hover:bg-muted/30"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-foreground font-medium">{font}</span>
                      {isGoogle && <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">Google</span>}
                      {!isGoogle && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">System</span>}
                      {isSelected && <Check className="w-3 h-3 text-primary" />}
                    </div>
                    <div className="text-foreground/60 text-[14px] mt-0.5 truncate" style={{ fontFamily: `"${font}", sans-serif` }}>
                      Аа Бб Вв Гг - {FONT_SAMPLES}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {value && !showDropdown && (
        <div className="bg-muted/20 rounded-lg p-3">
          <div style={{ fontFamily: `"${value}", sans-serif` }} className="text-foreground text-[20px] font-semibold">Аа Бб Вв Гг Дд - {value}</div>
          <div style={{ fontFamily: `"${value}", sans-serif` }} className="text-foreground/60 text-[13px] mt-1">{FONT_SAMPLES}</div>
          <div className="flex gap-3 mt-1.5">
            {[400, 600, 700].map(w => (
              <span key={w} className="text-[11px] text-muted-foreground" style={{ fontFamily: `"${value}", sans-serif`, fontWeight: w }}>
                {w === 400 ? "Regular" : w === 600 ? "Semibold" : "Bold"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ========================
// Asset Modal (Add/Edit)
// ========================
function AssetModal({ asset, isNew, onSave, onClose }: { asset: BrandAsset; isNew: boolean; onSave: (a: BrandAsset) => void; onClose: () => void }) {
  const [form, setForm] = useState(asset);
  const [tagInput, setTagInput] = useState("");
  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleTypeChange = (newType: string) => {
    const defaults: Record<string, string> = { color: "#1a7a6d", font: "Inter", logo: "", template: "", guideline: "", copy: "", hashtag: "#" };
    set("type", newType);
    if (isNew) set("value", defaults[newType] || "");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-foreground text-[15px] font-semibold">{isNew ? "Новый ассет" : "Редактировать"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Название *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)}
              className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 text-foreground text-[13px]" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">Тип</label>
              <select value={form.type} onChange={e => handleTypeChange(e.target.value)}
                className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 text-foreground text-[13px]">
                {ASSET_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">Категория</label>
              <select value={form.category} onChange={e => set("category", e.target.value)}
                className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 text-foreground text-[13px]">
                {CATEGORIES.filter(c => c !== "Все").map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">
              {form.type === "color" ? "Цвет" : form.type === "font" ? "Шрифт" : form.type === "logo" ? "URL изображения" : form.type === "hashtag" ? "Хэштеги (через пробел)" : "Содержимое"}
            </label>
            {form.type === "color" ? (
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.value} onChange={e => set("value", e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer shrink-0" />
                  <input value={form.value} onChange={e => set("value", e.target.value)} className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 text-foreground text-[13px] font-mono" />
                </div>
                <div className="h-12 rounded-lg" style={{ background: form.value }} />
              </div>
            ) : form.type === "font" ? (
              <FontPicker value={form.value} onChange={(v) => set("value", v)} />
            ) : form.type === "logo" ? (
              <div className="space-y-2">
                <input value={form.value} onChange={e => set("value", e.target.value)} placeholder="https://example.com/logo.png"
                  className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 text-foreground text-[13px]" />
                {form.value && (
                  <div className="bg-[repeating-conic-gradient(#e5e5e5_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[length:16px_16px] rounded-lg p-4 flex items-center justify-center h-28">
                    <img src={form.value} alt="preview" className="max-h-full max-w-full object-contain rounded" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </div>
            ) : form.type === "template" || form.type === "guideline" ? (
              <textarea value={form.value} onChange={e => set("value", e.target.value)} rows={8}
                placeholder={form.type === "template" ? "Шаблон текста с [переменными]..." : "Описание гайдлайна..."}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none font-mono" />
            ) : form.type === "copy" ? (
              <div className="space-y-2">
                <textarea value={form.value} onChange={e => set("value", e.target.value)} rows={4} placeholder="Текст копирайтинга, слоган..."
                  className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none" />
                {form.value && <div className="bg-orange-500/5 rounded-lg p-3 italic text-[13px] text-foreground/80">&ldquo;{form.value}&rdquo;</div>}
              </div>
            ) : form.type === "hashtag" ? (
              <div className="space-y-2">
                <textarea value={form.value} onChange={e => set("value", e.target.value)} rows={3} placeholder="#маркетинг #бизнес #продвижение"
                  className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none" />
                {form.value && (
                  <div className="flex flex-wrap gap-1">
                    {form.value.split(/\s+/).filter(t => t.startsWith("#")).map((tag, i) => (
                      <span key={i} className="bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-full text-[11px]">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <input value={form.value} onChange={e => set("value", e.target.value)}
                className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 text-foreground text-[13px]" />
            )}
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Описание</label>
            <input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Краткое описание ассета"
              className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 text-foreground text-[13px]" />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">Теги</label>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && tagInput.trim()) { set("tags", [...form.tags, tagInput.trim()]); setTagInput(""); } }}
              placeholder="Нажмите Enter для добавления"
              className="w-full h-9 bg-muted/30 border border-border rounded-lg px-3 text-foreground text-[12px]" />
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {form.tags.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full text-[11px] text-muted-foreground">
                    {t}<button onClick={() => set("tags", form.tags.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="h-9 px-4 text-[13px] text-muted-foreground hover:text-foreground transition-colors">Отмена</button>
          <button onClick={() => { if (form.type === "font" && form.value) loadGoogleFont(form.value); onSave(form); }} disabled={!form.name.trim()}
            className="flex items-center gap-2 h-9 bg-primary text-primary-foreground px-4 rounded-lg text-[13px] hover:opacity-90 disabled:opacity-50 transition-opacity">
            <Check className="w-4 h-4" /> {isNew ? "Добавить" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========================
// Color Utilities
// ========================
function hexToRgb(hex: string) {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m || m.length < 3) return null;
  return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
}

function hexToHsl(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
}

function generateTints(hex: string, count: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];
  return Array.from({ length: count }, (_, i) => {
    const f = (i + 1) / (count + 1);
    return rgbToHex(rgb.r + (255 - rgb.r) * f, rgb.g + (255 - rgb.g) * f, rgb.b + (255 - rgb.b) * f);
  });
}

function generateShades(hex: string, count: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];
  return Array.from({ length: count }, (_, i) => {
    const f = (i + 1) / (count + 1);
    return rgbToHex(rgb.r * (1 - f), rgb.g * (1 - f), rgb.b * (1 - f));
  });
}
