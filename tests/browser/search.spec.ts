import { test, expect } from '@playwright/test'
test.use({ serviceWorkers: 'block' })
const first = {
  provider: 'lrclib',
  id: '1',
  title: 'Tasnife Del Bordi',
  artist: 'Shajarian',
  album: 'Payame Nasim',
  duration: 230,
  hasLyrics: true,
}
const second = { ...first, id: '2', title: 'Another Song', artist: 'Another Singer' }
const worker = `let timers=[]; onmessage=({data:d})=>{
 if(d.type==='cancel'){timers.forEach(clearTimeout);postMessage({type:'cancelled',jobId:d.jobId});return}
 postMessage({type:'ready',jobId:d.jobId});
 d.lines.forEach((text,index)=>timers.push(setTimeout(()=>{
  postMessage({type:'line',jobId:d.jobId,index,raw:'salAm',finglish:text==='خداحافظ'?'khodahafez':'salam',truncated:false});
  if(index===d.lines.length-1)postMessage({type:'done',jobId:d.jobId});
 },200*(index+1))));
}`
test.beforeEach(async ({ context }) => {
  await context.route('**/api/lyrics-health', (r) =>
    r.fulfill({ json: { reachable: true, checkedAt: Date.now() } }),
  )
  await context.route('**/api/search?*', (r) =>
    r.fulfill({
      json: {
        songs: new URL(r.request().url()).searchParams.get('q')?.includes('another')
          ? [second]
          : [first],
      },
    }),
  )
  await context.route('**/api/lyrics?*', (r) => {
    const alt = new URL(r.request().url()).searchParams.get('id') === '2'
    return r.fulfill({
      json: {
        ...(alt ? second : first),
        text: alt ? 'خداحافظ' : 'سلام\nخداحافظ',
        source: 'LRCLIB',
        sourceUrl: 'https://lrclib.net',
      },
    })
  })
  await context.route('**/g2p-worker.js*', (r) =>
    r.fulfill({ body: worker, contentType: 'text/javascript' }),
  )
})
test('keyboard search opens an unsynced reader with per-line copy, Aa and full lyrics', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/search')
  const input = page.getByRole('combobox', { name: 'Song or artist' })
  await input.fill('del bordi')
  await expect(page.getByRole('option')).toContainText('Tasnife Del Bordi')
  await expect(page.getByRole('option')).toContainText('3:50')
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.getByRole('heading', { name: 'Tasnife Del Bordi' })).toBeVisible()
  await expect(page.locator('.song-reader-lines [lang="fa-Latn"]')).toHaveText([
    'salam',
    'khodahafez',
  ])
  await expect(page.getByRole('button', { name: /Follow|Play|Pause|Copy current/i })).toHaveCount(0)
  await expect(page.getByRole('slider')).toHaveCount(0)
  await expect(page.locator('audio, [aria-current="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Copy line 2', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('khodahafez')
  await page.getByRole('button', { name: 'Larger lyrics' }).click()
  await expect(page.locator('.song-reader-lines')).toHaveClass(/full-large/)
  await page.getByRole('button', { name: 'Show Persian' }).click()
  await expect(page.locator('.song-reader-lines .full-persian-line')).toHaveCount(2)
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: /Follow|Play|Pause|Copy current/i })).toHaveCount(
    0,
  )
  await dialog.getByRole('button', { name: 'Copy line 1', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('salam')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open full lyrics' })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/search-${info.project.name}.png`, fullPage: true })
})
test('completed songs reopen offline without fetching lyrics or creating a model worker', async ({
  page,
  context,
}) => {
  await page.goto('/search')
  await page.getByRole('combobox').fill('del bordi')
  await page.getByRole('option').click()
  await expect(page.locator('.reading-status')).toContainText('Ready · saved')
  await page.reload()
  let downloads = 0
  await context.route('**/api/lyrics?*', (r) => {
    downloads++
    return r.abort()
  })
  await context.route('**/g2p-worker.js*', (r) => {
    downloads++
    return r.abort()
  })
  await context.setOffline(true)
  await page.locator('.saved-song-open').filter({ hasText: 'Tasnife Del Bordi' }).click()
  await expect(page.locator('.song-reader-lines [lang="fa-Latn"]')).toHaveText([
    'salam',
    'khodahafez',
  ])
  expect(downloads).toBe(0)
  await page.getByRole('button', { name: 'Close lyrics', exact: true }).click()
  await expect(
    page.locator('.saved-song-open').filter({ hasText: 'Tasnife Del Bordi' }),
  ).toBeVisible()
})
test('new selection cancels old conversion and never mixes song output', async ({ page }) => {
  await page.goto('/search')
  await page.getByRole('combobox').fill('del bordi')
  await page.getByRole('option').click()
  await page.getByRole('combobox').fill('another')
  await page.getByRole('option').click()
  await expect(page.getByRole('heading', { name: 'Another Song' })).toBeVisible()
  await expect(page.locator('.song-reader-lines [lang="fa-Latn"]')).toHaveText(['khodahafez'])
  await expect(page.getByRole('heading', { name: 'Tasnife Del Bordi' })).toHaveCount(0)
})
test('empty/error search and missing lyrics allow pasted text without media controls', async ({
  page,
  context,
}) => {
  await context.route('**/api/search?*', (r) => r.fulfill({ json: { songs: [] } }))
  await page.goto('/search')
  await page.getByRole('combobox').fill('missing song')
  await expect(page.getByText(/No close matches/)).toBeVisible()
  await page.getByRole('link', { name: 'Paste Persian lyrics', exact: true }).click()
  await page.getByLabel('Persian lyrics', { exact: true }).fill('سلام')
  await page.getByRole('button', { name: 'Read in Finglish' }).click()
  await expect(page.locator('.song-reader-lines [lang="fa-Latn"]')).toHaveText(['salam'])
  await expect(page.getByRole('slider')).toHaveCount(0)
  await context.route('**/api/search?*', (r) =>
    r.fulfill({ status: 502, json: { error: 'Provider unavailable' } }),
  )
  await page.goto('/search')
  await page.getByRole('combobox').fill('network error')
  await expect(page.getByText('Provider unavailable')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry search' })).toBeVisible()
})
test('late results cannot replace a newer query and Escape closes suggestions', async ({
  page,
  context,
}) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((r) => {
    release = r
  })
  await context.route('**/api/search?*', async (r) => {
    if (new URL(r.request().url()).searchParams.get('q') === 'old') {
      await pending
      await r.fulfill({ json: { songs: [first] } }).catch(() => {})
      return
    }
    await r.fulfill({ json: { songs: [second] } })
  })
  await page.goto('/search')
  const input = page.getByRole('combobox')
  await input.fill('old')
  await page.waitForTimeout(500)
  await input.fill('another')
  await expect(page.getByRole('option')).toContainText('Another Song')
  release()
  await page.waitForTimeout(100)
  await expect(page.getByRole('option')).toContainText('Another Song')
  await input.press('Escape')
  await expect(page.getByRole('option')).toHaveCount(0)
})

