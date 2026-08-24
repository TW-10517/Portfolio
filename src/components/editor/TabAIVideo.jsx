import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Select, TextArea } from "../ui/Field.jsx";
import { Button } from "../ui/Button.jsx";
import { slugify } from "../../utils/slug.js";
import { buildScenePlan, LENGTH_OPTIONS, AUDIENCE_OPTIONS, STYLE_OPTIONS, DEFAULT_SECTIONS, ALL_SECTIONS } from "../../services/video/sceneBuilder.js";
import { writeNarration, rewriteScene, retimeScenePlan } from "../../services/video/aiWriter.js";
import {
  getAIProvider,
  getGeminiApiKey,
  setGeminiApiKey,
  getOllamaModel,
  setOllamaModel,
  getOllamaUrl,
  listOllamaModels,
  isInstantProvider,
} from "../../services/ai/index.js";
import { getVoices, isTTSSupported, SPEED_RATES, cancelSpeech } from "../../services/video/tts.js";
import { playScenePlan, drawFirstFrame, renderAtScene, sceneIndexAtPosition, sceneStartTime, CANVAS_SIZE } from "../../services/video/player.js";
import { recordScenePlan, downloadBlob, pickSupportedMimeType, fileExtensionForMimeType, containerLabel } from "../../services/video/exportVideo.js";
import { drawScene, buildImageBundle } from "../../services/video/sceneRenderer.js";
import { formatTimestamp } from "../../services/video/captions.js";

// BCP-47 prefixes are what speechSynthesis tags its voices with, so the
// narration language has to map to one or the video is read aloud by an
// English voice mangling Japanese text.
const LANGUAGES = [
  { label: "English", code: "en" },
  { label: "Japanese", code: "ja" },
  { label: "Tamil", code: "ta" },
];

