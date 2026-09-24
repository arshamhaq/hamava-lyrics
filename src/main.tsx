import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import App from './App'
import { AppUpdates } from './components/AppUpdates'
import { ConnectivityNotice } from './components/ConnectivityNotice'
import './styles.css'
import './experience.css'

const SpotifyPage = lazy(() => import('./SpotifyPage'))
const SearchPage = React.lazy(() => import('./SearchPage'))
const G2PTest = lazy(() => import('./G2PTest'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppUpdates>
      <ConnectivityNotice />
      {['/spotify', '/spotify/callback'].includes(location.pathname) ? (
        <Suspense fallback={<p style={{ padding: 32 }}>Opening Spotify…</p>}>
          <SpotifyPage />
        </Suspense>
      ) : ['/search', '/paste'].includes(location.pathname) ? (
        <Suspense fallback={<p style={{ padding: 32 }}>Opening search…</p>}>
          <SearchPage />
        </Suspense>
      ) : ['/g2p', '/lyrics'].includes(location.pathname) ||
        new URLSearchParams(location.search).has('live') ? (
        <Suspense fallback={<p style={{ padding: 32 }}>Opening the browser test…</p>}>
          <G2PTest />
        </Suspense>
      ) : (
        <App />
      )}
    </AppUpdates>
  </React.StrictMode>,
)
