import { useState, useEffect, useCallback } from "react";
import { 
  User, Mail, Shield, LogOut, Users, Trash2, Send, Loader2, WifiOff, AlertTriangle, Plus, CheckCircle2,
  Crown, Lock, Key, Eye, EyeOff, Database, Check, ArrowRightLeft, RefreshCw, Edit3, Copy
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/useAuth";
import { projectId } from "/utils/supabase/info";
import { ModalOverlay } from "./ModalOverlay";
import { useModal } from "../hooks/useModal";
import { InviteModal, ALL_SECTIONS } from "./ProfilePageInviteModal";

function copyToClipboard(text: string) {
  // Always use fallback in iframe or when Clipboard API unavailable
  // This avoids console errors from permission denials
  if (!navigator.clipboard?.writeText || window.self !== window.top) {
    fallbackCopy(text);
    return;
  }
  
  // Try Clipboard API only if available and not in iframe
  navigator.clipboard.writeText(text).catch(() => {
    fallbackCopy(text);
  });
}

// Fallback copy method for environments where Clipboard API is blocked
function fallbackCopy(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  
  try {
    document.execCommand("copy");
  } catch (err) {
    // Silently fail - user will see no toast if copy fails
    console.error("Copy failed:", err);
  } finally {
    document.body.removeChild(textarea);
  }
}

type UserRole = "owner" | "editor" | "viewer";

interface TeamMember {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  addedAt?: number;
}

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b80b3260`;

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Владелец",
  editor: "Редактор",
  viewer: "Наблюдатель",
};

const ROLE_COLORS: Record<UserRole, string> = {
  owner: "text-[#d4a373] bg-[#d4a373]/10",
  editor: "text-emerald-500 bg-emerald-500/10",
  viewer: "text-teal-500 bg-teal-500/10",
};

// Retry-enabled fetch for cold-start resilience
async function retryFetch(input: RequestInfo, init?: RequestInit, retries = 3, delayMs = 1000): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(input, init);
      return res;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      console.warn(`[ProfilePage] fetch attempt ${attempt + 1}/${retries} failed, retrying in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
      delayMs *= 1.5;
    }
  }
  throw new Error("retryFetch: unreachable");
}

