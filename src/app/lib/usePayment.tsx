/**
 * usePayment — хук для инициирования платежа YooKassa.
 * Проверяет авторизацию, открывает форму входа если нужно,
 * создаёт платёж и редиректит на YooKassa.
 */
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "./useAuth";
import { initiatePayment } from "./useAccess";

export function usePayment() {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const pay = useCallback(async (planId: string) => {
    if (!user) {
      // Сохраняем намерение и открываем форму входа
      setPendingPlanId(planId);
      return false; // вызывающий код откроет модалку
    }

    setLoadingPlan(planId);
    try {
      const { confirmationUrl } = await initiatePayment(user.id, user.email, planId);
      window.location.href = confirmationUrl;
      return true;
    } catch (err: any) {
      console.error("[usePayment] initiatePayment error:", err);
      toast.error(err?.message || "Ошибка создания платежа. Попробуйте ещё раз.");
      return false;
    } finally {
      setLoadingPlan(null);
    }
  }, [user]);

  /** Вызывается после успешного входа, чтобы продолжить отложенный платёж */
  const payPending = useCallback(async (
    userId: string,
    email: string
  ): Promise<boolean> => {
    if (!pendingPlanId) return false;
    const plan = pendingPlanId;
    setPendingPlanId(null);
    setLoadingPlan(plan);
    try {
      const { confirmationUrl } = await initiatePayment(userId, email, plan);
      window.location.href = confirmationUrl;
      return true;
    } catch (err: any) {
      console.error("[usePayment] payPending error:", err);
      toast.error(err?.message || "Ошибка создания платежа.");
      return false;
    } finally {
      setLoadingPlan(null);
    }
  }, [pendingPlanId]);

  return { loadingPlan, pendingPlanId, setPendingPlanId, pay, payPending };
}
