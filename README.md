# Portfolio Builder

A no-code portfolio builder: an **Editor** (10 tabs of structured content + theme controls), a **Live Preview** that updates instantly with a device-size toggle and a **Preview as Visitor** button, and a **Share** flow that publishes a snapshot to a shareable link with a QR code, visibility controls, and password protection.

This is the MVP variant described in the brief — React SPA, no backend, no accounts. All data lives in your browser's `localStorage`.

> **`legacy-static/`** holds an earlier, separate deliverable: a hand-built 9-page static HTML/CSS/JS portfolio (no editor, hardcoded content). It's kept here for reference only — it doesn't share any code with the app in `src/` and isn't part of the Vite build. Open `legacy-static/index.html` directly in a browser to view it.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL — it redirects to `#/editor`.

```bash
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Routes

| Route | What it is |
|---|---|
| `#/editor` | Editor (left: tabbed form) + Live Preview (right, with Desktop/Tablet/Mobile toggle) |
| `#/preview` | Full-screen "Preview as Visitor" view of your **current draft** (opens in a new tab from the editor) |
| `#/p/:slug` | The **published** portfolio at your share link |

Routing uses a hash (`#/...`) so the whole app can be deployed as static files with zero server config.

## Editor/Preview split

The divider between the Editor and Preview panes (desktop only) is draggable — grab it to resize either side. The width is saved to `localStorage` and restored next time you open the editor.

## Resume auto-fill (Profile tab → "✨ Auto-fill from resume")

Upload a PDF resume and it's parsed **entirely client-side** — no AI, no API key, no upload to any server, so it works the same on every machine you share this app with. Under the hood: [`pdf.js`](https://mozilla.github.io/pdf.js/) extracts the raw text and font sizes in-browser, then keyword/regex heuristics guess your name (largest text near the top), email, phone, LinkedIn/GitHub/website, skills (matched against a curated keyword list), and rough experience/education entries from date-range patterns.

This is heuristic text-matching, not language understanding — it's reliable for contact info and skill keywords, but experience/education parsing is approximate (arbitrary resume layouts confuse it). That's why the review screen shows every detected item with a checkbox: profile fields and skills are pre-checked, experience/education entries are **unchecked by default** and meant to be spot-checked before you click "Apply selected to portfolio." Nothing is written to your portfolio without you reviewing it first.

`pdfjs-dist` (and its worker, ~1.3MB) is only downloaded the first time someone opens this modal — it's not part of the app's initial page load.

A smarter, in-browser-LLM-based version of this (e.g. via WebLLM) is a possible future upgrade, but it would require a large model download (500MB–2GB) and only works on WebGPU-capable browsers — heuristics were chosen instead so the feature works for everyone you share the app with.

## How data flows

- Everything you type in the Editor lives in a Zustand store (`src/store/usePortfolioStore.js`) and is auto-persisted to `localStorage` under `portfolio-builder:draft` on every change — that's your **draft**.
- **Preview as Visitor** (`#/preview`) renders that same draft full-screen with all editor chrome hidden, so you can see exactly what a visitor would see before publishing.
- **Publish** (Share button → Publish) snapshots the current draft into `localStorage` under `portfolio-builder:published:<slug>`, independent from the draft. Editing afterward doesn't change the published version until you hit Publish/Republish again.
- The share link (`#/p/<slug>`) reads that published snapshot, applies visibility rules (public / private / password-gated), and increments a view counter stored alongside it.

**Known MVP limitation:** because there's no backend, published links only resolve on the same browser/device they were published from — this is the tradeoff called out explicitly in the brief for the no-auth MVP path. For a link that works anywhere, use **Export JSON** (top bar) to hand off the file, or move to the Next.js + Supabase path in the original spec for real multi-device hosting.

## Editor tabs

Profile · About Me · Skills (categories + proficiency sliders + "Currently Learning") · Experience (drag-to-reorder) · Projects (drag-to-reorder, category-filtered case studies) · Education & Certifications · Testimonials · Blog (toggleable) · Contact Settings (toggle visible fields, form delivery method, FAQ) · Theme & Design (palette presets, custom colors, fonts, hero/project/experience layout variants, animation level, custom CSS).

Image fields accept a pasted URL or a local file upload (stored as a data URL — keep uploads under 2MB since everything lives in `localStorage`).

## Theme system

`theme.primary` / `theme.secondary` drive every gradient and accent across the rendered portfolio. `theme.mode` (dark / light / auto) sets the default; visitors can still flip the navbar toggle locally. `theme.animationLevel` (full / subtle / none) controls scroll-reveal and bar-fill animation intensity, and `none` also fully satisfies `prefers-reduced-motion` users. Fonts are loaded from Google Fonts dynamically based on your tab selections.

## Project structure

```
src/
  components/
    editor/       Tab* components, PreviewPane, TabShell
    portfolio/     Rendered sections (Hero, About, Skills, Projects, ...) + ThemeContext
    share/          ShareModal, PasswordGate
    ui/               Reusable inputs: Field, Button, Modal, Toggle, TagInput, ReorderList, ImageUpload, ColorPicker
  data/defaults.js  Default seeded portfolio content (persona used for placeholders)
  hooks/               useTyping, useActiveSection, useTheme, useScrolledState
  pages/               EditorPage, PreviewPage, SharePage
  store/               usePortfolioStore.js (Zustand + localStorage persistence, publish/unpublish)
  utils/                 uid, slug, exportImport
legacy-static/          Earlier standalone static-HTML portfolio (reference only, not built by Vite)
```

## Deploying

Static build (`npm run build` → `dist/`) — drag-and-drop `dist/` into Netlify or Vercel, or push to GitHub Pages. No rewrite rules needed since routing is hash-based. (This only builds the app in `src/`; `legacy-static/` is unaffected and would need to be deployed separately if you ever want it live.)

## Not implemented in this MVP

Per the scope agreed for this pass (no cloud credentials available): user accounts/auth, a real database, cross-device share links, and server-rendered SEO for the share page. The original spec's "Full SaaS" path (Next.js + Supabase + NextAuth) covers all of these if/when you're ready to stand up those services.
