/**
 * UpsellModal — попап для перехода на платный тариф.
 * Показывается автоматически через 30 сек в режиме просмотра
 * и при клике на заблокированный контент.
 */
import { useNavigate } from "react-router";
import { Crown, Sparkles, Zap, X, ArrowRight } from "lucide-react";
import { Mascot } from "./Mascot";

interface Props {
  onClose: () => void;
  /** true — при клике на AI-функцию у пользователя Старт */
  aiOnly?: boolean;
}

export function UpsellModal({ onClose, aiOnly = false }: Props) {
  const navigate = useNavigate();

  const handlePricing = () => {
    onClose();
    navigate("/app/pricing");
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Top gradient strip */}
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, #d4a373, #1a7a6d, #7c3aed)" }}
        />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Mascot emotion="wink" size={52} animate={false} />
              <div>
                <h2 className="text-[18px] font-bold text-foreground leading-snug">
                  {aiOnly
                    ? "Эта функция требует тарифа Про"
                    : "MarketPlan станет вашей правой рукой"}
                </h2>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {aiOnly
                    ? "AI-инструменты доступны с тарифом Про или Про+"
                    : "Приобретайте тариф и используйте весь функционал сервиса"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded-lg hover:bg-muted/50 transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Plans summary */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #d4a373, #c08a40)" }}>
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground">Старт · 500 ₽/мес</p>
                <p className="text-[11px] text-muted-foreground">Все инструменты без AI</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #1a7a6d, #2eb8a4)" }}>
                <Crown className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground">Про · 700 ₽/мес</p>
                <p className="text-[11px] text-muted-foreground">Весь функционал + все AI-инструменты</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #1a7a6d, #2eb8a4)" }}>
                Хит
              </span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-foreground">Про+ · 1 500 ₽/квартал</p>
                <p className="text-[11px] text-muted-foreground">Весь функционал на 3 месяца · ≈ 500 ₽/мес</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handlePricing}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-[14px] font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-md"
              style={{ background: "linear-gradient(135deg, #1a7a6d, #2eb8a4)" }}
            >
              Выбрать тариф
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-xl bg-muted text-foreground text-[14px] hover:bg-muted/70 transition-colors"
            >
              Позже
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
