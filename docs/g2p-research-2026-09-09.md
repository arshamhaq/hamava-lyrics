# Local transliteration candidates — 2026-09-09

Research only. Hamava remains v0.4.6. No app integration, deployment, paid API
calls, fine-tuning, or gated-file access occurred. The owner confirms approval
for jafarahmadi/negara-g2p-v2-homorich-disambiguated is still pending and requests
alternatives beyond Negara. The customer phone is still unknown.

## Recommended decision

Benchmark public Homo-GE2PE against the public Negara v7 ONNX export on the same
held-out lyric lines. HomoFast/eSpeak is the independent CPU-oriented alternative
if both neural candidates disappoint. Do not spend the month training a model
or optimizing WebGPU before checking pronunciation. Do not treat any candidate
as accepted before native-speaker review and a real-phone test.

The important distinction is download size versus runtime memory. Cloudflare's
128 MB limit is server-isolate memory, not the browser's model-download allowance.
A file smaller than 128 MB can still require more than 128 MB RAM. Keep 128 MB as
a conservative complete download budget and measure phone memory separately.
Cloudflare Static Assets has a separate 25 MiB per-file limit. The downloaded
ORT WebGPU WASM binary is 26,827,543 bytes, above that limit: hosting or splitting
that file needs a deliberate solution. CPU WASM and the two v7 graphs fit per file.
Source: https://developers.cloudflare.com/workers/platform/limits/

## Public alternatives inspected

| Candidate | Size evidence | Quality / browser assessment |
| --- | --- | --- |
| MahtaFetrat/Homo-GE2PE-Persian | Downloaded homo-ge2pe.zip: 89,780,550 bytes. Actual model.safetensors: 33,062,296 bytes; 8,264,064 stored parameters. Much of the archive is optimizer state. | Strong candidate for next quality benchmark. Contextual sentence G2P; public MIT card and Apache/MIT dependency notices. No ready ONNX graph in the inspected release; needs export and preprocessing parity. Not run locally yet. |
| Reza2kn/negara-g2p-clean-v7 and v7.1 | v7.1 weight file: 32,275,776 bytes. Public v7 ONNX encoder + merged decoder downloaded: 33,281,841 bytes total. | Actual local WASM smoke succeeded; pronunciation errors remain. v7.1 is the same checkpoint plus small exact-match corrections, not a newly trained model. v7 card leaves license unspecified; browser-export package says other. Resolve distribution terms before shipping it. |
| HomoFast eSpeak | GitHub tree includes 42,676,972-byte context dataset, plus engine, dictionaries, and other data. | Serious non-neural/contextual alternative. Paper reports fast CPU inference. Missing ezafe remains a known weakness. Browser build/footprint not measured. eSpeak upstream has Emscripten build support. GPL-3.0-or-later code. |
| HomoFast/eSpeak + abreza/persian-ezafe-albert | Quantized ALBERT ONNX: 40,132,062 bytes; tokenizer.json: 2,381,296 bytes. These add to the engine/database/runtime. | Potentially within 128 MB download after careful packaging. More engineering than one model. Ezafe detector alone is not a G2P converter or homograph solver. CPU/WebGPU operator support needs testing. |
| Charsiu tiny, klebster ONNX export | Encoder 57,234,020 + decoder 26,118,052 + decoder-with-past 22,960,684 = 106,312,756 bytes before runtime. | Public ONNX option, but word-level inputs lose sentence context. Export card reports Persian PER about 15.03%, WER 56.4% on its own word benchmark. Not directly comparable to SentenceBench; weaker fit for contextual lyrics. |
| PersianG2P, Persian_G2P, Persian Transformer, persian_phonemizer | Small/dictionary approaches exist; complete browser bundles not measured. | Comparative SentenceBench paper reports worse PER than Homo-GE2PE or HomoFast. Keep as baselines rather than spending first integration effort here. |
| KiaBush/persian-text-to-ipa-byt5 | Model card: 0.3B parameters, F32. | Substantially too large for our download target as published. Even 4-bit raw weights alone would be roughly 150 MB at 300M parameters; no published quality benchmark on card. |
| Interscript fas-g2p-1.0 | Published artifact: 2.6 GiB FP32. | Far above the target as released. |
| JavaScript f2f / letter-mapping tools | Very small browser-capable code. | Useful for orthographic conversion, but they cannot reliably recover missing Persian vowels or contextual pronunciation. Not sufficient for the requested reading experience. |

Hama and direct Finglish/TTS search results were also checked. No verified Persian
G2P model suitable for this app was established from Hama. Several Finglish TTS
models *consume* Finglish and generate audio; they do not solve Persian-to-Finglish.

Sources:
- https://huggingface.co/MahtaFetrat/Homo-GE2PE-Persian
- https://huggingface.co/MahtaFetrat/Homo-GE2PE-Persian/blob/main/NOTICE.md
- https://huggingface.co/Reza2kn/negara-g2p-clean-v7.1
- https://huggingface.co/Reza2kn/gooya-v1-ONNX-fp16
- https://github.com/MahtaFetrat/HomoFast-eSpeak-Persian
- https://huggingface.co/abreza/persian-ezafe-albert
- https://github.com/MahtaFetrat/Piper-with-LCA-Phonemizer
- https://github.com/lingjzhu/CharsiuG2P
- https://huggingface.co/klebster/g2p_multilingual_byT5_tiny_onnx
- https://huggingface.co/KiaBush/persian-text-to-ipa-byt5
- https://interscript.org/ml/
- https://github.com/brothersincode/f2f

## Comparable published evidence

