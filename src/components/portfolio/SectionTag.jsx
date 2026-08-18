import { usePortfolioTheme } from "./ThemeContext.jsx";

export function SectionTag({ children }) {
  const { primary, secondary } = usePortfolioTheme();
  return (
    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: primary }}>
      <span className="w-5 h-0.5 rounded-full" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }} />
      {children}
    </p>
  );
}
