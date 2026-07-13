"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, type PropsWithChildren, type ReactNode } from "react";

type ChromeModalProps = PropsWithChildren<{
  open?: boolean;
  titleId: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}>;

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function ChromeModal({
  open = true,
  titleId,
  onClose,
  className,
  children,
}: ChromeModalProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      openerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const dialog = dialogRef.current;
      if (dialog !== null) {
        const first = focusableElements(dialog)[0];
        (first ?? dialog).focus();
      }
    } else if (!open && wasOpenRef.current) {
      openerRef.current?.focus();
      openerRef.current = null;
    }
    wasOpenRef.current = open;
  }, [open]);

  function trapFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (dialog === null) return;
    const focusable = focusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-scrim chrome-modal-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          {...(reducedMotion
            ? { initial: false as const }
            : {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 },
              })}
        >
          <motion.div
            ref={dialogRef}
            className={`chrome-modal-card glass-panel${className ? ` ${className}` : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={trapFocus}
            onMouseDown={(event) => event.stopPropagation()}
            {...(reducedMotion
              ? { initial: false as const }
              : {
                  initial: { y: 18, scale: 0.98 },
                  animate: { y: 0, scale: 1 },
                  exit: { y: 12, scale: 0.98, opacity: 0 },
                })}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
