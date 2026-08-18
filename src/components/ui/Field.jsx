export function Field({ label, hint, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-slate-400 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition " +
        (props.className || "")
      }
    />
  );
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      className={
        "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition min-h-[90px] " +
        (props.className || "")
      }
    />
  );
}

export function Select(props) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 " +
        (props.className || "")
      }
    >
      {props.children}
    </select>
  );
}
