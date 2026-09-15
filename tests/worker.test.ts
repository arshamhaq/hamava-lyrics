import { expect, it, vi } from 'vitest'
import worker from '../worker/index'
it('retires old AI routes before credentials, source downloads or bindings can be used', async () => {
  const ai = vi.fn(),
    db = vi.fn(),
    assets = vi.fn()
  const env = { ASSETS: { fetch: assets }, AI: { run: ai }, DB: { prepare: db } }
  const remote = vi.spyOn(globalThis, 'fetch')
  try {
    for (const path of ['/api/song', '/api/batch', '/api/batch?id=part-1'])
      for (const method of ['GET', 'POST']) {
        const response = await worker.fetch(new Request('https://app.test' + path, { method }), env)
        expect(response.status).toBe(410)
        expect(response.headers.get('cache-control')).toBe('no-store')
      }
    expect(ai).not.toHaveBeenCalled()
    expect(db).not.toHaveBeenCalled()
    expect(assets).not.toHaveBeenCalled()
    expect(remote).not.toHaveBeenCalled()
  } finally {
    remote.mockRestore()
  }
})
it('keeps connectivity and the recovery page available without AI or D1', async () => {
  const env = { ASSETS: { fetch: vi.fn(async () => new Response('<h1>Update Hamava</h1>')) } }
  expect((await worker.fetch(new Request('https://app.test/api/connectivity'), env)).status).toBe(
    204,
  )
  const repaired = await worker.fetch(new Request('https://app.test/api/app-update'), env)
  expect(await repaired.text()).toContain('Update Hamava')
  expect(repaired.headers.get('cache-control')).toBe('no-store')
  expect(env.ASSETS.fetch.mock.calls[0]).toBeDefined()
})
it('unknown API routes stay JSON and normal pages use static assets', async () => {
  const env = { ASSETS: { fetch: vi.fn(async () => new Response('app')) } }
  expect((await worker.fetch(new Request('https://app.test/api/unknown'), env)).status).toBe(404)
  expect(await (await worker.fetch(new Request('https://app.test/lyrics'), env)).text()).toBe('app')
})
