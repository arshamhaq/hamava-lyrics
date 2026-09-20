import { test, expect } from '@playwright/test'
test.beforeEach(async ({ context }) => {
  await context.route('**/api/lyrics-health', (r) =>
    r.fulfill({ json: { reachable: true, checkedAt: Date.now() } }),
  )
})

test('demo peeks above the fold and notes draw once after its reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  const top = (await page.locator('.demo-reveal').boundingBox())!.y
  expect(top).toBeLessThan(page.viewportSize()!.height)
  expect(top).toBeGreaterThan(page.viewportSize()!.height - 220)
  const note = page.locator('[data-guide="cover"]')
  await expect(note).toHaveAttribute('data-entrance', 'waiting')
  await page.evaluate(() => {
    const note = document.querySelector('[data-guide="cover"]')!
    window.scrollTo({
      top: note.getBoundingClientRect().top + scrollY - innerHeight / 2,
      behavior: 'instant',
    })
  })
  await expect(page.locator('.demo-content')).toHaveCSS('opacity', '1')
  await expect(note).toHaveAttribute('data-entrance', 'drawing')
  await expect(note).toHaveAttribute('data-entrance', 'done')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await note.scrollIntoViewIfNeeded()
  await expect(note).toHaveAttribute('data-entrance', 'done')
  await page.getByRole('button', { name: 'Hide tips' }).click()
  await page.getByRole('button', { name: 'Show tips' }).click()
  await expect(note).toHaveAttribute('data-entrance', 'done')
})

test('compact toolbar fits narrow screens with the follow note above it', async ({
  page,
}, info) => {
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 740 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#demo')
  await expect(page.locator('.lyrics-toolbar, .reading-controls')).toHaveCount(0)
  const follow = page.getByRole('button', { name: 'Follow current line (only synced mode)' })
  const aa = page.getByRole('button', { name: 'Larger lyrics' })
  const focus = page.getByRole('button', { name: 'Open full lyrics' })
  const boxes = await Promise.all([follow, aa, focus].map((el) => el.boundingBox()))
  const centers = boxes.map((box) => box!.y + box!.height / 2)
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2)
  const note = (await page.locator('.follow-guide').boundingBox())!
  expect(note.y + note.height).toBeLessThanOrEqual(boxes[0]!.y + 1)
  await expect(page.locator('.record-sleeve')).toHaveAttribute('src', '/gharibe-ashena-cover.jpg')
  await expect(page.locator('.record-sleeve')).toHaveJSProperty('naturalWidth', 450)
  await expect(page.locator('[data-guide]')).toHaveCount(5)
  await expect(page.locator('[data-entrance="waiting"], [data-entrance="drawing"]')).toHaveCount(0)
  await page.locator('.demo-controls-note').scrollIntoViewIfNeeded()
  await expect(page.getByText(/These controls are just for trying the demo/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: `test-results/hamava-compact-${info.project.name}.png`,
    fullPage: true,
  })
})
