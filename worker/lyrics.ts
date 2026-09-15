import type { ConvertedLine, LyricBatch, SourceLine } from '../shared/lyrics'

export { parseLrc } from '../shared/lrc'

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
