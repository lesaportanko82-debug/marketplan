/**
 * Единое правило «логин → email» для входа и админки.
 * MarketPlan входит по настоящему email, поэтому функция только нормализует его.
 * Та же логика на сервере: supabase/functions/server/admin.tsx → loginToEmail.
 */
export function loginToEmail(login: string): string {
  return String(login || "").trim().toLowerCase();
}
