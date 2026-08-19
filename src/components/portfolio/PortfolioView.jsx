import { useEffect, useMemo, useState } from "react";
import { PortfolioThemeContext, buildPalette } from "./ThemeContext.jsx";
import { useEffectiveMode, useGoogleFonts } from "../../hooks/useTheme.js";
import { sanitizeCustomCss } from "../../utils/sanitizeCss.js";
import { Navbar } from "./Navbar.jsx";
import { Hero } from "./Hero.jsx";
import { About } from "./About.jsx";
import { Skills } from "./Skills.jsx";
import { Experience } from "./Experience.jsx";
import { Projects } from "./Projects.jsx";
import { Education } from "./Education.jsx";
import { Testimonials } from "./Testimonials.jsx";
import { Blog } from "./Blog.jsx";
import { Contact } from "./Contact.jsx";
import { Footer } from "./Footer.jsx";

export function PortfolioView({ data, scrollRootEl, showBrand = true }) {
  const initialMode = useEffectiveMode(data.theme.mode);
  const [mode, setMode] = useState(initialMode);
  useEffect(() => setMode(initialMode), [initialMode]);
  useGoogleFonts(data.theme.headingFont, data.theme.bodyFont);

  const palette = useMemo(() => buildPalette(mode), [mode]);
  const animationLevel = data.theme.animationLevel;
  const safeCustomCss = useMemo(() => sanitizeCustomCss(data.theme.customCss), [data.theme.customCss]);

  const ctx = useMemo(
    () => ({
      data,
      palette,
      mode,
      setMode,
      primary: data.theme.primary,
      secondary: data.theme.secondary,
      animationLevel,
    }),
    [data, palette, mode, animationLevel]
  );

  return (
    <PortfolioThemeContext.Provider value={ctx}>
      <div
        className={`min-h-full ${animationLevel === "none" ? "motion-none" : ""}`}
        style={{
          background: palette.bg,
          color: palette.text,
          fontFamily: data.theme.bodyFont + ", sans-serif",
          "--font-head": data.theme.headingFont + ", sans-serif",
        }}
      >
        {safeCustomCss && <style>{safeCustomCss}</style>}
        <Navbar scrollRootEl={scrollRootEl} />
        <Hero />
        <About />
        <Skills />
        <Experience />
        <Projects />
        <Education />
        <Testimonials />
        <Blog />
        <Contact />
        <Footer scrollRootEl={scrollRootEl} showBrand={showBrand} />
      </div>
    </PortfolioThemeContext.Provider>
  );
}
