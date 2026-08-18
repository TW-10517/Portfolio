export function Button({ variant = "primary", size = "md", className = "", ...props }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none";
  const sizes = { sm: "px-3.5 py-1.5 text-xs", md: "px-5 py-2.5 text-sm", lg: "px-7 py-3.5 text-base" };
  const variants = {
    primary: "bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 hover:shadow-lg hover:shadow-cyan-500/25 hover:-translate-y-0.5",
    ghost: "border border-slate-700 text-slate-200 hover:border-cyan-400 hover:-translate-y-0.5",
    subtle: "bg-slate-800 text-slate-200 hover:bg-slate-700",
    danger: "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}
