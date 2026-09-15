# Hamava · project notebook

Persian songs, readable Finglish, and a line you can take with you.

This is the implementation plan and handoff notebook for a private, one-person
PWA. Keep it as a milestone document until we choose to publish the source.
Working name: **Hamava** (هم‌آوا). Repository suggestion: **finglish-lyrics**.
Budget: $300 including labor and software; delivery target: one month.

## CPU transliteration experiment — reserved results reviewed

Development and reserved CPU evaluations completed. All 64 reserved outputs
(16 sentences, two models, two passes) completed without errors or truncation.
Median generation was 92 ms/line for public Negara v7 and 98 ms for Homo-GE2PE.
Both still make material pronunciation errors. Neither has passed production
quality or real-phone acceptance. Beam 1 remains the practical decoding choice.

Public Negara v7 is selected for the next isolated browser feasibility test based
on its existing ONNX starting point, not a decisive quality win. Review includes
formatter corrections and raw-phone inspection; original results remain intact.
[Development review](docs/g2p-cpu-review-2026-09-15.md) ·
[Reserved results and decision](docs/g2p-holdout-review-2026-09-15.md).

The 16 reserved sentences have now been examined. If we tune pronunciation rules,
we must create fresh final evaluation cases. No further CPU benchmark rerun is
needed now. Full-song tests, phone performance and model integration remain
pending. No app code, deployment or PWA version change is included.

## Current milestone: per-line copying in both readers (v0.4.6)

The regular player now has a small copy icon before every sung line, replacing
its decorative line number. Phone targets remain 44 pixels wide and high.
Copying uses that row's Finglish and briefly shows a checkmark, without seeking
or changing playback. Focusing a copy button pauses following so the row stays
available while browsing. The existing quick Copy current line button remains.

Verified: 12 unit/Worker tests, production build, and 52 browser checks, including
copying the first/last lines during the intro or another highlighted lyric,
unchanged playback position, and returning to Follow/current-line copy. Reviewed
the mobile demo screenshot. Real-phone acceptance and deployment remain pending.

Review with `npm run dev`; deploy with `npm run deploy:token` when ready, accept
**Reload app**, and confirm **v0.4.6**. No search route or AI work is implemented
in this release. The proposed next milestone is [search planning](docs/search-plan.md).

## Copy any lyric in the full reader (v0.4.5)

Every sung line in the full-window reader now has its own 44-pixel copy button.
It copies that line's Finglish immediately, in synced or unsynced use, including
when playback is paused or instrumental. A successful copy briefly replaces
that button's icon with a checkmark; the status identifies the copied line.
Clipboard failures explain how to copy manually and allow another attempt.

There is no Copy current line or Copy selected line button in the full reader.
The original demo widget retains its existing Copy current line behavior.
Focusing a row's copy control pauses auto-follow so browsing/copying does not
snap away; highlighting still tracks playback, and Follow current line resumes
following. Copy never seeks or changes the playback clock. The same per-line
controls are ready for `synced=false`; connecting the search route is later work.

Verified: 12 unit/Worker tests, production build and 50 browser checks. Coverage
includes copying the first and last lines while another line is current, 28
independent buttons, copy availability without an active lyric, failure/retry,
continued playback, Aa/follow alignment, and restoring the demo after closing.

Review with `npm run dev`. Deploy with `npm run deploy:token` when ready and
confirm **v0.4.5** after accepting **Reload app**. Deployment remains pending.

## Full-window lyrics reader (v0.4.4)

The expand button now opens a full-viewport lyrics dialog instead of hiding the
cover inside the existing widget. It contains all 28 sung demo lines, a compact
16-pixel phone / 18-pixel desktop Finglish size, its own scrolling, Aa, optional
Persian, and a copy button that stays at the bottom. Aa increases that size to
22 / 24 pixels without moving the followed line out of view. The original
widget's Aa and expand controls are now 48–50-pixel accent buttons.

In synced use, the existing media clock drives highlighting and Follow current
line. Browsing pauses following; the button returns to the current line without
seeking the song. Copy always takes the current sung line and is disabled during
instrumental sections. A compact play/pause control is available inside the
reader. Opening and closing never replace the audio element or restart playback.

