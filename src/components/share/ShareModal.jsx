import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { Modal } from "../ui/Modal.jsx";
import { Button } from "../ui/Button.jsx";
import { Field, TextInput, Select } from "../ui/Field.jsx";
import { slugify } from "../../utils/slug.js";

export function ShareModal({ open, onClose }) {
  const data = usePortfolioStore((s) => s.data);
  const publish = usePortfolioStore((s) => s.publish);
  const [slug, setSlug] = useState(data.meta.slug || slugify(data.profile.name));
  const [visibility, setVisibility] = useState(data.meta.visibility || "public");
  const [password, setPassword] = useState(data.meta.password || "");
  const [qr, setQr] = useState("");
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}${window.location.pathname}#/p/${slugify(slug)}`;

  useEffect(() => {
    if (!published) return;
    QRCode.toDataURL(shareUrl, { margin: 1, width: 220, color: { dark: "#0b0c12", light: "#ffffff" } }).then(setQr);
  }, [published, shareUrl]);

  const doPublish = () => {
    const clean = slugify(slug) || slugify(data.profile.name) || "my-portfolio";
    setSlug(clean);
    publish(clean, visibility, password);
    setPublished(true);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const socialShare = (kind) => {
    const text = encodeURIComponent(`Check out my portfolio — ${data.profile.name}`);
    const url = encodeURIComponent(shareUrl);
    const links = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      email: `mailto:?subject=${text}&body=${url}`,
    };
    window.open(links[kind], "_blank", "noopener");
  };

  return (
    <Modal open={open} onClose={onClose} wide>
      <h2 className="text-xl font-head font-bold text-white mb-1">Share your portfolio</h2>
      <p className="text-sm text-slate-400 mb-6">Publish a snapshot of your current portfolio to a public link.</p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Field label="Custom slug">
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700 overflow-hidden focus-within:border-cyan-400">
            <span className="pl-3 text-xs text-slate-500 shrink-0">.../p/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full bg-transparent px-2 py-2 text-sm text-slate-100 focus:outline-none"
            />
          </div>
        </Field>
        <Field label="Visibility">
          <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private (link disabled)</option>
            <option value="password">Password-protected</option>
          </Select>
        </Field>
      </div>

      {visibility === "password" && (
        <Field label="Gate password">
          <TextInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a password" />
        </Field>
      )}

      <Button onClick={doPublish} className="mb-6">
        {published ? "Republish" : "Publish"}
      </Button>

      {published && (
        <div className="border-t border-slate-800 pt-5 space-y-5">
          <div className="flex items-center gap-2">
            <input readOnly value={shareUrl} className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-300" />
            <Button variant="subtle" size="sm" onClick={copyLink}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>

          <div className="flex items-center gap-6">
            {qr && <img src={qr} alt="QR code for share link" className="rounded-lg border border-slate-700" width={110} height={110} />}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => socialShare("linkedin")}>LinkedIn</Button>
              <Button variant="ghost" size="sm" onClick={() => socialShare("twitter")}>Twitter</Button>
              <Button variant="ghost" size="sm" onClick={() => socialShare("whatsapp")}>WhatsApp</Button>
              <Button variant="ghost" size="sm" onClick={() => socialShare("email")}>Email</Button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            This link works on this browser/device (MVP uses local storage — no server). Use Export JSON if you need to move your portfolio elsewhere.
          </p>
        </div>
      )}
    </Modal>
  );
}
