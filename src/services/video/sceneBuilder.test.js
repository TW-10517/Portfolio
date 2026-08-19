import { describe, it, expect } from "vitest";
import { buildScenePlan, wordsForSeconds, secondsForWords, DEFAULT_SECTIONS, LENGTH_OPTIONS } from "./sceneBuilder.js";
import { createDefaultPortfolio } from "../../data/defaults.js";

describe("wordsForSeconds / secondsForWords", () => {
  it("are inverse of each other within rounding", () => {
    const words = wordsForSeconds(30);
    expect(Math.round(secondsForWords(words))).toBeCloseTo(30, -1);
  });

  it("never returns fewer than the minimum word count", () => {
    expect(wordsForSeconds(0)).toBeGreaterThanOrEqual(6);
    expect(wordsForSeconds(-5)).toBeGreaterThanOrEqual(6);
  });
});

describe("buildScenePlan", () => {
  const data = createDefaultPortfolio();

  it("always includes an intro and closing scene", () => {
    const plan = buildScenePlan(data, { length: "standard", audience: "general", sections: DEFAULT_SECTIONS });
    expect(plan.scenes[0].type).toBe("intro");
    expect(plan.scenes[plan.scenes.length - 1].type).toBe("closing");
  });

  it("only pulls facts that actually exist in the portfolio data (no invention)", () => {
    const plan = buildScenePlan(data, { length: "standard", audience: "general", sections: DEFAULT_SECTIONS });
    const introBrief = plan.scenes[0].brief;
    expect(introBrief.name).toBe(data.profile.name);
    expect(introBrief.roles).toBe(data.profile.roles);

    const skillsScene = plan.scenes.find((s) => s.type === "skills");
    const realSkillNames = data.skills.categories.flatMap((c) => c.skills.map((s) => s.name));
    skillsScene.brief.topSkills.forEach((name) => expect(realSkillNames).toContain(name));
  });

  it("respects disabled sections", () => {
    const sections = DEFAULT_SECTIONS.filter((s) => s !== "skills");
    const plan = buildScenePlan(data, { length: "standard", audience: "general", sections });
    expect(plan.scenes.some((s) => s.type === "skills")).toBe(false);
  });

  it("produces fewer scenes for 'short' than 'detailed'", () => {
    const shortPlan = buildScenePlan(data, { length: "short", audience: "general", sections: DEFAULT_SECTIONS });
    const detailedPlan = buildScenePlan(data, { length: "detailed", audience: "general", sections: DEFAULT_SECTIONS });
    expect(shortPlan.scenes.length).toBeLessThanOrEqual(LENGTH_OPTIONS.short.maxScenes);
    expect(shortPlan.scenes.length).toBeLessThan(detailedPlan.scenes.length);
  });

  it("caps project scenes to the portfolio's actual projects, never more", () => {
    const plan = buildScenePlan(data, { length: "detailed", audience: "general", sections: ["projects"] });
    const projectScenes = plan.scenes.filter((s) => s.type === "project");
    expect(projectScenes.length).toBeLessThanOrEqual(data.projects.length);
    projectScenes.forEach((s) => {
      expect(data.projects.some((p) => p.id === s.projectId)).toBe(true);
    });
  });

  it("returns no scenes beyond intro/closing when every section is disabled", () => {
    const plan = buildScenePlan(data, { length: "standard", audience: "general", sections: [] });
    expect(plan.scenes.map((s) => s.type)).toEqual(["intro", "closing"]);
  });
});
