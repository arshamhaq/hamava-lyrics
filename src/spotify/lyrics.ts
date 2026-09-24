import type { LyricChoice } from '../../shared/spotify'
import { lyricsEngine, type EngineEvent } from '../g2p/engine'
import type { LyricLine } from '../lib/timeline'

export type ConvertedLyric = LyricLine & { error?: string; approximate?: boolean }
export function choiceLines(choice: LyricChoice): ConvertedLyric[] {
  const source =
    choice.timedLines ||
    choice.text
      .split(/\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, i) => ({ id: i + 1, text, startMs: 0, endMs: 0 }))
  return source.map((line) => ({
    id: `${choice.id}-${line.id}`,
    persian: line.text,
    finglish: '',
    startMs: line.startMs,
    endMs: line.endMs,
  }))
}
// Split only inference inputs. Rejoin before display so source timing is never subdivided or invented.
export function splitForInference(text: string): string[] {
  const result: string[] = []
  let chunk = ''
  const encoder = new TextEncoder()
  for (const word of text.normalize('NFKC').match(/\S+\s*/gu) || []) {
    if (encoder.encode(chunk + word).length > 480 && chunk) {
      result.push(chunk.trim())
      chunk = ''
    }
    if (encoder.encode(word).length > 480) {
      // Rare oversized token: keep the engine input bounded even without spaces.
      for (const char of word) {
        if (encoder.encode(chunk + char).length > 480) {
          result.push(chunk)
          chunk = ''
        }
        chunk += char
      }
    } else chunk += word
  }
  if (chunk.trim()) result.push(chunk.trim())
  return result
}
export async function convertChoice(
  choice: LyricChoice,
  signal: AbortSignal,
  onRows: (rows: ConvertedLyric[]) => void,
  onEvent: (event: EngineEvent) => void,
) {
  const rows = choiceLines(choice)
  const parts = rows.flatMap((r, row) =>
    splitForInference(r.persian).map((persian, part) => ({ id: `${row}:${part}`, persian, row })),
  )
  if (!parts.length) throw new Error('No lyrics to read.')
  const expected = rows.map((_, row) => parts.filter((p) => p.row === row).length)
  const output = new Map<string, { finglish: string; error?: string; approximate?: boolean }>()
  onRows(rows)
  await lyricsEngine.convert(parts, {
    signal,
    onEvent,
    onLine: (line) => {
      output.set(line.id, line)
      const row = line.row
      const completed = parts.filter((p) => p.row === row).map((p) => output.get(p.id))
      if (completed.filter(Boolean).length === expected[row]) {
        rows[row] = {
          ...rows[row],
          finglish: completed.some((p) => p!.error)
            ? ''
            : completed.map((p) => p!.finglish).join(' '),
          error: completed.find((p) => p!.error)?.error,
          approximate: completed.some((p) => p!.approximate),
        }
        onRows([...rows])
      }
    },
  })
  return rows
}
