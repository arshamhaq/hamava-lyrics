import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import packageInfo from './package.json'
import type { IncomingMessage, ServerResponse } from 'node:http'

function localConnectivity(request: IncomingMessage, response: ServerResponse, next: () => void) {
  if (request.url?.split('?')[0] !== '/api/connectivity') {
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
        background_color: '#f7f5f2',
        theme_color: '#f7f5f2',
        icons: [
          { src: '/hamava-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/hamava-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/hamava-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/update.html'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Never cache auth callbacks or future personalized API responses.
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/update\.html$/],
      },
    }),
  ],
})
