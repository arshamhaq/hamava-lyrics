import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { LyricRows, type ReadingLine } from '../components/LyricRows'
import { FullLyrics } from '../components/FullLyrics'
export function PlainReader({
  track,
  lines,
}: {
  track: { title: string; artist: string }
  lines: ReadingLine[]
}) {
  const [large, setLarge] = useState(false),
    [persian, setPersian] = useState(false),
    [full, setFull] = useState(false),
    [message, setMessage] = useState('')
  return (
    <section className="song-reader" aria-label="Untimed lyrics">
      <div className="song-reader-tools">
        <span>Copy any line</span>
        <button
          className="type-button"
          aria-label="Larger lyrics"
          aria-pressed={large}
          onClick={() => setLarge(!large)}
        >
          Aa
        </button>
        <button
          className="full-persian"
          aria-label="Show Persian"
          aria-pressed={persian}
          onClick={() => setPersian(!persian)}
        >
          فارسی
        </button>
        <button
          className="reader-expand"
          aria-label="Open full lyrics"
          onClick={() => setFull(true)}
        >
          <Maximize2 size={19} />
        </button>
      </div>
      <div className={`song-reader-lines ${large ? 'full-large' : ''}`}>
        <LyricRows lines={lines} persian={persian} onMessage={setMessage} prefix="spotify-plain" />
      </div>
      <p className="reader-source" role="status">
        {message}
      </p>
      {full && (
        <FullLyrics track={track} lines={lines} synced={false} onClose={() => setFull(false)} />
      )}
    </section>
  )
}
