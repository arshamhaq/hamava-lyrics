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
  await page.getByRole('button', { name: /Tasnife Del Bordi/ }).click()
  await expect(page.locator('.song-reader-lines [lang="fa-Latn"]')).toHaveText([
    'salam',
    'khodahafez',
  ])
  expect(downloads).toBe(0)
  await page.getByRole('button', { name: 'Close lyrics', exact: true }).click()
  await expect(page.getByRole('button', { name: /Tasnife Del Bordi/ })).toBeVisible()
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
  await page.getByText('Paste Persian lyrics', { exact: true }).click()
  await page.getByLabel('Persian lyrics', { exact: true }).fill('سلام')
  await page.getByRole('button', { name: 'Read in Finglish' }).click()
  await expect(page.locator('.song-reader-lines [lang="fa-Latn"]')).toHaveText(['salam'])
  await expect(page.getByRole('slider')).toHaveCount(0)
  await context.route('**/api/search?*', (r) =>
    r.fulfill({ status: 502, json: { error: 'Provider unavailable' } }),
  )
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
