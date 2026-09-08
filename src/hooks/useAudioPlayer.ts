import { useEffect, useRef, useState } from 'react'

export interface PlayerController {
  positionMs: number
  durationMs: number
  playing: boolean
  buffering: boolean
  error: string
  seek: (ms: number) => void
  toggle: () => void
}

// The media clock is authoritative: buffering, seeking and background tabs must
// never let an independent animation clock run ahead of the actual recording.
export function useAudioPlayer(src: string, expectedDurationMs: number) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const pendingSeek = useRef<number | null>(null)
  const [positionMs, setPosition] = useState(0)
  const [durationMs, setDuration] = useState(expectedDurationMs)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    let frame = 0
    const read = () => {
      if (pendingSeek.current === null) setPosition(audio.currentTime * 1000)
    }
    const tick = () => {
      read()
      frame = requestAnimationFrame(tick)
    }
    const metadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration * 1000)
      if (pendingSeek.current !== null) {
        const target = pendingSeek.current
        pendingSeek.current = null
        audio.currentTime = Math.min(target / 1000, audio.duration)
      }
      read()
    }
    const started = () => {
      setPlaying(true)
      setBuffering(false)
      setError('')
      cancelAnimationFrame(frame)
      tick()
    }
    const paused = () => {
      setPlaying(false)
      setBuffering(false)
      cancelAnimationFrame(frame)
      read()
    }
    const waiting = () => setBuffering(true)
    const seeked = () => {
      setBuffering(false)
      read()
    }
    const failed = () => {
      setError('Audio couldn’t load. Check your connection, then press play to retry.')
      paused()
    }
    const events: [string, () => void][] = [
      ['loadedmetadata', metadata],
      ['durationchange', metadata],
      ['playing', started],
      ['pause', paused],
      ['ended', paused],
      ['waiting', waiting],
      ['seeking', waiting],
      ['seeked', seeked],
      ['timeupdate', read],
      ['error', failed],
    ]
    events.forEach(([name, handler]) => audio.addEventListener(name, handler))
    document.addEventListener('visibilitychange', read)
    return () => {
      cancelAnimationFrame(frame)
      events.forEach(([name, handler]) => audio.removeEventListener(name, handler))
      document.removeEventListener('visibilitychange', read)
      audio.pause()
    }
  }, [src])
  const seek = (ms: number) => {
    const audio = audioRef.current
    if (!audio) return
    const next = Math.max(0, Math.min(ms, durationMs))
    setPosition(next)
    if (audio.readyState === 0) {
      pendingSeek.current = next
      audio.load()
    } else {
      pendingSeek.current = null
      audio.currentTime = next / 1000
    }
  }
  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    setError('')
    if (audio.error) audio.load()
    if (audio.ended) seek(0)
    setBuffering(true)
    // Call play directly from the gesture; awaiting metadata first breaks iOS.
    void audio.play().catch((error) => {
      if (error?.name === 'AbortError') return
      setBuffering(false)
      setPlaying(false)
      setError('Playback couldn’t start. Check your connection and press play again.')
    })
  }
  return { audioRef, positionMs, durationMs, playing, buffering, error, seek, toggle }
}
