import { useState } from "react";
import { usePortfolioTheme } from "./ThemeContext.jsx";
import { Reveal } from "./Reveal.jsx";
import { SectionTag } from "./SectionTag.jsx";

function ExperienceCard({ item, open, onToggle, palette, primary }) {
  return (
    <div className="rounded-2xl border p-5 cursor-pointer transition" style={{ borderColor: palette.border, background: palette.surface }} onClick={onToggle}>
      <div className="flex items-start gap-3">
        {item.logo ? (
          <img src={item.logo} alt={item.company} className="w-11 h-11 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center font-head font-semibold text-sm" style={{ background: palette.surface2, color: palette.textDim }}>
            {item.company?.[0]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-head font-semibold" style={{ color: palette.text }}>
            {item.role} — {item.company}
          </h3>
          <p className="text-xs mt-1" style={{ color: palette.textFaint }}>
            {item.duration} {item.location && `· ${item.location}`}
          </p>
        </div>
      </div>
      <div
        className="overflow-hidden transition-all duration-500"
        style={{ maxHeight: open ? 400 : 0, marginTop: open ? 14 : 0 }}
      >
        {item.description?.split("\n").filter(Boolean).map((line, i) => (
          <p key={i} className="text-sm mb-1.5 pl-4 relative" style={{ color: palette.textDim }}>
            <span className="absolute left-0" style={{ color: primary }}>·</span>
            {line}
          </p>
        ))}
        {item.tech?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.tech.map((t) => (
              <span key={t} className="text-xs px-2.5 py-0.5 rounded-full border" style={{ borderColor: palette.border, color: palette.textDim }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Experience() {
  const { data, palette, primary, secondary, animationLevel } = usePortfolioTheme();
  const items = data.experience;
  const layout = data.theme?.experienceLayout || "timeline";
  const [openId, setOpenId] = useState(items[0]?.id);

  return (
    <section id="experience" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <Reveal animationLevel={animationLevel}>
          <SectionTag>Career path</SectionTag>
          <h2 className="font-head font-bold text-3xl md:text-4xl mb-10" style={{ color: palette.text }}>
            Where I've <span style={{ color: primary }}>Worked</span>
          </h2>
        </Reveal>

        {layout === "timeline" ? (
          <div className="relative pl-8 border-l-2" style={{ borderColor: palette.border }}>
            {items.map((item, i) => (
              <Reveal key={item.id} animationLevel={animationLevel} delay={i * 0.08} className="relative mb-8 last:mb-0">
                <span
                  className="absolute -left-[41px] top-2 w-4 h-4 rounded-full border-[3px]"
                  style={{ borderColor: primary, background: palette.bg }}
                />
                <ExperienceCard item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} palette={palette} primary={primary} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className={layout === "cards" ? "grid md:grid-cols-2 gap-5" : "space-y-4"}>
            {items.map((item, i) => (
              <Reveal key={item.id} animationLevel={animationLevel} delay={i * 0.06}>
                <ExperienceCard item={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} palette={palette} primary={primary} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
