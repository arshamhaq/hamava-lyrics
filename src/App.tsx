import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  ClipboardPaste,
  X,
} from 'lucide-react'
import { UpdateCheck } from './components/AppUpdates'
import { ThemeToggle } from './components/ThemeToggle'
import { Brand } from './components/Brand'
import { ScriptLens } from './components/ScriptLens'
import { GuidedDemo } from './components/GuidedDemo'

type DialogKind = 'install' | 'about' | null
type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

export default function App() {
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const mode =
    location.pathname === '/spotify' ? 'spotify' : location.pathname === '/search' ? 'search' : null
  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', onInstall)
    return () => window.removeEventListener('beforeinstallprompt', onInstall)
  }, [])
  useEffect(() => {
    if (dialog && !dialogRef.current?.open) dialogRef.current?.showModal()
    if (!dialog && dialogRef.current?.open) dialogRef.current.close()
  }, [dialog])
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
    <div className="app">
      <a className="skip-link" href={mode ? '#route-title' : '#demo'}>
        Skip to {mode ? 'content' : 'demo'}
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
        {mode ? (
          <section className="mode-placeholder" aria-labelledby="route-title">
            <a className="back-link" href="/">
              <ArrowLeft size={16} />
              Home
            </a>
            <div className={`mode-symbol mode-${mode}`}>
              {mode === 'spotify' ? (
                <img
                  className="spotify-mark"
                  src="/spotify-icon-black.png"
                  width="34"
                  height="34"
                  alt=""
                />
              ) : (
                <Search size={28} />
              )}
            </div>
            <span className="preview-pill">Coming next</span>
            <h1 id="route-title">{mode === 'spotify' ? 'Spotify sync' : 'Search a song'}</h1>
            <p>
              {mode === 'spotify'
                ? 'Connect Spotify to follow the song you’re playing, with lyrics that move automatically.'
                : 'Find the lyrics, listen in any music app, and move the lyrics clock to match what you hear.'}
            </p>
            <p className="mode-note">
              {mode === 'spotify'
                ? 'Spotify login and playback controls aren’t connected yet.'
                : 'Song search and the manual lyrics clock aren’t connected yet.'}{' '}
              Try the working audio demo while we build this route.
            </p>
            <a className="primary-button" href="/#demo">
              Try the demo <ArrowRight size={17} />
            </a>
          </section>
        ) : (
          <>
            <section className="welcome" aria-labelledby="page-title">
              <div className="intro">
                <div className="intro-heading">
                  <span className="eyebrow">هم‌آوا / HAMAVA</span>
                  <h1 id="page-title">
                    Lyrics, in <em>Finglish.</em>
                  </h1>
                </div>
                <ScriptLens />
              </div>
              <div className="mode-choices" aria-label="Choose how to listen">
                <a className="mode-card sync-card" href="/spotify">
                  <span className="mode-icon">
                    <img
                      className="spotify-mark"
                      src="/spotify-icon-black.png"
                      width="34"
                      height="34"
                      alt=""
                    />
                  </span>
                  <span className="mode-card-text">
                    <small>AUTOMATIC SYNC</small>
                    <strong>Connect Spotify</strong>
                    <span>Follow what’s playing on Spotify.</span>
                  </span>
                  <ArrowRight size={22} />
                </a>
                <a className="mode-card search-card" href="/search">
                  <span className="mode-icon">
                    <Search size={25} />
                  </span>
                  <span className="mode-card-text">
                    <small>READ & COPY</small>
                    <strong>Search a song</strong>
                    <span>Find the words. Copy any line.</span>
                  </span>
                  <ArrowRight size={22} />
                </a>
                <a className="mode-card paste-card" href="/paste">
                  <span className="mode-icon">
                    <ClipboardPaste size={25} />
                  </span>
                  <span className="mode-card-text">
                    <small>YOUR LYRICS</small>
                    <strong>Paste Persian lyrics</strong>
                    <span>Turn your own text into Finglish.</span>
                  </span>
                  <ArrowRight size={22} />
                </a>
              </div>
              <a className="demo-invitation" href="#demo">
                <span>First time? Try the player below</span>
                <ArrowDown size={18} />
                <small>A real song, with a few pointers</small>
              </a>
            </section>
            <GuidedDemo />
          </>
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
      <dialog
        ref={dialogRef}
        onCancel={() => setDialog(null)}
        onClose={() => setDialog(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setDialog(null)
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
          {dialog === 'install' ? (
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
                The app opens offline after its first complete visit. The demo recording needs a
                connection to load.
              </p>
              <button className="primary-button" onClick={() => setDialog(null)}>
                Got it <Check size={16} />
              </button>
            </>
          ) : (
            <>
              <h2 id="dialog-title">About Hamava</h2>
              <p>
                A personal app for reading Persian lyrics in Latin letters. Copy the highlighted
                line or show the Persian text alongside it.
              </p>
              <p className="dialog-note">
                The homepage demo plays the supplied Heydoo Hedayati recording with prepared
                Finglish lyrics. Search reads songs in Finglish. Spotify sync is coming next.
              </p>
              <button className="primary-button" onClick={() => setDialog(null)}>
                Back to Hamava <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  )
}
