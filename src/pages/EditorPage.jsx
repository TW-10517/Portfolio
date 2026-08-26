import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortfolioStore } from "../store/usePortfolioStore.js";
import { useVideoStore } from "../store/useVideoStore.js";
import { useAuthStore } from "../store/useAuthStore.js";
import { downloadJson, readJsonFile, inlineStoredImages } from "../utils/exportImport.js";
import { resolveImageUrl } from "../utils/imageUrl.js";
import { api } from "../utils/api.js";
import { Button } from "../components/ui/Button.jsx";
import { ShareModal } from "../components/share/ShareModal.jsx";
import { AccountModal } from "../components/auth/AccountModal.jsx";
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
import { TabAIVideo } from "../components/editor/TabAIVideo.jsx";
import { notify } from "../store/useNotices.js";
import { Toaster } from "../components/ui/Toaster.jsx";

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
  ["aivideo", "🎬 AI Video", TabAIVideo],
];

export function EditorPage() {
  const [tab, setTab] = useState("profile");
  const [mobileView, setMobileView] = useState("editor");
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const [resendNote, setResendNote] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editorWidth, setEditorWidth] = useState(() => Number(localStorage.getItem(WIDTH_KEY)) || 440);
  const [dragging, setDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  const splitRef = useRef(null);
  const data = usePortfolioStore((s) => s.data);
  const setAll = usePortfolioStore((s) => s.setAll);
  const resetToDefaults = usePortfolioStore((s) => s.resetToDefaults);
  const loadFromServer = usePortfolioStore((s) => s.loadFromServer);
  const clearLocalDraft = usePortfolioStore((s) => s.clearLocalDraft);
  const lastSavedAt = usePortfolioStore((s) => s.lastSavedAt);
  const lastPublishedAt = usePortfolioStore((s) => s.lastPublishedAt);
  const hasUnpublishedChanges = !!lastSavedAt && (!lastPublishedAt || lastSavedAt > lastPublishedAt);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // Images live on the server now, so a straight dump of `data` would export a
  // file full of links instead of pictures. Put the bytes back first, so the
  // download is still something you can keep or import anywhere.
  const exportPortfolio = async () => {
    const portable = await inlineStoredImages(data, resolveImageUrl);
    downloadJson(portable, `${data.profile.name || "portfolio"}.json`);
  };

  // Pulls in whatever this account last published/saved server-side, so
  // editing continues across devices instead of being stuck in one
  // browser's localStorage. A brand-new account has nothing saved yet
  // (loadFromServer resolves false) and just keeps the local draft.
  useEffect(() => {
    if (token) loadFromServer(token).catch(() => {});
  }, [token, loadFromServer]);

  const ActiveTab = TABS.find((t) => t[0] === tab)[2];
  const isStudioTab = tab === "aivideo";

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = await readJsonFile(file);
      setAll(json);
    } catch {
      notify("That file isn't a portfolio export — it couldn't be read as valid JSON.");
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

  // The pane width is a pixel value persisted across sessions, so it can easily
  // outlive the window it was dragged in. Re-clamp it here (and once on mount,
  // for whatever localStorage handed us) or the pane keeps a width wider than
  // the split container, shoves the preview off-screen, and clips its own
  // content on the right.
  useEffect(() => {
    const onResize = () => {
      setIsDesktop(window.innerWidth >= 768);
      const containerWidth = splitRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      const max = Math.max(containerWidth - MIN_PREVIEW_WIDTH, MIN_EDITOR_WIDTH);
      setEditorWidth((w) => Math.min(Math.max(w, MIN_EDITOR_WIDTH), max));
    };
    onResize();
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
      <header aria-label="Editor toolbar" className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 text-white font-head font-bold">
          <span className="text-lg">🧩</span> Portfolio Builder
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`hidden sm:inline text-xs ${hasUnpublishedChanges ? "text-amber-400" : "text-slate-400"}`}
            title={
              hasUnpublishedChanges
                ? "Saved in this browser only — use Share to publish these changes to your account."
                : "Your published portfolio is up to date."
            }
          >
            {!lastSavedAt
              ? "Not saved yet"
              : hasUnpublishedChanges
              ? "● Unpublished changes"
              : `Published ${new Date(lastPublishedAt).toLocaleTimeString()}`}
          </span>
          <label className="text-xs text-slate-400 hover:text-white cursor-pointer">
            Import
            <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={exportPortfolio} className="text-xs text-slate-400 hover:text-white">
            Export
          </button>
          <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-400">
            Reset
          </button>
          <Button size="sm" onClick={() => setShareOpen(true)}>
            Share ↗
          </Button>
          <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
            <button
              onClick={() => setAccountOpen(true)}
              title={`Signed in as ${user?.email || ""} — account settings`}
              className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 hover:bg-slate-800/70 transition group"
            >
              <span className="w-6 h-6 shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 text-[11px] font-bold flex items-center justify-center">
                {(user?.name || "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-xs text-slate-300 group-hover:text-white">{user?.name}</span>
                <span className="text-[10px] text-slate-400 max-w-[160px] truncate">{user?.email}</span>
              </span>
              {user && !user.emailVerified && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Email not verified" />}
            </button>
            <button
              onClick={() => {
                logout();
                clearLocalDraft();
                // The AI Video studio outlives this component on purpose, so it
                // has to be told about a sign-out or the next person to use
                // this browser arrives at someone else's script.
                useVideoStore.getState().reset();
                navigate("/login");
              }}
              className="text-xs text-slate-400 hover:text-red-400"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {user && !user.emailVerified && !verifyBannerDismissed && (
        <aside aria-label="Account notice" className="flex items-center justify-between gap-3 px-5 py-2 bg-amber-400/10 border-b border-amber-400/20 text-xs text-amber-300 shrink-0">
          <span>
            {resendNote || "Verify your email to secure your account. Check the API server's console for your verification link (no email provider is configured)."}
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={async () => {
                setResendNote("Sending…");
                try {
                  const { message } = await api.resendVerification(token);
                  setResendNote(message);
                } catch {
                  setResendNote("Couldn't send a new link. Please try again.");
                }
              }}
              className="underline hover:text-amber-200"
            >
              Resend link
            </button>
            <button onClick={() => setVerifyBannerDismissed(true)} className="text-amber-400/70 hover:text-amber-300">
              Dismiss
            </button>
          </div>
        </aside>
      )}

      {!isStudioTab && (
        <div className="md:hidden flex border-b border-slate-800 shrink-0">
          <button
            onClick={() => setMobileView("editor")}
            className={`flex-1 py-2.5 text-sm font-medium ${mobileView === "editor" ? "text-white border-b-2 border-cyan-400" : "text-slate-400"}`}
          >
            Editor
          </button>
          <button
            onClick={() => setMobileView("preview")}
            className={`flex-1 py-2.5 text-sm font-medium ${mobileView === "preview" ? "text-white border-b-2 border-cyan-400" : "text-slate-400"}`}
          >
            Preview
          </button>
        </div>
      )}

      <div ref={splitRef} className="flex-1 min-h-0 flex relative">
        <nav
          aria-label="Editor sections"
          className={`w-36 sm:w-40 shrink-0 border-r border-slate-800 overflow-y-auto py-2 md:block ${
            isStudioTab || mobileView === "editor" ? "block" : "hidden"
          }`}
        >
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
              className={`w-full text-left px-4 py-2.5 text-xs font-medium transition border-l-2 ${
                tab === key ? "text-white border-cyan-400 bg-slate-900" : "text-slate-400 border-transparent hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {isStudioTab ? (
          <main className="flex-1 min-w-0 overflow-y-auto">
            <ActiveTab />
          </main>
        ) : (
          <>
            <div
              className={`w-full min-w-0 max-w-full shrink-0 border-r border-slate-800 flex ${
                mobileView === "preview" ? "hidden md:flex" : "flex"
              }`}
              style={isDesktop ? { width: editorWidth } : undefined}
            >
              <main className="flex-1 min-w-0 overflow-y-auto px-5 py-6">
                <ActiveTab />
              </main>
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
          </>
        )}
      </div>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <Toaster />
    </div>
  );
}
