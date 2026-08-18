import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePortfolioTheme } from "./ThemeContext.jsx";
import { Reveal } from "./Reveal.jsx";
import { SectionTag } from "./SectionTag.jsx";

export function Testimonials() {
  const { data, palette, primary, secondary, animationLevel } = usePortfolioTheme();
  const items = data.testimonials;
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 5500);
    return () => clearInterval(t);
  }, [paused, items.length]);

  if (!items.length) return null;
  const current = items[idx];

  return (
    <section id="testimonials" className="py-24 px-6" style={{ background: palette.surface + "40" }}>
      <div className="max-w-3xl mx-auto text-center">
        <Reveal animationLevel={animationLevel}>
          <SectionTag>Kind words</SectionTag>
          <h2 className="font-head font-bold text-3xl md:text-4xl mb-10" style={{ color: palette.text }}>
            What People <span style={{ color: primary }}>Say</span>
          </h2>
        </Reveal>

        <div
          className="relative min-h-[280px] flex items-center justify-center"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border p-10 w-full"
              style={{ borderColor: palette.border, background: palette.surface }}
            >
              {current.photo ? (
                <img src={current.photo} alt={current.name} className="w-16 h-16 rounded-full mx-auto mb-4 object-cover border-2" style={{ borderColor: primary }} />
              ) : (
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center font-head font-semibold" style={{ background: palette.surface2, color: palette.textDim }}>
                  {current.name?.[0]}
                </div>
              )}
              {current.rating > 0 && (
                <div className="mb-3 text-amber-400 tracking-widest">{"★".repeat(current.rating)}{"☆".repeat(5 - current.rating)}</div>
              )}
              <p className="font-head text-lg mb-4" style={{ color: palette.text }}>"{current.quote}"</p>
              <p className="font-semibold text-sm" style={{ color: palette.text }}>{current.name}</p>
              <p className="text-xs" style={{ color: palette.textFaint }}>{current.role}{current.company && `, ${current.company}`}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-center gap-2 mt-6">
          {items.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setIdx(i)}
              className="w-2.5 h-2.5 rounded-full transition"
              style={{ background: i === idx ? `linear-gradient(90deg, ${primary}, ${secondary})` : palette.surface2 }}
              aria-label={`Testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
