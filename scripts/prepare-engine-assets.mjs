// Download once at build time; browsers fetch these verified files from Hamava.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const revision = '5720b2c489764572a5c8b55ea7b8d910258c88ef'
const model = `https://huggingface.co/Reza2kn/gooya-v1-ONNX-fp16/resolve/${revision}/negara-g2p-v7/onnx/`
const runtime = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'
const files = [
  [
    'model',
    `negara-${revision}`,
    'encoder_model.onnx',
    model,
    13423062,
    'afc0e170889d9d45cea25f1a3403bd84dcbfc95a069175ebb2233ca277501a98',
  ],
  [
    'model',
    `negara-${revision}`,
    'decoder_model_merged.onnx',
    model,
    19858779,
    'ab093ac2f317a9bdcadc0a38b812f3c3506d0b6b8a58809acfa9f2b64366399c',
  ],
  [
    'runtime',
    'ort-1.27.0',
    'ort.wasm.min.js',
    runtime,
    50139,
    'ea3a767b15df7dbe3d695ec9c182ca0f15b2ce7750156c6b70276e11c28997f0',
  ],
  [
    'runtime',
    'ort-1.27.0',
    'ort-wasm-simd-threaded.mjs',
    runtime,
    24180,
    '0a1e718d99c41b22c21f2520ff4f9e883a6b5533856e398d21816ee8eb8185d3',
  ],
  [
    'runtime',
    'ort-1.27.0',
    'ort-wasm-simd-threaded.wasm',
    runtime,
    13479978,
    'd1ab1b94b16a65b29d710d0b587b29e7bed336827577623913479b8afe8113e6',
  ],
]
for (const [group, directory, name, base, size, hash] of files) {
  const target = path.join(root, 'public/engine-assets', directory, name)
  const valid = (bytes) =>
    bytes.length === size && createHash('sha256').update(bytes).digest('hex') === hash
  let bytes
  try {
    const existing = await readFile(target)
    if (valid(existing)) continue
  } catch {}
  try {
    const local = await readFile(path.join(root, 'research-private/browser-g2p', group, name))
    if (valid(local)) bytes = local
  } catch {}
  if (!bytes) {
    console.log(`Downloading ${name}…`)
    const response = await fetch(base + name, { signal: AbortSignal.timeout(180000) })
    if (!response.ok)
      throw new Error(
        `${name}: HTTP ${response.status}. Build stopped; rerun when the download is reachable.`,
      )
    bytes = Buffer.from(await response.arrayBuffer())
    if (!valid(bytes)) throw new Error(`${name}: pinned SHA-256 or size mismatch. Build stopped.`)
  }
  if (bytes.length > 25 * 1024 * 1024)
    throw new Error(`${name} exceeds Cloudflare's per-asset limit.`)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target + '.part', bytes)
  await rename(target + '.part', target)
  console.log(`Prepared ${name} (${(bytes.length / 1e6).toFixed(1)} MB)`)
}
await copyFile(
  path.join(root, 'docs/onnxruntime-LICENSE.txt'),
  path.join(root, 'public/engine-assets/ort-1.27.0/LICENSE.txt'),
)
console.log('Browser engine assets verified. No model download is needed during deployment.')
