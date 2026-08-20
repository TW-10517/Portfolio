import { describe, it, expect } from "vitest";
import { LocalProvider } from "./LocalProvider.js";

const provider = new LocalProvider();

describe("LocalProvider", () => {
  it("only mentions facts present in the brief (intro scene)", async () => {
    const text = await provider.writeScript({ name: "Jamie Chen", roles: "Engineer", tagline: "Ships things.", location: "" }, "intro", {});
    expect(text).toContain("Jamie Chen");
    expect(text).toContain("Engineer");
    // location was empty in the brief — must not appear as if it were real
    expect(text.toLowerCase()).not.toContain("location");
  });

  it("caps output to roughly maxWords", async () => {
    const brief = { bio: "Sentence one is here. Sentence two adds more detail. Sentence three keeps going on and on.", philosophy: "" };
    const text = await provider.writeScript(brief, "about", { maxWords: 5 });
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(6); // capWords may add trailing punctuation as its own "word"
  });

  it("never mentions a project's tech stack if none was given", async () => {
    const brief = { name: "Widget Maker", shortDesc: "Makes widgets.", fullDesc: "", tech: [], metrics: "" };
    const text = await provider.writeScript(brief, "project", {});
    expect(text).toContain("Widget Maker");
    expect(text).not.toMatch(/Built with/);
  });

  it("closing scene adapts the call-to-action by audience without inventing contact info", async () => {
    const brief = { name: "Sam", email: "" };
    const recruiterText = await provider.writeScript(brief, "closing", { audience: "recruiter" });
    expect(recruiterText).not.toContain("@"); // no email was given
    expect(recruiterText.toLowerCase()).toContain("open to new roles");
  });
});

describe("style actually changes the wording", () => {
  const provider = new LocalProvider();
  const STYLES = ["professional", "creative", "minimal", "storytelling"];

  // Guards the bug this replaced: `style` used to swap only the intro's first
  // two words, and `tone` only decided whether the intro ended in "!", so
  // every other scene read identically no matter what the user picked.
  const cases = [
    ["intro", { name: "Ada Lovelace", roles: "Engineer", tagline: "Building things." }],
    ["skills", { topSkills: ["Python", "React", "SQL"], learning: ["Rust"] }],
    ["experience", { items: [{ company: "Acme", role: "Engineer", duration: "2020–2023", description: "Led the platform team." }] }],
    ["project", { name: "Atlas", shortDesc: "A mapping tool.", tech: ["React"], metrics: "" }],
    ["education", { degrees: [{ degree: "BSc", institution: "MIT", year: "2019" }], certifications: [] }],
    ["achievements", { awards: [{ name: "Best Paper", issuer: "ACM", year: "2022" }] }],
  ];

  it.each(cases)("produces a distinct phrasing per style for %s", async (sceneType, brief) => {
    const outputs = await Promise.all(STYLES.map((style) => provider.writeScript(brief, sceneType, { style })));
    expect(new Set(outputs).size).toBe(STYLES.length);
  });

  it("keeps the underlying facts identical across styles", async () => {
    const brief = { topSkills: ["Python", "React", "SQL"], learning: [] };
    for (const style of STYLES) {
      const text = await provider.writeScript(brief, "skills", { style });
      expect(text).toContain("Python");
      expect(text).toContain("React");
      expect(text).toContain("SQL");
    }
  });

  it("falls back to professional phrasing for an unknown style", async () => {
    const brief = { name: "Ada", roles: "Engineer" };
    const unknown = await provider.writeScript(brief, "intro", { style: "not-a-real-style" });
    const professional = await provider.writeScript(brief, "intro", { style: "professional" });
    expect(unknown).toBe(professional);
  });

  it("no longer accepts a tone option that changes anything", async () => {
    const brief = { name: "Ada", roles: "Engineer" };
    const a = await provider.writeScript(brief, "intro", { style: "professional", tone: "energetic" });
    const b = await provider.writeScript(brief, "intro", { style: "professional", tone: "calm" });
    expect(a).toBe(b);
  });
});
