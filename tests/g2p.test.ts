import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { lyricLines } from '../src/g2p/text'
describe('browser G2P boundaries', () => {
  it('preserves repeated lines and order', () => {
    expect(lyricLines('سلام\r\n\nسلام\n خداحافظ ')).toEqual(['سلام', 'سلام', 'خداحافظ'])
  })
  it('rejects oversized input instead of truncating', () => {
    expect(() => lyricLines(' ')).toThrow()
    expect(() => lyricLines(Array(121).fill('سلام').join('\n'))).toThrow()
    expect(() => lyricLines('آ'.repeat(257))).toThrow()
  })
  it('decodes symbols without correcting model pronunciation', () => {
    const context = vm.createContext({ postMessage: () => {} })
    vm.runInContext(readFileSync('public/g2p-worker.js', 'utf8'), context)
    const convert = (input: string) =>
      vm.runInContext(`finglish(${JSON.stringify(input)})`, context)
    expect(convert('oun mard')).toBe('oon mard')
    expect(convert('oumadam')).toBe('oomadam')
    expect(convert('CeSmAt xoS paZmorde')).toBe('cheshmat khosh pazhmorde')
    expect(convert('mard mord rofti kenAreye')).toBe('mard mord rofti kenareye')
  })
})
