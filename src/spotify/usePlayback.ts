import { useCallback, useEffect, useRef, useState } from 'react'
import { spotifyRequest, SpotifyError, type Playback } from './client'

export function playbackPosition(
  state: Playback | null,
  sampledAt: number,
  now: number,
  moving: boolean,
) {
  if (!state?.item || state.progress_ms === null) return 0
  return Math.min(
    state.item.duration_ms,
    Math.max(
      0,
      state.progress_ms + (moving && state.is_playing ? Math.max(0, now - sampledAt) : 0),
    ),
  )
}
export function usePlayback(enabled: boolean) {
  const [state, setState] = useState<Playback | null>(null)
  const [position, setPosition] = useState(0)
  const [error, setError] = useState('')
  const [controlError, setControlError] = useState('')
  const revision = useRef(0)
  const [fatal, setFatal] = useState(false)
  const [premiumRequired, setPremiumRequired] = useState(false)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const snapshot = useRef<{ state: Playback | null; at: number; moving: boolean }>({
    state: null,
    at: 0,
    moving: false,
  })
  const refresh = useRef<() => void>(() => {})
  const command = useRef<AbortController | null>(null)
  useEffect(() => {
    setState(null)
    setPosition(0)
    setError('')
    setControlError('')
    setBusy(false)
    setFatal(false)
    setPremiumRequired(false)
    snapshot.current = { state: null, at: performance.now(), moving: false }
    if (!enabled) return
    let disposed = false,
      request: AbortController | null = null,
      timer: ReturnType<typeof setTimeout>,
      stopped = false,
      urgent = false
    const freeze = () => {
      const s = snapshot.current
      if (s.state)
        s.state = {
          ...s.state,
          progress_ms: playbackPosition(s.state, s.at, performance.now(), s.moving),
        }
      s.moving = false
      setPosition(s.state?.progress_ms || 0)
    }
    const poll = async () => {
      clearTimeout(timer)
      if (disposed || stopped || document.hidden || request || command.current) return
      request = new AbortController()
      urgent = false
      const own = request
      const version = revision.current
      let delay = 3000
      try {
        const data = await spotifyRequest<Playback>('/me/player', own.signal)
        if (disposed || own.signal.aborted || version !== revision.current) return
        if (
          data &&
          (!data.item ||
            data.item.type !== 'track' ||
            data.currently_playing_type !== 'track' ||
            data.item.is_local ||
            data.device?.is_private_session ||
            !Number.isFinite(data.item.duration_ms) ||
            !Number.isFinite(data.progress_ms) ||
            !data.item.id ||
            !Array.isArray(data.item.artists) ||
            !data.item.album)
        ) {
          snapshot.current = { state: null, at: performance.now(), moving: false }
          setState(null)
          setPosition(0)
          setError(
            'Play a music track in Spotify. Podcasts, ads, local files and private sessions cannot be synced.',
          )
          delay = 5000
        } else {
          snapshot.current = { state: data, at: performance.now(), moving: true }
          setState(data)
          setPosition(data?.progress_ms || 0)
          setError('')
          delay = data?.is_playing ? 3000 : 5000
        }
      } catch (e) {
        if (disposed || own.signal.aborted || version !== revision.current) return
        freeze()
        setError(e instanceof Error ? e.message : 'Spotify could not be reached.')
        if (e instanceof SpotifyError && [400, 401, 403].includes(e.status)) {
          stopped = true
          setFatal(true)
          setPremiumRequired(e.reason === 'PREMIUM_REQUIRED')
        }
        delay =
          e instanceof SpotifyError && e.retryAt ? Math.max(1000, e.retryAt - Date.now()) : 10000
      } finally {
        request = null
        if (!disposed && !stopped) timer = setTimeout(poll, urgent ? 0 : delay)
      }
    }
    const resume = () => {
      if (document.hidden) {
        clearTimeout(timer)
        request?.abort()
        freeze()
      } else {
        stopped = false
        setFatal(false)
        void poll()
      }
    }
    refresh.current = () => {
      urgent = true
      stopped = false
      setFatal(false)
      void poll()
    }
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    void poll()
    const ticker = setInterval(() => {
      const s = snapshot.current
      if (!document.hidden)
        setPosition(playbackPosition(s.state, s.at, performance.now(), s.moving))
    }, 100)
    return () => {
      disposed = true
      request?.abort()
      command.current?.abort()
      command.current = null
      clearTimeout(timer)
      clearInterval(ticker)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('online', resume)
      refresh.current = () => {}
    }
  }, [enabled, retry])
  const control = useCallback(
    async (kind: 'seek' | 'toggle', ms?: number) => {
      const s = snapshot.current.state
      if (!s?.item || command.current || !enabled) return
      const disallows = s.actions?.disallows || {}
      if (
        s.device?.is_restricted ||
        disallows[kind === 'seek' ? 'seeking' : s.is_playing ? 'pausing' : 'resuming']
      ) {
        setControlError(
          'This Spotify device does not allow that control. Use Spotify to change playback.',
        )
        return
      }
      const controller = new AbortController()
      command.current = controller
      revision.current++
      setControlError('')
      setBusy(true)
      try {
        const latest = await spotifyRequest<Playback>('/me/player', controller.signal)
        if (latest?.item?.id !== s.item.id)
          throw new Error('The song changed. Try the control again for the current song.')
        const device = s.device?.id ? `device_id=${encodeURIComponent(s.device.id)}` : ''
        const path =
          kind === 'seek'
            ? `/me/player/seek?position_ms=${Math.round(Math.max(0, Math.min(ms!, s.item.duration_ms - 1)))}&${device}`
            : `/me/player/${s.is_playing ? 'pause' : 'play'}?${device}`
        await spotifyRequest(path, controller.signal, 'PUT')
        // Spotify is authoritative: resample after commands instead of assuming they applied.
        if (!controller.signal.aborted) setControlError('')
      } catch (e) {
        if (!controller.signal.aborted)
          setControlError(e instanceof Error ? e.message : 'Playback control failed.')
      } finally {
        if (command.current === controller) {
          command.current = null
          setBusy(false)
          refresh.current()
        }
      }
    },
    [enabled],
  )
  return {
    state,
    fatal,
    premiumRequired,
    error: error || controlError,
    refresh: () => refresh.current(),
    retry: () => setRetry((n) => n + 1),
    player: {
      syncAvailable: !error && !fatal && snapshot.current.moving,
      positionMs: position,
      durationMs: state?.item?.duration_ms || 0,
      playing: !!state?.is_playing && snapshot.current.moving,
      buffering: busy,
      error: '',
      seek: (ms: number) => void control('seek', ms),
      toggle: () => void control('toggle'),
    },
  }
}
