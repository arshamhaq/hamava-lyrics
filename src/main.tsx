import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'
import App from './App'
import LiveTest from './LiveTest'
import { AppUpdates } from './components/AppUpdates'
import { ConnectivityNotice } from './components/ConnectivityNotice'
import './styles.css'
import './experience.css'

const G2PTest = lazy(() => import('./G2PTest'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppUpdates>
      <ConnectivityNotice />
      {location.pathname === '/g2p' ? (
        <Suspense fallback={<p style={{ padding: 32 }}>Opening the browser test…</p>}>
          <G2PTest />
        </Suspense>
      ) : new URLSearchParams(location.search).has('live') ? (
        <LiveTest />
      ) : (
        <App />
      )}
    </AppUpdates>
  </React.StrictMode>,
)
