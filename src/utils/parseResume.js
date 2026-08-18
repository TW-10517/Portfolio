import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { SKILL_KEYWORDS } from "../data/skillKeywords.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SECTION_HEADERS = {
  experience: /^(work\s+)?(experience|employment(\s+history)?|professional\s+experience)$/i,
  education: /^education$/i,
  skills: /^(technical\s+)?skills$/i,
  projects: /^projects?$/i,
  other: /^(certifications?|awards?|publications?|references?|summary|objective|interests?)$/i,
};

const DATE_RANGE = new RegExp(
  "((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+\\d{4}|\\d{4})" +
    "\\s*(?:-|–|—|to)\\s*" +
    "((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+\\d{4}|\\d{4}|present|current)",
  "i"
);

const DEGREE_KEYWORDS = /\b(bachelor|master|associate|ph\.?d|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|mba|b\.?tech|m\.?tech)\b/i;
const INSTITUTION_KEYWORDS = /\b(university|college|institute|school|academy)\b/i;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract page text as an array of lines, each tagged with its max font size and vertical position. */
export async function extractPdfLines(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({
        text: it.str,
        x: it.transform[4],
        y: it.transform[5],
        fontSize: Math.hypot(it.transform[0], it.transform[1]),
      }));

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    let currentLine = null;
    for (const it of items) {
      if (currentLine && Math.abs(currentLine.y - it.y) < 3) {
        currentLine.text += (currentLine.text.endsWith(" ") ? "" : " ") + it.text;
        currentLine.fontSize = Math.max(currentLine.fontSize, it.fontSize);
      } else {
        currentLine = { text: it.text, y: it.y, fontSize: it.fontSize, page: pageNum };
        allLines.push(currentLine);
      }
    }
  }

  return allLines
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }))
    .filter((l) => l.text.length > 0);
}

function guessName(lines) {
  const topLines = lines.filter((l) => l.page === 1).slice(0, 12);
  if (!topLines.length) return "";
  const maxFont = Math.max(...topLines.map((l) => l.fontSize));
  const candidates = topLines.filter(
    (l) =>
      l.fontSize >= maxFont - 0.5 &&
      /^[A-Za-z][A-Za-z.'-]*(\s+[A-Za-z][A-Za-z.'-]*){1,3}$/.test(l.text) &&
      !/@|\d{3}/.test(l.text)
  );
  return (candidates[0] || topLines[0])?.text || "";
}

function guessLocation(lines, excludeTexts) {
  const topLines = lines.filter((l) => l.page === 1).slice(0, 15);
  const pattern = /^[A-Z][a-zA-Z.\s]+,\s?[A-Z][a-zA-Z.\s]{1,20}$/;
  for (const l of topLines) {
    if (excludeTexts.has(l.text)) continue;
    if (pattern.test(l.text) && l.text.length < 40) return l.text;
  }
  return "";
}

function findSection(lines, matcher) {
  const startIdx = lines.findIndex((l) => matcher.test(l.text.trim()));
  if (startIdx === -1) return [];
  const allHeaderPatterns = Object.values(SECTION_HEADERS);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (allHeaderPatterns.some((re) => re.test(lines[i].text.trim()))) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx + 1, endIdx);
}

function parseExperienceEntries(sectionLines) {
  const entries = [];
  let current = null;

  for (const line of sectionLines) {
    const dateMatch = line.text.match(DATE_RANGE);
    if (dateMatch) {
      if (current) entries.push(current);
      const header = line.text.replace(dateMatch[0], "").replace(/[|,–—-]+$/, "").trim();
      current = {
        duration: dateMatch[0],
        header: header || (entries.length ? "" : ""),
        description: [],
      };
    } else if (current) {
      if (!current.header && line.text.length < 80) {
        current.header = line.text;
      } else {
        current.description.push(line.text);
      }
    }
  }
  if (current) entries.push(current);

  return entries.slice(0, 6).map((e) => {
    const parts = e.header.split(/\s+(?:at|@|[-|–—])\s+/i);
    return {
      role: parts[0]?.trim() || e.header || "Role",
      company: parts[1]?.trim() || "",
      duration: e.duration,
      description: e.description.join("\n").slice(0, 500),
    };
  });
}

function parseEducationEntries(sectionLines) {
  const entries = [];
  let current = null;
  for (const line of sectionLines) {
    const isDegree = DEGREE_KEYWORDS.test(line.text);
    const isInstitution = INSTITUTION_KEYWORDS.test(line.text);
    const dateMatch = line.text.match(/\b(19|20)\d{2}\b/);
    if (isDegree || isInstitution) {
      if (!current || (isDegree && current.degree)) {
        current = { degree: "", institution: "", year: "" };
        entries.push(current);
      }
      if (isDegree && !current.degree) current.degree = line.text;
      if (isInstitution && !current.institution) current.institution = line.text;
    }
    if (dateMatch && current && !current.year) current.year = dateMatch[0];
  }
  return entries.slice(0, 4);
}

function findSkills(fullText) {
  const found = [];
  for (const kw of SKILL_KEYWORDS) {
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(kw)}(?![A-Za-z0-9])`, "i");
    if (re.test(fullText)) found.push(kw);
  }
  return found.slice(0, 24);
}

export function parseResumeFields(lines) {
  const fullText = lines.map((l) => l.text).join("\n");

  const emailMatch = fullText.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = fullText.match(/(\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
  const linkedinMatch = fullText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i);
  const githubMatch = fullText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i);
  const websiteMatch = fullText.match(/https?:\/\/(?!.*(?:linkedin|github)\.com)[^\s,)]+/i);

  const name = guessName(lines);
  const excludeForLocation = new Set([name, emailMatch?.[0], phoneMatch?.[0]].filter(Boolean));
  const location = guessLocation(lines, excludeForLocation);

  const experienceLines = findSection(lines, SECTION_HEADERS.experience);
  const educationLines = findSection(lines, SECTION_HEADERS.education);

  return {
    name,
    email: emailMatch?.[0] || "",
    phone: phoneMatch?.[0] || "",
    location,
    linkedin: linkedinMatch ? "https://" + linkedinMatch[0].replace(/^https?:\/\//i, "") : "",
    github: githubMatch ? "https://" + githubMatch[0].replace(/^https?:\/\//i, "") : "",
    website: websiteMatch?.[0] || "",
    skills: findSkills(fullText),
    experience: parseExperienceEntries(experienceLines),
    education: parseEducationEntries(educationLines),
  };
}

export async function parseResumeFile(file) {
  const lines = await extractPdfLines(file);
  return parseResumeFields(lines);
}
