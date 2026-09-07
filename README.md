# Hamava · project notebook

Persian songs, readable Finglish, and a line you can take with you.

This is the implementation plan and handoff notebook for a private, one-person
PWA. Keep it as a milestone document until we choose to publish the source.
Working name: **Hamava** (هم‌آوا). Repository suggestion: **finglish-lyrics**.
Budget: $300 including labor and software; delivery target: one month.

## What you can see first

Milestone 1 is a responsive, installable static preview. It has an original
illustrated Googoosh sleeve, a short owner-supplied Finglish excerpt, optional
Persian text, a silent demo clock, line highlighting, seeking, focus view, a
copy-current-line button, and a local saved-song marker. Fonts and artwork are
served locally. After the production site finishes loading once, its service
worker can open the preview offline.

The excerpt is **Gharibe Ashena from the album Kooh**, not the separate song
Kooh. Its 24-second demo clock is deliberately synthetic. It does not play audio
or claim to be synchronized with a real recording. Connect Spotify explains the
next milestone; it does not perform fake login. No AI or Spotify credentials are
required for this version.

## Start it in VS Code

Open `/home/arsham/finglish-lyrics` as the project folder. Open Terminal → New
Terminal. Use Node 24 (the `.nvmrc` file selects it if you use nvm).

```bash
cd /home/arsham/finglish-lyrics
npm ci
npm run dev
```

Open the Local URL Vite prints, usually `http://localhost:5173`. Changes to React
or CSS appear automatically. `Ctrl+C` stops the server. Use the browser's mobile
device toolbar to preview phone widths; this does not replace actual phone tests.

For the production build, installability, and offline tests:

```bash
npm run build
npm run preview
```

Open `http://localhost:4173`. The development server intentionally does not
register an offline service worker. PWA and clipboard features need HTTPS or
localhost. Your laptop's plain HTTP LAN address is enough for layout checks on
the same Wi-Fi, but use the deployed HTTPS URL to test installation and copying
on the phone. The PWA manifest and icons are generated as part of the build;
source PNG icons are already tracked. `npm run icons` regenerates them after an
icon design change.

## First Cloudflare deployment — no purchased domain

The first deployment uses **Workers Static Assets**, which serves this app at:

```text
https://hamava-lyrics.<YOUR-WORKERS-SUBDOMAIN>.workers.dev
```

This is a URL pattern, **not a provisioned/live address**. Cloudflare prints the
actual URL after a successful deploy. The `hamava-lyrics` part is the `name` in
`wrangler.jsonc`; the account subdomain is configured in Cloudflare. You do not
need to purchase a domain or rent a server. Static asset requests and storage are
currently free. Later Worker API requests and AI calls have separate free quotas.

Use the customer's Cloudflare account for durable ownership, or your account for
the first preview with a planned handoff. Stay on Workers Free.

