# Search and unsynced reading — v0.7.5

Implemented at `/search`. The homepage's Search a song button opens this route.
Spotify remains a placeholder. The Googoosh audio demo is unchanged.

## Reader and discovery

- Debounce 400 ms after at least two characters. Up to 12 suggestions show song,
  artist, album/version, duration if known, provider and lyric availability.
- The example button searches Kooh by Googoosh. A card above the input performs
  a real uncached LRCLIB request through Hamava, on opening, search failure and
  manual Check again. It distinguishes app/check failure from provider failure
  and shows when the check succeeded. No timer-based reachability inference.
  Retry search stays above the dropdown for errors and provider notices.
- Accessible combobox: arrows, Enter, Escape, click/touch, stale-request
  cancellation, loading/error/empty feedback and retry. Query is remembered for
  the browser session. Different recordings remain distinct by provider ID.
- Select one result to fetch lyrics and run the existing shared CPU engine.
  Show original Persian immediately and fill converted lines as they complete.
  Changing songs cancels previous work; completed engine sessions remain warm.
- Reader and full-window modal have per-line Copy, Aa and Persian toggle.
  No player, timeline, highlighting, current-line copy or Follow button.
- Up to ten completed songs are saved locally for offline reading, keyed by
  model/formatter version rather than app release. Closing the reader returns
  to saved songs. Show the first four initially; a three-dot Show all/Show less
  button expands/collapses the list. Each saved song has a separate removal button
  that deletes its persisted record without deleting the shared model cache.
  A storage failure is reported instead of claiming a save.
- Paste Persian text if search misses a song. The separate title-and-artist form
  was removed in v0.7.2; selecting a suggestion still uses provider fallback.
  MusicFa and Genius links open external searches to find text to paste; these
  are not claimed to be API integrations.

## Search behavior

`shared/search.ts` normalizes Unicode/Arabic letter variants, punctuation and
spacing. LRCLIB uses `q` keyword search, not exact `/get` title matching. If needed,
at most three LRCLIB queries try an alias and bounded broader title tokens.
A small explicit dictionary covers common artist names and Del Bordi/Gharibe
Ashena. Tasnim/tasnif/tasnife labels are optional in the broadened query.

Candidates are ranked against the full original/aliased query, not the broad
fallback token. Matching tolerates small spelling variations and avoids unrelated
prefix matches. A trailing artist prefix of at least three characters is accepted
when a different query token matches the title; `kooh goo` can match Googoosh,
while unrelated title prefixes are still rejected. This is not universal Persian-to-Latin query translation or a
complete fuzzy index. Broad queries are limited by the upstream result cap.

`worker/search.ts` handles `/api/search` and `/api/lyrics`. The same handler runs
in Vite dev/preview, so `npm run dev` needs no separate Worker process for search.
The Worker only fetches and normalizes provider data; inference stays in the
browser. No API keys, AI binding, D1 or paid search API were added.

Requests have a 12-second overall server deadline, 5-second upstream deadline,
15-second browser deadline, 2 MB upstream response limit, bounded input/result
counts and fixed upstream hosts. Deadlines race the complete operation, including
body reading, and abort its I/O. Visibility resume checks wall-clock expiry.
LRCLIB variants stay sequential within a search with 250 ms spacing. Concurrent
searches do not share live promises; only completed data and numeric cooldowns
are global. Upstream
429/Retry-After is honored with a host cooldown; no fallback storm follows it.
A failed LRCLIB connection stops keyword retries and attempts the alternate
provider once; an empty successful response still permits broadened searches.
A bounded five-minute in-memory cache holds successful results. It is per isolate,
not a global quota or persistent cache. The browser also reuses recent successful
queries during the current page session. No inference happens while typing.

## Sources and live evidence (2026-09-15)

- [LRCLIB API](https://lrclib.net/docs): primary lyric search and retrieval.
  Records containing only non-Persian text or marked instrumental are excluded.
  Plain text is preferred; timed-only lyrics have timestamps removed, without
  needing a playback duration. Metadata-only records are labeled unconfirmed.
- [lyrics.ovh API](https://github.com/NTag/lyrics.ovh#api): optional no-key lyrics
  fallback for a selected title/artist. When LRCLIB has no confirmed match, its
  suggestion endpoint supplies Deezer catalog metadata, clearly labeled as
  unconfirmed. The API documents aggregating several lyric websites, but this
  does not establish useful Persian coverage.
- MusicFa's WordPress API probe was unreachable from this machine. Radio Javan
  documents searching lyrics in its app, but no supported public lyrics API was
  verified. Genius's song API is not treated as a full-lyrics endpoint. No scraping
  or undocumented endpoint is a production dependency.

Direct LRCLIB `q=del bordi` and `track_name=del bordi` each returned four records,
including 13708175, **Tasnife Del Bordi — Mohammad-Reza Shajarian**. The finished
adapter also found that ID for `del bordi`, `tasnim del bordi`, and `دل بردی`.
One verification run took 451/984/1058 ms respectively; these are observations,
not phone/network latency guarantees. An earlier transient LRCLIB request failed,
which is why failure feedback and bounded retry matter.

Live lyrics.ovh requests for Shajarian / Tasnife Del Bordi, Googoosh / Hamsafar,
Shadmehr Aghili / Taghdir, and Ebi / Shab returned 404. Its suggestions endpoint responds,
but suggestions alone do not prove lyrics availability. This release does not
promise coverage beyond LRCLIB; fallback failures keep the paste route available.

## Validation and handoff

Run `npm run dev`, open `http://localhost:5173/search`, and search `del bordi`.
Choose a recording, wait for Finglish, copy different lines, toggle Persian/Aa,
and open full lyrics. Close/reopen a saved song offline. Neither reader should
show playback controls or a highlighted current line.

Unit coverage includes partial-title ranking, aliasing, unrelated candidate
rejection, broadened retrieval, compact metadata, timed-only text, provider
identity validation, fallback discovery/lookup, non-Persian rejection, and 429.
Browser coverage exercises keyboard/touch-size layout, copy/fullscreen behavior,
source switching, late search responses, no-result/error/paste paths and offline
saved reading. The opt-in real-model test also converts the selected full song
through the search route with former external model hosts blocked.

Deploy the combined release with `npm run deploy:token` from the main project.
The earlier isolated model-only checkout is v0.6.1; deploying that after v0.7.0
would intentionally replace the search release with the older UI.

Verification completed: 25 unit checks, production build/typecheck, ASSETS-only
Wrangler dry-run. The 70-case browser suite passed 68 initially; two caught the
missing Close lyrics control. After adding it, all ten search checks passed on
desktop/mobile. All cases are verified across those runs, including real-model
conversion through both readers and model-cache persistence.
