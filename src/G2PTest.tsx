import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Copy, Download, Play, Square } from 'lucide-react'
import { Brand } from './components/Brand'
import { ThemeToggle } from './components/ThemeToggle'
import { fetchLyrics, pastedLyrics, SONG, type LyricsSource } from './g2p/text'
import { lyricsEngine, type SourceLyric, type LineOutput, type ConversionStats } from './g2p/engine'
import './g2p/test.css'
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`

export default function G2PTest() {
  const [text, setText] = useState(''),
    [recordId, setRecordId] = useState(String(SONG.id))
  const [source, setSource] = useState<LyricsSource | null>(null),
    [fetching, setFetching] = useState(false)
  const [lines, setLines] = useState<SourceLyric[]>([]),
    [results, setResults] = useState<Record<number, SourceLyric & LineOutput>>({})
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState('Loading the Persian lyrics…')
  const [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [progress, setProgress] = useState<number | null>(null)
  const [stats, setStats] = useState<ConversionStats | null>(null),
    [loadMs, setLoadMs] = useState<number | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const fetchController = useRef<AbortController | null>(null),
    runController = useRef<AbortController | null>(null)
  const meta = useRef<Record<string, unknown>>({})
  function clearResults() {
    setLines([])
    setResults({})
    setStats(null)
    setLoadMs(null)
    setCopied(null)
  }
  async function loadSong(id: number) {
    fetchController.current?.abort()
    const controller = new AbortController()
    fetchController.current = controller
    const timeout = setTimeout(() => controller.abort(), 20000)
    setFetching(true)
    setError('')
    try {
      const loaded = await fetchLyrics(id, controller.signal)
      if (fetchController.current !== controller) return
      setSource(loaded)
      setText(loaded.lines.map((line) => line.persian).join('\n'))
      clearResults()
      setStatus(`Ready to read ${loaded.title}.`)
    } catch (e) {
      if (fetchController.current !== controller) return
      setError(
        controller.signal.aborted
          ? 'Lyrics download timed out. Retry or paste the Persian lyrics below.'
          : String((e as Error).message),
      )
    } finally {
      clearTimeout(timeout)
      if (fetchController.current === controller) setFetching(false)
    }
  }
  useEffect(() => {
    void loadSong(SONG.id)
    return () => {
      fetchController.current?.abort()
      fetchController.current = null
      runController.current?.abort()
      runController.current = null
    }
  }, [])
  function stop() {
    runController.current?.abort()
    runController.current = null
    setBusy(false)
    setProgress(null)
    setStatus('Stopped. Finished lines remain below.')
  }
  async function start() {
    if (!window.isSecureContext) {
      setError('Open on localhost or HTTPS for browser inference.')
      return
    }
    let input: LyricsSource
    try {
      input = source ?? pastedLyrics(text)
    } catch (e) {
      setError((e as Error).message)
      return
    }
    runController.current?.abort()
    const controller = new AbortController()
    runController.current = controller
    setLines(input.lines)
    setResults({})
    setStats(null)
    setLoadMs(null)
    setError('')
    setNotice('')
    setBusy(true)
    setCopied(null)
    setProgress(null)
    setStatus('Starting browser CPU conversion…')
    meta.current = {
      appVersion: __APP_VERSION__,
      source: { ...input, lines: undefined },
      startedAt: new Date().toISOString(),
      backend: 'wasm',
      userAgent: navigator.userAgent,
    }
    try {
      const converted = await lyricsEngine.convert(input.lines, {
        signal: controller.signal,
        onLine: (line, index) => {
          if (runController.current === controller) {
            setResults((previous) => ({ ...previous, [index]: line }))
            setProgress(null)
          }
        },
        onEvent: (event) => {
          if (runController.current !== controller) return
          if (event.type === 'status') {
            setStatus(event.message ?? 'Working…')
            setProgress(event.total ? Math.min(1, (event.loaded ?? 0) / event.total) : null)
          }
          if (event.type === 'notice') setNotice(event.message ?? '')
          if (event.type === 'ready') {
            setLoadMs(event.loadMs ?? 0)
            meta.current = { ...meta.current, revision: event.revision, runtime: event.runtime }
          }
        },
      })
      if (runController.current !== controller) return
      setStats(converted.stats)
      const failed = converted.lines.filter((line) => line.error).length
      setStatus(
        failed
          ? `Finished. ${failed} lines could not be converted; their Persian originals are kept.`
          : 'Finished. These are Negara’s outputs, without pronunciation corrections.',
      )
    } catch (e) {
      if (runController.current !== controller) return
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message)
        setStatus('Conversion could not finish. Finished lines remain below.')
      }
    } finally {
      if (runController.current === controller) {
        setBusy(false)
        setProgress(null)
        runController.current = null
      }
    }
  }
  async function copyLine(index: number) {
    try {
      await navigator.clipboard.writeText(results[index].finglish)
      setCopied(index)
    } catch {
      setError('Clipboard access was blocked. Select the Finglish text to copy it manually.')
    }
  }
  function download() {
    const data = {
      ...meta.current,
      stats,
      complete: Boolean(stats),
      lines: lines.map((line, index) => ({ ...line, ...results[index], index })),
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'hamava-lyrics-negara.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const finished = Object.keys(results).length
  return (
    <div className="app g2p-page">
      <header className="site-header">
        <Brand />
        <ThemeToggle />
      </header>
      <main className="g2p-shell">
        <a className="back-link" href="/">
          <ArrowLeft size={17} /> Home
        </a>
        <header className="g2p-heading">
          <span className="preview-pill">CPU lyrics · v{__APP_VERSION__}</span>
          <h1>{source?.title ?? 'Your lyrics'}</h1>
          <p>{[source?.artist, source?.album].filter(Boolean).join(' · ')}</p>
          <p className="g2p-subtitle">
            Persian in. Finglish from Negara. Read each line as it appears.
          </p>
        </header>
        <section className="g2p-controls" aria-label="Test controls">
          <div className="g2p-control-row">
            <span className="g2p-small">Browser CPU · ready for any supplied Persian lyrics</span>
            {busy ? (
              <button className="primary-button" onClick={stop}>
                <Square size={17} /> Stop
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={!text.trim() || fetching}
                onClick={start}
              >
                <Play size={17} /> {finished ? 'Run again' : 'Read with Negara'}
              </button>
            )}
            <button className="g2p-secondary" disabled={!finished || busy} onClick={download}>
              <Download size={17} /> Save results
            </button>
          </div>
          <p className="g2p-small">
            The first run downloads the model. It stays ready between songs in this page, and
            downloaded weights survive app updates. Inference stays on your device.
          </p>
          <details className="g2p-source">
            <summary>Persian source · {source ? `LRCLIB ${source.id}` : 'Pasted lyrics'}</summary>
            <p>
              {source?.url ? (
                <a href={source.url} target="_blank" rel="noreferrer">
                  View the LRCLIB record
                </a>
              ) : (
                'Pasted Persian text'
              )}
              . Text only; this test does not play or sync audio.
            </p>
            <label htmlFor="record-id">LRCLIB record ID</label>
            <input
              id="record-id"
              type="number"
              min="1"
              value={recordId}
              disabled={busy || fetching}
              onChange={(event) => setRecordId(event.target.value)}
            />
            <button
              className="g2p-secondary"
              disabled={busy || fetching}
              onClick={() => void loadSong(Number(recordId))}
            >
              {fetching ? 'Loading lyrics…' : 'Load song record'}
            </button>
            <label htmlFor="g2p-persian">
              Persian lyrics (you can edit or paste text if LRCLIB cannot load)
            </label>
            <textarea
              id="g2p-persian"
              lang="fa"
              dir="rtl"
              value={text}
              disabled={busy || fetching}
              rows={9}
              onChange={(e) => {
                setText(e.target.value)
                setSource(null)
                clearResults()
              }}
            />
          </details>
        </section>
        <section className="g2p-status" aria-label="Run progress">
          <div>
            <strong>
              {stats?.warm ? 'Browser CPU · model already ready' : 'Browser CPU · WASM'}
            </strong>
            <span>
              {finished}/{lines.length || '—'} lines
            </span>
          </div>
          <p role="status">{status}</p>
          {progress !== null && <progress aria-label="Model download" value={progress} max={1} />}
          {notice && <p className="g2p-small">{notice}</p>}
          {error && (
            <p role="alert" className="g2p-error">
              {error}
            </p>
          )}
          {stats ? (
            <p className="g2p-small">
              Model setup {seconds(stats.loadMs)} · Conversion {seconds(stats.inferenceMs)} · Total{' '}
              {seconds(stats.elapsedMs)} · {stats.generatedLines} newly converted lines
            </p>
          ) : (
            loadMs !== null && <p className="g2p-small">Model setup {seconds(loadMs)}</p>
          )}
        </section>
        <ol className="g2p-lines" aria-label="Persian and generated Finglish">
          {lines.map((line, index) => {
            const persian = line.persian
            const result = results[index]
            return (
              <li key={line.id} className={result ? 'g2p-line ready' : 'g2p-line'}>
                <div className="g2p-line-top">
                  <span>LINE {String(index + 1).padStart(2, '0')}</span>
                  {result?.finglish && (
                    <button
                      className="g2p-copy"
                      aria-label={`Copy line ${index + 1}`}
                      onClick={() => void copyLine(index)}
                    >
                      <Copy size={16} />
                      {copied === index ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
                <p className="g2p-persian" lang="fa" dir="rtl">
                  {persian}
                </p>
                <p className="g2p-finglish" dir="ltr">
                  {result?.error ||
                    (result ? result.finglish : busy ? 'Waiting for this line…' : 'Not generated')}
                </p>
                {result && (
                  <>
                    <div className="g2p-small">
                      {result.cached ? 'Reused from this session' : `${Math.round(result.ms)} ms`}
                      {result.recovered && <span> · Read in smaller phrases</span>}
                      {result.truncated && (
                        <strong className="g2p-error"> · INCOMPLETE: output limit reached</strong>
                      )}
                    </div>
                    <details className="g2p-raw">
                      <summary>Raw model pronunciation</summary>
                      <code>{result.raw}</code>
                    </details>
                  </>
                )}
              </li>
            )
          })}
        </ol>
      </main>
    </div>
  )
}
