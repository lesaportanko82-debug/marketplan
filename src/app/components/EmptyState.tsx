/**
 * EmptyState - универсальный компонент пустого состояния
 * Используется во всех модулях когда данных нет
 */
import { motion } from "motion/react";
import { Mascot, type MascotEmotion } from "./Mascot";

interface EmptyStateProps {
  title: string;
  description?: string;
  emotion?: MascotEmotion;
  mascotSize?: number;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  emotion = "idle",
  mascotSize,
  action,
  secondaryAction,
  className = "",
  compact = false,
}: EmptyStateProps) {
  const size = mascotSize ?? (compact ? 72 : 96);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`flex flex-col items-center justify-center text-center ${compact ? "py-8 px-4" : "py-14 px-6"} ${className}`}
    >
      <div className="mb-4">
        <Mascot emotion={emotion} size={size} />
      </div>

      <h3 className={`font-semibold text-foreground mb-1.5 ${compact ? "text-[15px]" : "text-[17px]"}`}>
        {title}
      </h3>

      {description && (
        <p className={`text-muted-foreground max-w-[380px] leading-relaxed ${compact ? "text-[12px]" : "text-[13.5px]"}`}>
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-2 mt-5">
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-[13px] font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              {action.icon}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl text-[13px] transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

/** Обёртка для таблиц и списков - показывает EmptyState когда data.length === 0 */
export function WithEmptyState({
  isEmpty,
  children,
  ...emptyProps
}: EmptyStateProps & { isEmpty: boolean; children: React.ReactNode }) {
  if (isEmpty) return <EmptyState {...emptyProps} />;
  return <>{children}</>;
}
