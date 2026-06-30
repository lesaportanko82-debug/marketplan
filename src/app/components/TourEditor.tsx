/**
 * 🎨 TourEditor - визуальный редактор кастомных туров
 * 
 * Позволяет создавать, редактировать и тестировать собственные туры
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, Trash2, GripVertical, Eye, Save, X, Settings,
  ArrowUp, ArrowDown, Copy, Wand2, Sparkles, Target,
  Clock, MapPin, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Tour, TourStep } from "../lib/hotspot-tours";
import { toast } from "sonner";
import { Mascot } from "./Mascot";

interface TourEditorProps {
  tour?: Tour;
  onSave: (tour: Tour) => void;
  onCancel: () => void;
  onPreview: (tour: Tour) => void;
}

const CATEGORIES = [
  { id: "beginner", label: "Для новичков", icon: "🌱" },
  { id: "advanced", label: "Продвинутый", icon: "🚀" },
  { id: "feature", label: "Фича", icon: "✨" },
] as const;

const REQUIRED_ACTIONS = [
  { id: "none", label: "Нет действия" },
  { id: "click", label: "Клик" },
  { id: "input", label: "Ввод текста" },
] as const;

const HOTSPOT_PRESETS = [
  { id: "sidebar-projects", label: "Боковое меню → Проекты", selector: "[data-hotspot='sidebar-projects']" },
  { id: "sidebar-analytics", label: "Боковое меню → Аналитика", selector: "[data-hotspot='sidebar-analytics']" },
  { id: "sidebar-content-studio", label: "Боковое меню → Content Studio", selector: "[data-hotspot='sidebar-content-studio']" },
  { id: "dashboard-customize", label: "Дашборд → Настройка", selector: "[data-hotspot='dashboard-customize']" },
  { id: "export-pdf", label: "Экспорт PDF", selector: "[data-hotspot='export-pdf']" },
  { id: "generate-content", label: "Генерация контента", selector: "[data-hotspot='generate-content']" },
  { id: "brand-voice", label: "Голос бренда", selector: "[data-hotspot='brand-voice']" },
  { id: "mascot-mark", label: "Маскот Марк", selector: "[data-hotspot='mascot-mark']" },
];

export function TourEditor({ tour, onSave, onCancel, onPreview }: TourEditorProps) {
  const [name, setName] = useState(tour?.name || "");
  const [description, setDescription] = useState(tour?.description || "");
  const [category, setCategory] = useState<Tour["category"]>(tour?.category || "feature");
  const [icon, setIcon] = useState(tour?.icon || "🎯");
  const [estimatedTime, setEstimatedTime] = useState(tour?.estimatedTime || 5);
  const [steps, setSteps] = useState<TourStep[]>(tour?.steps || []);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [showPresetPicker, setShowPresetPicker] = useState<number | null>(null);

  const addStep = useCallback(() => {
    const newStep: TourStep = {
      id: `step-${Date.now()}`,
      selector: "",
      label: "Новый шаг",
      description: "",
      requiredAction: "none",
      delay: 300,
    };
    setSteps([...steps, newStep]);
    setEditingStep(steps.length);
  }, [steps]);

  const duplicateStep = useCallback((index: number) => {
    const step = steps[index];
    const duplicate: TourStep = {
      ...step,
      id: `step-${Date.now()}`,
      label: `${step.label} (копия)`,
    };
    const newSteps = [...steps];
    newSteps.splice(index + 1, 0, duplicate);
    setSteps(newSteps);
    toast.success("Шаг продублирован");
  }, [steps]);

  const removeStep = useCallback((index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
    if (editingStep === index) setEditingStep(null);
    toast.success("Шаг удалён");
  }, [steps, editingStep]);

  const moveStep = useCallback((index: number, direction: "up" | "down") => {
    const newSteps = [...steps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps);
    if (editingStep === index) setEditingStep(targetIndex);
    else if (editingStep === targetIndex) setEditingStep(index);
  }, [steps, editingStep]);

  const updateStep = useCallback((index: number, updates: Partial<TourStep>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  }, [steps]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      toast.error("Введите название тура");
      return;
    }
    if (steps.length === 0) {
      toast.error("Добавьте хотя бы один шаг");
      return;
    }

    const invalidSteps = steps.filter(s => !s.selector.trim() || !s.label.trim());
    if (invalidSteps.length > 0) {
      toast.error("Заполните все обязательные поля шагов");
      return;
    }

    const newTour: Tour = {
      id: tour?.id || `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      category,
      icon,
      estimatedTime,
      steps,
    };

    onSave(newTour);
    toast.success("Тур сохранён! 🎉");
  }, [name, description, category, icon, estimatedTime, steps, tour, onSave]);

  const handlePreview = useCallback(() => {
    if (steps.length === 0) {
      toast.error("Добавьте хотя бы один шаг для предпросмотра");
      return;
    }

    const previewTour: Tour = {
      id: `preview-${Date.now()}`,
      name: name || "Предпросмотр",
      description: description || "Предпросмотр тура",
      category,
      icon,
      estimatedTime,
      steps,
    };

    onPreview(previewTour);
  }, [name, description, category, icon, estimatedTime, steps, onPreview]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#d4a373] to-[#c08a40] flex items-center justify-center">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-foreground">
                {tour ? "Редактор тура" : "Создание тура"}
              </h2>
              <p className="text-[13px] text-muted-foreground">
                Создайте интерактивный тур по интерфейсу
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-2 text-[13px]"
            >
              <Eye className="w-4 h-4" />
              Предпросмотр
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 text-[13px] font-medium"
            >
              <Save className="w-4 h-4" />
              Сохранить
            </button>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left panel: Tour settings */}
          <div className="w-80 border-r border-border p-4 md:p-6 overflow-y-auto">
            <h3 className="text-[14px] font-bold text-foreground mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Настройки тура
            </h3>

            <div className="space-y-4">
              {/* Icon */}
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-2">
                  Иконка (emoji)
                </label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="🎯"
                  maxLength={2}
                  className="w-full px-3 py-2 text-[24px] text-center bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-2">
                  Название тура *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Знакомство с Analytics"
                  className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[13px]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-2">
                  Описание
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Краткое описание тура"
                  rows={3}
                  className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[13px] resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-2">
                  Категория
                </label>
                <div className="space-y-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`w-full px-3 py-2 rounded-lg border transition-all flex items-center gap-2 text-[13px] ${
                        category === cat.id
                          ? "bg-primary/10 border-primary text-primary font-medium"
                          : "bg-muted/30 border-border hover:border-primary/30"
                      }`}
                    >
                      <span>{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estimated time */}
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground mb-2">
                  Время прохождения (мин)
                </label>
                <input
                  type="number"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 1)}
                  min={1}
                  max={30}
                  className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[13px]"
                />
              </div>

              {/* Stats */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between text-[12px] mb-2">
                  <span className="text-muted-foreground">Шагов в туре:</span>
                  <span className="font-bold text-foreground">{steps.length}</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">Статус:</span>
                  <span className={`font-medium ${steps.length > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    {steps.length > 0 ? "Готов" : "Нет шагов"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel: Steps editor */}
          <div className="flex-1 flex flex-col">
            {/* Steps header */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                Шаги тура ({steps.length})
              </h3>
              <button
                onClick={addStep}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 text-[13px] font-medium"
              >
                <Plus className="w-4 h-4" />
                Добавить шаг
              </button>
            </div>

            {/* Steps list */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {steps.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Mascot emotion="think" size={80} />
                  <p className="text-[14px] text-muted-foreground mt-4 mb-2">
                    Тур пока пустой
                  </p>
                  <p className="text-[12px] text-muted-foreground mb-4 max-w-sm">
                    Добавьте шаги, чтобы создать интерактивный тур по интерфейсу.
                    Каждый шаг подсветит элемент и покажет подсказку.
                  </p>
                  <button
                    onClick={addStep}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 text-[13px] font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить первый шаг
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <motion.div
                      key={step.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-muted/30 border rounded-xl overflow-hidden transition-all ${
                        editingStep === index
                          ? "border-primary shadow-lg"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {/* Step header */}
                      <div
                        className="p-4 flex items-center gap-3 cursor-pointer"
                        onClick={() => setEditingStep(editingStep === index ? null : index)}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-[13px] font-medium text-foreground">
                              {step.label || <span className="text-muted-foreground italic">Без названия</span>}
                            </div>
                            {step.selector && (
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {step.selector}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Step actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveStep(index, "up");
                            }}
                            disabled={index === 0}
                            className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Вверх"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveStep(index, "down");
                            }}
                            disabled={index === steps.length - 1}
                            className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Вниз"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateStep(index);
                            }}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            title="Дублировать"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeStep(index);
                            }}
                            className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Step edit form */}
                      <AnimatePresence>
                        {editingStep === index && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border bg-card/50"
                          >
                            <div className="p-4 space-y-3">
                              {/* Label */}
                              <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                                  Название шага *
                                </label>
                                <input
                                  type="text"
                                  value={step.label}
                                  onChange={(e) => updateStep(index, { label: e.target.value })}
                                  placeholder="Например: Фильтры данных"
                                  className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[13px]"
                                />
                              </div>

                              {/* Selector */}
                              <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
                                  <span>CSS-селектор *</span>
                                  <button
                                    onClick={() => setShowPresetPicker(showPresetPicker === index ? null : index)}
                                    className="text-primary hover:underline text-[11px]"
                                  >
                                    {showPresetPicker === index ? "Скрыть пресеты" : "Выбрать из пресетов"}
                                  </button>
                                </label>
                                
                                {showPresetPicker === index && (
                                  <div className="mb-2 p-2 bg-muted/50 rounded-lg space-y-1 max-h-32 overflow-y-auto">
                                    {HOTSPOT_PRESETS.map((preset) => (
                                      <button
                                        key={preset.id}
                                        onClick={() => {
                                          updateStep(index, { selector: preset.selector });
                                          setShowPresetPicker(null);
                                        }}
                                        className="w-full px-2 py-1.5 rounded text-left hover:bg-primary/10 transition-colors text-[11px]"
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                
                                <input
                                  type="text"
                                  value={step.selector}
                                  onChange={(e) => updateStep(index, { selector: e.target.value })}
                                  placeholder='[data-hotspot="example"]'
                                  className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[12px] font-mono"
                                />
                              </div>

                              {/* Description */}
                              <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                                  Описание
                                </label>
                                <textarea
                                  value={step.description || ""}
                                  onChange={(e) => updateStep(index, { description: e.target.value })}
                                  placeholder="Краткое описание шага"
                                  rows={2}
                                  className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[13px] resize-none"
                                />
                              </div>

                              {/* Required action */}
                              <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                                  Требуемое действие
                                </label>
                                <select
                                  value={step.requiredAction || "none"}
                                  onChange={(e) => updateStep(index, { requiredAction: e.target.value as any })}
                                  className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[13px]"
                                >
                                  {REQUIRED_ACTIONS.map((action) => (
                                    <option key={action.id} value={action.id}>
                                      {action.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Delay */}
                              <div>
                                <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                                  Задержка (мс)
                                </label>
                                <input
                                  type="number"
                                  value={step.delay || 300}
                                  onChange={(e) => updateStep(index, { delay: parseInt(e.target.value) || 0 })}
                                  min={0}
                                  max={5000}
                                  step={100}
                                  className="w-full px-3 py-2 bg-input rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary text-[13px]"
                                />
                              </div>

                              {/* Validation */}
                              <div className="pt-2 border-t border-border">
                                {!step.selector.trim() ? (
                                  <div className="flex items-center gap-2 text-[11px] text-destructive">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Укажите CSS-селектор
                                  </div>
                                ) : !step.label.trim() ? (
                                  <div className="flex items-center gap-2 text-[11px] text-destructive">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Укажите название шага
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-[11px] text-emerald-600">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Шаг готов
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
