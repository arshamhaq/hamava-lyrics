import { afterEach, expect, it, vi } from 'vitest'
import { normalizeQuery, queryVariants, rankSongs, type SongHit } from '../shared/search'
const hit = (id: string, title: string, artist = 'Mohammad-Reza Shajarian'): SongHit => ({
  provider: 'lrclib',
  id,
  title,
  artist,
  album: '',
  duration: 230,
  hasLyrics: true,
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('matches partial titles, aliases and close spellings without accepting unrelated broad hits', () => {
  const songs = [
    hit('1', 'Tasnife Del Bordi'),
    hit('2', 'Del Bordi (Live)'),
    hit('3', 'Bordi'),
    hit('4', 'Hello'),
    hit('5', 'Sou uma Delas', 'Vanilda Bordieri'),
    hit('6', 'Delamo Bordi', 'Mehraad Jam'),
  ]
  expect(rankSongs(songs, 'del bordi').map((s) => s.id)).toEqual(['1', '2'])
  expect(rankSongs(songs, 'tasnim del bordi').map((s) => s.id)).toEqual(['1', '2'])
  expect(rankSongs(songs, 'دل بردی').map((s) => s.id)).toEqual(['1', '2'])
  expect(rankSongs(songs, 'del bordy').map((s) => s.id)).toEqual(['1', '2'])
  expect(queryVariants('tasnim del bordi').length).toBeLessThanOrEqual(3)
  expect(normalizeQuery('علي كَرِيم')).toBe('علی کریم')
})
it('broadens empty keyword results, filters non-Persian text and caches compact metadata', async () => {
  vi.resetModules()
  const { searchApi } = await import('../worker/search')
  const requests: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requests.push(url)
      return Response.json(
        requests.length === 1
          ? []
          : [
              {
                id: 13708175,
                trackName: 'Tasnife Del Bordi',
                artistName: 'Shajarian',
                plainLyrics: 'سلام\nخداحافظ',
                duration: 230,
              },
              { id: 2, trackName: 'Del Bordi', artistName: 'Other', plainLyrics: 'Only English' },
            ],
      )
    }),
  )
  const request = new Request('https://app.test/api/search?q=tasnim%20del%20bordi')
  const response = await searchApi(request)
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(data.songs).toHaveLength(1)
  expect(data.songs[0].title).toBe('Tasnife Del Bordi')
  expect(JSON.stringify(data)).not.toContain('سلام')
  await searchApi(request)
  expect(requests).toHaveLength(2)
})
it('verifies alternate lyrics before showing a result and reuses them on selection', async () => {
  vi.resetModules()
  const { searchSongs, loadSong } = await import('../worker/search')
  const requests: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requests.push(url)
      if (url.includes('lrclib')) return Response.json([])
      if (url.includes('/suggest/'))
        return Response.json({
          data: [{ id: 8, title: 'My Song', artist: { name: 'Singer' }, duration: 200 }],
        })
      return Response.json({ lyrics: 'سلام\nخداحافظ' })
    }),
  )
  const results = await searchSongs('my song', new AbortController().signal)
  expect(results.songs[0]).toMatchObject({ provider: 'ovh', hasLyrics: true })
  expect(requests.filter((url) => url.includes('/v1/'))).toHaveLength(1)
  const song = await loadSong(
    new URLSearchParams({ provider: 'ovh', title: 'My Song', artist: 'Singer' }),
    new AbortController().signal,
  )
  expect(song.source).toBe('lyrics.ovh')
  expect(song.text).toBe('سلام\nخداحافظ')
  expect(requests.filter((url) => url.includes('/v1/'))).toHaveLength(1)
})
it('strips LRC timestamps for unsynced reading and rejects mismatched record identities', async () => {
  vi.resetModules()
  const { searchApi } = await import('../worker/search')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        id: 7,
        trackName: 'Song',
        artistName: 'Singer',
        syncedLyrics: '[00:12.00]سلام\n[00:20.00]خداحافظ',
      }),
    ),
  )
  const response = await searchApi(new Request('https://app.test/api/lyrics?provider=lrclib&id=7'))
  expect((await response.json()).text).toBe('سلام\nخداحافظ')
  const mismatch = await searchApi(new Request('https://app.test/api/lyrics?provider=lrclib&id=8'))
  expect(mismatch.status).toBe(502)
})
it('validates public API inputs and respects upstream Retry-After without a fallback storm', async () => {
  vi.resetModules()
  const { searchApi } = await import('../worker/search')
  const remote = vi.fn(
    async () => new Response('', { status: 429, headers: { 'Retry-After': '60' } }),
  )
  vi.stubGlobal('fetch', remote)
  expect((await searchApi(new Request('https://app.test/api/search?q=a'))).status).toBe(400)
  expect(
    (await searchApi(new Request('https://app.test/api/lyrics?provider=url&id=https://evil.test')))
      .status,
  ).toBe(400)
  expect(remote).not.toHaveBeenCalled()
  const request = new Request('https://app.test/api/search?q=busy')
  const response = await searchApi(request)
  expect(response.status).toBe(429)
  expect(response.headers.get('Retry-After')).toBe('60')
  expect((await searchApi(request)).status).toBe(429)
  expect(remote).toHaveBeenCalledTimes(1)
})
it('does not pass English-only fallback text into the Persian converter', async () => {
  vi.resetModules()
  const { searchApi } = await import('../worker/search')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ lyrics: 'Not Persian lyrics' })),
  )
  const response = await searchApi(
    new Request('https://app.test/api/lyrics?provider=ovh&title=Song&artist=Singer'),
  )
  expect(response.status).toBe(404)
})

