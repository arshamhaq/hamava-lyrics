import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import worker, { DAILY_ATTEMPTS, SOURCE_ID } from '../worker/index'
import type { Env, Statement } from '../worker/env'
import type { SongResponse } from '../shared/lyrics'

vi.mock('../docs/finglish-prompt-v4.txt', () => ({
  default: 'Test transcription prompt',
}))
let db: DatabaseSync, env: Env
const key = 'a-private-test-passphrase'
const background: Promise<unknown>[] = []
const ctx = {
  waitUntil: (promise: Promise<unknown>) => {
    background.push(promise)
  },
}
const record = {
  id: SOURCE_ID,
  trackName: 'Gharibe Ashena',
  artistName: 'Googoosh',
  albumName: 'Kooh',
  duration: 180,
  syncedLyrics: '[00:00.00]\n[00:05.00]سلام\n[00:20.00]\n[01:05.00]خداحافظ\n[02:05.00]سلام',
}
function statement(sql: string, values: (string | number)[] = []): Statement {
  return {
    bind: (...args) => statement(sql, args as (string | number)[]),
    first: async <T>() => (db.prepare(sql).get(...values) as T) ?? null,
    run: async () => db.prepare(sql).run(...values),
  }
}
beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../migrations/0001_live_test.sql', import.meta.url), 'utf8'))
  env = {
    DB: { prepare: statement },
    TEST_ACCESS_KEY: key,
    ASSETS: { fetch: async () => new Response('static') },
    AI: {
      run: vi.fn(async () => ({ response: [{ id: 2, finglish: 'salam' }] })),
    },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(record)),
  )
})
afterEach(async () => {
  await Promise.all(background.splice(0))
  db.close()
  vi.unstubAllGlobals()
})
const request = (path: string, body?: unknown, token = key) =>
  worker.fetch(
    new Request(`https://hamava.example${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      method: body === undefined ? 'GET' : 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    ctx,
  )
const song = async () => ((await (await request('/api/song')).json()) as SongResponse).song

it('fails closed before source or AI access; API never falls back to the SPA', async () => {
  const connectivity = await request('/api/connectivity', undefined, 'wrong')
  expect(connectivity.status).toBe(204)
  expect(connectivity.headers.get('Cache-Control')).toBe('no-store')
  const recovery = await request('/api/app-update', undefined, 'wrong')
  expect(recovery.status).toBe(200)
  expect(recovery.headers.get('Cache-Control')).toBe('no-store')
  expect((await request('/api/song', undefined, 'wrong')).status).toBe(401)
  expect(fetch).not.toHaveBeenCalled()
  expect(env.AI.run).not.toHaveBeenCalled()
  expect((await request('/api/missing')).status).toBe(404)
  delete env.TEST_ACCESS_KEY
  expect((await request('/api/song')).status).toBe(503)
  expect(await (await request('/')).text()).toBe('static')
})
it('fetches only the pinned recording and reuses source + valid conversion cache', async () => {
  const source = await song()
  const body = { batchId: 'part-1', version: source.version }
  expect((await request('/api/batch', body)).status).toBe(200)
  const again = await request('/api/batch', body)
  expect(((await again.json()) as { cached: boolean }).cached).toBe(true)
  const refreshed = (await (await request('/api/song')).json()) as SongResponse
  expect(refreshed.completed['part-1'].lines[0].finglish).toBe('salam')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(env.AI.run).toHaveBeenCalledTimes(1)
  expect((await request('/api/batch', { ...body, version: 'a'.repeat(64) })).status).toBe(409)
})
it('coalesces concurrent requests using a database lease and cache-only polling', async () => {
  const source = await song()
  let finish!: (value: unknown) => void
  env.AI.run = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const body = { batchId: 'part-1', version: source.version }
  const first = request('/api/batch', body)
  await vi.waitFor(() => expect(env.AI.run).toHaveBeenCalledTimes(1))
  expect((await request('/api/batch', body)).status).toBe(202)
  expect((await request(`/api/batch?id=part-1&version=${source.version}`)).status).toBe(202)
  expect(env.AI.run).toHaveBeenCalledTimes(1)
  finish({ response: [{ id: 2, finglish: 'salam' }] })
  expect((await first).status).toBe(200)
  expect((await request(`/api/batch?id=part-1&version=${source.version}`)).status).toBe(200)
})
it('enforces the persistent daily cap before AI and does not cache invalid results', async () => {
  const source = await song()
  env.AI.run = vi.fn(async () => ({
    response: [{ id: 999, finglish: 'wrong line' }],
  }))
  expect(
    (
      await request('/api/batch', {
        batchId: 'part-1',
        version: source.version,
      })
    ).status,
  ).toBe(502)
  expect(db.prepare('SELECT COUNT(*) AS n FROM conversions').get()?.n).toBe(0)
  expect(db.prepare('SELECT attempts FROM daily_budget').get()?.attempts).toBe(1)
  db.prepare('UPDATE daily_budget SET attempts = ?').run(DAILY_ATTEMPTS)
  expect(
    (
      await request('/api/batch', {
        batchId: 'part-2',
        version: source.version,
      })
    ).status,
  ).toBe(429)
  expect(env.AI.run).toHaveBeenCalledTimes(1)
})
