# Shared CPU lyrics engine — v0.6.0

The owner accepted the Del Bordi browser test and selected CPU inference. WebGPU
and the previous Cloudflare AI path are removed from the active app. The homepage
Googoosh audio, timings, Finglish and guided player remain unchanged.

## Try the integrated reader

Run `npm run dev`, then open **http://localhost:5173/lyrics**. The previous `/?live`
and `/g2p` addresses open the same CPU reader. There is no passphrase or engine
selector. Del Bordi remains the default source. Read it, then expand Persian source
and supply another LRCLIB record ID or paste lyrics. Search suggestions come next;
this is the integration workspace, not the completed search route.

Each converted row has Persian, Finglish, raw pronunciation and Copy. Save results
exports source metadata, line IDs, optional timing, model revision and timings.
Changing the source clears previous rows so results cannot appear under the wrong
song title. Stop retains completed rows; the next run can reuse the warm engine.

Deploy with the existing `npm run deploy:token`, then open
**https://hamava-lyrics.arshamhaqiqat.workers.dev/lyrics** and accept Reload app.
Check **v0.6.0**. This change is prepared locally; deployment remains owner-run.
No D1 permission, AI binding or test passphrase is needed for the new deployment.
`npm run setup:live` now only explains the replacement setup.

## What “load once” means

1. The first conversion downloads the pinned model if it is not cached, then
   initializes encoder and decoder sessions in a browser Web Worker.
2. Later conversions in that same document reuse both sessions: reported model
   setup is zero. A bounded in-memory cache also reuses up to 2,048 normalized
   completed lines across songs. It stores no incomplete output.
3. Refresh, closing the page, or a full-document navigation discards in-memory
   sessions. The next document initializes them again using cached model bytes.
   This still takes device-dependent time; it is not another model download.
4. App version changes do not change the model-cache namespace or pinned model URL.
   Normal PWA updates and Repair app cache preserve `hamava-negara-*` caches.
   A different model revision, clearing site storage, or browser storage eviction
   can require another download. Since v0.6.1, model and runtime downloads use version-pinned paths on
   Hamava itself. Legacy model cache keys stay unchanged to reuse existing bytes.
   Runtime JS/WASM use immutable HTTP caching. Dev/build verifies the assets before
   copying them into the deployment; no inference happens in Cloudflare.

The homepage does not download or initialize the model. The first conversion does.
This preserves the demo's network behavior and avoids a large unsolicited download
for someone merely opening the landing page.

## API for the search and sync routes

Use the singleton exported from `src/g2p/engine.ts`; do not create a worker in each
component. It queues requests, reuses the CPU session, and supports cancellation:

```ts
import { lyricsEngine } from '../g2p/engine'
import { fetchLyrics } from '../g2p/text'

const controller = new AbortController()
const song = await fetchLyrics(selectedRecordId, controller.signal)
const result = await lyricsEngine.convert(song.lines, {
  signal: controller.signal,
  onLine: (convertedLine, index) => { /* update this selected song */ },
  onEvent: (event) => { /* show loading or download progress */ },
})
// result.lines retain the source IDs, Persian text and any supplied timestamps.
// result.stats reports warm/load/inference timing and newly generated line count.
// Cancel when the user changes songs or leaves the route:
controller.abort()
```

The engine also accepts lines from any other source, without LRCLIB dependence:
`{ id: string, persian: string, startMs?: number, endMs?: number }[]`. Additional
source metadata is retained. Input is snapshotted and IDs must be unique. Only text
strings go to the model; the client restores IDs/timestamps from the source snapshot.
Old/cancelled job messages cannot write into a newer request. Empty instrumental
markers retain empty output. Missing, duplicate or truncated results fail visibly.

The adapter accepts arbitrary positive LRCLIB IDs, validates the returned identity,
and handles plain lyrics or a timed-only record. It prefers plain lyrics for this
unsynced workspace; timed-only parsing uses `shared/lrc.ts`. Future sync code should
supply its timed line array directly rather than invent timestamps for plain lyrics.
This engine does not guarantee catalog coverage or correct pronunciation for every
song. It handles up to 1,000 lines per request, each at most 512 UTF-8 bytes. The
caller must split longer lines; input is never silently truncated.

Cancellation is cooperative between decoding steps. It preserves the warm sessions.
If initialization is already underway, it may finish loading the shared model before
the cancelled job acknowledges and the next queued song begins. The UI stops showing
that cancelled job immediately. Runtime failure/watchdog termination resets the
worker; a later job can initialize again from the verified cache.

## Server retirement

`/api/song` and `/api/batch` return **410 Gone**, including for old app versions.
They never access credentials, LRCLIB, D1 or Workers AI. The deployed Worker now
only serves assets, connectivity, cache repair and explicit API errors. AI and D1
bindings were removed from `wrangler.jsonc`. Existing remote databases and secrets
were not deleted. Old conversion parsing/batching helpers and research documents
remain historical material; they are not an inference path in the active app.

## Validation

19 unit tests cover engine reuse, cancellation/stale results, source metadata,
input/output checks and retired API behavior. Production typecheck/build and
Wrangler dry-run pass; the dry-run lists only the ASSETS binding.

Browser coverage includes the unchanged demo, legacy URL replacement, another
source record, copying, cancellation/reuse, theme persistence and model-cache
survival through both update and repair. Real ONNX/WASM checks convert all 33
Del Bordi lines, match previous native raw examples, verify zero model setup for
another song in the same document, and verify no model redownload after reload.
Fixtures are downloaded model files supplied through intercepted network requests;
these timings do not measure internet downloads or real-phone performance.

Run normal checks with `npm run check`. The opt-in real-model cases additionally use
`HAMAVA_G2P_ASSETS="$PWD/research-private/browser-g2p"` as documented in the previous
browser test notes. The owner-reported fast CPU result motivated this integration;
no new customer result file was available in the conversation to inspect.
