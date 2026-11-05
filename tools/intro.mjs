import puppeteer from 'puppeteer-core'
const out = process.argv[2] || '/tmp/claude-501/intro'
const times = (process.argv[3] || '300,900,1600,2600,4200').split(',').map(Number)
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
await page.evaluateOnNewDocument(() => { const WS = window.WebSocket; window.WebSocket = function (url, p) { if (String(p).includes('vite')) return { addEventListener() {}, send() {}, close() {}, readyState: 0 }; return new WS(url, p) } })
await page.setViewport({ width: 1440, height: 900 })
const logs = []
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()) })
await page.goto('http://127.0.0.1:5199/', { waitUntil: 'networkidle0' })
await page.waitForSelector('.ld-choose[data-show="true"]', { timeout: 20000 })
await new Promise(r => setTimeout(r, 1300))
await page.mouse.move(800, 500)
await page.click('.ld-btn-quiet')
let t = 0, i = 0
for (const at of times) { await new Promise(r => setTimeout(r, at - t)); t = at; await page.screenshot({ path: `${out}-${i++}.png` }) }
console.log(logs.slice(0, 20).join('\n'))
await browser.close()
