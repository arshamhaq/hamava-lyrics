import { aliasQuery, normalizeQuery } from './search'
import type { SongText } from './search'
import type { SourceLine } from './lyrics'
import { parseLrc } from './lrc'

export interface TrackQuery {
  title: string
  artist: string
  album: string
  durationMs: number
}
export interface LyricChoice extends SongText {
  id: string
  timedLines: SourceLine[] | null
  score: number
  closeMatch: boolean
}
export interface LyricMatches {
  choices: LyricChoice[]
  notice?: string
}
const fold = (s: string) =>
  aliasQuery(s).replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/aa/g, 'a')
const versions = (s: string) =>
  [...fold(s).matchAll(/\b(live|remix|acoustic|guitar|instrumental|karaoke|sped|slowed)\b/g)]
    .map((m) => m[1])
    .sort()
    .join(' ')
export const baseTitle = (s: string) =>
  s
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\s+-\s+.*$/, '')
    .trim()
function similarity(a: string, b: string) {
  const x = fold(a),
    y = fold(b)
  if (x === y) return 1
  if (!x || !y) return 0
  const xs = new Set(x.split(' ')),
    ys = new Set(y.split(' '))
  return (2 * [...xs].filter((v) => ys.has(v)).length) / (xs.size + ys.size)
}
// Keep broad search ranking separate from recording matching: version and length matter here.
export function recordingScore(hit: TrackQuery, track: TrackQuery) {
  const title = similarity(baseTitle(hit.title), baseTitle(track.title))
  const artist = similarity(hit.artist, track.artist)
  if (title < 0.65 || artist < 0.45) return null
  const delta = Math.abs(hit.durationMs - track.durationMs)
  const versionMatch = versions(hit.title) === versions(track.title)
  const closeMatch = title >= 0.9 && artist >= 0.65 && versionMatch && delta <= 4000
  const score =
    title * 40 +
    artist * 30 +
    similarity(hit.album, track.album) * 8 +
    (fold(hit.title) === fold(track.title) ? 10 : 0) +
    Math.max(0, 12 - delta / 1000) -
    (versionMatch ? 0 : 22)
  return { score, closeMatch }
}
export function lyricsChoice(record: any, track: TrackQuery): LyricChoice | null {
  if (!record || !Number.isSafeInteger(record.id) || record.id <= 0 || record.instrumental)
    return null
  if (typeof record.trackName !== 'string' || typeof record.artistName !== 'string') return null
  const durationMs = Number.isFinite(record.duration) ? Math.round(record.duration * 1000) : 0
  const match = recordingScore(
    {
      title: record.trackName,
      artist: record.artistName,
      album: typeof record.albumName === 'string' ? record.albumName : '',
      durationMs,
    },
    track,
  )
  if (!match) return null
  const synced: string = typeof record.syncedLyrics === 'string' ? record.syncedLyrics : ''
  const plain: string = typeof record.plainLyrics === 'string' ? record.plainLyrics.trim() : ''
  const text =
    plain ||
    synced
      .split(/\r?\n/)
      .filter((l) => /^\s*\[\d+:/.test(l))
      .map((l) => l.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim())
      .filter(Boolean)
      .join('\n')
  if (
    !text ||
    text.length > 100_000 ||
    !/[\u0621-\u063a\u0641-\u064a\u067e\u0686\u0698\u06a9\u06af\u06cc]/.test(text)
  )
    return null
  let timedLines: SourceLine[] | null = null
  if (synced && durationMs > 0 && Math.abs(durationMs - track.durationMs) <= 4000) {
    try {
      // Rounded source lengths and trailing blank end markers must not spoil usable lyrics.
      const parsed = parseLrc(synced, Math.max(durationMs, track.durationMs) + 3000)
      if (parsed.some((l) => l.text && l.startMs >= track.durationMs))
        throw new Error('Wrong length')
      timedLines = parsed
        .filter((l) => l.startMs < track.durationMs)
        .map((l) => ({ ...l, endMs: Math.min(l.endMs, track.durationMs) }))
    } catch {
      /* Malformed timing remains readable as plain lyrics. */
    }
  }
  return {
    id: `lrclib:${record.id}`,
    title: record.trackName,
    artist: record.artistName,
    album: typeof record.albumName === 'string' ? record.albumName : '',
    duration: durationMs / 1000 || null,
    text,
    source: 'LRCLIB',
    sourceUrl: `https://lrclib.net/api/get/${record.id}`,
    timedLines,
    ...match,
  }
}
export function rankChoices(records: any[], track: TrackQuery): LyricChoice[] {
  const seen = new Set<string>()
  return records
    .map((r) => lyricsChoice(r, track))
    .filter((x): x is LyricChoice => !!x)
    .sort(
      (a, b) =>
        Number(b.closeMatch) - Number(a.closeMatch) ||
        (a.closeMatch && b.closeMatch ? Number(!!b.timedLines) - Number(!!a.timedLines) : 0) ||
        b.score + (b.timedLines ? 8 : 0) - (a.score + (a.timedLines ? 8 : 0)),
    )
    .filter((c) => {
      // Do not offer identical lyrics/timings again under another catalog ID.
      const key = JSON.stringify([
        normalizeQuery(c.text),
        c.timedLines?.map((l) => [l.startMs, l.text]),
      ])
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 4)
}
