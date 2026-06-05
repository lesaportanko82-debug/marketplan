import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Search,
  ExternalLink,
  DollarSign,
  BarChart3,
  Star,
  Instagram,
  Video,
  MessageCircle,
  Globe,
  Link2,
  TrendingUp,
  Eye,
  ShoppingBag,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { getData, saveData } from "../lib/api";
import { AddToProjectButton } from "./AddToProjectModal";
import { MascotMessage } from "./Mascot";
import { useModal } from "../hooks/useModal";
import { EmptyState } from "./EmptyState";

interface Influencer {
  id: string;
  name: string;
  niche: string;
  followers: number;
  engagement: number;
  platforms: { name: string; url: string; followers: number }[];
  pricePerAd: number;
  totalAdsBooked: number;
  totalSpent: number;
  status: "active" | "negotiation" | "completed" | "paused";
  creatives: { title: string; url: string }[];
  notes: string;
  rating: number;
  lastContact: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Активный", color: "bg-emerald-500/10 text-emerald-600" },
  negotiation: { label: "Переговоры", color: "bg-amber-500/10 text-amber-600" },
  completed: { label: "Завершён", color: "bg-muted text-muted-foreground" },
  paused: { label: "Пауза", color: "bg-red-500/10 text-red-500" },
};

const PLATFORM_ICONS: Record<string, any> = {
  Instagram,
  YouTube: Video,
  Telegram: MessageCircle,
  TikTok: Video,
  VK: Globe,
};

const STORAGE_KEY = "influencers:list"; // aligned with MarketingCalendar

const formatNum = (n: number) =>
  n >= 1000000
    ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000
    ? `${(n / 1000).toFixed(1)}K`
    : String(n);

const formatMoney = (n: number) =>
  n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);

