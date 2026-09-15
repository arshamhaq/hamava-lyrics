# Reserved CPU G2P review — 2026-09-15

Decision: public Negara v7, greedy decoding, is the candidate for an isolated
browser feasibility test. This is an engineering choice supported by the previous
ONNX/WASM experiment, not a decisive pronunciation win or production acceptance.
Keep Homo-GE2PE available as a comparison; do not run both in the phone app without
evidence that the added download, memory and arbitration actually help.

## Run and measurements

Source: `research-private/g2p/results/20260915-115338-48810-holdout/`.
All 16 reserved Persian sentences and both models' raw outputs were reviewed.
64 outputs completed (16 × two models × two passes), no errors, no output-limit
truncation, identical outputs across passes. Checkpoint revisions match development.
No reference sentences were supplied to inference.

| Model, beam 1 | Median generation | p95 | Original word-edit proxy | Corrected proxy |
|---|---:|---:|---:|---:|
| Homo-GE2PE | 97.58 ms | 129.52 ms | 18.28% | 17.20% |
| Negara v7 base | 92.09 ms | 115.36 ms | 17.20% | 17.20% |

The proxy measures spelling-normalized word edits, NOT pronunciation accuracy.
Both have 16 edits against 93 reference words after the formatter correction.
Corrected normalized exact lines: Homo 6/16, Negara 5/16. This small sample and
provisional references do not establish a statistically meaningful quality winner.
`va/o`, `nemiyad/nemiad`, `omidash/omidesh` and other spelling/dialect differences
should not automatically count as failures. Some long-vowel mistakes also escape
the proxy. Raw-phone review is the basis of the decision.

Timing covers warmed laptop PyTorch generation only. It excludes startup, model
download, tokenization and UI. Nothing here establishes mobile performance or RAM.

## Remaining formatter defect

Homo emits `p/;morde` for پژمرده: the semicolon represents the zh sound in this
output, not punctuation. Our incomplete mapping rendered `pa;morde`, creating a
false word error. Added the model-specific `;` → `zh` mapping and a paired regression
check. No raw output or reference changed. `corrected-format-v3/` stores a separate
rescore with source hash; the original report is preserved. Eight harness checks
pass. This correction is output decoding, not a newly learned pronunciation rule.

Negara's mixed raw `oun` spelling still renders as `ooon` with the simple u→oo
formatter. Judge it as a display defect rather than three spoken vowels. Final
browser formatting needs an explicit alphabet/style pass before acceptance.

## What worked and what did not

Both handle these sentences well, allowing ordinary Finglish spelling differences:

- یه لحظه صبر کن تا حرفمو بگم → ye lahze sabr kon ta harfamo begam
- تو گفتی برمی‌گردی ولی برنگشتی → to gofti barmigardi vali barnagashti
- گل سرخ روی میز پژمرده شد → gole sorkh rooye miz pazhmorde shod
- دلم برای کوچه قدیمی‌مون تنگ شده → delam baraye koocheye ghadimimoon tang shode

Material problems in both include `rofti` for رفتی (expected rafti), `kenareye` for
کنار in this context (kenare), `beduneye` for بدون (bedoone), and formal `khane`
for colloquial خونه (khoone). Both omit the linking vowel in `yade oon shab` and
in the `didane dobareye to` phrase. Both produce `meno` where we want `mano`.

Homo does better with the first sentence's `esmamo`, the sentence about the room's
light, and the linking vowel in `adame diroozam`. Negara does better with `akhare
in rah`, and preserves رود as `rood` where Homo reads `ravad` and misattaches the
preceding words. Negara still adds the unwanted `-ye` to `kenare` there. Neither
model can safely repair the other just by choosing the more confident output.

Conclusion: useful draft Finglish and encouraging laptop speed, but errors are
frequent enough that unattended arbitrary-song pronunciation is not accepted.
The deadline is not a reason to label this ready. No more beam-search sweeps or
longer CPU runs are justified by these results.

## Next bounded milestone

Test Negara in a standalone browser page with paste-in Persian and visible raw
phones/Finglish. Run inference off the UI thread using a browser Web Worker.
Start with the previously exercised WASM path, then check WebGPU support and
actual behavior on the customer's phone. Measure cold download, first result,
warm speed, peak memory where measurable, and whether controls remain responsive.
Do not replace the current app inference or deploy as accepted lyrics yet.

Quality work, if this browser test succeeds: finalize formatting, preserve repeated
words and line IDs, support saved whole-line corrections, and test complete
owner-authorized songs. Any source-aware pronunciation rule must be evaluated on
fresh sentences; these 16 are now consumed as an evaluation set. A formatting
repair alone cannot fix contextual pronunciation or dropped words.
