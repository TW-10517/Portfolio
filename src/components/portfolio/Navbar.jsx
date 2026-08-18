import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePortfolioTheme } from "./ThemeContext.jsx";
import { useActiveSection, useScrolledState } from "../../hooks/useActiveSection.js";

const SECTIONS = [
  ["hero", "Home"],
  ["about", "About"],
  ["skills", "Skills"],
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["education", "Education"],
  ["testimonials", "Testimonials"],
  ["contact", "Contact"],
];

export function Navbar({ scrollRootEl }) {
  const { data, palette, mode, setMode, primary, secondary } = usePortfolioTheme();
  const [open, setOpen] = useState(false);
  const ids = SECTIONS.map((s) => s[0]);
  const active = useActiveSection(ids, scrollRootEl);
  const scrolled = useScrolledState(20, scrollRootEl);
  const initials = (data.profile.name || "P")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const scrollTo = (id) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <nav
        className="sticky top-0 z-40 transition-all duration-500"
        style={{
          background: scrolled ? (mode === "light" ? "rgba(246,247,251,0.8)" : "rgba(6,7,13,0.75)") : "transparent",
          backdropFilter: scrolled ? "blur(16px) saturate(160%)" : "none",
          borderBottom: scrolled ? `1px solid ${palette.border}` : "1px solid transparent",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-[76px]">
          <button onClick={() => scrollTo("hero")} className="flex items-center gap-2 font-bold font-head" style={{ color: palette.text }}>
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] text-slate-950"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              {initials}
            </span>
            {data.profile.name}
          </button>

          <div className="hidden md:flex items-center gap-1">
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="relative px-3.5 py-2 text-sm font-medium transition"
                style={{ color: active === id ? palette.text : palette.textDim }}
              >
                {label}
                {active === id && (
                  <motion.span
                    layoutId="pv-nav-underline"
                    className="absolute left-3.5 right-3.5 -bottom-0.5 h-0.5 rounded-full"
                    style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMode(mode === "light" ? "dark" : "light")}
              className="w-11 h-6 rounded-full p-0.5 border shrink-0"
              style={{ borderColor: palette.border, background: palette.surface2 }}
              aria-label="Toggle color mode"
            >
              <span
                className="block w-4.5 h-4.5 rounded-full transition-transform"
                style={{
                  width: 18,
                  height: 18,
                  background: `linear-gradient(135deg, ${primary}, ${secondary})`,
                  transform: mode === "light" ? "translateX(20px)" : "translateX(0)",
                }}
              />
            </button>
            <button
              className="md:hidden flex flex-col gap-1 w-6"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
            >
              <span className="h-0.5 rounded" style={{ background: palette.text, transform: open ? "translateY(6px) rotate(45deg)" : "none", transition: "transform .3s" }} />
              <span className="h-0.5 rounded" style={{ background: palette.text, opacity: open ? 0 : 1, transition: "opacity .2s" }} />
              <span className="h-0.5 rounded" style={{ background: palette.text, transform: open ? "translateY(-6px) rotate(-45deg)" : "none", transition: "transform .3s" }} />
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 md:hidden"
            style={{ background: palette.bg }}
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
          >
            <button className="absolute top-6 right-6 text-2xl" style={{ color: palette.text }} onClick={() => setOpen(false)}>
              &times;
            </button>
            {SECTIONS.map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} className="text-2xl font-head font-semibold" style={{ color: palette.text }}>
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
