# Hamava working notes

Read README.md first: it is the implementation plan and milestone record.

- This is a separate private project. Never add the unrelated Go repository.
- Milestone 1 is a static, silent PWA preview. Do not imply Spotify is connected
  or audio is playing until real authorization and playback data exist.
- Keep original LRCLIB timestamps outside AI input; validate and restore IDs.
- Secrets never belong in VITE_* variables, browser code, commits, or logs.
- Use Workers Static Assets now; add an authorized Worker API and D1 later.
- The public demo uses only the owner-supplied excerpt and original artwork.
  Keep raw third-party lyric catalogs and customer correspondence out of Git.
- Use the lockfile. Run meaningful timeline tests, typecheck/build, and browser
  checks for relevant UI changes. Browser emulation is not real-phone acceptance.
- Follow the approved model/batching approach in README; benchmark prompt changes
  separately from network reliability. Do not claim quotas or speed from one run
  as guarantees for every song.
- Update milestone checkboxes only after the corresponding work is verified.
