import { test, expect } from '@playwright/test'

test('shows a prominent offline notice and removes it after reconnecting', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(page.getByRole('alert', { name: 'Connection status' })).toHaveCount(0)
  await context.setOffline(true)
  const banner = page.getByRole('alert', { name: 'Connection status' })
  await expect(banner).toContainText('You’re offline')
  await expect(banner).toContainText('saved version')
  expect((await banner.boundingBox())!.y).toBe(0)
  await context.setOffline(false)
  await expect(banner).toHaveCount(0)
})

test('distinguishes unreachable server from browser-reported offline', async ({ page }) => {
  await page.route('**/api/connectivity', (route) => route.abort())
  await page.goto('/')
  await expect(page.getByRole('alert', { name: 'Connection status' })).toContainText(
    'Can’t reach Hamava',
  )
  await page.route('**/api/connectivity', (route) => route.fulfill({ status: 204 }))
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('alert', { name: 'Connection status' })).toHaveCount(0)
})
