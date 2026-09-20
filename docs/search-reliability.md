# Search reliability — v0.7.5

## Evidence and limits

The owner saw intermittent search hangs in the iPhone home-screen app and desktop,
while local Vite searches felt immediate. Deployed probes returned Del Bordi in
about 0.4–0.5 seconds and Kooh in about 0.8 seconds, but an overlapping partial
query returned an LRCLIB failure notice. The indefinite device hang was not
reproduced on the owner's phone; no production request logs were available.

The implementation had a global promise chain serializing every LRCLIB request.
It allowed older work to block new requests and held request-bound asynchronous
work across Cloudflare invocations. Cloudflare documents these restrictions in
[Workers errors](https://developers.cloudflare.com/workers/observability/errors/).
This is a concrete architecture risk, not proof of the sole cause of the reported
phone failures. Vite's Node runtime and deployed Workers have different request
lifetimes. The service worker does not cache `/api/search` responses.

## Changes

- Remove the shared live promise queue. Each request owns its fetches, timers,
  cancellation and body parsing. Sequential query variants and 429 cooldowns
  remain; only plain data is shared between requests.
- `shared/deadline.ts` races the entire operation against timeout/cancellation,
  aborting I/O too. A stalled or abort-insensitive fetch/body cannot hold the UI
  indefinitely. Limits: upstream 5 s, server search 12 s, browser 15 s, browser
  health check 8 s. On visibility change, expired wall-clock deadlines reject
  even after browser suspension. Time cannot advance app code while it is frozen.
- Non-JSON HTML/challenge pages produce an intelligible retryable error.
- `/api/lyrics-health` makes a fresh known LRCLIB **search API** request and checks
  JSON shape. No app-result caching is used. It respects upstream 429 cooldowns
  rather than probing through a known rate limit.
- The card is above the search input and popup. It distinguishes a successful
  LRCLIB response, LRCLIB failure/busy state, and failure to complete the check
  through Hamava. It includes a success timestamp and manual Check again.
  It measures phone → Hamava → LRCLIB, not direct phone → LRCLIB connectivity.
  A successful point-in-time probe does not guarantee every query will succeed.
- Probe on Search opening, after failures and on demand, not on every keystroke.
  Retry search is outside the dropdown so losing focus cannot hide recovery.
- Source ranking, CPU decoding, fallback spelling, saved songs and weight caches
  remain intact. No new paid service, secret, binding or server is required.

## Validation and handoff

44 unit tests pass, including stalled headers/body, explicit cancellation,
wall-clock expiry after suspension, independent simultaneous requests and fresh
health probes. Production typecheck/build passes. All 24 search browser tests
pass in desktop Chromium and mobile Chromium emulation, including diagnostic
states, timeout recovery and placement above the dropdown. This is not Safari
or physical-iPhone acceptance.

A local **Cloudflare workerd** check used concurrent real LRCLIB requests with
one older query cancelled. The health check returned successfully in ~0.53 s,
Del Bordi in ~0.55 s and Kooh in ~1.11 s; no cross-request stall occurred. These
measurements are observations, not latency guarantees. The deployed service is
unchanged until the owner runs deployment.

After `npm run deploy:token`, reload and confirm v0.7.5. Search Del Bordi/Kooh,
change queries quickly, and switch away/return to the home-screen app. If a
failure remains, capture the timestamp, connection-card message and search error.
That distinguishes a phone-to-Hamava problem from the upstream service failing.
