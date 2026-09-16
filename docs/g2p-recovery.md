# Decoder repetition recovery — v0.7.3

## Finished loops (v0.7.3)

Khanoom Vaziri line 83 produced 163 words in 498 tokens with EOS. It was neither
truncated nor routed through recovery; the retry-only expansion heuristic never
saw it. This explains the long invented sequence of `ey` despite three vocal
sounds in the source.

A separate conservative guard applies to completed output at every recovery
depth: repeating 1–3-word runs, at least 12 repetitions, occupying more than 24
words and more than twice the source word count. It rejects the candidate and
uses the existing split/recovery/fallback path. It does not trim output, change
normal decoding, lower recovery limits, or suppress repetitions from the source.
The broad word-count heuristic stays limited to retry fragments to avoid its
previous false positives on ordinary whole lines.

The repaired real-model output is short again, ending `e e eye e`. This still
is not an exact rendering of three written vocal sounds: the guard catches the
extreme loop, not every small pronunciation or repetition error.

Old saved song records remain unchanged. Remove/reselect an affected saved song
after reloading v0.7.3. No weight redownload is required.

## Completion fallback (v0.7.2)

Short inputs can fail too: the user-supplied `بغل تو و و عطر تن تو و و`
reproduced the loop, as did a stretched vocalization in Khanoom Vaziri (line 43).
A larger output ceiling is not a solution to repeating greedy output.

Recovery still first tries bounded smaller phrases. If a fragment cannot finish,
only that fragment uses deterministic Persian-to-Latin spelling. Successful
model phrases are retained. Source repetitions are preserved; isolated `و` becomes
`o`, written vowel marks are retained for spelling, and digits become Latin digits.
The converter does not publish truncated phonemes or invent a raw model trace.

Rows containing any spelling fallback have `approximate: true` and a visible
“Approximate · check the Persian” label with the original text. Copy works in both
readers. Completed songs preserve the flag when saved/reopened offline. Test-reader
JSON exports preserve the same metadata. Completion stats include `approximateLines`.
Model revision and download caches remain unchanged.

This ensures bounded text output for decoder-limit/empty-output failures, **not
100% correct pronunciation**. Persian often omits short vowels; deterministic
spelling cannot recover them. Download failures, unavailable runtimes, cancellation
and resource exhaustion still fail visibly. Existing input limits still apply.
The legacy per-line error protocol remains supported for older/explicit failures.

Real CPU checks on desktop and mobile-emulated Chromium now complete all 108
Khanoom Vaziri rows, all 48 Asheghan rows and the user's short repeated-vocal
example. Del Bordi's 33 rows and existing raw-output parity checks still pass.
These are completion checks, not pronunciation accuracy scores. Validation:
33 unit tests, production typecheck/build and 40 relevant browser checks.

## Historical v0.7.1 behavior

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
