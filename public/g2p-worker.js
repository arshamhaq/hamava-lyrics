/* Isolated Negara v7 evaluation. No server inference or pronunciation corrections. */
const REVISION = '5720b2c489764572a5c8b55ea7b8d910258c88ef'
const MODEL_BASE = `https://huggingface.co/Reza2kn/gooya-v1-ONNX-fp16/resolve/${REVISION}/negara-g2p-v7/onnx/`
const DOWNLOAD_BASE = `/engine-assets/negara-${REVISION}/`
const RUNTIME = new URL('/engine-assets/ort-1.27.0/', self.location.origin).href
const CACHE = `hamava-negara-${REVISION}`
const FILES = [
  [
    'encoder_model.onnx',
    'afc0e170889d9d45cea25f1a3403bd84dcbfc95a069175ebb2233ca277501a98',
    13423062,
  ],
  [
    'decoder_model_merged.onnx',
    'ab093ac2f317a9bdcadc0a38b812f3c3506d0b6b8a58809acfa9f2b64366399c',
    19858779,
  ],
]
let activeJob = null
const send = (type, data = {}) => postMessage({ type, jobId: activeJob?.id, ...data })
const yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0))
const checkCancelled = () => {
  if (activeJob?.cancelled) throw new DOMException('Cancelled', 'AbortError')
}
const normalize = (text) =>
  text
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064b-\u0652\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
// Longest token first: raw "oun" must not become "ooon". Keep raw phones in results.
const finglish = (raw) =>
  raw.replace(
    /ou|[SCZxqAu]/g,
    (phone) => ({ ou: 'oo', S: 'sh', C: 'ch', Z: 'zh', x: 'kh', q: 'gh', A: 'a', u: 'oo' })[phone],
  )
const dispose = (values) => {
  for (const t of new Set(values)) t?.dispose()
}
async function modelFile([name, hash, size]) {
  const url = MODEL_BASE + name
  let cache
  try {
    cache = await caches.open(CACHE)
  } catch {
    /* Private browsing may disable storage. */
  }
  let cached
  try {
    cached = await cache?.match(url)
  } catch {
    /* Storage may be unavailable. */
  }
  let bytes
  if (cached) {
    send('status', { message: `Reading cached ${name}…` })
    bytes = await cached.arrayBuffer()
  } else {
    send('status', { message: `Downloading ${name}…`, loaded: 0, total: size })
    const controller = new AbortController()
    let timeout = setTimeout(() => controller.abort(), 120000)
    try {
      const response = await fetch(DOWNLOAD_BASE + name, { signal: controller.signal })
      if (!response.ok)
        throw new Error(
          `${name} download returned HTTP ${response.status}. Reload Hamava and retry.`,
        )
      if (response.headers.get('Content-Type')?.includes('text/html'))
        throw new Error(
          `${name} is missing from this deployment. Rebuild and deploy Hamava with its engine assets.`,
        )
      if (!response.body) throw new Error('Could not stream the model download.')
      const reader = response.body.getReader(),
        chunks = []
      let loaded = 0,
        lastNotice = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        clearTimeout(timeout)
        timeout = setTimeout(() => controller.abort(), 120000)
        loaded += value.byteLength
        if (loaded > size) throw new Error('Model size did not match the pinned release.')
        chunks.push(value)
        if (performance.now() - lastNotice > 150) {
          send('status', { message: `Downloading ${name}…`, loaded, total: size })
          lastNotice = performance.now()
        }
      }
      bytes = new Uint8Array(loaded)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.length
      }
      bytes = bytes.buffer
    } catch (error) {
      throw new Error(
        `${name} could not download from Hamava. Check your connection and retry. ${error.message || error}`,
      )
    } finally {
      clearTimeout(timeout)
      controller.abort()
    }
  }
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
  if (bytes.byteLength !== size || digest !== hash) {
    await cache?.delete(url)
    throw new Error('Model integrity check failed. Run again to download a fresh copy.')
  }
  if (cache && !cached) {
    try {
      await cache.put(
        url,
        new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }),
      )
    } catch {
      send('notice', { message: 'Model caching is unavailable; this run still works.' })
    }
  }
  return bytes
}
async function generate(encoder, decoder, text, limit = 512) {
  const input = new TextEncoder().encode(normalize(text))
  if (!input.length || input.length > 512) throw new Error('A line must contain 1–512 UTF-8 bytes.')
  const ids = new ort.Tensor(
    'int64',
    BigInt64Array.from(input, (v) => BigInt(v + 3)),
    [1, input.length],
  )
  const mask = new ort.Tensor(
    'int64',
    BigInt64Array.from(input, () => 1n),
    [1, input.length],
  )
  let encoded = {},
    past = {},
    stopped = false
  const tokens = []
  try {
    encoded = await encoder.run({ input_ids: ids, attention_mask: mask })
    for (const name of decoder.inputNames.filter((n) => n.startsWith('past_key_values.')))
      past[name] = new ort.Tensor('float32', new Float32Array(0), [1, 6, 0, 64])
    let token = 0
    for (let step = 0; step < limit; step++) {
      if (step % 16 === 0) await yieldTask()
      checkCancelled()
      const nextId = new ort.Tensor('int64', BigInt64Array.of(BigInt(token)), [1, 1])
      const branch = new ort.Tensor('bool', Uint8Array.of(step > 0 ? 1 : 0), [1])
      let output
      try {
        output = await decoder.run({
          input_ids: nextId,
          encoder_hidden_states: encoded.last_hidden_state,
          encoder_attention_mask: mask,
          use_cache_branch: branch,
          ...past,
        })
      } finally {
        nextId.dispose()
        branch.dispose()
      }
      try {
        const logits = output.logits.data,
          vocab = output.logits.dims.at(-1),
          offset = logits.length - vocab
        token = 0
        for (let i = 1; i < vocab; i++) if (logits[offset + i] > logits[offset + token]) token = i
        if (!Number.isFinite(logits[offset + token]))
          throw new Error('The model produced invalid logits.')
        if (token === 1) {
          stopped = true
          break
        }
        if (token < 3 || token > 258)
          throw new Error(`Unexpected output token ${token}; refusing to silently drop it.`)
        tokens.push(token - 3)
        const nextPast = {}
        for (const name of Object.keys(past)) {
          const present = output[name.replace('past_key_values.', 'present.')]
          if (!present) throw new Error(`Missing decoder cache: ${name}`)
          // Cached branch has empty cross-attention outputs; retain the first real tensors.
          nextPast[name] = name.includes('.encoder.') && step > 0 ? past[name] : present
        }
        const retained = new Set(Object.values(nextPast))
        dispose(Object.values(past).filter((t) => !retained.has(t)))
        past = nextPast
      } finally {
        const retained = new Set(Object.values(past))
        dispose(Object.values(output).filter((t) => !retained.has(t)))
      }
    }
    // A truncated byte sequence may end mid-character. Never decode or publish it.
    const raw = stopped
      ? new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(tokens))
      : ''
    return { raw, finglish: finglish(raw), truncated: !stopped, tokens: tokens.length }
  } finally {
    dispose([ids, mask, ...Object.values(encoded), ...Object.values(past)])
  }
}

