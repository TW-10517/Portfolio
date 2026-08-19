import { LocalProvider } from "../ai/LocalProvider.js";
import { secondsForWords } from "./sceneBuilder.js";

const localProvider = new LocalProvider();

// Writes narration for every scene in a plan using `provider`, falling back
// to the offline LocalProvider per-scene if the cloud provider errors out
// (rate limit, network, bad key, etc.) — the video always finishes.
export async function writeNarration(scenePlan, provider, options = {}) {
  const { onProgress, ...writeOptions } = options;
  const usedFallback = [];
  const scenes = [];
  const total = scenePlan.scenes.length;

  for (const scene of scenePlan.scenes) {
    onProgress?.({ index: scenes.length, total, title: scene.title });
    let text;
    let usedProviderName = provider.name;
    try {
      text = await provider.writeScript(scene.brief, scene.type, { ...writeOptions, maxWords: scene.maxWords });
    } catch {
      text = await localProvider.writeScript(scene.brief, scene.type, { ...writeOptions, maxWords: scene.maxWords });
      usedProviderName = localProvider.name;
      usedFallback.push(scene.id);
    }
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const duration = Math.max(4, Math.round(secondsForWords(wordCount)) + 1);
    scenes.push({ ...scene, text, duration, providerName: usedProviderName });
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
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      const duration = Math.max(4, Math.round(secondsForWords(wordCount)) + 1);
      return { ...scene, text, duration, providerName: usedProviderName };
    })
  );
  return { ...scenePlan, scenes, totalSeconds: scenes.reduce((sum, s) => sum + s.duration, 0) };
}
