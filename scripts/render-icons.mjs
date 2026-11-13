// Render every app icon, launcher and splash from the Liquid Glass master (assets/icon.svg).
// Usage (needs puppeteer-core + Google Chrome; point PUPPETEER_FROM at a folder that has it installed):
//   PUPPETEER_FROM=/path/to/scratch/ node scripts/render-icons.mjs
// Writes straight into public/, landing/assets/, assets/, Expense.png and the Android res/ folders,
// each at the size of the file it replaces. Desktop (Tauri) icons: then run
//   npx tauri icon assets/desktop-icon.png
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
const puppeteer = createRequire(process.env.PUPPETEER_FROM ? `${process.env.PUPPETEER_FROM.replace(/\/?$/, '/')}x.js` : import.meta.url)('puppeteer-core')

const svg = fs.readFileSync('assets/icon.svg', 'utf8')
const RES = 'android/app/src/main/res'
const LIGHT = '#EEF0F6', DARK = '#06070B'   // glass.css --lg-wall-base
const sizeOf = (f) => {
  const o = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', f]).toString()
  return [+o.match(/pixelWidth: (\d+)/)[1], +o.match(/pixelHeight: (\d+)/)[1]]
}

// mode: tile (rounded, transparent corners) · bleed (square, no rounding) · glyph (no field)
//       field (no glyph) · round (circle) · framed (macOS: 824 tile in 1024 with a shadow) · splash
const jobs = [
  ['Expense.png', 1024, 1024, 'tile'],
  ['assets/icon-only.png', 1024, 1024, 'tile'],
  ['assets/icon-foreground.png', 1024, 1024, 'glyph'],
  ['assets/icon-background.png', 1024, 1024, 'field'],
  ['assets/desktop-icon.png', 1024, 1024, 'framed'],
  ['assets/splash.png', 2732, 2732, 'splash', LIGHT],
  ['assets/splash-dark.png', 2732, 2732, 'splash', DARK],
  ['public/icon-512.png', 512, 512, 'tile'],
  ['public/icon-192.png', 192, 192, 'tile'],
  ['public/apple-touch-icon.png', 180, 180, 'bleed'],
  ['public/favicon-32x32.png', 32, 32, 'tile'],
  ['public/favicon-16x16.png', 16, 16, 'tile'],
  ['public/icon-maskable-512.png', 512, 512, 'maskable'],
  ['landing/assets/icon-192.png', 192, 192, 'tile'],
  ['landing/assets/apple-touch-icon.png', 180, 180, 'bleed'],
  ['landing/assets/favicon-32x32.png', 32, 32, 'tile'],
]
for (const d of fs.readdirSync(RES)) {
  const dir = `${RES}/${d}`
  if (d.startsWith('mipmap-') && fs.existsSync(`${dir}/ic_launcher.png`)) {
    const [w] = sizeOf(`${dir}/ic_launcher.png`)
    jobs.push([`${dir}/ic_launcher.png`, w, w, 'tile'], [`${dir}/ic_launcher_round.png`, w, w, 'round'],
              [`${dir}/ic_launcher_foreground.png`, w, w, 'glyph'], [`${dir}/ic_launcher_background.png`, w, w, 'field'])
  }
  if (d.startsWith('drawable') && fs.existsSync(`${dir}/splash.png`)) {
    const [w, h] = sizeOf(`${dir}/splash.png`)
    jobs.push([`${dir}/splash.png`, w, h, 'splash', d.includes('night') ? DARK : LIGHT])
  }
}

const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const p = await b.newPage()
const out = await p.evaluate(async (svg, jobs) => {
  const variant = (mode) => {
    let s = svg
    if (mode === 'glyph') s = s.replace(/<g id="bg"[\s\S]*?<\/g>/, '')
    if (mode === 'field') s = s.replace(/<g id="glyph">[\s\S]*<\/g>\s*<\/svg>/, '</svg>')
    if (mode === 'bleed' || mode === 'field' || mode === 'maskable' || mode === 'round') s = s.replace('<g id="bg" clip-path="url(#tile)">', '<g id="bg">')
    if (mode === 'maskable') s = s.replace('<g id="glyph">', '<g id="glyph" transform="translate(512 512) scale(0.86) translate(-512 -546)">')
    return s
  }
  const load = async (s) => { const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); await img.decode(); return img }
  const res = {}
  for (const [path, w, h, mode, bg] of jobs) {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'
    if (mode === 'splash') {
      x.fillStyle = bg; x.fillRect(0, 0, w, h)
      const t = Math.round(Math.min(w, h) * (w === h ? 0.205 : 0.3))
      x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = t * 0.08; x.shadowOffsetY = t * 0.04
      x.drawImage(await load(variant('tile')), (w - t) / 2, (h - t) / 2, t, t)
    } else if (mode === 'framed') {
      const t = Math.round(w * 824 / 1024)
      x.shadowColor = 'rgba(0,0,0,.3)'; x.shadowBlur = w * 0.025; x.shadowOffsetY = w * 0.012
      x.drawImage(await load(variant('tile')), (w - t) / 2, (h - t) / 2, t, t)
    } else if (mode === 'round') {
      x.beginPath(); x.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); x.clip()
      x.drawImage(await load(variant('round')), 0, 0, w, h)
    } else {
      x.drawImage(await load(variant(mode)), 0, 0, w, h)
    }
    res[path] = c.toDataURL('image/png')
  }
  return res
}, svg, jobs)
await b.close()
for (const [path, url] of Object.entries(out)) fs.writeFileSync(path, Buffer.from(url.split(',')[1], 'base64'))
console.log(`rendered ${Object.keys(out).length} files`)
