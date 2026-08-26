import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

// A minimal localStorage. Node has none, and the point of these tests is what
// happens on the other side of a reload — which means controlling what is in
// storage before the module is first imported.
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get size() {
      return map.size;
    },
    raw: map,
  };
}

const STORE_KEY = "portfolio-builder:scripts:v1";

async function freshModule(storage) {
  vi.resetModules();
  if (storage) globalThis.localStorage = storage;
  else delete globalThis.localStorage;
  return import("./scriptCache.js");
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  delete globalThis.localStorage;
});

describe("remembering scripts across a reload", () => {
  it("writes what it has been told, once the run goes quiet", async () => {
    const store = fakeStorage();
    const { setCached } = await freshModule(store);

    setCached("k1", "First scene.");
    setCached("k2", "Second scene.");
    // Nothing yet: serialising the whole cache once per scene would be seven
    // writes per script for no benefit.
    expect(store.getItem(STORE_KEY)).toBeNull();

    vi.advanceTimersByTime(1000);
    expect(JSON.parse(store.getItem(STORE_KEY))).toEqual([
      ["k1", "First scene."],
      ["k2", "Second scene."],
    ]);
  });

  it("reads it back on the next visit", async () => {
    // The whole point. A refresh used to rewrite every scene from scratch,
    // which against a local model is most of a minute for text the machine had
    // already produced word for word.
    const store = fakeStorage({
      [STORE_KEY]: JSON.stringify([["k1", "Remembered."]]),
    });
    const { getCached } = await freshModule(store);
    expect(getCached("k1")).toBe("Remembered.");
  });

  it("ignores a corrupted store rather than breaking the studio", async () => {
    const store = fakeStorage({ [STORE_KEY]: "{not json" });
    const { getCached, cacheSize } = await freshModule(store);
    expect(cacheSize()).toBe(0);
    expect(getCached("k1")).toBeUndefined();
  });

  it("keeps the most recent entries when the budget runs out", async () => {
    const store = fakeStorage();
    const { setCached, getCached } = await freshModule(store);

    // Each of these is well over a tenth of the budget, so they cannot all fit.
    for (let i = 0; i < 20; i += 1) setCached(`key-${i}`, "x".repeat(80_000));
    vi.advanceTimersByTime(1000);

    const saved = JSON.parse(store.getItem(STORE_KEY));
    expect(saved.length).toBeLessThan(20);
    expect(store.getItem(STORE_KEY).length).toBeLessThan(1_100_000);
    // What survives is the tail, not the head.
    expect(saved.at(-1)[0]).toBe("key-19");
    expect(getCached("key-19")).toBeTruthy();
  });

  it("survives a browser that refuses to store anything", async () => {
    // Private mode, or site data blocked. The cache still has to work for this
    // visit; it just won't outlive it.
    const store = fakeStorage();
    store.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const { setCached, getCached } = await freshModule(store);

    setCached("k1", "Still here.");
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(getCached("k1")).toBe("Still here.");
  });

  it("works at all with no localStorage, which is every server-side suite", async () => {
    const { setCached, getCached } = await freshModule(null);
    setCached("k1", "In memory only.");
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(getCached("k1")).toBe("In memory only.");
  });

  it("clears the stored copy too, not just the one in memory", async () => {
    // Called on sign-out: these are written from one person's portfolio and
    // must not be sitting in the browser for whoever signs in next.
    const store = fakeStorage();
    const { setCached, clearScriptCache, getCached } = await freshModule(store);

    setCached("k1", "Private.");
    vi.advanceTimersByTime(1000);
    expect(store.getItem(STORE_KEY)).toContain("Private.");

    clearScriptCache();
    expect(store.getItem(STORE_KEY)).toBeNull();
    expect(getCached("k1")).toBeUndefined();
    // And a pending flush must not resurrect it.
    vi.advanceTimersByTime(2000);
    expect(store.getItem(STORE_KEY)).toBeNull();
  });
});
