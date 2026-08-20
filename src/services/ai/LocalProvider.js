import { AIProvider } from "./AIProvider.js";

// Zero-cost, zero-setup script writer. Runs entirely in the browser with no
// network call and no API key, so the AI Video feature always works even if
// no cloud provider is configured. Only English phrasing is supported —
// other languages fall back to this text with a warning shown in the UI.
export class LocalProvider extends AIProvider {
  get name() {
    return "Basic (offline)";
  }

  async writeScript(brief, sceneType, options = {}) {
    const writer = WRITERS[sceneType] || WRITERS.default;
    let text = writer(brief, options);
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
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const kept = [];
  let used = 0;
  for (const sentence of sentences) {
    const count = sentence.split(/\s+/).filter(Boolean).length;
    if (used + count > maxWords) break;
    kept.push(sentence);
    used += count;
  }
  // Keeping at least half the budget means the trim still says something
  // useful; otherwise a single long sentence would collapse to nothing.
  if (kept.length && used >= maxWords * 0.5) return kept.join(" ").trim();

  // No whole sentence fits — cut at the last clause break instead, so the
  // line ends somewhere a reader (and a voice) can breathe.
  const slice = words.slice(0, maxWords).join(" ");
  const clauseEnd = Math.max(slice.lastIndexOf(", "), slice.lastIndexOf("; "), slice.lastIndexOf(" — "));
  const base = clauseEnd > slice.length * 0.5 ? slice.slice(0, clauseEnd) : slice;
  return base.replace(/[,;:\s—-]+$/, "") + ".";
}

function firstSentences(text, count = 2) {
  const sentences = (text || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, count).join(" ");
}

function joinList(items, max = 4) {
  const list = items.filter(Boolean).slice(0, max);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

// Each style gets its own phrasing for the connective tissue of the script.
// This used to be a single OPENERS map that only swapped the intro's first
// two words (and a `tone` option that only decided whether the intro ended
// in "!"), which meant both controls were essentially decorative — every
// other line read identically no matter what you picked. These phrase banks
// make the chosen style audible in every scene, which is what the control
// claims to do. Facts still come only from the portfolio; style changes the
// wording around them, never the content.
const VOICE = {
  professional: {
    intro: (name, roles) => `Hi, I'm ${name}${roles ? `, ${roles}` : ""}.`,
    philosophyLead: " My approach:",
    skills: (list) => `My core toolkit includes ${list}.`,
    learning: (list) => ` I'm currently deepening my skills in ${list}.`,
    role: (company, role, duration) => `At ${company}, I served as ${role}${duration}.`,
    project: (name, desc) => `One project I'm proud of is ${name} — ${desc}`,
    tech: (list) => ` Built with ${list}.`,
    degrees: (list) => `I hold ${list}.`,
    certs: (list) => `I'm also certified in ${list}.`,
    awards: (list) => `Along the way, I've earned ${list}.`,
    quote: (quote, who) => `"${quote}" — ${who}.`,
    signOff: "Thanks for watching.",
  },
  creative: {
    intro: (name, roles) => `Hey there — I'm ${name}${roles ? `, ${roles}` : ""}!`,
    philosophyLead: " The way I see it —",
    skills: (list) => `I build with ${list}.`,
    learning: (list) => ` Right now I'm going deeper on ${list}.`,
    role: (company, role, duration) => `${role} at ${company}${duration}.`,
    project: (name, desc) => `Take ${name} — ${desc}`,
    tech: (list) => ` Built with ${list}.`,
    degrees: (list) => `Studied ${list}.`,
    certs: (list) => `Plus certifications in ${list}.`,
    awards: (list) => `Picked up ${list} along the way.`,
    quote: (quote, who) => `"${quote}" — ${who}.`,
    signOff: "Thanks for watching!",
  },
  minimal: {
    intro: (name, roles) => `${name}.${roles ? ` ${roles}.` : ""}`,
    philosophyLead: "",
    skills: (list) => `${list}.`,
    learning: (list) => ` Currently learning ${list}.`,
    role: (company, role, duration) => `${role}, ${company}${duration}.`,
    project: (name, desc) => `${name} — ${desc}`,
    tech: (list) => ` ${list}.`,
    degrees: (list) => `${list}.`,
    certs: (list) => `Certified in ${list}.`,
    awards: (list) => `${list}.`,
    quote: (quote, who) => `"${quote}" — ${who}.`,
    signOff: "Thanks for watching.",
  },
  storytelling: {
    intro: (name, roles) => `My name is ${name}${roles ? `, and I work as ${roles}` : ""}.`,
    philosophyLead: " What I've come to believe:",
    skills: (list) => `Over time, my toolkit grew to include ${list}.`,
    learning: (list) => ` These days I'm learning ${list}.`,
    role: (company, role, duration) => `My time at ${company} as ${role}${duration} shaped how I work.`,
    project: (name, desc) => `Then came ${name} — ${desc}`,
    tech: (list) => ` It was built with ${list}.`,
    degrees: (list) => `It started with ${list}.`,
    certs: (list) => `Later I added certifications in ${list}.`,
    awards: (list) => `Along the way came ${list}.`,
    quote: (quote, who) => `As ${who} put it: "${quote}"`,
    signOff: "Thanks for watching.",
  },
};

function voiceFor(style) {
  return VOICE[style] || VOICE.professional;
}

const WRITERS = {
  intro(brief, { style } = {}) {
    const v = voiceFor(style);
    const tagline = brief.tagline ? ` ${brief.tagline}` : "";
    return `${v.intro(brief.name, brief.roles)}${tagline}`.trim();
  },

  about(brief, { style } = {}) {
    const v = voiceFor(style);
    const summary = firstSentences(brief.bio, 2);
    const philosophy = brief.philosophy ? `${v.philosophyLead} ${brief.philosophy}`.trim() : "";
    return `${summary}${philosophy ? ` ${philosophy}` : ""}`.trim();
  },

  skills(brief, { style } = {}) {
    const v = voiceFor(style);
    const names = joinList(brief.topSkills, 6);
    if (!names) return "";
    const learning = brief.learning?.length ? v.learning(joinList(brief.learning, 3)) : "";
    return `${v.skills(names)}${learning}`;
  },

  experience(brief, { style } = {}) {
    const v = voiceFor(style);
    const lines = brief.items.map((item) => {
      const highlight = firstSentences(item.description, 1);
      const duration = item.duration ? ` (${item.duration})` : "";
      return `${v.role(item.company, item.role, duration)}${highlight ? " " + highlight : ""}`;
    });
    return lines.join(" ");
  },

  project(brief, { style } = {}) {
    const v = voiceFor(style);
    const desc = brief.shortDesc || firstSentences(brief.fullDesc, 1);
    const tech = brief.tech?.length ? v.tech(joinList(brief.tech, 4)) : "";
    const metrics = brief.metrics ? ` ${brief.metrics}.` : "";
    return `${v.project(brief.name, desc)}${tech}${metrics}`;
  },

  education(brief, { style } = {}) {
    const v = voiceFor(style);
    const degrees = (brief.degrees || []).map((d) => `${d.degree} from ${d.institution}${d.year ? ` (${d.year})` : ""}`);
    const certs = (brief.certifications || []).map((c) => `${c.name}${c.issuer ? ` from ${c.issuer}` : ""}`);
    const parts = [];
    if (degrees.length) parts.push(v.degrees(degrees.join(", ")));
    if (certs.length) parts.push(v.certs(joinList(certs, 3)));
    return parts.join(" ").trim();
  },

  achievements(brief, { style } = {}) {
    const v = voiceFor(style);
    const items = (brief.awards || []).map((a) => `${a.name}${a.issuer ? ` from ${a.issuer}` : ""}${a.year ? ` (${a.year})` : ""}`);
    if (!items.length) return "";
    return v.awards(joinList(items, 3));
  },

  testimonial(brief, { style } = {}) {
    const v = voiceFor(style);
    if (!brief.quote) return "";
    const who = `${brief.name}${brief.role ? `, ${brief.role}` : ""}${brief.company ? ` at ${brief.company}` : ""}`;
    return v.quote(brief.quote, who);
  },

  closing(brief, { style, audience = "general" } = {}) {
    const v = voiceFor(style);
    const cta = CLOSING_CTA[audience] || CLOSING_CTA.general;
    const contact = brief.email ? ` Reach me at ${brief.email}.` : "";
    return `${cta}${contact} ${v.signOff}`;
  },

  default(brief) {
    return brief.text || "";
  },
};
const CLOSING_CTA = {
  general: "I'm always open to interesting conversations and new opportunities.",
  recruiter: "I'm actively open to new roles — let's talk about how I can contribute to your team.",
  "job-application": "I'd love the opportunity to bring these skills to your team.",
  client: "If you have a project in mind, I'd love to help you bring it to life.",
  freelancer: "I'm currently taking on new freelance projects — let's build something great together.",
  "personal-branding": "Thanks for getting to know me a little better.",
  linkedin: "Let's connect — I'm always happy to grow my network with people building interesting things.",
};
