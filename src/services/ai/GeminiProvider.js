import { AIProvider } from "./AIProvider.js";
import { assertGrounded, assertLanguage, pruneEmpty } from "./factGuard.js";

const MODEL = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Optional cloud provider. Only used if the user supplies their own API key
// (see src/services/ai/index.js) — never called automatically, never
// required, never falls back to a paid tier silently.
export class GeminiProvider extends AIProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  get name() {
    return "Gemini";
  }

  get requiresApiKey() {
    return true;
  }

  async isAvailable() {
    return !!this.apiKey;
  }

  async writeScript(brief, sceneType, options = {}) {
    if (!this.apiKey) {
      throw new Error("No Gemini API key configured.");
    }
    const prompt = buildPrompt(brief, sceneType, options);

    let res;
    try {
      res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 220 },
        }),
      });
    } catch {
      throw new Error("AI generation is temporarily unavailable. You can retry later or use the basic video generator.");
    }

    if (!res.ok) {
      throw new Error("AI generation is temporarily unavailable. You can retry later or use the basic video generator.");
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
    if (!text.trim()) throw new Error("AI generation returned an empty script.");
    // Same grounding guard as the local model — a cloud model is no more
    // entitled to invent the user's career than a local one.
    assertLanguage(text.trim(), options.language);
    return assertGrounded(text.trim(), brief);
  }
}

function buildPrompt(brief, sceneType, options) {
  const { style = "professional", audience = "general", language = "English", maxWords = 40 } = options;
  return [
    `You are writing one short narration segment (a "${sceneType}" scene) for an AI-narrated portfolio video.`,
    `Style: ${style}. Audience: ${audience}. Language: write only in ${language}.`,
    `Hard rule: use ONLY the facts given below. Do not invent companies, numbers, skills, dates, or achievements that aren't listed. If a fact is missing, don't mention it.`,
    `Keep it to at most ${maxWords} words, spoken narration style (no headings, no markdown, no quotes around the whole thing).`,
    options.customInstruction ? `Additional direction from the user: ${options.customInstruction}` : "",
    `Facts (JSON):`,
    JSON.stringify(pruneEmpty(brief) ?? {}),
  ]
    .filter(Boolean)
    .join("\n");
}
