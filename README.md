# Portfolio Builder

A no-code portfolio builder: an **Editor** (11 tabs of structured content + theme controls), a **Live Preview** that updates instantly with a device-size toggle and a **Preview as Visitor** button, an **AI Video** generator that narrates your portfolio and records it to a downloadable MP4, and a **Share** flow that publishes to a real database-backed link with a QR code, visibility controls, and password protection.

This started as a no-backend MVP (React SPA, `localStorage` only). It now has a **real backend** (`server/`: Express + SQLite) with accounts, password reset, email verification, and a `portfolios` table — and the Editor's publish flow is wired through it, so **share links work across devices and browsers**.

> **`legacy-static/`** holds an earlier, separate deliverable: a hand-built 9-page static HTML/CSS/JS portfolio (no editor, hardcoded content). It's kept here for reference only — it doesn't share any code with the app in `src/` and isn't part of the Vite build. Open `legacy-static/index.html` directly in a browser to view it.

## Quick start

```bash
npm install
npm run dev:all
```

`dev:all` runs both halves — you want this. Open the printed Vite URL; `/editor` requires an account, so you'll be redirected to `/register` first.

```bash
npm run dev:all     # Vite frontend + Express/SQLite backend together (what you normally want)
npm run dev         # frontend only
npm run dev:server  # backend only (http://localhost:4000)
npm run build       # production build to dist/
npm run preview     # serve the production build locally
npm test            # vitest run — 130 tests across 11 files
```

No configuration is needed for local dev: the SQLite file is auto-created and safe defaults cover every environment variable. See `.env.example` for what to set before deploying.

## Accounts & backend

`server/` is an Express API over SQLite (`server/data.sqlite`, auto-created, gitignored). `server/app.js` builds the app and `server/index.js` only binds the port, so tests can import the app without starting a server.

**Auth** (`/api/auth`) — bcrypt-hashed passwords, JWT session tokens (30-day expiry), with a `token_version` column on each user that `requireAuth` checks on every request — logging out, changing your password, or completing a reset bumps it and instantly invalidates every token issued before that point:

| Endpoint | What it does |
|---|---|
| `POST /register`, `POST /login`, `POST /logout` | Session lifecycle |
| `GET /me` | The signed-in user for a valid token |
| `POST /forgot-password`, `POST /reset-password` | Token-based reset |
| `POST /verify-email`, `POST /resend-verification` | Email verification |
| `POST /change-password` | Requires the current password |
| `DELETE /me` | Deletes the account and its portfolio, password-confirmed |

Validation rules are enforced twice — client-side in `LoginPage.jsx`/`RegisterPage.jsx` for instant feedback, and server-side in `server/auth.js` as the source of truth: name required, valid email format, password ≥8 characters with at least one letter and one number, duplicate emails rejected.

**Rate limiting** (`server/rateLimit.js`) — separate 15-minute counters per purpose rather than one shared limiter, so a burst of password-reset requests can't lock someone out of logging in. Login is tightest (20/window) as the classic credential-stuffing target; register and the token flows get 30.

**Portfolios** (`/api/portfolios`) — `GET/PUT/DELETE /mine` (auth required), plus public `GET /by-slug/:slug` and `POST /by-slug/:slug/unlock`. Password gating is enforced server-side: the password is never sent to the client for a protected portfolio, only the content after a correct `/unlock` call.

> **No email provider is wired up** — by design, so the app never requires connecting a third-party mail service. Password-reset and verification links are printed to the API server's console instead (`deliverLink()` in `server/routes/auth.js`). Copy the link from the terminal to complete either flow locally, and swap in a real provider there before relying on it in production.

**Moving to a hosted database:** `server/db.js` opens `better-sqlite3` against a local file path from `DATABASE_URL` (default `server/data.sqlite`) — it does not speak Postgres. To deploy against a hosted database (e.g. Supabase), swap `better-sqlite3` for a Postgres client (`pg` or `postgres.js`) and update the `CREATE TABLE`/query syntax in `server/db.js` and `server/routes/*.js` (SQLite and Postgres SQL differ — e.g. `AUTOINCREMENT` vs `SERIAL`). `JWT_SECRET` must also be set to a real secret in production; the code falls back to a well-known insecure default if unset.

## Routes

| Route | What it is |
|---|---|
| `#/editor` | Editor (left: tabbed form) + Live Preview (right, with Desktop/Tablet/Mobile toggle). Auth required. |
| `#/preview` | Full-screen "Preview as Visitor" view of your **current draft** (opens in a new tab from the editor) |
| `#/p/:slug` | The **published** portfolio at your share link |
| `#/login`, `#/register` | Account entry |
| `#/forgot-password`, `#/reset-password/:token` | Password reset |
| `#/verify-email/:token` | Email verification |

Routing uses a hash (`#/...`) so the frontend can be deployed as static files with zero rewrite rules.

## Editor tabs

