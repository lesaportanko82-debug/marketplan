/**
 * Админ-панель MarketPlan — серверная часть.
 *
 * Доступ: пароль из секрета ADMIN_PASSWORD (Supabase → Edge Functions → Secrets),
 * передаётся в заголовке X-Admin-Password. Сравнение в константное время,
 * минимум 8 символов, блокировка IP на 15 минут после 8 неудачных попыток.
 * Все операции — под сервисным ключом.
 *
 * Вход в приложение — по настоящему email, поэтому loginToEmail просто
 * нормализует email (та же функция есть на фронте: src/app/lib/loginToEmail.ts).
 */
import type { Hono, Context } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const PROJECT = "marketplan";
const PLANS = ["start", "pro", "pro_plus"] as const;
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;
const PREFIX = "/make-server-b80b3260/admin";

export function loginToEmail(login: string): string {
  return String(login || "").trim().toLowerCase();
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/* ─── auth ─── */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  const len = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function clientIp(c: Context): string {
  const xf = c.req.header("x-forwarded-for") || "";
  return xf.split(",")[0].trim() || c.req.header("cf-connecting-ip") || "unknown";
}

type Gate = { ok: true } | { ok: false; status: number; error: string };

async function checkAdmin(c: Context): Promise<Gate> {
  const secret = Deno.env.get("ADMIN_PASSWORD") || "";
  if (secret.length < 8) {
    return { ok: false, status: 503, error: "Админка не настроена: задайте секрет ADMIN_PASSWORD (минимум 8 символов)" };
  }
  const ip = clientIp(c);
  const lockKey = `admin_lock:${ip}`;
  const lock = (await kv.get(lockKey)) as { fails: number; until?: number } | null;
  if (lock?.until && lock.until > Date.now()) {
    const min = Math.ceil((lock.until - Date.now()) / 60000);
    return { ok: false, status: 429, error: `Слишком много попыток. Попробуйте через ${min} мин.` };
  }
  const given = c.req.header("X-Admin-Password") || "";
  if (given.length >= 8 && safeEqual(given, secret)) {
    if (lock) await kv.del(lockKey);
    return { ok: true };
  }
  const fails = (lock?.until && lock.until <= Date.now() ? 0 : lock?.fails || 0) + 1;
  await kv.set(lockKey, fails >= MAX_FAILS ? { fails, until: Date.now() + LOCK_MS } : { fails });
  return { ok: false, status: 401, error: "Неверный пароль администратора" };
}

/* ─── helpers ─── */
async function listAllUsers() {
  const sb = admin();
  const users: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data?.users || []));
    if (!data?.users || data.users.length < 1000) break;
  }
  return users;
}

async function accessRows() {
  const { data, error } = await admin()
    .from("user_access")
    .select("user_id, email, plan, status, starts_at, expires_at, updated_at")
    .eq("project", PROJECT);
  if (error) throw error;
  return data || [];
}

function activeAccess(rows: any[], userId: string) {
  const now = new Date();
  return rows.find((r) => r.user_id === userId && r.status === "active" && (!r.expires_at || new Date(r.expires_at) > now)) || null;
}

async function ownUserIds(): Promise<Set<string>> {
  // «Свои» = есть профиль MarketPlan в KV или запись доступа этого приложения
  const ids = new Set<string>();
  const { data } = await admin().from("kv_store_b80b3260").select("key").like("key", "mp:user_profile:%");
  for (const r of data || []) ids.add(String(r.key).slice("mp:user_profile:".length));
  for (const r of await accessRows()) if (r.user_id) ids.add(String(r.user_id));
  return ids;
}

function isBanned(u: any) {
  return !!u.banned_until && new Date(u.banned_until) > new Date();
}

async function setAccess(userId: string, email: string, plan: string, expiresAt: string | null) {
  const now = new Date().toISOString();
  const { error } = await admin().from("user_access").upsert(
    { user_id: userId, email, project: PROJECT, plan, status: "active", starts_at: now, expires_at: expiresAt, updated_at: now },
    { onConflict: "user_id,project" },
  );
  if (error) throw error;
}

async function logGrant(row: { user_id?: string; email: string; plan: string; expires_at?: string | null; note?: string; action: string }) {
  await admin().from("admin_grants").insert(row);
}

function expiryFromTerm(term: string): string | null {
  if (term === "forever") return null;
  const days = Number(term) || 30;
  return new Date(Date.now() + days * 86400000).toISOString();
}

