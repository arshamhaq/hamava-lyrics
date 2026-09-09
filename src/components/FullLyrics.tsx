import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Pause, Play, X } from 'lucide-react'
import { activeLineAt, type LyricLine } from '../lib/timeline'
import type { PlayerController } from '../hooks/useAudioPlayer'
import './FullLyrics.css'

interface Props {
  track: { title: string; artist: string }
  lines: readonly LyricLine[]
  player: PlayerController
  synced: boolean
  onClose: () => void
}

// Uses the existing media controller; opening/closing never restarts playback.
export function FullLyrics({ track, lines, player, synced, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const reader = useRef<HTMLDivElement>(null)
  const currentRow = useRef<HTMLDivElement>(null)
  const [large, setLarge] = useState(false)
  const [persian, setPersian] = useState(false)
  const [following, setFollowing] = useState(synced)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const active = synced ? activeLineAt(lines, player.positionMs) : null
  const selected = lines.find((line) => line.id === selectedId)
  const copyLine = synced ? active : selected
  const center = () => {
    if (!reader.current) return
    const row = currentRow.current
    if (!row) return
    reader.current.scrollTo({
      top: row.offsetTop - (reader.current.clientHeight - row.clientHeight) / 2,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }
  useLayoutEffect(() => {
    const el = dialog.current!
    const opener = document.activeElement as HTMLElement | null
    const y = window.scrollY,
      x = window.scrollX
    const body = document.body
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    Object.assign(body.style, {
      position: 'fixed',
      top: `${-y}px`,
      left: `${-x}px`,
      width: '100%',
      overflow: 'hidden',
    })
    el.showModal()
    return () => {
      el.close()
      Object.assign(body.style, previous)
      window.scrollTo({ top: y, left: x, behavior: 'instant' })
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  useLayoutEffect(() => {
    if (synced && following) center()
  }, [active?.id, large, persian, following, synced])
  useEffect(() => {
    if (!following || !synced || !reader.current) return
    const observer = new ResizeObserver(center)
    observer.observe(reader.current)
    return () => observer.disconnect()
  }, [following, synced])
  useEffect(() => {
    setCopied(false)
    setMessage('')
  }, [copyLine?.id])
  const copy = async () => {
    if (!copyLine?.finglish) return
    try {
      await navigator.clipboard.writeText(copyLine.finglish)
      setCopied(true)
      setMessage('Line copied.')
    } catch {
      setMessage('Copy is unavailable. Select the text and copy it manually.')
    }
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="full-lyrics"
      aria-labelledby="full-lyrics-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <header className="full-lyrics-header">
        <div>
          <h2 id="full-lyrics-title">{track.title}</h2>
          <p>{track.artist} · Full lyrics</p>
        </div>
        <button className="icon-button" aria-label="Close full lyrics" autoFocus onClick={onClose}>
          <X size={22} />
        </button>
      </header>
      <div className="full-lyrics-tools">
        {synced ? (
          <button
            className="full-follow"
            aria-pressed={following}
            onClick={() => {
              setFollowing(true)
              center()
            }}
          >
            Follow current line
          </button>
        ) : (
          <span className="full-selection-hint">Tap a line to copy it</span>
        )}
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
      </div>
      <div
        ref={reader}
        className={`full-lyrics-reader ${large ? 'full-large' : ''}`}
        aria-label="Complete song lyrics"
        tabIndex={0}
        onWheel={() => setFollowing(false)}
        onTouchStart={() => setFollowing(false)}
        onKeyDown={(event) => {
          if (
            ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)
          )
            setFollowing(false)
        }}
      >
        {lines
          .filter((line) => line.finglish)
          .map((line) => {
            const content = (
              <>
                <span lang="fa-Latn">{line.finglish}</span>
                {persian && line.persian && (
                  <span className="full-persian-line" lang="fa" dir="rtl">
                    {line.persian}
                  </span>
                )}
              </>
            )
            return synced ? (
              <div
                key={line.id}
                ref={line.id === active?.id ? currentRow : undefined}
                className="full-lyric"
                aria-current={line.id === active?.id ? 'true' : undefined}
              >
                {content}
              </div>
            ) : (
              <button
                key={line.id}
                className="full-lyric"
                aria-pressed={selectedId === line.id}
                onClick={() => setSelectedId(line.id)}
              >
                {content}
              </button>
            )
          })}
      </div>
      <footer className="full-lyrics-footer">
        <div className="full-lyrics-actions">
          {synced && (
            <button
              className="icon-button"
              aria-label={player.playing ? 'Pause song' : 'Play song'}
              onClick={player.toggle}
            >
              {player.playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
          )}
          <button className="full-copy" disabled={!copyLine?.finglish} onClick={copy}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Copied' : synced ? 'Copy current line' : 'Copy selected line'}
          </button>
        </div>
        <p className="full-feedback" role="status">
          {message ||
            (synced
              ? player.error ||
                (player.buffering
                  ? 'Loading audio…'
                  : !active?.finglish
                    ? 'No sung line at this moment'
                    : '')
              : '')}
        </p>
      </footer>
    </dialog>,
    document.body,
  )
}
