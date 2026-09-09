import { test, expect } from '@playwright/test'

const audioTime = (page: import('@playwright/test').Page) =>
  page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime)

test('landing explains both routes and the comparison without fetching audio or lyrics', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/audio/') || /^\/api\/(song|batch)/.test(path)) requests.push(path)
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByText('Example only')).toBeVisible()
  const reveal = page.getByRole('slider', { name: 'Reveal Finglish' })
  await reveal.fill('100')
  await expect(reveal).toHaveAttribute('aria-valuetext', '100% Finglish revealed')
  await reveal.focus()
  await page.keyboard.press('Home')
  await expect(reveal).toHaveValue('0')
  expect(requests).toEqual([])
  await page.getByRole('link', { name: /Connect Spotify/ }).click()
  await expect(page).toHaveURL(/\/spotify$/)
  await expect(page.getByRole('heading', { name: 'Spotify sync' })).toBeVisible()
  await expect(page.getByText('Coming next', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page.getByRole('link', { name: /Search a song/ }).click()
  await expect(page).toHaveURL(/\/search$/)
  await expect(page.getByRole('heading', { name: 'Search a song' })).toBeVisible()
})

test('real MP3 drives play, pause, seeking, highlighted lyrics and copying', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/#demo')
  await expect(page.getByRole('button', { name: 'Copy current line' })).toBeDisabled()
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect.poll(() => audioTime(page)).toBeGreaterThan(0.2)
  await page.getByRole('button', { name: 'Pause song', exact: true }).click()
  const paused = await audioTime(page)
  await page.waitForTimeout(250)
  expect(await audioTime(page)).toBeCloseTo(paused, 1)
  const seek = page.getByRole('slider', { name: 'Song position' })
  await seek.fill('87000')
  await expect.poll(() => audioTime(page)).toBeCloseTo(87, 1)
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('Gharibe ashena')
  await page.getByRole('button', { name: 'Copy current line' }).click()
  await expect(page.getByRole('status')).toContainText('Line copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'Gharibe ashena, dooset daram, bia',
  )
  await seek.fill('45000')
  await seek.fill('194000')
  await expect.poll(() => audioTime(page)).toBeCloseTo(194, 1)
  await page.getByRole('button', { name: 'Next line', exact: true }).click()
  await expect.poll(() => audioTime(page)).toBeCloseTo(200.02, 1)
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('Mishinam')
  if (await page.getByRole('button', { name: 'Restart song' }).isVisible())
    await page.getByRole('button', { name: 'Restart song' }).click()
  else await seek.fill('0')
  await expect.poll(() => audioTime(page)).toBeLessThan(0.1)
  await expect(page.getByRole('button', { name: 'Copy current line' })).toBeDisabled()
})

test('seek before metadata and playback failure have explicit states', async ({ page }) => {
  await page.route('**/audio/*.mp3', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    await route.continue()
  })
  await page.goto('/#demo')
  await page.getByRole('slider', { name: 'Song position' }).fill('87000')
  await expect.poll(() => audioTime(page)).toBeCloseTo(87, 1)
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect.poll(() => audioTime(page)).toBeGreaterThan(87.2)
  await page.reload()
  await page.route('**/audio/*.mp3', (route) => route.abort())
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect(page.locator('.audio-error')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled()
})

test('guided controls, local settings and focus remain usable', async ({ page }) => {
  await page.goto('/#demo')
  await page.getByRole('switch', { name: 'Show Persian' }).click()
  await expect(page.locator('.lyric-text [lang="fa"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save song', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unsave song', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Hide tips', exact: true }).click()
  await expect(page.locator('.guide-note')).toHaveCount(0)
  await page.getByRole('button', { name: 'Show tips', exact: true }).click()
  await expect(page.locator('.cover-guide')).toBeVisible()
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  await expect(page.getByRole('dialog', { name: 'Gharibe Ashena' })).toBeVisible()
  await page.getByRole('button', { name: 'Close full lyrics' }).click()
  await expect(page.locator('.record-panel')).toBeVisible()
})

