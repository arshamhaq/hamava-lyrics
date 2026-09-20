import { searchApi } from './search'
import type { Env } from './env'
const json = (body: unknown, status: number) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/connectivity' && request.method === 'GET')
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
    if (url.pathname === '/api/app-update' && request.method === 'GET') {
      const asset = await env.ASSETS.fetch(new Request(new URL('/update.html', url.origin)))
      const response = new Response(asset.body, asset)
      response.headers.set('Cache-Control', 'no-store')
      return response
    }
    if (['/api/search', '/api/lyrics', '/api/lyrics-health'].includes(url.pathname))
      return searchApi(request)
    if (['/api/song', '/api/batch'].includes(url.pathname))
      return json(
        {
          error:
            'Server AI conversion has been retired. Reload Hamava and open /lyrics for browser CPU conversion.',
        },
        410,
      )
    if (url.pathname.startsWith('/api/')) return json({ error: 'API route not found.' }, 404)
    return env.ASSETS.fetch(request)
  },
}
