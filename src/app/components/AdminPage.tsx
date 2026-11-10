/**
 * AdminPage — закрытая панель владельца MarketPlan (/admin).
 * Вход по паролю администратора (секрет ADMIN_PASSWORD на сервере).
 * Пароль хранится только в sessionStorage этой вкладки.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3, Users, KeyRound, Loader2, LogOut, Search, Shield, Ban, Trash2,
  RefreshCw, Crown, UserPlus, Check, X, Mail,
} from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { loginToEmail } from "../lib/loginToEmail";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-b80b3260/admin`;
const PW_KEY = "mp_admin_pw";

const PLAN_LABELS: Record<string, string> = { start: "Старт", pro: "Про", pro_plus: "Про+" };
const PLAN_COLORS: Record<string, string> = {
  start: "bg-[#d4a373]/15 text-[#a56b35]",
  pro: "bg-[#1a7a6d]/15 text-[#1a7a6d]",
  pro_plus: "bg-[#7c3aed]/15 text-[#7c3aed]",
};

type Tab = "stats" | "users" | "grants";

interface Stats {
  totalUsers: number; paidTotal: number; paidByPlan: Record<string, number>;
  activeMonth: number; newWeek: number; blocked: number; projects: number; records: number; openRequests: number;
}
interface AdminUser {
  id: string; email: string; name: string; createdAt: string; lastSignIn: string | null;
  blocked: boolean; own: boolean; plan: string | null; expiresAt: string | null; accessStatus: "active" | "expired" | "none";
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function call<T = any>(pw: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${publicAnonKey}`,
      "X-Admin-Password": pw,
      ...(init?.headers || {}),
    },
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* empty */ }
  if (!res.ok || !json?.success) {
    const err = new Error(json?.error || `Ошибка сервера (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json.data as T;
}

/* ════════ Login ════════ */
function AdminLogin({ onOk }: { onOk: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { toast.error("Пароль администратора — минимум 8 символов"); return; }
    setLoading(true);
    try {
      await call(pw, "/ping");
      sessionStorage.setItem(PW_KEY, pw);
      onOk(pw);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-[360px] bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a7a6d, #0d7377)" }}>
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold">MarketPlan · Админка</p>
            <p className="text-[11px] text-muted-foreground">Только для владельца</p>
          </div>
        </div>
        <input
          type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="Пароль администратора"
          className="w-full bg-input-background border border-border rounded-xl px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#1a7a6d]/30"
        />
        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #1a7a6d, #0d7377)" }}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Войти
        </button>
      </form>
    </div>
  );
}

/* ════════ Stats ════════ */
function StatsTab({ pw }: { pw: string }) {
  const [s, setS] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setS(await call<Stats>(pw, "/stats")); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }, [pw]);
  useEffect(() => { load(); }, [load]);
  if (loading && !s) return <Spinner />;
  if (!s) return null;
  const cards = [
    { label: "Всего пользователей", value: s.totalUsers },
    { label: "Платных", value: s.paidTotal, sub: `Старт ${s.paidByPlan.start} · Про ${s.paidByPlan.pro} · Про+ ${s.paidByPlan.pro_plus}` },
    { label: "Активных за 30 дней", value: s.activeMonth },
    { label: "Новых за неделю", value: s.newWeek },
    { label: "Проектов создано", value: s.projects, sub: `${s.records} записей данных` },
    { label: "Заблокировано", value: s.blocked },
    { label: "Открытых заявок на тариф", value: s.openRequests },
  ];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><RefreshBtn onClick={load} loading={loading} /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
            <p className="text-[26px] font-bold mt-1 tabular-nums">{c.value}</p>
            {c.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════ Users ════════ */
function UsersTab({ pw }: { pw: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyOwn, setOnlyOwn] = useState(true);
  const [edit, setEdit] = useState<{ id: string; kind: "tier" | "cred" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await call<AdminUser[]>(pw, `/users?own=${onlyOwn ? 1 : 0}`)); }
    catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }, [pw, onlyOwn]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? users.filter((u) => u.email?.toLowerCase().includes(t) || u.name?.toLowerCase().includes(t)) : users;
  }, [users, q]);

  const act = async (id: string, fn: () => Promise<any>, ok: string) => {
    setBusy(id);
    try { await fn(); toast.success(ok); setEdit(null); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по email или имени"
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-[13px] outline-none focus:ring-2 focus:ring-[#1a7a6d]/30" />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={onlyOwn} onChange={(e) => setOnlyOwn(e.target.checked)} className="accent-[#1a7a6d]" />
          Только свои
        </label>
        <RefreshBtn onClick={load} loading={loading} />
      </div>

      {loading && !users.length ? <Spinner /> : filtered.length === 0 ? (
        <p className="text-[13px] text-muted-foreground py-8 text-center">Пользователей не найдено</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <div key={u.id} className="bg-card border border-border rounded-xl p-3.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">{u.email}{u.name && <span className="text-muted-foreground font-normal"> · {u.name}</span>}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Регистрация {fmtDate(u.createdAt)} · вход {fmtDate(u.lastSignIn)}
                    {u.plan && <> · до {u.expiresAt ? fmtDate(u.expiresAt) : "бессрочно"}</>}
                    {!u.own && " · не из MarketPlan"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {u.blocked && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">Заблокирован</span>}
                  {u.plan ? (
                    <span className={"text-[10px] font-medium px-2 py-0.5 rounded-full " + (PLAN_COLORS[u.plan] || "bg-muted")}>{PLAN_LABELS[u.plan] || u.plan}</span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{u.accessStatus === "expired" ? "Доступ истёк" : "Без тарифа"}</span>
                  )}
                  <IconBtn title="Сменить тариф" onClick={() => setEdit(edit?.id === u.id && edit.kind === "tier" ? null : { id: u.id, kind: "tier" })}><Crown className="w-3.5 h-3.5" /></IconBtn>
                  <IconBtn title="Email и пароль" onClick={() => setEdit(edit?.id === u.id && edit.kind === "cred" ? null : { id: u.id, kind: "cred" })}><KeyRound className="w-3.5 h-3.5" /></IconBtn>
                  <IconBtn title={u.blocked ? "Разблокировать" : "Заблокировать"} danger={!u.blocked} disabled={busy === u.id}
                    onClick={() => act(u.id, () => call(pw, `/users/${u.id}/block`, { method: "POST", body: JSON.stringify({ blocked: !u.blocked }) }), u.blocked ? "Разблокирован" : "Заблокирован")}>
                    <Ban className="w-3.5 h-3.5" />
                  </IconBtn>
                  <IconBtn title="Удалить" danger disabled={busy === u.id}
                    onClick={() => { if (confirm(`Удалить ${u.email} и все его данные? Это нельзя отменить.`)) act(u.id, () => call(pw, `/users/${u.id}`, { method: "DELETE" }), "Пользователь удалён"); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </IconBtn>
                </div>
              </div>
              {edit?.id === u.id && edit.kind === "tier" && (
                <TierForm busy={busy === u.id} current={u.plan}
                  onSubmit={(plan, term) => act(u.id, () => call(pw, `/user-tier/${u.id}`, { method: "POST", body: JSON.stringify({ plan, term }) }), plan === "none" ? "Тариф снят" : "Тариф обновлён")} />
              )}
              {edit?.id === u.id && edit.kind === "cred" && (
                <CredForm busy={busy === u.id} email={u.email}
                  onSubmit={(login, password) => act(u.id, () => call(pw, `/users/${u.id}/credentials`, { method: "POST", body: JSON.stringify({ login, password }) }), "Данные входа обновлены")} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TierForm({ current, busy, onSubmit }: { current: string | null; busy: boolean; onSubmit: (plan: string, term: string) => void }) {
  const [plan, setPlan] = useState(current || "pro");
  const [term, setTerm] = useState("30");
  return (
    <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-end gap-2">
      <Field label="Тариф">
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls}>
          <option value="start">Старт</option><option value="pro">Про</option><option value="pro_plus">Про+</option><option value="none">Снять тариф</option>
        </select>
      </Field>
      {plan !== "none" && (
        <Field label="Срок">
          <select value={term} onChange={(e) => setTerm(e.target.value)} className={inputCls}>
            <option value="30">30 дней</option><option value="90">90 дней</option><option value="forever">Бессрочно</option>
          </select>
        </Field>
      )}
      <PrimaryBtn busy={busy} onClick={() => onSubmit(plan, term)}>Сохранить</PrimaryBtn>
    </div>
  );
}

function CredForm({ email, busy, onSubmit }: { email: string; busy: boolean; onSubmit: (login: string, password: string) => void }) {
  const [login, setLogin] = useState(email);
  const [password, setPassword] = useState("");
  return (
    <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-end gap-2">
      <Field label="Email (логин)"><input value={login} onChange={(e) => setLogin(e.target.value)} className={inputCls + " min-w-[220px]"} /></Field>
      <Field label="Новый пароль"><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Оставьте пустым — не менять" className={inputCls + " min-w-[200px]"} /></Field>
      <PrimaryBtn busy={busy} onClick={() => {
        const newLogin = loginToEmail(login) !== loginToEmail(email) ? login : "";
        if (!newLogin && !password) { toast.error("Нечего менять"); return; }
        onSubmit(newLogin, password);
      }}>Сохранить</PrimaryBtn>
    </div>
  );
}

/* ════════ Grants ════════ */
function GrantsTab({ pw }: { pw: string }) {
  const [form, setForm] = useState({ login: "", password: "", name: "", plan: "pro", term: "30", note: "" });
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{ log: any[]; requests: any[] }>({ log: [], requests: [] });
  const [loading, setLoading] = useState(true);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await call(pw, "/grants")); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }, [pw]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await call<{ created: boolean; email: string }>(pw, "/grants", {
        method: "POST", body: JSON.stringify({ ...form, login: loginToEmail(form.login) }),
      });
      toast.success(r.created ? `Аккаунт ${r.email} создан, доступ выдан` : `Доступ для ${r.email} выдан`);
      setForm((f) => ({ ...f, login: "", password: "", name: "", note: "" }));
      await load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const ACTION: Record<string, string> = { grant_new: "Новый аккаунт", grant: "Выдача", tier: "Смена тарифа", revoke: "Снят тариф" };

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-4 items-start">
      <form onSubmit={submit} className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-[14px] font-semibold flex items-center gap-2"><UserPlus className="w-4 h-4 text-[#1a7a6d]" /> Выдать доступ</p>
        <Field label="Логин (email, по которому входит)"><input required value={form.login} onChange={(e) => set("login", e.target.value)} placeholder="user@mail.ru" className={inputCls + " w-full"} /></Field>
        <Field label="Пароль (для нового аккаунта; для существующего — сменит пароль)"><input value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="минимум 6 символов" className={inputCls + " w-full"} /></Field>
        <Field label="Имя (необязательно)"><input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls + " w-full"} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Тариф">
            <select value={form.plan} onChange={(e) => set("plan", e.target.value)} className={inputCls + " w-full"}>
              <option value="start">Старт</option><option value="pro">Про</option><option value="pro_plus">Про+</option>
            </select>
          </Field>
          <Field label="Срок">
            <select value={form.term} onChange={(e) => set("term", e.target.value)} className={inputCls + " w-full"}>
              <option value="30">30 дней</option><option value="90">90 дней</option><option value="forever">Бессрочно</option>
            </select>
          </Field>
        </div>
        <Field label="Заметка"><input value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="например: оплата переводом 10.11" className={inputCls + " w-full"} /></Field>
        <PrimaryBtn busy={busy} type="submit" full>Выдать доступ</PrimaryBtn>
      </form>

      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[14px] font-semibold">Заявки на тариф</p>
            <RefreshBtn onClick={load} loading={loading} />
          </div>
          {data.requests.length === 0 ? <p className="text-[12px] text-muted-foreground">Новых заявок нет</p> : (
            <div className="space-y-1.5">
              {data.requests.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 text-[12px] py-1.5 border-b border-border last:border-0">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium">{r.email}</span>
                  <span className={"px-2 py-0.5 rounded-full text-[10px] font-medium " + (PLAN_COLORS[r.plan] || "bg-muted")}>{PLAN_LABELS[r.plan] || r.plan}</span>
                  <span className="text-muted-foreground">{fmtDate(r.created_at)}</span>
                  <div className="ml-auto flex gap-1">
                    <IconBtn title="Заполнить форму" onClick={() => setForm((f) => ({ ...f, login: r.email || "", plan: r.plan, password: "" }))}><Check className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn title="Отклонить" danger onClick={async () => { try { await call(pw, `/requests/${r.id}/close`, { method: "POST" }); load(); } catch (e: any) { toast.error(e.message); } }}><X className="w-3.5 h-3.5" /></IconBtn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[14px] font-semibold mb-2">Журнал выдач</p>
          {data.log.length === 0 ? <p className="text-[12px] text-muted-foreground">Пока пусто</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-muted-foreground text-left">
                  <tr><th className="py-1.5 pr-3 font-medium">Дата</th><th className="pr-3 font-medium">Email</th><th className="pr-3 font-medium">Действие</th><th className="pr-3 font-medium">Тариф</th><th className="pr-3 font-medium">До</th><th className="font-medium">Заметка</th></tr>
                </thead>
                <tbody>
                  {data.log.map((g) => (
                    <tr key={g.id} className="border-t border-border">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{fmtDate(g.created_at)}</td>
                      <td className="pr-3">{g.email}</td>
                      <td className="pr-3 whitespace-nowrap">{ACTION[g.action] || g.action}</td>
                      <td className="pr-3">{PLAN_LABELS[g.plan] || "—"}</td>
                      <td className="pr-3 whitespace-nowrap">{g.action === "revoke" ? "—" : g.expires_at ? fmtDate(g.expires_at) : "бессрочно"}</td>
                      <td className="text-muted-foreground">{g.note || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════ UI bits ════════ */
const inputCls = "bg-input-background border border-border rounded-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#1a7a6d]/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-[11px] text-muted-foreground">{label}</span>{children}</label>;
}
function Spinner() {
  return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
}
function RefreshBtn({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} title="Обновить"
      className="p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50">
      <RefreshCw className={"w-3.5 h-3.5 " + (loading ? "animate-spin" : "")} />
    </button>
  );
}
function IconBtn({ children, title, onClick, danger, disabled }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className={"p-1.5 rounded-lg text-muted-foreground transition-colors disabled:opacity-40 " + (danger ? "hover:bg-red-500/10 hover:text-red-600" : "hover:bg-muted hover:text-foreground")}>
      {children}
    </button>
  );
}
function PrimaryBtn({ children, onClick, busy, type = "button", full }: { children: React.ReactNode; onClick?: () => void; busy?: boolean; type?: "button" | "submit"; full?: boolean }) {
  return (
    <button type={type} onClick={onClick} disabled={busy}
      className={"flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-white text-[12px] font-semibold disabled:opacity-60 " + (full ? "w-full" : "")}
      style={{ background: "linear-gradient(135deg, #1a7a6d, #0d7377)" }}>
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{children}
    </button>
  );
}

/* ════════ Page ════════ */
export function AdminPage() {
  const [pw, setPw] = useState<string | null>(() => sessionStorage.getItem(PW_KEY));
  const [tab, setTab] = useState<Tab>("stats");

  useEffect(() => {
    document.title = "Админка · MarketPlan";
    // проверяем сохранённый пароль (мог смениться)
    if (pw) call(pw, "/ping").catch(() => { sessionStorage.removeItem(PW_KEY); setPw(null); });
  }, []);

  if (!pw) return <AdminLogin onOk={setPw} />;

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "stats", label: "Статистика", icon: BarChart3 },
    { id: "users", label: "Пользователи", icon: Users },
    { id: "grants", label: "Доступы без оплаты", icon: KeyRound },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-4 py-3 flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#1a7a6d]" />
          <p className="text-[15px] font-bold">MarketPlan · Админка</p>
          <button onClick={() => { sessionStorage.removeItem(PW_KEY); setPw(null); }}
            className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground">
            <LogOut className="w-3.5 h-3.5" /> Выйти
          </button>
        </div>
        <nav className="max-w-[1100px] mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={"flex items-center gap-1.5 px-3 py-2 text-[13px] border-b-2 -mb-px whitespace-nowrap transition-colors " +
                (tab === t.id ? "border-[#1a7a6d] text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="max-w-[1100px] mx-auto px-4 py-5">
        {tab === "stats" && <StatsTab pw={pw} />}
        {tab === "users" && <UsersTab pw={pw} />}
        {tab === "grants" && <GrantsTab pw={pw} />}
      </main>
    </div>
  );
}
