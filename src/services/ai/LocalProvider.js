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

function capWords(text, maxWords) {
  if (!maxWords) return text;
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ").replace(/[,;:]$/, "") + ".";
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

const OPENERS = {
  professional: "Hi, I'm",
  creative: "Hey there, I'm",
  minimal: "I'm",
  storytelling: "My name is",
};

const WRITERS = {
  intro(brief, { style = "professional", tone = "professional" } = {}) {
    const opener = OPENERS[style] || OPENERS.professional;
    const role = brief.roles ? `, ${brief.roles}` : "";
    const tagline = brief.tagline ? ` ${brief.tagline}` : "";
    const excited = tone === "energetic" ? "!" : ".";
    return `${opener} ${brief.name}${role}${excited}${tagline}`.trim();
  },

  about(brief) {
    const summary = firstSentences(brief.bio, 2);
    const philosophy = brief.philosophy ? ` My approach: ${brief.philosophy}` : "";
    return `${summary}${philosophy}`.trim();
  },

  skills(brief) {
    const names = joinList(brief.topSkills, 6);
    const learning = brief.learning?.length ? ` I'm currently deepening my skills in ${joinList(brief.learning, 3)}.` : "";
    return `My core toolkit includes ${names}.${learning}`;
  },

  experience(brief) {
    const lines = brief.items.map((item) => {
      const highlight = firstSentences(item.description, 1);
      const loc = item.duration ? ` (${item.duration})` : "";
      return `At ${item.company}, I served as ${item.role}${loc}.${highlight ? " " + highlight : ""}`;
    });
    return lines.join(" ");
  },

  project(brief) {
    const desc = brief.shortDesc || firstSentences(brief.fullDesc, 1);
    const tech = brief.tech?.length ? ` Built with ${joinList(brief.tech, 4)}.` : "";
    const metrics = brief.metrics ? ` ${brief.metrics}.` : "";
    return `One project I'm proud of is ${brief.name} — ${desc}${tech}${metrics}`;
  },

  education(brief) {
    const degrees = (brief.degrees || []).map((d) => `${d.degree} from ${d.institution}${d.year ? ` (${d.year})` : ""}`);
    const certs = (brief.certifications || []).map((c) => `${c.name}${c.issuer ? ` from ${c.issuer}` : ""}`);
    const parts = [];
    if (degrees.length) parts.push(degrees.join(", "));
    if (certs.length) parts.push(`I'm also certified in ${joinList(certs, 3)}`);
    return parts.join(". ") + ".";
  },

  achievements(brief) {
    const items = (brief.awards || []).map((a) => `${a.name}${a.issuer ? ` from ${a.issuer}` : ""}${a.year ? ` (${a.year})` : ""}`);
    return `Along the way, I've earned ${joinList(items, 3)}.`;
  },

  testimonial(brief) {
    return `"${brief.quote}" — ${brief.name}${brief.role ? `, ${brief.role}` : ""}${brief.company ? ` at ${brief.company}` : ""}.`;
  },

  closing(brief, { audience = "general" } = {}) {
    const cta = CLOSING_CTA[audience] || CLOSING_CTA.general;
    const contact = brief.email ? ` Reach me at ${brief.email}.` : "";
    return `${cta}${contact} Thanks for watching.`;
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
