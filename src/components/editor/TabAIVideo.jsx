import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Select, TextArea } from "../ui/Field.jsx";
import { Button } from "../ui/Button.jsx";
import { slugify } from "../../utils/slug.js";
import { buildScenePlan, LENGTH_OPTIONS, AUDIENCE_OPTIONS, STYLE_OPTIONS, DEFAULT_SECTIONS, ALL_SECTIONS } from "../../services/video/sceneBuilder.js";
import { writeNarration, rewriteScene } from "../../services/video/aiWriter.js";
import { getAIProvider, getGeminiApiKey, setGeminiApiKey } from "../../services/ai/index.js";
import { getVoices, isTTSSupported, SPEED_RATES, cancelSpeech } from "../../services/video/tts.js";
import { playScenePlan, drawFirstFrame, renderAtScene, sceneIndexAtPosition, sceneStartTime, CANVAS_SIZE } from "../../services/video/player.js";
import { recordScenePlan, downloadBlob } from "../../services/video/exportVideo.js";
import { drawScene, buildImageBundle } from "../../services/video/sceneRenderer.js";
import { formatTimestamp } from "../../services/video/captions.js";

const LANGUAGES = ["English", "Japanese", "Hindi", "Tamil"];
const SECTION_LABELS = {
  about: "About",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  achievements: "Achievements",
  testimonial: "Testimonial",
};
const STYLE_ICONS = { professional: "🧑‍💼", creative: "🎨", minimal: "✏️", storytelling: "📖" };
const SCENE_ICONS = {
  intro: "👋",
  about: "💬",
  skills: "🛠️",
  experience: "💼",
  project: "🚀",
  education: "🎓",
  achievements: "🏆",
  testimonial: "⭐",
  closing: "🙌",
};

