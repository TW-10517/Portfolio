// Turns portfolio data + user config into a deterministic scene plan.
// This step never touches AI — it only decides WHICH real facts go into the
// video and how much narration budget (word count) each scene gets. The AI
// step (see aiWriter.js) only phrases the facts this file selects.

export const LENGTH_OPTIONS = {
  short: { label: "Short (30–45s)", targetSeconds: 38, maxScenes: 5 },
  standard: { label: "Standard (60–90s)", targetSeconds: 75, maxScenes: 7 },
  detailed: { label: "Detailed (2–3 min)", targetSeconds: 150, maxScenes: 10 },
};

export const AUDIENCE_OPTIONS = [
  { value: "general", label: "General Portfolio" },
  { value: "recruiter", label: "Recruiter" },
  { value: "job-application", label: "Job Application" },
  { value: "client", label: "Client" },
  { value: "freelancer", label: "Freelancer" },
  { value: "personal-branding", label: "Personal Branding" },
  { value: "linkedin", label: "LinkedIn" },
];

export const STYLE_OPTIONS = [
  { value: "professional", label: "Professional", hint: "Job applications, recruiters, LinkedIn" },
  { value: "creative", label: "Creative", hint: "Developers, designers, creators" },
  { value: "minimal", label: "Minimal", hint: "Clean typography, simple transitions" },
  { value: "storytelling", label: "Storytelling", hint: "A career story, not a list of facts" },
];

// scene type -> relative weight per audience (higher = more time/emphasis)
const AUDIENCE_WEIGHTS = {
  general: { about: 1, skills: 1, experience: 1, project: 1, education: 0.8, achievements: 0.7, testimonial: 0.6 },
  recruiter: { about: 0.7, skills: 1.1, experience: 1.4, project: 1.1, education: 0.8, achievements: 0.9, testimonial: 0.6 },
  "job-application": { about: 0.8, skills: 1.1, experience: 1.3, project: 1.1, education: 0.9, achievements: 0.8, testimonial: 0.6 },
  client: { about: 1.1, skills: 0.7, experience: 0.8, project: 1.5, education: 0.4, achievements: 0.6, testimonial: 1.1 },
  freelancer: { about: 1, skills: 0.8, experience: 0.8, project: 1.5, education: 0.4, achievements: 0.6, testimonial: 1.1 },
  "personal-branding": { about: 1.3, skills: 0.9, experience: 0.8, project: 1.1, education: 0.5, achievements: 0.7, testimonial: 0.7 },
  linkedin: { about: 0.8, skills: 1, experience: 1.3, project: 1, education: 0.7, achievements: 0.9, testimonial: 0.6 },
};

const MIN_SCENE_SECONDS = 5;
const MAX_SCENE_SECONDS = 22;
const WORDS_PER_SECOND = 2.3; // ~140 wpm, a natural narration pace

export function wordsForSeconds(seconds) {
  return Math.max(6, Math.round(seconds * WORDS_PER_SECOND));
}

export function secondsForWords(words) {
  return words / WORDS_PER_SECOND;
}

