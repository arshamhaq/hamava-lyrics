import { ModelDownload, useModelDownload } from './components/ModelDownload'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Maximize2,
  LoaderCircle,
  BookOpen,
  ExternalLink,
  Ellipsis,
  Trash2,
} from 'lucide-react'
import { Brand } from './components/Brand'
import { ThemeToggle } from './components/ThemeToggle'
import { UpdateCheck } from './components/AppUpdates'
import { FullLyrics } from './components/FullLyrics'
import { LyricRows, type ReadingLine } from './components/LyricRows'
import { lyricsEngine } from './g2p/engine'
import { lyricLines } from './g2p/text'
import { formatTime } from './lib/timeline'
import type { SongHit, SongText } from '../shared/search'
import {
  load,
  search,
  savedSongs,
  saveSong,
  removeSavedSong,
  type SavedSong,
} from './search/client'
import './search/search.css'

function lastQuery() {
  try {
    return sessionStorage.getItem('hamava-search-query') || ''
  } catch {
    return ''
  }
}
export default function SearchPage() {
  const download = useModelDownload()
  const pasteMode = location.pathname === '/paste'
  const [query, setQuery] = useState(lastQuery)
  const [hits, setHits] = useState<SongHit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [notice, setNotice] = useState('')
  const [retrySearch, setRetrySearch] = useState(0)
  const [song, setSong] = useState<SongText | null>(null)
  const [rows, setRows] = useState<ReadingLine[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<SongHit | null>(null)
  const [large, setLarge] = useState(false)
  const [persian, setPersian] = useState(false)
  const [full, setFull] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const [saved, setSaved] = useState(savedSongs)
  const [paste, setPaste] = useState('')
  const [pasteTitle, setPasteTitle] = useState('')
  const [showAllSaved, setShowAllSaved] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const selection = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setHits([])
    setActive(-1)
    setSearchError('')
    setNotice('')
    setSearched(false)
    try {
      sessionStorage.setItem('hamava-search-query', query)
    } catch {}
    if (pasteMode || query.trim().length < 2) {
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const result = await search(query.trim(), controller.signal)
        if (controller.signal.aborted) return
        setHits(result.songs)
        setNotice(result.notice || '')
        setSearched(true)
      } catch (e) {
        if (!controller.signal.aborted)
          setSearchError(e instanceof Error ? e.message : 'Search failed. Please retry.')
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false)
        }
      }
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, retrySearch, pasteMode])
  useEffect(() => {
    if (searchError || notice) window.dispatchEvent(new Event('hamava:check-lyrics'))
  }, [searchError, notice])
  useEffect(() => () => selection.current?.abort(), [])
  useEffect(() => {
    if (active >= 0)
      document.getElementById(`song-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function resetSelection() {
    selection.current?.abort()
    const controller = new AbortController()
    selection.current = controller
    setOpen(false)
    setFull(false)
    setError('')
    setCopyMessage('')
    setRows([])
    setSong(null)
    setBusy(true)
    download.reset()
    return controller
  }
  async function convert(source: SongText, key: string, controller: AbortController) {
    setSong(source)
    const lines = lyricLines(source.text).map((persian, i) => ({ id: `line-${i}`, persian }))
    setRows(lines.map((l) => ({ ...l, finglish: '' })))
    setStatus('Preparing Finglish on your device…')
    const result = await lyricsEngine.convert(lines, {
      signal: controller.signal,
      onLine: (line, index) => {
        if (!controller.signal.aborted)
          setRows((current) =>
            current.map((row, i) =>
              i === index
                ? {
                    ...row,
                    finglish: line.finglish,
                    error: line.error,
                    approximate: line.approximate,
                  }
                : row,
            ),
          )
      },
      onEvent: (event) => {
        if (controller.signal.aborted) return
        download.update(event)
        if (event.type === 'ready') setStatus('Reading the Persian lyrics…')
        else if (event.message)
          setStatus(
            /^(Downloading |Loading browser CPU |Preparing (encoder|decoder)|Reading cached )/.test(
              event.message,
            )
              ? 'Preparing your Finglish reader…'
              : event.message,
          )
      },
    })
    if (controller.signal.aborted) return
    const entry = {
      key,
      song: source,
      lines: result.lines.map(({ id, persian, finglish, error, approximate }) => ({
        id,
        persian,
        finglish,
        error,
        approximate,
      })),
    }
    setRows(entry.lines)
    const failed = result.lines.filter((line) => line.error).length
    if (failed) {
      setStatus(
        `Finished reading the song · ${failed} ${failed === 1 ? 'line remains' : 'lines remain'} in Persian. All other lines are ready to copy.`,
      )
      return // Never save an incomplete song as a finished offline conversion.
    }
    const approximate = result.lines.filter((line) => line.approximate).length
    const stored = saveSong(entry)
    setSaved(savedSongs())
    setStatus(
      stored
        ? `Ready · saved on this device for offline reading.${approximate ? ` ${approximate} approximate ${approximate === 1 ? 'line' : 'lines'} marked below.` : ''}`
        : 'Ready · device storage is unavailable, so this song has not been saved.',
    )
  }
  async function choose(hit: SongHit) {
    const controller = resetSelection()
    setSelected(hit)
    const key = `${hit.provider}:${hit.id}`
    const existing = savedSongs().find((s) => s.key === key)
    if (existing) {
      showSaved(existing)
      return
    }
    setStatus(`Finding lyrics for ${hit.title}…`)
    try {
      const source = await load(hit, controller.signal)
      if (controller.signal.aborted) return
      await convert(
        { ...source, duration: source.duration ?? hit.duration, album: source.album || hit.album },
        key,
        controller,
      )
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : 'Could not load this song. Try another version.')
        setStatus('')
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  function showSaved(entry: SavedSong) {
    selection.current?.abort()
    setSelected(null)
    setOpen(false)
    setFull(false)
    setSong(entry.song)
    setRows(entry.lines)
    setBusy(false)
    setError('')
    setCopyMessage('')
    setStatus('Saved on this device · available offline.')
  }
  async function readPaste() {
    const controller = resetSelection()
    setSelected(null)
    try {
      if (!/[\u0621-\u06cc]/.test(paste))
        throw new Error('Paste Persian lyrics to convert them to Finglish.')
      const source: SongText = {
        title: pasteTitle.trim() || 'Your lyrics',
        artist: '',
        album: '',
        duration: null,
        text: paste,
        source: 'Pasted text',
        sourceUrl: '',
      }
      await convert(source, `paste:${source.title}:${paste}`, controller)
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : 'Could not read this text.')
        setStatus('')
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  function closeReader() {
    selection.current?.abort()
    setSong(null)
    setRows([])
    setBusy(false)
    setSelected(null)
    setStatus('')
    setError('')
    setCopyMessage('')
    input.current?.focus()
  }
  function stop() {
    selection.current?.abort()
    setBusy(false)
    setStatus('Stopped. Completed lines are still here.')
  }
  function removeSaved(key: string) {
    if (!removeSavedSong(key)) {
      setStatus('Could not remove that saved song. Please try again.')
      return
    }
    const remaining = savedSongs()
    setSaved(remaining)
    if (remaining.length <= 4) setShowAllSaved(false)
    setStatus('Saved song removed from this device.')
  }
  const waiting = rows.filter((r) => !r.finglish && !r.error).length
  return (
    <div className="app search-app">
      <a className="skip-link" href="#search-title">
        Skip to search
      </a>
      <header className="site-header">
        <Brand />
        <ThemeToggle />
      </header>
      <main className="search-shell">
        <a className="back-link" href="/">
          <ArrowLeft size={16} /> Home
        </a>
        <section className="search-heading" aria-labelledby="search-title">
          <span className="eyebrow">YOUR LYRICS LIBRARY</span>
          <h1 id="search-title">
            {pasteMode ? (
              <>
                Paste your <em>lyrics.</em>
              </>
            ) : (
              <>
                Find your <em>song.</em>
              </>
            )}
          </h1>
        </section>
        {!pasteMode && (
          <>
            {(searchError || notice) && (
              <div className="search-request-error" role="alert">
                {searchError || notice}
                <button
                  onClick={() => {
                    setRetrySearch((v) => v + 1)
                    setOpen(true)
                  }}
                >
                  Retry search
                </button>
              </div>
            )}
            <div
              className="song-search"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false)
              }}
            >
              <label className="sr-only" htmlFor="song-search">
                Song or artist
              </label>
              <div className="search-input-wrap">
                <Search size={22} aria-hidden="true" />
                <input
                  ref={input}
                  id="song-search"
                  type="search"
                  role="combobox"
                  autoComplete="off"
                  placeholder="Song or artist · نام آهنگ یا خواننده"
                  value={query}
                  maxLength={120}
                  aria-expanded={open && query.trim().length >= 2}
                  aria-controls="song-options"
                  aria-autocomplete="list"
                  aria-activedescendant={open && active >= 0 ? `song-option-${active}` : undefined}
                  onFocus={() => setOpen(true)}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setOpen(true)
                    setActive(-1)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setOpen(false)
                      setActive(-1)
                    }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault()
                      setOpen(true)
                      if (hits.length)
                        setActive(
                          (i) =>
                            (i + (e.key === 'ArrowDown' ? 1 : hits.length - 1) + hits.length) %
                            hits.length,
                        )
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (open && hits[active]) void choose(hits[active])
                      else if (hits.length === 1) void choose(hits[0])
                      else setOpen(true)
                    }
                  }}
                />
                {query && (
                  <button
                    className="icon-button"
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery('')
                      input.current?.focus()
                    }}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              {open && query.trim().length >= 2 && (
                <div className="search-dropdown">
                  <div role="status" className="search-feedback">
                    {searching
                      ? 'Searching songs…'
                      : (searchError ? 'Search could not finish. See the message above.' : '') ||
                        notice ||
                        (hits.length
                          ? `${hits.length} matches`
                          : searched
                            ? 'No close matches. Try a different spelling or add the artist.'
                            : '')}
                  </div>
                  <div id="song-options" role="listbox" aria-label="Song suggestions">
                    {hits.map((hit, index) => (
                      <div
                        key={`${hit.provider}:${hit.id}`}
                        id={`song-option-${index}`}
                        role="option"
                        aria-selected={active === index}
                        className="song-option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void choose(hit)}
                      >
                        <span className="result-symbol">
                          <BookOpen size={19} />
                        </span>
                        <span className="result-text">
                          <strong dir="auto">{hit.title}</strong>
                          <span dir="auto">
                            {hit.artist}
                            {hit.album ? ` · ${hit.album}` : ''}
                          </span>
                          <small>
                            {hit.provider === 'lrclib' ? 'LRCLIB' : 'lyrics.ovh · Deezer catalog'} ·{' '}
                            {hit.hasLyrics ? 'Persian lyrics' : 'Lyrics not confirmed'}
                          </small>
                        </span>
                        <span className="result-duration">
                          {hit.duration ? formatTime(hit.duration * 1000) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!searching && !hits.length && (
                    <div className="external-sources">
                      <span>Find text elsewhere, then use Paste Persian lyrics:</span>
                      <a href="/paste">Paste Persian lyrics</a>
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://music-fa.com/?s=${encodeURIComponent(query)}`}
                      >
                        MusicFa <ExternalLink size={13} />
                      </a>
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://genius.com/search?q=${encodeURIComponent(query)}`}
                      >
                        Genius <ExternalLink size={13} />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="search-hint">
              A few words are enough. Try{' '}
              <button
                onClick={() => {
                  setQuery('kooh googoosh')
                  setOpen(true)
                  input.current?.focus()
                }}
              >
                Kooh by Googoosh
              </button>{' '}
              or the artist’s name.
            </p>
          </>
        )}
        {!song && !busy && saved.length > 0 && (
          <section className="saved-songs" aria-label="Saved songs">
            <h2>On this device</h2>
            <div>
              {(showAllSaved ? saved : saved.slice(0, 4)).map((entry) => (
                <div className="saved-song" key={entry.key}>
                  <button className="saved-song-open" onClick={() => showSaved(entry)}>
                    <BookOpen size={17} />
                    <span>
                      <strong>{entry.song.title}</strong>
                      <small>{entry.song.artist || 'Your lyrics'}</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                  <button
                    className="saved-song-remove"
                    aria-label={`Remove ${entry.song.title} from this device`}
                    title="Remove saved song"
                    onClick={() => removeSaved(entry.key)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
            {saved.length > 4 && (
              <button
                className="saved-show-all"
                aria-expanded={showAllSaved}
                onClick={() => setShowAllSaved((value) => !value)}
              >
                <Ellipsis size={21} />
                {showAllSaved ? 'Show less' : `Show all (${saved.length})`}
              </button>
            )}
          </section>
        )}
        <ModelDownload progress={download.progress} />
        <div className="reading-status" role="status">
          {busy && <LoaderCircle className="search-spinner" size={17} />}
          <span>
            {status}
            {busy && rows.length > 0 ? ` · ${rows.length - waiting}/${rows.length} lines` : ''}
          </span>
          {busy && <button onClick={stop}>Stop</button>}
        </div>
        {error && (
          <div className="search-error" role="alert">
            <p>{error}</p>
            {selected && <button onClick={() => void choose(selected)}>Retry this song</button>}
            <p>Choose another version, or paste Persian lyrics below.</p>
          </div>
        )}
        {song && rows.length > 0 && (
          <section className="song-reader" aria-labelledby="reader-title">
            <header className="song-reader-heading">
              <span className="reader-art">
                <BookOpen size={28} />
              </span>
              <div>
                <h2 id="reader-title" dir="auto">
                  {song.title}
                </h2>
                <p dir="auto">
                  {[song.artist, song.album, song.duration ? formatTime(song.duration * 1000) : '']
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                className="icon-button close-reader"
                aria-label="Close lyrics"
                onClick={closeReader}
              >
                <X size={19} />
              </button>
            </header>
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
            <div
              className={`song-reader-lines ${large ? 'full-large' : ''}`}
              aria-label="Song lyrics"
            >
              <LyricRows
                key={song.text}
                lines={rows}
                persian={persian}
                onMessage={setCopyMessage}
                prefix="search"
              />
            </div>
            <footer className="reader-source">
              <span>
                {song.sourceUrl ? (
                  <a href={song.sourceUrl} target="_blank" rel="noreferrer">
                    Lyrics: {song.source} <ExternalLink size={12} />
                  </a>
                ) : (
                  song.source
                )}{' '}
                · Automatic Finglish
              </span>
              <span role="status">{copyMessage}</span>
            </footer>
          </section>
        )}
        {pasteMode && (
          <section className="search-fallbacks paste-form" aria-label="Paste Persian lyrics">
            <h2>Persian lyrics</h2>
            <p>Found the words somewhere else? Read them here in Finglish.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void readPaste()
              }}
            >
              <label>
                Title (optional)
                <input
                  maxLength={150}
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                />
              </label>
              <label>
                Persian lyrics
                <textarea
                  required
                  dir="rtl"
                  lang="fa"
                  rows={6}
                  maxLength={100000}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                />
              </label>
              <button className="primary-button" type="submit">
                Read in Finglish <ArrowRight size={16} />
              </button>
            </form>
          </section>
        )}
      </main>
      {full && song && (
        <FullLyrics synced={false} track={song} lines={rows} onClose={() => setFull(false)} />
      )}
      <UpdateCheck />
    </div>
  )
}
