/**
 * 🎓 TourManager — управление интерактивными турами
 * 
 * Компонент для запуска и отслеживания пошаговых туров по интерфейсу
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, GripVertical, Eye, Save, X, Settings,
  ArrowUp, ArrowDown, Copy, Wand2, Sparkles, Target,
  Clock, MapPin, CheckCircle2, AlertCircle, Edit, Play, ChevronRight, ChevronLeft, Check, SkipForward,
  BookOpen, Award,
} from "lucide-react";
import { 
  Tour, 
  TourStep, 
  TourProgress,
  getAllTours,
  startTour,
  nextStep,
  resetTour,
  getTourProgress,
  getCurrentStep,
  isTourCompleted,
  saveCustomTour,
  deleteCustomTour,
  isCustomTour,
} from "../lib/hotspot-tours";
import { SpotlightOverlay, SpotlightTarget } from "./SpotlightOverlay";
import { toast } from "sonner";
import { Mascot } from "./Mascot";
import { TourEditor } from "./TourEditor";

interface TourManagerProps {
  onClose?: () => void;
}

export function TourManager({ onClose }: TourManagerProps) {
  const [showLibrary, setShowLibrary] = useState(true);
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [currentTarget, setCurrentTarget] = useState<SpotlightTarget | null>(null);
  const [progress, setProgress] = useState<Record<string, TourProgress>>({});

  useEffect(() => {
    setProgress(getTourProgress());
  }, []);

  const handleStartTour = useCallback((tour: Tour) => {
    const prog = startTour(tour.id);
    setProgress((prev) => ({ ...prev, [tour.id]: prog }));
    setActiveTour(tour);
    setShowLibrary(false);
    
    // Show first step
    const firstStep = tour.steps[0];
    if (firstStep) {
      setTimeout(() => {
        setCurrentTarget(firstStep);
      }, firstStep.delay || 300);
    }

    toast.success(`Тур "${tour.name}" начат! 🎓`);
  }, []);

  const handleNextStep = useCallback(() => {
    if (!activeTour) return;

    const currentStep = getCurrentStep(activeTour.id);
    if (currentStep?.onComplete) {
      currentStep.onComplete();
    }

    const newProgress = nextStep(activeTour.id);
    if (!newProgress) return;

    setProgress((prev) => ({ ...prev, [activeTour.id]: newProgress }));

    if (newProgress.completed) {
      // Tour completed!
      setCurrentTarget(null);
      toast.success(`Тур "${activeTour.name}" завершён! 🎉`, {
        description: "Вы получили +50 баллов опыта",
        icon: <Award className="w-4 h-4 text-amber-500" />,
      });
      setShowLibrary(true);
      setActiveTour(null);
      return;
    }

    // Show next step
    const nextStepData = getCurrentStep(activeTour.id);
    if (nextStepData) {
      setCurrentTarget(null);
      setTimeout(() => {
        setCurrentTarget(nextStepData);
      }, nextStepData.delay || 300);
    }
  }, [activeTour]);

  const handlePrevStep = useCallback(() => {
    if (!activeTour) return;

    const prog = progress[activeTour.id];
    if (!prog || prog.currentStep === 0) return;

    const newProgress = { ...prog, currentStep: prog.currentStep - 1 };
    setProgress((prev) => ({ ...prev, [activeTour.id]: newProgress }));

    const prevStepData = activeTour.steps[newProgress.currentStep];
    if (prevStepData) {
      setCurrentTarget(null);
      setTimeout(() => {
        setCurrentTarget(prevStepData);
      }, 200);
    }
  }, [activeTour, progress]);

  const handleSkipTour = useCallback(() => {
    if (!activeTour) return;
    
    setCurrentTarget(null);
    setActiveTour(null);
    setShowLibrary(true);
    toast.info("Тур прерван");
  }, [activeTour]);

  const handleCloseSpotlight = useCallback(() => {
    // Auto-advance to next step when spotlight is dismissed
    if (activeTour) {
      handleNextStep();
    }
  }, [activeTour, handleNextStep]);

  if (!showLibrary && !activeTour) return null;

  return (
    <>
      {/* Spotlight overlay for active step */}
      <SpotlightOverlay 
        target={currentTarget} 
        onClose={handleCloseSpotlight} 
      />

      {/* Tour control panel (shown during active tour) */}
      {activeTour && !showLibrary && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10003] flex flex-col items-center gap-3"
        >
          {/* Progress bar */}
          <div className="bg-card/95 backdrop-blur-md border border-border rounded-full px-4 py-2 shadow-lg flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">
              {progress[activeTour.id]?.currentStep + 1} / {activeTour.steps.length}
            </span>
            <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-[#d4a373]"
                initial={{ width: 0 }}
                animate={{
                  width: `${((progress[activeTour.id]?.currentStep + 1) / activeTour.steps.length) * 100}%`,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="bg-card/95 backdrop-blur-md border border-border rounded-2xl px-5 py-3 shadow-xl flex items-center gap-3">
            <button
              onClick={handlePrevStep}
              disabled={!progress[activeTour.id] || progress[activeTour.id].currentStep === 0}
              className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Назад"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center">
              <span className="text-[13px] font-bold text-foreground">
                {activeTour.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {getCurrentStep(activeTour.id)?.label}
              </span>
            </div>

            <button
              onClick={handleNextStep}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 text-[13px] font-medium"
            >
              Далее
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleSkipTour}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              title="Пропустить тур"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Tour library modal */}
      <AnimatePresence>
        {showLibrary && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
              onClick={() => {
                setShowLibrary(false);
                onClose?.();
              }}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-[#d4a373] flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-[20px] font-bold text-foreground">Интерактивные туры</h2>
                      <p className="text-[13px] text-muted-foreground">
                        Изучите MarketPlan с пошаговыми подсказками
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowLibrary(false);
                      onClose?.();
                    }}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Tours grid */}
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getAllTours().map((tour) => {
                      const completed = isTourCompleted(tour.id);
                      const prog = progress[tour.id];
                      const inProgress = prog && !completed;

                      return (
                        <motion.div
                          key={tour.id}
                          whileHover={{ scale: 1.02, y: -2 }}
                          className="bg-muted/30 border border-border rounded-2xl p-5 flex flex-col gap-3 cursor-pointer transition-all hover:border-primary/30 hover:shadow-lg"
                          onClick={() => {
                            if (completed) {
                              resetTour(tour.id);
                              setProgress(getTourProgress());
                            }
                            handleStartTour(tour);
                          }}
                        >
                          {/* Icon & status */}
                          <div className="flex items-start justify-between">
                            <div className="text-[32px] leading-none">{tour.icon}</div>
                            {completed && (
                              <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-[10px] font-bold text-emerald-600">
                                  Пройден
                                </span>
                              </div>
                            )}
                            {inProgress && (
                              <div className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-600" />
                                <span className="text-[10px] font-bold text-amber-600">
                                  {prog.currentStep + 1}/{tour.steps.length}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div>
                            <h3 className="text-[15px] font-bold text-foreground mb-1">
                              {tour.name}
                            </h3>
                            <p className="text-[12px] text-muted-foreground leading-relaxed">
                              {tour.description}
                            </p>
                          </div>

                          {/* Meta */}
                          <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-auto">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {tour.estimatedTime} мин
                            </div>
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {tour.steps.length} шагов
                            </div>
                          </div>

                          {/* Action button */}
                          <button
                            className="mt-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-[13px] font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (completed) {
                                resetTour(tour.id);
                                setProgress(getTourProgress());
                              }
                              handleStartTour(tour);
                            }}
                          >
                            {completed ? (
                              <>
                                <Play className="w-4 h-4" />
                                Пройти снова
                              </>
                            ) : inProgress ? (
                              <>
                                <ChevronRight className="w-4 h-4" />
                                Продолжить
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4" />
                                Начать тур
                              </>
                            )}
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Mascot helper */}
                  <div className="mt-8 flex items-center gap-4 bg-primary/5 border border-primary/10 rounded-2xl p-4">
                    <Mascot emotion="think" size={60} animate={false} />
                    <div className="flex-1">
                      <p className="text-[13px] text-foreground font-medium mb-1">
                        Совет от Марка 🦊
                      </p>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">
                        Начните с тура "Знакомство с MarketPlan" — это займёт всего 5 минут 
                        и вы узнаете все основные функции платформы!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}