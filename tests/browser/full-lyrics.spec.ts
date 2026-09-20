import { test, expect } from '@playwright/test'
import { demoLines, demoTrack } from '../../src/data/demo'
const sungLines = demoLines.filter((line) => line.finglish)
test.beforeEach(async ({ context }) => {
  await context.route('**/api/lyrics-health', (r) =>
    r.fulfill({ json: { reachable: true, checkedAt: Date.now() } }),
  )
})

const audioTime = (page: import('@playwright/test').Page) =>
  page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime)

test('full lyrics fills the viewport, copies any line and restores the demo', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/#demo')
  await page.getByRole('slider', { name: 'Song position' }).fill('80000')
  await expect.poll(() => audioTime(page)).toBeCloseTo(80, 1)
  const opener = page.getByRole('button', { name: 'Open full lyrics' })
  await opener.scrollIntoViewIfNeeded()
  const beforeScroll = await page.evaluate(() => scrollY)
  await opener.click()
  const dialog = page.getByRole('dialog', { name: demoTrack.title })
  await expect(dialog).toBeVisible()
  const box = (await dialog.boundingBox())!
  expect(box.x).toBe(0)
  expect(box.y).toBe(0)
  expect(box.width).toBe(page.viewportSize()!.width)
  expect(box.height).toBe(page.viewportSize()!.height)
  await expect(dialog.locator('.full-lyric')).toHaveCount(sungLines.length)
  await expect(dialog.locator('[aria-current="true"]')).toContainText('Biyo biyo, biyo, biyo')
  await expect(dialog.getByRole('button', { name: /^Copy line / })).toHaveCount(sungLines.length)
  await expect(dialog.getByRole('button', { name: 'Copy current line' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Copy line 1', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(sungLines[0].finglish)
  await expect(dialog.getByRole('button', { name: 'Copy line 1', exact: true })).toHaveAttribute(
    'data-copied',
    'true',
  )
  const lastText = await dialog
    .locator('.full-lyric')
    .last()
    .locator('[lang="fa-Latn"]')
    .innerText()
  await dialog.getByRole('button', { name: `Copy line ${sungLines.length}`, exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(lastText)
  await expect(dialog.getByRole('status')).toContainText(`Line ${sungLines.length} copied`)
  await expect(dialog.getByRole('button', { name: 'Copy line 1', exact: true })).toHaveAttribute(
    'data-copied',
    'false',
  )
  await expect(dialog.locator('[aria-current="true"]')).toContainText('Biyo biyo, biyo, biyo')
  expect(await audioTime(page)).toBeCloseTo(80, 1)
  await dialog.getByRole('button', { name: 'Follow current line' }).click()
  await dialog.getByRole('button', { name: 'Larger lyrics' }).click()
  const reader = dialog.locator('.full-lyrics-reader')
  const centered = () =>
    reader.evaluate((el) => {
      const row = el.querySelector('[aria-current="true"]')!.getBoundingClientRect()
      const panel = el.getBoundingClientRect()
      return Math.abs((row.top + row.bottom - panel.top - panel.bottom) / 2)
    })
  await expect.poll(centered).toBeLessThan(3)
  await reader.focus()
  await page.keyboard.press('Home')
  await expect(dialog.getByRole('button', { name: 'Follow current line' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await dialog.getByRole('button', { name: 'Follow current line' }).click()
  await expect.poll(centered).toBeLessThan(3)
  expect(await audioTime(page)).toBeCloseTo(80, 1)
  await dialog.getByRole('button', { name: 'Show Persian' }).click()
  await expect(dialog.locator('.full-persian-line')).toHaveCount(sungLines.length)
  await expect.poll(centered).toBeLessThan(3)
  await page.screenshot({ path: `test-results/full-lyrics-${info.project.name}.png` })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(beforeScroll, 0)
  expect(await audioTime(page)).toBeCloseTo(80, 1)
  await opener.click()
  await page.getByRole('button', { name: 'Close full lyrics' }).click()
  await expect(dialog).toHaveCount(0)
})

test('playback continues through full lyrics and updates the current line', async ({ page }) => {
  await page.goto('/#demo')
  await page.getByRole('slider', { name: 'Song position' }).fill('23000')
  await expect.poll(() => audioTime(page)).toBeCloseTo(23, 1)
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  const dialog = page.getByRole('dialog', { name: demoTrack.title })
  await expect(dialog.locator('[aria-current="true"]')).toContainText(sungLines[1].finglish)
  await dialog.getByRole('button', { name: 'Pause song' }).click()
  const paused = await audioTime(page)
  await page.waitForTimeout(200)
  expect(await audioTime(page)).toBeCloseTo(paused, 1)
  await page.getByRole('button', { name: 'Close full lyrics' }).click()
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeVisible()
  await page.getByRole('slider', { name: 'Song position' }).fill('0')
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  await expect(dialog.locator('[aria-current="true"]')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /^Copy line / })).toHaveCount(sungLines.length)
  await expect(dialog.getByRole('button', { name: 'Copy line 1', exact: true })).toBeEnabled()
})

test('a failed line copy shows feedback and can be retried without a current lyric', async ({
  page,
}) => {
  await page.goto('/#demo')
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  const dialog = page.getByRole('dialog', { name: demoTrack.title })
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied')
        },
      },
    })
  })
  const copy = dialog.getByRole('button', { name: 'Copy line 2', exact: true })
  await copy.click()
  await expect(dialog.getByRole('status')).toContainText('Copy is unavailable')
  await expect(copy).toHaveAttribute('data-copied', 'false')
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          ;(window as unknown as { copiedTestText: string }).copiedTestText = value
        },
      },
    })
  })
  await copy.click()
  await expect(copy).toHaveAttribute('data-copied', 'true')
  expect(
    await page.evaluate(() => (window as unknown as { copiedTestText: string }).copiedTestText),
  ).toBe(sungLines[1].finglish)
  await expect(dialog.locator('[aria-current="true"]')).toHaveCount(0)
})
