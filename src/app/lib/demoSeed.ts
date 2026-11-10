/**
 * Демо-наполнение для нового аккаунта: один проект-пример (кофейня),
 * контент-план на ближайшие две недели, идеи, два OKR текущего квартала и CJM.
 * Создаётся один раз: только если у пользователя ещё нет проектов.
 * Флаг demo_seeded не даёт создать демо повторно после удаления.
 */
import { getData, saveData } from "./api";
import { clearKVCache } from "./useKV";

const FLAG_KEY = "demo_seeded";

const uid = (p: string) => `${p}-demo-${Math.random().toString(36).slice(2, 8)}`;

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function quarterLabel(): string {
  const n = new Date();
  return `Q${Math.floor(n.getMonth() / 3) + 1} ${n.getFullYear()}`;
}

function buildProject() {
  return {
    id: uid("proj"),
    name: "Демо: кофейня «Тёплый угол»",
    description:
      "Пример проекта, чтобы посмотреть, как всё устроено. Сезонный запуск тыквенного латте и рост постоянных гостей. Можно править или удалить.",
    status: "active",
    industry: "Общепит / кофейни",
    totalBudget: 150000,
    spentBudget: 42000,
    startDate: isoDate(-14),
    endDate: isoDate(76),
    kpiSummary: "Цель: +25% выручки за квартал и 300 участников программы лояльности. Сейчас: +9% к выручке, 112 участников.",
    metrics: [
      { id: "dm1", name: "Выручка", value: 1090000, target: 1250000, unit: "RUB", parentId: null },
      { id: "dm2", name: "Чеков в месяц", value: 3900, target: 4300, unit: "шт", parentId: "dm1" },
      { id: "dm3", name: "Средний чек", value: 280, target: 300, unit: "RUB", parentId: "dm1" },
      { id: "dm4", name: "Доля постоянных гостей", value: 31, target: 40, unit: "%", parentId: "dm2" },
      { id: "dm5", name: "Охват соцсетей", value: 18500, target: 30000, unit: "чел", parentId: "dm2" },
    ],
    campaigns: [
      { id: "dc1", name: "Тыквенный латте: запуск", status: "active", channel: "Instagram", budget: 40000, spent: 21000, startDate: isoDate(-7), endDate: isoDate(21), impressions: 64000, clicks: 2100, conversions: 160, cpa: 131, roi: 210 },
      { id: "dc2", name: "Telegram: клуб постоянных гостей", status: "active", channel: "Telegram", budget: 15000, spent: 6000, startDate: isoDate(-14), endDate: isoDate(60), impressions: 9800, clicks: 1300, conversions: 112, cpa: 54, roi: 340 },
      { id: "dc3", name: "Коллаборация с соседним коворкингом", status: "planned", channel: "Партнёрства", budget: 20000, spent: 0, startDate: isoDate(10), endDate: isoDate(40), impressions: 0, clicks: 0, conversions: 0, cpa: 0, roi: 0 },
    ],
    audiences: [
      {
        id: "da1", name: "Работающие рядом", size: 1800, percentage: 55, description: "Офисные сотрудники 25–40 лет, кофе с собой утром и в обед", color: "#0d7377",
        avatars: [
          { id: "dav1", name: "Анна", age: "29", gender: "Ж", location: "Центр города", income: "90–130K", occupation: "Менеджер проектов", interests: ["Кофе", "Йога", "Подкасты"], painPoints: ["Очереди утром", "Мало времени"], goals: ["Быстро взять вкусный кофе", "Иногда поработать вне офиса"], channels: ["Instagram", "Telegram"], buyingBehavior: "Каждый будний день, заказ заранее через мессенджер", emoji: "👩‍💼" },
        ],
      },
      {
        id: "da2", name: "Студенты и фрилансеры", size: 1500, percentage: 45, description: "18–30 лет, сидят с ноутбуком, чувствительны к цене", color: "#d4a373",
        avatars: [
          { id: "dav2", name: "Максим", age: "22", gender: "М", location: "Рядом с университетом", income: "до 50K", occupation: "Студент, дизайнер-фрилансер", interests: ["Дизайн", "Игры", "Музыка"], painPoints: ["Нет розеток", "Дорого сидеть долго"], goals: ["Уютное место для работы", "Скидки"], channels: ["TikTok", "Telegram", "VK"], buyingBehavior: "2–3 раза в неделю, сидит по 2–3 часа", emoji: "🧑‍🎨" },
        ],
      },
    ],
    funnel: [
      { name: "Охват", value: 18500, conversion: 100 },
      { name: "Переходы", value: 3400, conversion: 18.4 },
      { name: "Визит", value: 980, conversion: 28.8 },
      { name: "Повторный визит", value: 300, conversion: 30.6 },
    ],
    isDemo: true,
  };
}

