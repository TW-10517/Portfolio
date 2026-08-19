import { uid } from "../utils/uid.js";

export const FONT_OPTIONS = [
  "Space Grotesk",
  "Syne",
  "Inter",
  "Poppins",
  "DM Sans",
  "Plus Jakarta Sans",
  "Sora",
  "Manrope",
];

export const PALETTES = [
  { name: "Cyan / Violet", primary: "#00c9ff", secondary: "#7b61ff" },
  { name: "Sunset", primary: "#ff6b6b", secondary: "#ffb703" },
  { name: "Emerald", primary: "#34d399", secondary: "#06b6d4" },
  { name: "Magenta", primary: "#ec4899", secondary: "#8b5cf6" },
  { name: "Amber", primary: "#f59e0b", secondary: "#ef4444" },
  { name: "Ocean", primary: "#0ea5e9", secondary: "#22d3ee" },
  { name: "Berry", primary: "#a855f7", secondary: "#f43f5e" },
  { name: "Forest", primary: "#22c55e", secondary: "#84cc16" },
];

export function createDefaultPortfolio() {
  return {
    profile: {
      name: "Alex Rivera",
      roles: "Software Engineer, Creative Developer, Data Enthusiast",
      tagline: "Crafting digital experiences that think, move, and feel alive.",
      photo: "https://placehold.co/500x500/12141f/00c9ff?text=Alex",
      location: "San Francisco, CA",
      email: "hello@alexrivera.dev",
      phone: "+1 (555) 012-3456",
      social: {
        linkedin: "",
        github: "",
        twitter: "",
        website: "",
        dribbble: "",
        behance: "",
        youtube: "",
      },
      resumeUrl: "",
    },
    about: {
      bio: "I'm a software engineer and creative developer based in San Francisco, with six years of experience turning ambiguous problems into products people enjoy using.\n\nWhat keeps me going is the small, satisfying click of watching a system come together — from a messy idea to something real people rely on.",
      hobbies: ["Music", "Fitness", "Reading", "Travel", "Gaming"],
      funFacts: ["Brewed 1,000+ cups of coffee while coding", "Visited 14 countries", "122 WPM typing speed"],
      philosophy: "Clarity over cleverness. Build with, not for. Stay a beginner.",
    },
    skills: {
      categories: [
        {
          id: uid(),
          name: "Languages",
          skills: [
            { id: uid(), name: "Python", level: 90 },
            { id: uid(), name: "JavaScript / TypeScript", level: 88 },
            { id: uid(), name: "SQL", level: 85 },
          ],
        },
        {
          id: uid(),
          name: "Frameworks",
          skills: [
            { id: uid(), name: "React / Next.js", level: 85 },
            { id: uid(), name: "Django", level: 80 },
            { id: uid(), name: "Node.js", level: 78 },
          ],
        },
        {
          id: uid(),
          name: "Tools",
          skills: [
            { id: uid(), name: "Git", level: 95 },
            { id: uid(), name: "Docker", level: 75 },
            { id: uid(), name: "AWS", level: 70 },
          ],
        },
      ],
      learning: ["Rust", "WebGL / Three.js", "Kubernetes"],
    },
    experience: [
      {
        id: uid(),
        company: "Nimbus Labs",
        role: "Senior Software Engineer",
        duration: "2023 — Present",
        location: "San Francisco, CA (Hybrid)",
        description: "Led the rebuild of the core analytics dashboard, cutting load time by 4x.\nDesigned a real-time event pipeline handling 2M+ events/day.\nMentored 4 junior engineers.",
        tech: ["React", "Node.js", "AWS", "PostgreSQL"],
        logo: "",
      },
      {
        id: uid(),
        company: "Orbitfy",
        role: "Software Engineer",
        duration: "2020 — 2023",
        location: "Remote",
        description: "Built and shipped a mobile app from prototype to 50k+ downloads.\nOwned the checkout flow rewrite, reducing cart abandonment by 18%.",
        tech: ["React Native", "Firebase", "GraphQL"],
        logo: "",
      },
    ],
    projects: [
      {
        id: uid(),
        name: "Nimbus Analytics",
        category: "Web App",
        shortDesc: "Real-time data dashboards for growth teams.",
        fullDesc: "A live analytics dashboard on top of a streaming event pipeline, with sub-second updates and custom cohort builders.",
        tech: ["React", "Node.js", "D3.js"],
        images: ["https://placehold.co/900x650/12141f/00c9ff?text=Nimbus+Analytics"],
        demoUrl: "",
        repoUrl: "",
        features: ["Real-time cohort analysis", "Custom funnel builder", "Exportable reports"],
        metrics: "Cut median dashboard load time from 4.2s to 0.9s",
      },
      {
        id: uid(),
        name: "Pulse Fitness App",
        category: "Mobile",
        shortDesc: "Cross-platform fitness tracker with social challenges.",
        fullDesc: "A social-first fitness experience with friend challenges and streak mechanics, boosting 30-day retention by 34%.",
        tech: ["React Native", "Firebase"],
        images: ["https://placehold.co/900x650/12141f/7b61ff?text=Pulse+Fitness"],
        demoUrl: "",
        repoUrl: "",
        features: ["Friend challenges", "Adaptive workout plans", "Offline-first sync"],
        metrics: "50k+ downloads, 34% retention lift",
      },
    ],
    education: {
      degrees: [
        { id: uid(), degree: "B.S. in Computer Science", institution: "UC Berkeley", year: "2014 — 2018", achievements: "Thesis on real-time anomaly detection." },
      ],
      certifications: [
        { id: uid(), name: "AWS Certified Solutions Architect", issuer: "Amazon Web Services", year: "2023", url: "", badge: "" },
      ],
      awards: [
        { id: uid(), name: "Hackathon Winner", issuer: "TechCrunch Disrupt SF", year: "2022" },
      ],
    },
    testimonials: [
      {
        id: uid(),
        quote: "Alex has one of the rare combinations of deep technical skill and genuine product sense.",
        name: "Sarah Mitchell",
        role: "VP of Engineering",
        company: "Nimbus Labs",
        photo: "https://placehold.co/150x150/181b29/00c9ff?text=SM",
        rating: 5,
      },
    ],
    blog: {
      enabled: true,
      posts: [
        {
          id: uid(),
          title: "Designing APIs that scale with your team",
          excerpt: "Lessons from three years of iterating on internal API contracts.",
          date: "2026-08-12",
          category: "Engineering",
          url: "#",
          thumbnail: "https://placehold.co/600x340/181b29/00c9ff?text=Blog",
        },
      ],
    },
    contact: {
      showEmail: true,
      showPhone: true,
      showLocation: true,
      showSocial: true,
      calendlyUrl: "",
      faqs: [
        { id: uid(), q: "What kind of projects do you take on?", a: "Mostly full-stack web products and data tooling." },
      ],
      formEnabled: true,
      formMethod: "display",
    },
    theme: {
      primary: "#00c9ff",
      secondary: "#7b61ff",
      mode: "dark",
      headingFont: "Space Grotesk",
      bodyFont: "Inter",
      heroStyle: "centered",
      projectLayout: "grid",
      experienceLayout: "timeline",
      animationLevel: "full",
      customCss: "",
    },
    meta: {
      slug: "alex-rivera",
      visibility: "public",
      views: 0,
    },
  };
}
