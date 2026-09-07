import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'sleeve.svg'],
      manifest: {
        id: '/',
        name: 'Hamava — Persian lyrics in Finglish',
        short_name: 'Hamava',
        description: 'A little closer to your favorite Persian songs.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f5f3ed',
        theme_color: '#f5f3ed',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Never cache auth callbacks or future personalized API responses.
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
      },
    }),
  ],
})