function post(offset: number, platforms: string[], type: string, topic: string, caption: string, status: string, goals: string, reach = 0) {
  return {
    id: uid("post"), date: isoDate(offset), platforms, type, topic, caption, status, goals,
    reach, impressions: Math.round(reach * 1.4), likes: Math.round(reach * 0.05), comments: Math.round(reach * 0.006),
    shares: Math.round(reach * 0.004), clicks: Math.round(reach * 0.02), saves: Math.round(reach * 0.01), followers_gained: Math.round(reach * 0.003),
  };
}

function buildPosts() {
  return [
    post(-3, ["Instagram"], "Reels/Shorts", "Как мы варим тыквенный латте", "Тыква, корица и двойной эспрессо — показываем, как рождается наш осенний хит. Заходите попробовать первыми!", "published", "Охват, интерес к новинке", 5200),
    post(-1, ["Telegram"], "Пост", "Клуб постоянных гостей: правила", "Каждый 6-й кофе — в подарок. Покажите это сообщение бариста, чтобы вступить в клуб.", "published", "Вступления в программу лояльности", 1300),
    post(1, ["Instagram", "VK"], "Карусель", "5 напитков для холодной недели", "Сохраните подборку: что пить, когда за окном +3. Листайте до конца — там секретный напиток.", "planned", "Сохранения, охват"),
    post(3, ["Instagram"], "Stories", "Опрос: какой сироп добавить в меню?", "Голосуйте! Победитель появится в меню уже в пятницу.", "planned", "Вовлечённость"),
    post(5, ["Telegram"], "Пост", "Утренний предзаказ без очереди", "Напишите нам до 9:00 — кофе будет готов к вашему приходу.", "in_progress", "Утренние продажи"),
    post(8, ["Instagram", "TikTok"], "Reels/Shorts", "День из жизни бариста", "Что происходит за стойкой с 7 утра до закрытия — честно и с юмором.", "planned", "Охват, доверие к бренду"),
    post(11, ["VK", "Telegram"], "Пост", "Анонс коллаборации с коворкингом", "Скидка 15% резидентам коворкинга напротив — и наоборот. Подробности завтра!", "planned", "Новая аудитория"),
  ];
}

function buildIdeas() {
  const now = new Date().toISOString();
  return [
    { id: uid("idea"), title: "Неделя латте-арта", description: "Каждый день новый рисунок, гости голосуют за лучший в сторис.", category: "Акция", links: [], tags: ["вовлечение", "UGC"], starred: true, status: "idea", createdAt: now },
    { id: uid("idea"), title: "Гид «Где поработать с ноутбуком в районе»", description: "Полезный пост-карусель, где мы — первое место. Хорошо сохраняют.", category: "Пост", links: [], tags: ["польза", "SEO"], starred: false, status: "idea", createdAt: now },
    { id: uid("idea"), title: "Рассылка для участников клуба", description: "Раз в месяц: новинки, закрытые дегустации, личное предложение.", category: "Email", links: [], tags: ["удержание"], starred: false, status: "in_progress", createdAt: now },
  ];
}