Profile · About Me · Skills (categories + proficiency sliders + "Currently Learning") · Experience (drag-to-reorder) · Projects (drag-to-reorder, category-filtered case studies) · Education & Certifications · Testimonials · Blog (toggleable) · Contact Settings (toggle visible fields, form delivery method, FAQ) · Theme & Design (palette presets, custom colors, fonts, hero/project/experience layout variants, animation level, custom CSS) · **🎬 AI Video**.

Image fields accept a pasted URL or a local file upload (stored as a data URL — keep uploads under 2MB).

## AI Video

The AI Video tab turns the portfolio you've already filled in into a narrated video, entirely in the browser. Pipeline:

1. **Scene plan** (`services/video/sceneBuilder.js`) — deterministic, no AI. It picks *which* real facts appear and how many narration words each scene gets, weighted by the audience you choose (a recruiter plan front-loads experience; a client plan front-loads projects) and fitted to a length target: Short (30–45s), Standard (60–90s), or Detailed (2–3 min).
2. **Narration** (`services/ai/` + `services/video/aiWriter.js`) — an AI provider phrases the facts the planner selected. Scene duration is derived from the resulting word count, so timing always matches what's actually spoken.
3. **Playback and export** (`services/video/player.js`, `sceneRenderer.js`, `captions.js`, `tts.js`, `exportVideo.js`) — scenes are drawn to a 1280×720 canvas, narrated with the browser's built-in `SpeechSynthesis`, captioned from the known script (no speech recognition needed), and recorded via `MediaRecorder`.

### AI providers

Selected automatically in this order, and swappable in the tab. **Nothing here ever requires payment or a mandatory API key.**

| Provider | Setup | Notes |
|---|---|---|
| **Ollama** (preferred) | Run Ollama locally; the tab lists your installed models | A genuine LLM that costs nothing, needs no account, and never sends your portfolio off the machine |
| **Gemini** | Paste your own API key (stored in `localStorage`) | Optional cloud fallback. Never called unless you supply a key, and ignored entirely while a local model is selected |
| **Basic (offline)** | Always available | Deterministic template writer — instant, no network, no key. Also the per-scene fallback whenever a model errors out |

### The grounding guard

The hard rule is that the AI may **rephrase** your portfolio, never **add** to it. A prompt instruction isn't enough — small local models will happily turn an empty location field into "Based in the United States". So `services/ai/factGuard.js` checks generated text against the facts it was given and throws if the model introduced a proper noun or number the portfolio doesn't contain; that scene is then rewritten by the offline template writer, which can only restate real fields. Empty fields are stripped from the brief entirely before a model sees them, so there's no blank left inviting a guess.

The check is deliberately narrow — it flags proper nouns and digits (companies, titles, certifications, statistics, dates) rather than trying to judge vague adjectives, so legitimate rephrasing survives.

### Export

`recordScenePlan()` prefers **MP4 (H.264 + AAC)** since that's what editors, phones, and upload forms accept without conversion, falling back through WebM variants based on what the browser's `MediaRecorder` supports; the download filename always matches what was actually recorded. Narration audio is captured via `getDisplayMedia` if you grant it. Note that the voice comes from the *operating system's* speech engine rather than the page, so sharing a single tab usually captures silence — pick "Entire Screen" with "Share system audio". The export measures the captured track's actual signal level and tells you which of the three outcomes happened (audio, silence, or no track), instead of claiming success because a track existed. Either way the export succeeds and the burned-in captions carry the script.

## Editor/Preview split

The divider between the Editor and Preview panes (desktop only) is draggable — grab it to resize either side. The width is saved to `localStorage` and restored next time.

## Resume auto-fill (Profile tab → "✨ Auto-fill from resume")

Upload a PDF resume and it's parsed **entirely client-side** — no AI, no API key, no upload to any server. [`pdf.js`](https://mozilla.github.io/pdf.js/) extracts raw text and font sizes in-browser, then keyword/regex heuristics guess your name (largest text near the top), email, phone, LinkedIn/GitHub/website, skills (matched against a curated keyword list), and rough experience/education entries from date-range patterns.

This is heuristic text-matching, not language understanding — reliable for contact info and skill keywords, approximate for experience/education (arbitrary resume layouts confuse it). That's why the review screen shows every detected item with a checkbox: profile fields and skills are pre-checked, experience/education entries are **unchecked by default** and meant to be spot-checked before you click "Apply selected to portfolio."

`pdfjs-dist` (and its worker, ~1.3MB) is only downloaded the first time someone opens this modal — it's not part of the initial page load.

## How data flows

- Everything you type lives in a Zustand store (`src/store/usePortfolioStore.js`), auto-persisted to `localStorage` under `portfolio-builder:draft` on every change — that's your **draft**.
- On sign-in and editor mount, `loadFromServer()` pulls your last-saved server copy. It only overwrites the local draft **if the server's copy is newer** — a blind overwrite here would silently discard any edit made since the last publish, on every page refresh.
- **Preview as Visitor** (`#/preview`) renders the draft full-screen with all editor chrome hidden.
- **Publish** (Share → Publish) calls `PUT /api/portfolios/mine`, writing a snapshot to your row with its slug, visibility, and optional password. Editing afterward doesn't change the published version until you publish again.
- The share link (`#/p/<slug>`) fetches that row from the API, applies visibility rules (public / private / password-gated, enforced server-side), and increments a view counter.