function voicesForLanguage(voices, label) {
  const code = LANGUAGES.find((l) => l.label === label)?.code || "en";
  return voices.filter((v) => (v.lang || "").toLowerCase().startsWith(code));
}
const SECTION_LABELS = {
  about: "About",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  achievements: "Achievements",
  testimonial: "Testimonial",
};
const DEFAULT_CONFIG = {
  style: "professional",
  audience: "general",
  length: "standard",
  language: "English",
  speed: "normal",
  sections: DEFAULT_SECTIONS,
  customInstruction: "",
  voiceURI: "",
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
      <h2 className="text-sm font-semibold text-white font-head">{title}</h2>
      {hint && <p className="text-xs text-slate-400 mt-0.5 mb-4">{hint}</p>}
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
        active ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

export function TabAIVideo() {
  const data = usePortfolioStore((s) => s.data);
  const canvasRef = useRef(null);
  const abortRef = useRef(null);
  const timelineRef = useRef(null);

  // Which container this browser can actually record decides both the button
  // label and the file extension, so work it out once up front rather than
  // promising a format the recorder may not produce.
  const exportMimeType = useMemo(() => pickSupportedMimeType(), []);
  const exportContainer = containerLabel(exportMimeType);
  const exportExtension = fileExtensionForMimeType(exportMimeType);

  const [config, setConfig] = useState(DEFAULT_CONFIG);
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
  // Raw text of any duration field currently being edited, so a half-typed or
  // empty value doesn't have to be a valid scene duration.
  const [durationDraft, setDurationDraft] = useState({});
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [exportNote, setExportNote] = useState("");
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getGeminiApiKey());
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaModel, setOllamaModelState] = useState(() => getOllamaModel());
  const [ollamaChecked, setOllamaChecked] = useState(false);
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

  // regenerate() must keep a stable identity (it's a useEffect dependency),
  // so it reads the current config through refs rather than closing over it.
  const configRef = useRef(config);
  const narrationOptionsRef = useRef(null);

  const setCanvasNode = useCallback((el) => {
    canvasRef.current = el;
    if (!el) return;
    const { scenePlan: sp, data: d } = latestRef.current;
    if (sp) {
      drawFirstFrame(el, sp, d, d.theme);
      return;
    }
    // Before the very first script finishes, draw the intro scene straight
    // from the profile so the player shows the real video's opening frame
    // instead of an empty black box while the script is still being written.
    const fakePlan = {
      scenes: [
        {
          type: "intro",
          brief: {
            name: d.profile?.name || "",
            roles: d.profile?.roles || "",
            tagline: d.profile?.tagline || "",
            location: d.profile?.location || "",
          },
        },
      ],
    };
    buildImageBundle(fakePlan, d).then((images) => {
      if (canvasRef.current !== el) return;
      drawScene(el.getContext("2d"), {
        width: CANVAS_SIZE.width,
        height: CANVAS_SIZE.height,
        scene: fakePlan.scenes[0],
        data: d,
        theme: d.theme,
        images,
        captionText: "",
        t: 0.6,
      });
    });
  }, []);

  // Look for a local model on mount. If one is installed and the user hasn't
  // chosen anything yet, adopt it automatically — a real LLM that costs
  // nothing and needs no account is a strictly better default than the
  // template writer, and it means never asking for an API key at all.
  useEffect(() => {
    let cancelled = false;
    listOllamaModels(getOllamaUrl()).then((models) => {
      if (cancelled) return;
      setOllamaModels(models);
      setOllamaChecked(true);
      const saved = getOllamaModel();
      if (saved && !models.includes(saved)) {
        // The model was uninstalled since last time — fall back rather than
        // failing every scene against a model that no longer exists.
        setOllamaModel("");
        setOllamaModelState("");
      } else if (!saved && models.length) {
        setOllamaModel(models[0]);
        setOllamaModelState(models[0]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const providerName = getAIProvider("auto").name;
  // The offline template writer only knows English phrasing; a real model
  // (local or cloud) can write the other languages.
  const languageWarning = config.language !== "English" && providerName === "Basic (offline)";
  const matchingVoices = voicesForLanguage(voices, config.language);
  const missingVoice = config.language !== "English" && voices.length > 0 && matchingVoices.length === 0;

  const toggleSection = (key) => {
    setConfig((c) => ({
      ...c,
      sections: c.sections.includes(key) ? c.sections.filter((s) => s !== key) : [...c.sections, key],
    }));
  };

  const narrationOptions = () => ({
    rate: SPEED_RATES[config.speed],
    style: config.style,
    audience: config.audience,
    language: config.language,
    customInstruction: config.customInstruction,
  });
  configRef.current = config;
  narrationOptionsRef.current = narrationOptions;

  // The Speed control changes how long the narration actually takes to
  // speak, so every scene has to be re-timed to match — otherwise Slow gets
  // clipped mid-sentence and Fast ends each scene in silence. Re-timing is
  // pure arithmetic on the existing script, so it needs no AI call and is
  // kept separate from the regeneration path below.
  useEffect(() => {
    setScenePlan((plan) => (plan ? retimeScenePlan(plan, SPEED_RATES[config.speed]) : plan));
  }, [config.speed]);

  // Only these settings change what the script actually SAYS. Speed and voice
  // are deliberately excluded — they alter delivery, not wording, so touching
  // them must not throw away a script (or a user's hand-edits to it).
  const scriptSignature = JSON.stringify({
    audience: config.audience,
    style: config.style,
    length: config.length,
    language: config.language,
    sections: config.sections,
    customInstruction: config.customInstruction,
  });

  // Every regeneration gets a ticket; only the newest one is allowed to land.
  // Without this, a fast sequence of edits can resolve out of order and leave
  // the preview showing the script for a setting the user already moved off.
  const genTicketRef = useRef(0);
  const genAbortRef = useRef(null);

  const regenerate = useCallback(async () => {
    const ticket = ++genTicketRef.current;
    genAbortRef.current?.abort();
    const genController = new AbortController();
    genAbortRef.current = genController;
    abortRef.current?.abort();
    cancelSpeech();
    setStatus("generating");
    setError("");
    setExportNote("");
    setGenProgress(null);
    try {
      const plan = buildScenePlan(latestRef.current.data, configRef.current);
      if (!plan.scenes.length) throw new Error("Add some portfolio content first — there's nothing to build a video from yet.");
      const provider = getAIProvider("auto");
      const narrated = await writeNarration(plan, provider, {
        ...narrationOptionsRef.current(),
        signal: genController.signal,
        onProgress: (p) => genTicketRef.current === ticket && setGenProgress(p),
      });
      if (genTicketRef.current !== ticket) return;
      setScenePlan(narrated);
      setSeekIndex(0);
      setStatus("ready");
    } catch (e) {
      // A superseded rebuild is expected, not a failure worth showing.
      if (e?.name === "AbortError" || genTicketRef.current !== ticket) return;
      setStatus("error");
      setError(e.message || "Something went wrong generating your video.");
    }
  }, []);

  // A finished rebuild has to be painted onto the canvas. The ref callback
  // only fires when the element itself mounts, so without this the player
  // would keep showing the previous script's frame (or the pre-generation
  // teaser) after every live rebuild.
  useEffect(() => {
    if (!scenePlan || !canvasRef.current || isPlaying || dragging) return;
    renderAtScene(canvasRef.current, scenePlan, data, data.theme, Math.min(seekIndex, scenePlan.scenes.length - 1), 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenePlan, data.theme, seekIndex]);

  // Live rebuild: the script re-writes itself as settings change, so the
  // preview above always matches the controls below without a Generate step.
  // The debounce is much longer for a cloud provider than for the offline
  // writer, because each cloud rebuild spends the user's free API quota
  // while the local one is instant and costs nothing.
  const instantProvider = isInstantProvider(getAIProvider("auto"));
  useEffect(() => {
    const delay = scenePlan === null ? 0 : instantProvider ? 350 : 2000;
    const timer = setTimeout(regenerate, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // providerName is in the deps so switching between two local models (or
    // to/from the cloud one) also rewrites the script — the writer changing
    // is just as much a script change as a setting changing.
  }, [scriptSignature, instantProvider, providerName, regenerate]);

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

  // Every mutation below has to go through this. totalSeconds isn't display
  // sugar: the timeline scrubber converts a click position into a time with
  // it, so a stale total silently mis-seeks as well as showing the wrong
  // length. Editing a duration or deleting a scene both used to leave it at
  // whatever the generator last computed.
  const withTotals = (plan) => ({
    ...plan,
    totalSeconds: plan.scenes.reduce((sum, s) => sum + (Number(s.duration) || 0), 0),
  });

  const updateScene = (sceneId, patch) => {
    setScenePlan((plan) =>
      withTotals({ ...plan, scenes: plan.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)) })
    );
  };

  const moveScene = (index, dir) => {
    setScenePlan((plan) => {
      const scenes = [...plan.scenes];
      const target = index + dir;
      if (target < 0 || target >= scenes.length) return plan;
      [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
      return withTotals({ ...plan, scenes });
    });
  };

  const removeScene = (sceneId) => {
    setScenePlan((plan) =>
      plan.scenes.length <= 1 ? plan : withTotals({ ...plan, scenes: plan.scenes.filter((s) => s.id !== sceneId) })
    );
  };

  // An explicit choice wins; otherwise pick a voice that actually speaks the
  // chosen language rather than letting the system default read Japanese
  // text with an English voice.
  const selectedVoice = voices.find((v) => v.voiceURI === config.voiceURI) || matchingVoices[0] || null;

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
      const { blob, audioIncluded, audioHadSound, mimeType } = await recordScenePlan(canvasRef.current, scenePlan, data, {
        theme: data.theme,
        voice: selectedVoice,
        rate: SPEED_RATES[config.speed],
        showCaptions,
        withAudio: true,
        onProgress: setExportProgress,
      });
      const container = containerLabel(mimeType);
      downloadBlob(blob, `${slugify(data.profile?.name || "portfolio")}-video.${fileExtensionForMimeType(mimeType)}`);
      setExportNote(
        !audioIncluded
          ? `Downloaded as ${container} — no audio was captured, so the file has captions but no voice. To include narration, run the export again and share a surface with its audio enabled.`
          : audioHadSound
          ? `Downloaded as ${container} with narration audio.`
          : `Downloaded as ${container}, but the shared audio was silent, so the file has captions and no voice. The narration is spoken by your operating system, so sharing a single tab usually can't hear it — re-export and pick “Entire Screen” with “Share system audio” instead.`
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

  const isBusy = status === "generating";
  const providerLabel = scenePlan?.scenes?.[0]?.providerName || providerName;

  return (
    <div className="min-h-full">
      <div className="border-b border-slate-800 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-head font-bold text-white flex items-center gap-2">🎬 AI Video Portfolio</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Change anything below — the video above rebuilds itself as you go.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setConfig(DEFAULT_CONFIG)} title="Reset all video settings">
          ↺ Reset settings
        </Button>
      </div>

      <div className="border-b border-slate-800 px-4 sm:px-8 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Capping the WRAPPER's width (rather than the canvas's height)
              keeps the box itself 16:9 on short screens — clamping height
              alone leaves the element wider than its content and pillarboxes
              the video in black bars. */}
          <div
            className="rounded-2xl overflow-hidden border border-slate-800 bg-black relative shadow-2xl shadow-cyan-500/10 mx-auto w-full"
            style={{ maxWidth: "calc(42vh * 16 / 9)" }}
          >
            <canvas
              ref={setCanvasNode}
              width={CANVAS_SIZE.width}
              height={CANVAS_SIZE.height}
              className="w-full h-auto block"
              style={{ aspectRatio: "16/9" }}
            />
            <div className="absolute top-3 left-3 flex items-center gap-2">
              {activeSceneId ? (
                <span className="px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur text-[10px] font-semibold tracking-wide text-cyan-300 border border-cyan-400/40 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse-dot" /> PLAYING
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur text-[10px] font-semibold tracking-wide text-slate-300 border border-slate-700">
                  LIVE PREVIEW
                </span>
              )}
            </div>

            {/* Kept as an overlay on the previous frame rather than blanking
                the canvas, so rapid edits don't flash black between rebuilds. */}
            <AnimatePresence>
              {isBusy && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 text-center px-6"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
                    className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent"
                  />
                  <p className="text-xs text-white font-medium">
                    {genProgress?.title ? `Writing "${genProgress.title}"…` : "Rewriting your script…"}
                  </p>
                  {genProgress && <p className="text-[11px] text-slate-400">{genProgress.index}/{genProgress.total} scenes</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={isPlaying ? handleStop : handlePlay}
              disabled={exporting || !scenePlan}
              className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 flex items-center justify-center text-base shadow-lg shadow-cyan-500/25 hover:scale-105 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none"
              title={isPlaying ? "Stop" : "Play"}
            >
              {isPlaying ? "⏹" : "▶"}
            </button>
            <button
              type="button"
              onClick={() => setShowCaptions((v) => !v)}
              className={`h-9 px-3 rounded-full text-xs font-medium border transition shrink-0 ${
                showCaptions ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-slate-700 text-slate-400"
              }`}
            >
              CC {showCaptions ? "On" : "Off"}
            </button>
            <div
              ref={timelineRef}
              onMouseDown={handleScrubStart}
              className={`relative flex-1 min-w-0 h-4 flex items-center group ${
                exporting || !scenePlan ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
            >
              <div className="relative w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                {scenePlan?.scenes.slice(1).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-px bg-slate-950/70 z-10"
                    style={{ left: `${(sceneStartTime(scenePlan, i + 1) / scenePlan.totalSeconds) * 100}%` }}
                  />
                ))}
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-violet-500"
                  style={{ width: scenePlan ? `${Math.min(100, (currentSeconds / scenePlan.totalSeconds) * 100)}%` : "0%" }}
                />
              </div>
              <div
                className={`absolute top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 rounded-full bg-white shadow transition-opacity ${
                  dragging ? "opacity-100 scale-125" : "opacity-0 group-hover:opacity-100"
                }`}
                style={{ left: scenePlan ? `${Math.min(100, (currentSeconds / scenePlan.totalSeconds) * 100)}%` : "0%" }}
              />
            </div>
            <span className="text-xs text-slate-400 tabular-nums shrink-0">
              {formatTimestamp(currentSeconds)} / {formatTimestamp(scenePlan?.totalSeconds || 0)}
            </span>
            <Button
              size="sm"
              onClick={handleExport}
              disabled={exporting || isPlaying || !scenePlan}
              className="shrink-0"
              title={`Download this video as a .${exportExtension} file`}
            >
              {exporting
                ? `Exporting… ${exportProgress ? `${exportProgress.index}/${exportProgress.total}` : ""}`
                : `⬇ Export ${exportContainer}`}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-slate-400">
              {scenePlan ? `~${scenePlan.totalSeconds}s · ${scenePlan.scenes.length} scenes · scripted via ${providerLabel}` : "Preparing your video…"}
            </p>
            {error && <p className="text-[11px] text-red-400">{error}</p>}
            {exportNote && <p className="text-[11px] text-cyan-400">{exportNote}</p>}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <Card title="Purpose" hint="Who is this video for? The AI shifts emphasis to match.">
              <Select aria-label="Who is this video for?" value={config.audience} onChange={(e) => setConfig((c) => ({ ...c, audience: e.target.value }))}>
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Card>

            <Card title="Format" hint="Length drives how many scenes make the cut.">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="aiv-length" className="block text-xs font-medium text-slate-400 mb-1.5">Length</label>
                  <Select id="aiv-length" value={config.length} onChange={(e) => setConfig((c) => ({ ...c, length: e.target.value }))}>
                    {Object.entries(LENGTH_OPTIONS).map(([key, o]) => (
                      <option key={key} value={key}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label htmlFor="aiv-language" className="block text-xs font-medium text-slate-400 mb-1.5">Language</label>
                  <Select id="aiv-language" value={config.language} onChange={(e) => setConfig((c) => ({ ...c, language: e.target.value }))}>
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.label}>{l.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
              {languageWarning && (
                <p className="text-[11px] text-amber-400 mt-2">
                  The built-in offline writer only speaks English. Run a local model (see advanced below) to write scripts in {config.language}.
                </p>
              )}
              {config.language !== "English" && providerName.startsWith("Ollama") && (
                <p className="text-[11px] text-slate-400 mt-2">
                  Non-English quality depends on the model — smaller ones handle Japanese far better than Tamil. Any scene the model can't write in{" "}
                  {config.language} falls back to English rather than shipping nonsense.
                </p>
              )}
              {missingVoice && (
                <p className="text-[11px] text-amber-400 mt-2">
                  No {config.language} voice is installed in this browser, so narration will be silent or mispronounced. Captions still work, and
                  the exported video is unaffected apart from the voice.
                </p>
              )}
            </Card>
          </div>

          <Card title="Style">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {STYLE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, style: o.value }))}
                  className={`text-left rounded-xl border px-3.5 py-3 transition ${
                    config.style === o.value
                      ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                      : "border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <div className="text-sm font-medium text-white flex items-center gap-1.5">
                    <span>{STYLE_ICONS[o.value]}</span> {o.label}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{o.hint}</div>
                </button>
              ))}
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

          <Card
            title="Voice & delivery"
            hint={
              !isTTSSupported()
                ? "This browser doesn't support speech synthesis — captions will still work."
                : "Speed re-times the video instantly; it never rewrites the script."
            }
          >
            {isTTSSupported() && (
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <label htmlFor="aiv-voice" className="block text-xs font-medium text-slate-400 mb-1.5">Narration voice</label>
                  <Select id="aiv-voice" value={config.voiceURI} onChange={(e) => setConfig((c) => ({ ...c, voiceURI: e.target.value }))}>
                    <option value="">System default</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label htmlFor="aiv-speed" className="block text-xs font-medium text-slate-400 mb-1.5">Speed</label>
                  <Select id="aiv-speed" value={config.speed} onChange={(e) => setConfig((c) => ({ ...c, speed: e.target.value }))}>
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                  </Select>
                </div>
              </div>
            )}
          </Card>

          <Card title="How should the video feel?" hint="Optional — nudges wording and which projects get priority.">
            <TextArea
              aria-label="How should the video feel?"
              rows={2}
              value={config.customInstruction}
              onChange={(e) => setConfig((c) => ({ ...c, customInstruction: e.target.value }))}
              placeholder="e.g. Make it professional but friendly. Focus more on my AI projects."
            />
          </Card>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Scenes {scenePlan ? `(${scenePlan.scenes.length})` : ""}
              </h3>
              <p className="text-[11px] text-slate-600">Edits here survive Speed and Voice changes, but a setting above rewrites the script.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {scenePlan?.scenes.map((scene, index) => (
                <div
                  key={scene.id}
                  className={`rounded-xl border p-3.5 transition ${
                    activeSceneId === scene.id || (!isPlaying && !dragging && index === seekIndex)
                      ? "border-cyan-400 bg-cyan-400/5"
                      : "border-slate-800 bg-slate-900/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSeekIndex(index);
                        renderAtScene(canvasRef.current, scenePlan, data, data.theme, index);
                      }}
                      className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 hover:text-cyan-300"
                      title="Show this scene in the player"
                    >
                      <span>{SCENE_ICONS[scene.type]}</span> {scene.title}
                    </button>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => moveScene(index, -1)} disabled={index === 0} className="text-slate-400 hover:text-white disabled:opacity-30 text-xs w-5 h-5">↑</button>
                      <button type="button" onClick={() => moveScene(index, 1)} disabled={index === scenePlan.scenes.length - 1} className="text-slate-400 hover:text-white disabled:opacity-30 text-xs w-5 h-5">↓</button>
                      <button
                        type="button"
                        onClick={() => handleRegenerateScene(scene.id)}
                        disabled={regeneratingId === scene.id}
                        className="text-slate-400 hover:text-cyan-400 text-xs w-5 h-5"
                        title="Rewrite just this scene"
                      >
                        {regeneratingId === scene.id ? "…" : "✨"}
                      </button>
                      <button type="button" onClick={() => removeScene(scene.id)} className="text-slate-400 hover:text-red-400 text-xs w-5 h-5">✕</button>
                    </div>
                  </div>
                  <TextArea
                    aria-label={`Narration for scene ${index + 1}: ${scene.title}`}
                    rows={2}
                    value={scene.text}
                    onChange={(e) => updateScene(scene.id, { text: e.target.value })}
                    className="text-xs"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <label htmlFor={`scene-duration-${scene.id}`} className="text-[11px] text-slate-400">
                      Duration
                    </label>
                    <input
                      id={`scene-duration-${scene.id}`}
                      type="number"
                      min={3}
                      max={40}
                      value={durationDraft[scene.id] ?? scene.duration}
                      onChange={(e) => {
                        // The old handler fell back to the current duration
                        // whenever Number(value) was falsy, so clearing the
                        // box put the old number straight back and the next
                        // keystroke appended to it — typing "25" over "30"
                        // produced "3025". Keeping the raw text while the
                        // field is being edited lets it be emptied.
                        const raw = e.target.value;
                        setDurationDraft((d) => ({ ...d, [scene.id]: raw }));
                        const n = Number(raw);
                        if (raw !== "" && Number.isFinite(n) && n >= 3 && n <= 40) {
                          updateScene(scene.id, { duration: Math.round(n) });
                        }
                      }}
                      onBlur={() => {
                        const raw = durationDraft[scene.id];
                        setDurationDraft(({ [scene.id]: _drop, ...rest }) => rest);
                        if (raw === undefined || raw === "") return;
                        const n = Math.round(Number(raw));
                        updateScene(scene.id, {
                          duration: Number.isFinite(n) && n > 0 ? Math.min(40, Math.max(3, n)) : scene.duration,
                        });
                      }}
                      className="w-14 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-100"
                    />
                    <span className="text-[11px] text-slate-400">sec</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <button type="button" className="text-xs text-slate-400 hover:text-slate-300" onClick={() => setShowAdvanced((v) => !v)}>
              {showAdvanced ? "Hide" : "Show"} advanced — script writer ({providerName})
            </button>
            {showAdvanced && (
              <div className="rounded-xl border border-slate-800 p-4 mt-2 space-y-4 bg-slate-900/40">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="text-xs font-semibold text-white">Local AI model</h4>
                    {!ollamaChecked ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">checking…</span>
                    ) : ollamaModels.length ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/30">
                        detected
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">not running</span>
                    )}
                  </div>

                  {ollamaModels.length > 0 ? (
                    <>
                      <p className="text-xs text-slate-400 mb-2">
                        A real language model running on your own machine — free, no account, no API key, and your portfolio never leaves your
                        computer.
                      </p>
                      <div className="flex gap-2 items-center">
                        <Select
                          aria-label="Local Ollama model"
                          value={ollamaModel}
                          onChange={(e) => {
                            setOllamaModel(e.target.value);
                            setOllamaModelState(e.target.value);
                          }}
                        >
                          <option value="">Off — use the built-in offline writer</option>
                          {ollamaModels.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </Select>
                      </div>
                      {ollamaModel && (
                        <p className="text-[11px] text-slate-600 mt-2">
                          Rebuilds wait 2s after your last change, since a local model takes a few seconds per scene.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">
                      No local model found. Install{" "}
                      <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                        Ollama
                      </a>{" "}
                      and run <code className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">ollama pull qwen2.5:3b</code>, then reopen this tab.
                      Until then scripts are written by the built-in offline writer — which always works and costs nothing.
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <h4 className="text-xs font-semibold text-white mb-1.5">Cloud model (optional)</h4>
                  <p className="text-xs text-slate-400 mb-2">
                    Only if you want it — a Gemini key enables non-English scripts. Stored in this browser, never required, and ignored entirely
                    while a local model is selected.
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
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-600 pb-4">
            Exports as a downloadable <span className="text-slate-300 font-medium">.{exportExtension}</span> file rendered entirely in your browser —
            nothing is uploaded or stored on our servers. To include the voice, pick “Entire Screen” and tick “Share system audio” when your browser
            prompts you during export.
          </p>
        </div>
      </div>
    </div>
  );
}
