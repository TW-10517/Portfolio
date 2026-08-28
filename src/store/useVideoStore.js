import { create } from "zustand";
import { usePortfolioStore } from "./usePortfolioStore.js";
import { buildScenePlan, DEFAULT_SECTIONS } from "../services/video/sceneBuilder.js";
import { writeNarration, retimeScenePlan } from "../services/video/aiWriter.js";
import { getAIProvider, isInstantProvider } from "../services/ai/index.js";
import { clearScriptCache } from "../services/video/scriptCache.js";
import { SPEED_RATES } from "../services/video/tts.js";

// The script lives here rather than inside the AI Video tab, because a React
// component's state dies with the component.
//
// Writing seven scenes against a local model takes the better part of a
// minute. Clicking another tab unmounted the studio, which threw away the
// scenes already written and the progress bar with them; coming back started
// from zero, even twenty-five seconds in. The work was never running "in the
// background" — there was no background for it to run in.
//
// Hoisting it into a store fixes both halves at once: an in-flight run is no
// longer tied to a mounted component, and a finished script is still there
// when you come back. The tab becomes a view of this, which is what it should
// have been.

export const DEFAULT_CONFIG = {
  style: "professional",
  audience: "general",
  length: "standard",
  language: "English",
  speed: "normal",
  sections: DEFAULT_SECTIONS,
  customInstruction: "",
  voiceURI: "",
};

// Only these change what the script SAYS. Speed and voice alter delivery, not
// wording, so they must never throw a script away — and the provider is in
// here because a different writer is just as much a script change as a
// different setting.
function signatureOf(config, providerName) {
  return JSON.stringify([
    providerName,
    config.audience,
    config.style,
    config.length,
    config.language,
    config.sections,
    config.customInstruction,
  ]);
}

const narrationOptionsFor = (config) => ({
  rate: SPEED_RATES[config.speed],
  style: config.style,
  audience: config.audience,
  language: config.language,
  customInstruction: config.customInstruction,
});

// The machinery of a run, deliberately outside the store: none of it is
// rendered, and putting it in state would re-render every subscriber each time
// a ticket advanced.
let ticket = 0;
let controller = null;
let timer = null;
// What the in-flight run is writing, and what the plan on screen was written
// for. Together these are what let the tab remount without either restarting a
// run that is already underway or repeating one that has finished.
let writing = null;
let written = null;

export const useVideoStore = create((set, get) => ({
  config: DEFAULT_CONFIG,
  scenePlan: null,
  status: "idle", // idle | generating | ready | error
  error: "",
  progress: null,
  seekIndex: 0,

  // Which writer to use is not known at mount: the app looks for a local model
  // first, and only falls back to the offline writer if there is none. Writing
  // before that answer arrives means writing the whole script twice — once
  // offline, then again the moment the probe lands — and the second pass is
  // the slow one. Measured against qwen2.5:3b that was an entire wasted script
  // and then 28 seconds of real work, for a result the user watched change
  // under them. The probe is capped at 2.5 seconds and usually answers in
  // tens of milliseconds, so waiting for it is close to free.
  providerReady: false,
  markProviderReady: () => {
    if (get().providerReady) return;
    set({ providerReady: true });
    get().sync();
  },

  setError: (error) => set({ error }),
  setSeekIndex: (seekIndex) => set({ seekIndex }),

  // Hand-edits and single-scene rewrites land here. They change the words
  // without changing the settings, so `written` is left alone: the script on
  // screen still corresponds to the current configuration.
  setScenePlan: (update) =>
    set((state) => ({ scenePlan: typeof update === "function" ? update(state.scenePlan) : update })),

  setConfig: (update) =>
    set((state) => {
      const config = typeof update === "function" ? update(state.config) : update;
      if (config.speed === state.config.speed) return { config };
      // Speed changes how long the narration takes to speak, so every scene
      // has to be re-timed or Slow gets clipped mid-sentence. Pure arithmetic
      // on the existing script — it never needs another AI call.
      return {
        config,
        scenePlan: state.scenePlan ? retimeScenePlan(state.scenePlan, SPEED_RATES[config.speed]) : state.scenePlan,
      };
    }),

  // Called by the tab whenever it mounts and whenever the settings change.
  // Everything about "should this rebuild?" is decided here so that mounting
  // is not, by itself, a reason to rewrite anything.
  sync: () => {
    if (!get().providerReady) return;
    const provider = getAIProvider("auto");
    const want = signatureOf(get().config, provider.name);

    // Already writing exactly this: let it finish. This is the case that used
    // to restart from zero on every tab switch.
    if (writing === want) return;
    // Already written exactly this.
    if (written === want && get().scenePlan) return;

    clearTimeout(timer);
    // The first script should appear as fast as it can. After that a debounce
    // keeps a dragged slider from firing a rebuild per frame — much longer for
    // a cloud provider, where each rebuild spends the user's free quota, than
    // for a local model that is instant and costs nothing.
    const delay = get().scenePlan === null && !writing ? 0 : isInstantProvider(provider) ? 350 : 2000;
    timer = setTimeout(() => get().regenerate(), delay);
  },

  regenerate: async () => {
    const { config } = get();
    const provider = getAIProvider("auto");
    const want = signatureOf(config, provider.name);

    // Every run gets a ticket; only the newest may land. Without this a fast
    // sequence of edits can resolve out of order and leave the preview showing
    // the script for a setting the user already moved off.
    const mine = ++ticket;
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    writing = want;
    set({ status: "generating", error: "", progress: null });

    try {
      const data = usePortfolioStore.getState().data;
      const plan = buildScenePlan(data, config);
      if (!plan.scenes.length) {
        throw new Error("Add some portfolio content first — there's nothing to build a video from yet.");
      }
      const narrated = await writeNarration(plan, provider, {
        ...narrationOptionsFor(config),
        signal,
        onProgress: (p) => ticket === mine && set({ progress: p }),
        // Scenes go on screen as they are written rather than all at once at
        // the end. Each one of these is a complete, playable, shorter video —
        // see the prefix reasoning in aiWriter.js — so the studio can show it
        // and let the user watch it while the rest is still being written.
        onPartial: (partial) => {
          if (ticket !== mine) return;
          // The plan can only grow, but a rebuild starts it short again, and
          // seeking past the end renders nothing.
          set((s) => ({ scenePlan: partial, seekIndex: Math.min(s.seekIndex, partial.scenes.length - 1) }));
        },
      });
      if (ticket !== mine) return;
      writing = null;
      written = want;
      set({ scenePlan: narrated, seekIndex: 0, status: "ready", progress: null });
    } catch (e) {
      // A superseded rebuild is expected, not a failure worth showing.
      if (e?.name === "AbortError" || ticket !== mine) return;
      writing = null;
      set({ status: "error", error: e.message || "Something went wrong generating your video." });
    }
  },

  // Signing out, or switching accounts in the same browser. One person's
  // script must not be sitting in the studio for the next.
  reset: () => {
    ticket += 1;
    controller?.abort();
    controller = null;
    clearTimeout(timer);
    timer = null;
    writing = null;
    written = null;
    // The remembered scripts are written from this person's portfolio and
    // survive a reload, so they have to go too.
    clearScriptCache();
    // providerReady is deliberately not cleared: the probe has already run,
    // and asking again would stall the next script for nothing.
    set({ config: DEFAULT_CONFIG, scenePlan: null, status: "idle", error: "", progress: null, seekIndex: 0 });
  },
}));
