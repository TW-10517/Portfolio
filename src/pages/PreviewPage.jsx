import { useState } from "react";
import { Link } from "react-router-dom";
import { usePortfolioStore } from "../store/usePortfolioStore.js";
import { PortfolioView } from "../components/portfolio/PortfolioView.jsx";

export function PreviewPage() {
  const data = usePortfolioStore((s) => s.data);
  const [bannerVisible, setBannerVisible] = useState(true);

  return (
    <div className="min-h-screen">
      {bannerVisible && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-3 bg-amber-400 text-slate-950 text-xs sm:text-sm font-medium px-4 py-2">
          <span>👁️ Visitor Preview — this shows your unpublished draft exactly as visitors would see it.</span>
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/editor" className="underline">Back to Editor</Link>
            <button onClick={() => setBannerVisible(false)} className="text-slate-950/70 hover:text-slate-950">✕</button>
          </div>
        </div>
      )}
      <div style={{ paddingTop: bannerVisible ? 36 : 0 }}>
        <PortfolioView data={data} />
      </div>
    </div>
  );
}
