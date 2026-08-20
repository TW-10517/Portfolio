import { AIProvider } from "./AIProvider.js";
import { capWords } from "./LocalProvider.js";
import { assertGrounded, assertLanguage, pruneEmpty } from "./factGuard.js";
import { charsForWords } from "../../utils/textMetrics.js";

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

// Languages written without spaces between words.
const SPACELESS_LANGUAGES = new Set(["Japanese", "Chinese", "Korean"]);

// A real LLM that runs on the user's own machine via Ollama. No API key, no
// account, no cloud call, no quota — the request never leaves localhost — so
// it satisfies the project's zero-cost rule while still giving genuinely
// written prose rather than the template writer's fixed phrasing.
export class OllamaProvider extends AIProvider {
  constructor(model, baseUrl = DEFAULT_OLLAMA_URL) {
    super();
    this.model = model;
    this.baseUrl = (baseUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, "");
  }

  get name() {
    return `Ollama (${this.model})`;
  }

  get requiresApiKey() {
    return false;
  }

  async isAvailable() {
    const models = await listOllamaModels(this.baseUrl);
    return models.includes(this.model);
  }

  async writeScript(brief, sceneType, options = {}) {
    const { maxWords = 40, signal } = options;
    let res;
    try {
      res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model: this.model,
          prompt: buildPrompt(brief, sceneType, options),
          stream: false,
          options: {
            temperature: 0.7,
            // Roughly 1.6 tokens per word, plus headroom — enough to finish
            // the thought so capWords can trim at a sentence boundary rather
            // than the model being cut off mid-word by the token limit.
            num_predict: Math.max(80, Math.round(maxWords * 2.5)),
          },
        }),
      });
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      throw new Error(`Couldn't reach Ollama at ${this.baseUrl}. Is it still running?`);
    }

    if (!res.ok) throw new Error(`Ollama returned ${res.status}. Check that the model "${this.model}" is installed.`);

    const json = await res.json();
    const text = cleanModelOutput(json?.response || "");
    if (!text) throw new Error("Ollama returned an empty script.");
    // Hard guard, not a suggestion: if the model added a company, statistic,
    // place or credential the portfolio doesn't contain, throw it away. The
    // caller falls back to the offline writer for this scene, which can only
    // ever restate real fields.
    assertGrounded(text, brief);
    assertLanguage(text, options.language);
    // Small local models routinely overshoot a word budget, and scene timing
    // is derived from word count, so enforce the cap here rather than
    // trusting the model to have obeyed it.
    return capWords(text, maxWords);
  }
}

// Returns the models installed locally, or [] if Ollama isn't reachable.
// Never throws: callers use this to decide whether to offer local AI at all.
export async function listOllamaModels(baseUrl = DEFAULT_OLLAMA_URL) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.models || []).map((m) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

function buildPrompt(brief, sceneType, options) {
  const { style = "professional", audience = "general", language = "English", maxWords = 40, customInstruction } = options;
  return [
    `You write narration for an AI-narrated portfolio video. This is the "${sceneType}" scene.`,
    ``,
    `Rules:`,
    `- Output ONLY the narration itself. No preamble, no explanation, no labels, no markdown, no surrounding quotes.`,
    `- Use ONLY the facts in the JSON below. Never invent companies, job titles, numbers, dates, places, skills, or achievements. If something isn't listed, don't mention it.`,
    `- Do not add descriptive claims (industries, specialisms, locations, seniority) that aren't stated in the facts. If the facts are sparse, write a shorter line rather than padding it.`,
    // "at most 30 words" is not an instruction a model can follow in a
    // language that isn't written in words, so give those a character budget.
    SPACELESS_LANGUAGES.has(language)
      ? `- Write it to be spoken aloud, in the first person, at most ${charsForWords(maxWords)} characters.`
      : `- Write it to be spoken aloud, in the first person, at most ${maxWords} words.`,
    `- Write in ${language}. Every word of the output must be in ${language}.`,
    `- Style: ${style}. Audience: ${audience}.`,
    customInstruction ? `- Extra direction from the user: ${customInstruction}` : "",
    ``,
    `Facts (JSON):`,
    JSON.stringify(pruneEmpty(brief) ?? {}),
    ``,
    `Narration:`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

// Small local models like to wrap output in quotes, add "Sure! Here's…", or
// emit a "Narration:" label despite being told not to. Strip that packaging
// so it never gets spoken aloud or burned into the captions.
export function cleanModelOutput(raw) {
  let text = (raw || "").trim();

  // Drop a leading conversational preamble line ("Sure!", "Here's the …:")
  text = text.replace(/^(sure|certainly|of course|here'?s|here is)\b[^\n]*?[:\n]\s*/i, "");
  // Drop an explicit label the model added anyway.
  text = text.replace(/^\s*(narration|script|output|response)\s*:\s*/i, "");
  // Strip markdown emphasis and stray heading marks.
  text = text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/^[-*]\s+/gm, "");
  text = text.trim();
  // Unwrap a fully-quoted response, but leave quotes that are part of the
  // narration (a testimonial scene legitimately opens with one).
  const wrapped = /^"([\s\S]+)"$/.exec(text) || /^'([\s\S]+)'$/.exec(text);
  if (wrapped && !wrapped[1].includes('"')) text = wrapped[1].trim();

  return text.replace(/\s+/g, " ").trim();
}
