import { describe, it, expect, beforeEach, vi } from "vitest";
import { writeNarration } from "./aiWriter.js";
import { clearScriptCache } from "./scriptCache.js";

const plan = (n = 4) => ({
  scenes: Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    type: "about",
    title: `Scene ${i}`,
    maxWords: 30,
    duration: 8,
    brief: { bio: `Body ${i}.` },
  })),
  totalSeconds: 8 * n,
});

// A provider that records how many calls overlap, so concurrency can be
// asserted rather than assumed.
function trackingProvider({ concurrency = 1, delay = 10 } = {}) {
  let inFlight = 0;
  const provider = {
    name: "Tracker",
    concurrency,
    peak: 0,
    calls: 0,
    async writeScript(brief) {
      provider.calls += 1;
      inFlight += 1;
      provider.peak = Math.max(provider.peak, inFlight);
      await new Promise((r) => setTimeout(r, delay));
      inFlight -= 1;
      return `Written: ${brief.bio}`;
    },
  };
  return provider;
}

beforeEach(() => clearScriptCache());

describe("writeNarration", () => {
  it("keeps scenes in plan order however they finish", async () => {
    // Order is the video. A scene that resolves early must not jump forward.
    const provider = trackingProvider({ concurrency: 4 });
    let call = 0;
    provider.writeScript = async (brief) => {
      const mine = call++;
      // Reverse the completion order relative to the request order.
      await new Promise((r) => setTimeout(r, (4 - mine) * 15));
      return `Written: ${brief.bio}`;
    };
    const out = await writeNarration(plan(4), provider, {});
    expect(out.scenes.map((s) => s.text)).toEqual([
      "Written: Body 0.",
      "Written: Body 1.",
      "Written: Body 2.",
      "Written: Body 3.",
    ]);
  });

  it("writes several scenes at once when the provider allows it", async () => {
    const provider = trackingProvider({ concurrency: 4, delay: 25 });
    await writeNarration(plan(4), provider, {});
    expect(provider.peak).toBeGreaterThan(1);
  });

  it("writes one at a time when the provider asks for that", async () => {
    // A model on your own GPU doesn't overlap; firing four at it is slower.
    const provider = trackingProvider({ concurrency: 1, delay: 5 });
    await writeNarration(plan(4), provider, {});
    expect(provider.peak).toBe(1);
  });

  it("does not call the provider again for a combination already written", async () => {
    const provider = trackingProvider({ concurrency: 2 });
    const options = { style: "professional", audience: "recruiter" };
    await writeNarration(plan(3), provider, options);
    expect(provider.calls).toBe(3);

    await writeNarration(plan(3), provider, options);
    expect(provider.calls, "second run should be served from memory").toBe(3);
  });

  it("treats a changed setting as a different script", async () => {
    const provider = trackingProvider({ concurrency: 2 });
    await writeNarration(plan(2), provider, { style: "professional" });
    await writeNarration(plan(2), provider, { style: "creative" });
    expect(provider.calls).toBe(4);
    // ...and coming back to the first is free again.
    await writeNarration(plan(2), provider, { style: "professional" });
    expect(provider.calls).toBe(4);
  });

  it("reports progress once per scene", async () => {
    const provider = trackingProvider({ concurrency: 3 });
    const seen = [];
    await writeNarration(plan(4), provider, { onProgress: (p) => seen.push(p.index) });
    // One per scene plus the final "done" call.
    expect(seen.filter((i) => i > 0)).toHaveLength(5);
    expect(Math.max(...seen)).toBe(4);
  });

  it("falls back per scene without caching the fallback", async () => {
    // What the fallback said is not what the chosen provider would say once
    // it is reachable again, so remembering it would pin the wrong text.
    let fail = true;
    const provider = {
      name: "Flaky",
      concurrency: 2,
      calls: 0,
      async writeScript(brief, type, options) {
        provider.calls += 1;
        if (fail) throw new Error("provider down");
        return `Recovered: ${brief.bio}`;
      },
    };
    const first = await writeNarration(plan(2), provider, {});
    expect(first.usedFallback).toHaveLength(2);
    expect(first.scenes[0].providerName).toBe("Basic (offline)");

    fail = false;
    const second = await writeNarration(plan(2), provider, {});
    expect(second.scenes[0].text).toBe("Recovered: Body 0.");
  });

  it("hands over a playable prefix as the scenes land", async () => {
    // The wait used to be all-or-nothing: seven scenes against a local model
    // is the better part of a minute of spinner, with a finished opening scene
    // sitting in memory the whole time.
    const provider = trackingProvider({ concurrency: 1, delay: 5 });
    const seen = [];
    const done = await writeNarration(plan(4), provider, { onPartial: (p) => seen.push(p) });

    expect(seen.length).toBeGreaterThan(0);
    // Every handover is a real video: growing, in order, and timed.
    let previous = 0;
    for (const step of seen) {
      expect(step.scenes.length).toBeGreaterThan(previous);
      previous = step.scenes.length;
      expect(step.partial).toBe(true);
      expect(step.scenes.map((s) => s.id)).toEqual(done.scenes.slice(0, step.scenes.length).map((s) => s.id));
      expect(step.totalSeconds).toBe(step.scenes.reduce((sum, s) => sum + s.duration, 0));
      expect(step.scenes.every((s) => s.text)).toBe(true);
    }
    // The finished plan is the return value; announcing it as a partial too
    // would leave the studio showing a complete script as still unfinished.
    expect(previous).toBeLessThan(4);
    expect(done.partial).toBeUndefined();
  });

  it("never hands over a prefix with a hole in it", async () => {
    // Written concurrently, the last scene can be ready long before the first.
    // A scene list with gaps reads as a bug, and a video that cannot be played
    // from the start is not a video.
    const provider = trackingProvider({ concurrency: 4 });
    provider.writeScript = async (brief) => {
      const index = Number(brief.bio.match(/(\d+)/)[1]);
      await new Promise((r) => setTimeout(r, (4 - index) * 15));
      return `Written: ${brief.bio}`;
    };
    const seen = [];
    await writeNarration(plan(4), provider, { onPartial: (p) => seen.push(p) });

    for (const step of seen) {
      expect(step.scenes.map((s) => s.id)).toEqual(step.scenes.map((_, i) => `s${i}`));
    }
  });

  it("stops as soon as the run is superseded", async () => {
    const controller = new AbortController();
    const provider = trackingProvider({ concurrency: 1, delay: 20 });
    controller.abort();
    await expect(writeNarration(plan(4), provider, { signal: controller.signal })).rejects.toThrow();
    expect(provider.calls).toBe(0);
  });
});
