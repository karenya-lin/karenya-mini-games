import { chromium } from 'playwright';
const OUT = process.env.OUT || 'shots';
const b = await chromium.launch(); const errs = [];
for (const [name, opts] of [['desktop', { viewport: { width: 1366, height: 860 } }], ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const ctx = await b.newContext(opts), p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(name + ' ' + e.message));
  await p.goto((process.env.URL || 'http://localhost:5181/index.html')); await p.waitForFunction(() => window.__game); await p.waitForTimeout(300);
  const drag = async (id, tx, ty) => { const [sx, sy] = await p.evaluate((id) => { const i = window.__game.state.items.find((i) => i.id === id); return window.__game.toScreen(i.x, i.y); }, id); const [ex, ey] = await p.evaluate(([x, y]) => window.__game.toScreen(x, y), [tx, ty]); await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(ex, ey, { steps: 5 }); await p.mouse.up(); };
  const cfg = await p.evaluate(async () => (await import('./src/game.js')).chapter(1).configs.smooth);
  const ids = Object.keys(cfg);
  for (const [k, id] of ids.entries()) { await drag(id, ...cfg[id].slice(0, 2)); if (k === 2) { await p.waitForTimeout(120); await p.screenshot({ path: `${OUT}/${name}-combo.png`, fullPage: true }); } }
  await p.waitForTimeout(400);
  console.log(name, 'ch1 result', await p.evaluate(() => ({ ...window.__game.run.result, combo: window.__game.run.maxCombo })), await p.locator('#result').innerText());
  await p.screenshot({ path: `${OUT}/${name}-stars.png`, fullPage: true });
  // 故意多走幾步 → 差一點三星
  await p.locator('#retry').click();
  for (const id of ids) await drag(id, ...cfg[id].slice(0, 2));
  // 已全部過關？先拿出再放（多步）— 重新開始改以額外旋轉增加步數
  await p.locator('#retry').click();
  await drag('makeup', 300, 150); await drag('makeup', 300, 160);
  for (const id of ids) await drag(id, ...cfg[id].slice(0, 2));
  await p.waitForTimeout(300);
  console.log(name, 'retry result', await p.evaluate(() => window.__game.run.result), await p.locator('#result .close').innerText().catch(() => '(no nudge)'));
  await p.screenshot({ path: `${OUT}/${name}-so-close.png`, fullPage: true });
  await p.locator('#bookBtn').click(); await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/${name}-collection-book.png` });
  console.log(name, 'book', await p.locator('dialog#book .count').innerText(), 'unlocked entries', await p.locator('.entry:not(.locked)').count());
  await p.locator('dialog#book button').click();
  await p.locator('#dailyBtn').click(); await p.waitForTimeout(300);
  console.log(name, 'daily', await p.evaluate(() => ({ d: window.__game.daily(), ch: window.__game.state.chapter, blocks: window.__game.state.blocks.length })));
  await p.screenshot({ path: `${OUT}/${name}-daily.png`, fullPage: true });
  await p.reload(); await p.waitForFunction(() => window.__game);
  console.log(name, 'persisted', await p.evaluate(() => ({ unlocked: window.__game.unlocked, best: window.__game.save.best, score: window.__game.save.score, coll: window.__game.save.collection.length })));
  await ctx.close();
}
console.log('errors', errs); await b.close();
