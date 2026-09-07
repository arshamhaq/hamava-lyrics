export interface SourceLine {
  id: number
  startMs: number
  endMs: number
  text: string
}
export interface LyricBatch {
  id: string
  startMs: number
  endMs: number
  lineIds: number[]
}
export interface Song {
  sourceId: number
  version: string
  title: string
  artist: string
  album: string
  durationMs: number
  lines: SourceLine[]
  batches: LyricBatch[]
}
export interface ConvertedLine {
  id: number
  finglish: string
}
export interface BatchResult {
  lines: ConvertedLine[]
  elapsedMs: number
  neurons: number | null
}
export interface SongResponse {
  song: Song
  completed: Record<string, BatchResult>
}
export type BatchState = {
  status: 'pending' | 'loading' | 'ready' | 'error'
  result?: BatchResult
  error?: string
}

export function currentLine(song: Song, position: number) {
  return song.lines.find((line) => position >= line.startMs && position < line.endMs)
}
export function currentBatch(song: Song, position: number) {
  const line = currentLine(song, position)
  return line?.text ? song.batches.find((batch) => batch.lineIds.includes(line.id)) : undefined
}
// Recompute from the latest seek position whenever the single running request finishes.
export function nextBatch(song: Song, states: Record<string, BatchState>, position: number) {
  const pending = (batch: LyricBatch) => !states[batch.id] || states[batch.id].status === 'pending'
  const active = currentBatch(song, position)
  if (active && pending(active)) return active
  return (
    song.batches.find((batch) => batch.endMs > position && pending(batch)) ??
    song.batches.find(pending)
  )
}
