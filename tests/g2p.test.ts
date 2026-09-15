import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { sourceFromRecord, lyricLines } from '../src/g2p/text'
describe('browser G2P boundaries', () => {
  it('preserves repeated lines and order', () => {
    expect(lyricLines('سلام\r\n\nسلام\n خداحافظ ')).toEqual(['سلام', 'سلام', 'خداحافظ'])
  })
  it('rejects oversized input instead of truncating', () => {
    expect(() => lyricLines(' ')).toThrow()
    expect(() => lyricLines(Array(1001).fill('سلام').join('\n'))).toThrow()
    expect(() => lyricLines('آ'.repeat(257))).toThrow()
  })
  it('decodes symbols without correcting model pronunciation', () => {
    const context = vm.createContext({
      postMessage: () => {},
      URL,
      self: { location: { origin: 'https://app.test' } },
    })
    vm.runInContext(readFileSync('public/g2p-worker.js', 'utf8'), context)
    const convert = (input: string) =>
      vm.runInContext(`finglish(${JSON.stringify(input)})`, context)
    expect(convert('oun mard')).toBe('oon mard')
    expect(convert('oumadam')).toBe('oomadam')
    expect(convert('CeSmAt xoS paZmorde')).toBe('cheshmat khosh pazhmorde')
    expect(convert('mard mord rofti kenAreye')).toBe('mard mord rofti kenareye')
  })
})

it('accepts different plain and timed sources without inventing timing', () => {
  const plain = sourceFromRecord({
    id: 99,
    trackName: 'Another song',
    artistName: 'Another artist',
    plainLyrics: 'سلام\nسلام',
  })
  expect(plain.lines).toHaveLength(2)
  expect(plain.lines[0].id).not.toBe(plain.lines[1].id)
  expect(plain.lines[0].startMs).toBeUndefined()
  const timed = sourceFromRecord({
    id: 100,
    duration: 20,
    syncedLyrics: '[00:01.00]سلام\n[00:04.00]',
  })
  expect(timed.timed).toBe(true)
  expect(timed.lines[0]).toMatchObject({ startMs: 1000, endMs: 4000, persian: 'سلام' })
  expect(timed.lines[1].persian).toBe('')
})
