// Phrasing banks for the offline script writer, one per language it offers.
//
// The offline writer used to be English-only: choosing Japanese or Tamil left
// the script in English and put a warning in the UI telling you to go and
// install a local model. Since the language menu only ever offered three
// options, writing the connective tissue for all three is a smaller job than
// the warning made it sound — and it means the zero-setup path works in every
// language the app advertises.
//
// What is NOT translated: the portfolio's own content. Names, companies, job
// titles, skills, and quotes are reproduced exactly as the author wrote them.
// The writer supplies the sentence around them and nothing else, which is the
// same rule that stops it inventing facts.
//
// Each bank exposes the same shape, so the writers below stay language-blind:
// a `join` for lists, item formatters for the things that are assembled out of
// several fields, and one phrase per scene type per style.

const LANGUAGE_CODES = { English: "en", Japanese: "ja", Tamil: "ta" };

export function languageCode(label) {
  return LANGUAGE_CODES[label] || "en";
}

// ---------------------------------------------------------------- English --

const joinEn = (items, max = 4) => {
  const list = items.filter(Boolean).slice(0, max);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
};

const EN_ITEMS = {
  join: joinEn,
  duration: (d) => (d ? ` (${d})` : ""),
  degreeItem: (d) => `${d.degree} from ${d.institution}${d.year ? ` (${d.year})` : ""}`,
  certItem: (c) => `${c.name}${c.issuer ? ` from ${c.issuer}` : ""}`,
  awardItem: (a) => `${a.name}${a.issuer ? ` from ${a.issuer}` : ""}${a.year ? ` (${a.year})` : ""}`,
  who: (b) => `${b.name}${b.role ? `, ${b.role}` : ""}${b.company ? ` at ${b.company}` : ""}`,
  contact: (email) => ` Reach me at ${email}.`,
  metrics: (m) => ` ${m}.`,
};

const EN_CTA = {
  general: "I'm always open to interesting conversations and new opportunities.",
  recruiter: "I'm actively open to new roles — let's talk about how I can contribute to your team.",
  "job-application": "I'd love the opportunity to bring these skills to your team.",
  client: "If you have a project in mind, I'd love to help you bring it to life.",
  freelancer: "I'm currently taking on new freelance projects — let's build something great together.",
  "personal-branding": "Thanks for getting to know me a little better.",
  linkedin: "Let's connect — I'm always happy to grow my network with people building interesting things.",
};