export function InfluencerDashboard() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"followers" | "price" | "ads" | "rating">("followers");
  const [editing, setEditing] = useState<Influencer | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    getData<Influencer[]>(STORAGE_KEY).then((d) => {
      if (d && Array.isArray(d)) setInfluencers(d);
    });
  }, []);

  const save = useCallback((next: Influencer[]) => {
    setInfluencers(next);
    saveData(STORAGE_KEY, next);
  }, []);

  const addInfluencer = (inf: Influencer) => {
    save([inf, ...influencers]);
    setShowAdd(false);
    toast.success(`${inf.name} добавлен`);
  };

  const updateInfluencer = (inf: Influencer) => {
    save(influencers.map((i) => (i.id === inf.id ? inf : i)));
    setEditing(null);
    toast.success("Блогер обновлён");
  };

  const deleteInfluencer = (id: string) => {
    save(influencers.filter((i) => i.id !== id));
    toast.success("Блогер удалён");
  };

  const filtered = influencers
    .filter((inf) => {
      if (statusFilter !== "all" && inf.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          inf.name.toLowerCase().includes(s) ||
          inf.niche.toLowerCase().includes(s)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "followers":
          return b.followers - a.followers;
        case "price":
          return a.pricePerAd - b.pricePerAd;
        case "ads":
          return b.totalAdsBooked - a.totalAdsBooked;
        case "rating":
          return b.rating - a.rating;
        default:
          return 0;
      }
    });

  // Summary stats
  const totalSpent = influencers.reduce((s, i) => s + i.totalSpent, 0);
  const totalAds = influencers.reduce((s, i) => s + i.totalAdsBooked, 0);
  const totalReach = influencers.reduce((s, i) => s + i.followers, 0);
  const avgPrice =
    influencers.length > 0
      ? Math.round(
          influencers.reduce((s, i) => s + i.pricePerAd, 0) /
            influencers.length
        )
      : 0;

  return (
    <div className="p-4 sm:p-5 max-w-[1440px] mx-auto space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-foreground flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-white" />
            </div>
            Инфлюенс-маркетинг
          </h1>
          <p className="text-muted-foreground text-[13px] mt-1 hidden sm:block">
            Управление блогерами, рекламными закупками и креативами
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg text-[13px] hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Добавить блогера</span>
          <span className="sm:hidden">Блогер</span>
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[12px] mb-1">
            <Users className="w-3.5 h-3.5" />
            Блогеров
          </div>
          <p className="text-[22px] text-foreground">{influencers.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[12px] mb-1">
            <Eye className="w-3.5 h-3.5" />
            Суммарный охват
          </div>
          <p className="text-[22px] text-foreground">{formatNum(totalReach)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[12px] mb-1">
            <ShoppingBag className="w-3.5 h-3.5" />
            Рекламных закупок
          </div>
          <p className="text-[22px] text-foreground">{totalAds}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-[12px] mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            Потрачено
          </div>
          <p className="text-[22px] text-foreground">
            {formatMoney(totalSpent)} ₽
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск блогеров..."
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-foreground text-[13px]"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          {["all", "active", "negotiation", "completed", "paused"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 rounded-lg text-[12px] transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "Все" : STATUS_MAP[s]?.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-muted rounded-lg px-2 py-1.5 text-foreground border-0 text-[12px]"
          >
            <option value="followers">По охвату</option>
            <option value="price">По цене</option>
            <option value="ads">По закупкам</option>
            <option value="rating">По рейтингу</option>
          </select>
        </div>
      </div>

      {/* Influencers list */}
      {filtered.length === 0 ? (
        <EmptyState
          title={influencers.length === 0 ? "Добавьте первого блогера" : "Ничего не найдено"}
          description={influencers.length === 0 ? "Ведите базу инфлюенсеров, отслеживайте ROI коллабораций и рейтинг каждого" : "Попробуйте изменить фильтры или поисковый запрос"}
          emotion={influencers.length === 0 ? "idle" : "think"}
          action={influencers.length === 0 ? { label: "Добавить блогера", onClick: () => setShowAdd(true), icon: <Plus className="w-4 h-4" /> } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((inf) => (
            <div
              key={inf.id}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/20 transition-colors group"
            >
              <div className="flex items-start gap-4">
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary text-[18px] font-semibold shrink-0">
                  {inf.name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-foreground text-[15px]">{inf.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] ${
                        STATUS_MAP[inf.status].color
                      }`}
                    >
                      {STATUS_MAP[inf.status].label}
                    </span>
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {inf.niche}
                    </span>
                    {/* Rating */}
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${
                            s <= inf.rating
                              ? "text-amber-500 fill-amber-500"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Platforms */}
                  <div className="flex items-center gap-3 mb-3">
                    {inf.platforms.map((p) => {
                      const Icon = PLATFORM_ICONS[p.name] || Globe;
                      return (
                        <a
                          key={p.name}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {p.name}
                          <span className="text-foreground">
                            {formatNum(p.followers)}
                          </span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      );
                    })}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-6 text-[13px]">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-foreground">
                        {formatNum(inf.followers)}
                      </span>{" "}
                      подписчиков
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <TrendingUp className="w-3.5 h-3.5" />
                      ER{" "}
                      <span className="text-foreground">
                        {inf.engagement}%
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="text-foreground">
                        {formatMoney(inf.pricePerAd)} ₽
                      </span>{" "}
                      / реклама
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span className="text-foreground">
                        {inf.totalAdsBooked}
                      </span>{" "}
                      закупок
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      Итого:{" "}
                      <span className="text-foreground font-medium">
                        {formatMoney(inf.totalSpent)} ₽
                      </span>
                    </span>
                  </div>

                  {/* Creatives */}
                  {inf.creatives.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">
                        Креативы:
                      </span>
                      {inf.creatives.map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-[11px] text-primary hover:underline"
                        >
                          <Link2 className="w-3 h-3" />
                          {c.title || `Креатив ${i + 1}`}
                        </a>
                      ))}
                    </div>
                  )}

                  {inf.notes && (
                    <p className="mt-2 text-[12px] text-muted-foreground italic">
                      {inf.notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <AddToProjectButton itemType="influencer" itemId={inf.id} itemTitle={inf.name} size="md" />
                  <button
                    onClick={() => setEditing(inf)}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteInfluencer(inf.id)}
                    className="p-2 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {(showAdd || editing) && (
        <InfluencerModal
          influencer={
            editing || {
              id:
                Date.now().toString(36) +
                Math.random().toString(36).slice(2, 6),
              name: "",
              niche: "",
              followers: 0,
              engagement: 0,
              platforms: [],
              pricePerAd: 0,
              totalAdsBooked: 0,
              totalSpent: 0,
              status: "negotiation",
              creatives: [],
              notes: "",
              rating: 3,
              lastContact: new Date().toISOString().slice(0, 10),
            }
          }
          isNew={showAdd && !editing}
          onSave={(inf) => {
            if (showAdd && !editing) addInfluencer(inf);
            else updateInfluencer(inf);
          }}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function InfluencerModal({
  influencer,
  isNew,
  onSave,
  onClose,
}: {
  influencer: Influencer;
  isNew: boolean;
  onSave: (i: Influencer) => void;
  onClose: () => void;
}) {
  const modalRef = useModal(onClose);
  const [form, setForm] = useState(influencer);
  const [newPlatform, setNewPlatform] = useState({ name: "Instagram", url: "", followers: 0 });
  const [newCreative, setNewCreative] = useState({ title: "", url: "" });

  const set = (key: string, val: any) =>
    setForm((f) => ({ ...f, [key]: val }));

  const addPlatform = () => {
    if (newPlatform.url.trim()) {
      set("platforms", [...form.platforms, { ...newPlatform }]);
      setNewPlatform({ name: "Instagram", url: "", followers: 0 });
    }
  };

  const addCreative = () => {
    if (newCreative.url.trim()) {
      set("creatives", [...form.creatives, { ...newCreative }]);
      setNewCreative({ title: "", url: "" });
    }
  };

  return (
    <div ref={modalRef} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={isNew ? "Новый блогер" : "Редактировать блогера"}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-foreground">
            {isNew ? "Новый блогер" : "Редактировать блогера"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">
                Имя / Никнейм
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="@blogger_name"
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]"
              />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">
                Ниша
              </label>
              <input
                type="text"
                value={form.niche}
                onChange={(e) => set("niche", e.target.value)}
                placeholder="Фитнес, Лайфстайл..."
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">
                Подписчики (общ.)
              </label>
              <input
                type="number"
                value={form.followers}
                onChange={(e) => set("followers", Number(e.target.value))}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]"
              />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">
                ER %
              </label>
              <input
                type="number"
                step="0.1"
                value={form.engagement}
                onChange={(e) => set("engagement", Number(e.target.value))}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]"
              />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">
                Статус
              </label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]"
              >
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">
                Цена за рекламу ₽
              </label>
              <input
                type="number"
                value={form.pricePerAd}
                onChange={(e) => set("pricePerAd", Number(e.target.value))}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]"
              />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">
                Купленных реклам
              </label>
              <input
                type="number"
                value={form.totalAdsBooked}
                onChange={(e) => set("totalAdsBooked", Number(e.target.value))}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]"
              />
            </div>
            <div>
              <label className="text-[12px] text-muted-foreground block mb-1">
                Итого потрачено ₽
              </label>
              <input
                type="number"
                value={form.totalSpent}
                onChange={(e) => set("totalSpent", Number(e.target.value))}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px]"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">
              Рейтинг
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => set("rating", s)}
                  className="p-0.5"
                >
                  <Star
                    className={`w-5 h-5 ${
                      s <= form.rating
                        ? "text-amber-500 fill-amber-500"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">
              Площадки
            </label>
            {form.platforms.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 mb-1.5 bg-muted/20 rounded-lg px-3 py-1.5 text-[12px]"
              >
                <span className="text-foreground font-medium">{p.name}</span>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary truncate flex-1 hover:underline"
                >
                  {p.url}
                </a>
                <span className="text-muted-foreground">
                  {formatNum(p.followers)}
                </span>
                <button
                  onClick={() =>
                    set(
                      "platforms",
                      form.platforms.filter((_, idx) => idx !== i)
                    )
                  }
                  className="text-muted-foreground hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 items-end">
              <div className="w-28">
                <select
                  value={newPlatform.name}
                  onChange={(e) =>
                    setNewPlatform((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-[12px] text-foreground"
                >
                  {["Instagram", "YouTube", "Telegram", "TikTok", "VK"].map(
                    (p) => (
                      <option key={p}>{p}</option>
                    )
                  )}
                </select>
              </div>
              <input
                type="text"
                value={newPlatform.url}
                onChange={(e) =>
                  setNewPlatform((p) => ({ ...p, url: e.target.value }))
                }
                placeholder="https://..."
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground"
              />
              <input
                type="number"
                value={newPlatform.followers || ""}
                onChange={(e) =>
                  setNewPlatform((p) => ({
                    ...p,
                    followers: Number(e.target.value),
                  }))
                }
                placeholder="Подписчики"
                className="w-24 bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-[12px] text-foreground"
              />
              <button
                onClick={addPlatform}
                className="px-3 py-1.5 bg-muted rounded-lg text-[12px] text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Creatives */}
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">
              Ссылки на креативы
            </label>
            {form.creatives.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 mb-1.5 bg-muted/20 rounded-lg px-3 py-1.5 text-[12px]"
              >
                <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-foreground">{c.title || "Без названия"}</span>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary truncate flex-1 hover:underline"
                >
                  {c.url}
                </a>
                <button
                  onClick={() =>
                    set(
                      "creatives",
                      form.creatives.filter((_, idx) => idx !== i)
                    )
                  }
                  className="text-muted-foreground hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newCreative.title}
                onChange={(e) =>
                  setNewCreative((c) => ({ ...c, title: e.target.value }))
                }
                placeholder="Название"
                className="w-32 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground"
              />
              <input
                type="text"
                value={newCreative.url}
                onChange={(e) =>
                  setNewCreative((c) => ({ ...c, url: e.target.value }))
                }
                placeholder="https://ссылка на креатив..."
                className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-[12px] text-foreground"
              />
              <button
                onClick={addCreative}
                className="px-3 py-1.5 bg-muted rounded-lg text-[12px] text-muted-foreground hover:text-foreground"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-[12px] text-muted-foreground block mb-1">
              Заметки
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Комментарии, особенности сотрудничества..."
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-foreground text-[13px] resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-muted-foreground"
          >
            Отмена
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.name.trim()}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] hover:opacity-90 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            {isNew ? "Добавить" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}