import { test, expect } from '@playwright/test'
import type { SongResponse } from '../../shared/lyrics'

const fixture: SongResponse = {
  song: {
    sourceId: 13013538,
    version: 'a'.repeat(64),
    title: 'Gharibe Ashena',
    artist: 'Googoosh',
    album: 'Kooh',
    durationMs: 180_000,
    lines: [
      { id: 1, startMs: 0, endMs: 5000, text: '' },
      { id: 2, startMs: 5000, endMs: 60_000, text: 'سلام' },
      { id: 3, startMs: 60_000, endMs: 120_000, text: 'خداحافظ' },
      { id: 4, startMs: 120_000, endMs: 180_000, text: 'صبح بخیر' },
    ],
    batches: [
      { id: 'part-1', startMs: 5000, endMs: 60_000, lineIds: [2] },
      { id: 'part-2', startMs: 60_000, endMs: 120_000, lineIds: [3] },
      { id: 'part-3', startMs: 120_000, endMs: 180_000, lineIds: [4] },
    ],
  },
  completed: {},
}
const results = {
  'part-1': {
    lines: [{ id: 2, finglish: 'salam' }],
    elapsedMs: 8000,
    neurons: 90,
  },
  'part-2': {
    lines: [{ id: 3, finglish: 'khodahafez' }],
    elapsedMs: 9000,
    neurons: 100,
  },
  'part-3': {
    lines: [{ id: 4, finglish: 'sobh bekheir' }],
    elapsedMs: 7000,
    neurons: 80,
  },
}
test('seeking ahead reprioritizes the queue and retains earlier text', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.route('**/api/song', (route) => route.fulfill({ json: fixture }))
  const order: string[] = []
  let releaseFirst!: () => void, releaseThird!: () => void
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const thirdGate = new Promise<void>((resolve) => {
    releaseThird = resolve
  })
  await page.route('**/api/batch', async (route) => {
    const id = route.request().postDataJSON().batchId as keyof typeof results
    order.push(id)
    if (id === 'part-1') await firstGate
    if (id === 'part-3') await thirdGate
    await route.fulfill({ json: results[id] })
  })
  await page.goto('/?live')
  await page.getByLabel('Test passphrase', { exact: true }).fill('a-private-test-passphrase')
  await page.getByRole('button', { name: 'Start lyrics test' }).click()
  await expect(page.getByText('Instrumental', { exact: true })).toBeVisible()
  await expect.poll(() => order.length).toBe(1)
  await page.getByRole('button', { name: 'Seek to section 3', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Copy current line' })).toBeDisabled()
  await expect(
    page.getByText('Your selected section is next after the current request finishes.'),
  ).toBeVisible()
  releaseFirst()
  await expect.poll(() => order.join(',')).toBe('part-1,part-3')
  await expect(page.locator('.live-lyric-row').filter({ hasText: 'salam' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy current line' })).toBeDisabled()
  releaseThird()
  await expect(page.locator('.current-moment > p')).toHaveText('sobh bekheir')
  await page.getByRole('button', { name: 'Copy current line' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sobh bekheir')
  await expect.poll(() => order.join(',')).toBe('part-1,part-3,part-2')
  await expect(page.getByText('3 of 3 sections ready')).toBeVisible()
  await page.getByRole('button', { name: 'Seek to section 1', exact: true }).click()
  await expect(page.locator('.current-moment > p')).toHaveText('salam')
  expect(order).toHaveLength(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: `test-results/live-${info.project.name}.png`,
    fullPage: true,
  })
  await page.getByRole('slider', { name: 'Song position' }).fill('180000')
  await expect(page.getByRole('button', { name: 'Copy current line' })).toBeDisabled()
  await page.getByRole('button', { name: 'Play test clock' }).click()
  await expect(page.getByText('Instrumental', { exact: true })).toBeVisible()
})

test('failed sections stop the queue, preserve cached lines, and retry explicitly', async ({
  page,
}) => {
  await page.route('**/api/song', (route) =>
    route.fulfill({
      json: { ...fixture, completed: { 'part-1': results['part-1'] } },
    }),
  )
  let attempts = 0
  await page.route('**/api/batch', async (route) => {
    attempts++
    const id = route.request().postDataJSON().batchId as keyof typeof results
    await route.fulfill(
      attempts === 1
        ? { status: 502, json: { error: 'The AI returned invalid lines.' } }
        : { json: results[id] },
    )
  })
  await page.goto('/?live')
  await page.getByLabel('Test passphrase', { exact: true }).fill('a-private-test-passphrase')
  await page.getByRole('button', { name: 'Start lyrics test' }).click()
  await page.getByRole('button', { name: 'Seek to section 2', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('invalid lines')
  await expect(page.locator('.live-lyric-row').filter({ hasText: 'salam' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy current line' })).toBeDisabled()
  expect(attempts).toBe(1)
  await page.getByRole('button', { name: 'Retry this section', exact: true }).click()
  await expect(page.locator('.current-moment > p')).toHaveText('khodahafez')
  await expect(page.getByText('3 of 3 sections ready')).toBeVisible()
  await page.getByRole('button', { name: 'Lock test', exact: true }).click()
  await expect(page.getByLabel('Test passphrase', { exact: true })).toHaveValue('')
})
