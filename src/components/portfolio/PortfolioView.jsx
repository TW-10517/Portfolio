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

// Standalone (share page, visitor preview) the portfolio owns the document,
// so its sections belong in <main>. Embedded in the editor's preview pane the
// page already has a <main> and may only have one — but a plain <div> would
// drop every section out of a landmark and let Hero's <header> register as a
// second banner. A named <section> is a landmark in its own right and, like
// <main>, stops a nested <header> from counting as a banner.
function Sections({ landmark, children }) {
  if (landmark) return <main>{children}</main>;
  return <section aria-label="Portfolio preview">{children}</section>;
}

export function PortfolioView({ data, scrollRootEl, showBrand = true, landmark = true }) {
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
        {/* Every section used to sit outside any landmark, so assistive tech
            had no way to skip the nav and jump to the content. Wrapping them
            also stops Hero's <header> from registering as a second banner
            alongside the navbar — a <header> only counts as one when it isn't
            nested inside <main>.

            Inside the editor's preview pane this renders as a plain <div>:
            the portfolio is embedded in a page that already has its own
            <main>, and a document may only have one. */}
        <Sections landmark={landmark}>
          <Hero />
          <About />
          <Skills />
          <Experience />
          <Projects />
          <Education />
          <Testimonials />
          <Blog />
          <Contact />
        </Sections>
        <Footer scrollRootEl={scrollRootEl} showBrand={showBrand} />
      </div>
    </PortfolioThemeContext.Provider>
  );
}
