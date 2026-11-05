// S11/S12 ending test: hover + click the CTA, capture frames of the dive, the message and the flight home.
// Usage: node tools/s11-test.mjs <outPrefix> [--mode=end|footer]
import puppeteer from 'puppeteer-core'
const args = process.argv.slice(2)
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')))
const out = args.find(a => !a.startsWith('--')) || '/tmp/claude-501/s11t'
const W = +(opt.w || 1440), H = +(opt.h || 900)
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  protocolTimeout: 900000,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
// freeze HMR: other authors edit files concurrently; a stub vite client keeps the page from reloading mid-test
await page.setRequestInterception(true)
const STUB = `export function createHotContext(){return {accept(){},acceptExports(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){},decline(){},data:{}}}
export function updateStyle(id,css){let s=document.querySelector('style[data-vite-dev-id="'+id+'"]');if(!s){s=document.createElement('style');s.setAttribute('data-vite-dev-id',id);document.head.appendChild(s)}s.textContent=css}
export function removeStyle(){}
export function injectQuery(u){return u}
export class ErrorOverlay{}`
page.on('request', (r) => {
  if (/\/@vite\/client$/.test(r.url())) return r.respond({ status: 200, contentType: 'application/javascript', body: STUB })
  r.continue()
})
const logs = []
page.on('console', m => logs.push(m.type() + ': ' + m.text()))
page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message))
await page.goto('http://127.0.0.1:5199/?nointro', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 3000))
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const shot = async (n) => { await page.screenshot({ path: `${out}-${n}.png` }); console.log('shot', n, ((Date.now() - t0) / 1000).toFixed(2), await page.evaluate(() => Math.round(window.scrollY))) }
let t0 = Date.now()
const scrollTo = (y) => page.evaluate((y) => window.__lenis.scrollTo(y, { immediate: true }), y)
const mode = opt.mode || 'end'
if (mode === 'end') {
  const top = await page.evaluate(() => document.getElementById('s11').offsetTop)
  await scrollTo(top + 400)
  await sleep(3500)
  const box = await page.evaluate(() => { const r = document.querySelector('#s11 [data-name="CTA"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  await page.mouse.move(box.x - 150, box.y + 70)
  await sleep(600)
  await shot('a-near')
  await page.mouse.move(box.x + 30, box.y + 4, { steps: 6 })
  await sleep(1800)
  await shot('b-hover')
  t0 = Date.now()
  await page.mouse.click(box.x + 30, box.y + 4)
  const at = (opt.at || '0.6,1.3,2.0,2.6,3.0,3.3,3.6,4.3,6.5').split(',').map(Number)
  if (opt.seek !== 'no') {
    await sleep(300)
    await page.evaluate(() => { window.__s11end.tl.pause(); return 0 })
    await sleep(2500) // let the scroll tilt finish
    for (const t of at) { await page.evaluate((t) => { window.__s11end.tl.seek(t, false); return 0 }, t); await sleep(500); await shot('c-' + t) }
    await page.evaluate(() => { window.__s11end.tl.seek(7).play(); return 0 })
    await sleep(500)
  } else for (const t of at) { const w = t * 1000 - (Date.now() - t0); if (w > 0) await sleep(w); await shot('c-' + t) }
  if (opt.ret !== 'no') {
    t0 = Date.now()
    await page.click('.s11-beyond .bv-ret')
    for (const t of [0.5, 1.0, 2.0, 3.0, 4.2, 6.0]) { const w = t * 1000 - (Date.now() - t0); if (w > 0) await sleep(w); await shot('d-' + t) }
    console.log('scroll after return', await page.evaluate(() => window.scrollY))
  }
} else {
  const top = await page.evaluate(() => document.getElementById('s12').offsetTop)
  for (const [i, y] of [top - 500, top - 250, top].entries()) { await scrollTo(y); await sleep(+(opt.settle || 2500)); await shot('f' + i) }
  const box = await page.evaluate(() => { const r = document.querySelector('#s12 [data-name="Return to origin"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  await page.mouse.move(box.x, box.y); await sleep(800); await shot('g-hover')
  t0 = Date.now()
  await page.mouse.click(box.x, box.y)
  for (const t of [0.8, 2.0, 3.2, 5.0]) { const w = t * 1000 - (Date.now() - t0); if (w > 0) await sleep(w); await shot('h-' + t) }
  console.log('scroll after return', await page.evaluate(() => window.scrollY))
}
console.log(logs.filter(l => !/React DevTools|vite/.test(l)).slice(0, 40).join('\n'))
await browser.close()
