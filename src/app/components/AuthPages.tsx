import { useState } from "react";
import {
  Zap, Loader2, Mail, Lock, User, Eye, EyeOff, ArrowRight, KeyRound, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/useAuth";
import { Mascot } from "./Mascot";

export function AuthPages() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResetHint, setShowResetHint] = useState(false);
  const { signUp, signIn } = useAuth();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { toast.error("Заполните email и пароль"); return; }
    if (!name.trim()) { toast.error("Укажите имя"); return; }
    if (password.length < 6) { toast.error("Пароль минимум 6 символов"); return; }

    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      toast.success("Аккаунт создан!");
    } catch (err: any) {
      console.error("Signup error:", err);
      const msg = err?.message || String(err);
      if (msg.includes("ALREADY_EXISTS") || msg.includes("уже зарегистрирован") || msg.includes("already")) {
        toast.info("Этот email уже зарегистрирован. Попробуйте войти.");
        setMode("login");
      } else {
        toast.error("Ошибка регистрации: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { toast.error("Заполните email и пароль"); return; }

    setLoading(true);
    setShowResetHint(false);
    try {
      await signIn(email.trim(), password);
      toast.success("Вход выполнен");
    } catch (err: any) {
      console.error("Login error:", err);
      const msg = err?.message || String(err);
      if (msg.includes("Invalid login") || msg.includes("invalid") || msg.includes("credentials")) {
        // Show option to create account instead
        toast.error(
          (t) => (
            <div className="flex flex-col gap-2">
              <p className="font-medium">Аккаунт не найден</p>
              <p className="text-[11px] opacity-80">Email "{email}" не зарегистрирован</p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => {
                    toast.dismiss(t);
                    setMode("signup");
                    if (!name.trim()) setName("User");
                  }}
                  className="flex-1 text-left text-white bg-[#d4a373] hover:bg-[#c0854a] px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
                >
                  Создать аккаунт
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t);
                    setMode("reset");
                  }}
                  className="text-left text-[#d4a373] hover:underline text-[12px] font-medium flex items-center gap-1"
                >
                  <KeyRound className="w-3 h-3" />
                  Сбросить пароль
                </button>
              </div>
            </div>
          ),
          { duration: 10000 }
        );
        setShowResetHint(true);
      } else {
        toast.error("Ошибка входа: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { 
      toast.error("Укажите email для сброса пароля"); 
      return; 
    }

    setLoading(true);
    try {
      // Call Supabase password reset
      const { createClient } = await import("@supabase/supabase-js");
      const { projectId, publicAnonKey } = await import("/utils/supabase/info");
      const supabase = createClient(
        `https://${projectId}.supabase.co`,
        publicAnonKey
      );
      
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast.success(
        "Письмо для сброса пароля отправлено! Проверьте почту.",
        { duration: 6000 }
      );
      setMode("login");
      setPassword("");
    } catch (err: any) {
      console.error("Password reset error:", err);
      toast.error("Не удалось отправить письмо: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* Left panel - feature showcase (desktop only) */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between relative overflow-hidden shrink-0 p-10"
        style={{ background: "linear-gradient(160deg, #0e1f1b 0%, #1a3028 50%, #0e2820 100%)" }}>
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, #d4a373 0%, transparent 60%)", transform: "translate(-30%, -30%)" }} />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-15 blur-3xl"
            style={{ background: "radial-gradient(circle, #1a7a6d 0%, transparent 60%)", transform: "translate(20%, 20%)" }} />
        </div>
        <div className="relative z-10">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #d4a373 0%, #b87a45 100%)" }}>
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white text-[17px] font-bold tracking-tight">MarketPlan</span>
          </div>
          {/* Heading */}
          <h2 className="text-white text-[28px] font-bold leading-tight mb-4">
            Всё для маркетолога<br />
            <span style={{ color: "#d4a373" }}>в одном месте</span>
          </h2>
          <p className="text-white/60 text-[14px] leading-relaxed mb-8">
            Планируйте, создавайте и анализируйте - с AI-помощником Марком на каждом шаге.
          </p>
          {/* Feature list */}
          <div className="space-y-3">
            {[
              { emoji: "🤖", text: "6 AI-инструментов на GPT-4o-mini" },
              { emoji: "📅", text: "Контент-план и маркетинговый календарь" },
              { emoji: "🎯", text: "OKR, персоны, CJM и конкуренты" },
              { emoji: "📊", text: "Unit-экономика и A/B тесты" },
              { emoji: "🦊", text: "Маскот Марк - ваш маркетинг-коуч" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[18px]">{f.emoji}</span>
                <span className="text-white/75 text-[13px]">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <p className="text-white/30 text-[11px]">© 2026 MarketPlan · Все права защищены</p>
        </div>
      </div>

      {/* Right panel - auth form */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
            style={{ background: "radial-gradient(circle, #d4a373 0%, transparent 70%)" }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-[0.08] blur-3xl"
            style={{ background: "radial-gradient(circle, #c0854a 0%, transparent 70%)" }} />
        </div>

        <div className="relative z-10 w-full max-w-md px-6">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <Mascot emotion={mode === "reset" ? "think" : mode === "login" ? "wave" : "celebrate"} size={100} />
            <h1
              className="text-[28px] font-bold tracking-tight mt-1"
              style={{
                background: "linear-gradient(135deg, #d4a373 0%, #e0c4a8 50%, #c0854a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              MarketPlan
            </h1>
            <p className="text-muted-foreground text-[13px] mt-1">
              {mode === "reset" ? "Восстановление пароля" : mode === "login" ? "Войдите в свой аккаунт" : "Создайте аккаунт"}
            </p>
          </div>

          {/* Reset password hint (shown after failed login) */}
          {showResetHint && mode === "login" && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[12px] text-emerald-700 font-medium">Аккаунт не найден</p>
                <p className="text-[11px] text-emerald-600/80 mt-0.5">
                  Этот email ещё не зарегистрирован. Создайте новый аккаунт или используйте другой email.
                </p>
                <button
                  onClick={() => {
                    setMode("signup");
                    if (!name.trim()) setName("User");
                  }}
                  className="mt-2 flex items-center gap-1.5 text-[12px] text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Создать аккаунт
                </button>
              </div>
            </div>
          )}

          {/* Login / Signup / Reset form */}
          <form
            onSubmit={mode === "reset" ? handlePasswordReset : mode === "signup" ? handleSignup : handleLogin}
            className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xl"
          >
            {mode === "signup" && (
              <div>
                <label className="text-[12px] font-medium text-foreground mb-1.5 block">Имя</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Как вас зовут"
                    className="w-full pl-10 pr-4 py-2.5 text-[13px] bg-input-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#d4a373]/40 placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[12px] font-medium text-foreground mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-2.5 text-[13px] bg-input-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#d4a373]/40 placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {mode !== "reset" && (
              <div>
                <label className="text-[12px] font-medium text-foreground mb-1.5 block">Пароль</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Минимум 6 символов" : "Ваш пароль"}
                    className="w-full pl-10 pr-12 py-2.5 text-[13px] bg-input-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#d4a373]/40 placeholder:text-muted-foreground"
                  />
                  <button
                    type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "reset" && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Мы отправим письмо с инструкциями для сброса пароля на указанный email.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-[14px] text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #d4a373 0%, #c0854a 100%)",
                boxShadow: "0 4px 16px rgba(212,163,115,0.3)",
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === "reset" ? (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Отправить письмо
                    </>
                  ) : (
                    <>
                      {mode === "signup" ? "Создать аккаунт" : "Войти"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <div className="text-center mt-5">
            {mode === "reset" ? (
              <button
                onClick={() => { 
                  setMode("login"); 
                  setPassword("");
                  setShowResetHint(false);
                }}
                className="text-[13px] text-[#d4a373] hover:underline font-medium"
              >
                ← Назад к входу
              </button>
            ) : (
              <>
                <p className="text-[13px] text-muted-foreground">
                  {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
                  <button
                    onClick={() => { 
                      setMode(mode === "login" ? "signup" : "login"); 
                      setPassword("");
                      setShowResetHint(false);
                    }}
                    className="text-[#d4a373] hover:underline font-medium"
                  >
                    {mode === "login" ? "Зарегистрируйтесь" : "Войдите"}
                  </button>
                </p>
                
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}