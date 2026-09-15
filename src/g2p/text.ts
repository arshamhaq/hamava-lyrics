export const SONG = {
  id: 13708175,
  title: 'Tasnife Del Bordi',
  artist: 'Mohammad-Reza Shajarian',
  album: 'Payame Nasim',
  url: 'https://lrclib.net/api/get/13708175',
}
export function lyricLines(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) throw new Error('Load or paste Persian lyrics first.')
  if (lines.length > 120) throw new Error('This test accepts at most 120 lines.')
  if (lines.some((line) => new TextEncoder().encode(line.normalize('NFKC')).length > 512))
    throw new Error('One line is too long. Split it into shorter lines before running.')
  return lines
}
export async function fetchSong(signal: AbortSignal): Promise<string> {
  const response = await fetch(SONG.url, { signal })
  if (!response.ok)
    throw new Error(`LRCLIB returned ${response.status}. Retry or paste the Persian lyrics below.`)
  const data = await response.json()
  if (data.id !== SONG.id || typeof data.plainLyrics !== 'string' || !data.plainLyrics.trim())
    throw new Error('No plain lyrics in this record. Paste the Persian text below.')
  return data.plainLyrics
}
