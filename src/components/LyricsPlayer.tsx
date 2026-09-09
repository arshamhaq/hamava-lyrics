import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Heart,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react'
import { activeLineAt, type LyricLine } from '../lib/timeline'
import type { PlayerController } from '../hooks/useAudioPlayer'
import { SeekBar } from './SeekBar'
import { SketchArrow } from './SketchArrow'
import { FullLyrics } from './FullLyrics'
import { useGuideEntrance } from '../hooks/useGuideEntrance'

interface Props {
  track: { title: string; artist: string; coverSrc: string }
  lines: readonly LyricLine[]
  player: PlayerController
  synced?: boolean
  guidesReady?: boolean
  guided?: boolean
}

// Shared presentation for the audio demo and future Spotify/manual controllers.
// This component does not fetch tracks or decide how a seek reaches the player.
export function LyricsPlayer({
  track,
  lines,
  player,
  synced = true,
  guidesReady = true,
  guided = false,
}: Props) {
  const active = activeLineAt(lines, player.positionMs)
  const [showPersian, setShowPersian] = useState(true)
  const [largeText, setLargeText] = useState(false)
  const [fullOpen, setFullOpen] = useState(false)
  const [following, setFollowing] = useState(true)
  const [tips, setTips] = useState(guided)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(() => {
    try {
      return localStorage.getItem('hamava:demo-saved') === 'true'
    } catch {
      return false
    }
  })
  const widget = useRef<HTMLDivElement>(null)
  useGuideEntrance(widget, tips, guidesReady)
  const list = useRef<HTMLDivElement>(null)
  const activeRow = useRef<HTMLDivElement>(null)
  const centerCurrentLine = () => {
    if (!list.current) return
    const target = activeRow.current
      ? activeRow.current.offsetTop -
        (list.current.clientHeight - activeRow.current.clientHeight) / 2
      : 0
    list.current.scrollTo({
      top: target,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }
  useLayoutEffect(() => {
    if (following) centerCurrentLine()
  }, [active?.id, following, largeText, showPersian, fullOpen])
  useEffect(() => {
    setCopied(false)
  }, [active?.id])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 2600)
    return () => clearTimeout(timer)
  }, [message])
  const copy = async () => {
    if (!active?.finglish) return
    try {
      await navigator.clipboard.writeText(active.finglish)
      setCopied(true)
      setMessage('Line copied.')
    } catch {
      setMessage('Copy is unavailable. Select the line and copy it manually.')
    }
  }
  const save = () => {
    try {
      localStorage.setItem('hamava:demo-saved', String(!saved))
      setSaved(!saved)
    } catch {
      setMessage('This browser couldn’t save your preference.')
    }
  }
  const vocalLines = lines.filter((line) => line.finglish)
  const previous = [...vocalLines].reverse().find((line) => line.startMs < player.positionMs - 500)
  const next = vocalLines.find((line) => line.startMs > player.positionMs + 100)
  const instrumental = !active?.finglish
  return (
    <div ref={widget} className="lyrics-widget">
      {guided && (
        <div className="guide-toolbar">
          <span>Play, drag, and try the controls</span>
          <button aria-pressed={tips} onClick={() => setTips(!tips)}>
            {tips ? 'Hide tips' : 'Show tips'}
          </button>
        </div>
      )}
      <section className="listening-room" aria-label="Lyrics player">
        <aside className="record-panel">
          <div className="sleeve-wrap">
            <img
              className="record-sleeve"
              src={track.coverSrc}
              width="640"
              height="640"
              alt={`Cover for ${track.title}`}
            />
          </div>
          <div className="track-heading">
            <div>
              <h2>{track.title}</h2>
              <p>{track.artist}</p>
            </div>
            <button
              className={`save-button ${saved ? 'saved' : ''}`}
              aria-label={saved ? 'Unsave song' : 'Save song'}
              aria-pressed={saved}
              onClick={save}
            >
              <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
            </button>
          </div>
          {tips && (
            <p className="guide-note cover-guide" data-guide="cover">
              <SketchArrow />
              <span>Your Spotify cover goes here, when available.</span>
            </p>
          )}
        </aside>
        <div className="lyrics-panel">
          {tips && (
            <p className="guide-note follow-guide" data-guide="follow">
              <SketchArrow kind="swoop" />
              <span>Lost your place? Jump back here.</span>
            </p>
          )}
          <div className="reader-tools" aria-label="Lyric reading controls">
            <button
              className="follow-button"
              aria-pressed={following}
              onClick={() => {
                setFollowing(true)
                centerCurrentLine()
              }}
            >
              <span>Follow current line</span>
              <small>(only synced mode)</small>
            </button>
            <button
              className="type-button"
              aria-label="Larger lyrics"
              aria-pressed={largeText}
              onClick={() => setLargeText(!largeText)}
            >
              Aa
            </button>
            <button
              className="icon-button"
              aria-label="Open full lyrics"
              aria-haspopup="dialog"
              onClick={() => setFullOpen(true)}
            >
              <Maximize2 size={17} />
            </button>
          </div>
          <div className="reader-status">
            <span>
              {player.buffering
                ? 'Loading audio…'
                : player.positionMs >= player.durationMs
                  ? 'End of song'
                  : instrumental
                    ? 'Instrumental'
                    : 'Current verse'}
            </span>
            {player.positionMs < (vocalLines[0]?.startMs ?? 0) && (
              <button className="skip-intro" onClick={() => player.seek(vocalLines[0].startMs)}>
                Skip intro
              </button>
            )}
          </div>
          <div
            id="lyrics"
            tabIndex={0}
            ref={list}
            className={`reader-lines ${largeText ? 'large-type' : ''}`}
            aria-label="Song lyrics"
            onWheel={() => setFollowing(false)}
            onTouchStart={() => setFollowing(false)}
            onKeyDown={(event) => {
              if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.key))
                setFollowing(false)
            }}
          >
            <div
              className={`lyric-row instrumental-row ${!active && player.positionMs < (lines[0]?.startMs ?? 0) ? 'active' : ''}`}
            >
              <span className="lyric-indicator">♪</span>
              <div className="lyric-text">
                <p>Instrumental intro</p>
              </div>
            </div>
            {lines.map((line, index) => (
              <div
                key={line.id}
                ref={line.id === active?.id ? activeRow : undefined}
                className={`lyric-row ${line.id === active?.id ? 'active' : ''} ${!line.finglish ? 'instrumental-row' : ''}`}
                aria-current={line.id === active?.id ? 'true' : undefined}
              >
                <span className="lyric-indicator" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="lyric-text">
                  <p lang={line.finglish ? 'fa-Latn' : 'en'}>{line.finglish || 'Instrumental'}</p>
                  {showPersian && line.persian && (
                    <span lang="fa" dir="rtl">
                      {line.persian}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="lyrics-actions">
            <button
              className="persian-toggle"
              role="switch"
              aria-checked={showPersian}
              onClick={() => setShowPersian(!showPersian)}
            >
              <span className={`toggle ${showPersian ? 'on' : ''}`} />
              <span>Show Persian</span>
            </button>
            <button className="copy-button" disabled={instrumental} onClick={copy}>
              {copied ? <Check size={19} /> : <Copy size={19} />}
              {copied ? 'Copied' : 'Copy current line'}
            </button>
          </div>
          {tips && (
            <div className="action-guides">
              <p className="guide-note" data-guide="persian">
                <SketchArrow kind="swoop" />
                <span>See the Persian, too</span>
              </p>
              <p className="guide-note" data-guide="copy">
                <SketchArrow mirror />
                <span>Take this line with you</span>
              </p>
            </div>
          )}
        </div>
      </section>
      <section className="player" aria-label="Song controls">
        <div className="player-track">
          <img src={track.coverSrc} alt="" width="44" height="44" />
          <div>
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </div>
        </div>
        <div className="transport">
          <button
            className="icon-button"
            aria-label="Previous line"
            onClick={() => player.seek(previous?.startMs ?? 0)}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            className="play-button"
            aria-label={player.playing ? 'Pause song' : 'Play song'}
            onClick={player.toggle}
          >
            {player.buffering && !player.playing ? (
              <LoaderCircle className="spinning" size={20} />
            ) : player.playing ? (
              <Pause size={19} fill="currentColor" />
            ) : (
              <Play size={19} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button"
            aria-label="Next line"
            disabled={!next}
            onClick={() => next && player.seek(next.startMs)}
          >
            <ChevronRight size={22} />
          </button>
        </div>
        <SeekBar
          positionMs={player.positionMs}
          durationMs={player.durationMs}
          onSeek={player.seek}
        />
        <button
          className="icon-button restart"
          aria-label="Restart song"
          onClick={() => player.seek(0)}
        >
          <RotateCcw size={17} />
        </button>
      </section>
      {tips && (
        <div className="transport-guides">
          <p className="guide-note step-guide" data-guide="step">
            <SketchArrow kind="swoop" mirror />
            <span>Back a line, or on to the next.</span>
          </p>
          <p className="guide-note seek-guide" data-guide="seek">
            <SketchArrow />
            <span>Drag here. The music & words follow along.</span>
          </p>
        </div>
      )}
      {player.error && (
        <p className="audio-error" role="alert">
          {player.error}
        </p>
      )}
      {fullOpen && (
        <FullLyrics
          track={track}
          lines={lines}
          player={player}
          synced={synced}
          onClose={() => setFullOpen(false)}
        />
      )}
      <p className="reader-feedback" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  )
}
