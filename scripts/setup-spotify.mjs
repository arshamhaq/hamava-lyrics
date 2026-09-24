import { createInterface } from 'node:readline/promises'
import { readFile, writeFile } from 'node:fs/promises'
const rl = createInterface({ input: process.stdin, output: process.stdout })
try {
  const clientId = (await rl.question('Spotify Client ID (public, not the Client Secret): ')).trim()
  if (!/^[a-f\d]{32}$/i.test(clientId))
    throw new Error('Expected the 32-character Spotify Client ID.')
  const url = new URL('../.env.local', import.meta.url)
  let content = await readFile(url, 'utf8').catch((e) => {
    if (e.code === 'ENOENT') return ''
    throw e
  })
  content = content.replace(/^VITE_SPOTIFY_CLIENT_ID=.*(?:\r?\n|$)/gm, '')
  await writeFile(url, `${content.trimEnd()}\nVITE_SPOTIFY_CLIENT_ID=${clientId}\n`, {
    mode: 0o600,
  })
  console.log(
    'Saved to .env.local. Restart npm run dev, or run npm run deploy:token to build and deploy.',
  )
} catch (e) {
  console.error(e.message)
  process.exitCode = 1
} finally {
  rl.close()
}