export function ProfilePage() {
  const { user, signOut, accessToken, isOwner } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Network status tracking
  useEffect(() => {
    const goOnline = () => { setIsOnline(true); toast.success("Соединение восстановлено"); };
    const goOffline = () => { setIsOnline(false); toast.error("Нет подключения к интернету"); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  // Load team from server (authoritative source: mp:team:{ownerId})
  const loadTeam = useCallback(async () => {
    if (!accessToken) {
      setTeamLoading(false);
      return;
    }
    setTeamLoading(true);
    try {
      const res = await retryFetch(`${BASE_URL}/auth/team`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      console.log("[ProfilePage] loadTeam response:", json);
      if (json.success && Array.isArray(json.data)) {
        setTeam(json.data);
      } else {
        console.error("[ProfilePage] loadTeam unexpected response:", json);
        toast.error("Не удалось загрузить команду");
      }
    } catch (err) {
      console.error("[ProfilePage] loadTeam error:", err);
      toast.error("Ошибка загрузки команды. Проверьте соединение.");
    } finally {
      setTeamLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteShowPw, setInviteShowPw] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>("editor");
  const [inviteAccess, setInviteAccess] = useState<string[] | "all">("all");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<string | null>(null);

  // Migration state
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  const [migrating, setMigrating] = useState(false);

  // Change password state
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changePwLoading, setChangePwLoading] = useState(false);

  // Member password reset state
  const [resetMemberId, setResetMemberId] = useState<string | null>(null);
  const [resetNewPw, setResetNewPw] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Load migration status on mount
  useEffect(() => {
    if (!accessToken) return;
    fetch(`${BASE_URL}/auth/migration-status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) setMigrationStatus(json.data);
      })
      .catch(() => {});
  }, [accessToken]);

  if (!user) return null;

  const canInvite = isOwner && team.length < 2;

  /* ====== HANDLERS ====== */

  const handleInvite = async () => {
    if (!inviteName.trim()) { toast.error("Укажите имя участника"); return; }
    if (!inviteEmail.trim()) { toast.error("Укажите email участника"); return; }
    if (!invitePassword.trim() || invitePassword.length < 6) { toast.error("Пароль минимум 6 символов"); return; }
    if (!accessToken) { toast.error("Сессия не авторизована. Перезайдите."); return; }
    setInviteLoading(true);
    try {
      console.log("[ProfilePage] handleInvite: sending invite for", inviteEmail.trim());
      const res = await retryFetch(`${BASE_URL}/auth/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim().toLowerCase(),
          password: invitePassword,
          role: inviteRole,
          access: inviteAccess,
        }),
      });
      const json = await res.json();
      console.log("[ProfilePage] handleInvite response:", json);
      if (!json.success) {
        // Handle specific error cases with user-friendly messages
        const errorMsg = json.error || `HTTP ${res.status}`;
        if (errorMsg.includes("уже в команде")) {
          toast.error("Этот участник уже в вашей команде");
        } else if (errorMsg.includes("лимит")) {
          toast.error("Достигнут лимит участников команды");
        } else {
          toast.error(`Ошибка приглашения: ${errorMsg}`);
        }
        return;
      }
      setInviteSuccess(true);
      // Reload team from server (authoritative source)
      await loadTeam();
      toast.success("Участник приглашён!");
    } catch (err: any) {
      // Network or unexpected errors only
      console.warn("[ProfilePage] handleInvite network error:", err.message);
      toast.error("Ошибка сети. Проверьте подключение.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!confirm(`Удалить ${member.name} (${member.email})?`)) return;
    try {
      const res = await retryFetch(`${BASE_URL}/auth/remove-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ memberId: member.userId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await loadTeam();
      toast.success("Участник удалён");
    } catch (err: any) {
      toast.error("Ошибка: " + (err?.message || "неизвестно"));
    }
  };

  const handleUpdateMember = async (memberId: string, newAccess: string[] | "all", newRole: UserRole) => {
    try {
      const res = await retryFetch(`${BASE_URL}/auth/update-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ memberId, role: newRole, access: newAccess }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await loadTeam();
      setEditMember(null);
      toast.success("Доступы обновлены");
    } catch (err: any) {
      toast.error("Ошибка: " + (err?.message || "неизвестно"));
    }
  };

  const handleManualMigration = async () => {
    setMigrating(true);
    try {
      const res = await retryFetch(`${BASE_URL}/auth/migrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMigrationStatus({ migrated: true, details: json.data });
      if (json.data.alreadyMigrated) {
        toast.info("Данные уже были мигрированы ранее");
      } else {
        toast.success(`Мигрировано ${json.data.migrated} ключей`);
      }
    } catch (err: any) {
      toast.error("Ошибка миграции: " + (err?.message || "неизвестно"));
    } finally {
      setMigrating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw) { toast.error("Введите текущий пароль"); return; }
    if (!newPw) { toast.error("Введите новый пароль"); return; }
    if (newPw.length < 6) { toast.error("Минимум 6 символов"); return; }
    if (newPw !== confirmPw) { toast.error("Пароли не совпадают"); return; }
    if (currentPw === newPw) { toast.error("Новый пароль должен отличаться от текущего"); return; }

    setChangePwLoading(true);
    try {
      const res = await retryFetch(`${BASE_URL}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const json = await res.json();
      if (!json.success) {
        if (json.error?.includes("incorrect")) {
          toast.error("Неверный текущий пароль");
        } else {
          throw new Error(json.error);
        }
        return;
      }
      toast.success("Пароль успешно изменён!");
      setPwOpen(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: any) {
      toast.error("Ошибка: " + (err?.message || "неизвестно"));
    } finally {
      setChangePwLoading(false);
    }
  };

  const handleResetMemberPassword = async (memberId: string) => {
    setResetMemberId(memberId);
    setResetLoading(true);
    setResetNewPw(null);
    try {
      const res = await retryFetch(`${BASE_URL}/auth/reset-member-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ memberId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setResetNewPw(json.data.password);
      toast.success("Пароль участника сброшен");
    } catch (err: any) {
      toast.error("Ошибка сброса: " + (err?.message || "неизвестно"));
      setResetMemberId(null);
    } finally {
      setResetLoading(false);
    }
  };

  const copyToClip = (field: string, text: string) => {
    copyToClipboard(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success("Скопировано");
  };

  // Password strength indicator
  const pwStrength = (() => {
    if (!newPw) return null;
    let score = 0;
    if (newPw.length >= 6) score++;
    if (newPw.length >= 10) score++;
    if (/[A-Z]/.test(newPw) && /[a-z]/.test(newPw)) score++;
    if (/[0-9]/.test(newPw)) score++;
    if (/[^A-Za-z0-9]/.test(newPw)) score++;
    if (score <= 1) return { label: "Слабый", color: "bg-red-500", w: "w-1/5" };
    if (score <= 2) return { label: "Средний", color: "bg-amber-500", w: "w-2/5" };
    if (score <= 3) return { label: "Хороший", color: "bg-yellow-500", w: "w-3/5" };
    if (score <= 4) return { label: "Сильный", color: "bg-emerald-500", w: "w-4/5" };
    return { label: "Отличный", color: "bg-emerald-600", w: "w-full" };
  })();

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-3xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-[20px] sm:text-[22px] font-semibold text-foreground flex items-center gap-2.5">
          <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#d4a373]" />
          Личный кабинет
        </h1>
        <p className="text-muted-foreground text-[13px] mt-1">Ваш профиль, безопасность и управление командой</p>
      </div>

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white text-[18px] sm:text-[20px] font-bold shrink-0"
            style={{ background: "linear-gradient(135deg, #d4a373 0%, #c0854a 50%, #a87040 100%)", boxShadow: "0 4px 16px rgba(212,163,115,0.25)" }}
          >
            {user.avatarInitials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] sm:text-[18px] font-bold text-foreground truncate">{user.name || "Пользователь"}</h2>
            <p className="text-[12px] sm:text-[13px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{user.email}</span>
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={"text-[11px] font-medium px-2.5 py-1 rounded-full " + ROLE_COLORS[user.role]}>
                {user.role === "owner" && <Crown className="w-3 h-3 inline mr-1" />}
                {ROLE_LABELS[user.role]}
              </span>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                ID: {user.id.slice(0, 8)}...
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-2.5 py-2 text-[12px] text-red-500 hover:bg-red-500/5 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-[#d4a373]" />
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">Безопасность</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Смена пароля для вашего аккаунта</p>
            </div>
          </div>
          {!pwOpen && (
            <button
              onClick={() => setPwOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-[11px] font-medium rounded-lg transition-colors"
            >
              <Key className="w-3 h-3" />
              Сменить пароль
            </button>
          )}
        </div>

        {pwOpen && (
          <div className="mt-4 pt-4 border-t border-border space-y-3">
            {/* Current password */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Текущий пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="Ваш текущий пароль"
                  className="w-full pl-9 pr-10 py-2.5 text-[13px] bg-input-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#d4a373]/40 placeholder:text-muted-foreground"
                />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCurrentPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Новый пароль</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type={showNewPw ? "text" : "password"}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Минимум 6 символов"
                  className="w-full pl-9 pr-10 py-2.5 text-[13px] bg-input-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#d4a373]/40 placeholder:text-muted-foreground"
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {/* Strength indicator */}
              {pwStrength && (
                <div className="mt-1.5">
                  <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${pwStrength.color} ${pwStrength.w} transition-all duration-300 rounded-full`} />
                  </div>
                  <p className={`text-[10px] mt-0.5 ${pwStrength.color.replace("bg-", "text-")}`}>{pwStrength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Подтвердите пароль</label>
              <div className="relative">
                <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Повторите новый проль"
                  onKeyDown={e => e.key === "Enter" && handleChangePassword()}
                  className={`w-full pl-9 pr-4 py-2.5 text-[13px] bg-input-background border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#d4a373]/40 placeholder:text-muted-foreground ${
                    confirmPw && confirmPw !== newPw ? "border-red-500/50" : "border-border"
                  }`}
                />
              </div>
              {confirmPw && confirmPw !== newPw && (
                <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />Пароли не совпадают
                </p>
              )}
              {confirmPw && confirmPw === newPw && newPw.length >= 6 && (
                <p className="text-[10px] text-emerald-500 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />Пароли совпадают
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleChangePassword}
                disabled={changePwLoading || !currentPw || !newPw || newPw !== confirmPw || newPw.length < 6}
                className="flex-1 py-2.5 bg-[#d4a373] hover:bg-[#c0854a] text-white text-[12px] font-medium rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {changePwLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Сохранить
              </button>
              <button
                onClick={() => { setPwOpen(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}
                className="px-4 py-2.5 text-[12px] text-muted-foreground hover:bg-muted rounded-xl transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data Migration Card (owner only) */}
      {isOwner && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-[#d4a373]" />
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">Миграция данных</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Перенос старых данных в изолированное рабочее пространство</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {migrationStatus?.migrated ? (
                <span className="text-[11px] text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" />Мигрировано
                </span>
              ) : (
                <button
                  onClick={handleManualMigration}
                  disabled={migrating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d4a373] hover:bg-[#c0854a] text-white text-[11px] font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {migrating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                  Мигрировать
                </button>
              )}
            </div>
          </div>
          {migrationStatus?.details && (
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[18px] font-bold text-foreground">{migrationStatus.details.count ?? migrationStatus.details.migrated ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Перенесено</p>
              </div>
              <div>
                <p className="text-[18px] font-bold text-foreground">{migrationStatus.details.skippedCount ?? migrationStatus.details.skipped ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Пропущено</p>
              </div>
              <div>
                <p className="text-[18px] font-bold text-foreground">{migrationStatus.details.totalLegacyKeys ?? "-"}</p>
                <p className="text-[10px] text-muted-foreground">Всего ключей</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Access info for non-owners */}
      {!isOwner && (
        <div className="bg-teal-500/5 border border-teal-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-teal-500" />
            <span className="text-[13px] font-semibold text-foreground">Ваши доступы</span>
          </div>
          {user.access === "all" ? (
            <p className="text-[12px] text-muted-foreground">У вас полный доступ ко всем разделам</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {user.access.map(path => {
                const section = ALL_SECTIONS.find(s => s.path === path);
                return (
                  <span key={path} className="text-[10px] bg-teal-500/10 text-teal-500 px-2 py-0.5 rounded-full">
                    {section?.label || path}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Team Management (owner only) */}
      {isOwner && (
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-semibold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-[#d4a373]" />Команда
              </h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">{team.length}/2 участников</p>
            </div>
            {canInvite && (
              <button
                onClick={() => { setInviteOpen(true); setInviteEmail(""); setInvitePassword(""); setInviteShowPw(false); setInviteSuccess(false); setInviteName(""); setInviteRole("editor"); setInviteAccess("all"); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#d4a373] hover:bg-[#c0854a] text-white text-[12px] font-medium rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />Пригласить
              </button>
            )}
          </div>

          {teamLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2 animate-spin" />
              <p className="text-[12px] text-muted-foreground">Загрузка команды...</p>
            </div>
          ) : team.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-[13px] text-muted-foreground">Вы пока не приглашали участников</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Можете пригласить до 2 человек</p>
            </div>
          ) : (
            <div className="space-y-3">
              {team.map(member => (
                <div key={member.userId} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-[13px] font-bold text-muted-foreground">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{member.name}</p>
                        <p className="text-[11px] text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={"text-[10px] font-medium px-2 py-0.5 rounded-full " + ROLE_COLORS[member.role]}>
                        {ROLE_LABELS[member.role]}
                      </span>
                      <button
                        onClick={() => handleResetMemberPassword(member.userId)}
                        disabled={resetLoading && resetMemberId === member.userId}
                        title="Сбросить пароль"
                        className="p-1.5 hover:bg-amber-500/10 rounded-lg text-muted-foreground hover:text-amber-500 transition-colors"
                      >
                        {resetLoading && resetMemberId === member.userId
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditMember(editMember === member.userId ? null : member.userId)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleRemoveMember(member)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Show reset password result */}
                  {resetMemberId === member.userId && resetNewPw && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                        <p className="text-[11px] text-amber-600 font-medium mb-2 flex items-center gap-1.5">
                          <Key className="w-3 h-3" />Новый пароль (покажите участнику)
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-[13px] text-foreground font-mono">
                            {resetNewPw}
                          </div>
                          <button onClick={() => copyToClip("reset-pw", resetNewPw)} className="p-2 hover:bg-muted rounded-lg">
                            {copiedField === "reset-pw" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                          </button>
                        </div>
                        <button onClick={() => { setResetMemberId(null); setResetNewPw(null); }} className="mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          Скрыть
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1">
                    {member.access === "all" ? (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">Полный доступ</span>
                    ) : (
                      member.access.map(path => (
                        <span key={path} className="text-[9px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                          {ALL_SECTIONS.find(s => s.path === path)?.label || path}
                        </span>
                      ))
                    )}
                  </div>
                  {editMember === member.userId && (
                    <EditMemberPanel
                      member={member}
                      onSave={(access, role) => handleUpdateMember(member.userId, access, role)}
                      onCancel={() => setEditMember(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {inviteOpen && (
        <ModalOverlay onClose={() => setInviteOpen(false)}>
          <InviteModal
            inviteSuccess={inviteSuccess}
            inviteName={inviteName}
            setInviteName={setInviteName}
            inviteEmail={inviteEmail}
            setInviteEmail={setInviteEmail}
            invitePassword={invitePassword}
            setInvitePassword={setInvitePassword}
            inviteShowPw={inviteShowPw}
            setInviteShowPw={setInviteShowPw}
            inviteRole={inviteRole}
            setInviteRole={setInviteRole}
            inviteAccess={inviteAccess}
            setInviteAccess={setInviteAccess}
            inviteLoading={inviteLoading}
            copiedField={copiedField}
            handleInvite={handleInvite}
            copyToClip={copyToClip}
            onClose={() => setInviteOpen(false)}
          />
        </ModalOverlay>
      )}
    </div>
  );
}

/* ========== Edit Member Panel ========== */
function EditMemberPanel({ member, onSave, onCancel }: {
  member: TeamMember;
  onSave: (access: string[] | "all", role: UserRole) => void;
  onCancel: () => void;
}) {
  const [role, setRole] = useState(member.role);
  const [access, setAccess] = useState<string[] | "all">(member.access);

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <div className="flex gap-2">
        {(["editor", "viewer"] as UserRole[]).map(r => (
          <button key={r} onClick={() => setRole(r)} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${role === r ? "border-[#d4a373]/40 bg-[#d4a373]/10 text-foreground" : "border-border text-muted-foreground"}`}>
            {r === "editor" ? "Редактор" : "Наблюдатель"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setAccess("all")} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border ${access === "all" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground"}`}>Все разделы</button>
        <button onClick={() => setAccess(access === "all" ? ["/"] : "all")} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border ${access !== "all" ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-border text-muted-foreground"}`}>Выбрать</button>
      </div>
      {access !== "all" && (
        <div className="max-h-36 overflow-y-auto border border-border rounded-lg p-1.5 space-y-0.5">
          {ALL_SECTIONS.map(section => (
            <label key={section.path} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30 cursor-pointer">
              <input type="checkbox" checked={access.includes(section.path)} onChange={() => {
                if (access.includes(section.path)) setAccess(access.filter(p => p !== section.path));
                else setAccess([...access, section.path]);
              }} className="w-3 h-3 rounded accent-[#d4a373]" />
              <span className="text-[10px] text-foreground">{section.label}</span>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => onSave(access, role)} className="flex-1 py-2 bg-[#d4a373] hover:bg-[#c0854a] text-white text-[11px] rounded-lg font-medium transition-colors">Сохранить</button>
        <button onClick={onCancel} className="px-4 py-2 text-[11px] text-muted-foreground hover:bg-muted rounded-lg transition-colors">Отмена</button>
      </div>
    </div>
  );
}