import { useEffect, useRef, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import './ConnectivityNotice.css'
import { withDeadline } from '../../shared/deadline'
import { api } from '../search/client'

export function ConnectivityNotice() {
  const [state, setState] = useState(navigator.onLine ? 'online' : 'offline')
  const [checking, setChecking] = useState(false)
  const checkRef = useRef<() => void>(() => {})
  useEffect(() => {
    let alive = true
    let pending: AbortController | undefined
    let lastState = navigator.onLine ? 'online' : 'offline'
    const update = (next: string) => {
      if (!alive) return
      if (next === 'online' && lastState !== 'online')
        window.dispatchEvent(new Event('hamava:online'))
      lastState = next
      setState(next)
    }
    const check = async () => {
      if (!navigator.onLine) {
        update('offline')
        return
      }
      if (pending) return
      pending = new AbortController()
      setChecking(true)
      try {
        const response = await withDeadline(
          (signal) => fetch('/api/connectivity', { cache: 'no-store', signal }),
          pending.signal,
          5000,
        )
        if (response.status !== 204) update('unreachable')
        else {
          const result = await api<{ reachable: boolean; reason?: string }>(
            '/api/lyrics-health',
            pending.signal,
          )
          update(
            result.reachable === true ? 'online' : result.reason === 'busy' ? 'busy' : 'provider',
          )
        }
      } catch {
        update(navigator.onLine ? 'unreachable' : 'offline')
      } finally {
        pending = undefined
        if (alive) setChecking(false)
      }
    }
    checkRef.current = () => {
      void check()
    }
    const offline = () => {
      pending?.abort()
      update('offline')
    }
    const visible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    window.addEventListener('hamava:check-lyrics', visible)
    window.addEventListener('offline', offline)
    window.addEventListener('online', visible)
    document.addEventListener('visibilitychange', visible)
    const interval = window.setInterval(visible, 60_000)
    void check()
    return () => {
      alive = false
      pending?.abort()
      clearInterval(interval)
      window.removeEventListener('hamava:check-lyrics', visible)
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', visible)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  if (state === 'online') return null
  return (
    <aside className="connectivity-banner" role="alert" aria-label="Connection status">
      <WifiOff size={26} />
      <div>
        <strong>
          {state === 'offline'
            ? 'You’re offline'
            : state === 'provider'
              ? 'Hamava can’t reach the lyrics service'
              : state === 'busy'
                ? 'Lyrics service is busy'
                : 'Can’t reach Hamava'}
        </strong>
        <p>
          {state === 'provider' || state === 'busy'
            ? 'Some online lyrics may be unavailable. Saved lyrics still work. Try again shortly.'
            : 'You’re viewing the saved version. New updates and online features need a connection.'}
        </p>
      </div>
      <button onClick={() => checkRef.current()} disabled={checking}>
        <RefreshCw size={16} />
        {checking ? 'Checking…' : 'Try again'}
      </button>
    </aside>
  )
}
