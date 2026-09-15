# Search route proposal — not implemented

Owner request, 2026-09-09: live song suggestions followed by an unsynced lyrics
reader. This supersedes the earlier manual playback-slider idea for this route.
Spotify and search are still placeholders. Since v0.6.0, `lyricsEngine` provides
shared local CPU conversion; see [its API](cpu-lyrics-engine.md). Fetch a selected
source, cancel the previous selection and call that singleton. Do not create a
new model worker for each song. No AI requests were made for the original research.

## Experience

- Search by song or artist in Persian or Latin letters, without Spotify login.
- After at least two characters and a roughly 350 ms pause, show up to eight
  suggestions with title, artist, and duration when supplied. Display album or
  version when needed to distinguish recordings. Cover art is optional.
- Use an accessible combobox: keyboard navigation, Enter, Escape, touch targets,
  a loading indicator, explicit errors, and a distinct empty-results state.
- Cancel outdated requests and ignore late responses. Keep the query/results
  when navigating back; remember recent selections locally.
- Select a result to show the complete lyrics in normal document scrolling.
  Reuse the lyric rows, copy feedback, Aa, Persian toggle and full-window reader.
  No play/pause, timeline, automatic highlighting, or Follow in this route.
  A copied row gets a temporary checkmark, not a simulated playback state.
- If conversion is pending, show the Persian original with an honest Finglish
  preparation state. If it fails, keep the original readable and offer retry.
- If no source has lyrics, offer paste-your-own Persian lyrics. Offline users
  can reopen already saved results; new network searches explain they are offline.

## Retrieval and cost

Start with LRCLIB plain lyrics. Synced-only records can also supply text with
LRC timestamps removed. Missing timing does not exclude a song; lyric presence,
language, artist, and recording match do matter. Do not conflate catalog entries
with confirmed lyrics availability, or merge live/remix/cover versions blindly.

A small Worker endpoint can normalize queries, cache short-lived results, cap
requests, and return compact suggestion metadata. LRCLIB search currently returns
lyric bodies as well; those need not all be sent to the browser. Fetch/cache the
chosen record by provider ID. Search itself needs no AI. Convert only a selected
song, reuse prior conversions, and retain paragraph/line boundaries. New text
must not inherit timestamps from a different recording.

Normalize Persian/Arabic letter variants and spacing; allow a bounded alias
retry for sparse results. Finglish spelling is variable, and LRCLIB search is
not guaranteed fuzzy or bilingual. Start with a small artist alias map plus an
explicit Latin-spelling suggestion; evaluate broader matching before promising it.

Use one primary provider and at most one tested fallback per selected song.
Avoid calling many sites on every keystroke. A metadata catalog can widen song
suggestions but cannot guarantee the selected song has retrievable lyrics.
No new paid API is proposed; free services still have availability and usage
limits. This document does not establish a full provider coverage benchmark or
promise latency from a handful of laptop requests.

## Source assessment

| Source                                                                                                                               | Proposed role                                 | Evidence / limit                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [LRCLIB](https://lrclib.net/docs)                                                                                                    | Primary search and plain lyrics               | Existing integration; live sample below.                                                                                |
| [lyrics.ovh](https://github.com/NTag/lyrics.ovh)                                                                                     | Evaluate as an optional fallback              | Public title/artist lyrics endpoint; suggestions use Deezer. Suggestions worked but the demo lyric lookup returned 404. |
| [Apple iTunes Search](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html) | Optional metadata expansion later             | Song discovery, not a full-lyrics source. Not required for first version.                                               |
| [Genius / LyricsGenius](https://www.johnwmillr.com/scraping-genius-lyrics/)                                                          | Later candidate requiring separate evaluation | API gives song metadata; lyric extraction uses website scraping, with maintenance/reliability implications.             |

No supported free API for MusicFa or Radio Javan has been verified in this
research. Do not treat a public lyrics webpage as a supported API. Musixmatch
would need a confirmed plan suitable for the budget before becoming a dependency.

## Small live probe, 2026-09-09

Six public read-only calls, maximum concurrency two. Counts below describe the
returned sample, not the entire catalog; lyrics were not saved to the repository.

| Request                                      | Result                                         | Elapsed |
| -------------------------------------------- | ---------------------------------------------- | ------- |
| LRCLIB: Googoosh Gharibe Ashena              | 11 records; 11 plain, 8 synced                 | 1.36 s  |
| LRCLIB: Shadmehr Aghili                      | 20 records; 18 plain, 17 synced                | 2.81 s  |
| LRCLIB: محسن چاوشی                           | 2 records; 2 plain, 2 synced                   | 1.19 s  |
| LRCLIB: غریب آشنا                            | 0 records                                      | 1.00 s  |
| lyrics.ovh suggestions: Googoosh             | 15 metadata results with artist/title/duration | 1.45 s  |
| lyrics.ovh lyrics: Googoosh / Gharibe Ashena | HTTP 404                                       | 1.39 s  |

LRCLIB duration values in the sample are seconds, sometimes fractional. The
Latin/Persian title mismatch demonstrates a discovery limitation, not proof that
the lyrics are missing. Provider response times and spelling behavior must be
checked from the deployed Worker and the customer's phone before acceptance.

## Implementation order after agreement

1. Build search/dropdown and LRCLIB retrieval, initially with Persian text.
   Verify keyboard/mobile use, stale-request races, duplicate versions, no-result,
   failure/retry, and back navigation. Test real Persian and Latin queries.
2. Build the unsynced reader using the shared lyric presentation; verify copying
   any line, Aa, Persian toggle, and opening/closing full lyrics without media.
3. Connect an evaluated Finglish converter, then cache converted selections.
   Negara model access and browser inference quality/performance remain unverified
   here. The previous Qwen experiment is paused. Do not claim automatic Finglish
   is solved merely because search works.
4. Compare a customer-supplied representative song sample across candidate
   fallbacks. Add one only if it supplies useful missing lyrics reliably. Then
   assess cold/warm loading and offline saved songs on the actual phone.
