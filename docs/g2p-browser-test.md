# Del Bordi browser test — v0.5.0

This is an isolated evaluation page at `/g2p`. It fetches the plain Persian lyrics
for Mohammad-Reza Shajarian's **Tasnife Del Bordi**, *Payame Nasim*, from
[LRCLIB record 13708175](https://lrclib.net/api/get/13708175). The inspected record
contains 33 nonempty lines (20 unique after normalization). It does not play audio
or synchronize playback. No full lyric text or generated song transcript is baked
into the app or committed to Git.

## Try it

From `/home/arsham/finglish-lyrics`:

```bash
npm run dev
```

Open **http://localhost:5173/g2p**, wait for the Persian source, then press
**Read with Negara**. Browser CPU is selected initially. The selector also offers
explicit WebGPU and Automatic (GPU when available, with CPU fallback on failure).
Read Persian and generated Finglish together; expand raw pronunciation to distinguish
model mistakes from display spelling. Copy any finished line. Save results downloads
a JSON file containing source text, raw/model output, engine, revision and timings.
A stopped run retains finished lines; rerunning starts a new result set. Repeated
lines keep their original positions and reuse identical completed output within a run.

If LRCLIB fails, expand Persian source and retry or paste text. One run accepts
120 lines, each at most 512 UTF-8 bytes. No text is silently truncated. Model output
that reaches its token limit is explicitly marked incomplete. Results are automatic
model predictions: no hand-corrected pronunciations are substituted.

For the phone, deploy using the existing flow:

```bash
npm run deploy:token
```

Then open **https://hamava-lyrics.arshamhaqiqat.workers.dev/g2p**. Accept the app's
reload notice and check **v0.5.0**. Deployment is left for the owner; it has not been
performed by this change. An ordinary `http://192.168...` laptop URL is not a secure
context: use localhost on the laptop or HTTPS on the phone.

## Browser implementation

- Public Negara v7 ONNX graphs, revision
  `5720b2c489764572a5c8b55ea7b8d910258c88ef`, from
  [the export repository](https://huggingface.co/Reza2kn/gooya-v1-ONNX-fp16/tree/5720b2c489764572a5c8b55ea7b8d910258c88ef/negara-g2p-v7/onnx).
  Only the encoder and merged G2P decoder are fetched, not the TTS models.
- Greedy byte-token decoding (+3, no input EOS), two-layer attention cache. Raw phones
  stay intact. NFKC, Arabic ya/kaf normalization and diacritic stripping prepare input.
  Display maps phoneme symbols to familiar Finglish, including longest-first `ou`
  handling; it does not repair words or contextual vowels.
- Pinned ONNX Runtime Web **1.27.0** is loaded inside a dedicated classic Web Worker.
  [Runtime configuration](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html).
  CPU uses single-thread WASM, so no COOP/COEP headers are required. WebGPU is enabled
  alongside WASM for unsupported operations: the UI does not claim all operators run
  on GPU. On Automatic GPU failure, a fresh CPU worker restarts the run and clears
  GPU results so one report does not mix engines. Explicit GPU failure stays visible.
- Both model graphs total **33,281,841 bytes**, verified against pinned SHA-256 hashes
  before use. Model bytes are cached per revision in browser Cache Storage when
  available. CPU WASM is about 13.5 MB; the inspected WebGPU asyncify runtime is about
  24.3 MB (other engine paths may use the 26.8 MB JSEP build), plus small JS modules.
  These are downloads, not peak RAM. CPU-first initial downloads are roughly 47 MB.
- Model/runtime downloads occur only after Run. They come from Hugging Face/jsDelivr;
  lyrics come from LRCLIB. They require a working connection on first use. The
  inference runs locally and makes no Cloudflare AI requests or paid inference calls.
  The existing `/api/connectivity` check is still used by the surrounding app.
- Neither model binaries nor large WASM files are bundled into Cloudflare Static
  Assets or the PWA precache. Homepage navigation does not trigger model downloads.
  Stop terminates the worker; a no-progress watchdog prevents indefinite waiting.

## Verification

- 15 unit/Worker checks and production typecheck/build passed.
- All 52 existing browser regression cases passed in the broad run. Six new UI
  checks passed on desktop/mobile after isolating their controlled worker fixtures
  from service-worker precaching. They cover copying/download, fallback, cancellation,
  rerun and a manual source after lyric-fetch failure.
- Two opt-in real-model browser cases passed: full 33-line song, repeat reuse,
  model cache reuse on rerun and raw-output parity with two prior native-CPU examples.
  These use real downloaded ONNX/WASM files supplied through intercepted network
  requests. They do not measure real internet download speed.
- Standalone Chromium CPU run: 20 unique lines generated in **1.27 s**, with **2.27 s**
  model setup, **3.54 s** total using locally supplied asset responses. A prior run
  was about 1.6 s conversion. Concurrent regression runs were slower (about 2.8–2.9 s).
- A WebGPU graph run using Chromium's **software SwiftShader adapter** completed all
  33 lines, with raw output identical to CPU on all 33. Conversion was **90.93 s**;
  this is a compatibility check, NOT hardware-GPU or phone performance.
- The mobile layout was visually reviewed. Real iPhone/Android performance and the
  customer's pronunciation judgment remain pending. Existing pronunciation errors
  are intentionally visible. This milestone does not establish production quality.

Private downloaded assets and standalone reports are kept under
`research-private/browser-g2p/`, outside Git. To rerun the optional real-model tests
with those fixtures present:

```bash
HAMAVA_G2P_ASSETS="$PWD/research-private/browser-g2p" npx playwright test tests/browser/g2p-model.spec.ts
```

The fixture folder contains `model/`, `runtime/`, and `song.json`. Missing browser
system libraries can be supplied using the locally extracted `libs/extracted/usr/lib/x86_64-linux-gnu`
in `LD_LIBRARY_PATH`. Normal `npm run test:e2e` skips these two optional binary tests
when the fixture environment variable is absent. It still runs the UI tests.
