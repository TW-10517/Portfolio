import { LocalProvider } from "../ai/LocalProvider.js";
import { secondsForWords } from "./sceneBuilder.js";

const localProvider = new LocalProvider();

// How long a scene must stay on screen for its narration to finish being
// spoken at `rate`, plus a beat of breathing room so the voice isn't clipped
// by the scene change.
export function durationForText(text, rate = 1) {
  const wordCount = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(4, Math.round(secondsForWords(wordCount, rate)) + 1);
}

// Re-times an already-written plan for a new speech rate. Changing the Speed
// control must not silently leave every scene timed for the old rate, and
// re-timing is pure arithmetic — it never needs another AI call.
export function retimeScenePlan(scenePlan, rate = 1) {
  const scenes = scenePlan.scenes.map((scene) => ({ ...scene, duration: durationForText(scene.text, rate) }));
  return { ...scenePlan, scenes, totalSeconds: scenes.reduce((sum, s) => sum + s.duration, 0) };
}

// Writes narration for every scene in a plan using `provider`, falling back
// to the offline LocalProvider per-scene if the cloud provider errors out
// (rate limit, network, bad key, etc.) — the video always finishes.
export async function writeNarration(scenePlan, provider, options = {}) {
  const { onProgress, rate = 1, signal, ...writeOptions } = options;
  const usedFallback = [];
  const scenes = [];
  const total = scenePlan.scenes.length;

  for (const scene of scenePlan.scenes) {
    // A real LLM takes seconds per scene, so a superseded rebuild must stop
    // here rather than run the whole plan to completion in the background —
    // with a local model that would keep the machine busy writing a script
    // nobody is waiting for any more.
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    onProgress?.({ index: scenes.length, total, title: scene.title });
    let text;
    let usedProviderName = provider.name;
    try {
      text = await provider.writeScript(scene.brief, scene.type, { ...writeOptions, maxWords: scene.maxWords, signal });
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      text = await localProvider.writeScript(scene.brief, scene.type, { ...writeOptions, maxWords: scene.maxWords });
      usedProviderName = localProvider.name;
      usedFallback.push(scene.id);
    }
    scenes.push({ ...scene, text, duration: durationForText(text, rate), providerName: usedProviderName });
  }
  onProgress?.({ index: total, total, title: "" });

  return {
    ...scenePlan,
    scenes,
    totalSeconds: scenes.reduce((sum, s) => sum + s.duration, 0),
    usedFallback,
  };
}

// Regenerates narration for a single scene in place, returning a new scenes array.
export async function rewriteScene(scenePlan, sceneId, provider, options = {}) {
  const scenes = await Promise.all(
    scenePlan.scenes.map(async (scene) => {
      if (scene.id !== sceneId) return scene;
      let text;
      let usedProviderName = provider.name;
      try {
        text = await provider.writeScript(scene.brief, scene.type, { ...options, maxWords: scene.maxWords });
      } catch {
        text = await localProvider.writeScript(scene.brief, scene.type, { ...options, maxWords: scene.maxWords });
        usedProviderName = localProvider.name;
      }
      return { ...scene, text, duration: durationForText(text, options.rate), providerName: usedProviderName };
    })
  );
  return { ...scenePlan, scenes, totalSeconds: scenes.reduce((sum, s) => sum + s.duration, 0) };
}
