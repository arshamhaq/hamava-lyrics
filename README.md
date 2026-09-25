<p align="center">
  <img src="public/hamava-192.png" width="96" height="96" alt="Hamava logo" />
</p>

# Hamava · هم‌آوا

Persian lyrics in letters you can read.

Hamava is a mobile-friendly lyrics reader that converts Persian into **Finglish**:
Persian pronunciation written with Latin letters. It transliterates the words;
it does not translate their meaning into English.

Follow a song playing in Spotify, search for lyrics, or paste your own Persian
text. Conversion runs on your device using a small speech-pronunciation model.

## What you can do

- **Connect Spotify:** follow the current line while music plays in Spotify.
  Pause, resume or seek on an eligible active Spotify device from Hamava.
- **Search a song:** find lyrics by title or artist, including partial searches,
  and read them without playback controls.
- **Paste Persian:** convert text directly when a song is missing from the catalog.
- **Copy any line:** use the inline copy buttons in the regular or full-window reader.
- **Choose how to read:** show the original Persian, increase the text size,
  open the full lyrics, or switch between dark and light themes.
- **Keep songs on your device:** save completed search/paste conversions for
  later reading, and remove them individually.
- **Install the PWA:** open Hamava from your home screen on a compatible browser.
  The homepage includes a guided audio demo.

Timed lyrics are preferred in Spotify mode. If timing is unavailable, Hamava
shows the full untimed text instead. **Wrong lyrics?** offers alternative matches
when available, labelled Synced or Not synced.

## How it works

```text
Spotify playback metadata ─┐
Song search ───────────────┴─> Hamava Worker ─> lyrics providers
                                                  │
Pasted Persian ────────────────────────────────────┤
                                                  ▼
                          Browser CPU → Finglish → lyrics reader
```

The frontend uses React, TypeScript and Vite. A Cloudflare Worker serves the PWA
and handles bounded lyrics lookups through LRCLIB, with verified lyrics.ovh
results as a fallback. A shared browser Web Worker runs Negara G2P through ONNX
Runtime Web using CPU/WASM. WebGPU is not required.

The first conversion downloads about **47 MB** of pinned model and runtime files
from the app's own origin. Later conversions reuse those files when browser
storage permits. Reloading still requires model initialization; clearing site
data or browser storage eviction can require another download. Opening the
homepage alone does not initialize the model.

Original lyric timestamps stay outside the model. Unreliable model fragments
use bounded recovery and, where necessary, an **Approximate** spelling fallback.
Playback remains in Spotify; Hamava does not stream Spotify audio.

## Run locally

Requires **Node.js 22.12 or newer** and npm. Internet access is needed for the
initial dependency/model downloads and online song lookups.

```bash
git clone https://github.com/arshamhaq/hamava-lyrics.git
cd hamava-lyrics
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Search, paste and the demo work without a Spotify
Client ID. The dev server provides the lyrics API locally.

The `predev` and `prebuild` scripts download and SHA-256 verify the pinned ONNX
and WASM files into ignored `public/engine-assets/`. If a download fails, restore
connectivity and rerun the command. Model binaries are not committed to Git.

## Connect your Spotify app

1. Create an application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   and select **Web API**. The Web Playback SDK is not used by Hamava.
2. Register these redirect URIs for local development and preview:

   ```text
   http://127.0.0.1:5173/spotify/callback
   http://127.0.0.1:4173/spotify/callback
   ```

   Add `https://YOUR-HOST/spotify/callback` for your deployment, replacing
   `YOUR-HOST` with its actual hostname. These must match exactly; do not append
   a slash after `callback` or substitute `localhost` for `127.0.0.1`.

3. In **Settings → Users Management**, authorize the Spotify accounts that will
   use your Development Mode application.
4. Copy the public **Client ID**, then run:

   ```bash
   npm run setup:spotify
   ```

   This saves `VITE_SPOTIFY_CLIENT_ID` in ignored `.env.local`. Never put a Client
   Secret in this field. Restart the dev server or rebuild after changing it.

5. Open **Connect Spotify**, authorize access, start a song in Spotify, and return
   to Hamava. After changing Client IDs, disconnect and reconnect existing sessions.

Spotify currently requires a Premium app owner for Development Mode and limits
access to authorized users. Playback controls also depend on account and device
eligibility. Hamava supports Premium, Free and unknown subscription states;
missing subscription information is not treated as proof of Premium.

