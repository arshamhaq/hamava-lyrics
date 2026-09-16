import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
test.use({ serviceWorkers: 'block' })
const fixtures = process.env.HAMAVA_FAILURE_SONGS
for (const [id, target] of [
  ['37630694', 4],
  ['17152239', 36],
] as const) {
  test(`real CPU recovery completes reported song ${id} beyond line ${target + 1}`, async ({
    page,
    context,
  }, info) => {
    test.skip(!fixtures, 'Set HAMAVA_FAILURE_SONGS to the private LRCLIB regression fixtures.')
    test.setTimeout(180000)
    const song = JSON.parse(await readFile(path.join(fixtures!, `${id}.json`), 'utf8'))
    const count = song.plainLyrics.split(/\r?\n/).filter((s: string) => s.trim()).length
    await context.route('**/api/search?*', (r) =>
      r.fulfill({
        json: {
          songs: [
            {
              provider: 'lrclib',
              id,
              title: song.trackName,
              artist: song.artistName,
              album: song.albumName,
              duration: song.duration,
              hasLyrics: true,
            },
          ],
        },
      }),
    )
    await context.route('**/api/lyrics?*', (r) =>
      r.fulfill({
        json: {
          title: song.trackName,
          artist: song.artistName,
          album: song.albumName,
          duration: song.duration,
          text: song.plainLyrics,
          source: 'LRCLIB',
          sourceUrl: `https://lrclib.net/api/get/${id}`,
        },
      }),
    )
    await context.route(/https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\//, (r) => r.abort())
    await page.goto('/search')
    await page.getByRole('combobox').fill(song.trackName)
    await page.getByRole('option').click()
    await expect(page.locator('.reading-status')).toContainText(/Ready|Finished reading the song/, {
      timeout: 150000,
    })
    const rows = page.locator('.song-reader-lines .full-lyric')
    await expect(rows).toHaveCount(count)
    await expect(rows.nth(target).locator('[lang="fa-Latn"]')).toBeVisible()
    // Continuation must reach the final row, even if that row needs an explicit fallback.
    await expect(rows.last().locator('[lang="fa-Latn"], .lyric-conversion-error')).toHaveCount(1)
    expect(await rows.locator('[lang="fa-Latn"]').count()).toBeGreaterThan(target + 1)
    await expect(page.locator('.search-error')).toHaveCount(0)
    const output = await rows.locator('.full-lyric-text').allTextContents()
    await info.attach('conversion-results', {
      body: JSON.stringify({ id, count, output }),
      contentType: 'application/json',
    })
    const failed = await rows.locator('.lyric-conversion-error').count()
    expect(failed).toBe(0)
    expect(await rows.locator('[lang="fa-Latn"]').count()).toBe(count)
    console.log(info.project.name, id, count, 'processed;', failed, 'left in Persian')
  })
}

test('real CPU completes the short repeated vocal line', async ({ page, context }, info) => {
  test.setTimeout(90000)
  await context.route(/https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\//, (r) => r.abort())
  await page.goto('/search')
  await page.getByText('Paste Persian lyrics', { exact: true }).click()
  await page.getByLabel('Persian lyrics', { exact: true }).fill('بغل تو و و عطر تن تو و و')
  await page.getByRole('button', { name: 'Read in Finglish' }).click()
  await expect(page.locator('.reading-status')).toContainText('Ready', { timeout: 60000 })
  const text = await page.locator('.song-reader-lines [lang="fa-Latn"]').innerText()
  expect(text.trim()).not.toBe('')
  expect(text).not.toMatch(/[\u0600-\u06ff]/)
  await expect(page.getByRole('button', { name: 'Copy line 1', exact: true })).toBeEnabled()
  await expect(page.locator('.lyric-conversion-error')).toHaveCount(0)
  console.log(info.project.name, 'short repeated line:', text)
  await page.screenshot({
    path: `test-results/repeated-line-${info.project.name}.png`,
    fullPage: true,
  })
})
