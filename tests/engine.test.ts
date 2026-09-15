import { expect, it, vi } from 'vitest'
import { LyricsEngine } from '../src/g2p/engine'
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  emit(data: unknown) {
    this.onmessage?.({ data })
  }
}
const line = (jobId: number, index = 0) => ({
  type: 'line',
  jobId,
  index,
  raw: 'salAm',
  finglish: 'salam',
  ms: 2,
  tokens: 5,
  truncated: false,
})
const done = (jobId: number) => ({
  type: 'done',
  jobId,
  backend: 'wasm',
  warm: true,
  loadMs: 0,
  inferenceMs: 2,
  elapsedMs: 2,
  uniqueLines: 1,
  generatedLines: 1,
})
it('reuses one worker across songs and restores original IDs and timing', async () => {
  const w = new FakeWorker(),
    factory = vi.fn(() => w as unknown as Worker),
    engine = new LyricsEngine(factory)
  const input = { id: 'song-a-1', persian: 'سلام', startMs: 42, endMs: 99, extra: 'kept' }
  const a = engine.convert([input])
  w.emit({ ...line(1), id: 'wrong', startMs: 100, persian: 'changed' })
  w.emit(done(1))
  expect((await a).lines[0]).toMatchObject({ ...input, finglish: 'salam' })
  const b = engine.convert([{ id: 'song-b', persian: 'سلام' }])
  w.emit(line(2))
  w.emit(done(2))
  await b
  expect(factory).toHaveBeenCalledTimes(1)
  expect(w.terminate).not.toHaveBeenCalled()
  expect(w.postMessage.mock.calls[0][0]).toEqual({ type: 'run', jobId: 1, lines: ['سلام'] })
})
it('cancelled song cannot leak late results into the next queued song', async () => {
  const w = new FakeWorker(),
    engine = new LyricsEngine(() => w as unknown as Worker),
    controller = new AbortController(),
    callback = vi.fn()
  const a = engine.convert([{ id: 'a', persian: 'سلام' }], {
    signal: controller.signal,
    onLine: callback,
  })
  const rejection = expect(a).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejection
  const b = engine.convert([{ id: 'b', persian: 'سلام' }])
  w.emit(line(1))
  expect(callback).not.toHaveBeenCalled()
  w.emit({ type: 'cancelled', jobId: 1 })
  w.emit(line(1))
  w.emit(line(2))
  w.emit(done(2))
  expect((await b).lines[0].id).toBe('b')
  expect(w.terminate).not.toHaveBeenCalled()
})
it('rejects truncated or missing output and permits a clean retry', async () => {
  const workers = [new FakeWorker(), new FakeWorker()]
  let calls = 0
  const engine = new LyricsEngine(() => workers[calls++] as unknown as Worker)
  const a = engine.convert([{ id: 'a', persian: 'سلام' }])
  const bad = expect(a).rejects.toThrow('Invalid or incomplete')
  workers[0].emit({ ...line(1), truncated: true })
  await bad
  expect(workers[0].terminate).toHaveBeenCalled()
  const b = engine.convert([{ id: 'b', persian: 'سلام' }])
  const missing = expect(b).rejects.toThrow('missing lines')
  workers[1].emit(done(2))
  await missing
})
it('rejects invalid input before loading the model', async () => {
  const factory = vi.fn(),
    engine = new LyricsEngine(factory)
  await expect(
    engine.convert([
      { id: 'a', persian: 'سلام' },
      { id: 'a', persian: 'سلام' },
    ]),
  ).rejects.toThrow('distinct')
  await expect(engine.convert([{ id: 'a', persian: 'آ'.repeat(257) }])).rejects.toThrow('512')
  expect(factory).not.toHaveBeenCalled()
})
