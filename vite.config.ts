import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import packageInfo from './package.json'

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(packageInfo.version) },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'sleeve.svg'],
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
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