test('one failed lyric stays Persian while subsequent lines finish and partial songs are not saved', async ({
  page,
  context,
}) => {
  await context.route('**/g2p-worker.js*', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `onmessage=({data:d})=>{
    if(d.type!=='run')return;
    postMessage({type:'line-error',jobId:d.jobId,index:0,raw:'',finglish:'',truncated:false,error:'Could not convert this line.'});
    postMessage({type:'line',jobId:d.jobId,index:1,raw:'xodAhAfez',finglish:'khodahafez',truncated:false});
    postMessage({type:'done',jobId:d.jobId,failedLines:1});
  }`,
    }),
  )
  await page.goto('/search')
  await page.getByRole('combobox').fill('del bordi')
  await page.getByRole('option').click()
  await expect(page.locator('.reading-status')).toContainText('1 line remains in Persian')
  await expect(page.locator('.song-reader-lines .full-lyric')).toHaveCount(2)
  await expect(page.locator('.song-reader-lines .full-lyric').first()).toContainText('سلام')
  await expect(page.locator('.song-reader-lines .full-lyric').last()).toContainText('khodahafez')
  await expect(page.getByRole('button', { name: 'Copy line 1', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Copy line 2', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  await expect(page.getByRole('dialog').locator('.lyric-conversion-error')).toContainText(
    'original kept',
  )
  expect(
    await page.evaluate(() => localStorage.getItem('hamava-songs-negara-5720b2c4-format1')),
  ).toBeNull()
})

