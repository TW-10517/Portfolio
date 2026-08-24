import { useRef, useState } from "react";
import { Modal } from "../ui/Modal.jsx";
import { Button } from "../ui/Button.jsx";
import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { uid } from "../../utils/uid.js";

const PROFILE_FIELDS = [
  ["name", "Name", ["profile", "name"]],
  ["email", "Email", ["profile", "email"]],
  ["phone", "Phone", ["profile", "phone"]],
  ["location", "Location", ["profile", "location"]],
  ["linkedin", "LinkedIn", ["profile", "social", "linkedin"]],
  ["github", "GitHub", ["profile", "social", "github"]],
  ["website", "Website", ["profile", "social", "website"]],
];

export function ResumeImportModal({ open, onClose }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | parsing | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [draft, setDraft] = useState(null);
  const [included, setIncluded] = useState({});
  const update = usePortfolioStore((s) => s.update);
  const addItem = usePortfolioStore((s) => s.addItem);
  const data = usePortfolioStore((s) => s.data);

  const reset = () => {
    setStatus("idle");
    setErrorMsg("");
    setDraft(null);
    setIncluded({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("parsing");
    setErrorMsg("");
    try {
      const { parseResumeFile } = await import("../../utils/parseResume.js");
      const parsed = await parseResumeFile(file);
      const hasAnything =
        parsed.name || parsed.email || parsed.phone || parsed.skills.length || parsed.experience.length;
      if (!hasAnything) {
        setStatus("error");
        setErrorMsg(
          "Couldn't find readable text in this PDF — it may be a scanned image rather than a text-based document. Try exporting your resume directly from a word processor instead of scanning a printout."
        );
        return;
      }
      setDraft(parsed);
      setIncluded({
        name: !!parsed.name,
        email: !!parsed.email,
        phone: !!parsed.phone,
        location: !!parsed.location,
        linkedin: !!parsed.linkedin,
        github: !!parsed.github,
        website: !!parsed.website,
        skills: Object.fromEntries(parsed.skills.map((s) => [s, true])),
        experience: parsed.experience.map(() => false),
        education: parsed.education.map(() => false),
      });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg("Something went wrong reading that PDF. Make sure it's a valid, non-password-protected file.");
    }
    e.target.value = "";
  };

  const toggleSkill = (skill) =>
    setIncluded((prev) => ({ ...prev, skills: { ...prev.skills, [skill]: !prev.skills[skill] } }));

  const toggleExp = (i) =>
    setIncluded((prev) => ({ ...prev, experience: prev.experience.map((v, idx) => (idx === i ? !v : v)) }));

  const toggleEdu = (i) =>
    setIncluded((prev) => ({ ...prev, education: prev.education.map((v, idx) => (idx === i ? !v : v)) }));

  const apply = () => {
    for (const [key, , path] of PROFILE_FIELDS) {
      if (included[key] && draft[key]) update(path, draft[key]);
    }

    const chosenSkills = Object.entries(included.skills || {})
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (chosenSkills.length) {
      const categories = data.skills.categories;
      update(
        ["skills", "categories"],
        [
          ...categories,
          {
            id: uid(),
            name: "From Resume",
            skills: chosenSkills.map((name) => ({ id: uid(), name, level: 70 })),
          },
        ]
      );
    }

    draft.experience.forEach((exp, i) => {
      if (!included.experience[i]) return;
      addItem("experience", {
        id: uid(),
        company: exp.company || "Company",
        role: exp.role || "Role",
        duration: exp.duration || "",
        location: "",
        description: exp.description || "",
        tech: [],
        logo: "",
      });
    });

    draft.education.forEach((edu, i) => {
      if (!included.education[i]) return;
      addItem("education.degrees", {
        id: uid(),
        degree: edu.degree || "Degree",
        institution: edu.institution || "",
        year: edu.year || "",
        achievements: "",
      });
    });

    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} wide label="Import from resume">
      <h2 className="text-xl font-head font-bold text-white mb-1">Import from resume</h2>
      <p className="text-sm text-slate-400 mb-6">
        Runs entirely in your browser — the PDF is never uploaded anywhere. Text is extracted and matched with
        keyword rules, not AI, so <strong className="text-slate-300">review everything below before applying</strong>.
      </p>

      {status === "idle" && (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-700 rounded-xl py-10 text-center cursor-pointer hover:border-cyan-400 transition"
        >
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm text-slate-300">Click to choose a PDF resume</p>
          <input
            ref={fileRef}
            id="resume-import-input"
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      )}

      {status === "parsing" && (
        <div className="py-10 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
          Reading your resume…
        </div>
      )}

      {status === "error" && (
        <div>
          <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
          <Button variant="subtle" size="sm" onClick={reset}>
            Try another file
          </Button>
        </div>
      )}

      {status === "done" && draft && (
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <h3 className="text-xs uppercase tracking-wide text-cyan-400 mb-3">Profile fields</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {PROFILE_FIELDS.filter(([key]) => draft[key]).map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 text-sm bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
                  <input
                    type="checkbox"
                    checked={!!included[key]}
                    onChange={() => setIncluded((p) => ({ ...p, [key]: !p[key] }))}
                    className="mt-0.5 accent-cyan-400"
                  />
                  <span className="min-w-0">
                    <span className="block text-slate-400 text-[11px]">{label}</span>
                    <span className="block text-slate-200 truncate">{draft[key]}</span>
                  </span>
                </label>
              ))}
            </div>
            {PROFILE_FIELDS.every(([key]) => !draft[key]) && (
              <p className="text-xs text-slate-400">No contact fields detected.</p>
            )}
          </div>

          {draft.skills.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-cyan-400 mb-3">
                Skills detected ({draft.skills.length}) — click to toggle, added as a new "From Resume" category
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {draft.skills.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSkill(s)}
                    className={`px-3 py-1 rounded-full text-xs border transition ${
                      included.skills?.[s]
                        ? "bg-cyan-400/15 border-cyan-400 text-cyan-300"
                        : "border-slate-700 text-slate-400 line-through"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {draft.experience.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-amber-400 mb-1">
                Experience entries — low confidence, unchecked by default
              </h3>
              <p className="text-[11px] text-slate-400 mb-3">
                Layout parsing is approximate. Check the box only for entries that look correct — you can fix details after import in the Experience tab.
              </p>
              <div className="space-y-2">
                {draft.experience.map((exp, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={!!included.experience?.[i]}
                      onChange={() => toggleExp(i)}
                      className="mt-1 accent-cyan-400"
                    />
                    <span className="min-w-0">
                      <span className="block text-slate-200 font-medium">
                        {exp.role}
                        {exp.company && ` — ${exp.company}`}
                      </span>
                      <span className="block text-slate-400 text-xs">{exp.duration}</span>
                      {exp.description && <span className="block text-slate-400 text-xs mt-1 line-clamp-2">{exp.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {draft.education.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-amber-400 mb-1">
                Education entries — low confidence, unchecked by default
              </h3>
              <div className="space-y-2">
                {draft.education.map((edu, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={!!included.education?.[i]}
                      onChange={() => toggleEdu(i)}
                      className="mt-1 accent-cyan-400"
                    />
                    <span className="min-w-0">
                      <span className="block text-slate-200 font-medium">{edu.degree || "Degree"}</span>
                      <span className="block text-slate-400 text-xs">
                        {edu.institution} {edu.year && `· ${edu.year}`}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-slate-800">
            <Button onClick={apply}>Apply selected to portfolio</Button>
            <Button variant="ghost" onClick={reset}>
              Start over
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
