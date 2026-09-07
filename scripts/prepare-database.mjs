import { readFile, writeFile } from 'node:fs/promises'

const account = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_API_TOKEN
if (!account || !token) throw new Error('Run this through npm run setup:live.')
const configPath = new URL('../wrangler.jsonc', import.meta.url)
const config = await readFile(configPath, 'utf8')
const placeholder = '00000000-0000-0000-0000-000000000000'
if (!config.includes(placeholder)) {
  console.log('Database ID is already configured; keeping it.')
  process.exit(0)
}
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`
async function call(url, body) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.success) {
    const message =
      data?.errors?.map((error) => error.message).join('; ') ??
      'Non-JSON response; check the network or VPN.'
    throw new Error(
      `D1 setup failed (${response.status}): ${message.replaceAll(token, '[redacted]')}`,
    )
  }
  return data
}
let database
for (let page = 1; ; page++) {
  const data = await call(`${base}?per_page=100&page=${page}`)
  database = data.result.find((item) => item.name === 'hamava-lyrics-cache')
  if (database || data.result.length < 100 || page >= (data.result_info?.total_pages ?? Infinity))
    break
}
if (!database) database = (await call(base, { name: 'hamava-lyrics-cache' })).result
if (!/^[a-f0-9-]{36}$/i.test(database.uuid))
  throw new Error('Cloudflare returned an invalid database ID.')
await writeFile(configPath, config.replace(placeholder, database.uuid))
console.log('D1 cache is ready; its non-secret ID is saved in wrangler.jsonc.')