See Spotify's [Development Mode requirements](https://developer.spotify.com/documentation/web-api/concepts/quota-modes),
[redirect rules](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri)
and [PKCE guide](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow).
A public source repository does not grant public access to a Spotify registration.

## Deploy to Cloudflare

1. Set your Worker name in `wrangler.jsonc`.
2. Configure the Spotify Client ID if you want Spotify mode.
3. Run:

   ```bash
   npm run deploy:token
   ```

   The script builds the app, then prompts for your Cloudflare Account ID and
   deployment API token. Token input is masked and used only by that process.

4. Add the resulting HTTPS callback URL to your Spotify application settings.

Alternatively, use `npm run cf:login` followed by `npm run deploy` with Wrangler
OAuth. `npm run deploy:check` builds and performs a deployment dry run.

The active deployment uses Workers Static Assets and the lyrics API. It requires
no Workers AI or D1 binding and makes no paid model-inference requests. Hosting
and external API quotas still apply; free-tier availability is not guaranteed.

## Privacy, offline use and limitations

- Persian text is converted locally. Searches and song metadata are sent through
  the lyrics API to providers; model inference does not send text to a cloud LLM.
- Spotify authorization uses PKCE. Tokens stay in browser session storage and go
  directly to Spotify; temporary login state uses local storage. Disconnect clears
  Hamava's session. The Cloudflare lyrics API does not receive Spotify tokens.
- Preferences and saved songs are stored on the device. Offline app-shell and
  saved-song access depend on cached data; new searches and Spotify sync need a
  connection. Cached model files alone do not make every song available offline.
- Lyrics coverage, pronunciation and timestamps are imperfect. Different live,
  studio or acoustic recordings can require selecting another lyric match.
- Spotify polling pauses while Hamava is in the background and resynchronizes on
  return. Continuous background or frame-exact synchronization is not promised.
- Browser/PWA login behavior varies, especially on iOS. If a callback cannot
  verify its session, start and finish login in the same browser; state validation
  is never bypassed.
- Provider outages, rate limits and subscription changes can interrupt features.
  Network errors have bounded waits and retry actions.

If the installed app looks outdated, go online and use **Check for updates**.
**Repair app cache** repairs the app shell while preserving the separate model
caches. Browser storage deletion can remove both cached models and saved songs.

## Development checks

```bash
npm run test                   # Unit tests
npm run build                  # TypeScript check + production build
npx playwright install --with-deps chromium firefox
npm run test:e2e                # Browser tests against the production preview
```

`npm run check` runs unit tests, the build and browser tests together. The browser
suite covers desktop/mobile Chromium and targeted Firefox update behavior.
Optional real-model cases need their separate fixtures; normal runs skip those
cases when fixtures are absent. Browser emulation does not replace physical
phone testing.

## Project layout

| Path                   | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `src/`                 | Homepage, routes, shared readers and UI                 |
| `src/spotify/`         | PKCE login, playback polling and lyric adapters         |
| `src/g2p/`             | Shared on-device conversion engine                      |
| `public/g2p-worker.js` | ONNX runtime, decoding and model caching                |
| `shared/`              | Lyric parsing, search matching and timing helpers       |
| `worker/`              | Lyrics API, connectivity and static-asset serving       |
| `scripts/`             | Model preparation, Spotify configuration and deployment |
| `tests/`               | Unit and browser regression coverage                    |

## Credits and licensing

- Lyrics lookup: [LRCLIB](https://lrclib.net/) and [lyrics.ovh](https://lyrics.ovh/).
- Persian pronunciation model: Negara G2P, using the pinned
  [Gooya ONNX export](https://huggingface.co/Reza2kn/gooya-v1-ONNX-fp16/tree/5720b2c489764572a5c8b55ea7b8d910258c88ef/negara-g2p-v7/onnx).
- Browser inference: [ONNX Runtime Web](https://onnxruntime.ai/), with its
  [license notice](docs/onnxruntime-LICENSE.txt) included.
- Spotify integration uses Spotify's APIs and branding; Hamava is not affiliated
  with or endorsed by Spotify.

No project-wide source-code license has been selected yet. Third-party packages,
models, recordings, artwork and lyrics retain their own terms and ownership;
repository access does not grant permission to redistribute that content.
