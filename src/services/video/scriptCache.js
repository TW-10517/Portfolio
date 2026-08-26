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

// ...and kept across reloads, because in memory alone it only ever helped
// within a single visit. Refreshing the page — or closing the laptop and
// coming back tomorrow — meant writing every scene again from scratch, which
// against a local model is the better part of a minute for a script the
// machine had already produced word for word.
//
// The bytes go to localStorage rather than to the server: the script is
// derived from the user's own portfolio, it is cheap to recompute if lost, and
// storing generated text server-side would be a decision about someone's
// content that this feature has no need to make.
const STORE_KEY = "portfolio-builder:scripts:v1";

// A budget rather than a count. Entries vary enormously — a skills scene's key
// is short, a bio's is not — and localStorage failing mid-write on a quota
// error would be a confusing way to find that out.
const MAX_BYTES = 1_000_000;

let flushTimer = null;

function storage() {
  try {
    // Absent in Node (every server-side suite) and throws outright in a
    // browser configured to block site data, so both have to be survivable.
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function load() {
  const store = storage();
  if (!store) return;
  try {
    const saved = JSON.parse(store.getItem(STORE_KEY) || "[]");
    if (!Array.isArray(saved)) return;
    // Oldest first, so the Map's insertion order still means recency.
    for (const [key, text] of saved) {
      if (typeof key === "string" && typeof text === "string") cache.set(key, text);
    }
  } catch {
    // A half-written or hand-edited entry is not worth a broken studio: the
    // worst case of ignoring it is writing the scripts again.
  }
}

function persist() {
  const store = storage();
  if (!store) return;
  // Newest first while trimming, so what survives a full budget is what was
  // used most recently.
  const entries = [...cache.entries()].reverse();
  const keep = [];
  let bytes = 0;
  for (const entry of entries) {
    const size = entry[0].length + entry[1].length + 8;
    if (bytes + size > MAX_BYTES) break;
    bytes += size;
    keep.push(entry);
  }
  try {
    store.setItem(STORE_KEY, JSON.stringify(keep.reverse()));
  } catch {
    // Quota, private mode, or a browser that refuses. The cache still works
    // for this visit; it just won't outlive it.
  }
}

// Writing on every scene would serialise the whole cache seven times per
// script for no benefit. One flush once the run goes quiet is enough.
function schedulePersist() {
  if (!storage()) return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(persist, 1000);
}

load();

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
  schedulePersist();
}

// "Rewrite this scene" means the user wants a different take, so that path
// drops the remembered one rather than handing back what they just rejected.
export function forget(key) {
  cache.delete(key);
  schedulePersist();
}

// Called on sign-out as well as by tests: the remembered scripts are written
// from one person's portfolio, and they should not be sitting in the browser
// for whoever signs in next.
export function clearScriptCache() {
  cache.clear();
  clearTimeout(flushTimer);
  try {
    storage()?.removeItem(STORE_KEY);
  } catch {
    /* nothing to undo */
  }
}

export function cacheSize() {
  return cache.size;
}
