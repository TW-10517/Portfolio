import { describe, expect, it, beforeEach, vi } from "vitest";

// The provider is what costs seconds, so every assertion here is about how
// many times it gets called — the same discipline the Ollama measurements
// settled on, after timing the wall clock produced numbers that were about the
// instrumentation rather than about the app.
const provider = {
  name: "Stub",
  concurrency: 4,
  calls: 0,
  async writeScript(brief) {
    provider.calls += 1;
    await new Promise((r) => setTimeout(r, 20));
    return `Text for ${brief.bio ?? "scene"}.`;
  },
};

vi.mock("../services/ai/index.js", () => ({
  getAIProvider: () => provider,
  // Instant means a short debounce, which keeps these tests quick without
  // making them depend on the debounce being any particular length.
  isInstantProvider: () => true,
}));

const { useVideoStore } = await import("./useVideoStore.js");
const { clearScriptCache } = await import("../services/video/scriptCache.js");

const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const state = () => useVideoStore.getState();

beforeEach(() => {
  useVideoStore.getState().reset();
  // The store waits for the local-model probe before writing anything, so that
  // a script isn't written twice — once offline and again the moment the probe
  // lands. Here there is no probe to wait for.
  useVideoStore.setState({ providerReady: true });
  clearScriptCache();
  provider.calls = 0;
});

describe("the video script outliving its tab", () => {
  it("writes a script on the first sync", async () => {
    state().sync();
    await settle();
    expect(state().status).toBe("ready");
    expect(state().scenePlan.scenes.length).toBeGreaterThan(0);
    expect(provider.calls).toBe(state().scenePlan.scenes.length);
  });

  it("joins a run already in progress instead of starting another", async () => {
    // This is the bug. Clicking away from the AI Video tab unmounted the
    // studio; clicking back called sync() again, and twenty-five seconds of
    // written script were thrown away to start from zero.
    state().sync();
    await settle(30); // mid-run
    expect(state().status).toBe("generating");
    const partway = provider.calls;

    state().sync(); // the tab remounting
    state().sync();
    await settle();

    expect(state().status).toBe("ready");
    expect(provider.calls, "a remount must not re-write anything").toBe(state().scenePlan.scenes.length);
    expect(partway).toBeGreaterThan(0);
  });

  it("keeps the finished script when the tab comes back", async () => {
    state().sync();
    await settle();
    const first = state().scenePlan;
    const calls = provider.calls;

    state().sync();
    await settle();

    expect(state().scenePlan, "the same plan, not a rewritten one").toBe(first);
    expect(provider.calls).toBe(calls);
  });

  it("rewrites when a setting that changes the words changes", async () => {
    state().sync();
    await settle();
    const calls = provider.calls;

    state().setConfig((c) => ({ ...c, style: "creative" }));
    state().sync();
    await settle();

    expect(provider.calls).toBeGreaterThan(calls);
  });

  it("re-times for speed without asking the provider again", async () => {
    // Speed changes delivery, not wording. Rewriting the script for it would
    // throw away the user's hand-edits to pay for text that would come back
    // identical.
    state().sync();
    await settle();
    const calls = provider.calls;
    const before = state().scenePlan.totalSeconds;

    state().setConfig((c) => ({ ...c, speed: "slow" }));
    state().sync();
    await settle();

    expect(provider.calls).toBe(calls);
    expect(state().scenePlan.totalSeconds).toBeGreaterThan(before);
  });

  it("does not rewrite for a voice change either", async () => {
    state().sync();
    await settle();
    const calls = provider.calls;

    state().setConfig((c) => ({ ...c, voiceURI: "some-voice" }));
    state().sync();
    await settle();

    expect(provider.calls).toBe(calls);
  });

  it("forgets everything on sign-out", async () => {
    // The studio outlives the component on purpose, which means it also
    // outlives the session unless something says otherwise.
    state().sync();
    await settle();
    expect(state().scenePlan).not.toBeNull();

    state().reset();

    expect(state().scenePlan).toBeNull();
    expect(state().status).toBe("idle");
    expect(state().config.style).toBe("professional");
  });

  it("writes nothing until it knows which writer to use", async () => {
    // Measured against qwen2.5:3b, not waiting cost an entire offline script
    // that was then thrown away and rewritten — and the user watched the text
    // change under them while they were reading it.
    useVideoStore.setState({ providerReady: false });
    state().sync();
    await settle();
    expect(provider.calls).toBe(0);
    expect(state().status).toBe("idle");

    state().markProviderReady();
    await settle();
    expect(provider.calls).toBeGreaterThan(0);
    expect(state().status).toBe("ready");
  });

  it("puts scenes on screen while the rest are still being written", async () => {
    // The studio used to show nothing at all until the last scene was done.
    // Watching the first one should not require waiting for the seventh.
    state().sync();

    let sawPartial = false;
    for (let i = 0; i < 40 && !sawPartial; i += 1) {
      await settle(10);
      const { scenePlan, status } = state();
      if (scenePlan?.partial) {
        sawPartial = true;
        expect(status).toBe("generating");
        expect(scenePlan.scenes.length).toBeGreaterThan(0);
        expect(scenePlan.scenes.every((s) => s.text)).toBe(true);
      }
    }
    expect(sawPartial, "a partial plan should reach the store").toBe(true);

    await settle();
    // And the finished plan is not left flagged as still-writing, which is
    // what the export button reads to decide whether the file would be whole.
    expect(state().status).toBe("ready");
    expect(state().scenePlan.partial).toBeUndefined();
  });

  it("reports a failure rather than sitting on 'generating' forever", async () => {
    const failing = vi.spyOn(provider, "writeScript").mockRejectedValue(new Error("model gone"));
    state().setConfig((c) => ({ ...c, audience: "recruiter" }));
    state().sync();
    await settle(600);
    // Per-scene fallback means the video still finishes; what must not happen
    // is the status getting stuck.
    expect(["ready", "error"]).toContain(state().status);
    failing.mockRestore();
  });
});