test('scrubbing commits on release and playback can restart after the recording ends', async ({
  page,
}) => {
  await page.goto('/#demo')
  const seek = page.getByRole('slider', { name: 'Song position' })
  await seek.fill('87000')
  await expect.poll(() => audioTime(page)).toBeCloseTo(87, 1)
  await seek.scrollIntoViewIfNeeded()
  const box = (await seek.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.37, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 5 })
  expect(await audioTime(page)).toBeCloseTo(87, 1)
  await page.mouse.up()
  await expect.poll(() => audioTime(page)).toBeGreaterThan(140)
  const duration = await page.locator('audio').evaluate((el: HTMLAudioElement) => el.duration)
  await seek.fill(String(Math.floor((duration - 0.2) * 10) * 100))
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect
    .poll(() => page.locator('audio').evaluate((el: HTMLAudioElement) => el.ended))
    .toBe(true)
  await expect(page.getByRole('button', { name: 'Copy current line' })).toBeDisabled()
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect.poll(() => audioTime(page)).toBeLessThan(3)
})

test('fits the viewport, reveals the demo and opens an honest offline shell', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Lyrics, in Finglish.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  const manifest = await (await page.request.get('/manifest.webmanifest')).json()
  expect(manifest.display).toBe('standalone')
  await expect(page.locator('.brand-mark')).toHaveJSProperty('naturalWidth', 96)
  await page.screenshot({
    path: `test-results/hamava-home-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('link', { name: /First time/ }).click()
  await expect(page.locator('.demo-content')).toHaveCSS('opacity', '1')
  await page.screenshot({
    path: `test-results/hamava-demo-${test.info().project.name}.png`,
    animations: 'disabled',
  })
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      )
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('alert', { name: 'Connection status' })).toContainText(
    'You’re offline',
  )
  await expect(page.getByRole('heading', { name: 'Lyrics, in Finglish.' })).toBeVisible()
  expect(errors).toEqual([])
})

test('follow button returns from browsing without seeking, and stays useful with larger text', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/#demo')
  const seek = page.getByRole('slider', { name: 'Song position' })
  await seek.fill('87000')
  await expect.poll(() => audioTime(page)).toBeCloseTo(87, 1)
  const follow = page.getByRole('button', { name: 'Follow current line' })
  const list = page.locator('.reader-lines')
  await expect(follow).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.follow-guide')).toBeVisible()
  await list.focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowUp')
  await list.evaluate((el) => {
    el.scrollTop = 0
  })
  await expect(follow).toHaveAttribute('aria-pressed', 'false')
  await follow.click()
  await expect(follow).toHaveAttribute('aria-pressed', 'true')
  const centered = () =>
    list.evaluate((el) => {
      const row = el.querySelector('[aria-current="true"]')!
      const bounds = row.getBoundingClientRect(),
        parent = el.getBoundingClientRect()
      return Math.abs((bounds.top + bounds.bottom) / 2 - (parent.top + parent.bottom) / 2)
    })
  await expect.poll(centered).toBeLessThan(3)
  expect(await audioTime(page)).toBeCloseTo(87, 1)
  await page.getByRole('button', { name: 'Larger lyrics' }).click()
  await page.waitForTimeout(350)
  await expect.poll(centered).toBeLessThan(3)
  await page.getByRole('button', { name: 'Larger lyrics' }).click()
  await page.waitForTimeout(350)
  await expect.poll(centered).toBeLessThan(3)
  await page.getByRole('switch', { name: 'Show Persian' }).click()
  await expect.poll(centered).toBeLessThan(3)
  // Also recenter when auto-follow was already enabled.
  await list.evaluate((el) => {
    el.scrollTop = 0
  })
  await follow.click()
  await expect.poll(centered).toBeLessThan(3)
  await page.getByRole('button', { name: 'Hide tips' }).click()
  await expect(page.locator('.follow-guide')).toHaveCount(0)
  await expect(follow).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
