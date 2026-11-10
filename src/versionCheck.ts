/**
 * Защита от «застрявшей» версии: сервер не отдаёт Cache-Control для HTML,
 * и браузер может показывать старую сборку (со старым бэкендом).
 * Раз в 5 минут и при возврате на вкладку сверяем имя бандла в свежем index.html
 * с текущим; если вышла новая сборка — перезагружаем страницу.
 */
function currentBundle(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s ? new URL(s.src, location.href).pathname : null;
}

async function latestBundle(): Promise<string | null> {
  try {
    const res = await fetch(`/?_v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/\/assets\/index-[\w-]+\.js/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

export function startVersionCheck() {
  const mine = currentBundle();
  if (!mine) return; // dev-режим
  const check = async () => {
    const latest = await latestBundle();
    if (latest && latest !== mine && !sessionStorage.getItem(`mp_reloaded_${latest}`)) {
      sessionStorage.setItem(`mp_reloaded_${latest}`, "1");
      location.reload();
    }
  };
  check();
  setInterval(check, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
}
