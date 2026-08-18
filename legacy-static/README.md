# Alex Rivera — Portfolio

A multi-page, animated personal portfolio built with plain HTML, CSS, and vanilla JavaScript. No build step, no framework — open `index.html` or deploy the folder as-is to any static host.

## File structure

```
portfolio/
├── index.html          Home / landing page (hero, particle canvas, stats, featured work)
├── about.html           Bio, philosophy, hobbies, fun facts, personal timeline, photo gallery
├── skills.html          Skill bars, radial progress rings, tech stack wall, "currently learning"
├── experience.html      Interactive work timeline + impact metrics
├── projects.html        Filterable project grid + case-study modal
├── education.html       Degrees, certification badge wall, awards, publications
├── testimonials.html    Auto-playing testimonial carousel
├── blog.html             Blog post grid with category filter
├── contact.html          Contact form, info, map, FAQ accordion
├── styles.css            Shared design system (theme tokens, components, responsive rules)
├── script.js              Shared interactions (see below)
├── assets/                Put your resume PDF, real photos, and other media here
└── README.md
```

All nine pages share `styles.css` and `script.js` and repeat the same `<nav>`, mobile menu, and `<footer>` markup so each page works standalone as a real HTML file (no templating engine).

## What's implemented

- Full-screen animated hero with a mouse-reactive canvas particle field, typing role cycler, staggered heading reveal, floating shapes, and parallax blobs
- Loading screen, custom dot+ring cursor (desktop only), magnetic buttons, button ripple effect
- Scroll-triggered fade/slide/scale reveals (`data-reveal` attribute) via `IntersectionObserver`
- Animated stat counters, skill progress bars, and SVG progress rings
- Sticky navbar that solidifies on scroll, active-link underline, full-screen mobile menu overlay
- Dark/light theme toggle persisted to `localStorage`
- 3D tilt effect on cards (`.tilt` class), flip cards, expandable timeline entries, FAQ accordion
- Filterable project masonry grid with a case-study modal populated from `data-*` attributes on each card
- Auto-playing testimonial carousel with dots + arrows
- Floating-label contact form with a simulated submit (loading spinner → success message) — wire up a real backend/API before going to production
- Lightbox photo gallery, back-to-top button, Konami-code easter egg (`↑ ↑ ↓ ↓ ← → ← → b a`)

## Customizing

1. **Find placeholders fast** — search the project for the string `REPLACE`; every placeholder image, bio line, job, project, testimonial, and social link is marked with an HTML comment (`<!-- REPLACE -->`) or inline note.
2. **Personal details** — name, tagline, and roles live in the hero section of `index.html` (`data-roles` on `#typed`, and the `<h1>` reveal words). The same brand name/logo mark (`AR`) appears in the navbar and footer on every page — replace all instances.
3. **Images** — everything currently points at `https://placehold.co/...`. Swap each `src` for a real image URL or a local file under `assets/`.
4. **Resume** — drop your PDF at `assets/resume.pdf`; the "Download CV" buttons already link there.
5. **Colors/fonts** — edit the CSS custom properties at the top of `styles.css` (`:root`): `--accent`, `--accent-2`, `--accent-3`, `--font-head`, `--font-body`. Swap the Google Fonts `<link>` in each page's `<head>` if you change fonts.
6. **Projects/testimonials/blog posts** — each project card on `projects.html` carries its case-study content as `data-*` attributes (title, image, description, problem, solution, tech, features, links) that the JS modal reads directly — edit those attributes rather than writing new modal markup.
7. **Contact form** — `script.js` currently fakes a submit after ~1.4s. Point it at your real backend (Formspree, a serverless function, etc.) inside the `#contact-form` submit handler.
8. **Map & Calendly** — `contact.html` has a placeholder map image and a "Book a Meeting" link (`href="#"`) — swap in a real embed/URL.

## Deploying

No build step required. Push the folder to GitHub and enable **GitHub Pages**, or drag-and-drop the folder into **Netlify** / **Vercel**. Just make sure `index.html` stays at the project root.
