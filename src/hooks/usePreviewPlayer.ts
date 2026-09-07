import { useCallback, useEffect, useRef, useState } from 'react'
import { clockPosition } from '../lib/timeline'

export function usePreviewPlayer(durationMs: number) {
  const [positionMs, setPositionMs] = useState(8_000)
  const [playing, setPlaying] = useState(false)
  const anchor = useRef({ position: 8_000, time: 0 })

  useEffect(() => {
    if (!playing) return
    let frame: number
    const tick = (now: number) => {
      const next = clockPosition(anchor.current.position, anchor.current.time, now, durationMs)
      setPositionMs(next)
      if (next >= durationMs) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, durationMs])

  const seek = useCallback(
    (ms: number) => {
      const next = Math.min(durationMs, Math.max(0, ms))
      anchor.current = { position: next, time: performance.now() }
      setPositionMs(next)
      if (next === durationMs) setPlaying(false)
    },
    [durationMs],
  )

  const toggle = () => {
    if (playing) {
      setPositionMs(
        clockPosition(anchor.current.position, anchor.current.time, performance.now(), durationMs),
      )
      setPlaying(false)
    } else {
      const next = positionMs >= durationMs ? 0 : positionMs
      anchor.current = { position: next, time: performance.now() }
      setPositionMs(next)
      setPlaying(true)
    }
  }
  return { positionMs, playing, seek, toggle }
}
