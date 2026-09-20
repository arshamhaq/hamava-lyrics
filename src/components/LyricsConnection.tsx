import { useEffect, useState } from 'react'
import { CheckCircle2, WifiOff, LoaderCircle, RefreshCw } from 'lucide-react'
import { api } from '../search/client'
type Health = {
  reachable: boolean
  checkedAt: number
  reason?: 'busy' | 'unavailable'
  retryAfter?: string
}
export function LyricsConnection({ failureKey }: { failureKey: string }) {
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<'checking' | 'ready' | 'provider' | 'app' | 'busy'>('checking')
  const [checked, setChecked] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setState('checking')
    void api<Health>('/api/lyrics-health', controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (typeof result.reachable !== 'boolean' || typeof result.checkedAt !== 'number')
          throw new Error('Invalid check')
        setState(result.reachable ? 'ready' : result.reason === 'busy' ? 'busy' : 'provider')
        setChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState('app')
          setChecked('')
        }
      })
    return () => controller.abort()
  }, [retry, failureKey])
  return (
    <div className={`lyrics-connection connection-${state}`}>
      <div role="status">
        {state === 'checking' ? (
          <LoaderCircle size={17} className="search-spinner" />
        ) : state === 'ready' ? (
          <CheckCircle2 size={17} />
        ) : (
          <WifiOff size={17} />
        )}
        <span>
          {state === 'checking'
            ? 'Checking LRCLIB…'
            : state === 'ready'
              ? `LRCLIB reached · checked ${checked}`
              : state === 'provider'
                ? 'Hamava is reachable, but LRCLIB did not respond successfully.'
                : state === 'busy'
                  ? 'LRCLIB is limiting requests. Please wait before retrying.'
                  : 'Couldn’t reach Hamava to check LRCLIB. Check your connection or VPN.'}
        </span>
      </div>
      <button
        disabled={state === 'checking'}
        onClick={() => setRetry((v) => v + 1)}
        aria-label="Check LRCLIB connection"
      >
        <RefreshCw size={15} />
        Check again
      </button>
    </div>
  )
}
