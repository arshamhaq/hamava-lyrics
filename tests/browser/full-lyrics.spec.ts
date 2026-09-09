import { test, expect } from '@playwright/test'

const audioTime = (page: import('@playwright/test').Page) =>
  page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime)

test('full lyrics fills the viewport, copies any line and restores the demo', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/#demo')
  await page.getByRole('slider', { name: 'Song position' }).fill('87000')
  await expect.poll(() => audioTime(page)).toBeCloseTo(87, 1)
  const opener = page.getByRole('button', { name: 'Open full lyrics' })
  await opener.scrollIntoViewIfNeeded()
  const beforeScroll = await page.evaluate(() => scrollY)
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Gharibe Ashena' })
  await expect(dialog).toBeVisible()
  const box = (await dialog.boundingBox())!
  expect(box.x).toBe(0)
  expect(box.y).toBe(0)
  expect(box.width).toBe(page.viewportSize()!.width)
  expect(box.height).toBe(page.viewportSize()!.height)
  await expect(dialog.locator('.full-lyric')).toHaveCount(28)
  await expect(dialog.locator('[aria-current="true"]')).toContainText('Gharibe ashena')
  await expect(dialog.getByRole('button', { name: /^Copy line / })).toHaveCount(28)
  await expect(dialog.getByRole('button', { name: 'Copy current line' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Copy line 1', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'To az shahre gharibe bi neshooni oomadi',
  )
  await expect(dialog.getByRole('button', { name: 'Copy line 1', exact: true })).toHaveAttribute(
    'data-copied',
    'true',
  )
  const lastText = await dialog
    .locator('.full-lyric')
    .last()
    .locator('[lang="fa-Latn"]')
    .innerText()
  await dialog.getByRole('button', { name: 'Copy line 28', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(lastText)
  await expect(dialog.getByRole('status')).toContainText('Line 28 copied')
  await expect(dialog.getByRole('button', { name: 'Copy line 1', exact: true })).toHaveAttribute(
    'data-copied',
    'false',
  )
  await expect(dialog.locator('[aria-current="true"]')).toContainText('Gharibe ashena')
  expect(await audioTime(page)).toBeCloseTo(87, 1)
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
  expect(await audioTime(page)).toBeCloseTo(87, 1)
  await dialog.getByRole('button', { name: 'Show Persian' }).click()
  await expect(dialog.locator('.full-persian-line')).toHaveCount(28)
  await expect.poll(centered).toBeLessThan(3)
  await page.screenshot({ path: `test-results/full-lyrics-${info.project.name}.png` })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(beforeScroll, 0)
  expect(await audioTime(page)).toBeCloseTo(87, 1)
  await opener.click()
  await page.getByRole('button', { name: 'Close full lyrics' }).click()
  await expect(dialog).toHaveCount(0)
})

test('playback continues through full lyrics and updates the current line', async ({ page }) => {
  await page.goto('/#demo')
  await page.getByRole('slider', { name: 'Song position' }).fill('32000')
  await expect.poll(() => audioTime(page)).toBeCloseTo(32, 1)
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  const dialog = page.getByRole('dialog', { name: 'Gharibe Ashena' })
  await expect(dialog.locator('[aria-current="true"]')).toContainText('asbe sefide')
  await dialog.getByRole('button', { name: 'Pause song' }).click()
  const paused = await audioTime(page)
  await page.waitForTimeout(200)
  expect(await audioTime(page)).toBeCloseTo(paused, 1)
  await page.getByRole('button', { name: 'Close full lyrics' }).click()
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeVisible()
  await page.getByRole('slider', { name: 'Song position' }).fill('0')
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  await expect(dialog.locator('[aria-current="true"]')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /^Copy line / })).toHaveCount(28)
  await expect(dialog.getByRole('button', { name: 'Copy line 1', exact: true })).toBeEnabled()
})

test('a failed line copy shows feedback and can be retried without a current lyric', async ({
  page,
}) => {
  await page.goto('/#demo')
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  const dialog = page.getByRole('dialog', { name: 'Gharibe Ashena' })
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
  ).toBe('To ba asbe sefide mehrabooni oomadi')
  await expect(dialog.locator('[aria-current="true"]')).toHaveCount(0)
})
