import { describe, expect, it } from "vitest";
import { durationForText, retimeScenePlan } from "./aiWriter.js";
import { secondsForWords } from "./sceneBuilder.js";
import { capWords } from "../ai/LocalProvider.js";

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("secondsForWords", () => {
  it("takes longer at a slower speech rate", () => {
    expect(secondsForWords(46, 0.8)).toBeGreaterThan(secondsForWords(46, 1));
  });

  it("takes less time at a faster speech rate", () => {
    expect(secondsForWords(46, 1.2)).toBeLessThan(secondsForWords(46, 1));
  });

  it("defaults to normal rate", () => {
    expect(secondsForWords(46)).toBe(secondsForWords(46, 1));
  });
});

describe("durationForText", () => {
  // The bug this guards: rate was ignored, so Slow narration ran past the
  // end of its scene and got cancelled mid-sentence.
  it("gives a Slow scene enough time for the whole narration", () => {
    const text = words(40);
    expect(durationForText(text, 0.8)).toBeGreaterThan(durationForText(text, 1));
    expect(durationForText(text, 0.8)).toBeGreaterThanOrEqual(secondsForWords(40, 0.8));
  });

  it("shortens a Fast scene instead of leaving dead air", () => {
    const text = words(40);
    expect(durationForText(text, 1.2)).toBeLessThan(durationForText(text, 1));
  });

  it("never drops below a readable minimum", () => {
    expect(durationForText("Hi.", 1.2)).toBeGreaterThanOrEqual(4);
  });

  it("handles empty narration", () => {
    expect(durationForText("", 1)).toBeGreaterThanOrEqual(4);
  });
});

describe("retimeScenePlan", () => {
  const plan = {
    totalSeconds: 0,
    scenes: [
      { id: "a", text: words(30) },
      { id: "b", text: words(20) },
    ],
  };

  it("re-times every scene and the total for a new rate", () => {
    const slow = retimeScenePlan(plan, 0.8);
    const fast = retimeScenePlan(plan, 1.2);
    expect(slow.totalSeconds).toBeGreaterThan(fast.totalSeconds);
    expect(slow.totalSeconds).toBe(slow.scenes.reduce((s, x) => s + x.duration, 0));
  });

  it("keeps the script itself untouched", () => {
    const slow = retimeScenePlan(plan, 0.8);
    expect(slow.scenes.map((s) => s.text)).toEqual(plan.scenes.map((s) => s.text));
    expect(slow.scenes.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("capWords", () => {
  // The bug this guards: a hard word-slice produced fragments like
  // "What keeps me." which the TTS voice then read aloud.
  it("trims to a whole sentence rather than mid-clause", () => {
    const text = "I build things. What keeps me going is the craft of it all. Third sentence here.";
    expect(capWords(text, 13)).toBe("I build things. What keeps me going is the craft of it all.");
  });

  it("does not invent a trailing period on an already-complete sentence", () => {
    expect(capWords("One two three. Four five six seven eight nine ten.", 4)).toBe("One two three.");
  });

  it("falls back to a clause boundary when no whole sentence fits", () => {
    const text = "A sprawling single sentence that runs on, well past any reasonable narration budget for one scene";
    const out = capWords(text, 8);
    expect(out.endsWith(".")).toBe(true);
    expect(out).not.toMatch(/,\.$/);
  });

  it("leaves text within budget completely alone", () => {
    expect(capWords("Short and sweet.", 50)).toBe("Short and sweet.");
  });

  it("is a no-op without a budget", () => {
    expect(capWords("Anything at all", undefined)).toBe("Anything at all");
  });
});
