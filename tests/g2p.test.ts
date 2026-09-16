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

function recoveryContext() {
  const context = vm.createContext({
    postMessage: () => {},
    URL,
    self: { location: { origin: 'https://app.test' } },
    DOMException,
  })
  vm.runInContext(readFileSync('public/g2p-worker.js', 'utf8'), context)
  return context
}
it('recovers an incomplete line by splitting without dropping repeated words or publishing the looping output', async () => {
  const context = recoveryContext()
  const calls: string[] = []
  context.infer = async (text: string) => {
    calls.push(text)
    return text.split(' ').length > 2
      ? { truncated: true, raw: 'LOOP', finglish: 'LOOP', tokens: 512 }
      : { truncated: false, raw: text, finglish: text, tokens: 10 }
  }
  const result = await vm.runInContext("recoverLine('one one two two', infer)", context)
  expect(result).toMatchObject({
    raw: 'one one two two',
    finglish: 'one one two two',
    recovered: true,
    truncated: false,
  })
  expect(calls).toEqual(['one one two two', 'one one', 'two two'])
})
it('bounds recovery attempts and returns marked spelling instead of incomplete model output', async () => {
  const context = recoveryContext()
  let tokens = 0
  context.infer = async (_text: string, limit: number) => {
    tokens += limit
    return { truncated: true, raw: 'bad', finglish: 'bad', tokens: limit }
  }
  const result = await vm.runInContext(
    "recoverLine('one two three four five six seven eight', infer)",
    context,
  )
  expect(tokens).toBeLessThanOrEqual(2048)
  expect(result).toMatchObject({
    raw: '',
    finglish: 'one two three four five six seven eight',
    approximate: true,
  })
  expect(result.error).toBeUndefined()
})
it('recovery preserves cancellation and real runtime errors rather than hiding them as lyric failures', async () => {
  const context = recoveryContext()
  context.infer = async () => {
    throw new Error('runtime crashed')
  }
  await expect(vm.runInContext("recoverLine('one two', infer)", context)).rejects.toThrow(
    'runtime crashed',
  )
  vm.runInContext('activeJob = { cancelled: true }', context)
  await expect(vm.runInContext("recoverLine('one two', infer)", context)).rejects.toMatchObject({
    name: 'AbortError',
  })
})
it('rejects completed but expanded phrases and reuses matching repeated phrases without erasing the repetition', async () => {
  const context = recoveryContext()
  const calls: string[] = []
  context.infer = async (part: string) => {
    calls.push(part)
    if (part === 'one two, one two') return { truncated: true, raw: '', finglish: '', tokens: 512 }
    if (part === 'one two,')
      return { truncated: false, raw: 'one two', finglish: 'one two', tokens: 7 }
    throw new Error('The same repeated phrase should be reused.')
  }
  const result = await vm.runInContext("recoverLine('one two, one two', infer)", context)
  expect(result.finglish).toBe('one two one two')
  expect(calls).toEqual(['one two, one two', 'one two,'])
  expect(vm.runInContext("expandedOutput('one two', 'one two two two two')", context)).toBe(true)
})

it('spelling fallback preserves vocal repetitions, written vowels and digits', () => {
  const context = recoveryContext()
  const spell = (text: string) =>
    vm.runInContext(`approximateSpelling(${JSON.stringify(text)})`, context)
  expect(spell('و و و')).toBe('o o o')
  expect(spell('بَـبو ۱۲٣')).toBe('baboo 123')
  expect(spell('ك ي')).toBe('k y')
})
it('keeps a successful phrase when its neighboring fragment requires approximate spelling', async () => {
  const context = recoveryContext()
  context.infer = async (part: string) =>
    part === 'بغل تو'
      ? { truncated: false, raw: 'baqale to', finglish: 'baghale to', tokens: 10 }
      : { truncated: true, raw: 'LOOP', finglish: 'LOOP', tokens: 48 }
  const result = await vm.runInContext("recoverLine('بغل تو و و', infer)", context)
  expect(result).toMatchObject({
    raw: '',
    finglish: 'baghale to o o',
    approximate: true,
    truncated: false,
  })
})
