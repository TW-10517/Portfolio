import { usePortfolioTheme } from "./ThemeContext.jsx";
import { ParticleCanvas } from "./ParticleCanvas.jsx";
import { useTyping } from "../../hooks/useTyping.js";
import { sanitizeUrl, sanitizeDownloadUrl } from "../../utils/sanitizeUrl.js";

export function Hero() {
  const { data, palette, primary, secondary, animationLevel } = usePortfolioTheme();
  const { profile } = data;
  const roles = (profile.roles || "").split(",").map((r) => r.trim()).filter(Boolean);
  const typed = useTyping(roles.length ? roles : ["—"], animationLevel !== "none");
  const style = data.theme?.heroStyle || "centered";

  const scrollToProjects = () => document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
  const scrollToContact = () => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });

  return (
    <header id="hero" className="relative min-h-screen flex items-center overflow-hidden pt-20">
      {animationLevel !== "none" && (
        <>
          <ParticleCanvas color={primary} />
          <div
            className="absolute w-[420px] h-[420px] rounded-full blur-[90px] opacity-30 -top-20 -right-20 animate-blob pointer-events-none"
            style={{ background: primary }}
          />
          <div
            className="absolute w-[360px] h-[360px] rounded-full blur-[90px] opacity-30 -bottom-24 -left-24 animate-blob pointer-events-none"
            style={{ background: secondary, animationDirection: "reverse" }}
          />
        </>
      )}

      <div className={`relative z-10 max-w-6xl mx-auto px-6 w-full ${style === "split" ? "grid md:grid-cols-2 gap-12 items-center" : "text-center"}`}>
        {style === "split" && (
          <div className="order-2 md:order-1 flex justify-center">
            <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-3xl overflow-hidden" style={{ boxShadow: `0 0 60px ${primary}33` }}>
              {profile.photo ? (
                <img src={profile.photo} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl font-bold font-head" style={{ background: palette.surface2, color: palette.textDim }}>
                  {(profile.name || "?")[0]}
                </div>
              )}
            </div>
          </div>
        )}

        <div className={style === "split" ? "order-1 md:order-2 text-left" : ""}>
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs mb-6 border ${style === "split" ? "" : "mx-auto"}`}
            style={{ borderColor: palette.border, color: palette.textDim, background: palette.surface }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
            Open to opportunities
          </div>

          {style !== "minimal" && (
            <h1 className="font-head font-bold leading-[1.05] mb-5" style={{ fontSize: "clamp(2.4rem, 6vw, 4.6rem)", color: palette.text }}>
              Hi, I'm{" "}
              <span style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${secondary})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                {profile.name}
              </span>
            </h1>
          )}
          {style === "minimal" && (
            <h1 className="font-head font-bold mb-4" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", color: palette.text }}>
              {profile.name}
            </h1>
          )}

          <div className="font-head font-semibold mb-5 min-h-[1.6em]" style={{ fontSize: "clamp(1.1rem, 2.4vw, 1.5rem)", color: primary }}>
            {typed}
            <span className="inline-block w-0.5 ml-1 align-middle animate-pulse-dot" style={{ height: "1em", background: primary }} />
          </div>

          <p className={`mb-8 max-w-xl ${style === "split" ? "" : "mx-auto"}`} style={{ color: palette.textDim }}>
            {profile.tagline}
          </p>

          <div className={`flex flex-wrap gap-4 mb-8 ${style === "split" ? "" : "justify-center"}`}>
            <button
              onClick={scrollToProjects}
              className="px-7 py-3.5 rounded-full font-semibold text-sm text-slate-950 transition hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, boxShadow: `0 10px 30px ${primary}44` }}
            >
              View My Work
            </button>
            <button
              onClick={scrollToContact}
              className="px-7 py-3.5 rounded-full font-semibold text-sm border transition hover:-translate-y-0.5"
              style={{ borderColor: palette.border, color: palette.text }}
            >
              Contact Me
            </button>
            {profile.resumeUrl && (
              <a
                href={sanitizeDownloadUrl(profile.resumeUrl)}
                download={`${(profile.name || "resume").replace(/\s+/g, "-").toLowerCase()}-resume.pdf`}
                className="px-7 py-3.5 rounded-full font-semibold text-sm border transition hover:-translate-y-0.5"
                style={{ borderColor: palette.border, color: palette.text }}
              >
                Download Résumé
              </a>
            )}
          </div>

          <div className={`flex gap-3 ${style === "split" ? "" : "justify-center"}`}>
            {Object.entries(profile.social || {})
              .filter(([, v]) => v)
              .map(([key, url]) => (
                <a
                  key={key}
                  href={sanitizeUrl(url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full border flex items-center justify-center text-xs uppercase transition hover:-translate-y-1"
                  style={{ borderColor: palette.border, color: palette.textDim }}
                >
                  {key.slice(0, 2)}
                </a>
              ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[11px] uppercase tracking-widest" style={{ color: palette.textFaint }}>
        <span className="w-6 h-9 rounded-full border-2 flex justify-center pt-2" style={{ borderColor: palette.textFaint }}>
          <span className="w-1 h-2 rounded-full animate-pulse-dot" style={{ background: primary }} />
        </span>
        Scroll
      </div>
    </header>
  );
}
