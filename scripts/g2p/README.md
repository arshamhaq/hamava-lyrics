# CPU transliteration benchmark

Run in the Linux/WSL terminal from the project folder:

```bash
bash scripts/g2p/run.sh
```

The launcher creates an isolated environment under the already gitignored
`research-private/g2p/`, bootstraps pip if Ubuntu's ensurepip is absent, and installs
CPU-only PyTorch 2.10.0 and Transformers 4.57.6. No sudo, GPU, login or paid inference
is required. First setup downloads several hundred MB of laptop dependencies
plus about 123 MB of model source files; this is NOT the phone app's download size.
Keep the VPN on if Hugging Face/PyPI/PyTorch downloads need it. Later runs reuse
installed dependencies and verified cached checkpoints.

Default: 52 development cases × two models × beams 1 and 5 × two passes = 416
inferences, on two CPU threads. Prints progress for each line. Keep the laptop
awake. Ctrl+C is safe: completed JSONL rows remain, though rerunning starts a new
result directory. Failed downloads can be retried by running the same command.
There is no automatic benchmark resume or background paid job.

Candidates:
- `homo`: public Homo-GE2PE, extracting only model/config/tokenizer files from its
  checkpoint ZIP. Optimizer/pickle training files are never extracted/executed.
- `negara`: public v7.1 checkpoint, which contains the unchanged v7 weights.
  No v7.1 repair overlay is applied; results are the base model.

## Outputs and review

The terminal prints the full results folder. Its path is also in
`research-private/g2p/latest-result.txt`.

- `review.html`: readable Persian, reference, Finglish and original model phones.
- `results.jsonl`: every completed output and timing, saved immediately.
- `summary.json`: per-model/beam scores, latency, truncation, repetition checks.
- `environment.json`: model revisions, file hashes, versions, configuration,
  loading times, CPU information and whole-process peak RAM.
- `packages.txt`: installed Python dependency versions.
- `errors.txt`: model preparation failures, if any.

Tell Codex **“review my latest CPU benchmark”**. There is no need to paste hundreds
of lines; the results stay in this shared project folder.

## Scope and scoring

68 total cases: 10 old regression examples, 40 newly authored development cases,
2 exact repeats, and 16 reserved holdout cases. New material is original short
lyric-like text, not scraped copyrighted songs. It covers informal contractions,
ezafe, homographs, names, whitespace and Arabic/Persian letter variants. It does
not establish coverage for full commercial songs or every dialect.

References are assistant-authored provisional labels. They must be reviewed with
the outputs; they are not certified ground truth. References are used ONLY for
scoring, never given to the model. Raw output is always retained.

The automatic metric is a spelling-normalized word-edit proxy, NOT scientific
phoneme error rate, a semantic judge, or a guaranteed accuracy percentage.
`aa/a`, `oo/u`, `gh/q`, case and punctuation differences are ignored; this also
means long/short-a distinctions are not measured. Other acceptable spellings can
still be flagged incorrectly. Missing ezafe, changed vowels and dropped words
usually remain visible. Do not select a winner on a scalar score alone.

Both models use minimal, documented normalization to retain the owner's colloquial
wording. Homo-GE2PE's full Parsivar preprocessing and optional pronunciation rules
are NOT reproduced here. This evaluates a lightweight app-oriented pipeline, not
exact parity with the published paper. Per-model phone alphabets are converted
separately; original phones remain authoritative if formatting is questionable.

No input is silently truncated. Generation stops at EOS or 512 tokens and records
a truncation flag. One untimed greeting warms the model. CPU PyTorch timings and
whole-process RAM are not browser/WebGPU/phone results. No quality acceptance or
model installation in Hamava is automatic.

## Optional commands

Quick real-model check (three cases, one pass, greedy):

```bash
bash scripts/g2p/run.sh --smoke --beams 1 --repeats 1
```

After reviewing development results and choosing a configuration, run the reserved
holdout ONCE, substituting the selected model and beam count:

```bash
bash scripts/g2p/run.sh --split holdout --models homo --beams 5
```

If we adjust rules after seeing holdout outputs, that set is no longer held out;
new final evaluation sentences will be required. It is held out from our tuning,
not guaranteed absent from historical model training.

Harness checks without downloads:

```bash
python3 scripts/g2p/benchmark.py --list
python3 -m unittest discover -s scripts/g2p -p 'test_*.py'
```

Sources: [Homo-GE2PE](https://huggingface.co/MahtaFetrat/Homo-GE2PE-Persian),
[Negara v7.1](https://huggingface.co/Reza2kn/negara-g2p-clean-v7.1).
See `docs/g2p-research-2026-09-09.md` for the broader candidate comparison.
