# CPU G2P development review — 2026-09-15

Decision: retain both public models for the reserved test, using greedy decoding
(beam 1). Negara v7 is the provisional integration candidate because an ONNX
export has already been exercised in the earlier WASM experiment, not because
this development run establishes superior pronunciation. Neither model is yet
accepted for full songs or customer phones. Do not return to paid cloud inference
or start training on the basis of these results.

## Evidence

Source: `research-private/g2p/results/20260909-235916-250109-dev/`.
416 outputs: 52 cases × two models × two decoding settings × two passes.
50 distinct development cases were reviewed in raw phonemes for all four settings.
Two duplicate cases and repeated passes are consistency checks, not extra quality
samples. There were no execution errors or output-limit truncations. Repeated
inputs produced identical outputs within each configuration.

| Model | Beams | Median generation/line | p95 | Corrected word-edit proxy | Exact normalized lines |
|---|---:|---:|---:|---:|---:|
| Homo-GE2PE | 1 | 83.76 ms | 104.88 ms | 14.39% | 20/50 |
| Homo-GE2PE | 5 | 147.33 ms | 186.79 ms | 14.39% | 20/50 |
| Negara v7 base | 1 | 85.92 ms | 137.33 ms | 15.13% | 20/50 |
| Negara v7 base | 5 | 143.20 ms | 182.17 ms | 16.24% | 19/50 |

These are laptop CPU PyTorch measurements with two threads, after warmup;
input tokenization, formatting, downloads and loading are excluded. They are not
phone/browser measurements. A rough 40-line estimate from the medians is 3.4 seconds
of generation, not a measured whole-song latency or a mobile promise.

Checkpoint sizes: Homo 33,062,296 bytes; Negara 32,275,776 bytes. The Python process
peaked at 425.73 MiB including framework and both sequential model runs. This does
not measure browser RAM or prove a 128 MB memory budget. Runtime/download size and
real-phone memory still require measurement.

## Correction to our benchmark

The original Homo formatter missed `$` (sh) and `c` (ch). This was our harness
error, not model failure. Fixing those two mappings changes its word-edit proxy
from 25.83% to 14.39%. No inference, prompt, raw phonemes or reference labels were
changed. The original files remain intact; `corrected-format-v2/` contains the
rescored JSONL, HTML and summary with provenance.

This metric is NOT pronunciation accuracy. Our assistant-authored references are
provisional: `va/o`, `biya/bia`, `tuye/tooye`, long-vowel spelling and suffix variants
can produce false mismatches. Conversely the scorer ignores long/short-a contrasts.
Negara's raw `oun`/`oumadam` also exposes the known simplistic u→oo display issue;
judge those from the raw phones, not the malformed triple-o rendering. That display
convention still needs a deliberate policy before integration. No blanket vowel
replacement or reference relabeling was used to improve these scores.

## Pronunciation review

Both handle many useful lines: wanting to stay, missing someone, rain in the street,
several ezafe constructions, ten/village (`dah/deh`) and tiger/take (`babr/bebar`).
Negara correctly reads `emshab mikham bahat harf bezanam`; Homo reads `bahet`.
Negara also handles Ebi's name better in this run.

Material remaining errors, beyond harmless Finglish spelling:

- Both lose one occurrence in `بیا... بیا! هنوز منتظرم`. Reproducible output and no
  truncation do not guarantee that all words were preserved.
- Both miss the linking vowel in `غریب آشنا` and produce problematic pronunciations
  of `دوستت`; the demo title is not automatically solved by these models.
- Both produce `kenareye` where `kenare` is wanted, and `boht` for `بهت`.
- Both read `رسیدی` with `ra-` rather than the expected `re-` in the regression line.
- Homo gets the man/died pair wrong in the flower sentence (`اون مرد ... مرد`),
  although Negara gets it right. Homo also uses the painkiller reading for housing
  (`مسکن`).
- Negara confuses stamp/affection (`مهر`) and wrestling (`کشتی`), while Homo gets
  those particular distinctions right. Both struggle with the ship example.
- Negara changes colloquial `خونه` to `khane` and emits `minadaze` for `می‌ندازه`;
  Homo preserves those colloquial forms better.
- Both mishandle some suffixes, linking vowels and `برام`. These are not all safely
  fixable with context-free word replacements.

Five beams fix an isolated Homo output but leave its aggregate proxy unchanged;
Negara's five-beam output introduces `ozom` instead of `azam` in one line. Keep
beam 1 for both. The small metric gap is not grounds to declare a quality winner.

## Next steps

1. Run the untouched 16-case reserved set for both models at beam 1:
   `bash scripts/g2p/run.sh --split holdout --models homo negara --beams 1`.
   Existing dependencies/checkpoints are reused. Codex reviews the outputs.
2. Choose a candidate from the actual errors. If we tune after viewing that set,
   reserve new final sentences rather than continuing to call it held out.
3. Test complete authorized songs for repetition, word omission and line handling;
   the present short original sentences do not establish full-song quality.
4. Exercise the selected model in a separate browser Web Worker on the customer's
   actual phone, starting with WASM CPU and testing WebGPU where supported. Measure
   initial download, warm conversion, memory and UI responsiveness before wiring it
   into Hamava. A Web Worker here is a browser thread, not a Cloudflare Worker.

Any later correction mechanism should preserve line IDs, cache repeated full
lines and allow specific edits. Do not promise universal homograph correction.
