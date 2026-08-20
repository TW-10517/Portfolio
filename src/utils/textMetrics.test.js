import { describe, expect, it } from "vitest";
import { countSpokenWords, splitSentences, tokenizeForWrap, joinTokens, charsForWords, hasSpacelessScript } from "./textMetrics.js";
import { buildCaptionCues } from "../services/video/captions.js";
import { durationForText } from "../services/video/aiWriter.js";

const JA = "私はアレックス・リベラです。ソフトウェアエンジニアです。デジタル体験を創っています。";
const EN = "I am Alex Rivera, a software engineer crafting digital experiences.";

describe("countSpokenWords", () => {
  // The bug: a whole Japanese sentence has no spaces, so splitting on
  // whitespace counted it as ONE word and gave it a 4-second scene.
  it("counts a spaceless script by character, not by whitespace", () => {
    expect(JA.trim().split(/\s+/).length).toBe(1); // what the old code saw
    expect(countSpokenWords(JA)).toBeGreaterThan(15);
  });

  it("still counts Latin text by words", () => {
    expect(countSpokenWords(EN)).toBe(10);
  });

  it("handles mixed scripts additively", () => {
    expect(countSpokenWords("私はReactを使う")).toBeGreaterThan(countSpokenWords("React"));
  });

  it("returns zero for empty input", () => {
    expect(countSpokenWords("")).toBe(0);
    expect(countSpokenWords(null)).toBe(0);
  });
});

describe("durationForText across scripts", () => {
  // The bug gave this line the 4-second floor regardless of its length.
  it("gives Japanese a duration proportional to how long it takes to say", () => {
    expect(durationForText(JA, 1)).toBeGreaterThan(6);
    // and it must scale with length, not sit on the minimum
    expect(durationForText(JA + JA, 1)).toBeGreaterThan(durationForText(JA, 1) + 4);
  });

  it("keeps comparable English and Japanese lines comparably timed", () => {
    const ja = durationForText(JA, 1);
    const en = durationForText(EN, 1);
    expect(Math.abs(ja - en)).toBeLessThan(10);
  });
});

describe("splitSentences", () => {
  it("splits on the ideographic full stop", () => {
    expect(splitSentences("私です。あなたです。").length).toBe(2);
  });

  it("still splits Latin sentences", () => {
    expect(splitSentences("One. Two! Three?").length).toBe(3);
  });
});

describe("tokenizeForWrap / joinTokens", () => {
  it("makes every spaceless character its own break opportunity", () => {
    expect(tokenizeForWrap("私は").length).toBe(2);
  });

  it("keeps Latin words whole", () => {
    expect(tokenizeForWrap("hello world")).toEqual(["hello", "world"]);
  });

  it("rejoins without inserting spaces into a spaceless script", () => {
    expect(joinTokens(tokenizeForWrap("私はアレックス"))).toBe("私はアレックス");
  });

  it("rejoins Latin words with spaces", () => {
    expect(joinTokens(tokenizeForWrap("hello world"))).toBe("hello world");
  });

  it("round-trips mixed text without gaining spaces around the CJK run", () => {
    expect(joinTokens(tokenizeForWrap("私はReactを使う"))).toBe("私はReactを使う");
  });
});

describe("buildCaptionCues", () => {
  // Previously a Japanese scene produced a single caption covering its whole
  // duration, because there were no spaces to chunk on.
  it("splits Japanese narration into several cues", () => {
    expect(buildCaptionCues(JA, 12).length).toBeGreaterThan(2);
  });

  it("still chunks English narration", () => {
    expect(buildCaptionCues(EN, 12).length).toBeGreaterThan(1);
  });

  it("covers the full duration with no gaps", () => {
    const cues = buildCaptionCues(JA, 12);
    expect(cues[0].start).toBe(0);
    expect(cues[cues.length - 1].end).toBeCloseTo(12, 5);
  });

  it("returns nothing for empty text", () => {
    expect(buildCaptionCues("", 10)).toEqual([]);
  });
});

describe("helpers", () => {
  it("detects a spaceless script", () => {
    expect(hasSpacelessScript(JA)).toBe(true);
    expect(hasSpacelessScript(EN)).toBe(false);
  });

  it("converts a word budget into a character budget", () => {
    expect(charsForWords(25)).toBeGreaterThan(25);
  });
});
