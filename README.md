# Portfolio Builder

A no-code portfolio builder: an **Editor** (11 tabs of structured content + theme controls), a **Live Preview** that updates instantly with a device-size toggle and a **Preview as Visitor** button, an **AI Video** generator that narrates your portfolio and records it to a downloadable MP4, and a **Share** flow that publishes to a real database-backed link with a QR code, visibility controls, and password protection.

This started as a no-backend MVP (React SPA, `localStorage` only). It now has a **real backend** (`server/`: Express + SQLite) with accounts, password reset, email verification, and a `portfolios` table — and the Editor's publish flow is wired through it, so **share links work across devices and browsers**.

> **`legacy-static/`** holds an earlier, separate deliverable: a hand-built 9-page static HTML/CSS/JS portfolio (no editor, hardcoded content). It's kept here for reference only — it doesn't share any code with the app in `src/` and isn't part of the Vite build. Open `legacy-static/index.html` directly in a browser to view it.

## Quick start

Node 22 or newer (`better-sqlite3` 13 requires it).

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
npm test            # vitest run — 372 tests across 41 files
npm run test:pg     # the server suites again, against real PostgreSQL (167 tests)
npm run test:e2e    # playwright — 34 browser specs on isolated ports
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

### Trying combinations

Changing style, audience, length or language rewrites the script, and against
a real model that is seconds per scene. Two things made that worse than it
needed to be: scenes were written strictly one after another, and nothing was
remembered — so trying four styles cost four full generations, and going back
to the first one paid for it again.

Narration is a pure function of the scene's brief and the options, so
`scriptCache.js` keys on exactly that and revisiting a combination is free.
Scenes are written concurrently, with the limit set by the provider: Gemini 4,
because a cloud API is happy with several in flight; Ollama 2, because a model
on your own GPU doesn't really overlap but one request tokenising while another
runs does help; the offline writer 1, since there is no I/O to overlap.

Measured against Ollama running `qwen2.5:3b` locally, seven scenes:

| | |
|---|---|
| A new combination | ~20–36s — the model's speed, not the app's |
| A combination already seen | 0 model calls |
| Concurrency 2 vs one-at-a-time | 19.8s vs 23.8s (1.20x) |

Concurrency was never going to be the win: the model runs on your own
hardware, so requests don't genuinely overlap and only setup and tokenising
do. Note the numbers above are **call counts, not wall clock**. Timing this
from the outside is unreliable — the "Writing…" indicator never renders when a
regeneration is served from memory, so a probe waiting for it to appear
reports its own timeout as the cost of the switch, and one that skips the wait
reports a number far too small. Counting how many times the provider is
actually asked is the measurement that means something.

