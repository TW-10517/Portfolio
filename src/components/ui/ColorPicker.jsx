export function ColorPicker({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-slate-700 shrink-0">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute -top-1 -left-1 w-12 h-12 cursor-pointer"
        />
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-400"
      />
      {label && <span className="text-xs text-slate-400 shrink-0">{label}</span>}
    </div>
  );
}
