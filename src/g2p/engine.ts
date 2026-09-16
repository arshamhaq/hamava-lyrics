export interface SourceLyric {
  id: string
  persian: string
  startMs?: number
  endMs?: number
}
export interface LineOutput {
  raw: string
  finglish: string
  ms: number
  cached: boolean
  tokens: number
  truncated: false
  error?: string
  recovered?: boolean
}
export interface ConversionStats {
  backend: 'wasm'
  warm: boolean
  loadMs: number
  inferenceMs: number
  elapsedMs: number
  uniqueLines: number
  generatedLines: number
  failedLines?: number
  recoveredLines?: number
}
export type EngineEvent = {
  type: 'status' | 'notice' | 'ready'
  message?: string
  loaded?: number
  total?: number
  warm?: boolean
  loadMs?: number
  revision?: string
  runtime?: string
}
type Options<T> = {
  signal?: AbortSignal
  onLine?: (line: T & LineOutput, index: number) => void
  onEvent?: (event: EngineEvent) => void
}
export type Conversion<T> = { lines: (T & LineOutput)[]; stats: ConversionStats }
type Job = {
  id: number
  input: readonly SourceLyric[]
  output: (SourceLyric & LineOutput)[]
  onLine?: (line: SourceLyric & LineOutput, index: number) => void
  onEvent?: (event: EngineEvent) => void
  resolve: (value: Conversion<SourceLyric>) => void
  reject: (error: Error) => void
  cleanup: () => void
  settled: boolean
}
const aborted = () => new DOMException('Conversion cancelled.', 'AbortError')

// One CPU worker per document. Consumers own their source metadata and cancellation.
export class LyricsEngine {
  private worker: Worker | null = null
  private active: Job | null = null
  private queue: Job[] = []
  private nextId = 0
  private watchdog?: ReturnType<typeof setTimeout>
  constructor(
    private createWorker: () => Worker = () => new Worker(`/g2p-worker.js?v=${__APP_VERSION__}`),
  ) {}

  convert<T extends SourceLyric>(
    source: readonly T[],
    options: Options<T> = {},
  ): Promise<Conversion<T>> {
    const lines = source.map((line) => ({ ...line }))
    if (
      !lines.length ||
      lines.length > 1000 ||
      new Set(lines.map((l) => l.id)).size !== lines.length ||
      lines.some(
        (l) =>
          typeof l.id !== 'string' ||
          !l.id ||
          typeof l.persian !== 'string' ||
          new TextEncoder().encode(l.persian.normalize('NFKC')).length > 512,
      )
    )
      return Promise.reject(
        new Error(
          'Use distinct line IDs and at most 1,000 lines of 512 UTF-8 bytes each. Split longer lines before converting.',
        ),
      )
    if (options.signal?.aborted) return Promise.reject(aborted())
    return new Promise<Conversion<T>>((resolve, reject) => {
      const job: Job = {
        id: ++this.nextId,
        input: lines,
        output: new Array(lines.length),
        settled: false,
        onLine: options.onLine as Job['onLine'],
        onEvent: options.onEvent,
        resolve: (value) => resolve(value as Conversion<T>),
        reject,
        cleanup: () => {},
      }
      const cancel = () => {
        if (job.settled) return
        job.settled = true
        job.cleanup()
        reject(aborted())
        if (this.active === job) this.worker?.postMessage({ type: 'cancel', jobId: job.id })
        else this.queue = this.queue.filter((j) => j !== job)
      }
      job.cleanup = () => options.signal?.removeEventListener('abort', cancel)
      options.signal?.addEventListener('abort', cancel, { once: true })
      this.queue.push(job)
      this.pump()
    })
  }
  private pump() {
    if (this.active || !this.queue.length) return
    this.active = this.queue.shift()!
    try {
      if (!this.worker) {
        const instance = this.createWorker()
        this.worker = instance
        instance.onmessage = ({ data }) => {
          if (this.worker === instance) this.receive(data)
        }
        instance.onerror = (event) => {
          if (this.worker === instance)
            this.fail(
              new Error(
                event.message || 'Browser inference failed. Retry to reload the CPU engine.',
              ),
            )
        }
      }
      this.armWatchdog()
      this.worker.postMessage({
        type: 'run',
        jobId: this.active.id,
        lines: this.active.input.map((l) => l.persian),
      })
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)))
    }
  }
  private armWatchdog() {
    clearTimeout(this.watchdog)
    this.watchdog = setTimeout(
      () =>
        this.fail(
          new Error('No conversion progress for two minutes. Check your connection and retry.'),
        ),
      120000,
    )
  }
  private receive(data: Record<string, any>) {
    const job = this.active
    if (!job || data.jobId !== job.id) return
    this.armWatchdog()
    if (data.type === 'error') {
      this.fail(new Error(String(data.message)))
      return
    }
    if (data.type === 'cancelled') {
      if (!job.settled) {
        job.settled = true
        job.reject(aborted())
      }
      this.finish()
      return
    }
    if (data.type === 'done') {
      if (!job.settled) {
        if (job.output.filter(Boolean).length !== job.input.length) {
          this.fail(new Error('Conversion ended with missing lines.'))
          return
        }
        job.settled = true
        job.resolve({ lines: job.output, stats: data as unknown as ConversionStats })
      }
      this.finish()
      return
    }
    if (job.settled) return // Ignore any result arriving after consumer cancellation.
    if (data.type === 'line' || data.type === 'line-error') {
      const failed = data.type === 'line-error'
      const i = data.index
      if (
        !Number.isInteger(i) ||
        i < 0 ||
        i >= job.input.length ||
        job.output[i] ||
        data.truncated ||
        typeof data.raw !== 'string' ||
        typeof data.finglish !== 'string' ||
        (failed
          ? typeof data.error !== 'string' || !data.error || data.finglish !== '' || data.raw !== ''
          : job.input[i].persian.trim() && !data.finglish.trim())
      ) {
        this.fail(new Error('Invalid or incomplete lyric result.'))
        return
      }
      // Never accept model-provided IDs, source text, timing or other metadata.
      const result = {
        ...job.input[i],
        raw: data.raw,
        finglish: data.finglish,
        ms: Number(data.ms) || 0,
        cached: data.cached === true,
        tokens: Number(data.tokens) || 0,
        truncated: false as const,
        ...(failed ? { error: data.error as string } : {}),
        recovered: data.recovered === true,
      }
      job.output[i] = result
      job.onLine?.(result, i)
    } else if (['status', 'notice', 'ready'].includes(data.type)) job.onEvent?.(data as EngineEvent)
  }
  private finish() {
    clearTimeout(this.watchdog)
    this.active?.cleanup()
    this.active = null
    this.pump()
  }
  private fail(error: Error) {
    this.worker?.terminate()
    this.worker = null
    if (this.active && !this.active.settled) {
      this.active.settled = true
      this.active.reject(error)
    }
    this.finish()
  }
}
export const lyricsEngine = new LyricsEngine()
