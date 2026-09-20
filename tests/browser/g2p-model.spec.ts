import { test, expect } from '@playwright/test'
test.beforeEach(async ({ context }) => {
  await context.route('**/api/lyrics-health', (r) =>
    r.fulfill({ json: { reachable: true, checkedAt: Date.now() } }),
  )
})

test.use({ serviceWorkers: 'block' })
import { readFile } from 'node:fs/promises'
import path from 'node:path'
// Opt-in: actual downloaded binaries, no mock model predictions or baked Finglish.
const assets = process.env.HAMAVA_G2P_ASSETS

test('real WASM model: full song, repeat reuse, cached rerun and raw parity', async ({
  page,
  context,
}, info) => {
  test.skip(
    !assets,
    'Set HAMAVA_G2P_ASSETS to the private folder with model/, runtime/, song.json.',
  )
  test.setTimeout(120000)
  const root = assets!
  const song = JSON.parse(await readFile(path.join(root, 'song.json'), 'utf8'))
  const count = song.plainLyrics.split(/\r?\n/).filter((s: string) => s.trim()).length
  let modelRequests = 0
  let runtimeRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/ort.wasm.min.js')) runtimeRequests++
  })
  await context.route('https://lrclib.net/api/get/13708175', (r) =>
    r.fulfill({ json: song, headers: { 'access-control-allow-origin': '*' } }),
  )
  const externalRequests: string[] = []
  await context.route(/https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\//, (r) => {
    externalRequests.push(r.request().url())
    return r.abort()
  })
  // Exercise the actual built assets, with all former CDN/model hosts blocked.
  page.on('request', (request) => {
    if (request.url().includes('/engine-assets/') && request.url().endsWith('.onnx'))
      modelRequests++
  })
  await page.goto('/g2p')
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.getByRole('status')).toContainText('Finished.', { timeout: 90000 })
  await expect(page.locator('.g2p-line.ready')).toHaveCount(count)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.getByText('Reused from this session', { exact: true }).count()).toBeGreaterThan(
    0,
  )
  expect(modelRequests).toBe(2)
  await expect(page.getByRole('progressbar', { name: 'Finglish reader download' })).toHaveAttribute(
    'value',
    '100',
  )
  const raw = await page.locator('.g2p-raw code').allTextContents()
  expect(raw.every(Boolean)).toBe(true)
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save results' }).click()
  await (await downloaded).saveAs(info.outputPath('cpu-reader-results.json'))
  await page.screenshot({ path: info.outputPath('g2p.png') })
  console.log(info.project.name, await page.locator('.g2p-status').innerText())
  // Reference sentences already measured with native v7; display style is not the oracle.
  await page.getByText(/Persian source ·/).click()
  await page
    .getByLabel('Persian lyrics (you can edit or paste text if LRCLIB cannot load)')
    .fill('امشب می‌خوام باهات حرف بزنم\nامشب می‌خوام باهات حرف بزنم\nامید توی دلش مرد')
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.getByRole('status')).toContainText('Finished.', { timeout: 60000 })
  await expect(page.locator('.g2p-raw code')).toHaveText([
    'emSab mikhAm bAhat harf bezanam',
    'emSab mikhAm bAhat harf bezanam',
    'omid tuye delaS mord',
  ])
  expect(modelRequests).toBe(2)
  expect(runtimeRequests).toBe(1)
  await expect(page.getByText('Browser CPU · model already ready', { exact: true })).toBeVisible()
  await expect(page.locator('.g2p-status')).toContainText('Model setup 0.00 s')
  await page.reload()
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.getByRole('status')).toContainText('Finished.', { timeout: 60000 })
  expect(externalRequests).toEqual([])
  await expect(page.locator('.model-download')).toHaveCount(0)
  expect(modelRequests).toBe(2) // Fresh document initializes sessions from cached weights.
})

test('search converts a selected song with the shipped CPU engine and no external model hosts', async ({
  page,
  context,
}) => {
  test.skip(!assets, 'Set HAMAVA_G2P_ASSETS for the real song fixture.')
  test.setTimeout(120000)
  const song = JSON.parse(await readFile(path.join(assets!, 'song.json'), 'utf8'))
  const count = song.plainLyrics.split(/\r?\n/).filter((s: string) => s.trim()).length
  await context.route('**/api/search?*', (r) =>
    r.fulfill({
      json: {
        songs: [
          {
            provider: 'lrclib',
            id: String(song.id),
            title: song.trackName,
            artist: song.artistName,
            album: song.albumName,
            duration: song.duration,
            hasLyrics: true,
          },
        ],
      },
    }),
  )
  await context.route('**/api/lyrics?*', (r) =>
    r.fulfill({
      json: {
        title: song.trackName,
        artist: song.artistName,
        album: song.albumName,
        duration: song.duration,
        text: song.plainLyrics,
        source: 'LRCLIB',
        sourceUrl: 'https://lrclib.net/',
      },
    }),
  )
  const external: string[] = []
  await context.route(/https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\//, (r) => {
    external.push(r.request().url())
    return r.abort()
  })
  await page.goto('/search')
  await page.getByRole('combobox').fill('del bordi')
  await page.getByRole('option').click()
  await expect(page.locator('.reading-status')).toContainText('Ready · saved', { timeout: 90000 })
  await expect(page.locator('.song-reader-lines [lang="fa-Latn"]')).toHaveCount(count)
  await expect(page.getByRole('button', { name: /Follow|Play|Pause/i })).toHaveCount(0)
  expect(external).toEqual([])
})
