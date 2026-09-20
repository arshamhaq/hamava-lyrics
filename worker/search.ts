import { withDeadline } from '../shared/deadline'
import {
  normalizeQuery,
  aliasQuery,
  queryVariants,
  rankSongs,
  type SongHit,
  type SongText,
  type SearchResult,
} from '../shared/search'

class ProviderError extends Error {
  constructor(
    message: string,
    public status = 502,
    public retryAfter?: string,
  ) {
    super(message)
  }
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const cooldowns = new Map<string, number>()
async function providerJson(url: string, signal: AbortSignal): Promise<any> {
  // All live I/O belongs to this request. Only plain cooldown/cache data is shared.
  const host = new URL(url).host
  return withDeadline(
    async (signal) => {
      signal.throwIfAborted()
      const wait = (cooldowns.get(host) || 0) - Date.now()
      if (wait > 0)
        throw new ProviderError(
          'The lyrics provider is busy. Please try again later.',
          429,
          String(Math.ceil(wait / 1000)),
        )
      signal.throwIfAborted()
      const response = await fetch(url, {
        signal,
        headers: {
          'User-Agent': 'Hamava/0.7 (https://hamava-lyrics.arshamhaqiqat.workers.dev)',
          Accept: 'application/json',
        },
      })
      if (response.status === 429) {
        const raw = response.headers.get('Retry-After') || '60'
        const seconds = /^\d+$/.test(raw)
          ? Number(raw)
          : Math.max(1, (Date.parse(raw) - Date.now()) / 1000) || 60
        cooldowns.set(host, Date.now() + seconds * 1000)
        throw new ProviderError(
          'The lyrics provider is busy. Please try again later.',
          429,
          String(Math.ceil(seconds)),
        )
      }
      if (!response.ok)
        throw new ProviderError(
          response.status === 404
            ? 'No lyrics found for this recording.'
            : 'The lyrics provider is unavailable. Please retry.',
          response.status === 404 ? 404 : 502,
        )
      // Bound untrusted upstream payloads before parsing.
      const reader = response.body?.getReader()
      if (!reader) throw new ProviderError('The lyrics provider returned an empty response.')
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 2_000_000) {
          await reader.cancel()
          throw new ProviderError('The lyrics response was too large.')
        }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      return JSON.parse(new TextDecoder().decode(bytes))
    },
    signal,
    5000,
  )
}

const text = (v: unknown) => (typeof v === 'string' ? v : '')
const duration = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
const persian = (v: string) =>
  /[\u0621-\u063a\u0641-\u064a\u067e\u0686\u0698\u06a9\u06af\u06cc]/.test(v)
