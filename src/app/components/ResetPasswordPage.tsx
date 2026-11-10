/**
 * ResetPasswordPage — сюда ведёт ссылка из письма «Сброс пароля».
 * supabase-js сам подхватывает сессию восстановления из URL,
 * после чего пользователь задаёт новый пароль.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { KeyRound, Loader2, Zap } from "lucide-react";
import { supabase } from "../lib/useAuth";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session && !cancelled) {
        setReady(true);
        setChecking(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setReady(true);
      setChecking(false);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Пароль должен быть не короче 6 символов"); return; }
    if (password !== confirm) { toast.error("Пароли не совпадают"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Пароль обновлён");
      navigate("/app", { replace: true });
    } catch (err: any) {
      toast.error("Не удалось сменить пароль: " + (err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[380px] bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #d4a373 0%, #b87a45 100%)" }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-bold tracking-tight">MarketPlan</span>
        </div>

        {checking ? (
          <div className="flex items-center gap-2 text-muted-foreground text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Проверяем ссылку...
          </div>
        ) : !ready ? (
          <div className="space-y-4">
            <h2 className="text-[18px] font-semibold">Ссылка недействительна</h2>
            <p className="text-[13px] text-muted-foreground">
              Ссылка для сброса пароля устарела или уже использована. Запросите новое письмо на странице входа.
            </p>
            <button
              onClick={() => navigate("/app", { replace: true })}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              На страницу входа
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-[18px] font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Новый пароль
              </h2>
              <p className="text-[13px] text-muted-foreground mt-1">Придумайте новый пароль для входа.</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium">Новый пароль</span>
              <input
                type="password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} minLength={6} required
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium">Повторите пароль</span>
              <input
                type="password" autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} minLength={6} required
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <button
              type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Сохранить пароль
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
