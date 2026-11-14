// Google Play listing assets: the 1024×500 feature graphic and 1080×1920
// phone screenshots (9:16, the demo's sample data, light theme).
// Needs a running dev server and puppeteer-core + Google Chrome:
//   npx vite --port 5199 &
//   PUPPETEER_FROM=/path/with/puppeteer-core node scripts/render-play-assets.mjs
// Writes docs/play/feature-graphic.png and docs/play/screenshot-*.png
import fs from 'node:fs'
import { createRequire } from 'node:module'
const puppeteer = createRequire(process.env.PUPPETEER_FROM ? `${process.env.PUPPETEER_FROM.replace(/\/?$/, '/')}x.js` : import.meta.url)('puppeteer-core')

const URL = process.env.APP_URL || 'http://localhost:5199/'
const OUT = 'docs/play'
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })

/* ── Feature graphic ─────────────────────────────────────────────── */
const icon = 'data:image/png;base64,' + fs.readFileSync('public/icon-512.png').toString('base64')
const fg = await b.newPage()
await fg.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 })
await fg.setContent(`<!doctype html><html><body style="margin:0;width:1024px;height:500px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;
  background:#EEF0F6;position:relative">
  <div style="position:absolute;inset:0;background:
    radial-gradient(520px 380px at 8% 0%, rgba(122,178,255,.6), transparent 64%),
    radial-gradient(480px 360px at 100% 20%, rgba(255,184,150,.55), transparent 64%),
    radial-gradient(560px 420px at 70% 115%, rgba(186,164,255,.5), transparent 66%),
    radial-gradient(420px 380px at -6% 95%, rgba(132,226,196,.5), transparent 66%)"></div>
  <div style="position:absolute;left:64px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:34px">
    <img src="${icon}" width="176" height="176" style="border-radius:40px;box-shadow:0 22px 50px -18px rgba(0,0,0,.35)">
    <div>
      <div style="font-size:58px;font-weight:800;letter-spacing:-.03em;color:#0A0A0C;line-height:1.02">Expense Tracker</div>
      <div style="font-size:26px;font-weight:500;color:rgba(10,10,12,.66);margin-top:14px;letter-spacing:-.01em">Spending, budgets, bills and trips.<br>Private and free.</div>
      <div style="display:flex;gap:10px;margin-top:26px">
        ${['UPI &amp; bank SMS', 'Budgets', 'Split trips'].map((t) => `<span style="padding:10px 18px;border-radius:999px;font-size:17px;font-weight:650;color:#0A0A0C;
          background:rgba(255,255,255,.42);box-shadow:inset 1.5px 1.5px 0 -.5px rgba(255,255,255,.95),inset -1.5px -1.5px 0 -.5px rgba(255,255,255,.55),inset 0 0 0 1px rgba(255,255,255,.3),0 6px 16px -8px rgba(0,0,0,.25)">${t}</span>`).join('')}
      </div>
    </div>
  </div>
</body></html>`)
await fg.screenshot({ path: `${OUT}/feature-graphic.png` })
await fg.close()

/* ── Phone screenshots ───────────────────────────────────────────── */
const p = await b.newPage()
await p.setViewport({ width: 360, height: 640, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
await p.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(2500)
const demo = await p.$('#btn-try-demo'); if (demo) { await demo.evaluate((e) => e.click()); await sleep(4500) }
for (let i = 0; i < 3; i++) for (const sel of ['.tour-link', '.tour-x']) { const x = await p.$(sel); if (x) { await x.evaluate((e) => e.click()).catch(() => {}); await sleep(300) } }
// The demo banner and toasts are not part of the product
await p.addStyleTag({ content: '#demo-banner, .app-toast { display: none !important; }' })
const shot = async (name) => { await sleep(900); await p.screenshot({ path: `${OUT}/screenshot-${name}.png` }) }
const go = async (id) => { await p.evaluate((id) => document.getElementById(id)?.click(), id); await sleep(1300) }

await shot('1-home')
await go('tab-stats'); await shot('2-stats')
await go('tab-bills'); await shot('3-bills')
await go('tab-history'); await shot('4-history')
await go('tab-today'); await go('explore-budget'); await shot('5-budget')
await go('tab-today'); await go('tab-add'); await shot('6-add')
await b.close()
console.log('written to', OUT, fs.readdirSync(OUT))
