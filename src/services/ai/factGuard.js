import { splitSentences } from "../../utils/textMetrics.js";
// Enforcement for the project's hard rule: the AI may rephrase the user's
// portfolio, never add to it. A prompt instruction is not enough — small
// local models in particular will happily turn an empty location field into
// "Based in the United States", or an empty job description into "instrumental
// in developing cutting-edge solutions". This module checks the generated
// text against the facts it was given so a violating scene can be thrown away
// and rewritten by the deterministic template writer instead.

// Capitalised words that are legitimately capitalised without being a proper
// noun the model invented. Sentence-initial words are skipped separately.
const ALLOWED_CAPITALS = new Set(["i", "i'm", "i've", "i'd", "i'll"]);

// Gathers every string and number in the brief into one lowercase haystack.
function collectBriefText(value, out = []) {
  if (value == null) return out;
  if (Array.isArray(value)) {
    value.forEach((v) => collectBriefText(v, out));
  } else if (typeof value === "object") {
    Object.values(value).forEach((v) => collectBriefText(v, out));
  } else {
    out.push(String(value));
  }
  return out;
}

function tightenSeparators(value) {
  return value.replace(/\s*([/.-])\s*/g, "$1");
}

// Returns the list of facts in `text` that the brief does not support.
// Deliberately narrow: it flags proper nouns and numbers — the categories the
// rule names (companies, titles, certifications, statistics, dates) — rather
// than trying to judge vague adjectives, so legitimate rephrasing survives.
export function findUnsupportedFacts(text, brief) {
  const haystack = collectBriefText(brief).join(" ").toLowerCase();
  // A skill stored as "JavaScript / TypeScript" is legitimately spoken as
  // "JavaScript/TypeScript". Comparing against a separator-normalised copy
  // keeps that from being reported as an invented technology.
  const tightHaystack = tightenSeparators(haystack);
  const problems = new Set();

  // Any digit-bearing token is a statistic, date, or duration. It must have
  // come from the portfolio.
  for (const num of text.match(/\d[\d.,%x+/-]*/g) || []) {
    const bare = num.replace(/[.,%x+/-]+$/, "");
    if (bare && !haystack.includes(bare.toLowerCase())) problems.add(num);
  }

  // Mid-sentence capitalised words are almost always proper nouns. The first
  // word of each sentence is skipped because capitalisation there carries no
  // information.
  for (const sentence of splitSentences(text)) {
    // The token pattern keeps internal dots and slashes so "Node.js" and
    // "React/Next.js" stay one word, which means trailing sentence
    // punctuation has to be trimmed off afterwards — otherwise "Lee." fails
    // to match the "Sam Lee" that is right there in the brief.
    const words = sentence.match(/[A-Za-z][A-Za-z0-9'’+#./-]*/g) || [];
    words.slice(1).forEach((raw) => {
      const word = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
      if (!word || !/^[A-Z]/.test(word)) return;
      const lower = word.toLowerCase();
      if (ALLOWED_CAPITALS.has(lower)) return;
      // Strip possessives before comparing ("Acme's" is supported by "Acme").
      const stem = lower.replace(/['’]s$/, "");
      if (haystack.includes(stem) || tightHaystack.includes(tightenSeparators(stem))) return;
      // A compound like "React/Next.js" is supported when every part of it
      // is — that's a rewording of the user's own list, not a new fact.
      const parts = stem.split(/[/.-]+/).filter((part) => part.length > 1);
      if (parts.length > 1 && parts.every((part) => haystack.includes(part))) return;
      problems.add(word);
    });
  }

  return [...problems];
}

// Throws if the model invented anything, so the caller's existing per-scene
// fallback to the offline template writer kicks in.
export function assertGrounded(text, brief) {
  const invented = findUnsupportedFacts(text, brief);
  if (invented.length) {
    throw new Error(`Model introduced facts not in the portfolio: ${invented.join(", ")}`);
  }
  return text;
}

// Removes empty fields before the brief is shown to a model. An explicit
// "location": "" reads as a blank to fill in; omitting the key entirely
// removes the temptation and shortens the prompt.
export function pruneEmpty(value) {
  if (Array.isArray(value)) {
    const arr = value.map(pruneEmpty).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (value && typeof value === "object") {
    const obj = {};
    for (const [k, v] of Object.entries(value)) {
      const pruned = pruneEmpty(v);
      if (pruned !== undefined) obj[k] = pruned;
    }
    return Object.keys(obj).length ? obj : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return value == null ? undefined : value;
}

// Scripts each language is actually written in. A model that quietly ignores
// the language instruction (common for languages it barely knows) would
// otherwise produce an English or romanised script for a video the user asked
// to be in Japanese, and nothing downstream would notice.
const LANGUAGE_SCRIPTS = {
  Japanese: /[぀-ヿ一-鿿]/,
  Tamil: /[஀-௿]/,
  Chinese: /[一-鿿]/,
  Korean: /[가-힯]/,
  Hindi: /[ऀ-ॿ]/,
};

export function isInExpectedScript(text, language) {
  const script = LANGUAGE_SCRIPTS[language];
  if (!script) return true; // English and anything Latin-scripted
  return script.test(text || "");
}

// Throws so the caller falls back rather than shipping a scene in the wrong
// language.
export function assertLanguage(text, language) {
  if (!isInExpectedScript(text, language)) {
    throw new Error(`Model did not write in ${language}. Try a model with stronger ${language} support.`);
  }
  return text;
}
