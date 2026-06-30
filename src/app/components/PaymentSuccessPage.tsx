/**
 * PaymentSuccessPage — страница после возврата из YooKassa.
 * Каждые 3 сек опрашивает user_access до появления активной записи.
 * Доступ НИКОГДА не выдаётся на фронте — только через БД.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { checkMarketPlanAccess, useAccess, PLAN_CONFIG, type AccessPlan } from "../lib/useAccess";

type PollingStatus = "polling" | "success" | "timeout";

const MAX_ATTEMPTS = 20;   // 20 × 3 сек = 60 сек
const POLL_INTERVAL = 3000;

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { refresh } = useAccess();

  const [status, setStatus] = useState<PollingStatus>("polling");
  const [activePlan, setActivePlan] = useState<AccessPlan>(null);
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/");
      return;
    }

    const poll = async () => {
      if (!mountedRef.current) return;

      try {
        const result = await checkMarketPlanAccess(user.id);

        if (!mountedRef.current) return;

        if (result.hasAccess && result.plan) {
          setStatus("success");
          setActivePlan(result.plan);
          await refresh();
          timerRef.current = setTimeout(() => {
            if (mountedRef.current) navigate("/app");
          }, 2500);
          return;
        }
      } catch (err) {
        console.error("[PaymentSuccessPage] poll error:", err);
      }

      attemptRef.current += 1;
      setAttempt(attemptRef.current);

      if (attemptRef.current >= MAX_ATTEMPTS) {
        if (mountedRef.current) setStatus("timeout");
        return;
      }

      timerRef.current = setTimeout(poll, POLL_INTERVAL);
    };

    // Первый запрос через 3 сек (даём webhook время обработаться)
    timerRef.current = setTimeout(poll, POLL_INTERVAL);
  }, [authLoading, user]);

  const planCfg = activePlan ? PLAN_CONFIG[activePlan] : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-6">

        {/* Icon */}
        <div className="flex justify-center">
          {status === "polling" && (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          )}
          {status === "success" && (
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
          )}
          {status === "timeout" && (
            <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-500" />
            </div>
          )}
        </div>

        {/* Title */}
        {status === "polling" && (
          <>
            <div className="space-y-2">
              <h1 className="text-[22px] font-bold text-foreground">Проверяем оплату...</h1>
              <p className="text-muted-foreground text-[14px]">
                Подтверждаем платёж и активируем доступ. Это займёт несколько секунд.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary/30"
                    style={{
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      backgroundColor: i < ((attemptRef.current % 5) + 1) ? "var(--primary)" : undefined,
                    }}
                  />
                ))}
              </div>
              <p className="text-[12px] text-muted-foreground">
                Попытка {attempt + 1} из {MAX_ATTEMPTS}
              </p>
            </div>
          </>
        )}

        {status === "success" && planCfg && (
          <>
            <div className="space-y-2">
              <h1 className="text-[22px] font-bold text-foreground">Оплата прошла!</h1>
              <p className="text-muted-foreground text-[14px]">
                Тариф активирован. Переходим в приложение...
              </p>
            </div>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[14px] font-semibold mx-auto"
              style={{ background: planCfg.gradient }}
            >
              {planCfg.badge} активирован
            </div>
          </>
        )}

        {status === "timeout" && (
          <>
            <div className="space-y-2">
              <h1 className="text-[22px] font-bold text-foreground">Платёж обрабатывается</h1>
              <p className="text-muted-foreground text-[14px]">
                Иногда подтверждение занимает чуть дольше. Если вы оплатили — доступ появится
                автоматически в течение нескольких минут.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  attemptRef.current = 0;
                  setAttempt(0);
                  setStatus("polling");
                  // restart polling
                  if (!user) return;
                  const poll = async () => {
                    if (!mountedRef.current) return;
                    const result = await checkMarketPlanAccess(user.id);
                    if (result.hasAccess && result.plan) {
                      setStatus("success");
                      setActivePlan(result.plan);
                      await refresh();
                      setTimeout(() => { if (mountedRef.current) navigate("/app"); }, 2500);
                      return;
                    }
                    attemptRef.current += 1;
                    setAttempt(attemptRef.current);
                    if (attemptRef.current >= MAX_ATTEMPTS) { setStatus("timeout"); return; }
                    timerRef.current = setTimeout(poll, POLL_INTERVAL);
                  };
                  timerRef.current = setTimeout(poll, POLL_INTERVAL);
                }}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-medium hover:opacity-90 transition-opacity"
              >
                Проверить ещё раз
              </button>
              <button
                onClick={() => navigate("/app")}
                className="w-full py-2.5 rounded-xl bg-muted text-foreground text-[14px] hover:bg-muted/70 transition-colors"
              >
                Войти в приложение
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
