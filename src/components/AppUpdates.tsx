import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { RefreshCw, X } from 'lucide-react'

const UpdateContext = createContext({
  check: () => {},
  checking: false,
  message: '',
  supported: false,
})

export function AppUpdates({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')
  const [supported, setSupported] = useState(false)
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const reloadRequested = useRef(false)
  const checkRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let alive = true
    let lastCheck = 0
    const cleanups: (() => void)[] = []
    const announce = () => {
      if (alive) {
        setAvailable(true)
        setDismissed(false)
        setMessage('Update available')
      }
    }
    const observe = (worker: ServiceWorker) => {
      const changed = () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) announce()
      }
      worker.addEventListener('statechange', changed)
      cleanups.push(() => worker.removeEventListener('statechange', changed))
      changed()
    }
    const check = async (manual = false) => {
      if (!registration.current || (!manual && Date.now() - lastCheck < 30_000)) return
      if (!navigator.onLine) {
        if (manual) setMessage('Offline — check when connected')
        return
      }
      lastCheck = Date.now()
      if (manual) {
        setChecking(true)
        setMessage('')
      }
      try {
        await registration.current.update()
        if (!alive) return
        if (registration.current.waiting) announce()
        else if (manual) setMessage('Update check complete')
      } catch {
        if (alive && manual) setMessage('Could not check. Try again.')
      } finally {
        if (alive && manual) setChecking(false)
      }
    }
    checkRef.current = () => {
      void check(true)
    }
    const visible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    const online = () => {
      void check()
    }
    const controlled = () => {
      if (reloadRequested.current) window.location.reload()
      else if (registration.current?.active && navigator.serviceWorker.controller) {
        // First installation needs no reload. An activated update in another tab does.
        if (hadController) announce()
        hadController = true
      }
    }
    let hadController = Boolean(navigator.serviceWorker.controller)
    navigator.serviceWorker.addEventListener('controllerchange', controlled)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('online', online)
    window.addEventListener('hamava:online', online)
    window.addEventListener('focus', visible)
    const interval = window.setInterval(visible, 60_000)
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        if (!alive) return
        registration.current = reg
        setSupported(true)
        const found = () => {
          if (reg.installing) observe(reg.installing)
        }
        reg.addEventListener('updatefound', found)
        cleanups.push(() => reg.removeEventListener('updatefound', found))
        if (reg.waiting) announce()
        if (reg.installing) observe(reg.installing)
        void check()
      })
      .catch(() => {
        if (alive) setMessage('Update service unavailable')
      })
    return () => {
      alive = false
      cleanups.forEach((cleanup) => cleanup())
      clearInterval(interval)
      navigator.serviceWorker.removeEventListener('controllerchange', controlled)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('online', online)
      window.removeEventListener('hamava:online', online)
      window.removeEventListener('focus', visible)
    }
  }, [])

  const apply = () => {
    if (registration.current?.waiting) {
      reloadRequested.current = true
      registration.current.waiting.postMessage({ type: 'SKIP_WAITING' })
    } else window.location.reload()
  }
  return (
    <UpdateContext.Provider
      value={{ check: () => checkRef.current(), checking, message, supported }}
    >
      {children}
      {available && !dismissed && (
        <aside className="app-update-banner" role="alert" aria-label="App update">
          <RefreshCw size={18} />
          <div>
            <strong>A new version is ready</strong>
            <span>Reload when you’re ready. Downloaded model files stay on this device.</span>
          </div>
          <button className="update-apply" onClick={apply}>
            Reload app
          </button>
          <button
            className="icon-button"
            aria-label="Remind me later"
            onClick={() => setDismissed(true)}
          >
            <X size={17} />
          </button>
        </aside>
      )}
    </UpdateContext.Provider>
  )
}

export function UpdateCheck() {
  const { check, checking, message, supported } = useContext(UpdateContext)
  return (
    <div className="update-check">
      <span>v{__APP_VERSION__}</span>
      <button onClick={check} disabled={checking || !supported}>
        {checking ? 'Checking…' : 'Check for updates'}
      </button>
      {message && <span className="update-check-message">{message}</span>}
      <a href="/api/app-update">Repair app cache</a>
    </div>
  )
}
