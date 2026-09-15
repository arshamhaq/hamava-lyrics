import { test, expect } from '@playwright/test'

test.use({ serviceWorkers: 'block' })
const lyrics = 'سلام\nسلام\nخداحافظ'
const fakeWorker = `onmessage = ({data}) => {
 if(data.mode==='auto'){postMessage({type:'error',message:'GPU test failure',fallback:true});return;}
 postMessage({type:'ready',backend:'wasm',loadMs:10,revision:'test',runtime:'test'});
 data.lines.forEach((line,index)=>setTimeout(()=>{
  postMessage({type:'line',index,raw:index===2?'xodAhAfez':'salAm',finglish:index===2?'khodahafez':'salam',cached:index===1,truncated:false,ms:2,tokens:5,backend:'wasm'});
  if(index===data.lines.length-1)postMessage({type:'done',backend:'wasm',loadMs:10,inferenceMs:4,elapsedMs:16,uniqueLines:2});
 },400*(index+1)));
}`
test.beforeEach(async ({ context }) => {
  await context.route('https://lrclib.net/api/get/13708175', (r) =>
    r.fulfill({
      json: { id: 13708175, plainLyrics: lyrics },
      headers: { 'access-control-allow-origin': '*' },
    }),
  )
  await context.route('**/g2p-worker.js*', (r) =>
    r.fulfill({ body: fakeWorker, contentType: 'text/javascript' }),
  )
})
test('progress, GPU fallback, per-line copy and downloadable results', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/g2p')
  await page.getByRole('combobox').selectOption('auto')
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.getByText(/Restarting this run on browser CPU/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  await expect(page.locator('.g2p-line.ready')).toHaveCount(3)
  await expect(page.locator('.g2p-finglish')).toHaveText(['salam', 'salam', 'khodahafez'])
  await page.getByRole('button', { name: 'Copy line 3', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('khodahafez')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save results' }).click()
  expect((await downloaded).suggestedFilename()).toBe('hamava-del-bordi-negara.json')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('stop retains completed lines; rerun clears prior results', async ({ page, context }) => {
  let loads = 0
  let releaseRerun!: () => void
  const rerunGate = new Promise<void>((resolve) => {
    releaseRerun = resolve
  })
  await context.route('**/g2p-worker.js*', async (route) => {
    loads++
    if (loads > 1) await rerunGate
    const body =
      loads === 1 ? fakeWorker.replace('400*(index+1)', 'index === 0 ? 10 : 60000') : fakeWorker
    await route.fulfill({ body, contentType: 'text/javascript' })
  })
  await page.goto('/g2p')
  await page.getByRole('combobox').selectOption('wasm')
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.locator('.g2p-line.ready')).toHaveCount(1)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.waitForTimeout(1000)
  await expect(page.locator('.g2p-line.ready')).toHaveCount(1)
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.locator('.g2p-line.ready')).toHaveCount(0)
  releaseRerun()
  await expect(page.locator('.g2p-line.ready')).toHaveCount(3)
})
test('failed lyric fetch allows manual Persian input', async ({ page, context }) => {
  await context.route('https://lrclib.net/api/get/13708175', (r) =>
    r.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } }),
  )
  await page.goto('/g2p')
  await expect(page.getByRole('alert')).toContainText('503')
  await page.getByText(/Persian source ·/).click()
  await page
    .getByLabel('Persian lyrics (you can edit or paste text if LRCLIB cannot load)')
    .fill('سلام')
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.locator('.g2p-line.ready')).toHaveCount(1)
})
