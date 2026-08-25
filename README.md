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
npm test            # vitest run — 298 tests across 30 files
npm run test:pg     # the server suites again, against real PostgreSQL (PGlite)
npm run test:e2e    # playwright — 33 browser specs on isolated ports
npm run test:all    # both
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

**SQLite or Postgres — `DATABASE_URL` decides.** A path (or nothing) gets SQLite; a `postgres://` URL gets PostgreSQL. Nothing else changes and the schema is created on first boot either way. See "Choosing a database" below. `JWT_SECRET` must be set to a real secret in production; the code falls back to a well-known insecure default if unset.

## Routes

| Route | What it is |
|---|---|
| `#/editor` | Editor (left: tabbed form) + Live Preview (right, with Desktop/Tablet/Mobile toggle). Auth required. |
| `#/preview` | Full-screen "Preview as Visitor" view of your **current draft** (opens in a new tab from the editor) |
| `#/p/:slug` | The **published** portfolio (the app's own route) |
| `/p/:slug` | The **share link** — served by the API with that portfolio's link-preview tags, then redirects here |
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

298 tests across 30 files (Vitest, plus Supertest for the API and Testing Library for components):

- **API integration** — `server/routes/auth.integration.test.js`, `portfolio.integration.test.js` (real HTTP against the Express app, real SQLite)
- **Auth units** — `server/auth.test.js` (hashing, JWT, validation rules)
- **AI** — `factGuard.test.js` (the grounding guard), `LocalProvider.test.js` (word-cap sentence trimming)
- **Video** — `sceneBuilder.test.js`, `timing.test.js`, `exportFormat.test.js`, `player.test.js`
- **Components** — `ShareModal.test.jsx` (publish state and view count), `RequireAuth.test.jsx` (the editor guard), `ImageUpload.test.jsx` (upload limits and failure handling), `Modal.test.jsx` (focus trap, Escape, focus restore)
- **Store** — `usePortfolioStore.test.js`, `useAuthStore.test.js` (expired-session handling)
- **Security** — `sanitizeUrl.test.js` (link scheme allowlist), `server/validatePortfolio.test.js` (save-time structural checks), `server/RateLimitStore.test.js` (persistent rate limiting, on both backends)
- **Database** — `server/sql.test.js` (placeholder renumbering); every `server/**` suite also runs against PostgreSQL via `npm run test:pg`
- **Sharing** — `server/preview.test.js` and `server/routes/preview.integration.test.js` (per-portfolio link previews, and that a private one leaks nothing)
- **Images** — `server/routes/images.integration.test.js` (upload, sniffing, dedup, immutable serving), `server/imageGc.test.js` (deletion actually deletes), `imageUrl.test.js`, `inlineStoredImages.test.js`
- **Languages** — `voices.test.js` (every phrase, every style, every language)
- **Utils** — `slug.test.js`, `sanitizeCss.test.js`, `textMetrics.test.js`, `exportImport.test.js`

Component suites opt into a DOM per file with a `// @vitest-environment jsdom`
docblock; everything else runs in plain Node, so the fast majority of the suite
skips jsdom's startup cost.

### Browser end-to-end tests

```bash
npm run test:e2e
```

33 Playwright specs in `e2e/`, because almost every serious bug this project
has had was invisible to unit tests: narration cut off mid-sentence, an export
that claimed to have audio and didn't, a share modal that hid your own link
when you reopened it, focus escaping a dialog, a scene duration field that
turned "30" into "3025".

- `auth.spec.js` (9) — register, login, logout, guard redirects, session expiry
- `share.spec.js` (8) — publish, republish, unpublish, the public share page, link-preview tags
- `sync.spec.js` (4) — edits surviving a reload and reaching a second browser context
- `a11y.spec.js` (4) — axe-core over login, both editor modes, the portfolio
- `editor.spec.js` (4) — tab navigation, adding and removing entries, autosave
- `video.spec.js` (4) — script generation, a non-blank rendered frame, retiming a scene, playback

`playwright.config.js` starts both servers itself on ports 4001/5174 against
`server/e2e.sqlite`, so a run never touches the dev database or spends the dev
server's rate-limit budget. The frontend is a production build served by `vite
preview` rather than the dev server: on-demand module transforms made a cold
lazy chunk slow enough under two workers to time out assertions, and serving
the bundle means the suite exercises what users actually download. (Rate limits are persisted now, so a shared
database meant repeated runs eventually tripped the registration limiter.) A
single run also registers ~35 accounts from one address, more than the 30/15min
production budget allows, so the config sets `RATE_LIMIT_SCALE=20` — a knob
`server/rateLimit.js` ignores entirely when `NODE_ENV=production`, so it can't
weaken a live server.

`.github/workflows/ci.yml` runs the Vitest suite on SQLite, the server suites
again on PostgreSQL, a production build and the Playwright suite on every push
and pull request, and asserts that the server still refuses to boot in
production with the insecure dev `JWT_SECRET`.

### Clearing test accounts

Browser-driven QA registers a throwaway account each run. To tidy the dev
database:

```bash
npm run db:clear-test-users            # removes *@example.com and their portfolios
npm run db:clear-test-users -- '%@qa.local'
```

## Project structure

```
server/
  index.js              Binds the port (nothing else)
  app.js                Express app: CORS, JSON body parsing, mounts routers — importable by tests
  sql.js                One async query interface over SQLite and PostgreSQL; picks one from DATABASE_URL
  schema.js             The DDL for each dialect, plus the idempotent column migrations
  db.js                 What everything else imports: runs the migration, re-exports sql
  preview.js            Builds the link-preview document for a shared portfolio
  auth.js               Password hashing, JWT signing/verification, validation, requireAuth middleware
  rateLimit.js          Per-purpose rate limiters (login / register / token flows)
  RateLimitStore.js     Persists those counters in whichever database is in use
  validatePortfolio.js  Structural + URL checks run before anything is written
  routes/
    auth.js               /api/auth/* — register, login, logout, me, reset, verify, change-password, delete
    portfolio.js          /api/portfolios/mine (auth), /by-slug/:slug + /unlock (public)
    images.js             /api/images — content-addressed upload and immutable serving
    preview.js            /p/:slug — link-preview tags for crawlers, redirect for humans
src/
  components/
    auth/               RequireAuth (route guard), AccountModal
    editor/             Tab* components (incl. TabAIVideo), PreviewPane, TabShell, ResumeImportModal
    portfolio/          Rendered sections (Hero, About, Skills, Projects, ...) + ThemeContext
    share/              ShareModal, PasswordGate
    ui/                 Field, Button, Modal, Toggle, TagInput, ReorderList, ImageUpload, ColorPicker, StringListManager
    ErrorBoundary.jsx
  services/
    ai/                 AIProvider (contract), LocalProvider, voices (per-language phrasing), OllamaProvider, GeminiProvider, factGuard, index (selection)
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

## Choosing a database

```
DATABASE_URL=                            # SQLite at server/data.sqlite
DATABASE_URL=./data/portfolio.sqlite     # SQLite somewhere else
DATABASE_URL=postgres://user:pw@host/db  # PostgreSQL
DATABASE_URL=pglite                      # PostgreSQL in WASM, in-process (tests)
```

SQLite is the default and is the right answer for a single host with a real
disk: no service, no credentials, no setup. Postgres exists for the case that
actually breaks SQLite — hosting with an **ephemeral filesystem**, where the
database file quietly disappears on every redeploy. The free tier of Supabase,
Neon or Render covers it, so this stays inside the project's "nothing paid is
required" rule.

`server/sql.js` is one async interface over both. Everything is async even on
SQLite, where the driver is synchronous — an interface that changes shape per
backend is how you end up with a Postgres path nobody ever runs. Queries are
written once with `?` placeholders and renumbered to `$1…` for Postgres.
`server/schema.js` holds the DDL for each dialect written out in full rather
than generated, because they differ in exactly three ways (identity columns,
`BLOB` vs `BYTEA`, and the fact that timestamps are now generated in JS
precisely so `datetime('now')` and `now()` never have to be reconciled).

**The Postgres path is tested, not just written.** `npm run test:pg` runs the
entire server suite — every integration test, byte-for-byte the same
assertions — against real PostgreSQL 18 via
[PGlite](https://pglite.dev), which compiles Postgres to WASM and runs
in-process with no server to install. 97 tests, both backends, in CI.

The differences that actually bit, all of which the suite now covers: `MAX()`
is a scalar in SQLite and an aggregate in Postgres (`GREATEST`); `BIGINT` comes
back as a *string*, so a rate-limit window compared as `"1756…" <= 1756…` and
never expired; `SUM()` returns numeric, which arrives as a string too; and
Postgres has no `lastInsertRowid`, so inserts need `RETURNING id`.

`npm run db:backup` is SQLite-only and says so rather than pretending to work —
on Postgres that's `pg_dump`'s job.

A database that won't open is reported as a configuration problem — the URL
with its password redacted, the driver's message, and a line about what that
usually means — rather than as a stack trace from inside a connection pool.

Hosted providers that require TLS work as-is: `pg` parses `?sslmode=require`
straight from the connection string, so a Neon or Supabase URL needs nothing
added.

**One caveat worth knowing.** The Postgres suite runs against PGlite, which is
the same engine but in-process. The `pg`-over-TCP path — pooling, TLS,
reconnects — is not exercised by any test here. Point a staging instance at it
before it holds real accounts.

## Share links and previews

A share link is `https://<api-host>/p/<slug>`, not the app's own `#/p/<slug>`.

That looks like a detour and is the whole point. Slack, LinkedIn, WhatsApp and
iMessage unfurl a link by fetching it and reading `<head>` — they don't run
JavaScript, and a URL fragment is never sent to a server at all, so every
shared portfolio used to preview as an identical "Portfolio Builder" card.
`server/preview.js` answers `/p/:slug` with that portfolio's own title,
description and image, then bounces a human straight on to the app. The
portfolio itself is still rendered entirely in the browser — nothing about the
app became server-rendered.

A private or password-protected portfolio previews exactly like a slug that
doesn't exist: same status, same bytes. Anything else would let anyone holding
the link confirm whose it is without entering the password. Crawler hits don't
touch the view counter.

## Image storage

Uploads go to the API (`server/routes/images.js`) and the portfolio keeps a
short URL. They used to be base64'd into the portfolio JSON itself, which meant
every save re-uploaded every photo and enough images made the document
impossible to save at all.

- **Content-addressed.** The URL is the SHA-256 of the bytes, so re-uploading
  the same file costs nothing and the response can be cached forever —
  the content at a given hash can't change.
- **Stored relative** (`/api/images/<hash>.webp`) and resolved against the API's
  origin at render time (`src/utils/imageUrl.js`). An absolute URL would bake
  the development host into a portfolio that later gets served from production.
- **Sniffed, not trusted.** The bytes have to actually start with a PNG, JPEG,
  WebP or GIF header. SVG is refused outright: it's a document that can carry
  script, and serving it from our own origin would make every upload a stored
  XSS vector.
- **Still downscaled first** — 1600px, WebP — so what gets stored is around
  500KB rather than several megabytes.
- **Exports stay self-contained.** `inlineStoredImages()` puts the bytes back
  into the JSON on the way out, so a downloaded portfolio is still a file you
  can keep or import anywhere.
- If the upload can't happen (offline, server down, storage full) the inline
  copy is kept instead, so the editor never loses a picture you just chose. A
  refusal from the server is shown next to the control — a full quota used to
  look like success and then resurface as a confusing save failure.
- **Deleted when nothing claims them** (`server/imageGc.js`). Deleting your
  account takes your pictures with it; bytes another account is also using
  survive, because storage is shared by content. Replacing a photo releases the
  old one on your next save, after an hour's grace so a save from a second tab
  can't reap something you uploaded a moment ago.

## Narration languages

The offline writer speaks all three languages the app offers — English,
Japanese and Tamil — with no model, no account and no network call. The
phrasing banks are in `src/services/ai/voices.js`: one per language, each with
all four styles, plus the bits that differ structurally rather than lexically
(Japanese joins lists with `、` and runs clauses together without spaces;
a degree reads "MIT のBSc" there and "BSc from MIT" in English).

Your own content is never translated. Names, companies, job titles and quotes
are reproduced exactly as you wrote them — the writer supplies the sentence
around them and nothing else, which is the same rule that stops it inventing
facts.

## Deploying

The frontend is a static build (`npm run build` → `dist/`) — deploy to Netlify, Vercel, or GitHub Pages with no rewrite rules, since routing is hash-based. The API needs a Node host and a writable disk for SQLite (or the Postgres swap described above). Before deploying, set in `.env`:

- `JWT_SECRET` — a long random string (**required**; there's an insecure dev fallback otherwise)
- `CORS_ORIGIN` — your real frontend origin(s); the API rejects anything not listed
- `VITE_API_URL` — where the browser should reach the API, if it isn't `localhost:4000`
- `FRONTEND_URL` — the base for reset/verification links, and where `/p/:slug` sends a human after a crawler has read its preview tags

(`legacy-static/` isn't part of the Vite build and would need deploying separately.)

## Security and accessibility

**Link schemes are allowlisted.** Portfolio URLs are author-supplied and are
rendered into `href` for everyone who opens a share link. `javascript:` in one
of those fields used to be stored and served verbatim — React only warns about
those, it does not block them. Every user URL now passes through
`sanitizeUrl()` (`src/utils/sanitizeUrl.js`), which permits `http`, `https`,
`mailto` and `tel`, plus inline PDFs for the resume download, and strips
control characters first so `java&#9;script:` can't walk past the check. A
rejected URL renders with no `href` at all rather than a broken link.

**Saves are validated server-side.** `PUT /portfolios/mine` used to accept any
JSON at all. `server/validatePortfolio.js` now enforces a size budget, a
nesting depth limit, a node count, per-string limits, the same URL scheme rules,
and rejects `__proto__`/`constructor`/`prototype` keys — which survive
`JSON.parse` as own properties and can poison whatever merges the document
later. The client sanitizes too, but the client is the part an attacker
controls.

**Rate limit counters are persisted.** `express-rate-limit`'s default store
lives in process memory, so every restart handed out a fresh allowance and
nothing was shared between workers. `server/RateLimitStore.js` keeps them
in the database that is already the source of truth.

**Dialogs trap focus.** `src/components/ui/Modal.jsx` moves focus into the
panel on open, cycles Tab and Shift+Tab within it, closes on Escape, and
restores focus to whatever opened it. Each dialog carries
`role="dialog" aria-modal="true"` and its own label. Visibility is decided from
computed style rather than `getClientRects()`, which returns empty under a test
renderer and would silently degrade the trap to "focus the panel".

**An expired or revoked token ends the session cleanly.** `src/utils/api.js`
reports any 401 on an authenticated request to `useAuthStore`, which clears the
token and flags `sessionExpired` so the user is told why they were signed out
instead of watching saves fail silently.

**Dependencies are clean.** `npm audit` reports zero vulnerabilities; getting
there needed major bumps of `vite` (5 → 8) and `react-router-dom` (6 → 7) plus
a `tar` override in `package.json` for a transitive advisory with no upstream
fix.

**Accessibility is audited with axe-core.** The login page, both editor modes
and the rendered portfolio report zero violations at every impact level. Getting
there meant labelling controls whose only label was a neighbouring `<span>`,
raising two text colours that measured 4.23:1 and 3.49:1 against the 4.5:1
minimum, underlining inline links that failed the 3:1 non-colour distinction,
and adding the `<main>`/`<aside>` landmarks the app had none of. When embedded
in the editor's preview pane the portfolio renders its sections as a labelled
`<section>` rather than `<main>`, since a document may only have one.

## Known gaps

- **No email delivery.** Reset and verification links go to the API server's console. Wire a provider into `deliverLink()` in `server/routes/auth.js`.
- **Backups are your job on SQLite.** `npm run db:backup` takes a consistent snapshot via SQLite's online backup API (safe on a live WAL database, unlike `cp`) and keeps the newest 10 in `server/backups/`, but nothing schedules it for you. On Postgres, backups are whatever your host provides.
- **Non-English quality from a *local model* is the model's.** The built-in offline writer handles all three languages itself (see "Narration languages"), but if you point the app at Ollama instead, capability varies sharply by model — `qwen2.5:3b` handles Japanese well and Tamil poorly — so a scene the model can't write in the chosen language is rejected and falls back to English rather than shipping nonsense.
- **On-screen text stays in the portfolio's own language.** Only the narration and captions are written in the chosen language; names, roles, companies, quotes and skill chips are rendered from your portfolio fields verbatim. That is deliberate — translating someone's job title or their client's testimonial would be inventing content.
- **Video export depends on browser support, and can't be fixed from here.** `MediaRecorder` MP4 muxing and `getDisplayMedia` audio capture vary by browser. The export picks the best container the browser supports and degrades to WebM rather than failing, and it reports afterwards whether narration was actually captured instead of claiming it was. The audio detour exists because `speechSynthesis` output cannot be captured programmatically by any browser API — there is no way to route it into a `MediaStream`, so a tab-audio share is the only route. Shipping a WASM TTS engine purely to work around that would cost more than it's worth.
