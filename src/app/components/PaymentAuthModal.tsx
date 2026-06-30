/**
 * PaymentAuthModal — компактная форма входа/регистрации для flow оплаты.
 * Показывается когда пользователь жмёт на тариф без авторизации.
 * После входа — автоматически запускает платёж.
 */
import { useState } from "react";
import { Loader2, Mail, Lock, User, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../lib/useAuth";

interface Props {
  planName: string;
  onClose: () => void;
  onAuthSuccess: () => void;
}

export function PaymentAuthModal({ planName, onClose, onAuthSuccess }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Заполните email и пароль");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      toast.error("Укажите имя");
      return;
    }
    if (password.length < 6) {
      toast.error("Пароль минимум 6 символов");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), password, name.trim());
        toast.success("Аккаунт создан! Переходим к оплате...");
      } else {
        await signIn(email.trim(), password);
        toast.success("Вход выполнен! Переходим к оплате...");
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error("[PaymentAuthModal] auth error:", err);
      const msg = err?.message || String(err);
      if (mode === "login" && (msg.includes("Invalid") || msg.includes("credentials"))) {
        toast.error("Неверный email или пароль");
      } else if (msg.includes("already") || msg.includes("ALREADY_EXISTS")) {
        toast.info("Email уже зарегистрирован");
        setMode("login");
      } else {
        toast.error(mode === "signup" ? "Ошибка регистрации" : "Ошибка входа");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-foreground">
              {mode === "login" ? "Войдите" : "Создайте аккаунт"}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              для подключения тарифа «{planName}»
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Имя"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-muted/40 border border-border rounded-xl text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoComplete="name"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-muted/40 border border-border rounded-xl text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoComplete="email"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPw ? "text" : "password"}
              placeholder="Пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-9 pr-10 py-2.5 bg-muted/40 border border-border rounded-xl text-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-white text-[14px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #1a7a6d, #2eb8a4)" }}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading
              ? "Подождите..."
              : mode === "login" ? "Войти и оплатить" : "Создать и оплатить"}
          </button>
        </form>

        {/* Mode toggle */}
        <p className="text-center text-[12px] text-muted-foreground">
          {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-primary hover:underline font-medium"
          >
            {mode === "login" ? "Создать" : "Войти"}
          </button>
        </p>
      </div>
    </div>
  );
}
