import { defineConfig } from 'vite'
import { searchApi } from './worker/search'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import packageInfo from './package.json'
import type { IncomingMessage, ServerResponse } from 'node:http'

async function localConnectivity(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) {
  const pathname = request.url?.split('?')[0]
  if (['/api/search', '/api/lyrics', '/api/lyrics-health'].includes(pathname || '')) {
    const controller = new AbortController()
    request.on('aborted', () => controller.abort())
    const result = await searchApi(
      new Request(new URL(request.url!, 'http://localhost'), {
        method: request.method,
        signal: controller.signal,
      }),
    )
    response.writeHead(result.status, Object.fromEntries(result.headers))
    response.end(await result.text())
    return
  }
  if (pathname !== '/api/connectivity') {
    next()
    return
  }
  response.writeHead(204, { 'Cache-Control': 'no-store' }).end()
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(packageInfo.version) },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  plugins: [
    {
      name: 'local-connectivity',
      configureServer(server) {
        server.middlewares.use(localConnectivity)
      },
      configurePreviewServer(server) {
        server.middlewares.use(localConnectivity)
      },
    },
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.png', 'hamava-mark.png', 'apple-touch-icon-v2.png', 'sleeve.svg'],
      manifest: {
        id: '/',
        name: 'Hamava — Persian lyrics in Finglish',
        short_name: 'Hamava',
        description: 'Persian lyrics in Finglish.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b1222',
        theme_color: '#0b1222',
        icons: [
          { src: '/hamava-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/hamava-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/hamava-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/update.html', '**/engine-assets/**'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Never cache auth callbacks or future personalized API responses.
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/update\.html$/],
      },
    }),
  ],
})
