import { LocalProvider } from "../ai/LocalProvider.js";
import { secondsForWords } from "./sceneBuilder.js";
import { countSpokenWords } from "../../utils/textMetrics.js";
import { cacheKey, getCached, setCached, forget } from "./scriptCache.js";

const localProvider = new LocalProvider();

// How long a scene must stay on screen for its narration to finish being
// spoken at `rate`, plus a beat of breathing room so the voice isn't clipped
// by the scene change.
export function durationForText(text, rate = 1) {
  return Math.max(4, Math.round(secondsForWords(countSpokenWords(text), rate)) + 1);
}

// Re-times an already-written plan for a new speech rate. Changing the Speed
// control must not silently leave every scene timed for the old rate, and
// re-timing is pure arithmetic — it never needs another AI call.
export function retimeScenePlan(scenePlan, rate = 1) {
  const scenes = scenePlan.scenes.map((scene) => ({ ...scene, duration: durationForText(scene.text, rate) }));
  return { ...scenePlan, scenes, totalSeconds: scenes.reduce((sum, s) => sum + s.duration, 0) };
}

// One retry before giving up on the model. The guards reject a scene when the
// model invents a fact or answers in the wrong language, and both are things a
// model often gets right on a second attempt — whereas falling straight back
// to the offline writer drops an English sentence into the middle of, say, a
// Japanese video. Only after a second failure is the deterministic writer used.
async function writeWithRetry(provider, scene, writeOptions, signal) {
  const options = { ...writeOptions, maxWords: scene.maxWords, signal };
  try {
    return await provider.writeScript(scene.brief, scene.type, options);
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    return provider.writeScript(scene.brief, scene.type, options);
  }
}

// Writes narration for every scene in a plan using `provider`, falling back
// to the offline LocalProvider per-scene if the cloud provider errors out
// (rate limit, network, bad key, etc.) — the video always finishes.
export async function writeNarration(scenePlan, provider, options = {}) {
  const { onProgress, rate = 1, signal, ...writeOptions } = options;
  const usedFallback = [];
  const total = scenePlan.scenes.length;
  let done = 0;

  const writeOne = async (scene) => {
    // A real LLM takes seconds per scene, so a superseded rebuild must stop
    // here rather than run the whole plan to completion in the background —
    // with a local model that would keep the machine busy writing a script
    // nobody is waiting for any more.
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const key = cacheKey(provider.name, scene, writeOptions);
    const remembered = getCached(key);
    if (remembered !== undefined) {
      // The whole point of trying combinations: coming back to one you have
      // already seen should cost nothing.
      onProgress?.({ index: ++done, total, title: scene.title });
      return { ...scene, text: remembered, duration: durationForText(remembered, rate), providerName: provider.name };
    }

    let text;
    let usedProviderName = provider.name;
    try {
      text = await writeWithRetry(provider, scene, writeOptions, signal);
      setCached(key, text);
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      text = await localProvider.writeScript(scene.brief, scene.type, { ...writeOptions, maxWords: scene.maxWords });
      usedProviderName = localProvider.name;
      usedFallback.push(scene.id);
      // Deliberately not cached: this is what we fell back to, not what the
      // chosen provider would say once it is reachable again.
    }
    onProgress?.({ index: ++done, total, title: scene.title });
    return { ...scene, text, duration: durationForText(text, rate), providerName: usedProviderName };
  };

  // Written concurrently rather than one after another. Seven scenes against a
  // provider that takes seconds each was seven waits in a row; the limit comes
  // from the provider because a cloud API is happy with several in flight
  // while a model on your own GPU is not.
  const scenes = await mapWithLimit(scenePlan.scenes, provider.concurrency ?? 1, writeOne);

  onProgress?.({ index: total, total, title: "" });

  return {
    ...scenePlan,
    scenes,
    totalSeconds: scenes.reduce((sum, s) => sum + s.duration, 0),
    usedFallback,
  };
}

// Results stay in input order regardless of which finishes first — the scene
// order is the video.
async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// Regenerates narration for a single scene in place, returning a new scenes array.
export async function rewriteScene(scenePlan, sceneId, provider, options = {}) {
  const scenes = await Promise.all(
    scenePlan.scenes.map(async (scene) => {
      if (scene.id !== sceneId) return scene;
      let text;
      let usedProviderName = provider.name;
      // "Rewrite this scene" means the user wants a different take, so the
      // remembered one is dropped rather than handed back.
      forget(cacheKey(provider.name, scene, options));
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