const EN_STYLES = {
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

// --------------------------------------------------------------- Japanese --

// Japanese writes lists with the enumeration comma and no "and", so reusing
// the English joiner produced "AとB、and C". Two items take と; more take 、.
const joinJa = (items, max = 4) => {
  const list = items.filter(Boolean).slice(0, max);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]}と${list[1]}`;
  return list.join("、");
};

const JA_ITEMS = {
  join: joinJa,
  duration: (d) => (d ? `（${d}）` : ""),
  degreeItem: (d) => `${d.institution}の${d.degree}${d.year ? `（${d.year}）` : ""}`,
  certItem: (c) => `${c.issuer ? `${c.issuer}の` : ""}${c.name}`,
  awardItem: (a) => `${a.issuer ? `${a.issuer}の` : ""}${a.name}${a.year ? `（${a.year}）` : ""}`,
  who: (b) => `${b.company ? `${b.company}の` : ""}${b.name}${b.role ? `（${b.role}）` : ""}`,
  contact: (email) => `ご連絡は${email}までお願いします。`,
  metrics: (m) => `${m}。`,
};

const JA_CTA = {
  general: "新しい出会いや面白いお話をいつでも歓迎しています。",
  recruiter: "現在、新しいポジションを積極的に探しています。ぜひお話しさせてください。",
  "job-application": "この経験を御社のチームで活かせればと考えています。",
  client: "プロジェクトのご相談があれば、ぜひお手伝いさせてください。",
  freelancer: "現在フリーランスの案件を受け付けています。ぜひ一緒に作りましょう。",
  "personal-branding": "私のことを少し知っていただけたなら嬉しいです。",
  linkedin: "ぜひつながりましょう。面白いものを作っている方とお話しするのが好きです。",
};

const JA_STYLES = {
  professional: {
    intro: (name, roles) => `${name}と申します。${roles ? `${roles}として活動しています。` : ""}`,
    philosophyLead: "私が大切にしているのは、",
    skills: (list) => `${list}を中心に取り組んでいます。`,
    learning: (list) => `現在は${list}をさらに深めています。`,
    role: (company, role, duration) => `${company}${duration}では${role}を務めました。`,
    project: (name, desc) => `特に力を入れたのが${name}です。${desc}`,
    tech: (list) => `${list}で構築しました。`,
    degrees: (list) => `${list}を修めました。`,
    certs: (list) => `${list}の資格も取得しています。`,
    awards: (list) => `これまでに${list}をいただきました。`,
    quote: (quote, who) => `${who}より、「${quote}」`,
    signOff: "ご覧いただきありがとうございました。",
  },
  creative: {
    intro: (name, roles) => `こんにちは、${name}です！${roles ? `${roles}をしています。` : ""}`,
    philosophyLead: "私の考えはこうです。",
    skills: (list) => `${list}を使ってものづくりをしています。`,
    learning: (list) => `いまは${list}にどっぷりはまっています。`,
    role: (company, role, duration) => `${company}${duration}では${role}でした。`,
    project: (name, desc) => `たとえば${name}。${desc}`,
    tech: (list) => `${list}で作りました。`,
    degrees: (list) => `${list}で学びました。`,
    certs: (list) => `さらに${list}も持っています。`,
    awards: (list) => `途中で${list}もいただきました。`,
    quote: (quote, who) => `${who}より、「${quote}」`,
    signOff: "最後までご覧いただきありがとうございました！",
  },
  minimal: {
    intro: (name, roles) => `${name}。${roles ? `${roles}。` : ""}`,
    philosophyLead: "",
    skills: (list) => `${list}。`,
    learning: (list) => `学習中：${list}。`,
    role: (company, role, duration) => `${company}${duration}、${role}。`,
    project: (name, desc) => `${name} — ${desc}`,
    tech: (list) => `${list}。`,
    degrees: (list) => `${list}。`,
    certs: (list) => `資格：${list}。`,
    awards: (list) => `${list}。`,
    quote: (quote, who) => `「${quote}」${who}`,
    signOff: "ご覧いただきありがとうございました。",
  },
  storytelling: {
    intro: (name, roles) => `${name}と申します。${roles ? `${roles}として歩んできました。` : ""}`,
    philosophyLead: "たどり着いた考えは、",
    skills: (list) => `時間をかけて、${list}が手に馴染んでいきました。`,
    learning: (list) => `この頃は${list}を学んでいます。`,
    role: (company, role, duration) => `${company}${duration}で${role}として過ごした時間が、今の働き方をつくりました。`,
    project: (name, desc) => `そして${name}が生まれました。${desc}`,
    tech: (list) => `${list}で形にしています。`,
    degrees: (list) => `始まりは${list}でした。`,
    certs: (list) => `その後、${list}を加えました。`,
    awards: (list) => `その道のりで${list}をいただきました。`,
    quote: (quote, who) => `${who}はこう言ってくれました。「${quote}」`,
    signOff: "ご覧いただきありがとうございました。",
  },
};

// ------------------------------------------------------------------ Tamil --

const joinTa = (items, max = 4) => {
  const list = items.filter(Boolean).slice(0, max);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} மற்றும் ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} மற்றும் ${list[list.length - 1]}`;
};

const TA_ITEMS = {
  join: joinTa,
  duration: (d) => (d ? ` (${d})` : ""),
  degreeItem: (d) => `${d.institution} நிறுவனத்தில் ${d.degree}${d.year ? ` (${d.year})` : ""}`,
  certItem: (c) => `${c.name}${c.issuer ? ` (${c.issuer})` : ""}`,
  awardItem: (a) => `${a.name}${a.issuer ? ` — ${a.issuer}` : ""}${a.year ? ` (${a.year})` : ""}`,
  who: (b) => `${b.name}${b.role ? `, ${b.role}` : ""}${b.company ? `, ${b.company}` : ""}`,
  contact: (email) => ` ${email} என்ற முகவரியில் என்னைத் தொடர்பு கொள்ளலாம்.`,
  metrics: (m) => ` ${m}.`,
};

const TA_CTA = {
  general: "சுவாரஸ்யமான உரையாடல்களுக்கும் புதிய வாய்ப்புகளுக்கும் நான் எப்போதும் தயார்.",
  recruiter: "நான் தற்போது புதிய பணி வாய்ப்புகளைத் தேடி வருகிறேன் — உங்கள் அணிக்கு நான் எப்படி உதவ முடியும் என்று பேசுவோம்.",
  "job-application": "இந்தத் திறன்களை உங்கள் அணிக்குக் கொண்டு வர விரும்புகிறேன்.",
  client: "உங்கள் மனதில் ஒரு திட்டம் இருந்தால், அதை நனவாக்க உதவ விரும்புகிறேன்.",
  freelancer: "நான் தற்போது சுயாதீனத் திட்டங்களை ஏற்றுக்கொள்கிறேன் — சேர்ந்து ஏதாவது சிறப்பாக உருவாக்குவோம்.",
  "personal-branding": "என்னைப் பற்றி இன்னும் கொஞ்சம் தெரிந்துகொண்டதற்கு நன்றி.",
  linkedin: "இணைவோம் — சுவாரஸ்யமான விஷயங்களை உருவாக்குபவர்களுடன் பழக எப்போதும் மகிழ்ச்சி.",
};