The native modal dialog fills the app window, includes safe-area padding, traps
keyboard focus and prevents background scrolling. Close or Escape restores the
original page position and focus. It does not request the browser's optional
Fullscreen API, so it works as an app-window view in mobile browsers and PWAs.
The reader component also accepts `synced=false`: it hides automatic-follow
controls and lets a user select a line to copy. The actual search route remains
future work; it is not connected by this UI change.

Validation: 12 unit/Worker tests, production build and 48 browser checks. The new
checks verify complete lyrics, full viewport sizing, current-line copy, Aa and
Persian alignment, manual browsing/follow, continuing audio, and closing with
Escape or the button. Browser emulation is not real-phone acceptance.

Run `npm run dev`, play the demo, open full lyrics, browse and press Follow,
try Aa and Copy, then close it. Deploy with `npm run deploy:token` when ready;
accept **Reload app** and confirm **v0.4.4**. Deployment is still pending.

## Dark-first onboarding and compact player (v0.4.3)

A first visit now starts in dark mode regardless of the device theme. A saved
light/dark choice still wins on later visits and before React starts. The app
manifest and fallback document color also default to navy.

The demo sits about 40 pixels higher. Its reversible scroll fade spans up to
375 pixels (1.5 times the previous distance). The shared player has one row for
**Follow current line (only synced mode)**, Aa and focus view; the redundant
Lyrics/Demo/Finglish header is removed. The follow note is above the row, away
from the lyric list. Playback status and Skip intro remain available.

The supplied `C:\Users\Arsham\Desktop\Gharibe-Ashena-Gogoosh.jpg` is copied unchanged
as `public/gharibe-ashena-cover.jpg` (450 × 450, 38,855 bytes), replacing the
illustrated sleeve in the demo and its mini player.

All six teaching notes keep their drawn paths and lettering. Dark-mode notes
use warm cream; light-mode notes retain contrasting blue ink. After the demo
is fully revealed, each note draws/fades in once as it first enters the viewport.
Lower notes wait until visible on phones. Scrolling back or hiding/showing seen
tips does not replay the entrance; reopening the page starts a new demo visit.
Reduced motion shows the notes immediately. The new previous/next-line note
sits beside the drag instruction. No continuous instruction animation is used.

Verified: 12 unit/Worker tests, production build and 44 browser checks, including
saved-light startup, dark default on a light device, one-time note entrances,
375-pixel reveal, all controls in one row at 320 pixels, the supplied cover,
Follow → Aa centering, playback/copy, offline behavior and Firefox updates.

Review with `npm run dev`, especially the first scroll and the bottom two notes
on your phone. Deploy with `npm run deploy:token` when ready, accept **Reload app**
and check **v0.4.3** in the footer. Deployment and real-phone acceptance remain
pending. Theme behavior and player/onboarding changes are separate Git commits.

## Readable controls and short intro animation (v0.4.2)

The example card now runs once for about 2.5 seconds of visible animation and
stops on Finglish. **Replay** starts another pass; dragging or Pause stops it.
Offscreen/hidden tabs pause the clock, and reduced motion starts still.

Small invitation/tip labels are 1–2 pixels larger. Finglish is 2 pixels larger
in normal mode; Aa's larger mode gains 4 pixels over the previous release.
Copy has a larger filled button with a larger icon and at least a 46-pixel
height. **Follow current line** stays above the lyric list with a 44-pixel target
and its own drawn guide. Browsing away changes its appearance; pressing it
recenters the current lyric without seeking the music. Hide tips removes all
five guide arrows.

The reported Follow → Aa drift was reproduced on both desktop and mobile with
normal motion enabled. The old font-size transition kept changing line geometry
after the scroll position was calculated. Lyric sizes now change immediately,
and layout centering uses the final geometry before painting. Regression checks
cover Aa in both directions, the Persian toggle and repeated Follow presses.

Validation for v0.4.2: 12 unit/Worker tests, production build and 40 browser
checks. Deployment and real-phone review remain the owner's next steps.
Run `npm run dev`, try Follow → Aa on your phone, and check that the highlighted
line stays centered. Deploy with `npm run deploy:token` when satisfied, then
accept **Reload app** and confirm **v0.4.2** in the footer.

