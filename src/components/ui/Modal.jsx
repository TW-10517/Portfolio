import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Elements a user can tab to. Disabled controls and tabindex="-1" are
// excluded because the browser skips them too.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, children, wide, label = "Dialog" }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // Remember where focus came from so it can go back on close — otherwise
    // a keyboard user is dumped at the top of the document.
    restoreRef.current = document.activeElement;

    // Visibility is tested through computed style rather than geometry
    // (getClientRects/offsetParent): geometry needs layout, so under a test
    // renderer every control measures as hidden and the trap silently
    // degrades to "focus the panel" — which looks like it works.
    const isVisible = (el) => {
      if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    };
    const focusables = () => [...(panelRef.current?.querySelectorAll(FOCUSABLE) || [])].filter(isVisible);

    // Focus the panel itself, not the first control: a screen reader then
    // announces the dialog and its name before reading anything inside.
    const timer = setTimeout(() => panelRef.current?.focus(), 0);

    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Without this, Tab walks straight out of the dialog and into the page
      // behind it — in the editor, "Log out" was two tabs away from an open
      // Share dialog.
      const list = focusables();
      const panel = panelRef.current;
      if (!panel) return;
      if (!list.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      const outside = !panel.contains(active);

      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className={`relative bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[85vh] overflow-y-auto focus:outline-none`}
            initial={{ scale: 0.94, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500"
              aria-label="Close"
            >
              &times;
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
