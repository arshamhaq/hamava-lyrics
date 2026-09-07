import { describe, expect, it } from 'vitest'
import { makeBatches, parseConversion, parseLrc } from '../worker/lyrics'
import { currentBatch, currentLine, nextBatch, type Song } from '../shared/lyrics'

describe('source timing and minute batches', () => {
  it('keeps instrumental markers, fractions, offsets and repeated timestamps', () => {
    const lines = parseLrc(
      '[ar:Test]\n[offset:100]\n[00:00.00]\n[00:10.1][01:10.123]سلام\n[00:20.00]\n[01:20.00]خداحافظ',
      100_000,
    )
    expect(lines.map((line) => line.startMs)).toEqual([100, 10_200, 20_100, 70_223, 80_100])
    expect(lines[1].endMs).toBe(20_100)
    const song = { lines, batches: makeBatches(lines) } as Song
    expect(currentLine(song, 20_100)?.text).toBe('')
    expect(currentBatch(song, 20_100)).toBeUndefined()
    expect(song.batches.map((batch) => batch.lineIds)).toEqual([[2], [4, 5]])
  })
  it('assigns crossing lines by start time and splits dense minutes without losing IDs', () => {
    const lines = parseLrc(
      Array.from({ length: 12 }, (_, i) => `[00:${String(i * 4).padStart(2, '0')}.00]سلام`).join(
        '\n',
      ) + '\n[01:01.00]خداحافظ',
      90_000,
    )
    const batches = makeBatches(lines)
    expect(batches.map((batch) => batch.lineIds.length)).toEqual([10, 2, 1])
    expect(batches.flatMap((batch) => batch.lineIds)).toEqual(lines.map((line) => line.id))
    const song = { lines, batches } as Song
    expect(currentBatch(song, 60_000)?.id).toBe('part-2')
    expect(nextBatch(song, { 'part-1': { status: 'loading' } }, 61_000)?.id).toBe('part-3')
    expect(
      nextBatch(song, { 'part-1': { status: 'ready' }, 'part-3': { status: 'ready' } }, 61_000)?.id,
    ).toBe('part-2')
  })
  it('rejects broken timing and oversized lines', () => {
    expect(() => parseLrc('[00:99]سلام', 100_000)).toThrow()
    expect(() => parseLrc('[01:00]سلام', 10_000)).toThrow()
    expect(() => parseLrc(`[00:00]${'a'.repeat(321)}`, 10_000)).toThrow()
  })
})
describe('AI output validation', () => {
  it('accepts parsed responses and complete fences without modifying pronunciation', () => {
    const rows = [
      { id: 8, finglish: 'salam' },
      { id: 9, finglish: 'khodahafez' },
    ]
    expect(parseConversion({ response: rows }, [8, 9])).toEqual(rows)
    expect(
      parseConversion(
        {
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: '```json\n' + JSON.stringify(rows) + '\n```',
              },
            },
          ],
        },
        [8, 9],
      ),
    ).toEqual(rows)
  })
  it('rejects extra, missing, duplicated, reordered and truncated output', () => {
    for (const rows of [
      [{ id: 1, finglish: 'salam' }],
      [
        { id: 1, finglish: 'salam' },
        { id: 1, finglish: 'salam' },
      ],
      [
        { id: 2, finglish: 'salam' },
        { id: 1, finglish: 'salam' },
      ],
    ])
      expect(() => parseConversion({ response: rows }, [1, 2])).toThrow()
    expect(() => parseConversion({ response: [{ id: 1, finglish: 'سلام' }] }, [1])).toThrow()
    expect(() =>
      parseConversion({ response: [{ id: 1, finglish: 'salam', timestamp: 10 }] }, [1]),
    ).toThrow()
    expect(() =>
      parseConversion(
        {
          response: [{ id: 1, finglish: 'salam' }],
          choices: [{ finish_reason: 'length' }],
        },
        [1],
      ),
    ).toThrow()
  })
})
