import { usePortfolioTheme } from "./ThemeContext.jsx";
import { Reveal } from "./Reveal.jsx";
import { SectionTag } from "./SectionTag.jsx";

export function About() {
  const { data, palette, primary, secondary, animationLevel } = usePortfolioTheme();
  const { about } = data;
  const paragraphs = (about.bio || "").split(/\n{2,}|\n/).filter(Boolean);

  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <Reveal animationLevel={animationLevel}>
          <SectionTag>Get to know me</SectionTag>
          <h2 className="font-head font-bold text-3xl md:text-4xl mb-8" style={{ color: palette.text }}>
            About <span style={{ color: primary }}>Me</span>
          </h2>
        </Reveal>

        <Reveal animationLevel={animationLevel} className="space-y-4 max-w-2xl mb-12">
          {paragraphs.map((p, i) => (
            <p key={i} style={{ color: palette.textDim }}>
              {p}
            </p>
          ))}
        </Reveal>

        {about.philosophy && (
          <Reveal animationLevel={animationLevel} className="rounded-2xl p-6 mb-12 border" style={{ borderColor: palette.border, background: palette.surface }}>
            <p className="text-sm uppercase tracking-wide mb-2" style={{ color: primary }}>
              Philosophy
            </p>
            <p style={{ color: palette.textDim }}>{about.philosophy}</p>
          </Reveal>
        )}

        {about.hobbies?.length > 0 && (
          <Reveal animationLevel={animationLevel} className="mb-10">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: palette.textFaint }}>
              Hobbies &amp; Interests
            </h3>
            <div className="flex flex-wrap gap-2">
              {about.hobbies.map((h) => (
                <span key={h} className="px-4 py-2 rounded-full text-sm border" style={{ borderColor: primary + "55", color: palette.text, background: palette.surface }}>
                  {h}
                </span>
              ))}
            </div>
          </Reveal>
        )}

        {about.funFacts?.length > 0 && (
          <Reveal animationLevel={animationLevel}>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: palette.textFaint }}>
              Fun Facts
            </h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {about.funFacts.map((f, i) => (
                <div key={i} className="rounded-xl p-4 border text-sm" style={{ borderColor: palette.border, background: palette.surface, color: palette.textDim }}>
                  ✦ {f}
                </div>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