// Retry only incomplete generation. Keep the caller's lyric row and IDs intact.
function splitPhrase(text) {
  const boundaries = [...text.matchAll(/\s+/g)].map((match) => ({
    offset: match.index,
    end: match.index + match[0].length,
    punctuation: /[،,؛;:!؟?。.…)\]]$/.test(text.slice(0, match.index)),
  }))
  if (!boundaries.length) return null
  const middle = text.length / 2
  const candidates = boundaries.filter(
    (b) => b.punctuation && b.offset >= text.length / 4 && b.end <= (text.length * 3) / 4,
  )
  const best = (candidates.length ? candidates : boundaries).sort(
    (a, b) => Math.abs(a.offset - middle) - Math.abs(b.offset - middle),
  )[0]
  return [text.slice(0, best.offset).trim(), text.slice(best.end).trim()]
}
function expandedOutput(input, output) {
  const words = (text) => text.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length
  const letters = (text) => (text.match(/\p{L}/gu) || []).length
  return (
    words(output) > words(input) + Math.max(1, Math.floor(words(input) / 4)) ||
    letters(output) > Math.max(12, letters(input) * 3)
  )
}
async function recoverLine(text, infer = (part, limit) => generate(encoder, decoder, part, limit)) {
  const budget = { attempts: 0, tokens: 0, split: false }
  const phrases = new Map()
  // Repeated words in this same failed line keep the same pronunciation.
  // Ignore only surrounding punctuation, never words or internal spacing.
  const phraseKey = (part) => part.replace(/^[\s،,؛;:!؟?.…()\[\]«»]+|[\s،,؛;:!؟?.…()\[\]«»]+$/g, '')
  const run = async (part, depth) => {
    checkCancelled()
    const key = phraseKey(part)
    if (phrases.has(key)) return phrases.get(key)
    if (budget.attempts >= 15 || budget.tokens >= 2048) return null
    budget.attempts++
    const limit = depth === 0 ? 512 : Math.min(256, Math.max(48, part.length * 4))
    const result = await infer(part, Math.min(limit, 2048 - budget.tokens))
    budget.tokens += result.tokens
    checkCancelled()
    if (
      !result.truncated &&
      result.finglish.trim() &&
      (depth === 0 || !expandedOutput(part, result.raw))
    ) {
      phrases.set(key, result)
      return result
    }
    if (depth >= 4) return null
    const parts = splitPhrase(part)
    if (!parts || parts.some((p) => !p)) return null
    budget.split = true
    send('status', { message: 'Reading a difficult line in smaller phrases…', backend: 'wasm' })
    const left = await run(parts[0], depth + 1)
    if (!left) return null
    const right = await run(parts[1], depth + 1)
    if (!right) return null
    return {
      raw: `${left.raw.trim()} ${right.raw.trim()}`,
      finglish: `${left.finglish.trim()} ${right.finglish.trim()}`,
      truncated: false,
    }
  }
  const result = await run(text, 0)
  return result
    ? { ...result, recovered: budget.split, tokens: budget.tokens }
    : {
        raw: '',
        finglish: '',
        truncated: false,
        tokens: budget.tokens,
        error: 'Could not convert this line after smaller-phrase retries. Original Persian kept.',
      }
}

