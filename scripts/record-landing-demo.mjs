// Record the landing page's demo video (a short tour, demo data, light theme)
// with Chrome alone — no ffmpeg: frames from the app page are painted onto a
// canvas in a second page and encoded there by MediaRecorder (WebM / VP9).
//   npx vite --port 5199 &
//   PUPPETEER_FROM=/path/with/puppeteer-core node scripts/record-landing-demo.mjs
// Writes landing/assets/demo.webm
import fs from 'node:fs'
import { createRequire } from 'node:module'
const puppeteer = createRequire(process.env.PUPPETEER_FROM ? `${process.env.PUPPETEER_FROM.replace(/\/?$/, '/')}x.js` : import.meta.url)('puppeteer-core')

const URL = process.env.APP_URL || 'http://localhost:5199/'
const W = 390, H = 844, OUTW = 540, OUTH = Math.round(OUTW * H / W)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] })

// The recorder page
const rec = await b.newPage()
await rec.setContent(`<canvas id="c" width="${OUTW}" height="${OUTH}"></canvas>`)
await rec.evaluate(() => {
  const c = document.getElementById('c'), x = c.getContext('2d')
  x.fillStyle = '#EEF0F6'; x.fillRect(0, 0, c.width, c.height)
  window.__img = null
  window.__frame = (b64) => { const i = new Image(); i.onload = () => { window.__img = i }; i.src = 'data:image/jpeg;base64,' + b64 }
  // a fixed 30 fps timer (animation frames don't run in a background page)
  setInterval(() => { if (window.__img) x.drawImage(window.__img, 0, 0, c.width, c.height) }, 33)
  const stream = c.captureStream(30)
  const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1_100_000 })
  window.__chunks = []
  mr.ondataavailable = (e) => window.__chunks.push(e.data)
  window.__mr = mr
})

// The app
const app = await b.newPage()
await app.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await app.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
await app.goto(URL, { waitUntil: 'domcontentloaded' })
await app.evaluate(() => localStorage.clear()); await app.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500)
const d = await app.$('#btn-try-demo'); if (d) { await d.evaluate((e) => e.click()); await sleep(4500) }
for (let i = 0; i < 3; i++) for (const sel of ['.tour-link', '.tour-x']) { const x = await app.$(sel); if (x) { await x.evaluate((e) => e.click()).catch(() => {}); await sleep(300) } }
await app.addStyleTag({ content: '#demo-banner, .app-toast { display: none !important; }' })

const cdp = await app.createCDPSession()
cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
  rec.evaluate((b64) => window.__frame(b64), data).catch(() => {})
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
})
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: OUTW * 2, maxHeight: OUTH * 2, everyNthFrame: 1 })
await app.bringToFront()
await sleep(800)
await rec.evaluate(() => window.__mr.start(250))

// The tour (~25 s)
const click = (id) => app.evaluate((id) => document.getElementById(id)?.click(), id)
const scroll = (dy, steps = 30) => app.evaluate(async (dy, steps) => {
  const el = document.querySelector('.lg-under') || document.querySelector('.mobile-page')
  for (let i = 0; i < steps; i++) { el.scrollTop += dy / steps; await new Promise((r) => requestAnimationFrame(r)) }
}, dy, steps)
await sleep(2200)
await scroll(520); await sleep(1400); await scroll(-520); await sleep(900)
await click('tab-stats'); await sleep(2200); await scroll(600, 40); await sleep(1500)
await click('tab-bills'); await sleep(2400)
await click('tab-history'); await sleep(2000); await scroll(400); await sleep(1200)
await click('tab-today'); await sleep(1200)
await click('tab-add'); await sleep(1400)
await app.keyboard.type('Chai and snacks', { delay: 70 }); await sleep(400)
await app.evaluate(() => document.getElementById('add-amount')?.focus())
await app.keyboard.type('120', { delay: 140 }); await sleep(2200)

await rec.evaluate(() => new Promise((r) => { window.__mr.onstop = r; window.__mr.stop() }))
await cdp.send('Page.stopScreencast')
const b64 = await rec.evaluate(async () => {
  const blob = new Blob(window.__chunks, { type: 'video/webm' })
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000))
  return btoa(s)
})
fs.writeFileSync('landing/assets/demo.webm', Buffer.from(b64, 'base64'))
console.log('demo.webm', Math.round(Buffer.from(b64, 'base64').length / 1024), 'KB')
await b.close()