test('saved songs collapse to four and individual removal persists without opening a reader', async ({
  page,
}, info) => {
  await page.goto('/search')
  await page.evaluate(() =>
    localStorage.setItem(
      'hamava-songs-negara-5720b2c4-format1',
      JSON.stringify(
        Array.from({ length: 6 }, (_, i) => ({
          key: String(i),
          song: { title: `Saved ${i}`, artist: 'Singer', text: 'سلام', source: 'Pasted' },
          lines: [{ id: '1', persian: 'سلام', finglish: 'salam' }],
        })),
      ),
    ),
  )
  await page.reload()
  await expect(page.getByText(/Try title.*artist/)).toHaveCount(0)
  await expect(page.locator('.saved-song-open')).toHaveCount(4)
  await page.getByRole('button', { name: 'Show all (6)' }).click()
  await expect(page.locator('.saved-song-open')).toHaveCount(6)
  await page.getByRole('button', { name: 'Remove Saved 5 from this device', exact: true }).click()
  await expect(page.locator('.saved-song-open')).toHaveCount(5)
  await expect(page.locator('.song-reader')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show less' }).click()
  await expect(page.locator('.saved-song-open')).toHaveCount(4)
  await page.getByRole('button', { name: 'Remove Saved 0 from this device', exact: true }).click()
  await expect(page.locator('.saved-song-open')).toHaveCount(4)
  await expect(page.getByRole('button', { name: /Show all/ })).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.saved-song-open')).toHaveCount(4)
  await expect(page.locator('.saved-songs')).not.toContainText('Saved 0')
  await expect(page.locator('.saved-songs')).not.toContainText('Saved 5')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: `test-results/saved-songs-${info.project.name}.png`,
    fullPage: true,
  })
})
test('approximate rows are labeled, copyable and preserved when reopened from device storage', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await context.route('**/g2p-worker.js*', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `onmessage=({data:d})=>{
    if(d.type!=='run')return;
    d.lines.forEach((text,index)=>postMessage({type:'line',jobId:d.jobId,index,raw:'',finglish:'sl am',approximate:true,truncated:false}));
    postMessage({type:'done',jobId:d.jobId,approximateLines:d.lines.length});
  }`,
    }),
  )
  await page.goto('/search')
  await page.getByRole('combobox').fill('del bordi')
  await page.getByRole('option').click()
  await expect(page.locator('.reading-status')).toContainText('2 approximate lines')
  await expect(page.locator('.song-reader-lines .lyric-approximate')).toHaveCount(2)
  await expect(page.locator('.song-reader-lines .full-persian-line')).toHaveCount(2)
  await page.getByRole('button', { name: 'Copy line 1', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sl am')
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  await expect(page.getByRole('dialog').locator('.lyric-approximate')).toHaveCount(2)
  await page.reload()
  await page.locator('.saved-song-open').click()
  await expect(page.locator('.song-reader-lines .lyric-approximate')).toHaveCount(2)
})

