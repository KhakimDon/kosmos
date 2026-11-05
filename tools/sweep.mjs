// node tools/sweep.mjs <outPrefix> [--w --h --step=300 --shots=y1,y2 --fps=y1,y2]
import puppeteer from 'puppeteer-core'
const args = process.argv.slice(2)
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const b = a.slice(2); const i = b.indexOf('='); return i < 0 ? [b, ''] : [b.slice(0, i), b.slice(i + 1)] }))
const out = args.find(a => !a.startsWith('--'))
const W = +(opt.w || 1440), H = +(opt.h || 900)
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage()
await page.evaluateOnNewDocument(() => { const WS = window.WebSocket; window.WebSocket = function (url, p) { if (String(p).includes('vite')) return { addEventListener() {}, send() {}, close() {}, readyState: 0 }; return new WS(url, p) } })
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
const logs = []
page.on('console', m => { if (m.type() !== 'log' && m.type() !== 'debug' && m.type() !== 'info') logs.push(m.type() + ': ' + m.text() + ' @' + (m.location()?.url || '') + ':' + (m.location()?.lineNumber)) })
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message))
await page.goto('http://127.0.0.1:5199/?nointro', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 2500))
const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
const step = +(opt.step || 300)
const shots = opt.shots ? opt.shots.split(',').map(Number) : []
const fpsAt = opt.fps ? opt.fps.split(',').map(Number) : []
const fpsRes = []
let k = 0
for (let y = 0; y <= total + step; y += step) {
  const yy = Math.min(y, total)
  await page.evaluate((y) => window.__lenis.scrollTo(y, { duration: 0.5 }), yy)
  await new Promise(r => setTimeout(r, +(opt.dwell || 350)))
  if (yy >= total) break
}
for (const y of fpsAt) {
  await page.evaluate((y) => window.__lenis.scrollTo(y, { immediate: true }), y)
  await new Promise(r => setTimeout(r, 1200))
  const f = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); let worst = 0, last = t0; function f(t) { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < 3000) requestAnimationFrame(f); else res([Math.round(n / 3), Math.round(worst)]) } requestAnimationFrame(f) }))
  fpsRes.push(y + ': ' + f[0] + 'fps worst ' + f[1] + 'ms')
}
for (const y of shots) {
  await page.evaluate((y) => window.__lenis.scrollTo(y, { immediate: true }), y)
  await new Promise(r => setTimeout(r, +(opt.settle || 2500)))
  await page.screenshot({ path: `${out}-${y}.png` })
}
console.log('FPS\n' + fpsRes.join('\n'))
const uniq = {}; logs.forEach(l => uniq[l] = (uniq[l] || 0) + 1)
console.log('LOGS\n' + Object.entries(uniq).map(([l, n]) => n + 'x ' + l).join('\n'))
await browser.close()
