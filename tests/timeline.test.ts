import { describe, expect, it } from 'vitest'
import { activeLineAt, clockPosition, formatTime, type LyricLine } from '../src/lib/timeline'

const lines: LyricLine[] = [
  { id: 'a', startMs: 1000, endMs: 3000, finglish: 'one', persian: '' },
  { id: 'b', startMs: 3000, endMs: 5000, finglish: 'two', persian: '' },
  { id: 'c', startMs: 7000, endMs: 9000, finglish: 'three', persian: '' },
]
describe('lyric selection', () => {
  it('changes at the exact boundary and clears during instrumental gaps and at the end', () => {
    expect(activeLineAt(lines, 0)).toBeUndefined()
    expect(activeLineAt(lines, 2999)?.id).toBe('a')
    expect(activeLineAt(lines, 3000)?.id).toBe('b')
    expect(activeLineAt(lines, 6000)).toBeUndefined()
    expect(activeLineAt(lines, 9000)).toBeUndefined()
  })
  it('selects correctly after backward seeks and rejects invalid positions', () => {
    expect(activeLineAt(lines, 7500)?.id).toBe('c')
    expect(activeLineAt(lines, 1200)?.id).toBe('a')
    expect(activeLineAt(lines, NaN)).toBeUndefined()
    expect(activeLineAt(lines, -1)).toBeUndefined()
  })
})
it('advances from elapsed time instead of counting frames and clamps at the end', () => {
  expect(clockPosition(8000, 100, 12100, 24000)).toBe(20000)
  expect(clockPosition(8000, 100, 99100, 24000)).toBe(24000)
  expect(formatTime(237000)).toBe('3:57')
})
