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
