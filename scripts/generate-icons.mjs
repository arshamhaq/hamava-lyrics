import sharp from 'sharp'
const source = new URL('../public/icon.svg', import.meta.url)
for (const [name, size] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['pwa-maskable.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  await sharp(source.pathname)
    .resize(size, size)
    .png()
    .toFile(new URL(`../public/${name}`, import.meta.url).pathname)
}
console.log('Generated local install icons from the original Hamava SVG.')
