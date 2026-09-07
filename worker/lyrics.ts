import type { ConvertedLine, LyricBatch, SourceLine } from '../shared/lyrics'

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

export function makeBatches(lines: SourceLine[]): LyricBatch[] {
  const batches: LyricBatch[] = []
  let window = -1,
    chars = 0
  for (const line of lines) {
    if (!line.text) continue
    const minute = Math.floor(line.startMs / 60_000)
    let batch = batches.at(-1)
    if (
      !batch ||
      minute !== window ||
      batch.lineIds.length >= 10 ||
      chars + line.text.length > 1200
    ) {
      batch = {
        id: `part-${batches.length + 1}`,
        startMs: line.startMs,
        endMs: line.endMs,
        lineIds: [],
      }
      batches.push(batch)
      window = minute
      chars = 0
    }
    batch.lineIds.push(line.id)
    batch.endMs = line.endMs
    chars += line.text.length
  }
  return batches
}

export function parseConversion(raw: unknown, expected: number[]): ConvertedLine[] {
  const outer = raw as {
    result?: unknown
    response?: unknown
    choices?: { finish_reason?: string; message?: { content?: unknown } }[]
  }
  const result = (outer?.result ?? outer) as typeof outer
  if (result?.choices?.[0]?.finish_reason && result.choices[0].finish_reason !== 'stop')
    throw new Error('AI response was incomplete.')
  let value = result?.response ?? result?.choices?.[0]?.message?.content
  if (typeof value === 'string') {
    let text = value.trim()
    const fence = text.match(/^(`{1,3})(?:json)?\s*\n([\s\S]*?)\n\1$/i)
    if (fence) text = fence[2]
    value = JSON.parse(text)
  }
  if (!Array.isArray(value) || value.length !== expected.length)
    throw new Error('AI line count did not match.')
  return value.map((row, i) => {
    if (
      !row ||
      typeof row !== 'object' ||
      Object.keys(row).sort().join(',') !== 'finglish,id' ||
      row.id !== expected[i] ||
      !Number.isInteger(row.id) ||
      typeof row.finglish !== 'string' ||
      !row.finglish.trim() ||
      row.finglish.length > 640 ||
      /[\u0600-\u06ff]/.test(row.finglish)
    )
      throw new Error('AI output failed line validation.')
    return { id: row.id, finglish: row.finglish.trim() }
  })
}
