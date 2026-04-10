import type { ReactNode } from "react";
import { useModal } from "../hooks/useModal";

/**
 * ModalOverlay — a11y-ready modal backdrop with:
 *  - role="dialog", aria-modal, aria-label
 *  - Escape key closes via useModal
 *  - Focus trap via useModal
 *  - Click-on-backdrop closes (optional)
 */
interface ModalOverlayProps {
  onClose: () => void;
  label: string;
  children: ReactNode;
  /** Extra classes on the outer overlay div */
  className?: string;
  /** If true, clicking the backdrop does NOT close (default: true — clicking closes) */
  backdropClose?: boolean;
}

export function ModalOverlay({
  onClose,
  label,
  children,
  className = "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4",
  backdropClose = true,
}: ModalOverlayProps) {
  const ref = useModal(onClose);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={className}
      onClick={backdropClose ? onClose : undefined}
    >
      {/* Stop propagation on inner content so backdrop click works */}
      <div onClick={(e) => e.stopPropagation()} className="contents">
        {children}
      </div>
    </div>
  );
}
