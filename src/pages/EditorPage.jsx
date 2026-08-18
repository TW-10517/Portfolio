import { useCallback, useEffect, useRef, useState } from "react";
import { usePortfolioStore } from "../store/usePortfolioStore.js";
import { downloadJson, readJsonFile } from "../utils/exportImport.js";
import { Button } from "../components/ui/Button.jsx";
import { ShareModal } from "../components/share/ShareModal.jsx";
import { PreviewPane } from "../components/editor/PreviewPane.jsx";
import { TabProfile } from "../components/editor/TabProfile.jsx";
import { TabAbout } from "../components/editor/TabAbout.jsx";
import { TabSkills } from "../components/editor/TabSkills.jsx";
import { TabExperience } from "../components/editor/TabExperience.jsx";
import { TabProjects } from "../components/editor/TabProjects.jsx";
import { TabEducation } from "../components/editor/TabEducation.jsx";
import { TabTestimonials } from "../components/editor/TabTestimonials.jsx";
import { TabBlog } from "../components/editor/TabBlog.jsx";
import { TabContact } from "../components/editor/TabContact.jsx";
import { TabTheme } from "../components/editor/TabTheme.jsx";

const MIN_EDITOR_WIDTH = 320;
const MIN_PREVIEW_WIDTH = 340;
const WIDTH_KEY = "portfolio-builder:editorWidth";

const TABS = [
  ["profile", "Profile", TabProfile],
  ["about", "About Me", TabAbout],
  ["skills", "Skills", TabSkills],
  ["experience", "Experience", TabExperience],
  ["projects", "Projects", TabProjects],
  ["education", "Education", TabEducation],
  ["testimonials", "Testimonials", TabTestimonials],
  ["blog", "Blog", TabBlog],
  ["contact", "Contact", TabContact],
  ["theme", "Theme & Design", TabTheme],
];

export function EditorPage() {
  const [tab, setTab] = useState("profile");
  const [mobileView, setMobileView] = useState("editor");
  const [shareOpen, setShareOpen] = useState(false);
  const [editorWidth, setEditorWidth] = useState(() => Number(localStorage.getItem(WIDTH_KEY)) || 440);
  const [dragging, setDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  const splitRef = useRef(null);
  const data = usePortfolioStore((s) => s.data);
  const setAll = usePortfolioStore((s) => s.setAll);
  const resetToDefaults = usePortfolioStore((s) => s.resetToDefaults);
  const lastSavedAt = usePortfolioStore((s) => s.lastSavedAt);

  const ActiveTab = TABS.find((t) => t[0] === tab)[2];

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = await readJsonFile(file);
      setAll(json);
    } catch {
      alert("That file couldn't be read as valid portfolio JSON.");
    }
    e.target.value = "";
  };

  const handleReset = () => {
    if (confirm("Reset your portfolio to the default template? This can't be undone.")) {
      resetToDefaults();
    }
  };

  const startDrag = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const containerLeft = splitRef.current?.getBoundingClientRect().left ?? 0;
      const containerWidth = splitRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      const max = containerWidth - MIN_PREVIEW_WIDTH;
      const next = Math.min(Math.max(e.clientX - containerLeft, MIN_EDITOR_WIDTH), Math.max(max, MIN_EDITOR_WIDTH));
      setEditorWidth(next);
    };
    const onUp = () => {
      setDragging(false);
      setEditorWidth((w) => {
        localStorage.setItem(WIDTH_KEY, String(w));
        return w;
      });
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 text-white font-head font-bold">
          <span className="text-lg">🧩</span> Portfolio Builder
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-slate-500">
            {lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Not saved yet"}
          </span>
          <label className="text-xs text-slate-400 hover:text-white cursor-pointer">
            Import
            <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={() => downloadJson(data, `${data.profile.name || "portfolio"}.json`)} className="text-xs text-slate-400 hover:text-white">
            Export
          </button>
          <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-400">
            Reset
          </button>
          <Button size="sm" onClick={() => setShareOpen(true)}>
            Share ↗
          </Button>
        </div>
      </header>

      <div className="md:hidden flex border-b border-slate-800 shrink-0">
        <button
          onClick={() => setMobileView("editor")}
          className={`flex-1 py-2.5 text-sm font-medium ${mobileView === "editor" ? "text-white border-b-2 border-cyan-400" : "text-slate-500"}`}
        >
          Editor
        </button>
        <button
          onClick={() => setMobileView("preview")}
          className={`flex-1 py-2.5 text-sm font-medium ${mobileView === "preview" ? "text-white border-b-2 border-cyan-400" : "text-slate-500"}`}
        >
          Preview
        </button>
      </div>

      <div ref={splitRef} className="flex-1 min-h-0 flex relative">
        <div
          className={`w-full shrink-0 border-r border-slate-800 flex ${mobileView === "preview" ? "hidden md:flex" : "flex"}`}
          style={isDesktop ? { width: editorWidth } : undefined}
        >
          <nav className="w-36 sm:w-40 shrink-0 border-r border-slate-800 overflow-y-auto py-2">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`w-full text-left px-4 py-2.5 text-xs font-medium transition border-l-2 ${
                  tab === key ? "text-white border-cyan-400 bg-slate-900" : "text-slate-500 border-transparent hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <ActiveTab />
          </div>
        </div>

        <div
          onMouseDown={startDrag}
          className={`hidden md:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center group relative z-10 ${dragging ? "bg-cyan-400/40" : "hover:bg-cyan-400/20"}`}
          title="Drag to resize"
        >
          <span className="w-0.5 h-8 rounded-full bg-slate-700 group-hover:bg-cyan-400 transition-colors" />
        </div>

        <div className={`flex-1 min-w-0 ${mobileView === "editor" ? "hidden md:block" : "block"}`}>
          <PreviewPane />
        </div>
      </div>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