it('matches anchored partial artist names without broadening unrelated title prefixes', () => {
  const songs = [
    hit('1', 'Kooh', 'Googoosh'),
    hit('2', 'Kooh', 'Other Singer'),
    hit('3', 'Different', 'Googoosh'),
  ]
  expect(rankSongs(songs, 'kooh goo').map((s) => s.id)).toEqual(['1'])
  expect(rankSongs(songs, 'kooh googoosh').map((s) => s.id)).toEqual(['1'])
  expect(rankSongs(songs, 'کوه گوگوش').map((s) => s.id)).toEqual(['1'])
  expect(rankSongs(songs, 'kooh go')).toEqual([])
  expect(queryVariants('kooh goo')).toContain('kooh')
})
it('retrieves partial artist matches through bounded title fallback', async () => {
  vi.resetModules()
  const { searchSongs } = await import('../worker/search')
  const requests: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requests.push(url)
      return Response.json(
        new URL(url).searchParams.get('q') === 'kooh'
          ? [{ id: 1, trackName: 'Kooh', artistName: 'Googoosh', plainLyrics: 'سلام' }]
          : [],
      )
    }),
  )
  const result = await searchSongs('kooh goo', new AbortController().signal)
  expect(result.songs.map((s) => s.title)).toEqual(['Kooh'])
  expect(requests).toHaveLength(2)
})
it('stops retrying unreachable LRCLIB and returns a visible notice without caching the outage', async () => {
  vi.resetModules()
  const { searchApi } = await import('../worker/search')
  const remote = vi.fn(async () => {
    throw new TypeError('Network unavailable')
  })
  vi.stubGlobal('fetch', remote)
  const request = new Request('https://app.test/api/search?q=kooh%20goo')
  const first = await (await searchApi(request)).json()
  expect(first.songs).toEqual([])
  expect(first.notice).toContain('unavailable')
  expect(remote).toHaveBeenCalledTimes(2) // one LRCLIB and one alternate, no keyword retry loop
  await searchApi(request)
  expect(remote).toHaveBeenCalledTimes(4)
})

it('one stalled request does not hold up the next search or health check', async () => {
  vi.resetModules()
  const { searchApi } = await import('../worker/search')
  const controller = new AbortController()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('q=stalled')) return new Promise<Response>(() => {})
      return Response.json([
        { id: 13708175, trackName: 'Del Bordi', artistName: 'Shajarian', plainLyrics: 'سلام' },
      ])
    }),
  )
  const stuck = searchApi(
    new Request('https://app.test/api/search?q=stalled', { signal: controller.signal }),
  )
  const next = await searchApi(new Request('https://app.test/api/search?q=del%20bordi'))
  expect((await next.json()).songs).toHaveLength(1)
  const check = await searchApi(new Request('https://app.test/api/lyrics-health'))
  expect((await check.json()).reachable).toBe(true)
  expect(check.headers.get('cache-control')).toBe('no-store')
  controller.abort()
  await stuck
})
it('a health check validates the actual uncached LRCLIB response, including a body that never finishes', async () => {
  vi.resetModules()
  const { searchApi } = await import('../worker/search')
  vi.useFakeTimers()
  const remote = vi.fn(
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode('['))
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
  )
  vi.stubGlobal('fetch', remote)
  const check = searchApi(new Request('https://app.test/api/lyrics-health'))
  await vi.advanceTimersByTimeAsync(5001)
  expect((await (await check).json()).reachable).toBe(false)
  remote.mockImplementation(async () => Response.json([]))
  expect(
    (await (await searchApi(new Request('https://app.test/api/lyrics-health'))).json()).reachable,
  ).toBe(true)
  expect(remote).toHaveBeenCalledTimes(2)
})

it('omits empty, whitespace-only, missing and non-Persian alternate lyrics', async () => {
  vi.resetModules()
  const { searchSongs } = await import('../worker/search')
  const bodies: Record<string, unknown> = {
    A: { lyrics: '' },
    B: { lyrics: '   ' },
    C: {},
    D: { lyrics: 'English' },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('lrclib')) return Response.json([])
      if (url.includes('/suggest/'))
        return Response.json({
          data: Object.keys(bodies).map((name, i) => ({
            id: i + 1,
            title: 'Song',
            artist: { name },
          })),
        })
      const name = decodeURIComponent(url.split('/v1/')[1].split('/')[0])
      return Response.json(bodies[name])
    }),
  )
  expect((await searchSongs('song', new AbortController().signal)).songs).toEqual([])
})
