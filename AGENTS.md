# Hamava working notes

Read README.md first: it is the implementation plan and milestone record.

- This is a separate private project. Never add the unrelated Go repository.
- The homepage now plays the owner-supplied MP3 as an explicit guided demo.
  `/spotify` now uses browser PKCE and Spotify playback APIs. It needs a configured
  public Client ID and an authorized account; never imply real-account acceptance
  until the owner has tested it. `/search` and `/paste` remain unsynced.
- Keep original LRCLIB timestamps outside AI input; validate and restore IDs.
- Secrets never belong in VITE_* variables, browser code, commits, or logs.
- Use Workers Static Assets and the bounded search/lyrics API. Inference stays on the browser CPU.
- The owner explicitly requested the full supplied recording and prepared
  Finglish/LRCLIB timing for this single homepage demo. Keep broader raw lyric
  catalogs and customer correspondence out of Git. Audio must not autoplay.
- Use the lockfile. Run meaningful timeline tests, typecheck/build, and browser
  checks for relevant UI changes. Browser emulation is not real-phone acceptance.
- Follow the shared CPU engine approach in README; evaluate model changes
  separately from network reliability. Do not claim quotas or speed from one run
  as guarantees for every song.
- Update milestone checkboxes only after the corresponding work is verified.
- The owner accepted the browser CPU test. Use the shared `lyricsEngine` in
  `src/g2p/engine.ts` for real songs; never create model workers per component.
  `/lyrics`, `/?live` and `/g2p` use this reader. The homepage demo remains static.
- The old Cloudflare AI endpoints are retired with 410 responses and the deployed
  Worker only binds ASSETS; search proxies need no extra binding. Do not restore AI or D1 as an inference dependency.
- Preserve `hamava-negara-*` model caches across app updates and repair. App version
  changes must not change pinned model URLs or the model-cache namespace.

- Dev/build prepares hash-verified model/runtime assets with `prepare-engine-assets.mjs`.
  Keep them out of Git and Workbox precaching; retain the legacy model cache keys.
- Search must distinguish confirmed Persian lyrics from metadata-only suggestions.
  Keep provider retries bounded and respect 429; no sync controls in search readers.

- Successful connectivity checks stay silent. Provider/app failures use the global
  top banner on every route. Alternate lyrics.ovh results must have verified
  nonempty Persian lyrics before appearing in suggestions.
- `/paste` is the homepage's third main route; keep its reader shared with search.
  First-time download progress includes both models and the runtime; 100% means
  complete setup, never completion of just the first file.

- Spotify subscription is three-state: Premium, Free/open, or unknown (new Dev Mode
  profiles omit product). Never label an unknown account Premium or Free.
- Spotify token traffic goes directly to Spotify; only public metadata reaches
  /api/spotify-lyrics. Never store tokens in the Worker, lyrics caches or VITE_*.
- Polling must be bounded, respect Retry-After, pause while hidden, and discard
  stale track/conversion responses. Preserve lyric timing outside model input.
