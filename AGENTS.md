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
- The owner requested a live single-song test before Spotify. The protected
  `/?live` flow fetches LRCLIB record 13013538 at runtime and uses one-minute
  bounded AI batches. This experiment is paused pending G2P evaluation; do not
  make AI calls from the homepage. Follow README for its AI/D1 bindings and secret.
