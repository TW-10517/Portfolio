import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { usePortfolioStore } from "../../store/usePortfolioStore.js";
import { useAuthStore } from "../../store/useAuthStore.js";
import { api, ApiError } from "../../utils/api.js";
import { Modal } from "../ui/Modal.jsx";
import { Button } from "../ui/Button.jsx";
import { Field, TextInput, Select } from "../ui/Field.jsx";
import { slugify } from "../../utils/slug.js";

export function ShareModal({ open, onClose }) {
  const data = usePortfolioStore((s) => s.data);
  const saveToServer = usePortfolioStore((s) => s.saveToServer);
  const token = useAuthStore((s) => s.token);
  const [slug, setSlug] = useState(data.meta.slug || slugify(data.profile.name));
  const [visibility, setVisibility] = useState(data.meta.visibility || "public");
  const [password, setPassword] = useState("");
  const [qr, setQr] = useState("");
  const [published, setPublished] = useState(false);
  const [views, setViews] = useState(data.meta.views ?? 0);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [error, setError] = useState("");

  const shareUrl = `${window.location.origin}${window.location.pathname}#/p/${slugify(slug)}`;

  useEffect(() => {
    if (!published) return;
    QRCode.toDataURL(shareUrl, { margin: 1, width: 220, color: { dark: "#0b0c12", light: "#ffffff" } }).then(setQr);
  }, [published, shareUrl]);

  // `published` used to start false on every mount, so reopening this modal on
  // an already-published portfolio hid the share link, QR code and social
  // buttons, and offered "Publish" instead of "Republish" — the only way back
  // to your own link was to publish again. Asking the server on open also
  // refreshes the view count, which otherwise only changed on publish.
  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    setChecking(true);
    api
      .getMine(token)
      .then(({ portfolio }) => {
        if (cancelled || !portfolio) return;
        setPublished(true);
        setSlug(portfolio.slug);
        setVisibility(portfolio.visibility);
        setViews(portfolio.views ?? 0);
      })
      // A failed check just leaves the modal in its unpublished state; the
      // publish attempt itself will surface any real problem.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  const doPublish = async () => {
    setError("");
    setSaving(true);
    try {
      const portfolio = await saveToServer(token, { slug: slugify(slug) || slugify(data.profile.name) || "my-portfolio", visibility, password });
      setSlug(portfolio.slug);
      setPassword(""); // never keep the plaintext password in memory/UI longer than the request
      setViews(portfolio.views ?? 0);
      setPublished(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't publish right now. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const doUnpublish = async () => {
    if (!confirm("Remove your published portfolio? The share link will stop working and the slug will be freed up.")) return;
    setError("");
    setUnpublishing(true);
    try {
      await api.deleteMine(token);
      setPublished(false);
      setViews(0);
      setQr("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't unpublish right now. Please try again.");
    } finally {
      setUnpublishing(false);
    }
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
      <p className="text-sm text-slate-400 mb-6">Publish your portfolio to your account — accessible from any device at a public link.</p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <Field label="Custom slug">
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700 overflow-hidden focus-within:border-cyan-400">
            <span className="pl-3 text-xs text-slate-400 shrink-0">.../p/</span>
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
        <Field label="Gate password" hint={published ? "Leave blank to keep the current password." : undefined}>
          <TextInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a password" />
        </Field>
      )}

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      <div className="flex items-center gap-2 mb-6">
        <Button onClick={doPublish} disabled={saving || unpublishing || checking}>
          {saving ? "Publishing…" : checking ? "Checking…" : published ? "Republish" : "Publish"}
        </Button>
        {published && (
          <Button variant="danger" onClick={doUnpublish} disabled={saving || unpublishing}>
            {unpublishing ? "Removing…" : "Unpublish"}
          </Button>
        )}
      </div>

      {published && (
        <div className="border-t border-slate-800 pt-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              <span className="text-white font-semibold">{views.toLocaleString()}</span>{" "}
              {views === 1 ? "view" : "views"}
            </p>
            <p className="text-xs text-slate-400">Counted on each visit to your public link.</p>
          </div>

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
        </div>
      )}
    </Modal>
  );
}