function pickTopProjects(projects, count, customInstruction) {
  if (!projects?.length) return [];
  const keywords = (customInstruction || "")
    .toLowerCase()
    .split(/[^a-z0-9+.#]+/)
    .filter((w) => w.length > 2);

  const scored = projects.map((p, index) => {
    const haystack = `${p.name} ${p.category} ${p.shortDesc} ${(p.tech || []).join(" ")}`.toLowerCase();
    const matches = keywords.filter((k) => haystack.includes(k)).length;
    return { project: p, score: matches * 10 - index }; // matches win, otherwise keep original (recency) order
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((s) => s.project);
}

// sections: a Set/array of enabled scene "kinds" — subset of
// ['about','skills','experience','projects','education','achievements','testimonial']
// intro and closing are always included.
export function buildScenePlan(data, config) {
  const { length = "standard", audience = "general", sections = DEFAULT_SECTIONS, customInstruction = "" } = config;
  const lengthCfg = LENGTH_OPTIONS[length] || LENGTH_OPTIONS.standard;
  const weights = AUDIENCE_WEIGHTS[audience] || AUDIENCE_WEIGHTS.general;
  const enabled = new Set(sections);

  const candidates = [];

  if (enabled.has("about") && data.about?.bio) {
    candidates.push({ type: "about", title: "About", weight: weights.about, brief: buildBrief("about", data) });
  }
  if (enabled.has("skills") && flattenSkills(data.skills).length) {
    candidates.push({ type: "skills", title: "Skills", weight: weights.skills, brief: buildBrief("skills", data) });
  }
  if (enabled.has("experience") && data.experience?.length) {
    candidates.push({ type: "experience", title: "Experience", weight: weights.experience, brief: buildBrief("experience", data) });
  }
  if (enabled.has("projects") && data.projects?.length) {
    const maxProjects = length === "short" ? 1 : length === "standard" ? 2 : 3;
    const top = pickTopProjects(data.projects, maxProjects, customInstruction);
    top.forEach((project) => {
      candidates.push({
        type: "project",
        title: project.name,
        weight: weights.project,
        projectId: project.id,
        brief: buildBrief("project", data, { project }),
      });
    });
  }
  if (enabled.has("education") && (data.education?.degrees?.length || data.education?.certifications?.length)) {
    candidates.push({ type: "education", title: "Education", weight: weights.education, brief: buildBrief("education", data) });
  }
  if (enabled.has("achievements") && data.education?.awards?.length) {
    candidates.push({ type: "achievements", title: "Achievements", weight: weights.achievements, brief: buildBrief("achievements", data) });
  }
  if (enabled.has("testimonial") && data.testimonials?.length) {
    candidates.push({ type: "testimonial", title: "What people say", weight: weights.testimonial, brief: buildBrief("testimonial", data) });
  }

  // Trim to the scene budget for this length, keeping highest-weight scenes,
  // then restore original (source) order for a natural narrative flow.
  const budget = Math.max(0, lengthCfg.maxScenes - 2); // reserve intro + closing
  const trimmed = [...candidates]
    .map((s, index) => ({ ...s, _index: index }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, budget)
    .sort((a, b) => a._index - b._index)
    .map(({ _index, ...s }) => s);

  const introSeconds = Math.max(6, Math.round(lengthCfg.targetSeconds * 0.12));
  const closingSeconds = Math.max(6, Math.round(lengthCfg.targetSeconds * 0.1));
  const remaining = Math.max(trimmed.length * MIN_SCENE_SECONDS, lengthCfg.targetSeconds - introSeconds - closingSeconds);
  const weightSum = trimmed.reduce((sum, s) => sum + s.weight, 0) || 1;

  const scenes = [
    { id: "intro", type: "intro", title: "Intro", brief: buildBrief("intro", data), maxWords: wordsForSeconds(introSeconds) },
    ...trimmed.map((s, i) => {
      const seconds = clamp((s.weight / weightSum) * remaining, MIN_SCENE_SECONDS, MAX_SCENE_SECONDS);
      return { id: `${s.type}-${s.projectId || i}`, type: s.type, title: s.title, projectId: s.projectId, brief: s.brief, maxWords: wordsForSeconds(seconds) };
    }),
    { id: "closing", type: "closing", title: "Closing", brief: buildBrief("closing", data), maxWords: wordsForSeconds(closingSeconds) },
  ];

  return { length, audience, targetSeconds: lengthCfg.targetSeconds, scenes };
}

export const DEFAULT_SECTIONS = ["about", "skills", "experience", "projects", "education", "achievements"];
export const ALL_SECTIONS = [...DEFAULT_SECTIONS, "testimonial"];

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function flattenSkills(skills) {
  return (skills?.categories || []).flatMap((c) => c.skills || []);
}

// Pulls ONLY real fields from portfolio data for one scene type — this is
// the boundary that guarantees the AI can't invent facts.
function buildBrief(sceneType, data, extra = {}) {
  switch (sceneType) {
    case "intro":
      return {
        name: data.profile?.name || "",
        roles: data.profile?.roles || "",
        tagline: data.profile?.tagline || "",
        location: data.profile?.location || "",
      };
    case "about":
      return { bio: data.about?.bio || "", philosophy: data.about?.philosophy || "" };
    case "skills": {
      const flat = flattenSkills(data.skills);
      const topSkills = [...flat].sort((a, b) => (b.level || 0) - (a.level || 0)).map((s) => s.name);
      return { topSkills, learning: data.skills?.learning || [] };
    }
    case "experience":
      return {
        items: (data.experience || []).slice(0, 2).map((e) => ({
          company: e.company,
          role: e.role,
          duration: e.duration,
          description: e.description || "",
        })),
      };
    case "project": {
      const p = extra.project;
      return { name: p.name, shortDesc: p.shortDesc, fullDesc: p.fullDesc, tech: p.tech || [], metrics: p.metrics || "" };
    }
    case "education":
      return { degrees: data.education?.degrees || [], certifications: data.education?.certifications || [] };
    case "achievements":
      return { awards: data.education?.awards || [] };
    case "testimonial": {
      const t = data.testimonials?.[0];
      return t ? { quote: t.quote, name: t.name, role: t.role, company: t.company } : {};
    }
    case "closing":
      return { name: data.profile?.name || "", email: data.contact?.showEmail ? data.profile?.email : "" };
    default:
      return {};
  }
}
