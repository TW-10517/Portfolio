import { AIProvider } from "./AIProvider.js";
import { countSpokenWords, splitSentences } from "../../utils/textMetrics.js";
import { bankFor } from "./voices.js";

// Zero-cost, zero-setup script writer. Runs entirely in the browser with no
// network call and no API key, so the AI Video feature always works even if no
// cloud provider is configured. It writes in every language the app offers —
// the phrasing banks live in voices.js — while the portfolio's own content
// (names, companies, titles, quotes) is always reproduced exactly as written.
export class LocalProvider extends AIProvider {
  get name() {
    return "Basic (offline)";
  }

  async writeScript(brief, sceneType, options = {}) {
    const writer = WRITERS[sceneType] || WRITERS.default;
    const text = writer(brief, options);
    return capWords(text, options.maxWords);
  }
}

// Trims narration to the scene's word budget WITHOUT leaving a sentence
// hanging. Slicing at an arbitrary word index produced narration like
// "What keeps me." — grammatical nonsense that a TTS voice reads aloud.
// Preference order: the last complete sentence that fits, then the last
// clause boundary, and only as a last resort a hard word slice.
export function capWords(text, maxWords) {
  if (!maxWords) return text;
  // Measured in spoken-word equivalents so the budget means the same amount
  // of speaking time in Japanese as it does in English.
  if (countSpokenWords(text) <= maxWords) return text;

  const sentences = splitSentences(text);
  const kept = [];
  let used = 0;
  for (const sentence of sentences) {
    const count = countSpokenWords(sentence);
    if (used + count > maxWords) break;
    kept.push(sentence);
    used += count;
  }
  // Keeping at least half the budget means the trim still says something
  // useful; otherwise a single long sentence would collapse to nothing.
  if (kept.length && used >= maxWords * 0.5) return kept.join(" ").trim();

  // No whole sentence fits — cut at the last clause break instead, so the
  // line ends somewhere a reader (and a voice) can breathe.
  const slice = text.split(/\s+/).filter(Boolean).slice(0, Math.ceil(maxWords)).join(" ");
  const clauseEnd = Math.max(slice.lastIndexOf(", "), slice.lastIndexOf("; "), slice.lastIndexOf(" — "));
  const base = clauseEnd > slice.length * 0.5 ? slice.slice(0, clauseEnd) : slice;
  return base.replace(/[,;:\s—-]+$/, "") + ".";
}

function firstSentences(text, count = 2) {
  return splitSentences(text).slice(0, count).join(" ");
}
function voiceFor({ style, language } = {}) {
  return bankFor(language, style);
}

// Joins the pieces of a scene with whatever separates sentences in this
// language, dropping any that came out empty.
function sentences(v, ...parts) {
  // Trimmed before joining: the English phrases carry a leading space each
  // (they used to be concatenated directly), and joining those with another
  // separator leaves double spaces that a TTS voice pauses on.
  return parts
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(v.separator)
    .trim();
}

const WRITERS = {
  intro(brief, options = {}) {
    const v = voiceFor(options);
    return sentences(v, v.intro(brief.name, brief.roles), brief.tagline);
  },

  about(brief, options = {}) {
    const v = voiceFor(options);
    const summary = firstSentences(brief.bio, 2);
    const philosophy = brief.philosophy ? `${v.philosophyLead}${v.philosophyLead ? v.separator : ""}${brief.philosophy}` : "";
    return sentences(v, summary, philosophy);
  },

  skills(brief, options = {}) {
    const v = voiceFor(options);
    const names = v.join(brief.topSkills, 6);
    if (!names) return "";
    const learning = brief.learning?.length ? v.learning(v.join(brief.learning, 3)) : "";
    return sentences(v, v.skills(names), learning);
  },

  experience(brief, options = {}) {
    const v = voiceFor(options);
    const lines = brief.items.map((item) =>
      sentences(v, v.role(item.company, item.role, v.duration(item.duration)), firstSentences(item.description, 1))
    );
    return lines.filter(Boolean).join(v.separator || " ");
  },

  project(brief, options = {}) {
    const v = voiceFor(options);
    const desc = brief.shortDesc || firstSentences(brief.fullDesc, 1);
    const tech = brief.tech?.length ? v.tech(v.join(brief.tech, 4)) : "";
    const metrics = brief.metrics ? v.metrics(brief.metrics) : "";
    return sentences(v, v.project(brief.name, desc), tech, metrics);
  },

  education(brief, options = {}) {
    const v = voiceFor(options);
    const degrees = (brief.degrees || []).map(v.degreeItem);
    const certs = (brief.certifications || []).map(v.certItem);
    return sentences(
      v,
      degrees.length ? v.degrees(degrees.join(", ")) : "",
      certs.length ? v.certs(v.join(certs, 3)) : ""
    );
  },

  achievements(brief, options = {}) {
    const v = voiceFor(options);
    const items = (brief.awards || []).map(v.awardItem);
    if (!items.length) return "";
    return v.awards(v.join(items, 3));
  },

  testimonial(brief, options = {}) {
    const v = voiceFor(options);
    if (!brief.quote) return "";
    return v.quote(brief.quote, v.who(brief));
  },

  closing(brief, options = {}) {
    const v = voiceFor(options);
    const contact = brief.email ? v.contact(brief.email) : "";
    return sentences(v, v.cta(options.audience || "general"), contact, v.signOff);
  },

  default(brief) {
    return brief.text || "";
  },
};
