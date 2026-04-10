import { useEffect, useRef, useCallback } from "react";

/**
 * useModal — a11y hook for modal dialogs.
 *
 * Provides:
 * - Escape key closes the modal
 * - Focus trap (Tab / Shift+Tab cycle inside the modal)
 * - Auto-focus first focusable element on mount
 * - Returns a ref to attach to the modal container element
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModal(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Store onClose in a ref so the effect doesn't re-subscribe on every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCloseRef.current();
      return;
    }

    if (e.key !== "Tab") return;

    const container = ref.current;
    if (!container) return;

    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE)
    ).filter((el) => el.offsetParent !== null); // visible only

    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  useEffect(() => {
    // Save previously focused element to restore later
    previousFocus.current = document.activeElement as HTMLElement;

    // Auto-focus first focusable element inside the modal
    const container = ref.current;
    if (container) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      if (first) {
        // Small delay to let the modal render/animate in
        requestAnimationFrame(() => first.focus());
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      // Restore focus
      previousFocus.current?.focus();
    };
  }, [handleKeyDown]);

  return ref;
}