Three things the tests pin down, because each is a way to be subtly wrong:
results stay in **plan order** however they finish (order is the video), a
**fallback is never cached** (it isn't what your chosen provider would say once
it's reachable), and **"rewrite this scene" drops the cached entry** rather
than handing back the take you just rejected.

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

Exporting used to take exactly as long as the video: `MediaRecorder` records
the canvas as it plays, and it timestamps frames by wall clock, so frames
pushed faster than real time just make a shorter film. A 77-second video cost
77 seconds and nothing about the machine could shorten it.

`fastExport.js` uses **WebCodecs** instead. Each frame carries the timestamp we
give it, so the encoder runs as fast as frames can be drawn while playback
stays correct — measured at 42s for that same 77-second video, producing a
real H.264 MP4. Drawing a frame costs well under a millisecond, so the export
is now bound by encoding rather than by patience.

What this path can't do is narration. Speech is real-time by nature and
`speechSynthesis` output can't be captured programmatically at all, so
**Narration is an explicit toggle, off by default**, and turning it on falls
back to the recorder with its full-length wait. The export note says which you
got and what the other one would cost.

Browsers without `VideoEncoder` fall back to the recorder automatically.


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

382 tests across 40 files (Vitest, plus Supertest for the API and Testing Library for components):

- **API integration** — `server/routes/auth.integration.test.js`, `portfolio.integration.test.js` (real HTTP against the Express app, real SQLite)
- **Auth units** — `server/auth.test.js` (hashing, JWT, validation rules)
- **AI** — `factGuard.test.js` (the grounding guard), `LocalProvider.test.js` (word-cap sentence trimming)
- **Video** — `sceneBuilder.test.js`, `timing.test.js`, `exportFormat.test.js`, `player.test.js`
- **Components** — `ShareModal.test.jsx` (publish state and view count), `RequireAuth.test.jsx` (the editor guard), `ImageUpload.test.jsx` (upload limits and failure handling), `Modal.test.jsx` (focus trap, Escape, focus restore)
- **Store** — `usePortfolioStore.test.js`, `useAuthStore.test.js` (expired-session handling)
- **Security** — `sanitizeUrl.test.js` (link scheme allowlist), `server/validatePortfolio.test.js` (save-time structural checks), `server/RateLimitStore.test.js` (persistent rate limiting, on both backends)
- **Database** — `server/sql.test.js` (placeholder renumbering); every `server/**` suite also runs against PostgreSQL via `npm run test:pg`
- **Operations** — `server/deployment.integration.test.js` (proxy trust in both directions, security headers), `server/observability.integration.test.js` (redaction, request ids, a health check that fails when the database does)
- **Sharing** — `server/preview.test.js` and `server/routes/preview.integration.test.js` (per-portfolio link previews, and that a private one leaks nothing)
- **Email** — `server/mail.test.js` (routing, both body parts, failures that stay quiet), `server/mailSmtp.integration.test.js` (delivery to a real SMTP server)
- **Images** — `server/routes/images.integration.test.js` (upload, sniffing, dedup, immutable serving), `server/imageGc.test.js` (deletion actually deletes), `imageUrl.test.js`, `inlineStoredImages.test.js`
- **Languages** — `voices.test.js` (every phrase, every style, every language)
- **Utils** — `slug.test.js`, `sanitizeCss.test.js`, `textMetrics.test.js`, `exportImport.test.js`, `dataUrl.test.js`

Component suites opt into a DOM per file with a `// @vitest-environment jsdom`
docblock; everything else runs in plain Node, so the fast majority of the suite
skips jsdom's startup cost.

### Browser end-to-end tests

```bash
npm run test:e2e
```

37 Playwright specs in `e2e/`, because almost every serious bug this project
has had was invisible to unit tests: narration cut off mid-sentence, an export
that claimed to have audio and didn't, a share modal that hid your own link
when you reopened it, focus escaping a dialog, a scene duration field that
turned "30" into "3025".

- `auth.spec.js` (9) — register, login, logout, guard redirects, session expiry
- `share.spec.js` (8) — publish, republish, unpublish, the public share page, link-preview tags
- `sync.spec.js` (4) — edits surviving a reload and reaching a second browser context
- `a11y.spec.js` (4) — axe-core over login, both editor modes, the portfolio
- `editor.spec.js` (5) — tab navigation, adding and removing entries, autosave, a failed import that explains itself
- `video.spec.js` (4) — script generation, a non-blank rendered frame, retiming a scene, playback
- `csp.spec.js` (3) — the production Content-Security-Policy is served, is enforced, and doesn't break the app

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
in-process with no server to install. 167 tests, both backends, in CI.

`server/postgresTcp.integration.test.js` goes one further and puts PGlite
behind a **TCP socket speaking the real PostgreSQL wire protocol**, so the
`pg` driver — the one production actually uses, with its own type parsers and
connection pool — is exercised too, including a transaction committing and
rolling back across a pooled connection.

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

**TLS is covered too.** `server/postgresTls.integration.test.js` puts a proxy
in front of PGlite that answers the `SSLRequest` handshake — Postgres doesn't
simply listen for TLS; the client asks first and the server replies with a
single byte — and terminates TLS with a self-signed certificate. The suite
checks that binary data survives the encrypted stream intact, that an
unverifiable certificate is refused, and that a plaintext client is turned
away, so none of the other assertions can pass without TLS actually happening.

**Use `?sslmode=verify-full`** on a hosted database, not the more common
`require`. pg 8 treats `require` as verify-full; pg 9 will switch it to libpq
semantics, which encrypt without checking who answered. Relying on `require`
means a dependency bump silently stops verifying, so the server warns once at
boot if it sees one of the modes whose meaning is due to change. For a server
on your own network with a self-signed certificate, `?sslmode=no-verify` says
so honestly.

**What is still not covered:** how a particular hosted provider behaves on
idle timeouts and connection caps. `DATABASE_POOL_MAX` exists for that, and an
idle client dropped by the server is logged rather than taking the process
down with an unhandled `error` event.

## Email

Reset and verification links go wherever `MAIL_TRANSPORT` says:

```
MAIL_TRANSPORT=            # console (default) — print the link to the server log
MAIL_TRANSPORT=smtp        # send it, using SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD
```

Console is the default on purpose. Nothing here requires a paid account or a
third-party service, and a self-hosted instance with one user is well served by
reading the link out of its own log. SMTP is there when you want real email;
any provider's free tier works, or your own server, because SMTP is just SMTP.

Sending is never awaited and never throws into a request. An account is created
whether or not the mail server is reachable — a signup that 500s because email
is down is worse than one that succeeds with an unsent link, and "resend
verification" is right there. If `MAIL_TRANSPORT=smtp` but `SMTP_HOST` is
unset, the link falls back to the log *and says why*, rather than vanishing.

Messages carry both a plain-text and an HTML part: some clients render text by
preference, and a link that exists only in the HTML is a link some people
cannot use.

`server/mailSmtp.integration.test.js` runs a real SMTP server on a socket and
sends to it with the real transport, so delivery is verified rather than
assumed. `server/mailTls.integration.test.js` does it again encrypted, both
ways round: implicit TLS on 465, and STARTTLS on 587 where the connection
starts in the clear and upgrades. Certificates are verified by default —
there's a test pinning that — and `SMTP_TLS_REJECT_UNAUTHORIZED=false` exists
for a mail server on your own network with a self-signed certificate.

What's left uncovered is authentication against a specific provider, and
whatever that provider does about rate limits, SPF and DKIM.

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

## Performance

Measured on Slow 4G with a 4x CPU throttle — roughly a mid-range phone on
mobile data, which is what "how fast is it" ought to mean.

| | Before | After |
|---|---|---|
| Sign up → editor usable | 4,627ms | ~2,400ms |
| Tab switch, script time (x12) | 219–242ms | 95–136ms |
| Third-party requests on first load | 6 | 0 |

Four things were costing that, found by reading the request waterfall rather
than by guessing:

- **The editor downloaded only after the form was submitted.** It's a lazy
  route, so ~292KB of chunks started from a standing start at the exact moment
  the user was waiting. Typing a name, an email and a password takes several
  seconds during which the connection does nothing, so `usePrefetchEditor`
  starts the fetch when the login or register page mounts. Fire-and-forget: if
  it fails, the normal lazy import simply tries again.
- **The sample portfolio's placeholder art came from placehold.co** — five
  requests to a third party before a brand-new account's own content finished
  drawing. Generated locally now (`src/utils/placeholderImage.js`).
- **The font stylesheet is injected after the theme is known**, so its DNS
  lookup and TLS handshake started late and on the critical path. Two
  `preconnect` hints in `index.html` cost nothing and remove that from the wait.
- **`PreviewPane` re-rendered on every tab click.** It takes no props, but
  React re-renders children whenever the parent does, and `EditorPage`
  re-renders on every tab change. Memoising it halved the scripting per switch.

A note on that last one, because the obvious measurement was wrong: a
`MutationObserver` over the preview counted *identical* DOM mutations with and
without the memo — React was re-rendering, but reconciliation produced no DOM
change. The win is scripting time, and it only showed up once the measurement
moved off wall clock (which varied 2x between identical runs on a busy machine)
and onto CDP's `ScriptDuration` counter.

**Still slow, and not a tweak to fix:** roughly 1.5s of CPU between the API
returning and the editor being usable. That is rendering all ten preview
sections of the sample portfolio at 4x throttle.

## Operating it

**Logs are one JSON line per event** (`server/logger.js`), which every host's
log viewer can already filter. A 500 used to print a stack trace and nothing
else — no id, no status, no timing — and on a managed host that scrolls away
and is gone at the next redeploy.

Every request gets an id, returned as `X-Request-Id` and included in the body
of any 5xx. When someone says "it failed when I published", that id is the
thing to search for. An id the proxy already set is kept, so one request is one
id across every hop.

**Nothing is sent anywhere.** Secrets are redacted by key name, and the user's
own writing — `data`, `email`, `bio`, `photo` — is omitted outright, because a
stack trace is not a good enough reason to copy someone's portfolio into an
operational log. `ERROR_WEBHOOK_URL` will POST error entries to Sentry, Slack
or your own endpoint, and stays off unless you set it. `LOG_LEVEL` and
`LOG_FORMAT` (`json` / `pretty`) are there too; pretty is the default on a TTY.

**`/api/health` actually checks the database.** It runs `SELECT 1` and answers
`503` if that fails. A health check that returns `ok:true` from a process whose
database has gone is worse than none at all — the monitor stays green through
the one outage it exists to catch. It also reports uptime and which backend is
in use. Point any uptime monitor at it; successful checks aren't logged, so a
per-minute ping doesn't bury everything else.

## Hosting it

Two things have to be hosted, and both fit inside free tiers.

| | What it is | What it needs |
|---|---|---|
| Frontend | `npm run build` → `dist/`, static files | Any static host. Netlify, Cloudflare Pages, Vercel, GitHub Pages, or an nginx directory |
| API | `server/`, one long-running Node process | Node **22 or newer**, TLS terminated in front of it, and either a persistent disk or a Postgres URL |

**The frontend needs no rewrite rules.** Routing is hash-based
(`/#/editor`), so every URL is really `/` and a plain static host serves it
correctly with nothing configured. Copy `public/_headers` into place — the
build already puts it in `dist/`, and Netlify and Cloudflare Pages read it
as-is. On Vercel the same values go in `vercel.json` under `"headers"`; on
nginx they are `add_header` lines. The `YOUR-API-HOST` placeholder in it is
resolved from `VITE_API_URL` during the build, so the copy in `dist/` names
your real API — nothing to edit by hand, and the build says so out loud if
`VITE_API_URL` is unset.

**The API needs Node 22 or newer** — `better-sqlite3@13` requires it, and CI
runs on 22 for that reason. It is a single process; nothing here needs a
worker pool, a queue, or a second service. 256MB of memory is comfortable.

**Storage is a choice, not a requirement.** On a host with a real disk, SQLite
at `server/data.sqlite` is created on first boot and needs no setup at all. On
a host with an ephemeral filesystem — which is most managed platforms, where
the disk is wiped on every redeploy — set `DATABASE_URL` to a free Postgres
(Supabase, Neon, Render) with `?sslmode=verify-full`. The schema is created
automatically either way. See "Choosing a database" above for the tradeoff.

**TLS comes from the host.** Every platform above terminates it for you; the
app doesn't hold certificates. Once requests arrive over HTTPS the API starts
sending HSTS on its own — it deliberately won't while you're on plain HTTP, so
a dev server can't pin localhost to HTTPS in your browser.

**What is *not* needed**, and is worth saying because it is what usually makes
a project like this expensive to host: no GPU, no video rendering service, no
object storage, no paid AI API, no managed queue, no CDN. The AI writes the
script; the visitor's own browser encodes the video and downloads it, so the
work that would need a render farm happens on the machine that asked for it.
Uploaded images are content-addressed blobs in the same database as everything
else. Ollama, if used, runs on the visitor's own machine, and Gemini only when
someone supplies their own key.

**Optional, and off unless configured:** SMTP for password-reset delivery
(`MAIL_TRANSPORT=smtp` — otherwise links print to the API log, which is
genuinely enough for an instance you run yourself), and `ERROR_WEBHOOK_URL` to
push errors to Sentry, Slack, or your own endpoint.

## Deploying

Before deploying, set in `.env`:

- `JWT_SECRET` — a long random string (**required**; there's an insecure dev fallback otherwise)
- `CORS_ORIGIN` — your real frontend origin(s); the API rejects anything not listed
- `VITE_API_URL` — where the browser should reach the API, if it isn't `localhost:4000`
- `TRUST_PROXY` — **set this to `1` on any managed host.** See below; getting it wrong is a site-wide lockout in one direction and a bypassed rate limiter in the other
- `FRONTEND_URL` — the base for reset/verification links, and where `/p/:slug` sends a human after a crawler has read its preview tags

`VITE_API_URL` does double duty: it is baked into the bundle *and* substituted
into the Content-Security-Policy in `dist/_headers`. Building without it
produces a policy that lets the frontend reach an API only on its own origin.

(`legacy-static/` isn't part of the Vite build and would need deploying separately.)

### Automatic deploys

The `deploy` job in `.github/workflows/ci.yml` runs on pushes to `main`, only
after the tests and the browser suite have passed. Every step is gated on a
secret or variable existing, so a repository with none set skips them rather
than failing — it is safe to have in place before there is anywhere to deploy
to.

| Set as | Name | What it does |
|---|---|---|
| Variable | `VITE_API_URL` | Baked into the frontend at build time |
| Secret | `API_DEPLOY_HOOK_URL` | POSTed to deploy the API |
| Secret | `FRONTEND_DEPLOY_HOOK_URL` | POSTed to deploy the frontend |
| Variable | `HEALTH_URL` | Polled afterwards until it answers 200 |

Deploy hooks are plain URLs your host gives you, so this needs no
provider-specific action or SDK. A hook that answers 4xx or 5xx fails the job:
a green tick on a failed deploy is worse than a red one. The health poll is
what makes "deployed" mean the new build is actually up, rather than that the
host accepted a request — without it the job only proves a POST succeeded.

Each build is kept as an artifact for 30 days, so a rollback targets an exact
build rather than "whatever `main` looked like".

## Behind a reverse proxy

Every managed host puts a proxy in front of the app, and Express believes
`X-Forwarded-For` only when told to. Untold, `req.ip` is the proxy's address
for every visitor, so all of them share one rate-limit bucket — **one person
mistyping their password locks out the entire site**, for fifteen minutes, and
across a restart because the counters are persisted. There is a test that
demonstrates exactly that.

The opposite mistake is worse: trusting the header unconditionally lets any
client claim any address and walk past every limit. So it is explicit —
`TRUST_PROXY=1` for the usual single-proxy setup, `2` behind a CDN, unset when
the app is exposed directly. If requests arrive carrying `X-Forwarded-For`
while it is unset, the server says so once rather than failing silently.

The server also shuts down on `SIGTERM` rather than being killed mid-response:
hosts deploy by sending it and killing what's left a few seconds later, so
without it every deploy cuts in-flight requests and closes SQLite by process
death instead of checkpointing its write-ahead log.

Responses carry `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy`
that turns off camera, microphone, geolocation and payment. HSTS is sent only
when the visitor actually arrived over TLS — from a dev server it would pin
localhost to HTTPS in your own browser, which is annoying to undo.

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

**Guessing a portfolio password is rate limited.** A password-protected
portfolio's unlock endpoint is a login by another name, and it was the one auth
surface with no limit at all — an audit measured 60 consecutive guesses
accepted and zero refused, so a protected portfolio could be opened at whatever
rate the network allowed. It now has its own counter, tighter than the account
login (10 per 15 minutes) because there is no account to lock out and no
legitimate reason to try ten times.

**Everything is served with a Content-Security-Policy.** API responses declare
`default-src 'none'` — a JSON endpoint has no reason to be able to load
anything. The share preview at `/p/:slug` is HTML, so it gets a per-response
nonce instead: its one inline script carries a random nonce and the policy
names only that, which means an injected `<script>` cannot run even if one ever
got that far. The frontend's policy lives in `public/_headers` for the static
host, and its `script-src 'self'` carries neither `'unsafe-inline'` nor
`'unsafe-eval'` — that is the part actually standing between an injected string
and code execution.

A policy nobody has run the app under is a guess, and getting it wrong shows up
as a blank page in production rather than as a warning. So `vite.config.js`
parses the same `public/_headers` file into `preview.headers`, and the browser
suite runs against `vite preview` — meaning **every e2e spec is also a CSP
test**, and `e2e/csp.spec.js` additionally proves the policy is enforced rather
than merely present by trying to inject a script and watching it get blocked.

Doing that found a real bug: `ImageUpload` turned a data: URL into a Blob with
`fetch(dataUrl)`, which `connect-src` governs. Under the policy it failed, and
the upload path's own catch quietly kept the inline base64 copy instead — so
every photo would have gone back to living inside the portfolio JSON, growing
documents until they could no longer be saved, with nothing on screen to say
so. `src/utils/dataUrl.js` decodes it directly now.

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

- **Backups are your job on SQLite.** `npm run db:backup` takes a consistent snapshot via SQLite's online backup API (safe on a live WAL database, unlike `cp`) and keeps the newest 10 in `server/backups/`, but nothing schedules it for you. On Postgres, backups are whatever your host provides.
- **Non-English quality from a *local model* is the model's.** The built-in offline writer handles all three languages itself (see "Narration languages"), but if you point the app at Ollama instead, capability varies sharply by model — `qwen2.5:3b` handles Japanese well and Tamil poorly — so a scene the model can't write in the chosen language is rejected and falls back to English rather than shipping nonsense.
- **On-screen text stays in the portfolio's own language.** Only the narration and captions are written in the chosen language; names, roles, companies, quotes and skill chips are rendered from your portfolio fields verbatim. That is deliberate — translating someone's job title or their client's testimonial would be inventing content.
- **Video export depends on browser support, and can't be fixed from here.** `MediaRecorder` MP4 muxing and `getDisplayMedia` audio capture vary by browser. The export picks the best container the browser supports and degrades to WebM rather than failing, and it reports afterwards whether narration was actually captured instead of claiming it was. The audio detour exists because `speechSynthesis` output cannot be captured programmatically by any browser API — there is no way to route it into a `MediaStream`, so a tab-audio share is the only route. Shipping a WASM TTS engine purely to work around that would cost more than it's worth.