function buildOkrs() {
  const q = quarterLabel();
  const now = new Date().toISOString();
  return [
    {
      id: uid("okr"), title: "Сделать «Тёплый угол» любимой кофейней района", description: "Рост постоянных гостей через клуб и контент", quarter: q, category: "Удержание", createdAt: now,
      keyResults: [
        { id: uid("kr"), title: "Участников программы лояльности", metric: "Участники", current: 112, target: 300, unit: "чел", status: "on_track" },
        { id: uid("kr"), title: "Доля повторных визитов", metric: "Повторные визиты", current: 31, target: 40, unit: "%", status: "at_risk" },
        { id: uid("kr"), title: "Подписчиков в Telegram-канале", metric: "Подписчики", current: 640, target: 1000, unit: "чел", status: "on_track" },
      ],
    },
    {
      id: uid("okr"), title: "Успешно запустить сезонное меню", description: "Тыквенный латте и осенние напитки", quarter: q, category: "Продажи", createdAt: now,
      keyResults: [
        { id: uid("kr"), title: "Продано сезонных напитков", metric: "Продажи", current: 420, target: 1500, unit: "шт", status: "behind" },
        { id: uid("kr"), title: "Охват запуска в соцсетях", metric: "Охват", current: 18500, target: 30000, unit: "чел", status: "on_track" },
      ],
    },
  ];
}

function tp(name: string, channel: string, emotion: "positive" | "neutral" | "negative", pains: string[], opps: string[], metrics: string) {
  return { id: uid("tp"), name, channel, emotion, painPoints: pains, opportunities: opps, metrics };
}

function buildCjm() {
  return [
    {
      id: uid("cjm"), name: "Путь нового гостя", persona: "Анна, 29, работает рядом", createdAt: new Date().toISOString(),
      stages: [
        { id: uid("st"), name: "Осведомлённость", description: "Гость узнаёт о кофейне", emoji: "👀", color: "#d4a373", touchpoints: [
          tp("Reels в рекомендациях", "Instagram", "positive", ["Не знает, где мы находимся"], ["Добавить адрес и метку на карте в каждый ролик"], "Охват, переходы в профиль"),
        ] },
        { id: uid("st"), name: "Рассмотрение", description: "Сравнивает с соседними кофейнями", emoji: "🤔", color: "#0d7377", touchpoints: [
          tp("Отзывы на картах", "Яндекс Карты", "neutral", ["Мало свежих отзывов"], ["Просить отзыв за бонусный напиток"], "Рейтинг, число отзывов"),
        ] },
        { id: uid("st"), name: "Первый визит", description: "Приходит за кофе", emoji: "☕", color: "#1a7a6d", touchpoints: [
          tp("Очередь утром", "Офлайн", "negative", ["Ждать 7–10 минут"], ["Предзаказ в Telegram"], "Время ожидания"),
          tp("Бариста предлагает клуб", "Офлайн", "positive", [], ["Скрипт приглашения в клуб"], "Вступления в клуб"),
        ] },
        { id: uid("st"), name: "Лояльность", description: "Возвращается и советует друзьям", emoji: "💛", color: "#c08a40", touchpoints: [
          tp("Telegram-клуб", "Telegram", "positive", ["Забывает про бонусы"], ["Напоминание о подарочном кофе"], "Повторные визиты, ER канала"),
        ] },
      ],
    },
  ];
}

/** Возвращает true, если демо было создано сейчас. */
export async function seedDemoIfNeeded(): Promise<boolean> {
  try {
    const flag = await getData<{ at: string }>(FLAG_KEY);
    if (flag) return false;
    const projects = await getData<any[]>("projects:list");
    if (Array.isArray(projects) && projects.length > 0) {
      await saveData(FLAG_KEY, { at: new Date().toISOString(), skipped: true });
      return false;
    }
    const [posts, ideas, okrs, cjm] = await Promise.all([
      getData<any[]>("smm_plan:posts"), getData<any[]>("smm:content_ideas"),
      getData<any[]>("okr:objectives"), getData<any[]>("cjm:maps"),
    ]);
    const writes: Promise<boolean>[] = [saveData("projects:list", [buildProject()])];
    if (!posts?.length) writes.push(saveData("smm_plan:posts", buildPosts()));
    if (!ideas?.length) writes.push(saveData("smm:content_ideas", buildIdeas()));
    if (!okrs?.length) writes.push(saveData("okr:objectives", buildOkrs()));
    if (!cjm?.length) writes.push(saveData("cjm:maps", buildCjm()));
    const ok = (await Promise.all(writes)).every(Boolean);
    if (ok) {
      await saveData(FLAG_KEY, { at: new Date().toISOString() });
      clearKVCache();
    }
    return ok;
  } catch (e) {
    console.warn("[demoSeed] failed:", e);
    return false;
  }
}