Custom CSS from the Theme tab is passed through `utils/sanitizeCss.js` before being injected into a rendered portfolio, and the whole app is wrapped in an `ErrorBoundary` so a render failure in one section doesn't blank the page.

## Theme system

`theme.primary` / `theme.secondary` drive every gradient and accent across the rendered portfolio. `theme.mode` (dark / light / auto) sets the default; visitors can still flip the navbar toggle locally. `theme.animationLevel` (full / subtle / none) controls scroll-reveal and bar-fill intensity, and `none` also fully satisfies `prefers-reduced-motion` users. Fonts load from Google Fonts based on your tab selections.

## Tests

```bash
npm test
```

130 tests across 11 files (Vitest, plus Supertest for the API):

- **API integration** — `server/routes/auth.integration.test.js`, `portfolio.integration.test.js` (real HTTP against the Express app, real SQLite)
- **Auth units** — `server/auth.test.js` (hashing, JWT, validation rules)
- **AI** — `factGuard.test.js` (the grounding guard), `LocalProvider.test.js` (word-cap sentence trimming)
- **Video** — `sceneBuilder.test.js`, `timing.test.js`, `exportFormat.test.js`, `player.test.js`
- **Utils** — `slug.test.js`, `sanitizeCss.test.js`

## Project structure

```
server/
  index.js              Binds the port (nothing else)
  app.js                Express app: CORS, JSON body parsing, mounts routers — importable by tests
  db.js                 SQLite connection + schema (users, portfolios)
  auth.js               Password hashing, JWT signing/verification, validation, requireAuth middleware
  rateLimit.js          Per-purpose rate limiters (login / register / token flows)
  routes/
    auth.js               /api/auth/* — register, login, logout, me, reset, verify, change-password, delete
    portfolio.js          /api/portfolios/mine (auth), /by-slug/:slug + /unlock (public)
src/
  components/
    auth/               RequireAuth (route guard), AccountModal
    editor/             Tab* components (incl. TabAIVideo), PreviewPane, TabShell, ResumeImportModal
    portfolio/          Rendered sections (Hero, About, Skills, Projects, ...) + ThemeContext
    share/              ShareModal, PasswordGate
    ui/                 Field, Button, Modal, Toggle, TagInput, ReorderList, ImageUpload, ColorPicker, StringListManager
    ErrorBoundary.jsx
  services/
    ai/                 AIProvider (contract), LocalProvider, OllamaProvider, GeminiProvider, factGuard, index (selection)
    video/              sceneBuilder, aiWriter, sceneRenderer, player, tts, captions, exportVideo
  data/                 defaults.js (seeded placeholder content), skillKeywords.js
  hooks/                useTyping, useActiveSection, useTheme
  pages/                EditorPage, PreviewPage, SharePage, Login/Register, Forgot/ResetPassword, VerifyEmail
  store/
    usePortfolioStore.js  Zustand draft + localStorage persistence + server save/load
    useAuthStore.js       Zustand JWT/user session
  utils/                uid, slug, exportImport, parseResume, sanitizeCss, api.js (fetch wrapper)
legacy-static/          Earlier standalone static-HTML portfolio (reference only, not built by Vite)
```

## Deploying

The frontend is a static build (`npm run build` → `dist/`) — deploy to Netlify, Vercel, or GitHub Pages with no rewrite rules, since routing is hash-based. The API needs a Node host and a writable disk for SQLite (or the Postgres swap described above). Before deploying, set in `.env`:

- `JWT_SECRET` — a long random string (**required**; there's an insecure dev fallback otherwise)
- `CORS_ORIGIN` — your real frontend origin(s); the API rejects anything not listed
- `VITE_API_URL` — where the browser should reach the API, if it isn't `localhost:4000`
- `FRONTEND_URL` — the base for reset/verification links

(`legacy-static/` isn't part of the Vite build and would need deploying separately.)

## Known gaps

- **No email delivery.** Reset and verification links go to the API server's console. Wire a provider into `deliverLink()` in `server/routes/auth.js`.
- **SQLite only.** `server/db.js` doesn't speak Postgres — see "Moving to a hosted database" above.
- **No server-rendered SEO** for share pages. The app is a hash-routed SPA, so `#/p/:slug` won't produce link previews or index well; that needs the SSR path (e.g. Next.js) from the original spec.
- **Non-English narration needs a real model, and its quality is the model's.** The offline template writer is English-only; any LLM (local or cloud) can write the other languages, and the tab says so when the active writer can't. Capability varies sharply by model — `qwen2.5:3b` handles Japanese well and Tamil poorly — so a scene the model can't write in the chosen language is rejected and falls back to English rather than shipping nonsense.
- **On-screen text stays in the portfolio's own language.** Only the narration and captions are translated; names, roles, and skill chips are rendered from your portfolio fields verbatim.
- **Video export depends on browser support.** `MediaRecorder` MP4 muxing and `getDisplayMedia` audio capture vary by browser; the export degrades to WebM and/or silent video rather than failing.
