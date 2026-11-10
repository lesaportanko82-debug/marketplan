/**
 * usePayment — заявка на тариф (онлайн-оплата отключена).
 * Проверяет авторизацию, открывает форму входа если нужно,
 * и сохраняет заявку в таблицу plan_requests. Доступ выдаётся вручную.
 */
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useAuth, supabase } from "./useAuth";

/** Telegram для вопросов оплаты */
export const PAYMENT_TELEGRAM = "ohh_lessya";
export const PAYMENT_TELEGRAM_URL = `https://t.me/${PAYMENT_TELEGRAM}`;

function showPaymentContact() {
  toast.warning("Временный сбой оплаты из-за сервера", {
    description: `Пожалуйста, напишите нам в личные сообщения в Telegram: @${PAYMENT_TELEGRAM}. Мы подключим тариф вручную.`,
    duration: 20000,
    action: {
      label: "Написать в Telegram",
      onClick: () => window.open(PAYMENT_TELEGRAM_URL, "_blank", "noopener"),
    },
  });
}

async function submitPlanRequest(email: string, plan: string): Promise<void> {
  const { error } = await supabase.from("plan_requests").insert({ email, plan });
  if (error) {
    // 23505 — уже есть открытая заявка на этот тариф
    if ((error as any).code === "23505") {
      return;
    }
    throw new Error(error.message);
  }
}

export function usePayment() {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const send = useCallback(async (email: string, planId: string): Promise<boolean> => {
    setLoadingPlan(planId);
    try {
      // Заявку сохраняем для учёта, но пользователю в любом случае показываем контакт
      await submitPlanRequest(email, planId).catch((err) =>
        console.error("[usePayment] plan request error:", err));
      showPaymentContact();
      return true;
    } finally {
      setLoadingPlan(null);
    }
  }, []);

  const pay = useCallback(async (planId: string) => {
    if (!user) {
      // Сохраняем намерение и открываем форму входа
      setPendingPlanId(planId);
      return false; // вызывающий код откроет модалку
    }
    return send(user.email, planId);
  }, [user, send]);

  /** Вызывается после успешного входа, чтобы отправить отложенную заявку */
  const payPending = useCallback(async (_userId: string, email: string): Promise<boolean> => {
    if (!pendingPlanId) return false;
    const plan = pendingPlanId;
    setPendingPlanId(null);
    return send(email, plan);
  }, [pendingPlanId, send]);

  return { loadingPlan, pendingPlanId, setPendingPlanId, pay, payPending };
}
