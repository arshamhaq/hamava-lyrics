import sharp from 'sharp'
// Approved ivory/lavender loop on a full-bleed indigo square. OS supplies the mask.
const source = new URL('../assets/brand/hamava-master.png', import.meta.url)
for (const [name, size] of [
  ['hamava-192.png', 192],
  ['hamava-512.png', 512],
  ['hamava-maskable.png', 512],
  ['apple-touch-icon-v2.png', 180],
  ['hamava-mark.png', 96],
  ['favicon.png', 64],
]) {
  await sharp(source.pathname)
    .resize(size, size)
    .flatten({ background: '#251c54' })
    .png({ palette: true, colours: 128 })
    .toFile(new URL(`../public/${name}`, import.meta.url).pathname)
}
console.log('Generated install icons from the approved Hamava mark.')
