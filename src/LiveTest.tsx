import { useEffect, useRef, useState } from 'react'
import { UpdateCheck } from './components/AppUpdates'
import { ThemeToggle } from './components/ThemeToggle'
import { ArrowLeft, Check, Copy, LockKeyhole, Pause, Play, LoaderCircle } from 'lucide-react'
import { currentBatch, currentLine, type SongResponse } from '../shared/lyrics'
import { api, useLiveLyrics } from './hooks/useLiveLyrics'
import { usePreviewPlayer } from './hooks/usePreviewPlayer'
import { formatTime } from './lib/timeline'

export default function LiveTest() {
  const [key, setKey] = useState('')
  const [draft, setDraft] = useState('')
  const [initial, setInitial] = useState<SongResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const load = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await api<SongResponse>('/api/song', draft)
      if (!response.data.song?.batches?.length) throw new Error('No timed lyrics were returned.')
      setKey(draft)
      setDraft('')
      setInitial(response.data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load the song.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="app live-app">
      <header className="site-header">
        <a className="brand" href="/">
          hamava<span className="brand-dot">.</span>
        </a>
        <div className="header-actions">
          <ThemeToggle />
          <a className="install-button" href="/">
            <ArrowLeft size={15} />
            Back to preview
          </a>
        </div>
      </header>
      <main className="main-shell">
        <section className="intro">
          <div>
            <div className="eyebrow">THE NEXT VERSE</div>
            <h1>
              One song. <em>Little by little.</em>
            </h1>
            <p>Gharibe Ashena · Googoosh · Live Finglish test</p>
          </div>
        </section>
        {!initial ? (
          <form className="test-unlock" onSubmit={load}>
            <LockKeyhole size={24} />
            <h2>A private listening test</h2>
            <p>
              Load the timed Persian lyrics, then watch each section arrive in Finglish. This test
              uses a silent clock; you can play the song separately in Spotify.
            </p>
            <label htmlFor="test-key">Test passphrase</label>
            <input
              id="test-key"
              type="password"
              autoComplete="off"
              minLength={16}
              maxLength={256}
              required
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <small>
              Use your private app passphrase, not your Cloudflare API token. It stays in memory
              until you leave or lock the test.
            </small>
            <button className="primary-button" disabled={loading}>
              {loading ? 'Loading timed lyrics…' : 'Start lyrics test'}
            </button>
            {error && (
              <p role="alert" className="test-error">
                {error}
              </p>
            )}
          </form>
        ) : (
          <LivePlayer
            initial={initial}
            accessKey={key}
            onLock={() => {
              setInitial(null)
              setKey('')
            }}
          />
        )}
      </main>
      <footer className="site-footer">
        <span>هم‌آوا · In the same voice.</span>
        <span>Personal experiment</span>
      </footer>
      <UpdateCheck />
    </div>
  )
}

