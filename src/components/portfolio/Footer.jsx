import { useEffect, useState } from "react";
import { usePortfolioTheme } from "./ThemeContext.jsx";

export function Footer({ scrollRootEl, showBrand = true }) {
  const { data, palette, primary, secondary } = usePortfolioTheme();
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const target = scrollRootEl || window;
    const handler = () => setShowTop((scrollRootEl ? scrollRootEl.scrollTop : window.scrollY) > 500);
    handler();
    target.addEventListener("scroll", handler, { passive: true });
    return () => target.removeEventListener("scroll", handler);
  }, [scrollRootEl]);

  const scrollTop = () => {
    if (scrollRootEl) scrollRootEl.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="border-t px-6 py-10" style={{ borderColor: palette.border }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs" style={{ color: palette.textFaint }}>
        <div className="flex gap-4">
          {Object.entries(data.profile.social || {}).filter(([, v]) => v).slice(0, 5).map(([key, url]) => (
            <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: palette.textDim }}>
              {key}
            </a>
          ))}
        </div>
        <span>
          © {new Date().getFullYear()} {data.profile.name}
          {showBrand && (
            <>
              {" · "}
              <span style={{ backgroundImage: `linear-gradient(90deg, ${primary}, ${secondary})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                Built with Portfolio Builder
              </span>
            </>
          )}
        </span>
      </div>

      {showTop && (
        <button
          onClick={scrollTop}
          className="fixed bottom-7 right-7 w-12 h-12 rounded-full flex items-center justify-center text-slate-950 shadow-lg z-30"
          style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
          aria-label="Back to top"
        >
          ↑
        </button>
      )}
    </footer>
  );
}
