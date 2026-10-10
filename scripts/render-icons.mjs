// Usage (needs puppeteer-core + Google Chrome; run from a scratch folder that has puppeteer-core):
//   node scripts/render-icons.mjs Expense.png assets/out   → then copy into assets/ and public/
// Render every icon variant from the master PNG with headless Chrome (canvas).
import fs from 'node:fs'
import puppeteer from 'puppeteer-core'
const [master, outDir] = process.argv.slice(2)
const src = 'data:image/png;base64,' + fs.readFileSync(master).toString('base64')
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const p = await b.newPage()
const out = await p.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode()
  const W = img.width, H = img.height
  const c0 = document.createElement('canvas'); c0.width = W; c0.height = H
  const x0 = c0.getContext('2d'); x0.drawImage(img, 0, 0)
  const d = x0.getImageData(0, 0, W, H).data
  // bounding box of the opaque tile
  let minX = W, minY = H, maxX = 0, maxY = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 200) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  const side = Math.max(maxX - minX, maxY - minY) + 1
  // tile green: sample just inside the left edge, half way down
  const sx = minX + Math.round(side * 0.04), sy = minY + Math.round(side * 0.5); const i = (sy * W + sx) * 4
  const green = '#' + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('')
  const make = (size, bg, tileSize, rounded = true) => {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d')
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, size, size) }
    const o = (size - tileSize) / 2
    if (rounded) x.drawImage(img, minX, minY, side, side, o, o, tileSize, tileSize)
    else { // full-bleed: draw the tile's middle so its rounded corners fall outside
      const inset = side * 0.06; x.drawImage(img, minX + inset, minY + inset, side - 2 * inset, side - 2 * inset, o, o, tileSize, tileSize) }
    return c.toDataURL('image/png')
  }
  return {
    green, box: [minX, minY, side],
    'icon-only.png':        make(1024, null, 1024),                 // legacy launcher / generic
    'icon-foreground.png':  make(1024, null, 1024, false),       // adaptive fg, full-bleed (@capacitor/assets insets it into the 72dp viewport)
    'icon-background.png':  make(1024, green, 0),                   // adaptive bg: the tile's green
    'splash.png':           make(2732, '#E4E5EA', 560),
    'splash-dark.png':      make(2732, '#040405', 560),
    'desktop-icon.png':     make(1024, null, 824),                  // macOS grid: 824 tile in 1024
    'icon-maskable-512.png': make(512, green, 512, false), // full-bleed; the wallet sits inside the safe 80%
  }
}, src)
fs.mkdirSync(outDir, { recursive: true })
for (const [k, v] of Object.entries(out)) if (k.endsWith('.png')) fs.writeFileSync(`${outDir}/${k}`, Buffer.from(v.split(',')[1], 'base64'))
console.log('tile green', out.green, 'box', out.box)
await b.close()
