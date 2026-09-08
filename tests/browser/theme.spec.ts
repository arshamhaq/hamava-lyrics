import { test, expect } from '@playwright/test'

test('follows the device until an explicit theme is chosen, and keeps it on both routes', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0b1222')
  await page.screenshot({
    path: `test-results/hamava-dark-${test.info().project.name}.png`,
    fullPage: true,
  })
  await page.goto('/?live')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByLabel('Test passphrase')).toBeVisible()
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('restores a saved theme before JavaScript app startup', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://127.0.0.1:4173',
          localStorage: [{ name: 'hamava:theme', value: 'dark' }],
        },
      ],
    },
  })
  const page = await context.newPage()
  await page.route('**/assets/*.js', (route) => route.abort())
  await page.goto('http://127.0.0.1:4173/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await context.close()
})
