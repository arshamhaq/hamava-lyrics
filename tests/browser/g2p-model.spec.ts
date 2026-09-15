import { test, expect } from '@playwright/test'

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
  await context.route('https://lrclib.net/api/get/13708175', (r) =>
    r.fulfill({ json: song, headers: { 'access-control-allow-origin': '*' } }),
  )
  await context.route('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/**', async (r) => {
    const name = new URL(r.request().url()).pathname.split('/').at(-1)!
    await r.fulfill({
      path: path.join(root, 'runtime', name),
      contentType: name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
      headers: { 'access-control-allow-origin': '*' },
    })
  })
  await context.route('https://huggingface.co/**', async (r) => {
    modelRequests++
    const name = new URL(r.request().url()).pathname.split('/').at(-1)!
    await r.fulfill({
      path: path.join(root, 'model', name),
      contentType: 'application/octet-stream',
      headers: { 'access-control-allow-origin': '*' },
    })
  })
  await page.goto('/g2p')
  await page.getByRole('combobox').selectOption('wasm')
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.getByRole('status')).toContainText('Finished.', { timeout: 90000 })
  await expect(page.locator('.g2p-line.ready')).toHaveCount(count)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(
    await page.getByText('Repeated line · reused this run', { exact: true }).count(),
  ).toBeGreaterThan(0)
  expect(modelRequests).toBe(2)
  const raw = await page.locator('.g2p-raw code').allTextContents()
  expect(raw.every(Boolean)).toBe(true)
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save results' }).click()
  await (await downloaded).saveAs(info.outputPath('del-bordi-results.json'))
  await page.screenshot({ path: info.outputPath('g2p.png') })
  console.log(info.project.name, await page.locator('.g2p-status').innerText())
  // Reference sentences already measured with native v7; display style is not the oracle.
  await page.getByText(/Persian source ·/).click()
  await page
    .getByLabel('Persian lyrics (you can edit or paste text if LRCLIB cannot load)')
    .fill('امشب می‌خوام باهات حرف بزنم\nامشب می‌خوام باهات حرف بزنم\nامید توی دلش مرد')
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.getByRole('status')).toContainText('Finished.', { timeout: 60000 })
  await expect(page.locator('.g2p-raw code')).toHaveText([
    'emSab mikhAm bAhat harf bezanam',
    'emSab mikhAm bAhat harf bezanam',
    'omid tuye delaS mord',
  ])
  expect(modelRequests).toBe(2)
})
