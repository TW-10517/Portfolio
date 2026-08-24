import { useState } from "react";
import { usePortfolioTheme } from "./ThemeContext.jsx";
import { Reveal } from "./Reveal.jsx";
import { SectionTag } from "./SectionTag.jsx";
import { sanitizeUrl } from "../../utils/sanitizeUrl.js";

function FaqItem({ faq, open, onToggle, palette, primary }) {
  return (
    <div className="border-b" style={{ borderColor: palette.border }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between py-4 text-left font-medium" style={{ color: palette.text }}>
        {faq.q}
        <span className="text-lg transition-transform" style={{ color: primary, transform: open ? "rotate(45deg)" : "none" }}>+</span>
      </button>
      <div className="overflow-hidden transition-all duration-400" style={{ maxHeight: open ? 200 : 0 }}>
        <p className="pb-4 text-sm" style={{ color: palette.textDim }}>{faq.a}</p>
      </div>
    </div>
  );
}

export function Contact() {
  const { data, palette, primary, secondary, animationLevel } = usePortfolioTheme();
  const { profile } = data;
  const contact = data.contact;
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState("");
  const [openFaq, setOpenFaq] = useState(contact.faqs?.[0]?.id);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (contact.formMethod === "mailto") {
      window.location.href = `mailto:${profile.email}?subject=${encodeURIComponent(form.subject || "Portfolio inquiry")}&body=${encodeURIComponent(`${form.message}\n\n— ${form.name} (${form.email})`)}`;
      setStatus("Opening your email client…");
      return;
    }
    setSubmitting(true);
    if (contact.formMethod === "webhook" && contact.webhookUrl) {
      try {
        await fetch(contact.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        setStatus("Message sent — thank you!");
      } catch {
        setStatus("Couldn't reach the webhook, but your message was noted locally.");
      }
    } else {
      await new Promise((r) => setTimeout(r, 1000));
      setStatus("Thanks! This is a demo submit — connect a backend to send for real.");
    }
    setSubmitting(false);
    setForm({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <section id="contact" className="py-24 px-6" style={{ background: palette.surface + "40" }}>
      <div className="max-w-5xl mx-auto">
        <Reveal animationLevel={animationLevel}>
          <SectionTag>Say hello</SectionTag>
          <h2 className="font-head font-bold text-3xl md:text-4xl mb-10" style={{ color: palette.text }}>
            Let's <span style={{ color: primary }}>Talk</span>
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-10">
          {contact.formEnabled ? (
            <Reveal animationLevel={animationLevel} as="form" onSubmit={submit} className="space-y-4">
              <input
                required
                placeholder="Your Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg px-4 py-3 text-sm border focus:outline-none"
                style={{ background: palette.surface, borderColor: palette.border, color: palette.text }}
              />
              <input
                required
                type="email"
                placeholder="Email Address"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg px-4 py-3 text-sm border focus:outline-none"
                style={{ background: palette.surface, borderColor: palette.border, color: palette.text }}
              />
              <input
                placeholder="Subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-lg px-4 py-3 text-sm border focus:outline-none"
                style={{ background: palette.surface, borderColor: palette.border, color: palette.text }}
              />
              <textarea
                required
                placeholder="Your Message"
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-lg px-4 py-3 text-sm border focus:outline-none"
                style={{ background: palette.surface, borderColor: palette.border, color: palette.text }}
              />
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-full text-sm font-semibold text-slate-950 disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
              >
                {submitting ? "Sending…" : "Send Message"}
              </button>
              {status && <p className="text-xs" style={{ color: primary }}>{status}</p>}
            </Reveal>
          ) : (
            <div />
          )}

          <Reveal animationLevel={animationLevel} className="space-y-4">
            {contact.showEmail && (
              <a href={`mailto:${profile.email}`} className="flex items-center gap-3 text-sm" style={{ color: palette.textDim }}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: palette.surface }}>✉️</span>
                {profile.email}
              </a>
            )}
            {contact.showPhone && profile.phone && (
              <a href={`tel:${profile.phone}`} className="flex items-center gap-3 text-sm" style={{ color: palette.textDim }}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: palette.surface }}>📞</span>
                {profile.phone}
              </a>
            )}
            {contact.showLocation && profile.location && (
              <div className="flex items-center gap-3 text-sm" style={{ color: palette.textDim }}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: palette.surface }}>📍</span>
                {profile.location}
              </div>
            )}
            {contact.showSocial && (
              <div className="flex gap-2 pt-2">
                {Object.entries(profile.social || {}).filter(([, v]) => v).map(([key, url]) => (
                  <a key={key} href={sanitizeUrl(url)} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border flex items-center justify-center text-xs uppercase" style={{ borderColor: palette.border, color: palette.textDim }}>
                    {key.slice(0, 2)}
                  </a>
                ))}
              </div>
            )}
            {contact.calendlyUrl && (
              <a href={sanitizeUrl(contact.calendlyUrl)} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 px-5 py-2.5 rounded-full text-sm border" style={{ borderColor: palette.border, color: palette.text }}>
                Book a Meeting
              </a>
            )}
          </Reveal>
        </div>

        {contact.faqs?.length > 0 && (
          <Reveal animationLevel={animationLevel} className="max-w-2xl mt-16">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-2" style={{ color: palette.textFaint }}>FAQ</h3>
            {contact.faqs.map((f) => (
              <FaqItem key={f.id} faq={f} open={openFaq === f.id} onToggle={() => setOpenFaq(openFaq === f.id ? null : f.id)} palette={palette} primary={primary} />
            ))}
          </Reveal>
        )}
      </div>
    </section>
  );
}