The authors' SentenceBench comparison in Table 3 reports:

| System | Phoneme error rate | Homograph accuracy | Mean inference, Colab CPU |
| --- | --- | --- | --- |
| Homo-GE2PE | 3.98% | 76.89% | 0.4473 s |
| HomoFast eSpeak | 6.33% | 74.53% | 0.0084 s |
| eSpeak baseline | 6.92% | 43.87% | 0.0169 s |

These are the paper's measurements, not our tests, phone latency, lyric accuracy,
or a claim that 96% of words/lines will be correct. The paper explicitly identifies
ezafe as a remaining weakness of non-neural approaches. The inspected Homo-GE2PE
checkpoint is 8.26M parameters; use actual artifact inspection rather than assuming
it has the 300M parameters of standard ByT5-small.

Paper: https://aclanthology.org/2025.findings-emnlp.1218.pdf

## Actual local smoke test

Downloaded only the public v7 G2P graphs from the Gooya export, without credentials.
Used onnxruntime-web 1.27.0, single-thread WASM, under Node 24 on this laptop.
Custom byte tokenizer follows ByT5 byte+3; input has no EOS, matching the v7.1
reference helper. Greedy decoding with KV cache and max 256 output tokens.
No v7.1 correction overlay and no manual pronunciation patches were applied.
This is not a full parity check against the publisher's five-beam reference.

- Graph/session loading: 575 ms, excluding network download.
- 11 previously discussed test sentences: all reached EOS.
- Per-line inference: 58–130 ms; median 77 ms; sum 918 ms.
- Not tested on a phone, in a browser, or with WebGPU.
- Full-song quality, RAM peaks, cold browser startup, and battery use unmeasured.
- Prototype display mapping is provisional. Its u->oo rule turns raw oun into
  ooon, a formatter defect; retain raw phonemes when evaluating model quality.

Selected raw output (unaltered):

| Persian input | Raw model output |
| --- | --- |
| غریب آشنا دوستت دارم بیا | qarib AshenA dustat dAram biyA |
| دلم می‌خواد دوباره ببینمت | delam mikhad dobAre bebinamet |
| امید توی دلش مرد | omid tuye delaS mord |
| وقتی رسیدی، من هنوز خواب بودم | vaqti rasidi man hanuz xAb budam |
| امشب می‌خوام باهات حرف بزنم | emSab mikhAm bAhat harf bezanam |
| چرا نمی‌خوای کنارم بمونی؟ | CerA nemikhAy kenAram bemuni |

This preserves evidence of errors: missing ezafe after qarib, dustat instead of
preferred dustet, rasidi instead of residi, and other colloquial differences.
Working examples do not establish a reliable acceptance rate on unseen songs.

ONNX SHA256:
- encoder_model.onnx: afc0e170889d9d45cea25f1a3403bd84dcbfc95a069175ebb2233ca277501a98
- decoder_model_merged.onnx: ab093ac2f317a9bdcadc0a38b812f3c3506d0b6b8a58809acfa9f2b64366399c

Model graphs plus the chosen CPU WASM binary total 46,761,819 bytes (~46.8 MB),
before small JS/config files. With the WebGPU WASM binary instead, 60,109,384 bytes
(~60.1 MB), again before glue/config. Do not ship every ORT binary or all decoder
variants. These byte counts are storage, not peak memory.

Temporary scripts/downloads: /tmp/hamava-g2p-research (may disappear on reboot).
Raw sentence results are preserved beside this document. No weights enter Git.

## Browser design and short decision schedule

Use one selected model, downloaded lazily and cached with a pinned version/hash.
Run in a dedicated browser Web Worker; this is a background thread on the phone,
not Cloudflare Workers. Start with working WASM CPU, then benchmark WebGPU and
select it only when the device/model combination works and benefits. Small models
can be faster on CPU once GPU overhead is considered. Handle adapter failure and
device loss with a clean WASM fallback, without holding both model sessions in RAM.

Safari 26 introduced WebGPU; older iOS and Android device/browser combinations
still require runtime detection. A successful navigator.gpu check alone is not
proof that all model operators or FP16 features work.
- https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- https://developer.chrome.com/blog/new-in-webgpu-121?hl=en
- https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html

Convert whole lyric lines (short multi-line context can be evaluated separately),
keep original line IDs/timestamps outside inference, show completed lines promptly,
cache repeats, and allow exact line correction. Map phoneme symbols to our agreed
Finglish style separately from pronunciation evaluation; never globally replace
ambiguous words such as mard/mord. Preserve punctuation and stanza breaks outside
the model. Do not feed a full song beyond its input limit or silently truncate it.

Proposed first two working days, not a guaranteed completion estimate:
1. Run Homo-GE2PE reference inference and v7 on the same 60–100 held-out lines
   across 5–10 songs, including informal verbs, ezafe, homographs, names and repeats.
   Owner grades blinded results before corrections; retain 20% as a final holdout.
   Proposed gate: at least 95% of words pronounced acceptably, ignoring agreed
   spelling variants; no unexplained omitted or invented words/lines.
2. Export the preferred model to ONNX and verify output parity. Test a small
   standalone browser harness on the actual customer phone: CPU and GPU, first
   and repeat load, background/foreground, offline cache, and full-song conversion.
   Proposed warm-load target: first few lines within 2 seconds and no UI freezing.
   Measure memory and total download rather than deriving them from weight size.

If quality misses the gate, compare HomoFast with ezafe support using the same
holdout. Limit integration to the winner. Fine-tuning a new system is not the
first-month fallback; reduce scope or use reviewed corrections if none qualifies.
