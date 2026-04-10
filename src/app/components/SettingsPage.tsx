import { useState, useEffect } from "react";
import {
  Settings, User, Bell, Save, Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { getData, saveData } from "../lib/api";
import { MascotBadge } from "./Mascot";
import { resetAllTips } from "./MascotTips";
import { resetOnboarding } from "./OnboardingTour";
import { isSoundEnabled, setSoundEnabled } from "../lib/mascot-sounds";
import { resetMilestones } from "../lib/mascot-reactions";
import { resetMood, getMoodLabel } from "../lib/mascot-mood";
import { currentSeasonLabel } from "./Mascot";

interface UserSettings {
  name: string;
  email: string;
  company: string;
  role: string;
  notifications: {
    email: boolean;
    push: boolean;
    weekly: boolean;
    budgetAlert: boolean;
  };
}

const defaultSettings: UserSettings = {
  name: "Маркетолог",
  email: "marketer@company.com",
  company: "MarketPlan Inc.",
  role: "Head of Marketing",
  notifications: {
    email: true,
    push: true,
    weekly: false,
    budgetAlert: true,
  },
};

export function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Mascot sound
  const [soundOn, setSoundOn] = useState(isSoundEnabled);

  // Load settings
  useEffect(() => {
    getData<UserSettings>("user_settings").then((saved) => {
      if (saved) setSettings(saved);
      setIsLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const ok = await saveData("user_settings", settings);
    setIsSaving(false);
    if (ok) {
      setLastSaved(new Date().toLocaleTimeString("ru-RU"));
      toast.success("Настройки сохранены", {
        description: "Данные синхронизированы с облаком",
      });
    } else {
      toast.error("Ошибка сохранения настроек");
    }
  };

  const updateNotification = (key: keyof UserSettings["notifications"]) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="p-5 flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 max-w-[800px] mx-auto space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-foreground flex items-center gap-3">
            <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
            Настройки
          </h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            Управление аккаунтом, интеграциями и предпочтениями
          </p>
        </div>
        {lastSaved && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Сохранено в {lastSaved}
          </span>
        )}
      </div>

      {/* Profile */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
        <h3 className="text-foreground mb-4 flex items-center gap-2">
          <User className="w-4 h-4" />
          Профиль
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5">
              Имя
            </label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, email: e.target.value }))
              }
              className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5">
              Компания
            </label>
            <input
              type="text"
              value={settings.company}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, company: e.target.value }))
              }
              className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="text-[12px] text-muted-foreground block mb-1.5">
              Роль
            </label>
            <input
              type="text"
              value={settings.role}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, role: e.target.value }))
              }
              className="w-full bg-muted border-0 rounded-md px-3 py-2 text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
        <h3 className="text-foreground mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Уведомления
        </h3>
        <div className="space-y-4">
          {[
            {
              key: "email" as const,
              label: "Email-уведомления",
              desc: "Получать отчёты и обновления на email",
            },
            {
              key: "push" as const,
              label: "Push-уведомления",
              desc: "Мгновенные уведомления в браузере",
            },
            {
              key: "weekly" as const,
              label: "Еженедельный дайджест",
              desc: "Сводка по всем проектам раз в неделю",
            },
            {
              key: "budgetAlert" as const,
              label: "Алерты по бюджету",
              desc: "Уведомление при расходе 80%+ бюджета",
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-foreground text-[13px]">{item.label}</p>
                <p className="text-muted-foreground text-[11px]">{item.desc}</p>
              </div>
              <button
                onClick={() => updateNotification(item.key)}
                className={`w-10 h-5.5 rounded-full transition-colors relative ${
                  settings.notifications[item.key] ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform shadow-sm ${
                    settings.notifications[item.key]
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Mascot Settings */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <MascotBadge size={48} showName={false} />
            <div>
              <p className="text-[13px] sm:text-[14px] font-semibold text-foreground">Марк 🦊</p>
              <p className="text-[11px] text-muted-foreground">Настройки маскота</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-[13px]">🔊 Звуковые эффекты</p>
              <p className="text-muted-foreground text-[11px]">Тихие мелодии при подсказках и действиях</p>
            </div>
            <button
              onClick={() => { const next = !soundOn; setSoundOn(next); setSoundEnabled(next); toast.success(next ? "Звуки включены" : "Звуки выключены"); }}
              className={`w-10 h-5.5 rounded-full transition-colors relative ${soundOn ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform shadow-sm ${soundOn ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-[13px]">👔 Сезонный костюм</p>
              <p className="text-muted-foreground text-[11px]">Меняется автоматически по календарю</p>
            </div>
            <span className="text-[11px] text-[#d4a373] font-medium bg-[#d4a373]/10 px-2.5 py-1 rounded-full">
              {currentSeasonLabel()}
            </span>
          </div>
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-foreground text-[13px]">🦊 Настроение дня</p>
              <p className="text-muted-foreground text-[11px]">Марк запоминает тональность разговоров</p>
            </div>
            <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium bg-teal-600/10 px-2.5 py-1 rounded-full capitalize">
              {getMoodLabel()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border text-center sm:text-left">
          <button
            onClick={() => { resetOnboarding(); resetAllTips(); window.location.reload(); }}
            className="text-[11px] text-[#d4a373] hover:underline"
          >
            🔄 Пройти онбординг-тур снова
          </button>
          <span className="text-[10px] text-muted-foreground">•</span>
          <button
            onClick={() => { resetAllTips(); toast.success("Подсказки Марка сброшены!"); }}
            className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline"
          >
            💬 Сбросить подсказки
          </button>
          <span className="text-[10px] text-muted-foreground">•</span>
          <button
            onClick={() => { resetMilestones(); toast.success("Достижения сброшены!"); }}
            className="text-[11px] text-[#c08a40] hover:underline"
          >
            🏆 Сбросить достижения
          </button>
          <span className="text-[10px] text-muted-foreground">•</span>
          <button
            onClick={() => { resetMood(); toast.success("Настроение Марка сброшено!"); }}
            className="text-[11px] text-[#2eb8a4] hover:underline"
          >
            🦊 Сбросить настроение
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {isSaving ? "Сохранение..." : "Сохранить изменения"}
      </button>
    </div>
  );
}