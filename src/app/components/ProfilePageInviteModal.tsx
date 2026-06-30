import { type UserRole } from "../lib/useAuth";
import { useModal } from "../hooks/useModal";
import {
  X, UserCheck, Copy, Check, Eye, EyeOff, Loader2, Send,
} from "lucide-react";

export const ALL_SECTIONS = [
  { path: "/", label: "Проекты" },
  { path: "/calendar", label: "Календарь" },
  { path: "/smm/plan", label: "Контент-план" },
  { path: "/content-studio", label: "Content Studio" },
  { path: "/repurpose", label: "Repurpose Engine" },
  { path: "/smm/ideas", label: "Идеи и заметки" },
  { path: "/smm/hashtags", label: "Хештеги и SEO" },
  { path: "/influencers", label: "Инфлюенсеры" },
  { path: "/competitors", label: "Конкуренты" },
  { path: "/competitor-spy", label: "Competitor Spy" },
  { path: "/ab-tests", label: "A/B Тесты" },
  { path: "/unit-economics", label: "Unit-экономика" },
  { path: "/media", label: "Бренд-ассеты" },
  { path: "/brand-voice", label: "Brand Voice" },
  { path: "/fatigue-detector", label: "Fatigue Detector" },
  { path: "/okr", label: "OKR-трекинг" },
  { path: "/cjm", label: "Customer Journey Map" },
  { path: "/personas", label: "Persona Builder" },
  { path: "/campaign-storyline", label: "Campaign Storyline" },
  { path: "/content-scoring", label: "Content Scoring" },
  { path: "/tools/metrics", label: "Метрики" },
  { path: "/tools/budget", label: "Прогноз бюджета" },
  { path: "/tools/audience", label: "ЦА и аватары" },
  { path: "/tools/triggers", label: "Триггеры" },
  { path: "/automations", label: "Автоматизации" },
  { path: "/settings", label: "Настройки" },
];

