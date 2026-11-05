// node tools/grid.mjs out.png a.png b.png ... (2 columns, half size) using headless chrome canvas
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const [out, ...files] = process.argv.slice(2)
const imgs = files.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'))
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const page = await browser.newPage()
const rows = Math.ceil(imgs.length / 2)
await page.setViewport({ width: 1440, height: rows * 450 })
await page.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:720px 720px">${imgs.map(s => `<img src="${s}" style="width:720px;height:450px;display:block;outline:1px solid #333">`).join('')}</body>`)
await page.screenshot({ path: out })
await browser.close()
