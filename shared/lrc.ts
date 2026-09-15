import type { SourceLine } from './lyrics'

export function parseLrc(lrc: string, durationMs: number): SourceLine[] {
  if (
    !Number.isFinite(durationMs) ||
    durationMs < 1000 ||
    durationMs > 30 * 60_000 ||
    lrc.length > 50_000
  )
    throw new Error('Unsupported lyric duration or size.')
  const offset = Number(lrc.match(/^\[offset:([+-]?\d+)\]\s*$/m)?.[1] ?? 0)
  const rows: { startMs: number; text: string }[] = []
  for (const raw of lrc.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || /^\[(ar|ti|al|by|re|ve|length|offset):[^\]]*\]$/i.test(line)) continue
    const tags = line.match(/^(?:\[\d+:\d{2}(?:\.\d{1,3})?\])+/)?.[0]
    if (!tags) throw new Error('Unrecognized timestamp format.')
    const text = line.slice(tags.length).trim()
    if (text.length > 320) throw new Error('A lyric line exceeds the test limit.')
    for (const match of tags.matchAll(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g)) {
      if (Number(match[2]) >= 60) throw new Error('Invalid seconds in timestamp.')
      const startMs = Math.max(
        0,
        Number(match[1]) * 60_000 +
          Number(match[2]) * 1000 +
          Number((match[3] ?? '').padEnd(3, '0')) +
          offset,
      )
      if (startMs > durationMs) throw new Error('Timestamp exceeds recording duration.')
      rows.push({ startMs, text })
    }
  }
  rows.sort((a, b) => a.startMs - b.startMs)
  // At equal timestamps the last source marker wins; blank markers remain meaningful.
  const unique = [...new Map(rows.map((row) => [row.startMs, row])).values()]
  if (!unique.some((row) => row.text) || unique.length > 250)
    throw new Error('No usable timed lyrics.')
  return unique
    .map((row, i) => ({
      ...row,
      id: i + 1,
      endMs: unique[i + 1]?.startMs ?? durationMs,
    }))
    .filter((row) => row.endMs > row.startMs)
}