function Card({ title, hint, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-white font-head">{title}</h3>
      {hint && <p className="text-xs text-slate-500 mt-0.5 mb-4">{hint}</p>}
      {!hint && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Chip({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
        active ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

export function TabAIVideo() {
  const data = usePortfolioStore((s) => s.data);
  const canvasRef = useRef(null);
  const teaserRef = useRef(null);
  const abortRef = useRef(null);
  const timelineRef = useRef(null);

  const [config, setConfig] = useState({
    style: "professional",
    audience: "general",
    length: "standard",
    language: "English",
    tone: "professional",
    speed: "normal",
    sections: DEFAULT_SECTIONS,
    customInstruction: "",
    voiceURI: "",
  });
  const [voices, setVoices] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | generating | ready | error
  const [error, setError] = useState("");
  const [genProgress, setGenProgress] = useState(null);
  const [scenePlan, setScenePlan] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSceneId, setActiveSceneId] = useState(null);
  const [playProgress, setPlayProgress] = useState(0);
  const [seekIndex, setSeekIndex] = useState(0); // scene Play resumes from when idle
  const [dragging, setDragging] = useState(false);
  const [dragSeconds, setDragSeconds] = useState(0);
  const [showCaptions, setShowCaptions] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [exportNote, setExportNote] = useState("");
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getGeminiApiKey());
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    getVoices().then(setVoices);
    return () => {
      abortRef.current?.abort();
      cancelSpeech();
    };
  }, []);

  // AnimatePresence delays mounting the studio/config panel until the other
  // one finishes its exit animation, so a plain useEffect([scenePlan]) can
  // fire before the target <canvas> even exists in the DOM (and never get a
  // second chance to draw). Drawing from the ref callback instead guarantees
  // we run exactly when each canvas actually mounts. `latestRef` sidesteps
  // stale-closure issues without giving the callback a changing identity.
  const latestRef = useRef({ scenePlan, data });
  useEffect(() => {
    latestRef.current = { scenePlan, data };
  });

  const setTeaserNode = useCallback((el) => {
    teaserRef.current = el;
    if (!el) return;
    const { data: d } = latestRef.current;
    const brief = {
      name: d.profile?.name || "",
      roles: d.profile?.roles || "",
      tagline: d.profile?.tagline || "",
      location: d.profile?.location || "",
    };
    const fakePlan = { scenes: [{ type: "intro", brief }] };
    buildImageBundle(fakePlan, d).then((images) => {
      if (!teaserRef.current) return;
      const ctx = teaserRef.current.getContext("2d");
      drawScene(ctx, { width: CANVAS_SIZE.width, height: CANVAS_SIZE.height, scene: fakePlan.scenes[0], data: d, theme: d.theme, images, captionText: "", t: 0.6 });
    });
  }, []);

  const setCanvasNode = useCallback((el) => {
    canvasRef.current = el;
    if (!el) return;
    const { scenePlan: sp, data: d } = latestRef.current;
    if (sp) drawFirstFrame(el, sp, d, d.theme);
  }, []);

  const providerName = getAIProvider("auto").name;
  const languageWarning = config.language !== "English" && providerName !== "Gemini";

  const toggleSection = (key) => {
    setConfig((c) => ({
      ...c,
      sections: c.sections.includes(key) ? c.sections.filter((s) => s !== key) : [...c.sections, key],
    }));
  };

  const narrationOptions = () => ({
    style: config.style,
    tone: config.tone,
    audience: config.audience,
    language: config.language,
    customInstruction: config.customInstruction,
  });

  const handleGenerate = async () => {
    setStatus("generating");
    setError("");
    setExportNote("");
    setGenProgress(null);
    try {
      const plan = buildScenePlan(data, config);
      if (!plan.scenes.length) throw new Error("Add some portfolio content first — there's nothing to build a video from yet.");
      const provider = getAIProvider("auto");
      const narrated = await writeNarration(plan, provider, { ...narrationOptions(), onProgress: setGenProgress });
      setScenePlan(narrated);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e.message || "Something went wrong generating your video.");
    }
  };

  const handleStartOver = () => {
    abortRef.current?.abort();
    cancelSpeech();
    setScenePlan(null);
    setStatus("idle");
    setError("");
    setExportNote("");
  };

  const handleRegenerateScene = async (sceneId) => {
    setRegeneratingId(sceneId);
    try {
      const provider = getAIProvider("auto");
      const updated = await rewriteScene(scenePlan, sceneId, provider, narrationOptions());
      setScenePlan(updated);
    } catch (e) {
      setError(e.message || "Couldn't regenerate that scene.");
    } finally {
      setRegeneratingId(null);
    }
  };

  const updateScene = (sceneId, patch) => {
    setScenePlan((plan) => ({ ...plan, scenes: plan.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)) }));
  };

  const moveScene = (index, dir) => {
    setScenePlan((plan) => {
      const scenes = [...plan.scenes];
      const target = index + dir;
      if (target < 0 || target >= scenes.length) return plan;
      [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
      return { ...plan, scenes };
    });
  };

  const removeScene = (sceneId) => {
    setScenePlan((plan) => (plan.scenes.length <= 1 ? plan : { ...plan, scenes: plan.scenes.filter((s) => s.id !== sceneId) }));
  };

  const selectedVoice = voices.find((v) => v.voiceURI === config.voiceURI) || null;

  // Guards against a real race: seeking mid-playback aborts the current
  // attempt and immediately starts a new one. The old attempt's cleanup is
  // still in flight (abort takes ~1 animation frame to unwind) when the new
  // one begins, so without this check the old attempt's `finally` can fire
  // *after* the new one has already set isPlaying=true, resetting it back to
  // false and leaving the UI showing "Play" while a new playback is actually
  // still running underneath. Only the most-recently-started attempt (the
  // one `abortRef.current` still points at) is allowed to apply its cleanup.
  const runPlayback = async (startIndex = 0) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsPlaying(true);
    try {
      await playScenePlan(canvasRef.current, scenePlan, data, {
        theme: data.theme,
        voice: selectedVoice,
        rate: SPEED_RATES[config.speed],
        showCaptions,
        startIndex,
        onScene: (scene) => setActiveSceneId(scene.id),
        onProgress: ({ overallT }) => setPlayProgress(overallT),
        signal: controller.signal,
      });
    } finally {
      if (abortRef.current === controller) {
        setIsPlaying(false);
        setActiveSceneId(null);
        setPlayProgress(0);
        setSeekIndex(0);
        if (scenePlan) drawFirstFrame(canvasRef.current, scenePlan, data, data.theme);
      }
    }
  };

  const handlePlay = () => {
    if (!scenePlan || isPlaying || exporting) return;
    runPlayback(seekIndex);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    cancelSpeech();
  };

  const seekSecondsFromEvent = (e) => {
    const rect = timelineRef.current.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return frac * scenePlan.totalSeconds;
  };

  const previewFrameAt = (seconds) => {
    const idx = sceneIndexAtPosition(scenePlan, seconds);
    const scene = scenePlan.scenes[idx];
    const withinT = scene.duration ? (seconds - sceneStartTime(scenePlan, idx)) / scene.duration : 0;
    renderAtScene(canvasRef.current, scenePlan, data, data.theme, idx, Math.min(0.95, Math.max(0.05, withinT)));
  };

  // Scrubbing snaps the *committed* seek to the scene it lands on (audio
  // narration can't resume mid-utterance), but the drag preview itself is
  // smooth/continuous so it still feels like a real scrubber.
  const handleScrubStart = (e) => {
    if (exporting || !scenePlan) return;
    e.preventDefault();
    if (isPlaying) {
      abortRef.current?.abort();
      cancelSpeech();
    }
    setDragging(true);
    const startSeconds = seekSecondsFromEvent(e);
    setDragSeconds(startSeconds);
    previewFrameAt(startSeconds);

    const onMove = (ev) => {
      const seconds = seekSecondsFromEvent(ev);
      setDragSeconds(seconds);
      previewFrameAt(seconds);
    };
    const onUp = (ev) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const seconds = seekSecondsFromEvent(ev);
      const idx = sceneIndexAtPosition(scenePlan, seconds);
      setDragging(false);
      setSeekIndex(idx);
      runPlayback(idx);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleExport = async () => {
    if (!scenePlan || exporting) return;
    if (isPlaying) {
      abortRef.current?.abort();
      cancelSpeech();
    }
    setExporting(true);
    setExportProgress({ index: 0, total: scenePlan.scenes.length });
    setExportNote("");
    setError("");
    try {
      const { blob, audioIncluded } = await recordScenePlan(canvasRef.current, scenePlan, data, {
        theme: data.theme,
        voice: selectedVoice,
        rate: SPEED_RATES[config.speed],
        showCaptions,
        withAudio: true,
        onProgress: setExportProgress,
      });
      downloadBlob(blob, `${slugify(data.profile?.name || "portfolio")}-video.webm`);
      setExportNote(
        audioIncluded
          ? "Downloaded as WebM with narration audio."
          : "Downloaded as WebM without narration audio — allow tab-audio sharing when prompted if you want the voice included."
      );
    } catch (e) {
      setError(e.message || "Export failed.");
    } finally {
      setExporting(false);
      setExportProgress(null);
      if (scenePlan) drawFirstFrame(canvasRef.current, scenePlan, data, data.theme);
    }
  };

  const saveGeminiKey = () => setGeminiApiKey(geminiKeyInput.trim());

  const currentSeconds = !scenePlan
    ? 0
    : dragging
    ? dragSeconds
    : isPlaying
    ? playProgress * scenePlan.totalSeconds
    : sceneStartTime(scenePlan, seekIndex);

  return (
    <div className="min-h-full">
      <div className="border-b border-slate-800 px-6 sm:px-8 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-head font-bold text-white flex items-center gap-2">🎬 AI Video Portfolio</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">AI writes the script, your browser renders the video — ¥0 by default.</p>
        </div>
        {scenePlan && (
          <Button variant="ghost" size="sm" onClick={handleStartOver}>
            ← Start over
          </Button>
        )}
      </div>

      <div className="px-6 sm:px-8 py-8">
        <AnimatePresence mode="wait">
          {!scenePlan ? (
            <motion.div key="config" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <div className="grid lg:grid-cols-[1fr_400px] gap-8 max-w-6xl mx-auto items-start">
                <div className="space-y-5 order-2 lg:order-1">
                  <Card title="Purpose" hint="Who is this video for? The AI shifts emphasis to match.">
                    <Select value={config.audience} onChange={(e) => setConfig((c) => ({ ...c, audience: e.target.value }))}>
                      {AUDIENCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </Card>

                  <Card title="Style">
                    <div className="grid grid-cols-2 gap-2.5">
                      {STYLE_OPTIONS.map((o) => (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => setConfig((c) => ({ ...c, style: o.value }))}
                          className={`text-left rounded-xl border px-3.5 py-3 transition ${
                            config.style === o.value ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]" : "border-slate-700 hover:border-slate-600"
                          }`}
                        >
                          <div className="text-sm font-medium text-white flex items-center gap-1.5">
                            <span>{STYLE_ICONS[o.value]}</span> {o.label}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{o.hint}</div>
                        </button>
                      ))}
                    </div>
                  </Card>

                  <Card title="Format">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Length</label>
                        <Select value={config.length} onChange={(e) => setConfig((c) => ({ ...c, length: e.target.value }))}>
                          {Object.entries(LENGTH_OPTIONS).map(([key, o]) => (
                            <option key={key} value={key}>{o.label}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Language</label>
                        <Select value={config.language} onChange={(e) => setConfig((c) => ({ ...c, language: e.target.value }))}>
                          {LANGUAGES.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    {languageWarning && (
                      <p className="text-[11px] text-amber-400 mt-2">
                        Narration will stay in English — add a Gemini API key below to write scripts in {config.language}.
                      </p>
                    )}
                  </Card>

                  <Card title="Voice" hint={!isTTSSupported() ? "This browser doesn't support speech synthesis — captions will still work." : undefined}>
                    {isTTSSupported() ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-400 mb-1.5">Narration voice</label>
                          <Select value={config.voiceURI} onChange={(e) => setConfig((c) => ({ ...c, voiceURI: e.target.value }))}>
                            <option value="">System default</option>
                            {voices.map((v) => (
                              <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5">Speed</label>
                          <Select value={config.speed} onChange={(e) => setConfig((c) => ({ ...c, speed: e.target.value }))}>
                            <option value="slow">Slow</option>
                            <option value="normal">Normal</option>
                            <option value="fast">Fast</option>
                          </Select>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Tone</label>
                      <div className="flex flex-wrap gap-2">
                        {["professional", "friendly", "energetic", "calm"].map((t) => (
                          <Chip key={t} active={config.tone === t} onClick={() => setConfig((c) => ({ ...c, tone: t }))}>
                            {t[0].toUpperCase() + t.slice(1)}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </Card>

                  <Card title="Sections" hint="Only your real portfolio content is used — nothing is invented.">
                    <div className="flex flex-wrap gap-2">
                      {ALL_SECTIONS.map((key) => (
                        <Chip key={key} active={config.sections.includes(key)} onClick={() => toggleSection(key)}>
                          {SCENE_ICONS[key === "projects" ? "project" : key]} {SECTION_LABELS[key]}
                        </Chip>
                      ))}
                    </div>
                  </Card>

                  <Card title="How should the video feel?" hint="Optional — nudges tone and which projects get priority.">
                    <TextArea
                      rows={3}
                      value={config.customInstruction}
                      onChange={(e) => setConfig((c) => ({ ...c, customInstruction: e.target.value }))}
                      placeholder="e.g. Make it professional but friendly. Focus more on my AI projects."
                    />
                  </Card>

                  <div>
                    <button type="button" className="text-xs text-slate-500 hover:text-slate-300" onClick={() => setShowAdvanced((v) => !v)}>
                      {showAdvanced ? "Hide" : "Show"} advanced — AI provider ({providerName})
                    </button>
                    {showAdvanced && (
                      <div className="rounded-xl border border-slate-800 p-4 mt-2 space-y-2 bg-slate-900/40">
                        <p className="text-xs text-slate-400">
                          Scripts are written locally by default — free, no setup, English only. Add your own Gemini API key for richer phrasing and
                          other languages. Stored only in this browser; never required.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={geminiKeyInput}
                            onChange={(e) => setGeminiKeyInput(e.target.value)}
                            placeholder="Gemini API key (optional)"
                            className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
                          />
                          <Button size="sm" variant="subtle" onClick={saveGeminiKey}>Save</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="order-1 lg:order-2 lg:sticky lg:top-6 space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black relative shadow-2xl shadow-cyan-500/10">
                    <canvas ref={setTeaserNode} width={CANVAS_SIZE.width} height={CANVAS_SIZE.height} className="w-full h-auto block" style={{ aspectRatio: "16/9" }} />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur text-[10px] font-semibold tracking-wide text-slate-300 border border-slate-700">
                      LIVE PREVIEW
                    </div>
                    <AnimatePresence>
                      {status === "generating" && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-center px-6"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
                            className="w-9 h-9 rounded-full border-2 border-cyan-400 border-t-transparent"
                          />
                          <p className="text-sm text-white font-medium">
                            {genProgress?.title ? `Writing "${genProgress.title}"…` : "Analyzing your portfolio…"}
                          </p>
                          {genProgress && <p className="text-xs text-slate-400">{genProgress.index}/{genProgress.total} scenes</p>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300">{AUDIENCE_OPTIONS.find((o) => o.value === config.audience)?.label}</span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300">{STYLE_OPTIONS.find((o) => o.value === config.style)?.label}</span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300">{LENGTH_OPTIONS[config.length].label}</span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300">{config.language}</span>
                  </div>

                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <Button className="w-full" size="lg" disabled={status === "generating"} onClick={handleGenerate}>
                    {status === "generating" ? "Creating your story…" : "✨ Generate My Video"}
                  </Button>
                  <p className="text-[11px] text-slate-600 text-center">via {providerName} · renders entirely in your browser</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="studio" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              <div className="grid lg:grid-cols-[1fr_380px] gap-8 max-w-7xl mx-auto items-start">
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black relative shadow-2xl shadow-cyan-500/10">
                    <canvas ref={setCanvasNode} width={CANVAS_SIZE.width} height={CANVAS_SIZE.height} className="w-full h-auto block" style={{ aspectRatio: "16/9" }} />
                    {activeSceneId && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur text-[10px] font-semibold tracking-wide text-cyan-300 border border-cyan-400/40 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse-dot" /> PLAYING
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={isPlaying ? handleStop : handlePlay}
                      disabled={exporting}
                      className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 flex items-center justify-center text-base shadow-lg shadow-cyan-500/25 hover:scale-105 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
                      title={isPlaying ? "Stop" : "Play"}
                    >
                      {isPlaying ? "⏹" : "▶"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCaptions((v) => !v)}
                      className={`h-9 px-3 rounded-full text-xs font-medium border transition ${showCaptions ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-slate-700 text-slate-500"}`}
                    >
                      CC {showCaptions ? "On" : "Off"}
                    </button>
                    <div
                      ref={timelineRef}
                      onMouseDown={handleScrubStart}
                      className={`relative flex-1 min-w-0 h-4 flex items-center group ${exporting ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                    >
                      <div className="relative w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        {scenePlan.scenes.slice(1).map((_, i) => (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 w-px bg-slate-950/70 z-10"
                            style={{ left: `${(sceneStartTime(scenePlan, i + 1) / scenePlan.totalSeconds) * 100}%` }}
                          />
                        ))}
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-violet-500"
                          style={{ width: `${Math.min(100, (currentSeconds / scenePlan.totalSeconds) * 100)}%` }}
                        />
                      </div>
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 rounded-full bg-white shadow transition-opacity ${
                          dragging ? "opacity-100 scale-125" : "opacity-0 group-hover:opacity-100"
                        }`}
                        style={{ left: `${Math.min(100, (currentSeconds / scenePlan.totalSeconds) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums shrink-0">
                      {formatTimestamp(currentSeconds)} / {formatTimestamp(scenePlan.totalSeconds)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    ~{scenePlan.totalSeconds}s · {scenePlan.scenes.length} scenes · scripted via {scenePlan.scenes[0]?.providerName}
                  </p>

                  <div className="hidden lg:block rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <p className="text-[11px] text-slate-500">
                      Exports as a downloadable <span className="text-slate-300 font-medium">.webm</span> file rendered entirely in your browser —
                      nothing is uploaded or stored on our servers. For narration audio in the file, allow tab-audio sharing when your browser
                      prompts you during export.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scenes</h3>
                  <div className="space-y-2.5 max-h-[calc(100vh-360px)] min-h-[200px] overflow-y-auto pr-1 -mr-1">
                    {scenePlan.scenes.map((scene, index) => (
                      <div
                        key={scene.id}
                        className={`rounded-xl border p-3.5 transition ${
                          activeSceneId === scene.id || (!isPlaying && !dragging && index === seekIndex)
                            ? "border-cyan-400 bg-cyan-400/5"
                            : "border-slate-800 bg-slate-900/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                            <span>{SCENE_ICONS[scene.type]}</span> {scene.title}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <button type="button" onClick={() => moveScene(index, -1)} disabled={index === 0} className="text-slate-500 hover:text-white disabled:opacity-30 text-xs w-5 h-5">↑</button>
                            <button type="button" onClick={() => moveScene(index, 1)} disabled={index === scenePlan.scenes.length - 1} className="text-slate-500 hover:text-white disabled:opacity-30 text-xs w-5 h-5">↓</button>
                            <button
                              type="button"
                              onClick={() => handleRegenerateScene(scene.id)}
                              disabled={regeneratingId === scene.id}
                              className="text-slate-500 hover:text-cyan-400 text-xs w-5 h-5"
                              title="Regenerate this scene's script"
                            >
                              {regeneratingId === scene.id ? "…" : "✨"}
                            </button>
                            <button type="button" onClick={() => removeScene(scene.id)} className="text-slate-500 hover:text-red-400 text-xs w-5 h-5">✕</button>
                          </div>
                        </div>
                        <TextArea rows={2} value={scene.text} onChange={(e) => updateScene(scene.id, { text: e.target.value })} className="text-xs" />
                        <div className="flex items-center gap-2 mt-2">
                          <label className="text-[11px] text-slate-500">Duration</label>
                          <input
                            type="number"
                            min={3}
                            max={40}
                            value={scene.duration}
                            onChange={(e) => updateScene(scene.id, { duration: Number(e.target.value) || scene.duration })}
                            className="w-14 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-100"
                          />
                          <span className="text-[11px] text-slate-500">sec</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {exportNote && <p className="text-xs text-cyan-400">{exportNote}</p>}
                    <Button className="w-full" onClick={handleExport} disabled={exporting || isPlaying}>
                      {exporting ? `Building video… ${exportProgress ? `${exportProgress.index}/${exportProgress.total}` : ""}` : "⬇ Export Video (WebM)"}
                    </Button>
                    <p className="lg:hidden text-[11px] text-slate-600">
                      Renders entirely in your browser. For narration audio, allow tab-audio sharing when prompted during export.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
