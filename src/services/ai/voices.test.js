import { describe, it, expect } from "vitest";
import { bankFor, languageCode, SUPPORTED_LANGUAGES } from "./voices.js";

const STYLES = ["professional", "creative", "minimal", "storytelling"];
const SCENE_PHRASES = ["skills", "learning", "tech", "degrees", "certs", "awards"];

describe("voices", () => {
  it("maps every language the UI offers to a BCP-47 prefix", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["English", "Japanese", "Tamil"]);
    expect(languageCode("Japanese")).toBe("ja");
    expect(languageCode("Tamil")).toBe("ta");
    // An unknown label must not produce an empty script.
    expect(languageCode("Klingon")).toBe("en");
  });

  it("has every phrase for every style in every language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const style of STYLES) {
        const v = bankFor(language, style);
        for (const key of SCENE_PHRASES) {
          expect(typeof v[key], `${language}/${style}/${key}`).toBe("function");
          expect(v[key]("X"), `${language}/${style}/${key}`).toContain("X");
        }
        expect(v.intro("NAME", "ROLE")).toContain("NAME");
        expect(v.signOff.length).toBeGreaterThan(0);
        expect(v.cta("recruiter").length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to professional phrasing for an unknown style", () => {
    expect(bankFor("Japanese", "nonsense").signOff).toBe(bankFor("Japanese", "professional").signOff);
  });

  it("writes actual Japanese and Tamil, not English", () => {
    expect(bankFor("Japanese", "professional").signOff).toMatch(/[぀-ヿ一-鿿]/);
    expect(bankFor("Tamil", "professional").signOff).toMatch(/[஀-௿]/);
  });

  it("joins lists the way each language does", () => {
    expect(bankFor("English").join(["A", "B"])).toBe("A and B");
    expect(bankFor("English").join(["A", "B", "C"])).toBe("A, B, and C");
    // Japanese uses the enumeration comma and no conjunction for three or more;
    // the English joiner produced "AとB、and C".
    expect(bankFor("Japanese").join(["A", "B"])).toBe("AとB");
    expect(bankFor("Japanese").join(["A", "B", "C"])).toBe("A、B、C");
    expect(bankFor("Tamil").join(["A", "B"])).toBe("A மற்றும் B");
  });

  it("separates sentences with a space except in Japanese", () => {
    expect(bankFor("English").separator).toBe(" ");
    expect(bankFor("Tamil").separator).toBe(" ");
    // Japanese doesn't space its clauses; a space after 。reads as a pause.
    expect(bankFor("Japanese").separator).toBe("");
  });

  it("orders the parts of a degree the way each language does", () => {
    const degree = { degree: "BSc", institution: "MIT", year: "2019" };
    expect(bankFor("English").degreeItem(degree)).toBe("BSc from MIT (2019)");
    // Japanese puts the institution first and uses full-width brackets.
    expect(bankFor("Japanese").degreeItem(degree)).toBe("MITのBSc（2019）");
  });
});
