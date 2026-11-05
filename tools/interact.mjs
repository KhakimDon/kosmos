import puppeteer from 'puppeteer-core'
const out = process.argv[2]
const W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900)
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
await page.evaluateOnNewDocument(() => { const WS = window.WebSocket; window.WebSocket = function (url, p) { if (String(p).includes('vite')) return { addEventListener() {}, send() {}, close() {}, readyState: 0 }; return new WS(url, p) } })
await page.setViewport({ width: W, height: H })
const logs = []
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (!['log', 'debug', 'info'].includes(m.type())) logs.push(m.type() + ': ' + m.text()) })
await page.goto('http://127.0.0.1:5199/?nointro', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 2500))
const sl = (ms) => new Promise(r => setTimeout(r, ms))
const shot = async (n) => page.screenshot({ path: `${out}-${n}.png` })
const scrollY = () => page.evaluate(() => Math.round(window.__lenis.scroll))
const steps = JSON.parse(process.argv[5] || '[]')
for (const s of steps) {
  if (s.scroll != null) { await page.evaluate((y) => window.__lenis.scrollTo(y, { immediate: true }), s.scroll); await sl(s.wait || 1500) }
  if (s.click) { const ok = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }, s.click); if (!ok) { logs.push('NO ELEMENT ' + s.click); continue } await page.mouse.move(ok[0], ok[1]); await sl(300); await page.mouse.click(ok[0], ok[1]); await sl(s.wait || 1500) }
  if (s.move) { await page.mouse.move(s.move[0], s.move[1], { steps: 8 }); await sl(s.wait || 600) }
  if (s.drag) { const [x, y, dx] = s.drag; await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 20; i++) { await page.mouse.move(x + dx * i / 20, y, {}); await sl(30) } await sl(s.mid || 100); if (s.shotMid) await shot(s.shotMid); await page.mouse.up(); await sl(s.wait || 800) }
  if (s.key) { await page.keyboard.press(s.key); await sl(s.wait || 1200) }
  if (s.eval) console.log('EVAL', s.eval.slice(0, 40), JSON.stringify(await page.evaluate(s.eval)))
  if (s.shot) await shot(s.shot)
  if (s.y) console.log('scrollY', s.shot || '', await scrollY())
}
console.log(logs.join('\n'))
await browser.close()
