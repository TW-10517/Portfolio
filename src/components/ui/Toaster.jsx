import { useNotices } from "../../store/useNotices.js";

const TONES = {
  error: "border-red-500/40 bg-red-950/90 text-red-100",
  info: "border-cyan-500/40 bg-slate-900/95 text-slate-100",
};

export function Toaster() {
  const notices = useNotices((s) => s.notices);
  const dismiss = useNotices((s) => s.dismiss);

  if (!notices.length) return null;

  return (
    // aria-live on the container, not on each notice: a live region has to
    // exist before the text appears in it, or a screen reader has nothing
    // subscribed at the moment the change happens and announces nothing.
    // assertive because these all report that something the user just tried
    // did not work.
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm"
      role="alert"
      aria-live="assertive"
    >
      {notices.map((n) => (
        <div
          key={n.id}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
            TONES[n.tone] || TONES.error
          }`}
        >
          <span className="flex-1">{n.message}</span>
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            aria-label="Dismiss"
            className="shrink-0 text-lg leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
