import { motion } from "framer-motion";
import { usePortfolioTheme } from "./ThemeContext.jsx";
import { Reveal } from "./Reveal.jsx";
import { SectionTag } from "./SectionTag.jsx";

function SkillBar({ name, level, primary, secondary, palette, animationLevel }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1.5" style={{ color: palette.textDim }}>
        <span>{name}</span>
        <span>{level}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: palette.surface2, border: `1px solid ${palette.border}` }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }}
          initial={{ width: 0 }}
          whileInView={{ width: `${level}%` }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: animationLevel === "none" ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

export function Skills() {
  const { data, palette, primary, secondary, animationLevel } = usePortfolioTheme();
  const { categories, learning } = data.skills;

  return (
    <section id="skills" className="py-24 px-6" style={{ background: palette.surface + "40" }}>
      <div className="max-w-5xl mx-auto">
        <Reveal animationLevel={animationLevel}>
          <SectionTag>What I work with</SectionTag>
          <h2 className="font-head font-bold text-3xl md:text-4xl mb-10" style={{ color: palette.text }}>
            Skills &amp; <span style={{ color: primary }}>Tech Stack</span>
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {categories.map((cat, ci) => (
            <Reveal key={cat.id} animationLevel={animationLevel} delay={ci * 0.08} className="rounded-2xl p-6 border" style={{ borderColor: palette.border, background: palette.surface }}>
              <h3 className="font-head font-semibold mb-4" style={{ color: palette.text }}>
                {cat.name}
              </h3>
              {cat.skills.map((s) => (
                <SkillBar key={s.id} name={s.name} level={s.level} primary={primary} secondary={secondary} palette={palette} animationLevel={animationLevel} />
              ))}
            </Reveal>
          ))}
        </div>

        {learning?.length > 0 && (
          <Reveal animationLevel={animationLevel}>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: palette.textFaint }}>
              Currently Learning
            </h3>
            <div className="flex flex-wrap gap-2">
              {learning.map((l) => (
                <span
                  key={l}
                  className="px-4 py-1.5 rounded-full text-sm border animate-pulse-dot"
                  style={{ borderColor: primary, color: primary, background: primary + "12" }}
                >
                  {l}
                </span>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
