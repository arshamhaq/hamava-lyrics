import { useEffect, useRef, useState } from 'react'
import { UpdateCheck } from './components/AppUpdates'
import { ThemeToggle } from './components/ThemeToggle'
import { Brand } from './components/Brand'
import { ScriptLens } from './components/ScriptLens'
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Globe2,
  Heart,
  Info,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  WifiOff,
  X,
} from 'lucide-react'
import { demoLines, demoTrack } from './data/demo'
import { activeLineAt, formatTime } from './lib/timeline'
import { usePreviewPlayer } from './hooks/usePreviewPlayer'

type DialogKind = 'spotify' | 'install' | 'about' | null
type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

function Soundmark({ small = false }: { small?: boolean }) {
  return (
    <span className={`soundmark ${small ? 'small' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

export default function App() {
  const player = usePreviewPlayer(demoTrack.durationMs)
  const active = activeLineAt(demoLines, player.positionMs)
  const [showPersian, setShowPersian] = useState(true)
  const [largeText, setLargeText] = useState(false)
  const [focus, setFocus] = useState(false)
  const [saved, setSaved] = useState(() => {
    try {
      return localStorage.getItem('hamava:demo-saved') === 'true'
    } catch {
      return false
    }
  })
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const install = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPrompt)
    }
    const connectivity = () => setOnline(navigator.onLine)
    window.addEventListener('beforeinstallprompt', install)
    window.addEventListener('online', connectivity)
    window.addEventListener('offline', connectivity)
    return () => {
      window.removeEventListener('beforeinstallprompt', install)
      window.removeEventListener('online', connectivity)
      window.removeEventListener('offline', connectivity)
    }
  }, [])

  useEffect(() => {
    if (!toast && !copied) return
    const timer = window.setTimeout(() => {
      setToast('')
      setCopied(false)
    }, 2800)
    return () => clearTimeout(timer)
  }, [toast, copied])

  useEffect(() => {
    if (dialog && !dialogRef.current?.open) dialogRef.current?.showModal()
    if (!dialog && dialogRef.current?.open) dialogRef.current.close()
  }, [dialog])

  const copyLine = async () => {
    if (!active) return
    try {
      await navigator.clipboard.writeText(active.finglish)
      setCopied(true)
      setToast('Line copied.')
    } catch {
      setToast('Copy is unavailable here. Select and copy the lyric text, or open the HTTPS site.')
    }
  }

  const saveTrack = () => {
    const next = !saved
    try {
      localStorage.setItem('hamava:demo-saved', String(next))
      setSaved(next)
      setToast(next ? 'Saved on this device.' : 'Removed from your saved songs.')
    } catch {
      setToast('This browser cannot save songs on this device.')
    }
  }

  const install = async () => {
    if (!installPrompt) {
      setDialog('install')
      return
    }
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  return (
    <div className={`app ${focus ? 'is-focused' : ''}`}>
      <a className="skip-link" href="#lyrics">
        Skip to lyrics
      </a>
      <header className="site-header">
        <Brand />
        <div className="header-actions">
          <ThemeToggle />
          <button className="install-button" onClick={install}>
            <ArrowDownToLine size={15} />
            <span>Install</span>
          </button>
        </div>
      </header>

      <main className="main-shell">
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-heading">
            <span className="eyebrow">هم‌آوا / HAMAVA</span>
            <h1 id="page-title">
              Lyrics, in <em>Finglish.</em>
            </h1>
            <p>Follow the line. Keep the words.</p>
            <button className="spotify-button" onClick={() => setDialog('spotify')}>
              <Radio size={17} /> Connect Spotify <ArrowRight size={15} />
            </button>
          </div>
          <ScriptLens />
        </section>

        <section className="listening-room" aria-label="Listening room">
          <aside className="record-panel">
            <div className="sleeve-wrap">
              <img
                className="record-sleeve"
                src="/sleeve.svg"
                width="640"
                height="640"
                alt="Original mountain illustration for the Googoosh listening preview"
              />
            </div>
            <div className="track-heading">
              <div>
                <h2>{demoTrack.title}</h2>
                <p>{demoTrack.artist}</p>
              </div>
              <button
                className={`save-button ${saved ? 'saved' : ''}`}
                aria-label={saved ? 'Unsave song' : 'Save song'}
                aria-pressed={saved}
                onClick={saveTrack}
              >
                <Heart size={20} fill={saved ? 'currentColor' : 'none'} />
              </button>
            </div>
            <p className="record-caption">
              Gharibe Ashena{' '}
              <span lang="fa" dir="rtl">
                غریب آشنا
              </span>
            </p>
          </aside>

          <div className="lyrics-panel">
            <div className="lyrics-toolbar">
              <div className="live-label">
                <span className={`status-dot ${player.playing ? 'pulse' : ''}`} />
                LYRICS<span className="preview-pill">Preview</span>
              </div>
              <button
                className="icon-button"
                aria-label={focus ? 'Leave focus view' : 'Focus on lyrics'}
                aria-pressed={focus}
                onClick={() => setFocus(!focus)}
              >
                {focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
            </div>
            <div className="reading-controls">
              <div className="language-label">
                <Globe2 size={14} />
                Finglish
              </div>
              <button
                className="type-button"
                aria-label="Larger lyrics"
                aria-pressed={largeText}
                onClick={() => setLargeText(!largeText)}
              >
                Aa
              </button>
            </div>
            <div
              id="lyrics"
              tabIndex={-1}
              className={`lyrics-stage ${largeText ? 'large-type' : ''}`}
              aria-label="Preview lyrics"
            >
              {demoLines.map((line, index) => (
                <div
                  key={line.id}
                  className={`lyric-row ${line.id === active?.id ? 'active' : ''}`}
                  aria-current={line.id === active?.id ? 'true' : undefined}
                >
                  <span className="lyric-indicator" aria-hidden="true">
                    {line.id === active?.id ? (
                      <Soundmark small />
                    ) : (
                      String(index + 1).padStart(2, '0')
                    )}
                  </span>
                  <div className="lyric-text">
                    <p lang="fa-Latn">{line.finglish}</p>
                    {showPersian && (
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
              <button className="copy-button" disabled={!active} onClick={copyLine}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy current line'}
              </button>
            </div>
          </div>
        </section>

        <section className="player" aria-label="Preview player">
          <div className="player-track">
            <img src="/sleeve.svg" alt="" width="44" height="44" />
            <div>
              <strong>{demoTrack.title}</strong>
              <span>{demoTrack.artist}</span>
            </div>
          </div>
          <div className="transport">
            <button
              className="icon-button"
              aria-label="Previous line"
              onClick={() =>
                player.seek(Math.max(0, (active ? demoLines.indexOf(active) - 1 : 2) * 8000))
              }
            >
              <ChevronLeft size={22} />
            </button>
            <button
              className="play-button"
              aria-label={player.playing ? 'Pause preview' : 'Play preview'}
              onClick={player.toggle}
            >
              {player.playing ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
            </button>
            <button
              className="icon-button"
              aria-label="Next line"
              onClick={() =>
                player.seek(Math.min(16000, (active ? demoLines.indexOf(active) + 1 : 0) * 8000))
              }
            >
              <ChevronRight size={22} />
            </button>
          </div>
          <div className="scrubber">
            <span data-testid="position">{formatTime(player.positionMs)}</span>
            <input
              type="range"
              min="0"
              max={demoTrack.durationMs}
              step="100"
              value={player.positionMs}
              aria-label="Preview position"
              aria-valuetext={formatTime(player.positionMs)}
              onChange={(e) => player.seek(Number(e.target.value))}
              style={
                {
                  '--progress': `${(player.positionMs / demoTrack.durationMs) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span>{formatTime(demoTrack.durationMs)}</span>
          </div>
          <button
            className="icon-button restart"
            aria-label="Restart preview"
            onClick={() => player.seek(0)}
          >
            <RotateCcw size={17} />
          </button>
          <span className="player-mode">
            <span className="status-dot" />
            Silent preview
          </span>
        </section>

        <div className="below-player">
          <p>
            <Info size={14} />
            24-second silent demo · Spotify isn’t connected yet.
          </p>
        </div>
        {!online && (
          <div className="notice">
            <WifiOff size={16} />
            You’re offline. Your saved preview is still here.
          </div>
        )}
      </main>
      <footer className="site-footer">
        <span lang="fa">هم‌آوا</span>
        <div className="footer-links">
          <a href="/?live">Lyrics test</a>
          <button onClick={() => setDialog('about')}>
            About Hamava <ArrowRight size={13} />
          </button>
        </div>
      </footer>
      <UpdateCheck />
      <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>

      <dialog
        ref={dialogRef}
        onCancel={() => setDialog(null)}
        onClose={() => setDialog(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setDialog(null)
        }}
        aria-labelledby="dialog-title"
      >
        <div className="dialog-content">
          <button
            className="icon-button dialog-close"
            aria-label="Close dialog"
            onClick={() => setDialog(null)}
          >
            <X size={19} />
          </button>
          <img className="dialog-mark" src="/hamava-mark.png" width="48" height="48" alt="" />
          {dialog === 'spotify' && (
            <>
              <h2 id="dialog-title">Connect Spotify</h2>
              <p>
                Spotify connection is coming next. You’ll sign in on Spotify, then follow your music
                here while it plays in the Spotify app.
              </p>
              <p className="dialog-note">
                For now, the preview lets you move between lines and copy the highlighted text.
              </p>
              <button className="primary-button" onClick={() => setDialog(null)}>
                Back to the lyrics <ArrowRight size={16} />
              </button>
            </>
          )}
          {dialog === 'install' && (
            <>
              <h2 id="dialog-title">Install Hamava</h2>
              <p>
                <strong>On iPhone:</strong> open this site in Safari, tap Share, then Add to Home
                Screen.
              </p>
              <p>
                <strong>On Android:</strong> open this site in Chrome, open the menu, then Install
                app or Add to Home screen.
              </p>
              <p className="dialog-note">
                The preview works offline after its first complete visit.
              </p>
              <button className="primary-button" onClick={() => setDialog(null)}>
                Got it <Check size={16} />
              </button>
            </>
          )}
          {dialog === 'about' && (
            <>
              <h2 id="dialog-title">About Hamava</h2>
              <p>
                A personal app for reading Persian lyrics in Latin letters. Copy the highlighted
                line or show the Persian text alongside it.
              </p>
              <p className="dialog-note">
                This first preview uses a short supplied excerpt and an original illustrated sleeve.
                Its clock is a demonstration; no audio plays and no accounts are connected.
              </p>
              <button className="primary-button" onClick={() => setDialog(null)}>
                Back to lyrics <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  )
}
