import { afterEach, describe, expect, it, vi } from 'vitest'
import { lyricsChoice, rankChoices, type TrackQuery } from '../shared/spotify'
import { playbackPosition } from '../src/spotify/usePlayback'
import { matchSpotifyLyrics, searchApi } from '../worker/search'
import type { Playback } from '../src/spotify/client'

const track: TrackQuery = {
  title: 'Monge (guitar Version)',
  artist: 'Heydoo Hedayati',
  album: 'Monge',
  durationMs: 153652,
}
const record = {
  id: 1,
  trackName: track.title,
  artistName: track.artist,
  albumName: track.album,
  duration: 153.3,
  plainLyrics: 'سلام\nخداحافظ',
  syncedLyrics: '[00:01.00] سلام\n[00:03.00] خداحافظ\n[02:22.00] ',
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('recording matching', () => {
  it('prefers the right arrangement over same-duration studio lyrics; rejects other artists', () => {
    const result = rankChoices(
      [
        { ...record, id: 2, trackName: 'Monge', plainLyrics: 'متن متفاوت' },
        record,
        { ...record, id: 3, artistName: 'Someone else' },
      ],
      track,
    )
    expect(result.map((c) => c.id)).toEqual(['lrclib:1', 'lrclib:2'])
    expect(result[0].closeMatch).toBe(true)
    expect(result[1].closeMatch).toBe(false)
  })
  it('prefers valid timed lyrics, collapses duplicates and keeps plain fallback for malformed timing', () => {
    const result = rankChoices(
      [{ ...record, id: 2, syncedLyrics: null }, record, { ...record, id: 3 }],
      track,
    )
    expect(result).toHaveLength(2)
    expect(result[0].timedLines).not.toBeNull()
    expect(
      lyricsChoice({ ...record, syncedLyrics: 'bad timestamps' }, track)?.timedLines,
    ).toBeNull()
    expect(lyricsChoice({ ...record, duration: 190 }, track)?.timedLines).toBeNull()
    expect(lyricsChoice({ ...record, plainLyrics: '', syncedLyrics: '' }, track)).toBeNull()
  })
  it('preserves blank markers, accepts rounded trailing blanks and rejects sung lines beyond the recording', () => {
    const choice = lyricsChoice(
      { ...record, syncedLyrics: record.syncedLyrics + '\n[02:35.19] ' },
      track,
    )!
    expect(choice.timedLines?.map((l) => l.startMs)).toEqual([1000, 3000, 142000])
    expect(choice.timedLines?.at(-1)?.endMs).toBe(track.durationMs)
    expect(
      lyricsChoice({ ...record, syncedLyrics: '[02:35.19] سلام' }, track)?.timedLines,
    ).toBeNull()
  })
  it('matches title aliases without losing the artist requirement', () => {
    expect(
      lyricsChoice(
        { ...record, trackName: 'Tasnife Del Bordi', artistName: 'Mohammad Reza Shajarian' },
        { ...track, title: 'Del Bordi', artist: 'Mohammad Reza Shajarian' },
      )?.closeMatch,
    ).toBe(true)
  })
})
it('the playback clock follows pauses, seek snapshots and track duration', () => {
  const p = { item: { duration_ms: 10000 }, progress_ms: 2000, is_playing: true } as Playback
  expect(playbackPosition(p, 100, 1100, true)).toBe(3000)
  expect(playbackPosition({ ...p, is_playing: false }, 100, 1100, true)).toBe(2000)
  expect(playbackPosition(p, 100, 1100, false)).toBe(2000)
  expect(playbackPosition(p, 100, 50000, true)).toBe(10000)
  expect(playbackPosition({ ...p, progress_ms: 500 }, 100, 200, true)).toBe(600)
})
describe('lyrics gateway', () => {
  const params = () => new URLSearchParams({ ...track, durationMs: String(track.durationMs) })
  it('queries exact metadata and a bounded search without sending Spotify credentials', async () => {
    const remote = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async (input) =>
          new Response(JSON.stringify(String(input).includes('/search?') ? [record] : record)),
      )
    const result = await matchSpotifyLyrics(params(), new AbortController().signal)
    expect(result.choices).toHaveLength(1)
    expect(remote).toHaveBeenCalledTimes(2)
    expect(
      remote.mock.calls.every(([url]) => String(url).startsWith('https://lrclib.net/api/')),
    ).toBe(true)
  })
  it('uses a title-only fallback and can return only untimed text', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      return new Response(
        JSON.stringify(
          url.includes('/get?')
            ? {}
            : url.includes('q=')
              ? [{ ...record, syncedLyrics: null }]
              : [],
        ),
        { status: url.includes('/get?') ? 404 : 200 },
      )
    })
    expect(
      (await matchSpotifyLyrics(params(), new AbortController().signal)).choices[0].timedLines,
    ).toBeNull()
  })
  it('rejects invalid metadata before touching providers', async () => {
    const remote = vi.spyOn(globalThis, 'fetch')
    expect(
      (await searchApi(new Request('https://app.test/api/spotify-lyrics?durationMs=NaN'))).status,
    ).toBe(400)
    expect(remote).not.toHaveBeenCalled()
  })
  it('reports unavailable services, rather than pretending no matches exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }))
    await expect(matchSpotifyLyrics(params(), new AbortController().signal)).rejects.toThrow(
      'could not be reached',
    )
  })
})
function storage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) || null,
    setItem: (k: string, v: string) => m.set(k, v),
    removeItem: (k: string) => m.delete(k),
  }
}
const clientId = 'a'.repeat(32)
async function client() {
  vi.resetModules()
  vi.stubGlobal('sessionStorage', storage())
  vi.stubGlobal('localStorage', storage())
  vi.stubGlobal('location', {
    origin: 'https://app.test',
    hostname: 'app.test',
    protocol: 'https:',
    search: '',
  })
  vi.stubGlobal('history', { replaceState: vi.fn() })
  return import('../src/spotify/client')
}
describe('Spotify authentication and rate limits', () => {
  it('generates PKCE S256, state, exact callback and minimal scopes without a secret', async () => {
    const c = await client()
    const url = new URL(await c.authorizationUrl(clientId))
    expect(url.origin).toBe('https://accounts.spotify.com')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/spotify/callback')
    expect(url.searchParams.get('state')).toHaveLength(64)
    expect(url.searchParams.has('client_secret')).toBe(false)
    expect(url.searchParams.get('scope')).not.toContain('email')
    expect(url.searchParams.get('scope')).not.toContain('streaming')
  })
  it('rejects callback state mismatch without sending the authorization code', async () => {
    const c = await client()
    await c.authorizationUrl(clientId)
    vi.stubGlobal('location', {
      origin: 'https://app.test',
      search: '?code=private-code&state=wrong',
    })
    const remote = vi.spyOn(globalThis, 'fetch')
    await expect(c.finishSpotifyLogin()).rejects.toThrow('could not be verified')
    expect(remote).not.toHaveBeenCalled()
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/spotify')
  })
  it('exchanges the code once, refreshes without losing a refresh token, and disconnects', async () => {
    const c = await client()
    const url = new URL(await c.authorizationUrl(clientId))
    vi.stubGlobal('location', {
      origin: 'https://app.test',
      search: `?code=code&state=${url.searchParams.get('state')}`,
    })
    const remote = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({ access_token: 'first', refresh_token: 'refresh', expires_in: 1 }),
      )
      .mockResolvedValueOnce(Response.json({ access_token: 'second', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ product: 'premium' }))
    await Promise.all([c.finishSpotifyLogin(), c.finishSpotifyLogin()])
    expect(remote).toHaveBeenCalledTimes(1)
    await c.spotifyRequest('/me', new AbortController().signal)
    expect((remote.mock.calls[2][1]?.headers as Record<string, string>).Authorization).toBe(
      'Bearer second',
    )
    expect(JSON.parse(sessionStorage.getItem('hamava-spotify-session-v1')!).refresh).toBe('refresh')
    c.disconnectSpotify()
    expect(c.hasSession()).toBe(false)
  })
  it('distinguishes known Free from missing product and honors Retry-After', async () => {
    const c = await client()
    expect(c.subscription({ product: 'free' })).toBe('free')
    expect(c.subscription({})).toBe('unknown')
    sessionStorage.setItem(
      'hamava-spotify-session-v1',
      JSON.stringify({
        access: 'token',
        refresh: 'refresh',
        expires: Date.now() + 3600000,
        clientId,
      }),
    )
    const remote = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ error: {} }, { status: 429, headers: { 'Retry-After': '30' } }),
      )
    await expect(
      c.spotifyRequest('/me/player', new AbortController().signal),
    ).rejects.toMatchObject({ status: 429 })
    await expect(
      c.spotifyRequest('/me/player', new AbortController().signal),
    ).rejects.toMatchObject({ status: 429 })
    expect(remote).toHaveBeenCalledTimes(1)
  })
})

