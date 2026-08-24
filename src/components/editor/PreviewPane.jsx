import { useState } from "react";
import { Link } from "react-router-dom";
import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { PortfolioView } from "../portfolio/PortfolioView.jsx";
import { Button } from "../ui/Button.jsx";

const DEVICES = {
  desktop: { width: "100%", label: "Desktop", icon: "🖥️" },
  tablet: { width: 768, label: "Tablet", icon: "📱" },
  mobile: { width: 390, label: "Mobile", icon: "📲" },
};

export function PreviewPane() {
  const data = usePortfolioStore((s) => s.data);
  const [device, setDevice] = useState("desktop");
  const [scrollEl, setScrollEl] = useState(null);

  return (
    <div className="h-full flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1">
          {Object.entries(DEVICES).map(([key, d]) => (
            <button
              key={key}
              onClick={() => setDevice(key)}
              title={d.label}
              className={`px-2.5 py-1.5 rounded-md text-sm transition ${device === key ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-300"}`}
            >
              {d.icon}
            </button>
          ))}
        </div>
        <Link to="/preview" target="_blank">
          <Button variant="ghost" size="sm">
            Preview as Visitor ↗
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-auto bg-slate-900 flex justify-center py-6 px-4">
        <div
          ref={setScrollEl}
          className="bg-black rounded-xl overflow-y-auto shadow-2xl transition-all duration-300 no-scrollbar"
          style={{
            width: DEVICES[device].width,
            maxWidth: "100%",
            height: device === "desktop" ? "100%" : "82vh",
          }}
        >
          <PortfolioView data={data} scrollRootEl={scrollEl} landmark={false} />
        </div>
      </div>
    </div>
  );
}
