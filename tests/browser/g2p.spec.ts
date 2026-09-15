import { test, expect } from '@playwright/test'
test.use({ serviceWorkers: 'block' })
const lyrics = 'سلام\nسلام\nخداحافظ'
const fakeWorker = `let runs=0,timers=[];
onmessage=({data})=>{
 if(data.type==='cancel'){timers.forEach(clearTimeout);postMessage({type:'cancelled',jobId:data.jobId});return;}
 if(data.type!=='run')return;
 runs++;const warm=runs>1;const jobId=data.jobId;
 postMessage({type:'ready',jobId,backend:'wasm',warm,loadMs:warm?0:10,revision:'test',runtime:'test'});
 data.lines.forEach((line,index)=>timers.push(setTimeout(()=>{
  postMessage({type:'line',jobId,index,raw:line==='خداحافظ'?'xodAhAfez':'salAm',finglish:line==='خداحافظ'?'khodahafez':'salam',cached:index===1||warm,truncated:false,ms:2,tokens:5});
  if(index===data.lines.length-1)postMessage({type:'done',jobId,backend:'wasm',warm,loadMs:warm?0:10,inferenceMs:4,elapsedMs:16,uniqueLines:2,generatedLines:warm?0:2});
 },DELAY)));
}`
test.beforeEach(async ({ context }) => {
  await context.route('https://lrclib.net/api/get/13708175', (r) =>
    r.fulfill({
      json: {
        id: 13708175,
        trackName: 'Tasnife Del Bordi',
        artistName: 'Shajarian',
        plainLyrics: lyrics,
      },
      headers: { 'access-control-allow-origin': '*' },
    }),
  )
  await context.route('**/g2p-worker.js*', (r) =>
    r.fulfill({
      body: fakeWorker.replace('DELAY', '150*(index+1)'),
      contentType: 'text/javascript',
    }),
  )
})
test('legacy live link uses the CPU reader with no credentials, GPU or server AI requests', async ({
  page,
  context,
}) => {
  const cloudRequests: string[] = []
  await context.route('**/api/{song,batch}**', (r) => {
    cloudRequests.push(r.request().url())
    return r.abort()
  })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/?live')
  await expect(page.getByRole('textbox', { name: 'Test passphrase' })).toHaveCount(0)
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.locator('.g2p-finglish')).toHaveText(['salam', 'salam', 'khodahafez'])
  await page.getByRole('button', { name: 'Copy line 3', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('khodahafez')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save results' }).click()
  expect((await downloaded).suggestedFilename()).toBe('hamava-lyrics-negara.json')
  expect(cloudRequests).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('stop retains partial output and rerun reuses the same worker', async ({ page, context }) => {
  let workers = 0
  await context.route('**/g2p-worker.js*', (r) => {
    workers++
    return r.fulfill({
      body: fakeWorker.replace('DELAY', 'runs===1&&index>0?60000:100*(index+1)'),
      contentType: 'text/javascript',
    })
  })
  await page.goto('/lyrics')
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.locator('.g2p-line.ready')).toHaveCount(1)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.waitForTimeout(300)
  await expect(page.locator('.g2p-line.ready')).toHaveCount(1)
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.locator('.g2p-line.ready')).toHaveCount(3)
  await expect(page.getByText('Browser CPU · model already ready', { exact: true })).toBeVisible()
  expect(workers).toBe(1)
})
test('another source record is selected without mixing old song output', async ({
  page,
  context,
}) => {
  await context.route('https://lrclib.net/api/get/99', (r) =>
    r.fulfill({
      json: {
        id: 99,
        trackName: 'Second song',
        artistName: 'Second artist',
        plainLyrics: 'خداحافظ',
      },
      headers: { 'access-control-allow-origin': '*' },
    }),
  )
  await page.goto('/lyrics')
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.locator('.g2p-line.ready')).toHaveCount(3)
  await page.getByText(/Persian source ·/).click()
  await page.getByLabel('LRCLIB record ID').fill('99')
  await page.getByRole('button', { name: 'Load song record' }).click()
  await expect(page.getByRole('heading', { name: 'Second song' })).toBeVisible()
  await expect(page.locator('.g2p-line')).toHaveCount(0)
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.locator('.g2p-finglish')).toHaveText(['khodahafez'])
  await expect(page.getByText('Browser CPU · model already ready', { exact: true })).toBeVisible()
})
test('failed lyrics fetch permits a pasted source', async ({ page, context }) => {
  await context.route('https://lrclib.net/api/get/13708175', (r) =>
    r.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' } }),
  )
  await page.goto('/lyrics')
  await expect(page.getByRole('alert')).toContainText('503')
  await page.getByText(/Persian source ·/).click()
  await page
    .getByLabel('Persian lyrics (you can edit or paste text if LRCLIB cannot load)')
    .fill('سلام')
  await page.getByRole('button', { name: 'Read with Negara' }).click()
  await expect(page.locator('.g2p-line.ready')).toHaveCount(1)
})