1. Create/sign into the account at [Cloudflare](https://dash.cloudflare.com/).
2. From this project's VS Code terminal, authorize Wrangler:

   ```bash
   npm run cf:login
   npm run cf:whoami
   ```

   Follow the browser authorization screen. If the browser does not open, copy
   the printed authorization URL into the laptop's browser. Do not paste access
   tokens into chat or source files. The earlier **Workers AI-only token does
   not necessarily have deployment permissions**; Wrangler browser login is the
   simplest path for the preview.

3. Check and deploy the prepared build:

   ```bash
   npm run deploy:check
   npm run deploy
   ```

4. If prompted for a Workers account subdomain, choose one. Open the HTTPS URL
   printed by Wrangler. If Cloudflare says a Worker with this name already
   exists, check what it is before deploying over it; rename this project's
   `name` if needed.
5. Send the same URL to the customer. Open it on their phone and try the manual
   checks below. This static demo needs no account keys or AI quota.

For updates, `npm run deploy` rebuilds and uploads the app. The PWA shows an
update notice so the customer can refresh intentionally. Roll back a bad release
from the Worker's Deployments section in Cloudflare; keep the last working Git
commit for the matching code.

We originally discussed Pages. Workers Static Assets gives us the same free
static-hosting goal and lets us add `/api/*` on the same origin later, simplifying
deployment and browser permissions. [Cloudflare setup](https://developers.cloudflare.com/workers/static-assets/get-started/),
[static pricing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[workers.dev domains](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).

## Private GitHub repository

A GitHub **repository** is the privacy boundary, not a folder within a public
repository. `"private": true` in package.json prevents accidental npm publication;
it does not make GitHub or the deployed site private.

Create an empty repository called `finglish-lyrics` in GitHub, choose **Private**,
and do not initialize it with a README, gitignore, or license. Then run inside
this project:

```bash
git init -b main
git add .
git commit -m "Scaffold Hamava PWA and milestone plan"
git remote add origin https://github.com/YOUR_USERNAME/finglish-lyrics.git
git push -u origin main
```

Replace `YOUR_USERNAME` with the account that should own the project. Use VS
Code's GitHub sign-in or your normal Git credential manager if prompted. Never
include a token in the remote URL. If Git is already initialized, skip `git init`;
if origin already exists, inspect it before changing anything.

The included GitHub Action installs locked dependencies and checks the build and
browser behavior. It does not deploy or require Cloudflare secrets. Check your
GitHub Free private-repository Actions allowance before increasing CI frequency.
You can continue deploying from the terminal. GitHub source privacy and website
access are separate: the first static preview URL is accessible to anyone with
the URL. Before a live AI endpoint is exposed, milestone 3 requires server-side
customer authorization and spending limits.

Do not commit `.env`, `.dev.vars`, tokens, OAuth sessions, customer emails,
private research dumps, or a scraped lyrics catalog. The supplied gitignore
excludes the usual secret files. There is no open-source license decision yet.
Before changing repository visibility, review Git history, ownership, assets,
dependency licenses, and rewrite this README as public product documentation.

## Milestones and definition of done

| Milestone | Scope | Acceptance / what you test | Target |
| --- | --- | --- | --- |
| 1 · See it on the phone | PWA scaffold, design, demo clock, highlight/copy, offline shell, Cloudflare config, private-repo setup | Production build passes; preview usable at phone widths; copy matches highlight; actual HTTPS deployment opens on customer phone | Week 1 |
| 2 · Connect Spotify | Register developer app, PKCE, state verification, exact callback, minimal playback scope, token refresh, polling and local clock | Login on laptop and real phone; track/position update; pause, seek, skip, resume after app switch; no password handled by us | Week 1 |
| 3 · Find and convert | LRCLIB lookup and recording matching; Qwen3.8 through Worker AI binding; three sequential batches; D1 batch cache | Show first completed batch; prioritize the current playback position; retry only failed batch; strict IDs and timing; switch track without stale lyrics | Week 2 |
| 4 · Make it dependable | Edits, device cache, delay adjustment, failure states, budget guard, phone refinements and handoff | Acceptance session with customer's songs, install/reopen, poor network, quota exhausted, revoked Spotify login, corrected line persists | Weeks 3–4 |

Milestone 1 code is implemented in this scaffold. Deployment and customer-device
acceptance remain open until completed on the authenticated account and device.
Milestones 2–4 are planned; there is no live Spotify or AI integration yet.

Verified locally on 2026-09-08: three timeline tests and six Chromium browser
checks passed, TypeScript and the production build passed, and the Cloudflare
deployment dry run passed. Desktop and phone screenshots were visually reviewed.
The browser checks exercised clipboard contents, playback/seek/end behavior,
saved state, dialogs, focus view, viewport fit, manifest, and offline reload.
Cloudflare login and private GitHub repository creation are still pending.

## Architecture we agreed to

```text
Phone PWA
  ├─ Spotify login (Authorization Code + PKCE)
  ├─ Playback state → locally advanced clock → active lyric → Copy
  ├─ Local cached lyrics and corrections
  └─ Authorized requests to Cloudflare Worker /api/*
       ├─ LRCLIB: find matching Persian timed lyrics
       ├─ D1: reuse previously converted batches
       └─ Workers AI: Qwen3.8-27B, thinking disabled
            first relevant batch → save + display
            next batch → save + display
            final batch → save + display
```

- Frontend: React + TypeScript + Vite. Same web code for iPhone, Android, laptop.
- Hosting: Cloudflare Workers Static Assets on its free HTTPS domain.
- Backend later: one Worker API with AI and D1 bindings. Keep paid services off.
- Lyrics: LRCLIB first. Best-effort catalog coverage; no universal-song promise.
- Model: `@cf/qwen/qwen3.8-27b`, `chat_template_kwargs.enable_thinking: false`.
- Baseline prompt: v4. Temperature 0.7, top_p 0.8, 900 output-token cap per test
  batch. Version prompt/model in cache keys. Tune through separate controlled tests.
  The exact successful prompt is preserved in [docs/finglish-prompt-v4.txt](docs/finglish-prompt-v4.txt).
  It is a research baseline, not loaded into the static preview.
- Preserve recording timestamps and blank instrumental markers outside the model.
  Send numbered text only. Validate every expected ID exactly once; no missing,
  reordered, extra, blank, or truncated output. Reattach timestamps in code.
- Three batches were 10/9/9 lines for one 28-line test song. For arbitrary songs,
  set a safe token/line budget instead of always sending three huge chunks.
- Start with the batch around the current playback position; don't make a user
  who joins mid-song wait for the opening verse. Stop scheduling obsolete batches
  after track change. Ignore stale responses using a track/version identifier.
- Persist completed batches, retain them on failure, and deduplicate in-flight
  work. Never use an unbounded retry loop. Server-side quota accounting must be
  atomic; an abandoned request can still consume AI quota.
- Cache by recording identity + source lyric hash + prompt/model version + batch.
  Customer edits take precedence and are stored separately from generated text.
- Do not call the AI while highlighting or copying. Previously cached lyrics
  need no inference. Live Spotify synchronization still needs connectivity.

### What the experiments actually established

Measurements from the saved local research on 2026-09-07:

| Test | Observation |
| --- | --- |
| Qwen3.8, fresh 12 sentences, thinking off | Owner accepted 10/12; corrections `bare → bbare`, `nadar → nazar` |
| Full 28-line Gharibe Ashena, album Kooh, v4 | About 22.8 seconds; 338.29 neurons; structurally valid, pronunciation errors remain |
| Three sequential batches, same source | LRCLIB 1.66 s; AI batches 8.29 / 8.72 / 8.48 s; total AI 25.50 s; 374.23 neurons; all three completed |
| V5 whole-song attempt | Timed out at 90.32 s; no valid response; usage unknown |

For the three-batch sample, the first text was available approximately 9.95 s
after LRCLIB + AI processing (excluding manual credential entry); all text took
about 27.16 s. This improved time to first text; it did **not** reduce total time
or cost. Repeating the prompt increases input tokens. The nominal 10,000-neuron
daily free allowance would fit **26 new songs of this measured size**, before
other AI usage, failures and retries. It is an estimate, not a catalog-wide
guarantee. Budget tests across several genres before setting a customer quota.

No timeout root cause was established. Disabling thinking stopped the visible
reasoning in successful results, but subsequent timeouts still occurred. Track
service reliability separately from pronunciation. Do not infer that a prompt
change caused or cured networking failures.

### Spotify connection plan

1. Customer/developer creates a Spotify developer app and registers the exact
   production callback `https://<actual-domain>/auth/callback`. For local OAuth
   use an explicit loopback address, such as `http://127.0.0.1:5173/auth/callback`.
2. Confirm developer-mode eligibility, app-owner Premium requirement and the
   customer allowlist before writing the integration. Retest the currently
   documented account limits; don't assume public-app access from a private app.
3. Connect Spotify opens Spotify's own authorization page with a random state
   and PKCE challenge. Validate state; exchange the returned code with the
   verifier. Client ID is public; no client secret belongs in browser code.
4. Request `user-read-playback-state` for `GET /v1/me/player`. Ask for further
   scopes only if a feature actually requires them. Playback stays in Spotify.
5. Refresh tokens using the returned expiry; handle revocation and re-login.
   Never log tokens, put them into Git, or cache auth/API responses in the PWA
   service worker. Keep access tokens in memory; decide persistent refresh-token
   storage deliberately during milestone 2. Do not rely on browser-supplied
   identity as authorization for the AI backend.
6. Poll at a conservative interval (initially around 3–5 seconds while visible),
   respect `Retry-After`, and advance locally between samples. The interval is a
   starting value, not a Spotify rate-limit guarantee. Check after visibility
   changes and handle no playback, local tracks, private sessions, non-track items,
   unavailable lyrics, and different recordings.
7. On the real phone, test OAuth redirects in both browser and installed PWA.
   iOS navigation/storage behavior and background suspension need device checks.
   Resample Spotify when the PWA returns to the foreground. Live highlighting is
   designed for the visible PWA, not a persistent background service.

Customer reports an email permitting the personal intended use. Keep that
correspondence privately with the project owner; it is not embedded in source
control. This scaffold does not independently verify the sender or expand the
reported permission. Future public release needs a separate review.

References: [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow),
[redirects](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri),
[playback state](https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback),
[quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes),
[AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/),
[LRCLIB](https://lrclib.net/docs).

## Manual acceptance checklist for milestone 1

- [ ] Open the deployed URL on the laptop and customer phone; note model/browser.
- [ ] Play the silent preview. The highlighted excerpt changes at 0, 8, and 16 s.
- [ ] Pause and seek in both directions; highlight follows the selected time.
- [ ] Copy current line and paste into Notes; it exactly matches the highlight.
- [ ] At 24 s there is no active lyric and copying is disabled. Play restarts it.
- [ ] Toggle Persian and larger text. Try focus view; nothing overflows the phone.
- [ ] Save the demo, refresh, and confirm its heart remains selected on this device.
- [ ] Connect Spotify clearly says the integration is coming next.
- [ ] Install from Safari Share on iPhone or Chrome Install/Add to Home screen on
      Android. Launch from its home-screen icon.
- [ ] After the first complete production visit, switch offline and reopen/refresh.
      The preview shell and supplied excerpt still work; an offline note appears.
- [ ] Deploy an update, revisit, and accept the PWA update notice.

## Automated verification and layout

```bash
npx playwright install chromium
npm run check
```

On Linux, if Chromium reports missing shared libraries, run
`npx playwright install-deps chromium` in your terminal; it can require your sudo
password. For this laptop's initial verification, the browser and three missing
libraries were downloaded into `/tmp` without a system installation. While those
temporary files remain, you can rerun the checks with:

```bash
LD_LIBRARY_PATH=/tmp/hamava-browser-libs/extracted/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/hamava-browsers npm run check
```

The checks cover timeline boundaries, instrumental gaps, backward seeking,
elapsed-time interpolation, strict TypeScript build, mobile and desktop UI,
clipboard, local saved state, dialogs, viewport overflow, manifest and offline
reload. Chromium emulation is not a substitute for customer iPhone testing.

```text
src/App.tsx                   first reading experience
src/styles.css                responsive visual system
src/data/demo.ts              owner-provided excerpt and synthetic times
src/lib/timeline.ts           current-line and clock calculations
src/hooks/usePreviewPlayer.ts preview transport (replace with Spotify adapter later)
public/                       original artwork, install icons, deployment headers
tests/                        timing and browser verification
wrangler.jsonc                free Cloudflare static deployment
.github/workflows/check.yml   validation only; no automatic deployment
```

Avoid adding the old unrelated Go repository or `/tmp` research artifacts to
this repository. The first version uses a short supplied excerpt and original
artwork, so the public static preview does not expose customer credentials or
the private research catalog. Retain the research separately before `/tmp` is
cleaned if we need it for later experiments.
