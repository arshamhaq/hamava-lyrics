import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Copy, Download, Play, Square } from 'lucide-react'
import { Brand } from './components/Brand'
import { ThemeToggle } from './components/ThemeToggle'
import { fetchSong, lyricLines, SONG } from './g2p/text'
import './g2p/test.css'

type Mode = 'auto' | 'wasm' | 'webgpu'
type Result = {
  index: number
  raw: string
  finglish: string
  ms: number
  cached: boolean
  truncated: boolean
  tokens: number
}
type Stats = { loadMs: number; inferenceMs: number; elapsedMs: number; uniqueLines: number }
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`
const engineName = (backend: string) =>
  backend === 'webgpu'
    ? 'WebGPU + CPU fallback'
    : backend === 'wasm'
      ? 'Browser CPU · WASM'
      : 'Not started'

export default function G2PTest() {
  const [text, setText] = useState(''),
    [source, setSource] = useState('LRCLIB · loading')
  const [fetching, setFetching] = useState(false),
    [mode, setMode] = useState<Mode>('wasm')
  const [backend, setBackend] = useState(''),
    [lines, setLines] = useState<string[]>([])
  const [results, setResults] = useState<Record<number, Result>>({}),
    [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Loading the Persian lyrics…'),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('')
  const [progress, setProgress] = useState<number | null>(null),
    [stats, setStats] = useState<Stats | null>(null)
  const [loadMs, setLoadMs] = useState<number | null>(null),
    [copied, setCopied] = useState<number | null>(null)
  const worker = useRef<Worker | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fetchController = useRef<AbortController | null>(null),
    meta = useRef<Record<string, unknown>>({})

  async function loadSong() {
    fetchController.current?.abort()
    const controller = new AbortController()
    fetchController.current = controller
    const timeout = setTimeout(() => controller.abort(), 20000)
    setFetching(true)
    setError('')
    try {
      const lyrics = await fetchSong(controller.signal)
      if (fetchController.current !== controller) return
      setText(lyrics)
      setSource('LRCLIB · record 13708175')
      setStatus('Ready to read Del Bordi.')
    } catch (e) {
      if (fetchController.current !== controller) return
      setSource('Lyrics not loaded')
      setError(
        controller.signal.aborted
          ? 'Lyrics download timed out. Retry, or paste the Persian lyrics below.'
          : String((e as Error).message),
      )
    } finally {
      clearTimeout(timeout)
      if (fetchController.current === controller) setFetching(false)
    }
  }
  useEffect(() => {
    void loadSong()
    return () => {
      fetchController.current?.abort()
      fetchController.current = null
      worker.current?.terminate()
      worker.current = null
      clearTimeout(timer.current)
    }
  }, [])
  function stop() {
    worker.current?.terminate()
    worker.current = null
    clearTimeout(timer.current)
    setBusy(false)
    setProgress(null)
    setStatus('Stopped. Finished lines remain below.')
  }
  function start() {
    let input: string[]
    try {
      input = lyricLines(text)
    } catch (e) {
      setError((e as Error).message)
      return
    }
    if (!window.isSecureContext) {
      setError('Open this test on localhost or HTTPS for browser inference.')
      return
    }
    setLines(input)
    setResults({})
    setStats(null)
    setLoadMs(null)
    setError('')
    setNotice('')
    setBusy(true)
    setBackend('')
    setCopied(null)
    meta.current = {
      appVersion: __APP_VERSION__,
      requestedMode: mode,
      source,
      song: SONG,
      startedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
    }
    launch(mode, input)
  }
  function launch(selected: Mode, input: string[]) {
    worker.current?.terminate()
    clearTimeout(timer.current)
    setStatus('Starting browser inference…')
    setProgress(null)
    let instance: Worker
    try {
      instance = new Worker(`/g2p-worker.js?v=${__APP_VERSION__}`)
    } catch (e) {
      setError(`Could not start the browser worker: ${(e as Error).message}`)
      setBusy(false)
      return
    }
    worker.current = instance
    const armTimeout = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        if (worker.current !== instance) return
        instance.terminate()
        worker.current = null
        setBusy(false)
        setProgress(null)
        setError(
          'No progress for two minutes. Check your connection and try Browser CPU. Finished lines remain below.',
        )
      }, 120000)
    }
    armTimeout()
    instance.onerror = (event) => {
      if (worker.current !== instance) return
      clearTimeout(timer.current)
      instance.terminate()
      worker.current = null
      setBusy(false)
      setProgress(null)
      setError(event.message || 'The browser worker could not load. Try Browser CPU or reload.')
    }
    instance.onmessage = ({ data }) => {
      if (worker.current !== instance) return
      armTimeout()
      if (data.backend) setBackend(data.backend)
      if (data.type === 'status') {
        setStatus(data.message)
        setProgress(data.total ? Math.min(1, data.loaded / data.total) : null)
      } else if (data.type === 'notice')
        setNotice((previous) => [previous, data.message].filter(Boolean).join(' '))
      else if (data.type === 'ready') {
        setLoadMs(data.loadMs)
        meta.current = { ...meta.current, revision: data.revision, runtime: data.runtime }
      } else if (data.type === 'line') {
        setResults((previous) => ({ ...previous, [data.index]: data }))
        setProgress(null)
      } else if (data.type === 'done') {
        setStats(data)
        setStatus('Finished. These are Negara’s outputs, without pronunciation corrections.')
        setBusy(false)
        setProgress(null)
        clearTimeout(timer.current)
        instance.terminate()
        worker.current = null
      } else if (data.type === 'error') {
        clearTimeout(timer.current)
        instance.terminate()
        worker.current = null
        if (data.fallback) {
          meta.current = { ...meta.current, gpuFailure: data.message }
          setNotice(
            `WebGPU could not finish (${data.message}). Restarting this run on browser CPU.`,
          )
          setResults({})
          setLoadMs(null)
          launch('wasm', input)
        } else {
          setError(data.message)
          setBusy(false)
          setProgress(null)
          setStatus('Run could not finish. Finished lines remain below.')
        }
      }
    }
    instance.postMessage({ type: 'run', mode: selected, lines: input })
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
      backend,
      stats,
      loadMs,
      complete: Boolean(stats),
      lines: lines.map((persian, index) => ({ ...results[index], index, persian })),
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'hamava-del-bordi-negara.json'
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
          <span className="preview-pill">Browser experiment · v{__APP_VERSION__}</span>
          <h1>
            Del Bordi
            <span lang="fa" dir="rtl">
              دل بردی
            </span>
          </h1>
          <p>Mohammad-Reza Shajarian · Payame Nasim</p>
          <p className="g2p-subtitle">
            Persian in. Finglish from Negara. Read each line as it appears.
          </p>
        </header>
        <section className="g2p-controls" aria-label="Test controls">
          <div className="g2p-control-row">
            <label>
              Run on
              <select
                value={mode}
                disabled={busy}
                onChange={(e) => setMode(e.target.value as Mode)}
              >
                <option value="auto">Automatic · try WebGPU first</option>
                <option value="wasm">Browser CPU · WASM</option>
                <option value="webgpu">WebGPU · test explicitly</option>
              </select>
            </label>
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
            First run downloads about 33 MB of model weights plus browser runtime. Inference stays
            on this device. No Cloudflare AI calls.
          </p>
          <details className="g2p-source">
            <summary>Persian source · {source}</summary>
            <p>
              <a href={SONG.url} target="_blank" rel="noreferrer">
                View the LRCLIB record
              </a>
              . Text only; this test does not play or sync audio.
            </p>
            <button
              className="g2p-secondary"
              disabled={busy || fetching}
              onClick={() => void loadSong()}
            >
              {fetching ? 'Loading lyrics…' : 'Reload Del Bordi lyrics'}
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
                setSource('Edited / pasted Persian')
              }}
            />
          </details>
        </section>
        <section className="g2p-status" aria-label="Run progress">
          <div>
            <strong>{engineName(backend)}</strong>
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
              {seconds(stats.elapsedMs)} · {stats.uniqueLines} unique completed lines
            </p>
          ) : (
            loadMs !== null && <p className="g2p-small">Model setup {seconds(loadMs)}</p>
          )}
          {backend === 'webgpu' && (
            <p className="g2p-small">
              WebGPU is enabled; unsupported operations may run on CPU. This is not a claim that
              every operation uses the GPU.
            </p>
          )}
        </section>
        <ol className="g2p-lines" aria-label="Persian and generated Finglish">
          {lines.map((persian, index) => {
            const result = results[index]
            return (
              <li key={index} className={result ? 'g2p-line ready' : 'g2p-line'}>
                <div className="g2p-line-top">
                  <span>LINE {String(index + 1).padStart(2, '0')}</span>
                  {result && (
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
                  {result ? result.finglish : busy ? 'Waiting for this line…' : 'Not generated'}
                </p>
                {result && (
                  <>
                    <div className="g2p-small">
                      {result.cached
                        ? 'Repeated line · reused this run'
                        : `${Math.round(result.ms)} ms`}
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
