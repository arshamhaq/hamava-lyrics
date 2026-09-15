import { parseLrc } from '../../shared/lrc'
import type { SourceLyric } from './engine'
export const SONG = {
  id: 13708175,
  title: 'Tasnife Del Bordi',
  artist: 'Mohammad-Reza Shajarian',
  album: 'Payame Nasim',
  url: 'https://lrclib.net/api/get/13708175',
}
export interface LyricsSource {
  id: number | null
  title: string
  artist: string
  album: string
  durationMs: number | null
  url?: string
  timed: boolean
  lines: SourceLyric[]
}
export function lyricLines(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) throw new Error('Load or paste Persian lyrics first.')
  if (lines.length > 1000) throw new Error('Use at most 1,000 lines.')
  if (lines.some((line) => new TextEncoder().encode(line.normalize('NFKC')).length > 512))
    throw new Error('One line is too long. Split it into shorter lines before running.')
  return lines
}
export function pastedLyrics(text: string): LyricsSource {
  return {
    id: null,
    title: 'Pasted lyrics',
    artist: '',
    album: '',
    durationMs: null,
    timed: false,
    lines: lyricLines(text).map((persian, index) => ({ id: `paste-${index}`, persian })),
  }
}
export function sourceFromRecord(data: unknown): LyricsSource {
  if (!data || typeof data !== 'object') throw new Error('Invalid lyrics record.')
  const r = data as Record<string, unknown>
  if (!Number.isSafeInteger(r.id) || Number(r.id) < 1) throw new Error('Invalid lyrics record ID.')
  const durationMs =
    typeof r.duration === 'number' && Number.isFinite(r.duration) && r.duration > 0
      ? Math.round(r.duration * 1000)
      : null
  const source: LyricsSource = {
    id: Number(r.id),
    title: typeof r.trackName === 'string' ? r.trackName : 'Untitled song',
    artist: typeof r.artistName === 'string' ? r.artistName : '',
    album: typeof r.albumName === 'string' ? r.albumName : '',
    durationMs,
    url: `https://lrclib.net/api/get/${r.id}`,
    timed: false,
    lines: [],
  }
  if (typeof r.plainLyrics === 'string' && r.plainLyrics.trim()) {
    source.lines = lyricLines(r.plainLyrics).map((persian, index) => ({
      id: `${r.id}-${index}`,
      persian,
    }))
  } else if (typeof r.syncedLyrics === 'string' && durationMs) {
    source.lines = parseLrc(r.syncedLyrics, durationMs).map((line) => ({
      id: `${r.id}-${line.id}`,
      persian: line.text,
      startMs: line.startMs,
      endMs: line.endMs,
    }))
    source.timed = true
  } else
    throw new Error(
      r.instrumental
        ? 'This recording is marked instrumental.'
        : 'No usable lyrics were found in this record.',
    )
  return source
}
export async function fetchLyrics(id: number, signal: AbortSignal): Promise<LyricsSource> {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Enter a valid LRCLIB record ID.')
  const response = await fetch(`https://lrclib.net/api/get/${id}`, { signal })
  if (!response.ok)
    throw new Error(`LRCLIB returned ${response.status}. Retry or paste the Persian lyrics below.`)
  const source = sourceFromRecord(await response.json())
  if (source.id !== id) throw new Error('The returned record did not match the requested song.')
  return source
}
