/**
 * Undo Toast Utility
 *
 * Wraps destructive actions with an undo-capable sonner toast.
 * The actual deletion is delayed; if the user clicks "Отменить",
 * the action is cancelled and the original state restored.
 *
 * Usage:
 *   import { undoableAction } from "../lib/undo";
 *
 *   undoableAction({
 *     label: "Проект удалён",
 *     onExecute: async () => { await deleteData("project:123"); },
 *     onUndo: async () => { await saveData("project:123", prevData); },
 *   });
 */

import { toast } from "sonner";

export interface UndoableActionOptions {
  /** Toast message shown to the user */
  label: string;
  /** Optional description under the label */
  description?: string;
  /** Called after the undo timeout expires - executes the real action */
  onExecute: () => void | Promise<void>;
  /** Called if the user clicks Undo - restores previous state */
  onUndo: () => void | Promise<void>;
  /** Delay in ms before executing the action (default: 5000) */
  delayMs?: number;
}

export function undoableAction({
  label,
  description,
  onExecute,
  onUndo,
  delayMs = 5000,
}: UndoableActionOptions) {
  let cancelled = false;
  let executed = false;

  const toastId = toast(label, {
    description,
    duration: delayMs + 500,
    action: {
      label: "Отменить",
      onClick: () => {
        cancelled = true;
        if (executed) {
          // Already executed - need to call onUndo
          Promise.resolve(onUndo()).then(() => {
            toast.success("Действие отменено", { duration: 2000 });
          }).catch((err) => {
            console.error("Undo failed:", err);
            toast.error("Не удалось отменить", { description: String(err) });
          });
        } else {
          toast.success("Действие отменено", { duration: 2000 });
        }
      },
    },
    style: {
      background: "var(--card)",
      border: "1px solid var(--border)",
      color: "var(--foreground)",
    },
  });

  // Execute the real action after delay
  setTimeout(async () => {
    if (cancelled) return;
    try {
      await onExecute();
      executed = true;
    } catch (err) {
      console.error("Undoable action execution failed:", err);
      toast.error("Ошибка при выполнении действия", { description: String(err) });
    }
  }, delayMs);

  return {
    cancel: () => {
      cancelled = true;
      toast.dismiss(toastId);
    },
  };
}

/**
 * Quick helper for the common case of deleting something
 * where we already have the old data and save/delete functions.
 */
export function undoableDelete({
  label,
  itemKey,
  previousData,
  deleteFn,
  restoreFn,
  onOptimistic,
  onRevert,
}: {
  label: string;
  itemKey: string;
  previousData: any;
  deleteFn: (key: string) => Promise<any>;
  restoreFn: (key: string, data: any) => Promise<any>;
  /** Immediately update local state (optimistic) */
  onOptimistic?: () => void;
  /** Revert local state on undo */
  onRevert?: () => void;
}) {
  // Optimistically update UI immediately
  onOptimistic?.();

  return undoableAction({
    label,
    description: "Нажмите «Отменить» в течение 5 секунд",
    onExecute: async () => {
      await deleteFn(itemKey);
    },
    onUndo: async () => {
      await restoreFn(itemKey, previousData);
      onRevert?.();
    },
  });
}