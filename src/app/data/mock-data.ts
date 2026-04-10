export interface MetricNode {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: string;
  parentId: string | null;
  formula?: string;
  children?: MetricNode[];
}

export interface Campaign {
  id: string;
  name: string;
  status: "active" | "paused" | "completed" | "planned";
  channel: string;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cpa: number;
  roi: number;
}

export interface AudienceAvatar {
  id: string;
  name: string;
  age: string;
  gender: string;
  location: string;
  income: string;
  occupation: string;
  interests: string[];
  painPoints: string[];
  goals: string[];
  channels: string[];
  buyingBehavior: string;
  emoji: string;
}

export interface AudienceSegment {
  id: string;
  name: string;
  size: number;
  percentage: number;
  description: string;
  color: string;
  avatars: AudienceAvatar[];
}

export interface FunnelStage {
  name: string;
  value: number;
  conversion: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "completed";
  industry: string;
  totalBudget: number;
  spentBudget: number;
  startDate: string;
  endDate: string;
  kpiSummary: string;
  metrics: MetricNode[];
  campaigns: Campaign[];
  audiences: AudienceSegment[];
  funnel: FunnelStage[];
}

export const mockProjects: Project[] = [
  {
    id: "1",
    name: "E-commerce Relaunch",
    description: "Полный перезапуск маркетинга интернет-магазина электроники с фокусом на performance-каналы и ретаргетинг существующей базы.",
    status: "active",
    industry: "E-commerce",
    totalBudget: 2500000,
    spentBudget: 1180000,
    startDate: "2026-01-15",
    endDate: "2026-06-30",
    kpiSummary: "Цель: увеличить выручку на 35% за Q1-Q2 2026. Текущий прогресс: +22% к baseline. CAC снижен на 18%. ROAS вырос с 2.1x до 3.4x.",
    metrics: [
      { id: "m1", name: "Revenue", value: 8750000, target: 12000000, unit: "RUB", parentId: null },
      { id: "m2", name: "ROAS", value: 3.4, target: 4.0, unit: "x", parentId: "m1", formula: "Revenue / Ad Spend" },
      { id: "m3", name: "AOV", value: 4200, target: 5000, unit: "RUB", parentId: "m1" },
      { id: "m4", name: "Конверсия сайта", value: 2.8, target: 3.5, unit: "%", parentId: "m1" },
      { id: "m5", name: "Трафик", value: 185000, target: 250000, unit: "visits", parentId: "m4" },
      { id: "m6", name: "CTR объявлений", value: 3.2, target: 4.0, unit: "%", parentId: "m5" },
      { id: "m7", name: "CPC", value: 28, target: 22, unit: "RUB", parentId: "m5" },
      { id: "m8", name: "CAC", value: 1200, target: 900, unit: "RUB", parentId: "m2", formula: "Ad Spend / Conversions" },
      { id: "m9", name: "LTV", value: 15600, target: 18000, unit: "RUB", parentId: "m2" },
      { id: "m10", name: "Retention Rate", value: 34, target: 45, unit: "%", parentId: "m9" },
      { id: "m11", name: "NPS", value: 42, target: 55, unit: "pts", parentId: "m9" },
      { id: "m12", name: "Email Open Rate", value: 24, target: 30, unit: "%", parentId: "m10" },
    ],
    campaigns: [
      { id: "c1", name: "Яндекс Директ - Поиск", status: "active", channel: "Яндекс Директ", budget: 450000, spent: 312000, startDate: "2026-01-15", endDate: "2026-06-30", impressions: 2800000, clicks: 89600, conversions: 2240, cpa: 139, roi: 280 },
      { id: "c2", name: "VK Ads - Ретаргетинг", status: "active", channel: "VK Реклама", budget: 280000, spent: 195000, startDate: "2026-02-01", endDate: "2026-05-31", impressions: 4500000, clicks: 135000, conversions: 1620, cpa: 120, roi: 320 },
      { id: "c3", name: "Telegram Ads", status: "active", channel: "Telegram", budget: 180000, spent: 98000, startDate: "2026-02-15", endDate: "2026-06-30", impressions: 1200000, clicks: 36000, conversions: 720, cpa: 136, roi: 245 },
      { id: "c4", name: "Email-рассылки", status: "active", channel: "Email", budget: 85000, spent: 42000, startDate: "2026-01-15", endDate: "2026-06-30", impressions: 350000, clicks: 84000, conversions: 4200, cpa: 10, roi: 1850 },
      { id: "c5", name: "SEO + Контент", status: "active", channel: "Органика", budget: 320000, spent: 210000, startDate: "2026-01-01", endDate: "2026-12-31", impressions: 890000, clicks: 62300, conversions: 1870, cpa: 112, roi: 380 },
      { id: "c6", name: "Influencer-кампания Q2", status: "planned", channel: "Блогеры", budget: 400000, spent: 0, startDate: "2026-04-01", endDate: "2026-06-30", impressions: 0, clicks: 0, conversions: 0, cpa: 0, roi: 0 },
    ],
    audiences: [
      {
        id: "a1", name: "Tech-энтузиасты", size: 45000, percentage: 35, description: "Молодые мужчины 25-35, увлечённые технологиями, высокий средний чек", color: "#0d7377",
        avatars: [
          { id: "av1", name: "Алексей", age: "28", gender: "М", location: "Москва", income: "150-200K", occupation: "Frontend-разработчик", interests: ["Гаджеты", "Игры", "Программирование", "YouTube"], painPoints: ["Нехватка времени на сравнение товаров", "Сложная навигация сайтов"], goals: ["Быть в курсе новинок", "Купить лучшее за свои деньги"], channels: ["YouTube", "Telegram", "Habr"], buyingBehavior: "Исследует 3-5 обзоров перед покупкой", emoji: "👨‍💻" },
          { id: "av2", name: "Дмитрий", age: "32", gender: "М", location: "СПб", income: "200-300K", occupation: "Product Manager", interests: ["Умный дом", "Фотография", "Путешествия"], painPoints: ["Качество сервиса", "Скорость доставки"], goals: ["Автоматизировать быт", "Качественная техника"], channels: ["Telegram", "VC.ru", "Instagram"], buyingBehavior: "Покупает импульсивно, но дорогое", emoji: "📱" },
        ],
      },
      {
        id: "a2", name: "Практичные покупатели", size: 38000, percentage: 30, description: "Женщины и мужчины 30-45, ищут соотношение цена/качество", color: "#d4a373",
        avatars: [
          { id: "av3", name: "Мария", age: "35", gender: "Ж", location: "Казань", income: "80-120K", occupation: "Бухгалтер", interests: ["Семья", "Кулинария", "Скидки", "Ozon"], painPoints: ["Высокие цены", "Непонятные характеристики"], goals: ["Сэкономить", "Купить надёжное"], channels: ["VK", "WhatsApp", "Email"], buyingBehavior: "Сравнивает цены на 3+ площадках", emoji: "👩‍👧" },
        ],
      },
      {
        id: "a3", name: "Корпоративные клиенты", size: 12000, percentage: 15, description: "Малый и средний бизнес, закупки техники для офиса", color: "#c08a40",
        avatars: [
          { id: "av4", name: "Сергей", age: "42", gender: "М", location: "Новосибирск", income: "250K+ (бюджет компании)", occupation: "Директор IT-отдела", interests: ["B2B решения", "Оптимизация", "Надёжность"], painPoints: ["Сложный документооборот", "Нет оптовых скидок"], goals: ["Оснастить офис", "Минимизировать простои"], channels: ["Email", "LinkedIn", "Профильные форумы"], buyingBehavior: "Долгий цикл, тендеры, ТЗ", emoji: "🏢" },
        ],
      },
      {
        id: "a4", name: "Геймеры", size: 25000, percentage: 20, description: "Молодёжь 18-28, покупают игровое оборудование", color: "#2eb8a4",
        avatars: [
          { id: "av5", name: "Кирилл", age: "22", gender: "М", location: "Екатеринбург", income: "50-80K", occupation: "Студент / Фрилансер", interests: ["Esports", "Стриминг", "Twitch", "Discord"], painPoints: ["Ограниченный бюджет", "Хочет топовое"], goals: ["Собрать мощный ПК", "Начать стримить"], channels: ["YouTube", "Twitch", "Discord", "Telegram"], buyingBehavior: "Копит, покупает на акциях", emoji: "🎮" },
        ],
      },
    ],
    funnel: [
      { name: "Охват", value: 9740000, conversion: 100 },
      { name: "Показы", value: 4500000, conversion: 46.2 },
      { name: "Клики", value: 406900, conversion: 9.0 },
      { name: "Визиты", value: 185000, conversion: 45.5 },
      { name: "Лиды", value: 12800, conversion: 6.9 },
      { name: "Покупки", value: 10650, conversion: 83.2 },
    ],
  },
  {
    id: "2",
    name: "SaaS Product Launch",
    description: "Запуск нового B2B SaaS-продукта для автоматизации HR-процессов. Фокус на контент-маркетинг и лидогенерацию.",
    status: "active",
    industry: "SaaS / B2B",
    totalBudget: 1800000,
    spentBudget: 620000,
    startDate: "2026-02-01",
    endDate: "2026-08-31",
    kpiSummary: "Цель: 500 триальных регистраций за 6 месяцев. Текущий прогресс: 187 регистраций. MQL растут на 15% MoM.",
    metrics: [
      { id: "m1", name: "Trial Sign-ups", value: 187, target: 500, unit: "users", parentId: null },
      { id: "m2", name: "MQL", value: 420, target: 1200, unit: "leads", parentId: "m1" },
      { id: "m3", name: "SQL", value: 98, target: 300, unit: "leads", parentId: "m2" },
      { id: "m4", name: "Demo Requests", value: 65, target: 200, unit: "requests", parentId: "m3" },
      { id: "m5", name: "CAC", value: 3300, target: 2500, unit: "RUB", parentId: "m1" },
    ],
    campaigns: [
      { id: "c1", name: "Контент-хаб HR", status: "active", channel: "SEO", budget: 350000, spent: 180000, startDate: "2026-02-01", endDate: "2026-08-31", impressions: 520000, clicks: 31200, conversions: 156, cpa: 1154, roi: 180 },
      { id: "c2", name: "LinkedIn Ads", status: "active", channel: "LinkedIn", budget: 420000, spent: 210000, startDate: "2026-03-01", endDate: "2026-08-31", impressions: 890000, clicks: 17800, conversions: 89, cpa: 2360, roi: 145 },
      { id: "c3", name: "Вебинары", status: "active", channel: "Events", budget: 200000, spent: 85000, startDate: "2026-02-15", endDate: "2026-07-31", impressions: 45000, clicks: 9000, conversions: 270, cpa: 315, roi: 520 },
    ],
    audiences: [
      {
        id: "a1", name: "HR-директора", size: 8500, percentage: 45, description: "Руководители HR-отделов в компаниях 50-500 сотрудников", color: "#06b6d4",
        avatars: [
          { id: "av1", name: "Елена", age: "38", gender: "Ж", location: "Москва", income: "200-300K", occupation: "HR Director", interests: ["HR Tech", "People Analytics", "Управление талантами"], painPoints: ["Рутинные процессы", "Текучка кадров", "Нет аналитики"], goals: ["Автоматизировать HR", "Снизить текучку"], channels: ["LinkedIn", "Email", "HR-конференции"], buyingBehavior: "Принимает решения после демо", emoji: "👩‍💼" },
        ],
      },
      {
        id: "a2", name: "CEO малого бизнеса", size: 5200, percentage: 30, description: "Владельцы и CEO компаний до 50 человек, совмещают HR-функцию", color: "#0891b2",
        avatars: [
          { id: "av2", name: "Игорь", age: "34", gender: "М", location: "Москва", income: "300K+", occupation: "CEO / Основатель", interests: ["Стартапы", "Автоматизация", "Рост бизнеса"], painPoints: ["Нет HR-отдела", "Много ручной работы"], goals: ["Систематизировать процессы", "Масштабировать команду"], channels: ["Telegram", "VC.ru", "Подкасты"], buyingBehavior: "Быстрые решения, ценит простоту", emoji: "🚀" },
        ],
      },
    ],
    funnel: [
      { name: "Охват", value: 1455000, conversion: 100 },
      { name: "Клики", value: 58000, conversion: 4.0 },
      { name: "Лиды (MQL)", value: 420, conversion: 0.7 },
      { name: "SQL", value: 98, conversion: 23.3 },
      { name: "Демо", value: 65, conversion: 66.3 },
      { name: "Триал", value: 187, conversion: 287.7 },
    ],
  },
  {
    id: "3",
    name: "Ресторанная сеть - Локальный маркетинг",
    description: "Продвижение новых точек ресторанной сети в регионах. Фокус на локальный таргетинг и geo-маркетинг.",
    status: "paused",
    industry: "HoReCa",
    totalBudget: 950000,
    spentBudget: 380000,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    kpiSummary: "Цель: увеличить посещаемость новых точек на 40%. Кампания на паузе из-за пересмотра стратегии.",
    metrics: [
      { id: "m1", name: "Посещения", value: 12400, target: 20000, unit: "visits/mo", parentId: null },
      { id: "m2", name: "Средний чек", value: 1850, target: 2200, unit: "RUB", parentId: "m1" },
      { id: "m3", name: "Повторные визиты", value: 28, target: 40, unit: "%", parentId: "m1" },
    ],
    campaigns: [
      { id: "c1", name: "Яндекс Карты", status: "paused", channel: "Geo", budget: 180000, spent: 95000, startDate: "2026-01-15", endDate: "2026-06-30", impressions: 1200000, clicks: 48000, conversions: 2400, cpa: 40, roi: 420 },
      { id: "c2", name: "Instagram Stories", status: "paused", channel: "Instagram", budget: 250000, spent: 142000, startDate: "2026-01-15", endDate: "2026-06-30", impressions: 3400000, clicks: 102000, conversions: 3060, cpa: 46, roi: 380 },
    ],
    audiences: [
      {
        id: "a1", name: "Молодые профессионалы", size: 32000, percentage: 55, description: "25-35 лет, работают в офисах рядом с ресторанами", color: "#f59e0b",
        avatars: [
          { id: "av1", name: "Анна", age: "29", gender: "Ж", location: "Регионы", income: "70-120K", occupation: "Менеджер", interests: ["Еда", "Instagram", "Здоровый образ жизни"], painPoints: ["Нет времени готовить", "Скучные варианты обеда"], goals: ["Вкусно поесть рядом с офисом"], channels: ["Instagram", "VK", "2ГИС"], buyingBehavior: "Импульсивные покупки, отзывы важны", emoji: "🍽️" },
        ],
      },
    ],
    funnel: [
      { name: "Охват", value: 4600000, conversion: 100 },
      { name: "Клики", value: 150000, conversion: 3.3 },
      { name: "Визиты на сайт", value: 45000, conversion: 30.0 },
      { name: "Бронирования", value: 5460, conversion: 12.1 },
      { name: "Посещения", value: 12400, conversion: 227.1 },
    ],
  },
];