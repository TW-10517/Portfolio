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

describe("the offline writer speaks every language the app offers", () => {
  const brief = {
    name: "Jamie Chen",
    roles: "Engineer",
    topSkills: ["React", "Node"],
    email: "jamie@example.com",
  };

  it("writes the narration in Japanese", async () => {
    const text = await provider.writeScript(brief, "skills", { language: "Japanese", style: "professional" });
    expect(text).toMatch(/[぀-ヿ一-鿿]/);
    // The skills themselves are the author's own words and stay untouched.
    expect(text).toContain("React");
    expect(text).not.toMatch(/toolkit/i);
  });

  it("writes the narration in Tamil", async () => {
    const text = await provider.writeScript(brief, "skills", { language: "Tamil", style: "professional" });
    expect(text).toMatch(/[஀-௿]/);
    expect(text).toContain("React");
    expect(text).not.toMatch(/toolkit/i);
  });

  it("still invents nothing in another language", async () => {
    // No email in the brief, so no contact line — in any language.
    const text = await provider.writeScript({}, "closing", { language: "Japanese", audience: "recruiter" });
    expect(text).not.toContain("@");
    const tamil = await provider.writeScript({}, "closing", { language: "Tamil", audience: "recruiter" });
    expect(tamil).not.toContain("@");
  });

  it("leaves a scene empty rather than padding it, in any language", async () => {
    for (const language of ["English", "Japanese", "Tamil"]) {
      expect(await provider.writeScript({ awards: [] }, "achievements", { language })).toBe("");
      expect(await provider.writeScript({ quote: "" }, "testimonial", { language })).toBe("");
    }
  });

  it("keeps English output exactly as it was", async () => {
    const text = await provider.writeScript(brief, "skills", { style: "professional" });
    expect(text).toBe("My core toolkit includes React and Node.");
  });

  it("does not leave a double space where phrases used to be concatenated", async () => {
    const text = await provider.writeScript(
      { ...brief, learning: ["Rust"] },
      "skills",
      { style: "professional" }
    );
    expect(text).not.toMatch(/ {2}/);
  });
});
