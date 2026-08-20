import { describe, expect, it } from "vitest";
import { findUnsupportedFacts, assertGrounded, pruneEmpty } from "./factGuard.js";
import { cleanModelOutput } from "./OllamaProvider.js";

describe("findUnsupportedFacts", () => {
  const brief = { name: "Sam Lee", roles: "Software Engineer", company: "Acme" };

  it("accepts text built only from the brief", () => {
    expect(findUnsupportedFacts("I am Sam Lee, a Software Engineer at Acme.", brief)).toEqual([]);
  });

  // The real failure this was written for: an empty location field became
  // "Based in the United States" in the generated narration.
  it("catches an invented place", () => {
    expect(findUnsupportedFacts("I am Sam Lee, based in the United States.", brief)).toEqual(["United", "States"]);
  });

  it("catches an invented company", () => {
    expect(findUnsupportedFacts("I led engineering at Globex.", brief)).toEqual(["Globex"]);
  });

  it("catches invented statistics", () => {
    expect(findUnsupportedFacts("I have 12 years of experience.", brief)).toEqual(["12"]);
  });

  it("allows numbers that are in the brief", () => {
    expect(findUnsupportedFacts("I spent 6 years there.", { duration: "6 years" })).toEqual([]);
  });

  it("does not flag a proper noun followed by a full stop", () => {
    expect(findUnsupportedFacts("My name is Sam Lee.", brief)).toEqual([]);
  });

  it("keeps dotted technology names intact", () => {
    expect(findUnsupportedFacts("I build with Node.js and Next.js.", { tech: ["Node.js", "Next.js"] })).toEqual([]);
  });

  it("does not flag the first word of a sentence", () => {
    expect(findUnsupportedFacts("Building things is what I do. Shipping them matters more.", brief)).toEqual([]);
  });

  it("allows first-person pronouns anywhere", () => {
    expect(findUnsupportedFacts("Today I ship, and I'm proud of what I've built.", brief)).toEqual([]);
  });

  it("accepts a possessive form of a supported noun", () => {
    expect(findUnsupportedFacts("I joined Acme's platform team.", brief)).toEqual([]);
  });

  // A skill stored as "JavaScript / TypeScript" is naturally spoken as
  // "JavaScript/TypeScript"; that rewording is not an invented technology.
  it("accepts a compound skill written without the spaces the brief used", () => {
    const skills = { topSkills: ["JavaScript / TypeScript", "React / Next.js"], learning: ["WebGL / Three.js"] };
    expect(findUnsupportedFacts("I use JavaScript/TypeScript, React/Next.js and WebGL/Three.js.", skills)).toEqual([]);
  });

  it("still catches a compound whose parts are both invented", () => {
    expect(findUnsupportedFacts("I use Kotlin/Swift.", { topSkills: ["Python"] })).toEqual(["Kotlin/Swift"]);
  });

  it("catches a compound where only one half is supported", () => {
    expect(findUnsupportedFacts("I use Python/Haskell.", { topSkills: ["Python"] })).toEqual(["Python/Haskell"]);
  });

  it("searches nested arrays and objects in the brief", () => {
    const nested = { items: [{ company: "Initech", role: "Engineer" }] };
    expect(findUnsupportedFacts("I was an Engineer at Initech.", nested)).toEqual([]);
  });
});

describe("assertGrounded", () => {
  it("returns the text unchanged when everything is supported", () => {
    expect(assertGrounded("I am Sam Lee.", { name: "Sam Lee" })).toBe("I am Sam Lee.");
  });

  it("throws so the caller can fall back to the offline writer", () => {
    expect(() => assertGrounded("I am Sam Lee, VP at Globex.", { name: "Sam Lee" })).toThrow(/not in the portfolio/i);
  });
});

describe("pruneEmpty", () => {
  // An explicit "location": "" reads to a model as a blank worth filling in.
  it("drops empty strings, blank strings and empty arrays", () => {
    expect(pruneEmpty({ name: "A", location: "", roles: "   ", items: [] })).toEqual({ name: "A" });
  });

  it("keeps zero and false, which are real values", () => {
    expect(pruneEmpty({ count: 0, enabled: false })).toEqual({ count: 0, enabled: false });
  });

  it("prunes recursively and drops objects left empty", () => {
    expect(pruneEmpty({ a: { b: "" }, c: { d: "keep" } })).toEqual({ c: { d: "keep" } });
  });

  it("returns undefined when nothing survives", () => {
    expect(pruneEmpty({ a: "", b: [] })).toBeUndefined();
  });
});

describe("cleanModelOutput", () => {
  it("strips a conversational preamble", () => {
    expect(cleanModelOutput("Sure! Here's the narration:\nI am Sam Lee.")).toBe("I am Sam Lee.");
  });

  it("strips an explicit label", () => {
    expect(cleanModelOutput("Narration: I am Sam Lee.")).toBe("I am Sam Lee.");
  });

  it("unwraps a fully quoted response", () => {
    expect(cleanModelOutput('"I am Sam Lee."')).toBe("I am Sam Lee.");
  });

  it("keeps quotes that belong to the narration, as in a testimonial", () => {
    const quoted = '"Sam is great" — Dana, CTO.';
    expect(cleanModelOutput(quoted)).toBe(quoted);
  });

  it("strips markdown emphasis and bullets", () => {
    expect(cleanModelOutput("- **I am Sam Lee.**")).toBe("I am Sam Lee.");
  });

  it("collapses whitespace and handles empty input", () => {
    expect(cleanModelOutput("I  am\n\nSam Lee.")).toBe("I am Sam Lee.");
    expect(cleanModelOutput("")).toBe("");
    expect(cleanModelOutput(null)).toBe("");
  });
});
