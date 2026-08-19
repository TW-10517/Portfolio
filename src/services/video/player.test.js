import { describe, it, expect, beforeAll } from "vitest";
import { playScenePlan } from "./player.js";

// Node has no requestAnimationFrame; a simple timer-based shim is enough to
// exercise the real abort/resolve logic without needing a DOM environment.
beforeAll(() => {
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
});

function mockCanvas() {
  // A canvas 2D context has dozens of methods drawScene() calls; rather than
  // stub each one, any unrecognized property access returns a no-op so the
  // real rendering code path runs without a real <canvas>.
  const ctx = new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === "measureText") return () => ({ width: 40 });
        if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop() {} });
        if (prop in target) return target[prop];
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    }
  );
  return { getContext: () => ctx };
}

// No photo/project image URLs, so buildImageBundle() never touches `Image`
// (which doesn't exist in this non-DOM test environment).
// Short durations keep this a fast unit test — the real app uses ~5-20s scenes.
const scenePlan = {
  scenes: [
    { id: "intro", type: "intro", title: "Intro", brief: { name: "Test", roles: "", tagline: "", location: "" }, text: "Hi", duration: 0.2 },
    { id: "closing", type: "closing", title: "Closing", brief: { name: "Test", email: "" }, text: "Bye", duration: 0.2 },
  ],
};
const theme = { primary: "#00c9ff", secondary: "#7b61ff" };
const data = { profile: { name: "Test", photo: "" }, theme, projects: [] };

describe("playScenePlan abort handling", () => {
  // Regression test: the per-scene animation loop used to cancel the
  // pending requestAnimationFrame on abort but never resolve the promise
  // that was awaiting it — since resolve() only ever ran *from inside* the
  // frame() callback, canceling that callback meant it was never called
  // again. The whole playback chain (and therefore the UI's isPlaying
  // state) hung forever. This is what made the Play/Stop button get stuck
  // showing "Stop" after the first real stop or seek.
  it("resolves promptly when aborted mid-scene instead of hanging until the scene finishes", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);

    const start = Date.now();
    await playScenePlan(mockCanvas(), scenePlan, data, { theme, mute: true, signal: controller.signal });
    const elapsed = Date.now() - start;

    // The bug this guards against made this hang forever, not just for the
    // scene's duration — 500ms is a generous margin above the 30ms abort delay.
    expect(elapsed).toBeLessThan(500);
  });

  it("stops actually advancing scenes once aborted (doesn't keep playing in the background)", async () => {
    const controller = new AbortController();
    const seenScenes = [];
    setTimeout(() => controller.abort(), 30);

    await playScenePlan(mockCanvas(), scenePlan, data, {
      theme,
      mute: true,
      signal: controller.signal,
      onScene: (scene) => seenScenes.push(scene.id),
    });

    expect(seenScenes).toEqual(["intro"]); // aborted during scene 1, should never reach "closing"
  });

  it("supports resuming from a later scene via startIndex (seek)", async () => {
    const progressUpdates = [];
    await playScenePlan(mockCanvas(), scenePlan, data, {
      theme,
      mute: true,
      startIndex: 1,
      onProgress: (p) => progressUpdates.push(p.overallT),
    });
    // Starting from scene 2 (5s in, out of 10s total) should never report
    // overall progress starting near 0 — it should start around 0.5.
    expect(progressUpdates[0]).toBeGreaterThan(0.4);
  });
});
