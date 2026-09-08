import { test, expect } from '@playwright/test'

test('example animates, pauses on interaction and stays compact on phones', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const slider = page.getByRole('slider', { name: 'Reveal Finglish' })
  const initial = Number(await slider.inputValue())
  await expect
    .poll(async () => Math.abs(Number(await slider.inputValue()) - initial))
    .toBeGreaterThan(12)
  await page.getByRole('button', { name: 'Pause card animation' }).click()
  const paused = await slider.inputValue()
  await page.waitForTimeout(250)
  expect(await slider.inputValue()).toBe(paused)
  await page.getByRole('button', { name: 'Replay card animation' }).click()
  await slider.fill('25')
  await expect(page.getByRole('button', { name: 'Replay card animation' })).toBeVisible()
  await page.waitForTimeout(150)
  await expect(slider).toHaveValue('25')
  if (info.project.name === 'mobile') {
    const card = (await page.locator('.script-lens').boundingBox())!
    const heading = (await page.locator('.intro-heading').boundingBox())!
    expect(card.width).toBeLessThan(155)
    expect(card.height).toBeLessThan(150)
    expect(card.x).toBeGreaterThan(heading.x + heading.width - 1)
  }
  await page.getByRole('button', { name: 'Replay card animation' }).click()
  await page.getByRole('link', { name: /First time/ }).click()
  await expect
    .poll(async () => (await page.locator('.script-lens').boundingBox())!.y)
    .toBeLessThan(-150)
  await page.waitForTimeout(150)
  const outOfView = await slider.inputValue()
  await page.waitForTimeout(250)
  expect(await slider.inputValue()).toBe(outOfView)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect
    .poll(async () => Math.abs(Number(await slider.inputValue()) - Number(outOfView)))
    .toBeGreaterThan(3)
  await expect(page.locator('.sync-card .spotify-mark')).toHaveJSProperty('complete', true)
  expect(
    await page
      .locator('.sync-card .spotify-mark')
      .evaluate((el: HTMLImageElement) => el.naturalWidth),
  ).toBeGreaterThan(0)
})

test('demo opacity tracks scrolling both ways over a short distance, even with the demo hash', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/#demo')
  const scrollToProgress = async (progress: number) => {
    await page.evaluate((p) => {
      const el = document.querySelector('.demo-reveal')!
      const absoluteTop = el.getBoundingClientRect().top + window.scrollY
      const range = Math.min(250, innerHeight * 0.32)
      window.scrollTo({ top: absoluteTop - innerHeight + 35 + range * p, behavior: 'instant' })
    }, progress)
  }
  const opacity = () =>
    page.locator('.demo-content').evaluate((el) => Number(getComputedStyle(el).opacity))
  await scrollToProgress(0.25)
  await expect.poll(opacity).toBeGreaterThan(0.2)
  await expect.poll(opacity).toBeLessThan(0.3)
  const start = await page.evaluate(() => scrollY)
  await scrollToProgress(1)
  await expect.poll(opacity).toBeGreaterThan(0.99)
  expect((await page.evaluate(() => scrollY)) - start).toBeLessThanOrEqual(251)
  await scrollToProgress(0.5)
  await expect.poll(opacity).toBeGreaterThan(0.45)
  await expect.poll(opacity).toBeLessThan(0.55)
  await scrollToProgress(0.25)
  await expect.poll(opacity).toBeLessThan(0.3)
})

test('reduced motion keeps the example still and the teaching player fully visible', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const slider = page.getByRole('slider', { name: 'Reveal Finglish' })
  await expect(page.getByRole('button', { name: 'Replay card animation' })).toBeVisible()
  const value = await slider.inputValue()
  await page.waitForTimeout(250)
  expect(await slider.inputValue()).toBe(value)
  await expect(page.locator('.demo-content')).toHaveCSS('opacity', '1')
  await expect(page.locator('.sketch-arrow')).toHaveCount(4)
})

test('card finishes its short pass and stays still until replayed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const slider = page.getByRole('slider', { name: 'Reveal Finglish' })
  await expect(page.getByRole('button', { name: 'Pause card animation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Replay card animation' })).toBeVisible({
    timeout: 4000,
  })
  await expect(slider).toHaveValue('100')
  await page.waitForTimeout(400)
  await expect(slider).toHaveValue('100')
  await page.getByRole('button', { name: 'Replay card animation' }).click()
  await expect(page.getByRole('button', { name: 'Pause card animation' })).toBeVisible()
  await expect.poll(async () => Number(await slider.inputValue())).toBeLessThan(45)
  await expect(page.getByRole('button', { name: 'Replay card animation' })).toBeVisible({
    timeout: 4000,
  })
  await expect(slider).toHaveValue('100')
})