test('Kooh example starts a Googoosh search', async ({ page }) => {
  await page.goto('/search')
  await page.getByRole('button', { name: 'Kooh by Googoosh' }).click()
  await expect(page.getByRole('combobox')).toHaveValue('kooh googoosh')
  await expect(page.getByRole('button', { name: 'del bordi', exact: true })).toHaveCount(0)
})
test('provider outage shows a persistent connection hint and allows a successful retry', async ({
  page,
  context,
}) => {
  let calls = 0
  await context.route('**/api/search?*', (r) =>
    r.fulfill({
      json:
        ++calls === 1
          ? {
              songs: [],
              notice: 'LRCLIB could not be reached. Showing alternate matches if available.',
            }
          : { songs: [first] },
    }),
  )
  await page.goto('/search')
  await page.getByRole('combobox').fill('connection test')
  await expect(page.locator('.lyrics-connection, .connectivity-banner')).toHaveCount(0)
  await expect(page.getByText('Searching songs…', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Retry search' }).click()
  await expect(page.getByRole('option')).toBeVisible()
  await expect(page.locator('.lyrics-connection, .connectivity-banner')).toHaveCount(0)
  expect(calls).toBe(2)
})
test('a stalled search ends with retry while a real connectivity check succeeds', async ({
  page,
  context,
}, info) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((r) => {
    release = r
  })
  await context.route('**/api/search?*', async (r) => {
    await pending
    await r.fulfill({ json: { songs: [first] } }).catch(() => {})
  })
  await page.clock.install()
  await page.goto('/search')
  await expect(page.locator('.lyrics-connection, .connectivity-banner')).toHaveCount(0)
  await page.getByRole('combobox').fill('stalled search')
  await page.clock.runFor(500)
  await page.clock.fastForward(16000)
  await expect(page.locator('.search-request-error')).toContainText('timed out')
  await expect(page.getByText('Searching songs…', { exact: true })).toHaveCount(0)
  await expect(page.locator('.lyrics-connection, .connectivity-banner')).toHaveCount(0)
  release()
  await context.route('**/api/search?*', (r) => r.fulfill({ json: { songs: [first] } }))
  await page.getByRole('button', { name: 'Retry search' }).click()
  await page.clock.runFor(500)
  await expect(page.getByRole('option')).toBeVisible()
  await expect(page.locator('.search-request-error')).toHaveCount(0)
  await page.screenshot({
    path: `test-results/connection-${info.project.name}.png`,
    fullPage: true,
  })
})
test('connection failures appear at the top and successful checks stay silent', async ({
  page,
  context,
}) => {
  await context.route('**/api/lyrics-health', (r) =>
    r.fulfill({ json: { reachable: false, checkedAt: Date.now(), reason: 'unavailable' } }),
  )
  await page.goto('/search')
  const banner = page.getByRole('alert', { name: 'Connection status' })
  await expect(banner).toContainText('Hamava can’t reach the lyrics service')
  expect((await banner.boundingBox())!.y).toBe(0)
  await context.route('**/api/lyrics-health', (r) =>
    r.fulfill({ json: { reachable: true, checkedAt: Date.now() } }),
  )
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(banner).toHaveCount(0)
  await expect(page.getByText(/LRCLIB reached|Checking LRCLIB/)).toHaveCount(0)
})
test('homepage paste action opens the shared unsynced reader without search controls', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Paste Persian lyrics/ }).click()
  await expect(page).toHaveURL(/\/paste$/)
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await page.getByLabel('Persian lyrics', { exact: true }).fill('سلام')
  await page.getByRole('button', { name: 'Read in Finglish' }).click()
  await expect(page.locator('.song-reader-lines [lang="fa-Latn"]')).toHaveText(['salam'])
})
test('first download bar aggregates files and reaches 100 only on completion', async ({
  page,
  context,
}) => {
  await context.route('**/g2p-worker.js*', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `onmessage=({data:d})=>{
    if(d.type!=='run')return;
    postMessage({type:'status',jobId:d.jobId,downloadLoaded:100,downloadTotal:100,downloadComplete:false});
    setTimeout(()=>{postMessage({type:'status',jobId:d.jobId,downloadLoaded:100,downloadTotal:100,downloadComplete:true});d.lines.forEach((text,index)=>postMessage({type:'line',jobId:d.jobId,index,raw:'salam',finglish:'salam',truncated:false}));postMessage({type:'done',jobId:d.jobId})},1000)
  }`,
    }),
  )
  await page.goto('/paste')
  await page.getByLabel('Persian lyrics', { exact: true }).fill('سلام')
  await page.getByRole('button', { name: 'Read in Finglish' }).click()
  const bar = page.getByRole('progressbar', { name: 'Finglish reader download' })
  await expect(bar).toHaveAttribute('value', '99')
  await expect(page.getByText('First-time download', { exact: true })).toBeVisible()
  await expect(bar).toHaveAttribute('value', '100')
})
