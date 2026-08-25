// Remembers narration that has already been written.
//
// Every change to style, audience, length, language or sections rewrites the
// whole script, and with a local model that is seconds per scene. Trying four
// styles to see which reads best meant paying for all of them, and going back
// to the first one paid for it a second time.
//
// The text a provider returns is a pure function of the scene's brief and the
// options, so the same combination can simply be remembered. Flipping back to
// something already seen is then instant, which is what makes trying
// combinations feel like a comparison rather than a series of waits.

// Bounded so a long editing session can't grow it without limit. Insertion
// order is preservation order in a Map, so the oldest key is the first one.
const MAX_ENTRIES = 400;

const cache = new Map();

// Everything that can change the words. Miss anything here and the cache
// serves the wrong script; include something irrelevant and it just misses
// more often, so err towards including.
export function cacheKey(providerName, scene, options = {}) {
  return JSON.stringify([
    providerName,
    scene.type,
    scene.maxWords,
    scene.brief,
    options.style ?? null,
    options.audience ?? null,
    options.language ?? null,
    options.customInstruction ?? null,
  ]);
}

export function getCached(key) {
  if (!cache.has(key)) return undefined;
  // Refresh recency: re-inserting moves it to the end of the iteration order.
  const value = cache.get(key);
  cache.delete(key);
  cache.set(key, value);
  return value;
}

export function setCached(key, text) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, text);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

// "Rewrite this scene" means the user wants a different take, so that path
// drops the remembered one rather than handing back what they just rejected.
export function forget(key) {
  cache.delete(key);
}

export function clearScriptCache() {
  cache.clear();
}

export function cacheSize() {
  return cache.size;
}
