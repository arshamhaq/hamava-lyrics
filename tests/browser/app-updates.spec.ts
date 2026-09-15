import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'

// A real two-release server exercises installation, waiting, activation and navigation.
// Both releases share JS; the index precache revision changes, like a real deployment.
async function releaseServer() {
  let release = 1
  const root = resolve('dist')
  const mime: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.webmanifest': 'application/manifest+json',
  }
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, 'http://localhost').pathname
      if (path === '/api/connectivity') {
        res.writeHead(204, { 'Cache-Control': 'no-store' }).end()
        return
      }
      const file = resolve(
        root,
        '.' + (path === '/api/app-update' ? '/update.html' : path === '/' ? '/index.html' : path),
      )
      if (!file.startsWith(root + '/')) {
        res.writeHead(403).end()
        return
      }
      let body: Buffer | string = await readFile(file)
      if (file.endsWith('/sw.js')) {
        const original = body.toString()
        body = original.replace(
          /(url:"index\.html",revision:)"[^"]+"/,
          `$1"test-release-${release}"`,
        )
        if (body === original) throw new Error('Index revision not found in generated SW.')
      }
      if (file.endsWith('/index.html'))
        body = body
          .toString()
          .replace(
            '</head>',
            `<script>document.documentElement.dataset.testRelease='${release}'</script></head>`,
          )
      res
        .writeHead(200, {
          'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        })
        .end(body)
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  return {
    url: `http://127.0.0.1:${address.port}`,
    update: () => {
      release = 2
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

test('an installed app offers and activates a new release without losing local preferences', async ({
  page,
  context,
}) => {
  const server = await releaseServer()
  try {
    await page.goto(server.url)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      localStorage.setItem('hamava:demo-saved', 'true')
      const models = await caches.open('hamava-negara-cache-test')
      await models.put('/model-fixture', new Response('cached weights'))
    })
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true)
    expect(await page.evaluate(() => document.documentElement.dataset.testRelease)).toBe('1')
    server.update()
    await page.getByRole('button', { name: 'Check for updates', exact: true }).click()
    await expect(page.getByRole('alert', { name: 'App update' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.dataset.testRelease)).toBe('1')
    await page.getByRole('button', { name: 'Reload app', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-test-release', '2')
    expect(await page.evaluate(() => localStorage.getItem('hamava:demo-saved'))).toBe('true')
    expect(
      await page.evaluate(async () =>
        (await (await caches.open('hamava-negara-cache-test')).match('/model-fixture'))?.text(),
      ),
    ).toBe('cached weights')
    await context.setOffline(true)
    await page.reload()
    expect(await page.evaluate(() => document.documentElement.dataset.testRelease)).toBe('2')
  } finally {
    await context.setOffline(false)
    await page.goto('about:blank')
    await server.close()
  }
})

test('the recovery page bypasses app navigation caching and preserves saved settings', async ({
  page,
}) => {
  const server = await releaseServer()
  try {
    await page.goto(server.url)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      localStorage.setItem('hamava:demo-saved', 'true')
      const models = await caches.open('hamava-negara-cache-test')
      await models.put('/model-fixture', new Response('cached weights'))
    })
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true)
    server.update()
    await page.goto(server.url + '/api/app-update')
    await expect(page.getByRole('heading', { name: 'Update Hamava' })).toBeVisible()
    await page.getByRole('button', { name: 'Repair and reload' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-test-release', '2')
    expect(await page.evaluate(() => localStorage.getItem('hamava:demo-saved'))).toBe('true')
    expect(
      await page.evaluate(async () =>
        (await (await caches.open('hamava-negara-cache-test')).match('/model-fixture'))?.text(),
      ),
    ).toBe('cached weights')
  } finally {
    await page.goto('about:blank')
    await server.close()
  }
})
