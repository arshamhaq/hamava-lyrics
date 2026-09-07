export interface LyricLine {
  id: string
  startMs: number
  endMs: number
  finglish: string
  persian: string
}

export function activeLineAt(
  lines: readonly LyricLine[],
  positionMs: number,
): LyricLine | undefined {
  if (!Number.isFinite(positionMs) || positionMs < 0) return undefined
  return lines.find((line) => positionMs >= line.startMs && positionMs < line.endMs)
}

export function clockPosition(
  anchorMs: number,
  anchorTime: number,
  now: number,
  durationMs: number,
) {
  return Math.min(durationMs, Math.max(0, anchorMs + Math.max(0, now - anchorTime)))
}

export function formatTime(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
