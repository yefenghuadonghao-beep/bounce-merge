// 浏览器里的“假 wx”冒烟测试：真 Chrome + 伪造的 wx 对象和全局 canvas，跑 minigame/js/game.bundle.js。
// 只验证打包、资源路径、填充布局和输入，不是微信运行时！先 npm run build:wechat。
// 用法：node scripts/wechat-sim.mjs <截图.png> [dpr=3] [宽=390] [高=844] ["x,y>x2,y2;..." 拖拽，CSS 像素]
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const [,, out = 'wechat-sim.png', dsf = '3', vw = '390', vh = '844', clickPlan = ''] = process.argv;
const root = fileURLToPath(new URL('../minigame/', import.meta.url));
const types = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\]|\.\.)+/, '');
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: +vw, height: +vh, deviceScaleFactor: +dsf });
const logs = [];
page.on('pageerror', e => logs.push('pageerror ' + e.message));
page.on('console', m => logs.push('console.' + m.type() + ' ' + m.text()));
page.on('requestfailed', r => logs.push('requestfailed ' + r.url()));
page.on('response', r => { if (r.status() >= 400) logs.push(r.status() + ' ' + r.url()); });
await page.goto(`http://localhost:${port}/game.json`);
await page.evaluate(async () => {
  document.documentElement.innerHTML = '<head></head><body style="margin:0;overflow:hidden"></body>';
  const dpr = devicePixelRatio, w = innerWidth, h = innerHeight;
  const c = document.createElement('canvas');
  c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
  document.body.appendChild(c);
  window.canvas = c;
  const store = {}; window.__wxCalls = [];
  const log = (n, a) => window.__wxCalls.push([n, ...a]);
  const faces = { 'assets/fonts/mochi-rounded-regular.ttf': 400, 'assets/fonts/mochi-rounded-bold.ttf': 700 };
  for (const [url, weight] of Object.entries(faces)) { const f = new FontFace('Resource Han Rounded CN', `url(${url})`, { weight: String(weight) }); await f.load(); document.fonts.add(f); }
  const AC = window.AudioContext;
  window.wx = {
    setStorageSync: (k, v) => { log('setStorageSync', [k]); store[k] = v; },
    getStorageSync: (k) => store[k] ?? '',
    getWindowInfo: () => ({ pixelRatio: dpr, windowWidth: w, windowHeight: h, screenWidth: w, screenHeight: h, safeArea: { top: 47, bottom: h - 34, left: 0, right: w } }),
    getSystemInfoSync: () => ({ pixelRatio: dpr, windowWidth: w, windowHeight: h }),
    loadFont: (p) => { log('loadFont', [p]); return faces[p] ? 'Resource Han Rounded CN' : null; },
    createInnerAudioContext: () => ({ src: '', loop: false, volume: 1, play() { log('music.play', [this.src]); }, stop() {}, destroy() {} }),
    createWebAudioContext: () => new AC(),
    onShow: (cb) => { window.__onShow = cb; }, onHide: (cb) => { window.__onHide = cb; },
    showShareMenu: (o) => log('showShareMenu', [JSON.stringify(o)]),
    onShareAppMessage: () => {}, onShareTimeline: () => {},
    shareAppMessage: (o) => log('shareAppMessage', [o.title]),
    createCanvas: () => c
  };
  const s = document.createElement('script'); s.src = 'js/game.bundle.js'; document.body.appendChild(s);
});
await new Promise(r => setTimeout(r, 4000));
// 点击计划：x,y;x,y  （CSS 像素）
for (const pt of clickPlan.split(';').filter(Boolean)) {
  const [a, b] = pt.split('>');
  const [x, y] = a.split(',').map(Number);
  await page.mouse.move(x, y); await page.mouse.down(); await new Promise(r => setTimeout(r, 80));
  if (b) { const [x2, y2] = b.split(',').map(Number); await page.mouse.move(x2, y2, { steps: 12 }); await new Promise(r => setTimeout(r, 150)); }
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 2500));
}
const info = await page.evaluate(() => ({ canvas: [window.canvas.width, window.canvas.height], font: document.fonts.check('24px "Resource Han Rounded CN"'), calls: window.__wxCalls }));
console.log(JSON.stringify(info));
await page.evaluate(() => { window.__onHide?.(); });
await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => { window.__onShow?.(); });
await page.screenshot({ path: out });
console.log(logs.filter((l) => !/GL Driver|favicon|status of 404/.test(l)).join('\n'));
await browser.close();
server.close();
