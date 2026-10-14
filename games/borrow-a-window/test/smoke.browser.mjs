import { chromium } from 'playwright';
const URL = process.env.URL || 'http://localhost:4173/', OUT = process.env.OUT || 'shots';
const log = (...a) => console.log(...a);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
async function run(name, opts, touch, loopTest) {
  const ctx = await b.newContext(opts), p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message)); p.on('console', (m) => m.type() === 'error' && errors.push(name + ': ' + m.text()));
  await p.goto(URL); await p.waitForFunction(() => window.__win && window.__win.project('plant')); await p.waitForTimeout(800);
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  const S = (f, a) => p.evaluate(f, a);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  async function drag(x0, y0, x1, y1, release = true) {
    if (touch) { await tp('touchStart', x0, y0); for (let k = 1; k <= 10; k++) await tp('touchMove', x0 + (x1 - x0) * k / 10, y0 + (y1 - y0) * k / 10); if (release) await tp('touchEnd'); }
    else { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 10 }); if (release) await p.mouse.up(); }
  }
  async function tapAt(x, y) { if (touch) { await tp('touchStart', x, y); await tp('touchEnd'); } else { await p.mouse.click(x, y); } }
  const view = () => S(() => ({ ...window.__win.model.view }));
  const W = opts.viewport.width, H = opts.viewport.height, cx = W / 2, cy = H / 2;
  await p.screenshot({ path: `${OUT}/${name}-01-center.png` });
  // 視角極限
  await drag(cx, cy, cx + 2000, cy - 2000); log(name, 'extreme A', await view()); await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/${name}-02-limit-a.png` });
  await drag(cx, cy, cx - 2000, cy + 2000); log(name, 'extreme B', await view()); await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/${name}-03-limit-b.png` });
  for (let i = 0; i < 10; i++) { await drag(cx, cy, cx - 3000, cy + 3000); }
  log(name, 'after 10 re-touches at limit', await view());
  // 探索點：reset 後點每個
  await S(() => window.__win.reset()); await p.waitForTimeout(300); // 等相機更新一幀
  for (const id of ['plant', 'lamp', 'windmill']) {
    const [x, y] = await S((id) => window.__win.project(id), id);
    const picked = await S(([x, y]) => window.__win.pick(x, y), [x, y]);
    await tapAt(x, y); await p.waitForTimeout(300);
    const fb = await p.locator('[data-testid=feedback]').textContent().catch(() => null);
    log(name, 'tap', id, 'at', [Math.round(x), Math.round(y)], 'pick=', picked, 'feedback=', fb, 'found=', await p.locator('[data-testid=found]').textContent());
    await p.screenshot({ path: `${OUT}/${name}-04-tap-${id}.png` });
  }
  // 重複啟動
  const [lx, ly] = await S(() => window.__win.project('lamp')); await tapAt(lx, ly); await p.waitForTimeout(100); await tapAt(lx, ly);
  log(name, 'repeat lamp', await S(() => window.__win.model.found.size), await S(() => window.__win.model.active?.id));
  // 偏移視角後仍可點到（遠景在極限下）
  await drag(cx, cy, cx + 2000, cy); const pw = await S(() => window.__win.project('windmill'));
  log(name, 'at yaw limit windmill pick', await S(([x, y]) => window.__win.pick(x, y), pw));
  // 三輪 reset：拖曳中、回饋中
  for (let r = 0; r < 3; r++) {
    const [px, py] = await S(() => window.__win.project('plant')); await tapAt(px, py);
    await drag(cx, cy, cx + 150, cy + 40, false);
    if (touch) { await tp('touchEnd'); await S(() => window.__win.reset()); } else { await S(() => window.__win.reset()); await p.mouse.up(); }
    await p.waitForTimeout(50);
    const st = await S(() => { const m = window.__win.model; return { view: m.view, found: m.found.size, active: m.active, gesture: m.gesture, t: window.__win.L.loopTime(performance.now(), m.start) }; });
    await drag(cx, cy, cx + 60, cy); const after = await view();
    log(name, `reset#${r + 1}`, JSON.stringify(st), 'input ok yaw=', after.yaw.toFixed(2));
  }
  await S(() => window.__win.reset()); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}-05-after-reset.png` });
  if (loopTest) {
    await S(() => window.__win.reset());
    const samples = [];
    for (const target of [5, 29.5, 30.5, 35, 59.5, 60.5, 65]) {
      await p.waitForFunction((tg) => (performance.now() - window.__win.model.start) / 1000 >= tg, target, { timeout: 80000, polling: 20 });
      const s = await S(() => { const m = window.__win.model, L = window.__win.L, now = performance.now(); return { el: (now - m.start) / 1000, t: L.loopTime(now, m.start), round: L.loopIndex(now, m.start) + 1, timer: document.querySelector('[data-testid=timer]').textContent }; });
      samples.push(s); if ([5, 35, 65].includes(target)) await p.screenshot({ path: `${OUT}/${name}-06-loop-t5-round${s.round}.png` });
      log(name, 'loop', JSON.stringify(s));
    }
    log(name, 'three.js scene object count', await S(() => document.querySelectorAll('canvas').length));
  }
  await ctx.close();
}
await run('desktop', { viewport: { width: 1280, height: 800 } }, false, true);
await run('mobile', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, true, false);
log('errors', errors);
await b.close();