function LivePlayer({
  initial,
  accessKey,
  onLock,
}: {
  initial: SongResponse
  accessKey: string
  onLock: () => void
}) {
  const { song } = initial
  const player = usePreviewPlayer(song.durationMs, 0)
  const { states, halted, retry, resume } = useLiveLyrics(initial, accessKey, player.positionMs)
  const active = currentLine(song, player.positionMs)
  const section = currentBatch(song, player.positionMs)
  const currentState = section ? states[section.id] : undefined
  const [showPersian, setShowPersian] = useState(true)
  const [toast, setToast] = useState('')
  const [follow, setFollow] = useState(true)
  const rowRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const text =
    active && section
      ? currentState?.result?.lines.find((line) => line.id === active.id)?.finglish
      : undefined
  const ready = song.batches.filter((batch) => states[batch.id]?.status === 'ready').length
  const running = song.batches.find((batch) => states[batch.id]?.status === 'loading')
  const ended = player.positionMs >= song.durationMs
  useEffect(() => {
    const row = rowRef.current,
      container = scrollRef.current
    if (follow && row && container) {
      const target = row.getBoundingClientRect(),
        bounds = container.getBoundingClientRect()
      if (target.top < bounds.top || target.bottom > bounds.bottom)
        container.scrollTop += target.top - bounds.top - 12
    }
  }, [active?.id, follow])
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 2500)
      return () => clearTimeout(timer)
    }
  }, [toast])
  const copy = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setToast('Current line copied.')
    } catch {
      setToast('Copy failed. Select the line to copy it manually.')
    }
  }
  return (
    <>
      <div className="test-song-heading">
        <img src="/sleeve.svg" width="64" height="64" alt="Original mountain illustration" />
        <div>
          <h2>{song.title}</h2>
          <p>
            {song.artist} · {song.album} · {formatTime(song.durationMs)}
          </p>
        </div>
        <button className="install-button" onClick={onLock}>
          <LockKeyhole size={14} />
          Lock test
        </button>
      </div>
      <section className="test-player" aria-label="Live test player">
        <button
          className="play-button"
          aria-label={player.playing ? 'Pause test clock' : 'Play test clock'}
          onClick={player.toggle}
        >
          {player.playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <div className="scrubber">
          <span data-testid="live-position">{formatTime(player.positionMs)}</span>
          <input
            type="range"
            aria-label="Song position"
            min="0"
            max={song.durationMs}
            step="100"
            value={player.positionMs}
            aria-valuetext={formatTime(player.positionMs)}
            onChange={(event) => player.seek(Number(event.target.value))}
            style={
              {
                '--progress': `${(player.positionMs / song.durationMs) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span>{formatTime(song.durationMs)}</span>
        </div>
        <span className="silent-label">Silent test clock</span>
      </section>
      <div className="batch-strip" aria-label="Song sections">
        {song.batches.map((batch, i) => (
          <button
            key={batch.id}
            className={`batch-chip ${states[batch.id]?.status ?? 'pending'}`}
            aria-current={batch.id === section?.id ? 'true' : undefined}
            aria-label={`Seek to section ${i + 1}`}
            onClick={() => player.seek(batch.startMs)}
          >
            {states[batch.id]?.status === 'ready' ? (
              <Check size={13} />
            ) : states[batch.id]?.status === 'loading' ? (
              <LoaderCircle size={13} className="spinning" />
            ) : (
              <span className="status-dot" />
            )}
            {formatTime(batch.startMs)}
            <small>
              {states[batch.id]?.status === 'ready'
                ? 'Ready'
                : states[batch.id]?.status === 'loading'
                  ? 'Loading'
                  : states[batch.id]?.status === 'error'
                    ? 'Retry needed'
                    : 'Waiting'}
            </small>
          </button>
        ))}
      </div>
      <section className="current-moment" aria-label="Current lyric">
        <div className="eyebrow">{ended ? 'END OF SONG' : 'AT THIS MOMENT'}</div>
        {text ? (
          <p lang="fa-Latn">{text}</p>
        ) : ended ? (
          <p>The last note.</p>
        ) : !active?.text ? (
          <p className="instrumental">Instrumental</p>
        ) : (
          <p className="loading-line">
            <LoaderCircle className="spinning" size={22} />
            {currentState?.status === 'error' || halted
              ? 'This section is waiting.'
              : 'Preparing this part…'}
          </p>
        )}
        {showPersian && active?.text && (
          <span lang="fa" dir="rtl">
            {active.text}
          </span>
        )}
        {active?.text && !text && running && running.id !== section?.id && (
          <small>Your selected section is next after the current request finishes.</small>
        )}
        {currentState?.status === 'error' && (
          <div className="test-error" role="alert">
            {currentState.error}
            <button onClick={() => retry(section!.id)}>Retry this section</button>
          </div>
        )}
        <div className="moment-actions">
          <button
            className="persian-toggle"
            role="switch"
            aria-checked={showPersian}
            onClick={() => setShowPersian(!showPersian)}
          >
            <span className={`toggle ${showPersian ? 'on' : ''}`} />
            Show Persian
          </button>
          <button className="copy-button" disabled={!text} onClick={copy}>
            <Copy size={15} />
            Copy current line
          </button>
        </div>
      </section>
      <div className="test-progress">
        <span>
          {ready} of {song.batches.length} sections ready
        </span>
        {halted ? (
          <button onClick={resume}>Continue other sections</button>
        ) : (
          <span>
            {running
              ? `Preparing ${formatTime(running.startMs)}…`
              : ready === song.batches.length
                ? 'All sections ready'
                : 'Preparing sections…'}
          </span>
        )}
      </div>
      {halted && currentState?.status !== 'error' && (
        <p className="test-error" role="alert">
          Queue paused: {Object.values(states).find((state) => state.status === 'error')?.error}
        </p>
      )}
      <section className="full-lyrics" aria-label="All song lyrics">
        <div className="full-lyrics-heading">
          <h2>The words so far</h2>
          <button aria-pressed={follow} onClick={() => setFollow(!follow)}>
            Follow highlight: {follow ? 'on' : 'off'}
          </button>
        </div>
        <div className="live-lyric-scroll" ref={scrollRef}>
          {song.lines
            .filter((line) => line.text)
            .map((line) => {
              const batch = song.batches.find((batch) => batch.lineIds.includes(line.id))!
              const state = states[batch.id]
              const converted = state?.result?.lines.find((item) => item.id === line.id)?.finglish
              return (
                <div
                  key={line.id}
                  ref={active?.id === line.id ? rowRef : undefined}
                  className={`live-lyric-row ${active?.id === line.id ? 'active' : ''}`}
                  aria-current={active?.id === line.id ? 'true' : undefined}
                >
                  <button
                    className="lyric-time"
                    aria-label={`Seek to ${formatTime(line.startMs)}`}
                    onClick={() => player.seek(line.startMs)}
                  >
                    {formatTime(line.startMs)}
                  </button>
                  <div>
                    <p lang="fa-Latn" className={converted ? '' : 'pending-text'}>
                      {converted ??
                        (state?.status === 'loading'
                          ? 'Preparing Finglish…'
                          : state?.status === 'error'
                            ? 'Section needs a retry'
                            : 'Finglish will appear here')}
                    </p>
                    {showPersian && (
                      <span lang="fa" dir="rtl">
                        {line.text}
                      </span>
                    )}
                  </div>
                  {state?.status === 'error' && batch.lineIds[0] === line.id && (
                    <button className="retry-button" onClick={() => retry(batch.id)}>
                      Retry section
                    </button>
                  )}
                </div>
              )
            })}
        </div>
      </section>
      <details className="test-measurements">
        <summary>Test timings and source</summary>
        <p>
          LRCLIB record {song.sourceId}. Original lyric timestamps. Approximately one-minute
          sections, split further when a section is too long. Cached sections use no new inference.
        </p>
        <ul>
          {song.batches.map((batch, i) => (
            <li key={batch.id}>
              Section {i + 1}:{' '}
              {states[batch.id]?.result
                ? `${(states[batch.id].result!.elapsedMs / 1000).toFixed(1)} s original conversion${states[batch.id].result!.neurons !== null ? ` · ${states[batch.id].result!.neurons!.toFixed(1)} neurons` : ''}`
                : (states[batch.id]?.status ?? 'pending')}
            </li>
          ))}
        </ul>
      </details>
      <p className="test-footnote">
        No audio plays here. Start the song separately and adjust this clock to follow along.
        Spotify synchronization is still to come.
      </p>
      <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  )
}
