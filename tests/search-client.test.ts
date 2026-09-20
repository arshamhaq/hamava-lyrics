import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../src/search/client'
import { withDeadline } from '../shared/deadline'
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('client search deadline releases a fetch that never settles, even without AbortSignal.any/timeout', async () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
  const request = api('/api/search?q=test', new AbortController().signal)
  const check = expect(request).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(15001)
  await check
})
it('deadline covers a response body that stalls after HTTP headers arrive', async () => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => new Promise(() => {}),
    })),
  )
  const request = api('/api/search?q=test', new AbortController().signal)
  const check = expect(request).rejects.toMatchObject({ name: 'TimeoutError' })
  await vi.advanceTimersByTimeAsync(15001)
  await check
})
it('cancelled stale searches reject promptly without waiting for their deadline', async () => {
  const controller = new AbortController()
  const pending = withDeadline(() => new Promise(() => {}), controller.signal, 15000)
  controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
})
it('resuming after the wall-clock deadline ends a suspended request', async () => {
  vi.useFakeTimers()
  const events = new EventTarget()
  vi.stubGlobal('document', events)
  const pending = withDeadline(() => new Promise(() => {}), new AbortController().signal, 15000)
  const check = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
  vi.setSystemTime(Date.now() + 20000)
  events.dispatchEvent(new Event('visibilitychange'))
  await check
})
