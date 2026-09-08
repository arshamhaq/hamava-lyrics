import { test, expect } from '@playwright/test'

test('the script reveal supports touch/click and keyboard without requesting AI', async ({
  page,
}) => {
  const apiCalls: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const reveal = page.getByRole('slider', { name: 'Reveal Finglish' })
  await reveal.fill('100')
  await expect(reveal).toHaveAttribute('aria-valuetext', '100% Finglish revealed')
  await reveal.focus()
  await page.keyboard.press('Home')
  await expect(reveal).toHaveValue('0')
  await reveal.click({ position: { x: 40, y: 25 } })
  expect(Number(await reveal.inputValue())).toBeGreaterThan(0)
  expect(
    await page.locator('.script-lens').evaluate((el) => getComputedStyle(el).animationName),
  ).toBe('none')
  expect(apiCalls).toEqual([])
})

test('reads, plays, seeks, copies and handles the end of the preview', async ({
  page,
  context,
  browserName,
}) => {
  if (browserName === 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('Doostet Daram')
  await page.getByRole('button', { name: 'Copy current line' }).click()
  await expect(page.getByRole('status')).toContainText('copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Doostet Daram')
  await page.getByRole('button', { name: 'Play preview', exact: true }).click()
  await expect(page.getByTestId('position')).not.toHaveText('0:08', { timeout: 5000 })
  await page.getByRole('button', { name: 'Pause preview', exact: true }).click()
  await page.getByRole('button', { name: 'Next line', exact: true }).click()
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('Bia')
  await page.getByRole('slider', { name: 'Preview position' }).fill('24000')
  await expect(page.getByRole('button', { name: 'Copy current line' })).toBeDisabled()
  await page.getByRole('button', { name: 'Play preview', exact: true }).click()
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('Gharibe Ashena')
})

test('settings, saved state and dialogs work without a Spotify account', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('switch', { name: 'Show Persian' }).click()
  await expect(page.locator('.lyric-text [lang="fa"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save song', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unsave song', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Connect Spotify' }).click()
  await expect(page.getByRole('dialog')).toContainText('Spotify connection is coming next')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: 'Focus on lyrics' }).click()
  await expect(page.locator('.record-panel')).not.toBeVisible()
  await page.getByRole('button', { name: 'Leave focus view' }).click()
  await expect(page.locator('.record-panel')).toBeVisible()
})

test('fits the viewport and provides an installable offline shell', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Lyrics, in Finglish.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      )
  })
  const manifest = await (await page.request.get('/manifest.webmanifest')).json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '512x512')).toBe(true)
  expect(manifest.icons.find((icon: { purpose: string }) => icon.purpose === 'maskable').src).toBe(
    '/hamava-maskable.png',
  )
  await expect(page.locator('.brand-mark')).toHaveJSProperty('naturalWidth', 96)
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/apple-touch-icon-v2.png',
  )
  await page.screenshot({
    path: `test-results/hamava-${test.info().project.name}.png`,
    fullPage: true,
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Lyrics, in Finglish.' })).toBeVisible()
  await expect(page.getByText('You’re offline. Your saved preview is still here.')).toBeVisible()
  expect(errors).toEqual([])
})
