import { useState } from 'react'
import type { EngineEvent } from '../g2p/engine'
export function useModelDownload() {
  const [progress, setProgress] = useState<number | null>(null)
  return {
    progress,
    reset: () => setProgress(null),
    update: (event: EngineEvent) => {
      if (event.downloadTotal && typeof event.downloadLoaded === 'number')
        setProgress(
          event.downloadComplete
            ? 100
            : Math.min(99, Math.round((100 * event.downloadLoaded) / event.downloadTotal)),
        )
    },
  }
}
export function ModelDownload({ progress }: { progress: number | null }) {
  if (progress === null) return null
  return (
    <div className="model-download" aria-live="polite">
      <div>
        <strong>{progress === 100 ? 'Finglish reader ready' : 'First-time download'}</strong>
        <span>{progress}%</span>
      </div>
      <progress max="100" value={progress} aria-label="Finglish reader download" />
      <small>
        Downloaded once for this device. Kept for next time when browser storage is available.
      </small>
    </div>
  )
}
