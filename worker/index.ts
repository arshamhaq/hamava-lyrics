import prompt from '../docs/finglish-prompt-v4.txt'
import type { BatchResult, Song, SongResponse } from '../shared/lyrics'
import type { Env } from './env'
import { makeBatches, parseConversion, parseLrc } from './lyrics'

export const SOURCE_ID = 13013538
export const MODEL = '@cf/qwen/qwen3.8-27b'
export const DAILY_ATTEMPTS = 24
const SETTINGS = {
  stream: false,
  temperature: 0.7,
  top_p: 0.8,
  max_completion_tokens: 900,
  chat_template_kwargs: { enable_thinking: false },
}
const encoder = new TextEncoder()
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
async function hash(text: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
}
async function authorized(request: Request, secret: string) {
  const supplied = request.headers.get('Authorization') ?? ''
  if (supplied.length > 4096) return false
  const [a, b] = await Promise.all([hash(supplied), hash(`Bearer ${encodeURIComponent(secret)}`)])
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}
export async function getSong(env: Env): Promise<Song> {
  const cached = await env.DB.prepare('SELECT payload, fetched_at FROM sources WHERE id = ?')
    .bind(SOURCE_ID)
    .first<{ payload: string; fetched_at: number }>()
  if (cached && Date.now() - cached.fetched_at < 86_400_000) {
    const song: Song = JSON.parse(cached.payload)
    song.batches = makeBatches(song.lines)
    song.version = await songVersion(song)
    return song
  }
  let response: Response
  try {
    response = await fetch(`https://lrclib.net/api/get/${SOURCE_ID}`, {
      headers: {
        'User-Agent': 'Hamava/0.2 (personal lyrics experiment)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new ApiError(502, 'LRCLIB could not be reached. Try loading the song again.')
  }
  if (!response.ok) throw new ApiError(502, 'LRCLIB could not provide this recording right now.')
  const record = (await response.json()) as {
    id: number
    trackName: string
    artistName: string
    albumName: string
    duration: number
    syncedLyrics: string
  }
  if (
    record.id !== SOURCE_ID ||
    record.artistName.toLowerCase() !== 'googoosh' ||
    record.trackName.toLowerCase() !== 'gharibe ashena' ||
    typeof record.syncedLyrics !== 'string'
  )
    throw new ApiError(
      502,
      'The expected Gharibe Ashena recording or its timed lyrics are unavailable.',
    )
  let lines
  try {
    lines = parseLrc(record.syncedLyrics, Math.round(record.duration * 1000))
  } catch {
    throw new ApiError(502, 'The source lyrics have unsupported timing. No AI request was made.')
  }
  const song: Song = {
    sourceId: SOURCE_ID,
    version: '',
    title: record.trackName,
    artist: record.artistName,
    album: record.albumName,
    durationMs: Math.round(record.duration * 1000),
    lines,
    batches: makeBatches(lines),
  }
  song.version = await songVersion(song)
  await env.DB.prepare(
    'INSERT INTO sources (id, payload, fetched_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, fetched_at=excluded.fetched_at',
  )
    .bind(SOURCE_ID, JSON.stringify(song), Date.now())
    .run()
  return song
}
const songVersion = (song: Song) =>
  hash(
    JSON.stringify([
      song.sourceId,
      song.durationMs,
      song.lines,
      song.batches,
      prompt,
      MODEL,
      SETTINGS,
      'minute-batches-v1',
    ]),
  )
async function cachedBatch(env: Env, key: string): Promise<BatchResult | null> {
  const row = await env.DB.prepare('SELECT payload FROM conversions WHERE cache_key = ?')
    .bind(key)
    .first<{ payload: string }>()
  return row ? JSON.parse(row.payload) : null
}
async function convert(
  env: Env,
  song: Song,
  batchId: string,
  ctx: { waitUntil(promise: Promise<unknown>): void },
) {
  const batch = song.batches.find((item) => item.id === batchId)!
  const key = `${song.version}:${batch.id}`
  const cached = await cachedBatch(env, key)
  if (cached) return json({ ...cached, cached: true })
  const now = Date.now(),
    lease = crypto.randomUUID()
  const acquired = await env.DB.prepare(
    'INSERT INTO jobs (cache_key, lease, expires_at) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET lease=excluded.lease, expires_at=excluded.expires_at WHERE jobs.expires_at <= ? RETURNING lease',
  )
    .bind(key, lease, now + 180_000, now)
    .first<{ lease: string }>()
  if (!acquired) return json({ pending: true }, 202)
  const release = () =>
    env.DB.prepare('DELETE FROM jobs WHERE cache_key = ? AND lease = ?').bind(key, lease).run()
  // Another request can populate the cache between our initial read and lock acquisition.
  const recheck = await cachedBatch(env, key)
  if (recheck) {
    await release()
    return json({ ...recheck, cached: true })
  }
  const budget = await env.DB.prepare(
    'INSERT INTO daily_budget (day, attempts) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET attempts=attempts+1 WHERE attempts < ? RETURNING attempts',
  )
    .bind(new Date().toISOString().slice(0, 10), DAILY_ATTEMPTS)
    .first<{ attempts: number }>()
  if (!budget) {
    await release()
    throw new ApiError(
      429,
      'Today’s test limit is reached. Completed sections still work; new requests reset at midnight UTC.',
    )
  }
  const input = batch.lineIds.map((id) => ({
    id,
    text: song.lines.find((line) => line.id === id)!.text,
  }))
  const started = Date.now()
  const job = (async () => {
    let raw: unknown
    try {
      raw = await env.AI.run(MODEL, {
        ...SETTINGS,
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: `INPUT:\n${JSON.stringify(input)}\n/no_think`,
          },
        ],
      })
    } catch {
      throw new ApiError(
        502,
        'The AI service failed. Completed sections are safe. Wait up to three minutes before retrying this section.',
      )
    }
    let lines
    try {
      lines = parseConversion(raw, batch.lineIds)
    } catch {
      throw new ApiError(
        502,
        'The AI returned an incomplete or invalid section. Wait up to three minutes, then retry this section.',
      )
    }
    const usage = (raw as { usage?: { neurons?: number } }).usage
    const result: BatchResult = {
      lines,
      elapsedMs: Date.now() - started,
      neurons: typeof usage?.neurons === 'number' ? usage.neurons : null,
    }
    await env.DB.prepare(
      'INSERT INTO conversions (cache_key, payload) VALUES (?, ?) ON CONFLICT(cache_key) DO NOTHING',
    )
      .bind(key, JSON.stringify(result))
      .run()
    await release()
    return result
  })()
  // If the caller leaves, save a late result where the platform's background lifetime permits.
  ctx.waitUntil(job.catch(() => {}))
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      job,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ApiError(
                504,
                'This section is taking too long. Other sections remain available. Wait up to three minutes before retrying; the request may still finish.',
              ),
            ),
          60_000,
        )
      }),
    ])
    return json({ ...result, cached: false })
  } finally {
    clearTimeout(timer)
  }
  // Failure does not refund quota or release the lease: server processing can be uncertain.
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/connectivity' && request.method === 'GET') {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
    }
    // This path is excluded from even the first shipped SW's navigation cache.
    // It serves only a static repair page and never touches lyrics, AI, or secrets.
    if (url.pathname === '/api/app-update' && request.method === 'GET') {
      const assetUrl = new URL('/update.html', url.origin)
      const asset = await env.ASSETS.fetch(new Request(assetUrl, { method: 'GET' }))
      const response = new Response(asset.body, asset)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      if (!env.TEST_ACCESS_KEY || env.TEST_ACCESS_KEY.length < 16)
        throw new ApiError(
          503,
          'The live test is not configured yet. Set its private access passphrase first.',
        )
      if (!(await authorized(request, env.TEST_ACCESS_KEY)))
        throw new ApiError(
          401,
          'The test passphrase is incorrect. Use the private app passphrase, not a Cloudflare API token.',
        )
      if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin)
        throw new ApiError(403, 'Use the app on its own website.')
      if (url.pathname === '/api/song' && request.method === 'GET') {
        const song = await getSong(env),
          completed: SongResponse['completed'] = {}
        await Promise.all(
          song.batches.map(async (batch) => {
            const result = await cachedBatch(env, `${song.version}:${batch.id}`)
            if (result) completed[batch.id] = result
          }),
        )
        return json({ song, completed })
      }
      if (url.pathname === '/api/batch' && ['GET', 'POST'].includes(request.method)) {
        let id: unknown, version: unknown
        if (request.method === 'POST') {
          if (!request.headers.get('Content-Type')?.startsWith('application/json'))
            throw new ApiError(415, 'Expected JSON.')
          const body = await request.text()
          if (body.length > 256) throw new ApiError(413, 'Request is too large.')
          try {
            ;({ batchId: id, version } = JSON.parse(body))
          } catch {
            throw new ApiError(400, 'Invalid JSON request.')
          }
        } else {
          id = url.searchParams.get('id')
          version = url.searchParams.get('version')
        }
        if (
          typeof id !== 'string' ||
          !/^part-\d{1,3}$/.test(id) ||
          typeof version !== 'string' ||
          !/^[a-f0-9]{64}$/.test(version)
        )
          throw new ApiError(400, 'Invalid section request.')
        const song = await getSong(env)
        if (version !== song.version)
          throw new ApiError(
            409,
            'The source or prompt changed. Lock the test and load the song again.',
          )
        if (!song.batches.some((batch) => batch.id === id))
          throw new ApiError(404, 'Section not found.')
        if (request.method === 'GET') {
          const cached = await cachedBatch(env, `${song.version}:${id}`)
          return cached ? json({ ...cached, cached: true }) : json({ pending: true }, 202)
        }
        return await convert(env, song, id, ctx)
      }
      return json({ error: 'API route not found.' }, 404)
    } catch (error) {
      return json(
        {
          error:
            error instanceof ApiError
              ? error.message
              : 'The lyrics service is unavailable. Check that the database migration and AI binding are configured.',
        },
        error instanceof ApiError ? error.status : 503,
      )
    }
  },
}