/* ─── routes ─── */
export function registerAdminRoutes(app: Hono) {
  // все admin-роуты защищены паролем
  app.use(`${PREFIX}/*`, async (c, next) => {
    const gate = await checkAdmin(c);
    if (!gate.ok) return c.json({ success: false, error: gate.error }, gate.status as any);
    await next();
  });

  app.get(`${PREFIX}/ping`, (c) => c.json({ success: true }));

  // Статистика
  app.get(`${PREFIX}/stats`, async (c) => {
    try {
      const [users, rows, own] = await Promise.all([listAllUsers(), accessRows(), ownUserIds()]);
      const mine = users.filter((u) => own.has(u.id));
      const now = Date.now();
      const monthAgo = now - 30 * 86400000, weekAgo = now - 7 * 86400000;
      const paid: Record<string, number> = { start: 0, pro: 0, pro_plus: 0 };
      for (const u of mine) {
        const a = activeAccess(rows, u.id);
        if (a && paid[a.plan] !== undefined) paid[a.plan]++;
      }
      // проекты и записи: projects:list каждого workspace + все записи KV
      const { data: projRows } = await admin().from("kv_store_b80b3260").select("value").like("key", "mp:ws:%:projects:list");
      const projects = (projRows || []).reduce((s, r: any) => s + (Array.isArray(r.value) ? r.value.length : 0), 0);
      const { count: records } = await admin().from("kv_store_b80b3260").select("key", { count: "exact", head: true }).like("key", "mp:ws:%");
      const { count: requests } = await admin().from("plan_requests").select("id", { count: "exact", head: true }).eq("status", "new");
      return c.json({
        success: true,
        data: {
          totalUsers: mine.length,
          paidTotal: paid.start + paid.pro + paid.pro_plus,
          paidByPlan: paid,
          activeMonth: mine.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > monthAgo).length,
          newWeek: mine.filter((u) => new Date(u.created_at).getTime() > weekAgo).length,
          blocked: mine.filter(isBanned).length,
          projects,
          records: records || 0,
          openRequests: requests || 0,
        },
      });
    } catch (e) {
      console.log(`[admin/stats] ${e}`);
      return c.json({ success: false, error: String(e) }, 500);
    }
  });

  // Пользователи
  app.get(`${PREFIX}/users`, async (c) => {
    try {
      const q = (c.req.query("q") || "").toLowerCase();
      const onlyOwn = c.req.query("own") !== "0";
      const [users, rows, own] = await Promise.all([listAllUsers(), accessRows(), ownUserIds()]);
      const list = users
        .filter((u) => !onlyOwn || own.has(u.id))
        .filter((u) => !q || (u.email || "").toLowerCase().includes(q) || (u.user_metadata?.name || "").toLowerCase().includes(q))
        .map((u) => {
          const a = activeAccess(rows, u.id);
          const anyRow = rows.find((r) => r.user_id === u.id) || null;
          return {
            id: u.id,
            email: u.email,
            name: u.user_metadata?.name || "",
            createdAt: u.created_at,
            lastSignIn: u.last_sign_in_at,
            blocked: isBanned(u),
            own: own.has(u.id),
            plan: a?.plan || null,
            expiresAt: a?.expires_at ?? anyRow?.expires_at ?? null,
            accessStatus: a ? "active" : anyRow ? "expired" : "none",
          };
        })
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return c.json({ success: true, data: list });
    } catch (e) {
      console.log(`[admin/users] ${e}`);
      return c.json({ success: false, error: String(e) }, 500);
    }
  });

  // Блокировка / разблокировка
  app.post(`${PREFIX}/users/:id/block`, async (c) => {
    try {
      const id = c.req.param("id");
      const { blocked } = await c.req.json();
      const { error } = await admin().auth.admin.updateUserById(id, { ban_duration: blocked ? "876000h" : "none" } as any);
      if (error) throw error;
      return c.json({ success: true });
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500);
    }
  });

  // Смена email / пароля
  app.post(`${PREFIX}/users/:id/credentials`, async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json();
      const patch: Record<string, unknown> = {};
      if (body.login) {
        const email = loginToEmail(body.login);
        if (!isEmail(email)) return c.json({ success: false, error: "Некорректный email" }, 400);
        patch.email = email;
        patch.email_confirm = true;
      }
      if (body.password) {
        if (String(body.password).length < 6) return c.json({ success: false, error: "Пароль: минимум 6 символов" }, 400);
        patch.password = String(body.password);
      }
      if (!Object.keys(patch).length) return c.json({ success: false, error: "Нечего менять" }, 400);
      const { error } = await admin().auth.admin.updateUserById(id, patch as any);
      if (error) throw error;
      if (patch.email) {
        await admin().from("user_access").update({ email: patch.email }).eq("user_id", id).eq("project", PROJECT);
        const prof = (await kv.get(`mp:user_profile:${id}`)) as any;
        if (prof) await kv.set(`mp:user_profile:${id}`, { ...prof, email: patch.email });
      }
      return c.json({ success: true });
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500);
    }
  });

  // Смена тарифа: { plan: "start"|"pro"|"pro_plus"|"none", term: "30"|"forever"|... }
  app.post(`${PREFIX}/user-tier/:id`, async (c) => {
    try {
      const id = c.req.param("id");
      const { plan, term = "30", note } = await c.req.json();
      const { data: u, error: uErr } = await admin().auth.admin.getUserById(id);
      if (uErr || !u?.user) return c.json({ success: false, error: "Пользователь не найден" }, 404);
      const email = u.user.email || "";
      if (plan === "none") {
        await admin().from("user_access").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("user_id", id).eq("project", PROJECT);
        await logGrant({ user_id: id, email, plan: "none", note, action: "revoke" });
        return c.json({ success: true });
      }
      if (!PLANS.includes(plan)) return c.json({ success: false, error: "Неизвестный тариф" }, 400);
      const expiresAt = expiryFromTerm(String(term));
      await setAccess(id, email, plan, expiresAt);
      await logGrant({ user_id: id, email, plan, expires_at: expiresAt, note, action: "tier" });
      return c.json({ success: true, data: { expiresAt } });
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500);
    }
  });

  // Удаление пользователя
  app.delete(`${PREFIX}/users/:id`, async (c) => {
    try {
      const id = c.req.param("id");
      const { error } = await admin().auth.admin.deleteUser(id);
      if (error) throw error;
      await admin().from("user_access").delete().eq("user_id", id).eq("project", PROJECT);
      await kv.del(`mp:user_profile:${id}`);
      await kv.del(`mp:user_workspace:${id}`);
      await admin().from("kv_store_b80b3260").delete().like("key", `mp:ws:${id}:%`);
      return c.json({ success: true });
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500);
    }
  });

  // Выдача доступа без оплаты: создаёт аккаунт (или обновляет существующий) и тариф
  app.post(`${PREFIX}/grants`, async (c) => {
    try {
      const { login, password, plan, term = "30", note, name } = await c.req.json();
      const email = loginToEmail(login);
      if (!isEmail(email)) return c.json({ success: false, error: "Укажите корректный email (логин)" }, 400);
      if (!PLANS.includes(plan)) return c.json({ success: false, error: "Неизвестный тариф" }, 400);
      const sb = admin();
      const existing = (await listAllUsers()).find((u) => (u.email || "").toLowerCase() === email);
      let userId: string;
      let created = false;
      if (existing) {
        userId = existing.id;
        if (password) {
          if (String(password).length < 6) return c.json({ success: false, error: "Пароль: минимум 6 символов" }, 400);
          const { error } = await sb.auth.admin.updateUserById(userId, { password: String(password), email_confirm: true });
          if (error) throw error;
        }
      } else {
        if (!password || String(password).length < 6) return c.json({ success: false, error: "Для нового аккаунта нужен пароль (минимум 6 символов)" }, 400);
        const { data, error } = await sb.auth.admin.createUser({
          email, password: String(password), email_confirm: true, user_metadata: { name: name || "" },
        });
        if (error) throw error;
        userId = data.user.id;
        created = true;
      }
      // профиль и workspace, как при обычной регистрации
      if (!(await kv.get(`mp:user_profile:${userId}`))) {
        await kv.set(`mp:user_profile:${userId}`, {
          id: userId, email, name: name || "", role: "owner", workspaceId: userId, access: "all", createdAt: new Date().toISOString(),
        });
      }
      if (!(await kv.get(`mp:user_workspace:${userId}`))) {
        await kv.set(`mp:user_workspace:${userId}`, { workspaceId: userId, role: "owner", access: "all" });
      }
      const expiresAt = expiryFromTerm(String(term));
      await setAccess(userId, email, plan, expiresAt);
      await logGrant({ user_id: userId, email, plan, expires_at: expiresAt, note, action: created ? "grant_new" : "grant" });
      await sb.from("plan_requests").update({ status: "done" }).eq("user_id", userId).eq("status", "new");
      return c.json({ success: true, data: { userId, email, created, expiresAt } });
    } catch (e) {
      console.log(`[admin/grants] ${e}`);
      return c.json({ success: false, error: String(e) }, 500);
    }
  });

  // Журнал выдач + открытые заявки на тариф
  app.get(`${PREFIX}/grants`, async (c) => {
    try {
      const sb = admin();
      const { data: log } = await sb.from("admin_grants").select("*").order("created_at", { ascending: false }).limit(200);
      const { data: requests } = await sb.from("plan_requests").select("*").eq("status", "new").order("created_at", { ascending: false }).limit(100);
      return c.json({ success: true, data: { log: log || [], requests: requests || [] } });
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500);
    }
  });

  // Отклонить заявку
  app.post(`${PREFIX}/requests/:id/close`, async (c) => {
    try {
      await admin().from("plan_requests").update({ status: "rejected" }).eq("id", Number(c.req.param("id")));
      return c.json({ success: true });
    } catch (e) {
      return c.json({ success: false, error: String(e) }, 500);
    }
  });
}
