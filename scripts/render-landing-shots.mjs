// Landing-page screenshots from the real app (demo data, light Liquid Glass).
// Needs a running dev server and puppeteer-core + Google Chrome:
//   npx vite --port 5199 &
//   PUPPETEER_FROM=/path/with/puppeteer-core node scripts/render-landing-shots.mjs
// Writes landing/assets/{desktop-*,phone-*}.webp, og-image.jpg and demo-poster.jpg
// at the sizes the page uses.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const puppeteer = createRequire(process.env.PUPPETEER_FROM ? `${process.env.PUPPETEER_FROM.replace(/\/?$/, '/')}x.js` : import.meta.url)('puppeteer-core')

const URL = process.env.APP_URL || 'http://localhost:5199/'
const OUT = 'landing/assets'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })

async function open(viewport) {
  const p = await b.newPage()
  await p.setViewport(viewport)
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await p.goto(URL, { waitUntil: 'domcontentloaded' })
  await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
  const d = await p.$('#btn-try-demo'); if (d) { await d.evaluate((e) => e.click()); await sleep(4500) }
  for (let i = 0; i < 3; i++) for (const sel of ['.tour-link', '.tour-x']) { const x = await p.$(sel); if (x) { await x.evaluate((e) => e.click()).catch(() => {}); await sleep(300) } }
  await p.addStyleTag({ content: '#demo-banner, .app-toast { display: none !important; }' })
  return p
}
const go = (p, id) => p.evaluate((id) => document.getElementById(id)?.click(), id).then(() => sleep(1500))

/* Desktop: 1600×1000 (800×500 at 2×) */
const desk = await open({ width: 1440, height: 900, deviceScaleFactor: 1600 / 1440 })
await desk.screenshot({ path: `${OUT}/desktop-home.webp`, type: 'webp', quality: 86 })
await desk.screenshot({ path: `${OUT}/og-image.jpg`, type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1440, height: 900 } })
await go(desk, 'side-budget'); await desk.screenshot({ path: `${OUT}/desktop-budget.webp`, type: 'webp', quality: 86 })
await go(desk, 'side-stats'); await desk.screenshot({ path: `${OUT}/desktop-stats.webp`, type: 'webp', quality: 86 })
await go(desk, 'side-history'); await desk.screenshot({ path: `${OUT}/desktop-history.webp`, type: 'webp', quality: 86 })
await desk.close()

/* Phone: 780×1688 (390×844 at 2×) */
const phone = await open({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await phone.screenshot({ path: `${OUT}/phone-home.webp`, type: 'webp', quality: 86 })
await phone.screenshot({ path: `${OUT}/phone-home-light.webp`, type: 'webp', quality: 86 })
await go(phone, 'tab-bills'); await phone.screenshot({ path: `${OUT}/phone-bills.webp`, type: 'webp', quality: 86 })
await go(phone, 'tab-stats'); await phone.screenshot({ path: `${OUT}/phone-stats.webp`, type: 'webp', quality: 86 })
await go(phone, 'tab-today')
await phone.close()

/* og-image is 1200×750 and the demo poster 390×844 */
const fix = await b.newPage()
for (const [src, w, h, out] of [[`${OUT}/og-image.jpg`, 1200, 750, `${OUT}/og-image.jpg`], [`${OUT}/phone-home.webp`, 390, 844, `${OUT}/demo-poster.jpg`]]) {
  const data = 'data:image/' + (src.endsWith('jpg') ? 'jpeg' : 'webp') + ';base64,' + fs.readFileSync(src).toString('base64')
  await fix.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
  await fix.setContent(`<body style="margin:0"><img src="${data}" style="width:${w}px;height:${h}px;object-fit:cover;object-position:top left;display:block"></body>`)
  await fix.screenshot({ path: out, type: 'jpeg', quality: 86 })
}
await b.close()
console.log('written', fs.readdirSync(OUT).filter((f) => /\.(webp|jpg)$/.test(f)))