## Compact preview and visual polish (v0.4.1)

The phone layout keeps the script comparison in a small corner beside the
heading, labeled **Example only**. It sweeps automatically between Persian and
Finglish. Dragging or focusing the slider pauses it; the Pause/Animate control
lets you choose. Animation also pauses offscreen/in hidden tabs, and starts
still when the device requests reduced motion. It never starts audio.

Light mode uses warm cream and blue-gray surfaces. Dark mode uses navy and
blue/indigo surfaces with violet accents. Connect Spotify uses a green button
and the official black Spotify icon (source in `docs/branding/spotify.md`). The
approved Hamava logo is unchanged. Spotify/search remain placeholder routes.

Large curved SVG guide arrows point toward the cover, Persian toggle, copy
button and seek bar. Hide tips removes them. The demo fades in as you scroll
down and fades back when scrolling up: the full reveal spans at most 250 pixels,
with a faint peek at the bottom of the initial view. Reduced motion keeps it
fully visible; keyboard focus also preserves readability. These rules live in
`src/experience.css` alongside the existing visual system.

Verified: 12 unit/Worker tests, TypeScript/Vite build, and 36 browser checks,
including desktop/mobile animation, pause/resume, reduced motion, scrolling in
both directions, playback/seek/copy, offline behavior, and Firefox updates.
Light/dark screenshots were reviewed at desktop, phone and 320-pixel widths.
Real-phone acceptance and deployment are still pending.

Run `npm run dev` to review locally. Then `npm run deploy:token`, accept
**Reload app** when offered, and check **v0.4.1** in the footer. On your phone:

- Check the small example beside the heading; pause it and drag manually.
- Switch light/dark themes and check the two route buttons.
- Scroll into the demo, then back up: it should fade both ways over a short scroll.
- Try the drawn guides, Hide tips, playback, seek, and copy as before.

Palette/Spotify branding and motion/guides are separate commits; inspect
`git log --oneline` to revert a specific change. No AI calls or paid services
were added for this UI release.

## Guided audio demo (v0.4.0)

The homepage now presents two clear routes: `/spotify` for automatic sync and
`/search` for manual sync. Both are honest placeholder screens; OAuth, song
search and external playback control are future work. Below the choices, a
scroll reveal introduces the reusable lyrics player with hideable guide arrows.
The decorative script comparison is explicitly labeled **Example only**.

The owner supplied `C:\Users\Arsham\Desktop\Gharibe Ashena Gogoosh.mp3`
(accessible in WSL under `/mnt/c/Users/Arsham/Desktop/`). Its 5,814,169 bytes are
copied unchanged to `public/audio/gharibe-ashena.mp3`. The browser measured
235.413 seconds. The owner confirmed the first vocal at about 0:27 and first
chorus at about 1:27 match LRCLIB record 13013538. That record's timed lines and
a one-time Finglish rendering are pinned in `src/data/demo.ts`. No runtime
lyrics fetch, Cloudflare AI call or transliteration model is used by this demo.
The broader raw LRCLIB response and research catalog remain outside Git.

Verified locally for this release: 12 unit/Worker tests, 30 browser checks,
TypeScript/Vite production build, and a Cloudflare deployment dry run. Browser
checks include actual MP3 playback and seeking, delayed loading, failure feedback,
copying, end/restart, no automatic audio requests, both mode entry screens,
offline/reconnect, and PWA updates in Firefox. Real-phone acceptance and deployment
of v0.4.0 are the owner's next steps; no credentials were read or saved.

`LyricsPlayer` receives track metadata, timed lines and a playback controller.
`useAudioPlayer` supplies that controller for this demo using the real media
clock. Future Spotify/manual controllers can feed the same widget. While
dragging, the seek control previews a position and commits it on release; it
does not issue a new seek for every pointer movement. Keyboard seeks also work.
Buffering, seek completion, errors, late metadata, pause and end-of-song are
handled by media events. No autoplay. The enlarged mobile thumb sits in a
44-pixel input target. Users can skip the intro or hide the teaching tips.

Audio uses `preload="none"` and is excluded from service-worker precaching, so
opening/installing the PWA does not automatically download the recording.
The app and prepared lyrics remain available offline; audio availability is
not promised offline. Playback failures show a retry instruction.

