import { usePortfolioTheme } from "./ThemeContext.jsx";
import { Reveal } from "./Reveal.jsx";
import { SectionTag } from "./SectionTag.jsx";

export function Education() {
  const { data, palette, primary, animationLevel } = usePortfolioTheme();
  const { degrees, certifications, awards } = data.education;

  return (
    <section id="education" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <Reveal animationLevel={animationLevel}>
          <SectionTag>Academic background</SectionTag>
          <h2 className="font-head font-bold text-3xl md:text-4xl mb-10" style={{ color: palette.text }}>
            Education &amp; <span style={{ color: primary }}>Certifications</span>
          </h2>
        </Reveal>

        {degrees?.length > 0 && (
          <div className="grid md:grid-cols-2 gap-5 mb-10">
            {degrees.map((d, i) => (
              <Reveal key={d.id} animationLevel={animationLevel} delay={i * 0.08} className="rounded-2xl border p-5" style={{ borderColor: palette.border, background: palette.surface }}>
                <div className="text-2xl mb-2">🎓</div>
                <h3 className="font-head font-semibold" style={{ color: palette.text }}>{d.degree}</h3>
                <p className="text-sm mt-1" style={{ color: palette.textDim }}>{d.institution}</p>
                <p className="text-xs mt-1" style={{ color: palette.textFaint }}>{d.year}</p>
                {d.achievements && <p className="text-sm mt-3" style={{ color: palette.textDim }}>{d.achievements}</p>}
              </Reveal>
            ))}
          </div>
        )}

        {certifications?.length > 0 && (
          <Reveal animationLevel={animationLevel} className="mb-10">
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: palette.textFaint }}>Certifications</h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {certifications.map((c) => (
                <a
                  key={c.id}
                  href={c.url || undefined}
                  target={c.url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="rounded-2xl border p-5 text-center block"
                  style={{ borderColor: palette.border, background: palette.surface }}
                >
                  {c.badge ? (
                    <img src={c.badge} alt={c.name} className="w-14 h-14 rounded-full mx-auto mb-3 object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-xl" style={{ background: palette.surface2 }}>🏅</div>
                  )}
                  <h4 className="text-sm font-medium" style={{ color: palette.text }}>{c.name}</h4>
                  <p className="text-xs mt-1" style={{ color: palette.textFaint }}>{c.issuer} · {c.year}</p>
                </a>
              ))}
            </div>
          </Reveal>
        )}

        {awards?.length > 0 && (
          <Reveal animationLevel={animationLevel}>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: palette.textFaint }}>Awards &amp; Honors</h3>
            <div className="space-y-2">
              {awards.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm" style={{ borderColor: palette.border, background: palette.surface }}>
                  <span style={{ color: palette.text }}>🏆 {a.name}</span>
                  <span style={{ color: palette.textFaint }}>{a.issuer} · {a.year}</span>
                </div>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