export function plainText(record: any) {
  if (typeof record.plainLyrics === 'string' && record.plainLyrics.trim())
    return record.plainLyrics.trim()
  return text(record.syncedLyrics)
    .split(/\r?\n/)
    .filter((line) => /^\s*\[\d+:\d+/.test(line))
    .map((line) => line.replace(/\[\d+:\d+(?:[.:]\d+)?\]/g, '').trim())
    .filter(Boolean)
    .join('\n')
}
export async function searchSongs(query: string, signal: AbortSignal): Promise<SearchResult> {
  const hits: SongHit[] = []
  let notice = ''
  let first = true
  for (const variant of queryVariants(query)) {
    if (!first) await pause(250)
    first = false
    signal.throwIfAborted()
    try {
      const data = await providerJson(
        `https://lrclib.net/api/search?q=${encodeURIComponent(variant)}`,
        signal,
      )
      notice = ''
      if (!Array.isArray(data))
        throw new ProviderError('LRCLIB returned an invalid search response.')
      for (const r of data.slice(0, 100)) {
        if (!Number.isSafeInteger(r?.id) || r.id <= 0 || r.instrumental) continue
        const lyrics = plainText(r)
        // This route is Persian-to-Finglish. A catalog hit is not confirmed Persian lyrics.
        if (lyrics && !persian(lyrics)) continue
        hits.push({
          provider: 'lrclib',
          id: String(r.id),
          title: text(r.trackName),
          artist: text(r.artistName),
          album: text(r.albumName),
          duration: duration(r.duration),
          hasLyrics: Boolean(lyrics),
        })
      }
      if (rankSongs(hits, query).some((h) => h.hasLyrics)) break
    } catch (error) {
      if (signal.aborted || (error instanceof ProviderError && error.status === 429)) throw error
      notice = 'LRCLIB could not be reached. Showing alternate matches if available.'
      // Different keywords cannot repair a failed connection. Try the alternate
      // provider once, rather than spending the deadline retrying LRCLIB.
      break
    }
  }
  let songs = rankSongs(hits, query)
  if (!songs.some((h) => h.hasLyrics)) {
    try {
      const q = aliasQuery(query) || query
      const data = await providerJson(
        `https://api.lyrics.ovh/suggest/${encodeURIComponent(q)}`,
        signal,
      )
      if (!Array.isArray(data?.data)) throw new ProviderError('Alternate search is unavailable.')
      for (const r of data.data.slice(0, 30)) {
        if (!Number.isSafeInteger(r?.id) || !text(r.title) || !text(r.artist?.name)) continue
        hits.push({
          provider: 'ovh',
          id: String(r.id),
          title: r.title,
          artist: r.artist.name,
          album: text(r.album?.title),
          duration: duration(r.duration),
          hasLyrics: false,
        })
      }
      songs = rankSongs(hits, query)
    } catch (error) {
      if (signal.aborted) throw error
      notice = notice
        ? 'Lyrics services are unavailable. Retry later or paste Persian lyrics.'
        : 'Alternate search is unavailable. You can also paste Persian lyrics.'
    }
  }
  return { songs, ...(notice ? { notice } : {}) }
}
export async function loadSong(params: URLSearchParams, signal: AbortSignal): Promise<SongText> {
  const provider = params.get('provider')
  let title: string,
    artist: string,
    album = '',
    seconds: number | null = null,
    lyrics = '',
    source: string,
    sourceUrl: string
  if (provider === 'lrclib') {
    const id = params.get('id') || ''
    if (!/^[1-9]\d{0,14}$/.test(id) || !Number.isSafeInteger(Number(id)))
      throw new ProviderError('Invalid song ID.', 400)
    const url = `https://lrclib.net/api/get/${id}`
    const r = await providerJson(url, signal)
    if (r?.id !== Number(id))
      throw new ProviderError('The returned song does not match your selection.')
    title = text(r.trackName)
    artist = text(r.artistName)
    album = text(r.albumName)
    seconds = duration(r.duration)
    lyrics = plainText(r)
    source = 'LRCLIB'
    sourceUrl = url
    if (r.instrumental) throw new ProviderError('This recording is instrumental.', 404)
  } else if (provider === 'ovh') {
    title = (params.get('title') || '').trim()
    artist = (params.get('artist') || '').trim()
    if (!title || !artist || title.length > 200 || artist.length > 200)
      throw new ProviderError('Choose a song with a title and artist.', 400)
    source = 'lyrics.ovh'
    sourceUrl = 'https://lyrics.ovh/'
  } else throw new ProviderError('Unknown lyrics provider.', 400)
  // Lookup fallback is only one request for the selected title, never for every suggestion.
  if (!lyrics || !persian(lyrics)) {
    if (!title || !artist)
      throw new ProviderError(
        'This record has no lyrics. Try another version or paste the Persian text.',
        404,
      )
    const r = await providerJson(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
      signal,
    )
    lyrics = text(r?.lyrics)
    source = 'lyrics.ovh'
    sourceUrl = 'https://lyrics.ovh/'
  }
  if (!lyrics.trim() || !persian(lyrics))
    throw new ProviderError(
      'No Persian lyrics were found. Try another version or paste the Persian text.',
      404,
    )
  if (lyrics.length > 100_000) throw new ProviderError('These lyrics are too long to load.', 422)
  return { title, artist, album, duration: seconds, text: lyrics, source, sourceUrl }
}
const memory = new Map<string, { expires: number; body: string }>()
export async function searchApi(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (request.method !== 'GET')
    return Response.json({ error: 'Use GET.' }, { status: 405, headers: { Allow: 'GET' } })
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }
  try {
    if (url.pathname === '/api/search') {
      const q = normalizeQuery(url.searchParams.get('q') || '')
      if (q.length < 2 || q.length > 120)
        throw new ProviderError('Search with 2–120 characters.', 400)
      url.search = new URLSearchParams({ q }).toString()
    }
    if (url.pathname === '/api/lyrics-health') {
      const checkedAt = Date.now()
      try {
        const data = await providerJson(
          'https://lrclib.net/api/search?q=del%20bordi',
          request.signal,
        )
        if (!Array.isArray(data)) throw new Error('Invalid LRCLIB response')
        return Response.json(
          { reachable: true, checkedAt, elapsedMs: Date.now() - checkedAt },
          { headers },
        )
      } catch (error) {
        return Response.json(
          {
            reachable: false,
            checkedAt,
            reason: error instanceof ProviderError && error.status === 429 ? 'busy' : 'unavailable',
            retryAfter: error instanceof ProviderError ? error.retryAfter : undefined,
          },
          { headers },
        )
      }
    }
    const key = `${url.pathname}${url.search}`
    const cached = memory.get(key)
    if (cached && cached.expires > Date.now())
      return new Response(cached.body, {
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    const result = await withDeadline<SearchResult | SongText>(
      (signal) =>
        url.pathname === '/api/search'
          ? searchSongs(url.searchParams.get('q')!, signal)
          : loadSong(url.searchParams, signal),
      request.signal,
      12000,
    )
    const body = JSON.stringify(result)
    // Do not cache temporary provider errors or ambiguous empty results.
    if (!('songs' in result) || (result.songs.length && !result.notice)) {
      if (memory.size >= 100) memory.delete(memory.keys().next().value!)
      memory.set(key, { body, expires: Date.now() + 300_000 })
    }
    return new Response(body, { headers: { ...headers, 'Content-Type': 'application/json' } })
  } catch (error) {
    const known = error instanceof ProviderError
    if (known && error.retryAfter) headers['Retry-After'] = error.retryAfter
    return Response.json(
      { error: known ? error.message : 'Lyrics could not load. Check your connection and retry.' },
      { status: known ? error.status : 502, headers },
    )
  }
}
