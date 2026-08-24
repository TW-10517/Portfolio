import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Field, TextInput } from "../ui/Field.jsx";
import { ImageUpload } from "../ui/ImageUpload.jsx";
import { Button } from "../ui/Button.jsx";
import { TabShell, SubHeading } from "./TabShell.jsx";
import { readFileAsDataUrl } from "../../utils/exportImport.js";
import { ResumeImportModal } from "./ResumeImportModal.jsx";
import { useRef, useState } from "react";

const SOCIALS = ["linkedin", "github", "twitter", "website", "dribbble", "behance", "youtube"];

export function TabProfile() {
  const data = usePortfolioStore((s) => s.data.profile);
  const update = usePortfolioStore((s) => s.update);
  const resumeRef = useRef(null);
  const [importOpen, setImportOpen] = useState(false);

  const set = (key, value) => update(["profile", key], value);
  const setSocial = (key, value) => update(["profile", "social", key], value);

  const handleResume = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }
    // The PDF is base64'd into the portfolio JSON, which the API caps at 15MB
    // for the whole document — without a limit here a large resume silently
    // pushed the portfolio over that cap and broke saving.
    if (file.size > 5 * 1024 * 1024) {
      alert("Please choose a PDF under 5MB — it's stored inside your portfolio.");
      return;
    }
    set("resumeUrl", await readFileAsDataUrl(file));
  };

  return (
    <TabShell title="Profile" description="The basics visitors see first.">
      <Field label="Full Name">
        <TextInput value={data.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Title / Roles" hint="Comma-separated — cycles in the hero typing animation.">
        <TextInput value={data.roles} onChange={(e) => set("roles", e.target.value)} />
      </Field>
      <Field label="Tagline / Motto">
        <TextInput value={data.tagline} onChange={(e) => set("tagline", e.target.value)} />
      </Field>
      <Field label="Profile Photo">
        <ImageUpload value={data.photo} onChange={(v) => set("photo", v)} round />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Location">
          <TextInput value={data.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={data.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
      </div>
      <Field label="Phone (optional)">
        <TextInput value={data.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>

      <SubHeading>Social Links</SubHeading>
      <div className="grid grid-cols-2 gap-3">
        {SOCIALS.map((key) => (
          <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
            <TextInput
              value={data.social[key] || ""}
              onChange={(e) => setSocial(key, e.target.value)}
              placeholder="https://…"
            />
          </Field>
        ))}
      </div>

      <SubHeading>Resume / CV</SubHeading>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => resumeRef.current?.click()}
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          {data.resumeUrl ? "Replace PDF" : "Upload PDF"}
        </button>
        {data.resumeUrl && <span className="text-xs text-emerald-400">✓ Resume attached</span>}
        <input ref={resumeRef} type="file" accept="application/pdf" onChange={handleResume} className="hidden" />
      </div>
      <div className="mt-4">
        <Button variant="subtle" size="sm" onClick={() => setImportOpen(true)}>
          ✨ Auto-fill from resume
        </Button>
        <p className="text-[11px] text-slate-400 mt-2">
          Extracts text from a PDF entirely in your browser and suggests profile fields, skills, and experience for you to review — no AI, no upload to any server.
        </p>
      </div>

      <ResumeImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </TabShell>
  );
}
