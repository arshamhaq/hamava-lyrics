# Hamava working notes

Read README.md first: it is the implementation plan and milestone record.

- This is a separate private project. Never add the unrelated Go repository.
- The homepage now plays the owner-supplied MP3 as an explicit guided demo.
  Spotify and search routes remain placeholders; never imply they are connected.
- Keep original LRCLIB timestamps outside AI input; validate and restore IDs.
- Secrets never belong in VITE_* variables, browser code, commits, or logs.
- Use Workers Static Assets now; add an authorized Worker API and D1 later.
- The owner explicitly requested the full supplied recording and prepared
  Finglish/LRCLIB timing for this single homepage demo. Keep broader raw lyric
  catalogs and customer correspondence out of Git. Audio must not autoplay.
- Use the lockfile. Run meaningful timeline tests, typecheck/build, and browser
  checks for relevant UI changes. Browser emulation is not real-phone acceptance.
- Follow the approved model/batching approach in README; benchmark prompt changes
  separately from network reliability. Do not claim quotas or speed from one run
  as guarantees for every song.
- Update milestone checkboxes only after the corresponding work is verified.
- The owner accepted the browser CPU test. Use the shared `lyricsEngine` in
  `src/g2p/engine.ts` for real songs; never create model workers per component.
  `/lyrics`, `/?live` and `/g2p` use this reader. The homepage demo remains static.
- The old Cloudflare AI endpoints are retired with 410 responses and the deployed
  Worker only binds ASSETS. Do not restore AI or D1 as an inference dependency.
- Preserve `hamava-negara-*` model caches across app updates and repair. App version
  changes must not change pinned model URLs or the model-cache namespace.
