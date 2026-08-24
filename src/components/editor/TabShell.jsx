export function TabShell({ title, description, children }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white font-head">{title}</h2>
      {description && <p className="text-sm text-slate-400 mt-1 mb-6">{description}</p>}
      {!description && <div className="mb-6" />}
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function SubHeading({ children }) {
  return <h3 className="text-sm font-semibold text-slate-200 mt-2 mb-3 uppercase tracking-wide text-[11px] text-slate-400">{children}</h3>;
}