To preview: `npm run dev`. To deploy: `npm run deploy:token`, then reconnect and
accept **Reload app**. Confirm `v0.4.1` in the footer. On the real phone, test:

- Scroll from the two mode choices into the demo; both route screens explain
  what comes next. The card at the top is clearly an example.
- Press Play, skip the intro, and drag forward/back. Confirm sound and highlighted
  text agree, including around 0:27, 1:27 and 3:14. Copy a line into Notes.
- Toggle Persian, larger text, focus view and tips. Check the seek handle is easy
  to grab. No sound starts merely from scrolling.
- Turn off the connection: the large banner should explain the saved version.
  Reconnect: the banner should clear and an available app update should be offered.

Spotify can support seeking later through
[`PUT /me/player/seek`](https://developer.spotify.com/documentation/web-api/reference/seek-to-position-in-currently-playing-track),
with Premium and `user-modify-playback-state`. Send a bounded seek on release,
then reconcile against playback state. Manual mode will adjust only Hamava's
lyrics clock; it cannot control audio in an unrelated music app.

## Connection visibility

The owner confirmed the apparently stale page was being viewed offline. The app
now shows a large sticky **You’re offline** banner above every route. If the
browser reports a connection but the server cannot be reached, it says **Can’t
reach Hamava** instead. Both explain that the saved version may be out of date.
The public `/api/connectivity` probe uses no credentials, database or AI and is
never cached. Checks run on opening, reconnecting, returning to the foreground,
and every minute while visible, with a five-second timeout and a retry button.
Successful reconnection also triggers the normal update check. Local Vite dev
and preview servers expose the same lightweight probe for frontend testing.

## UI refinement and reliable PWA updates

Light/dark mode follows the device initially. The header toggle saves an explicit
choice on this device, shared by the preview and live-test screens. An early
theme script applies it before React starts, avoiding a bright flash on reload.
Surfaces, controls, notices and dialogs use indigo/lavender color tokens.
The shorter reading layout removes repeated marketing copy and adds a draggable
Persian/Finglish comparison using the supplied excerpt. It runs entirely locally,
supports keyboard input, and respects reduced-motion preferences. The original
mountain sleeve now uses the same palette and the correct preview song title.
Verified: 12 unit/Worker checks and 22 browser checks across desktop and mobile
Chromium, with real service-worker lifecycle checks also in Firefox. Real iPhone
acceptance and deployment of these UI changes remain to be done.

The owner has paused the Qwen experiment while awaiting access to the gated
Negara G2P model. Do not integrate or deploy a replacement inference model before
its pronunciation and browser performance are reviewed. Current work is UI and
PWA maintenance; it does not make AI calls.

The app now checks for a service-worker update when opened, when returning to the
foreground, after reconnecting, and every minute while visible. Update-script
requests bypass the HTTP cache. A fixed **Reload app** notice replaces the
easy-to-miss inline notice. Reload is explicit because it clears the in-memory
live-test session. The footer shows the release number and **Check for updates**.

For a browser stuck on a version that predates these controls, deploy this update
then open [the recovery page](https://hamava-lyrics.arshamhaqiqat.workers.dev/api/app-update).
That path bypasses even the first version's app navigation cache. **Repair and
reload** removes Hamava's service-worker registrations and downloaded app files,
preserving localStorage settings such as the saved-song marker and theme. It
requires a connection. No API token, app passphrase, D1 access or AI call is
needed. This page intentionally is not precached.

Ordinary reloads can continue using an installed service worker while a newer
worker waits for existing tabs to release control. Offline caching is useful;
reliable discovery and activation are the missing pieces we are fixing. Firefox's
specific old state cannot be inspected remotely, so do not claim its exact cause
was proven from the user report alone.

Browser regression tests serve two actual app releases from a local HTTP server.
They verify detection, explicit activation, offline loading of the new release,
and recovery without losing saved settings. Firefox has its own update-test
project; install its browser with `npx playwright install firefox`.

Keep update, theme, layout/copy, and branding work in separate Git commits so
each decision can be reverted independently. The owner approved the ivory loop
and lavender inset on indigo. Its master is in `assets/brand/hamava-master.png`;
`npm run icons` regenerates the header, favicon and phone assets. Approval is no
longer pending for this mark. Future redesigns still need review.

### Deploy and try v0.3.0

1. From `/home/arsham/finglish-lyrics`, run `npm run deploy:token`. Use the same
   deployment token and account as before; no new database, AI setup or passphrase
   is needed for these UI changes.
2. Open the deployed app and use **Reload app** when offered. For a browser stuck
   on the old version, open `/api/app-update` on the deployed domain and select
   **Repair and reload**. Check the footer says `v0.3.0`.
3. Test light/dark mode, drag the script card, seek and copy a line, then reload.
   Check the theme stays selected. Reopen offline after installation finishes.
4. Check the new icon on the real iPhone. If an existing shortcut retains the
   green icon, remove that shortcut and add the updated site to the home screen
   again. Browser emulation cannot verify the OS home-screen icon cache.

The local Git commits separate PWA updates (`709dd37`), themes (`14c9efa`), layout
(`364878c`), and the approved branding. Use `git log --oneline` to inspect them.
To undo a chosen change, use `git revert <commit>` and resolve any later dependent
changes if Git reports a conflict; build and redeploy afterward. These are local
commits: a private GitHub remote is still not configured.

## Earlier milestone: one-song live conversion test (paused)

The static preview is deployed at
[hamava-lyrics.arshamhaqiqat.workers.dev](https://hamava-lyrics.arshamhaqiqat.workers.dev/).
The owner confirmed it opens successfully; an independent HTTP check returned 200.
We are bringing forward a slice of milestone 3 before connecting Spotify:
**LRCLIB → one-minute lyric sections → Workers AI → incremental Finglish**.

The new test code is ready locally at `/?live`. Deployment of this update and
real Workers AI pronunciation/latency acceptance remain pending. The original
static preview is still available at `/`. No Spotify login or audio playback is
implemented in this test.

### Deploy the live test

1. Edit the existing **Hamava deployment** token in
   [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens).
   Add **Account → D1 → Edit**, retaining Workers Scripts Edit and Account
   Settings Read, all scoped to the same account. The Worker uses an AI binding,
   so no Workers AI API token is stored in browser code or the Worker.
2. Keep the account on Workers Free. Run:

   ```bash
   cd /home/arsham/finglish-lyrics
   npm run setup:live
   ```

3. The helper builds first, asks for the Account ID and hidden deployment token,
   then asks you to choose and repeat a **separate app test passphrase** of
   16–256 characters. Keep that passphrase privately for opening the live test.
   These credentials are not saved locally. The app passphrase is uploaded as
   the Cloudflare Worker secret `TEST_ACCESS_KEY`.
4. The helper creates or reuses `hamava-lyrics-cache`, records its non-secret D1
   ID in `wrangler.jsonc`, applies the database migration, sets the passphrase,
   and deploys the Worker plus the PWA. Existing cached conversions are retained.
   If a step fails, it stops; fix the reported issue and rerun the same command.
5. Open
   [the live test](https://hamava-lyrics.arshamhaqiqat.workers.dev/?live).
   Refresh/accept the PWA update if necessary. Enter the **app test passphrase**,
   not your Cloudflare token. The URL will only show this feature after deployment.

For normal code updates after setup, use `npm run deploy:token`. For a new schema
migration or a passphrase change, rerun `npm run setup:live`. Commit the updated
database ID in `wrangler.jsonc`; it is configuration, not a credential.

### What to try and measure

- Start the test. Persian timestamps load first; Finglish sections arrive one at
  a time. Conversion starts while the silent clock is paused, so press Play when
  ready. It processes ahead without waiting a full minute between API calls.
- The pinned LRCLIB recording is **13013538**, Gharibe Ashena / Googoosh / Kooh,
  duration **3:57**, checked on 2026-09-08. It has 28 sung lines plus instrumental
  markers. Its first lyric begins at **0:27.17**. The opening displays Instrumental.
- The four batches start at **0:27.17, 1:02.60, 2:14.66, and 3:13.70**, with
  **6 / 8 / 8 / 6 lines**. Lines are assigned by their original start timestamp;
  a line may continue across a minute boundary. Dense minutes split further at
  ten lines or 1,200 source characters. No line is cut in half.
- Before everything finishes, jump to section 4. Copy is disabled until the
  selected line is ready. The current request finishes first; section 4 becomes
  the next request. Returning to a completed section is immediate.
- Completed text stays in the scrolling lyrics view. Highlight following scrolls
  that panel, not the entire page. Copy always uses the current completed line.
- A failed batch pauses scheduling. Retry that section explicitly, or continue
  other sections. Completed results are retained. Network timeouts can leave
  server processing uncertain; wait up to three minutes before retrying.
- Expand **Test timings and source** to record each batch's original generation
  time and neurons, if the binding returns usage. Reload and check that completed
  sections return from D1 without another AI call. Timing shown for cached output
  is its original generation time, not this visit's download latency.
- Live data requires a connection after reload. Already loaded lines remain in
  memory when connectivity drops; the original static preview still works offline.
  Persistent private lyrics storage on the phone remains a later milestone.

### Worker behavior and limits

All `/api/*` requests run through the Worker before static asset routing. They
require the private test passphrase, sent in an Authorization header, and use
`Cache-Control: no-store`. The UI keeps the passphrase only in memory until lock,
navigation, or reload. This is temporary single-owner test access, not the final
Spotify customer-authentication implementation.

Only the pinned source record and server-defined batch IDs are accepted. The
browser cannot submit arbitrary prompts or lyric text to the AI. The v4 prompt,
Qwen3.8 model and earlier sampling settings remain unchanged. Blank instrumental
markers and all timestamps stay outside the model. Missing/extra/duplicate IDs,
reordered IDs, Persian output, malformed JSON and truncated completions are rejected.
This checks structure, not whether the pronunciation is correct.

D1 stores the source for 24 hours and completed conversions by source content,
recording, model, prompt, parameters and batching version. An atomic database
lease prevents concurrent tabs from starting the same batch. Other tabs poll
the cache without making additional inference calls. Failure/timeout leases last
three minutes; incomplete results are never saved as successful batches.

An atomic **24 AI-attempt cap per UTC day** includes failures and retries. It is
shared by all users of this test and survives redeployment. Cache reads do not
consume attempts. This is a conservative experiment guard, not an exact neuron
budget or a guarantee about all account usage. Workers AI's own Free quota still
applies; do not upgrade to paid usage for this experiment. Other apps on the
account can consume that same provider quota.

Validation: 12 timeline/parser/Worker tests and 10 desktop/mobile browser checks
pass, including real SQLite lease/cache/budget operations and simulated slow or
failed AI responses. Production build and Worker deployment dry run pass.
The LRCLIB recording was fetched live; **no new real AI call has been made by
these automated tests**. The next acceptance step is your authenticated deployment
and review of the real generated lines and timing.

Local development: `npm run dev` serves the UI and proxies `/api` to port 8787.
`npm run preview` alone serves assets and does not run the Worker API. To run the
real Worker locally, configure a private ignored `.dev.vars` with
`TEST_ACCESS_KEY`, apply `npm run db:local`, and run `npm run dev:worker` in another
terminal with Cloudflare authentication available. The AI binding can call the
remote service even during local development and consume quota. Automated tests
use synthetic source lines and mocked AI instead.

References: [AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/),
[API routing before assets](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
[D1 token permission](https://developers.cloudflare.com/d1/tutorials/import-to-d1-with-rest-api/).

## Archived: original silent preview

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

The account-specific live address is recorded above. Cloudflare prints the
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

## If Cloudflare login returns a 403 bot challenge

The first login attempt on this laptop reached the OAuth token exchange, but
`dash.cloudflare.com/oauth2/token` returned an HTML bot challenge instead of JSON.
This is an authentication/network failure; changing the PWA does not fix it.
The log does not establish why Cloudflare challenged this connection.

Use a deployment API token as the supported alternative:

1. Open [My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens).
   Select Create Token → Create Custom Token, and name it `Hamava deployment`.
2. Add **Account → Workers Scripts → Edit** and
   **Account → Account Settings → Read**. Under Account Resources, select
   **Include → Specific account → your intended Cloudflare account**.
   This static workers.dev deployment needs no zone/DNS or Workers AI permissions.
3. Create the token and keep it privately. The earlier AI-only token is not a
   deployment token. Copy your Account ID from the Cloudflare dashboard too.
4. Run `npm run deploy:token`. It builds first, then asks for the Account ID and
   hidden token. Paste the token at that prompt, not into a command or chat.
   The helper does not write credentials to disk or your shell history, and
   passes them to Wrangler through its supported environment variables.
5. Open the printed workers.dev URL and share the URL or error output for review.
   For subsequent uploads, run the same command and enter the credentials again.

This avoids the failing OAuth exchange; API access can still fail independently.
If it also receives an HTML challenge, try a different VPN exit/network and retry.
For persistent challenges, contact Cloudflare with the Ray ID from that attempt.
Do not treat a JSON permission error as a bot challenge: check token permissions
and the selected account in that case.

References: [API token authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/),
[creating scoped tokens](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/).

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
| 3 · Find and convert | LRCLIB lookup and recording matching; Qwen3.8 through Worker AI binding; bounded time sections; D1 batch cache | Show first completed batch; prioritize the current playback position; retry only failed batch; strict IDs and timing; switch track without stale lyrics | Week 2 |
| 4 · Make it dependable | Edits, device cache, delay adjustment, failure states, budget guard, phone refinements and handoff | Acceptance session with customer's songs, install/reopen, poor network, quota exhausted, revoked Spotify login, corrected line persists | Weeks 3–4 |

Milestone 1 is deployed and the owner reports it works. Full customer-device
acceptance and GitHub setup remain open. The one-song slice of milestone 3 is
implemented locally ahead of milestone 2, as requested. Spotify remains planned.

Verified locally on 2026-09-08: three timeline tests and six Chromium browser
checks passed, TypeScript and the production build passed, and the Cloudflare
deployment dry run passed. Desktop and phone screenshots were visually reviewed.
The browser checks exercised clipboard contents, playback/seek/end behavior,
saved state, dialogs, focus view, viewport fit, manifest, and offline reload.
OAuth login failed; token-based static deployment succeeded. Private GitHub
repository creation is still pending.

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
            remaining batches → save + display
```

- Frontend: React + TypeScript + Vite. Same web code for iPhone, Android, laptop.
- Hosting: Cloudflare Workers Static Assets on its free HTTPS domain.
- Backend: one Worker API with AI and D1 bindings for the one-song test. Keep paid services off.
- Lyrics: LRCLIB first. Best-effort catalog coverage; no universal-song promise.
- Model: `@cf/qwen/qwen3.8-27b`, `chat_template_kwargs.enable_thinking: false`.
- Baseline prompt: v4. Temperature 0.7, top_p 0.8, 900 output-token cap per test
  batch. Version prompt/model in cache keys. Tune through separate controlled tests.
  The exact successful prompt is preserved in [docs/finglish-prompt-v4.txt](docs/finglish-prompt-v4.txt).
  The server loads it for the live test; it is not bundled into the browser.
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

## Archived: manual acceptance checklist for milestone 1

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
npx playwright install chromium firefox
npm run check
```

On Linux, if Chromium reports missing shared libraries, run
`npx playwright install-deps chromium` in your terminal; it can require your sudo
password. For this laptop's current verification, browsers use Playwright's normal
cache and three missing libraries were extracted into `/tmp` without a system
installation. While those temporary libraries remain, rerun the checks with:

```bash
LD_LIBRARY_PATH=/tmp/hamava-browser-libs/extracted/usr/lib/x86_64-linux-gnu npm run check
```

The checks cover timeline boundaries, instrumental gaps, backward seeking,
elapsed-time interpolation, strict TypeScript build, mobile and desktop UI,
clipboard, local saved state, dialogs, viewport overflow, manifest and offline
reload. Chromium emulation is not a substitute for customer iPhone testing.

```text
src/App.tsx                   landing and future mode entry screens
src/styles.css                responsive visual system
src/data/demo.ts              prepared lyrics and pinned demo timing
src/components/LyricsPlayer.tsx shared player and guided controls
src/hooks/useAudioPlayer.ts   actual MP3 media clock and playback events
src/lib/timeline.ts           current-line and clock calculations
src/hooks/usePreviewPlayer.ts silent clock retained for the protected live test
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