const TA_STYLES = {
  professional: {
    intro: (name, roles) => `வணக்கம், நான் ${name}${roles ? `, ${roles}` : ""}.`,
    philosophyLead: " எனது அணுகுமுறை:",
    skills: (list) => `${list} ஆகியவை எனது முக்கியத் திறன்கள்.`,
    learning: (list) => ` தற்போது ${list} ஆகியவற்றில் ஆழமாகக் கற்று வருகிறேன்.`,
    role: (company, role, duration) => `${company} நிறுவனத்தில்${duration} ${role} ஆகப் பணியாற்றினேன்.`,
    project: (name, desc) => `நான் பெருமைப்படும் ஒரு திட்டம் ${name} — ${desc}`,
    tech: (list) => ` ${list} கொண்டு உருவாக்கப்பட்டது.`,
    degrees: (list) => `${list} பயின்றுள்ளேன்.`,
    certs: (list) => `${list} சான்றிதழ்களும் பெற்றுள்ளேன்.`,
    awards: (list) => `இதுவரை ${list} ஆகியவற்றைப் பெற்றுள்ளேன்.`,
    quote: (quote, who) => `"${quote}" — ${who}.`,
    signOff: "பார்த்தமைக்கு நன்றி.",
  },
  creative: {
    intro: (name, roles) => `வணக்கம்! நான் ${name}${roles ? `, ${roles}` : ""}!`,
    philosophyLead: " என் பார்வையில் —",
    skills: (list) => `${list} கொண்டு உருவாக்குகிறேன்.`,
    learning: (list) => ` இப்போது ${list} ஆகியவற்றில் மூழ்கியிருக்கிறேன்.`,
    role: (company, role, duration) => `${company} நிறுவனத்தில்${duration} ${role}.`,
    project: (name, desc) => `${name} ஐப் பாருங்கள் — ${desc}`,
    tech: (list) => ` ${list} கொண்டு உருவாக்கியது.`,
    degrees: (list) => `${list} படித்தேன்.`,
    certs: (list) => `மேலும் ${list} சான்றிதழ்கள்.`,
    awards: (list) => `வழியில் ${list} கிடைத்தது.`,
    quote: (quote, who) => `"${quote}" — ${who}.`,
    signOff: "பார்த்தமைக்கு நன்றி!",
  },
  minimal: {
    intro: (name, roles) => `${name}.${roles ? ` ${roles}.` : ""}`,
    philosophyLead: "",
    skills: (list) => `${list}.`,
    learning: (list) => ` கற்று வருவது: ${list}.`,
    role: (company, role, duration) => `${role}, ${company}${duration}.`,
    project: (name, desc) => `${name} — ${desc}`,
    tech: (list) => ` ${list}.`,
    degrees: (list) => `${list}.`,
    certs: (list) => `சான்றிதழ்: ${list}.`,
    awards: (list) => `${list}.`,
    quote: (quote, who) => `"${quote}" — ${who}.`,
    signOff: "பார்த்தமைக்கு நன்றி.",
  },
  storytelling: {
    intro: (name, roles) => `என் பெயர் ${name}${roles ? `, ${roles} ஆகப் பணியாற்றுகிறேன்` : ""}.`,
    philosophyLead: " நான் நம்புவது:",
    skills: (list) => `காலப்போக்கில் ${list} ஆகியவை என் கைவசம் வந்தன.`,
    learning: (list) => ` இந்நாட்களில் ${list} கற்று வருகிறேன்.`,
    role: (company, role, duration) =>
      `${company} நிறுவனத்தில்${duration} ${role} ஆகக் கழித்த காலம் என் பணி முறையை வடிவமைத்தது.`,
    project: (name, desc) => `பிறகு ${name} வந்தது — ${desc}`,
    tech: (list) => ` ${list} கொண்டு கட்டமைக்கப்பட்டது.`,
    degrees: (list) => `${list} உடன் தொடங்கியது.`,
    certs: (list) => `பின்னர் ${list} சேர்ந்தது.`,
    awards: (list) => `அந்த வழியில் ${list} கிடைத்தது.`,
    quote: (quote, who) => `${who} சொன்னது போல: "${quote}"`,
    signOff: "பார்த்தமைக்கு நன்றி.",
  },
};

// ------------------------------------------------------------------------ --

const BANKS = {
  en: { styles: EN_STYLES, items: EN_ITEMS, cta: EN_CTA },
  ja: { styles: JA_STYLES, items: JA_ITEMS, cta: JA_CTA },
  ta: { styles: TA_STYLES, items: TA_ITEMS, cta: TA_CTA },
};

// Japanese runs its clauses together without spaces; English and Tamil need one
// between sentences. Getting this wrong is audible — a TTS voice reads
// "toolkit.I'm" as a single word.
const SEPARATOR = { en: " ", ja: "", ta: " " };

export function bankFor(language, style) {
  const code = languageCode(language);
  const bank = BANKS[code] || BANKS.en;
  return {
    code,
    separator: SEPARATOR[code] ?? " ",
    ...bank.items,
    ...(bank.styles[style] || bank.styles.professional),
    cta: (audience) => bank.cta[audience] || bank.cta.general,
  };
}

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CODES);