describe('conversion keeps the lyric clock outside model inputs', () => {
  it('splits long inputs on word boundaries without dropping words', async () => {
    const { splitForInference } = await import('../src/spotify/lyrics')
    const text = Array(120).fill('سلام دوست من').join(' ')
    const parts = splitForInference(text)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((p) => new TextEncoder().encode(p).length <= 480)).toBe(true)
    expect(parts.join(' ')).toBe(text)
  })
  it('rejoins model fragments under their original source timing and retains blank markers', async () => {
    const { lyricsEngine } = await import('../src/g2p/engine')
    const { convertChoice } = await import('../src/spotify/lyrics')
    const source = lyricsChoice(record, track)!
    const convert = vi
      .spyOn(lyricsEngine, 'convert')
      .mockImplementation(async (rows: any, options: any) => {
        rows.forEach((row: any, index: number) =>
          options.onLine({ ...row, raw: 'test', finglish: 'salam' }, index),
        )
        return { lines: rows, stats: {} } as any
      })
    const rows = await convertChoice(
      source,
      new AbortController().signal,
      () => {},
      () => {},
    )
    expect(rows.map((r) => r.startMs)).toEqual([1000, 3000, 142000])
    expect(rows[2].finglish).toBe('')
    expect(convert.mock.calls[0][0].every((l) => !('startMs' in l))).toBe(true)
  })
})
