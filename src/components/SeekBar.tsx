import { useState, type CSSProperties } from 'react'
import { formatTime } from '../lib/timeline'

export function SeekBar({
  positionMs,
  durationMs,
  onSeek,
}: {
  positionMs: number
  durationMs: number
  onSeek: (ms: number) => void
}) {
  const [draft, setDraft] = useState<number | null>(null)
  const value = draft ?? positionMs
  return (
    <div className="scrubber seek-bar">
      <span data-testid="position">{formatTime(value)}</span>
      <input
        type="range"
        min="0"
        max={durationMs}
        step="100"
        value={value}
        aria-label="Song position"
        aria-valuetext={formatTime(value)}
        style={{ '--progress': `${durationMs ? (value / durationMs) * 100 : 0}%` } as CSSProperties}
        onPointerDown={(event) => {
          setDraft(positionMs)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (draft !== null) setDraft(next)
          else onSeek(next)
        }}
        onPointerUp={(event) => {
          if (draft !== null) onSeek(Number(event.currentTarget.value))
          setDraft(null)
        }}
        onPointerCancel={() => setDraft(null)}
        onLostPointerCapture={() => setDraft(null)}
      />
      <span>{formatTime(durationMs)}</span>
    </div>
  )
}
