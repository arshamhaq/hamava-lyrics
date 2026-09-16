# Decoder repetition recovery — v0.7.1

The two reported failures were reproduced with the real pinned CPU model:
LRCLIB 37630694 (Khanoom Vaziri), line 5, and 17152239 (Asheghan feat.
Alireza Ghorbani), line 37, counting non-empty plain-lyric rows.

Both inputs fit the existing 512-byte input limit. The decoder repeated phonemes
instead of producing EOS, reaching the separate 512-token output ceiling. The
old worker threw a fatal error, so every later lyric stayed unconverted. Retrying
repeated the same greedy decoding and the same failure. This was unrelated to
Cloudflare quotas or weight downloads.

## Recovery and limits

- Keep the original decoder and output ceiling. Discard incomplete output,
  including byte sequences cut in the middle of a UTF-8 character.
- For an incomplete output, retry smaller phrases; reject conspicuous expansion
  in those retry fragments,
  preferably at punctuation/whitespace near the midpoint. Preserve the source
  row, IDs, timing, ordering and actual repetition; rejoin only finished phrases.
- Repeated phrases within that same line reuse a successful pronunciation,
  ignoring surrounding punctuation only. This preserves chorus repetitions
  without blindly suppressing repeated output tokens.
- Recovery has maximum depth 4, 15 inference attempts and 2,048 total output
  tokens per line. Smaller phrases get smaller generation limits (48–256).
  Cancellation stays active between decoding steps and retries.
- The retry-fragment expansion guard compares output word/letter counts with input.
  Normal completed whole-line decoding stays unchanged. It is a
  heuristic for obvious repetition, not a proof of pronunciation accuracy.
  Phrase splitting can lose context; no dictionary corrections or new weights
  have been added.
- If recovery fails, send an explicit `line-error` with no generated text. Keep
  the original Persian, disable Finglish copy for that row, and continue. A real
  runtime/model-download error still fails visibly instead of being concealed.
- Only completed conversions enter the warm line cache. Repeated failed lines
  are reused only within the current job to avoid repeated expensive failures.
  Partially converted songs are not saved as complete offline songs.

The shared engine exposes optional `error` and `recovered` fields on LineOutput,
plus `failedLines` and `recoveredLines` counters in worker completion stats.
Both the normal and fullscreen reader show unresolved original lines clearly.
The raw test reader exports the same diagnostics.

## Reproduction and checks

Private LRCLIB fixtures and before/after traces are under
`research-private/output-limit/`, excluded from Git. Tests retain only provider
IDs; song texts and model outputs stay private. The targeted lines now return
bounded completed output with the original repeated words retained.

`npm test` checks split recovery, bounded failures, completed-but-expanded output,
repeated-phrase reuse, cancellation/runtime failures, and the engine's per-line
error protocol. The browser mock check verifies that later lines remain readable
and that a partially converted song is not silently saved.

Run the actual-song checks with:

```bash
HAMAVA_FAILURE_SONGS="$PWD/research-private/output-limit" \
  npx playwright test tests/browser/g2p-recovery.spec.ts
```

They use the real shipped CPU engine and the full source songs, with external
model hosts blocked. Browser mobile emulation is not a phone speed benchmark.
Deploy with `npm run deploy:token` and confirm v0.7.1 after Reload app. Model
revision/cache keys are unchanged, so the fix does not require new weights.

Final full-song result on both desktop and mobile-emulated Chromium: Asheghan
48/48 lines converted; Khanoom Vaziri 107/108 converted, with one difficult line
kept explicitly in Persian. Both reported failing rows recovered. These counts
mean decoding completed, not that every pronunciation was linguistically correct.

Verified: 30 unit tests, production build/typecheck, deployment dry-run, and 34
relevant browser cases across the regression run and the final four full-song
checks. The tests include continuation past an unresolved line and refusal to
save partial output as a completed offline song.
