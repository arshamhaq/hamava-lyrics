import { test, expect, type Page } from '@playwright/test'
test.use({ serviceWorkers: 'block' })
const clientId = 'a'.repeat(32)
const song = {
  id: 'track1',
  type: 'track',
  name: 'Kooh',
  artists: [{ name: 'Googoosh' }],
  duration_ms: 180000,
  album: { name: 'Kooh', images: [] },
}
const choice = {
  id: 'lrclib:1',
  title: 'Kooh',
  artist: 'Googoosh',
  album: 'Kooh',
  duration: 180,
  text: 'سلام\nخداحافظ',
  source: 'LRCLIB',
  sourceUrl: 'https://lrclib.net/api/get/1',
  closeMatch: true,
  score: 100,
  timedLines: [
    { id: 1, text: 'سلام', startMs: 1000, endMs: 3000 },
    { id: 2, text: 'خداحافظ', startMs: 3000, endMs: 180000 },
  ],
}
const alternative = {
  ...choice,
  id: 'lrclib:2',
  album: 'Another version',
  text: 'خداحافظ',
  timedLines: null,
}
const worker = `let timers=[];onmessage=({data:d})=>{if(d.type==='cancel'){timers.forEach(clearTimeout);postMessage({type:'cancelled',jobId:d.jobId});return}postMessage({type:'ready',jobId:d.jobId});d.lines.forEach((s,index)=>timers.push(setTimeout(()=>{postMessage({type:'line',jobId:d.jobId,index,raw:'ok',finglish:s==='سلام'?'salam':'khodahafez',truncated:false});if(index===d.lines.length-1)postMessage({type:'done',jobId:d.jobId})},80*(index+1))))}`
test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    (clientId) =>
      sessionStorage.setItem(
        'hamava-spotify-session-v1',
        JSON.stringify({
          clientId,
          access: 'test-access',
          refresh: 'test-refresh',
          expires: Date.now() + 3600000,
        }),
      ),
    clientId,
  )
  await context.route('**/api/lyrics-health', (r) => r.fulfill({ json: { reachable: true } }))
  await context.route('https://api.spotify.com/v1/me', (r) =>
    r.fulfill({ json: { display_name: 'Listener', product: 'premium' } }),
  )
  await context.route('https://api.spotify.com/v1/me/player', (r) =>
    r.fulfill({
      json: {
        item: song,
        progress_ms: 1500,
        is_playing: false,
        currently_playing_type: 'track',
        device: { id: 'device1' },
        actions: { disallows: {} },
      },
    }),
  )
  await context.route('**/api/spotify-lyrics?*', (r) =>
    r.fulfill({ json: { choices: [choice, alternative] } }),
  )
  await context.route('**/g2p-worker.js*', (r) =>
    r.fulfill({ body: worker, contentType: 'text/javascript' }),
  )
})
test('Premium playback uses the shared synced reader, controls Spotify and offers untimed alternatives', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  let progress = 1500,
    playing = false
  const writes: string[] = []
  await page.route('https://api.spotify.com/v1/me/player**', (r) => {
    const url = new URL(r.request().url())
    if (r.request().method() === 'PUT') {
      writes.push(url.pathname)
      if (url.pathname.endsWith('/seek')) progress = Number(url.searchParams.get('position_ms'))
      if (url.pathname.endsWith('/play')) playing = true
      if (url.pathname.endsWith('/pause')) playing = false
      return r.fulfill({ status: 204 })
    }
    return r.fulfill({
      json: {
        item: song,
        progress_ms: progress,
        is_playing: playing,
        currently_playing_type: 'track',
        device: { id: 'device1' },
        actions: { disallows: {} },
      },
    })
  })
  await page.goto('/spotify')
  await expect(page.getByText('Connected as Listener · Premium')).toBeVisible()
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('salam')
  await page.getByRole('button', { name: 'Copy current line', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('salam')
  await page.getByRole('slider', { name: 'Song position' }).fill('3500')
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('khodahafez')
  await page.getByRole('button', { name: 'Play song', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause song', exact: true })).toBeVisible()
  expect(writes).toContain('/v1/me/player/seek')
  expect(writes).toContain('/v1/me/player/play')
  await page.getByRole('button', { name: 'Wrong lyrics?' }).click()
  await expect(page.getByRole('region', { name: 'Alternative lyrics' })).toContainText('Not synced')
  await page.getByRole('button', { name: /Another version/ }).click()
  await expect(page.getByText(/This version has no usable timestamps/)).toBeVisible()
  await expect(page.getByRole('slider')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Play song|Pause song|Follow current/ }),
  ).toHaveCount(0)
  await expect(page.locator('.song-reader-lines [lang="fa-Latn"]')).toHaveText(['khodahafez'])
  await page.getByRole('button', { name: 'Open full lyrics' }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Copy line 1' })).toBeEnabled()
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/spotify-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Disconnect' }).click()
  await expect(page.getByRole('button', { name: 'Connect Spotify', exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('hamava-spotify-session-v1'))).toBeNull()
})
test('known Free accounts are blocked before playback or lyrics requests', async ({ page }) => {
  let reads = 0
  await page.route('https://api.spotify.com/v1/me', (r) =>
    r.fulfill({ json: { display_name: 'Free listener', product: 'free' } }),
  )
  page.on('request', (r) => {
    if (r.url().includes('/me/player') || r.url().includes('/api/spotify-lyrics')) reads++
  })
  await page.goto('/spotify')
  await expect(page.getByRole('alert')).toContainText('Please sign in with a Premium account')
  expect(reads).toBe(0)
})
test('missing subscription data stays unknown and absent timestamps use the plain reader', async ({
  page,
}) => {
  await page.route('https://api.spotify.com/v1/me', (r) =>
    r.fulfill({ json: { display_name: 'New account' } }),
  )
  await page.route('**/api/spotify-lyrics?*', (r) =>
    r.fulfill({ json: { choices: [alternative] } }),
  )
  await page.goto('/spotify')
  await expect(page.getByText(/isn’t sharing your subscription status/)).toBeVisible()
  await expect(page.getByText(/Couldn’t find a timestamped version/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy line 1' })).toBeEnabled()
  await page.getByRole('button', { name: 'Wrong lyrics?' }).click()
  await expect(page.getByText('Sorry, there are no other options.')).toBeVisible()
})
test('a track change cancels old matching and never shows the earlier lyrics', async ({ page }) => {
  let current = { ...song },
    requestedOld = false
  await page.route('https://api.spotify.com/v1/me/player', (r) =>
    r.fulfill({
      json: { item: current, progress_ms: 1500, is_playing: true, currently_playing_type: 'track' },
    }),
  )
  await page.route('**/api/spotify-lyrics?*', async (r) => {
    const title = new URL(r.request().url()).searchParams.get('title')
    if (title === 'Kooh') {
      requestedOld = true
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
    await r
      .fulfill({
        json: {
          choices:
            title === 'Kooh' ? [choice] : [{ ...alternative, id: 'lrclib:3', title: 'New song' }],
        },
      })
      .catch(() => {})
  })
  await page.goto('/spotify')
  await expect.poll(() => requestedOld).toBe(true)
  current = { ...song, id: 'track2', name: 'New song' }
  await expect(page.locator('.spotify-now')).toContainText('New song', { timeout: 10000 })
  await expect(page.locator('.song-reader-lines [lang="fa-Latn"]')).toHaveText(['khodahafez'])
  await page.waitForTimeout(2500)
  await expect(page.locator('.spotify-now')).toContainText('New song')
  await expect(page.getByRole('slider')).toHaveCount(0)
})
test('rate limits stop network retries and clear stale highlighting', async ({ page }) => {
  let calls = 0
  await page.route('https://api.spotify.com/v1/me/player', (r) => {
    calls++
    return calls === 1
      ? r.fulfill({
          json: {
            item: song,
            progress_ms: 1500,
            is_playing: true,
            currently_playing_type: 'track',
          },
        })
      : r.fulfill({
          status: 429,
          headers: { 'Retry-After': '30' },
          json: { error: { reason: 'QUOTA_EXCEEDED' } },
        })
  })
  await page.goto('/spotify')
  await expect(page.locator('.lyrics-panel')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('limiting requests', { timeout: 10000 })
  await expect(page.locator('.lyric-row[aria-current="true"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Retry Spotify' }).click()
  await page.waitForTimeout(500)
  expect(calls).toBe(2)
})
test('no active device has an actionable empty state', async ({ page }) => {
  await page.route('https://api.spotify.com/v1/me/player', (r) => r.fulfill({ status: 204 }))
  await page.goto('/spotify')
  await expect(page.getByText('Ready when you are.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Spotify', exact: true })).toBeVisible()
  await expect(page.locator('.lyrics-panel')).toHaveCount(0)
})
test('OAuth callback redeems once and strips authorization parameters', async ({
  page,
  context,
}) => {
  await context.addInitScript((clientId) => {
    sessionStorage.removeItem('hamava-spotify-session-v1')
    localStorage.setItem(
      'hamava-spotify-pkce-v1',
      JSON.stringify({
        clientId,
        state: 'test-state',
        verifier: 'a'.repeat(64),
        created: Date.now(),
        redirect: location.origin + '/spotify/callback',
      }),
    )
  }, clientId)
  let exchanges = 0
  await page.route('https://accounts.spotify.com/api/token', (r) => {
    exchanges++
    expect(r.request().postData()).toContain('code_verifier=')
    return r.fulfill({
      json: { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 },
    })
  })
  await page.goto('/spotify/callback?code=test-code&state=test-state')
  await expect(page.getByText('Connected as Listener · Premium')).toBeVisible()
  await expect(page).toHaveURL(/\/spotify$/)
  expect(exchanges).toBe(1)
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('salam')
})

test('Spotify lyrics use the real cached CPU engine with original timestamps', async ({
  page,
  context,
}) => {
  test.skip(!process.env.HAMAVA_G2P_ASSETS, 'Opt-in real ONNX inference.')
  test.setTimeout(120000)
  await context.unroute('**/g2p-worker.js*')
  await context.route(/https:\/\/(huggingface\.co|cdn\.jsdelivr\.net)\//, (r) => r.abort())
  await page.goto('/spotify')
  await expect(page.locator('.lyric-row [lang="fa-Latn"]')).toHaveCount(2, { timeout: 90000 })
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('salam')
  await expect(page.getByRole('button', { name: 'Copy current line', exact: true })).toBeEnabled()
  await expect(page.locator('.lyric-conversion-error')).toHaveCount(0)
})

test('provider failure allows retry; timed Persian remains visible while conversion is pending', async ({
  page,
  context,
}) => {
  let requests = 0
  await page.route('**/api/spotify-lyrics?*', (r) =>
    ++requests === 1
      ? r.fulfill({
          status: 502,
          json: { error: 'Lyrics services could not be reached. Please retry.' },
        })
      : r.fulfill({ json: { choices: [choice] } }),
  )
  await context.route('**/g2p-worker.js*', (r) =>
    r.fulfill({
      body: worker
        .replace('80 * (index + 1)', '2000 * (index + 1)')
        .replace('80*(index+1)', '2000*(index+1)'),
      contentType: 'text/javascript',
    }),
  )
  await page.goto('/spotify')
  await expect(page.getByRole('button', { name: 'Retry lyrics' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry lyrics' }).click()
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('سلام')
  await expect(page.locator('.reader-status')).toContainText('Preparing Finglish')
  await expect(page.locator('.lyric-row[aria-current="true"]')).toContainText('salam', {
    timeout: 8000,
  })
})