export function InviteModal({
  inviteSuccess,
  inviteName,
  setInviteName,
  inviteEmail,
  setInviteEmail,
  invitePassword,
  setInvitePassword,
  inviteShowPw,
  setInviteShowPw,
  inviteRole,
  setInviteRole,
  inviteAccess,
  setInviteAccess,
  inviteLoading,
  copiedField,
  handleInvite,
  copyToClip,
  onClose,
}: {
  inviteSuccess: boolean;
  inviteName: string;
  setInviteName: (v: string) => void;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  invitePassword: string;
  setInvitePassword: (v: string) => void;
  inviteShowPw: boolean;
  setInviteShowPw: (v: boolean) => void;
  inviteRole: UserRole;
  setInviteRole: (v: UserRole) => void;
  inviteAccess: string[] | "all";
  setInviteAccess: (v: string[] | "all") => void;
  inviteLoading: boolean;
  copiedField: string | null;
  handleInvite: () => void;
  copyToClip: (field: string, text: string) => void;
  onClose: () => void;
}) {
  const modalRef = useModal(onClose);

  return (
    <div
      ref={modalRef}
      className="bg-card border border-border rounded-2xl p-4 md:p-6 w-full max-w-md shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 id="invite-modal-title" className="text-[16px] font-semibold text-foreground">Пригласить участника</h3>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg" aria-label="Закрыть"><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {inviteSuccess ? (
        <div className="space-y-4">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-[13px] font-semibold text-foreground">Участник создан!</span>
            </div>
            <p className="text-[12px] text-muted-foreground">Передайте данные для входа. Пароль показывается только один раз.</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Email для входа</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-[13px] text-foreground font-mono">{inviteEmail}</div>
                <button onClick={() => copyToClip("email", inviteEmail)} className="p-2 hover:bg-muted rounded-lg">
                  {copiedField === "email" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Пароль</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 bg-muted/50 border border-border rounded-lg text-[13px] text-foreground font-mono">
                  {inviteShowPw ? invitePassword : "••••••••"}
                </div>
                <button onClick={() => setInviteShowPw(!inviteShowPw)} className="p-2 hover:bg-muted rounded-lg">
                  {inviteShowPw ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
                <button onClick={() => copyToClip("password", invitePassword)} className="p-2 hover:bg-muted rounded-lg">
                  {copiedField === "password" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <button
              onClick={() => { const text = `MarketPlan - данные для входа:\nEmail: ${inviteEmail}\nПароль: ${invitePassword}`; copyToClip("all", text); }}
              className="w-full py-2.5 bg-[#d4a373] hover:bg-[#c0854a] text-white rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />Скопировать всё
            </button>
          </div>
          <button onClick={onClose} className="w-full py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-[13px] transition-colors">Готово</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1.5 block">Имя участника</label>
            <input
              type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Как зовут участника"
              className="w-full px-3 py-2.5 text-[13px] bg-input-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#d4a373]/40 placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1.5 block">Email участника</label>
            <input
              type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email участника"
              className="w-full px-3 py-2.5 text-[13px] bg-input-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#d4a373]/40 placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1.5 block">Пароль участника</label>
            <div className="relative">
              <input
                type={inviteShowPw ? "text" : "password"} value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder="Минимум 6 символов"
                className="w-full px-3 pr-10 py-2.5 text-[13px] bg-input-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#d4a373]/40 placeholder:text-muted-foreground"
              />
              <button type="button" onClick={() => setInviteShowPw(!inviteShowPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {inviteShowPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {invitePassword && invitePassword.length < 6 && (
              <p className="text-[10px] text-amber-500 mt-1">Минимум 6 символов</p>
            )}
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1.5 block">Роль</label>
            <div className="flex gap-2">
              {(["editor", "viewer"] as UserRole[]).map(role => (
                <button
                  key={role} onClick={() => setInviteRole(role)}
                  className={`flex-1 py-2.5 rounded-xl text-[12px] font-medium border transition-all ${inviteRole === role ? "border-[#d4a373]/40 bg-[#d4a373]/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/30"}`}
                >
                  {role === "editor" ? "Редактор" : "Наблюдатель"}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{role === "editor" ? "Может редактировать" : "Только просмотр"}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground mb-1.5 block">Доступ к разделам</label>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setInviteAccess("all")} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${inviteAccess === "all" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground"}`}>Все разделы</button>
              <button onClick={() => setInviteAccess(inviteAccess === "all" ? ["/", "/calendar"] : "all")} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${inviteAccess !== "all" ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-border text-muted-foreground"}`}>Выбрать разделы</button>
            </div>
            {inviteAccess !== "all" && (
              <div className="bg-muted/30 border border-border rounded-xl p-3 max-h-[200px] overflow-y-auto space-y-1.5">
                {ALL_SECTIONS.map(section => {
                  const isSelected = Array.isArray(inviteAccess) && inviteAccess.includes(section.path);
                  return (
                    <button
                      key={section.path}
                      onClick={() => {
                        if (!Array.isArray(inviteAccess)) return;
                        setInviteAccess(isSelected ? inviteAccess.filter(p => p !== section.path) : [...inviteAccess, section.path]);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-colors ${isSelected ? "bg-emerald-500/10 text-emerald-600" : "text-muted-foreground hover:bg-muted/50"}`}
                    >
                      <div className={`w-3 h-3 rounded border flex items-center justify-center ${isSelected ? "border-emerald-500 bg-emerald-500" : "border-border"}`}>
                        {isSelected && <Check className="w-2 h-2 text-white" />}
                      </div>
                      {section.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 text-[13px] text-muted-foreground hover:bg-muted rounded-xl transition-colors">Отмена</button>
            <button
              onClick={handleInvite}
              disabled={inviteLoading || !inviteName.trim() || !inviteEmail.trim() || !invitePassword || invitePassword.length < 6}
              className="flex-1 py-2.5 bg-[#d4a373] hover:bg-[#c0854a] text-white rounded-xl text-[13px] font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {inviteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Пригласить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}