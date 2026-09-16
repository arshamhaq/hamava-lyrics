import type { SongHit, SongText, SearchResult } from '../../shared/search'
import type { ReadingLine } from '../components/LyricRows'
export async function api<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
  })
  const data = await response.json()
  if (!response.ok) {
    const wait = response.headers.get('Retry-After')
    throw new Error(
      (data.error || 'Lyrics could not load. Please retry.') +
        (wait ? ` Wait ${wait} seconds.` : ''),
    )
  }
  return data
}
const searchCache = new Map<string, SearchResult>()
export async function search(query: string, signal: AbortSignal) {
  if (searchCache.has(query)) return searchCache.get(query)!
  const data = await api<SearchResult>(`/api/search?${new URLSearchParams({ q: query })}`, signal)
  if (!data.notice && data.songs.length) {
    if (searchCache.size >= 30) searchCache.delete(searchCache.keys().next().value!)
    searchCache.set(query, data)
  }
  return data
}
export function load(hit: SongHit, signal: AbortSignal) {
  const params = new URLSearchParams({
    provider: hit.provider,
    id: hit.id,
    title: hit.title,
    artist: hit.artist,
  })
  return api<SongText>(`/api/lyrics?${params}`, signal)
}
export interface SavedSong {
  key: string
  song: SongText
  lines: ReadingLine[]
}
// Model + display formatter version, independent of app releases.
const STORAGE = 'hamava-songs-negara-5720b2c4-format1'
export function savedSongs(): SavedSong[] {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE) || '[]')
    if (!Array.isArray(data)) return []
    return data
      .filter(
        (s) =>
          typeof s.key === 'string' &&
          typeof s.song?.title === 'string' &&
          typeof s.song?.artist === 'string' &&
          typeof s.song?.text === 'string' &&
          Array.isArray(s.lines) &&
          s.lines.length > 0 &&
          s.lines.length <= 1000 &&
          s.lines.every(
            (l: ReadingLine) =>
              typeof l.id === 'string' &&
              typeof l.persian === 'string' &&
              typeof l.finglish === 'string' &&
              l.finglish,
          ),
      )
      .slice(0, 10)
  } catch {
    return []
  }
}
export function saveSong(song: SavedSong): boolean {
  try {
    localStorage.setItem(
      STORAGE,
      JSON.stringify([song, ...savedSongs().filter((s) => s.key !== song.key)].slice(0, 10)),
    )
    return true
  } catch {
    return false
  }
}

export function removeSavedSong(key: string): boolean {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(savedSongs().filter((song) => song.key !== key)))
    return true
  } catch {
    return false
  }
}