// Sessions and completed lines survive song changes until this document closes.
let encoder,
  decoder,
  runtimeLoaded = false
const completed = new Map()
async function ensureLoaded() {
  if (encoder && decoder) return true
  send('status', { message: 'Loading browser CPU runtime…', backend: 'wasm' })
  if (!runtimeLoaded) {
    try {
      importScripts(RUNTIME + 'ort.wasm.min.js')
    } catch {
      throw new Error(
        'The browser CPU runtime could not load from Hamava. Reload the app and retry.',
      )
    }
    ort.env.wasm.numThreads = 1
    ort.env.wasm.proxy = false
    ort.env.wasm.wasmPaths = RUNTIME
    runtimeLoaded = true
  }
  try {
    const options = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }
    const encoderBytes = await modelFile(FILES[0])
    send('status', { message: 'Preparing encoder…' })
    encoder = await ort.InferenceSession.create(encoderBytes, options)
    const decoderBytes = await modelFile(FILES[1])
    send('status', { message: 'Preparing decoder…' })
    decoder = await ort.InferenceSession.create(decoderBytes, options)
  } catch (error) {
    await encoder?.release()
    encoder = null
    await decoder?.release()
    decoder = null
    throw error
  }
  return false
}
onmessage = async ({ data }) => {
  if (data.type === 'cancel') {
    if (activeJob?.id === data.jobId) activeJob.cancelled = true
    return
  }
  if (data.type !== 'run') return
  if (activeJob) {
    postMessage({ type: 'error', jobId: data.jobId, message: 'The converter is busy.' })
    return
  }
  activeJob = { id: data.jobId, cancelled: false }
  const started = performance.now()
  try {
    if (
      !Array.isArray(data.lines) ||
      !data.lines.length ||
      data.lines.length > 1000 ||
      data.lines.some((s) => typeof s !== 'string')
    )
      throw new Error('Invalid lyric lines.')
    const warm = await ensureLoaded()
    checkCancelled()
    const loadMs = warm ? 0 : performance.now() - started
    send('ready', { backend: 'wasm', warm, loadMs, revision: REVISION, runtime: '1.27.0' })
    let inferenceMs = 0,
      generatedLines = 0
    const unique = new Set()
    const failed = new Map() // Avoid retrying identical failures repeatedly within one song.
    let failedLines = 0,
      recoveredLines = 0
    for (let index = 0; index < data.lines.length; index++) {
      await yieldTask()
      checkCancelled()
      const key = normalize(data.lines[index])
      send('status', {
        message: `Reading line ${index + 1} of ${data.lines.length}…`,
        backend: 'wasm',
      })
      const cached = completed.has(key),
        begin = performance.now()
      const result = !key
        ? { raw: '', finglish: '', tokens: 0, truncated: false }
        : cached
          ? completed.get(key)
          : failed.get(key) || (await recoverLine(key))
      checkCancelled()
      const ms = cached || !key ? 0 : performance.now() - begin
      inferenceMs += ms
      if (result.error) {
        failedLines++
        failed.set(key, result)
        send('line-error', { index, ...result, ms, cached: false, backend: 'wasm' })
        continue
      }
      if (result.recovered) recoveredLines++
      if (key) {
        unique.add(key)
        if (!cached) {
          generatedLines++
          completed.set(key, result)
          if (completed.size > 2048) completed.delete(completed.keys().next().value)
        }
      }
      send('line', { index, ...result, ms, cached, backend: 'wasm' })
    }
    send('done', {
      failedLines,
      recoveredLines,
      backend: 'wasm',
      warm,
      loadMs,
      inferenceMs,
      elapsedMs: performance.now() - started,
      uniqueLines: unique.size,
      generatedLines,
    })
  } catch (error) {
    send(error?.name === 'AbortError' ? 'cancelled' : 'error', {
      message: String(error?.message || error),
    })
  } finally {
    activeJob = null
  }
}
