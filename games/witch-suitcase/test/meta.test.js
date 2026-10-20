import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stars, soClose, nextCombo, comboBonus, unlockItems, daily, load, save, SAVE_KEY } from '../src/meta.js';
import { createState, tryPlace, chapter, CHAPTERS } from '../src/game.js';

test('星等：步數與時間', () => {
  assert.equal(stars(5, 40, 4), 3); assert.equal(stars(6, 40, 4), 2); assert.equal(stars(5, 49, 4), 2); assert.equal(stars(9, 200, 4), 1);
});
test('差一點三星提示', () => {
  assert.deepEqual(soClose(7, 40, 4), { moves: 2, secs: 0 }); assert.equal(soClose(5, 40, 4), null); assert.equal(soClose(9, 40, 4), null);
});
test('連擊', () => {
  let c = 0; c = nextCombo(c, { ok: true, inBox: true }); c = nextCombo(c, { ok: true, inBox: true }); assert.equal(c, 2); assert.equal(comboBonus(c), 20);
  assert.equal(nextCombo(c, { ok: true, inBox: false }), 2); assert.equal(nextCombo(c, { ok: false }), 0);
});
test('圖鑑解鎖', () => { const c = unlockItems(['broom'], 1); assert.ok(c.includes('hairdryer') && c.includes('broom')); assert.equal(c.length, 5); });
test('每日挑戰：同一天相同、不同天多半不同、一定可解', () => {
  assert.deepEqual(daily('2026-10-14'), daily('2026-10-14'));
  const days = Array.from({ length: 30 }, (_, i) => daily(`2026-11-${String(i + 1).padStart(2, '0')}`));
  assert.ok(new Set(days.map((d) => JSON.stringify(d))).size > 20);
  for (const d of days) {
    assert.equal(d.blocks.length, 2);
    const s = createState(d.chapter, { blocks: d.blocks }); const cfg = chapter(d.chapter).configs.smooth;
    for (const [id, a] of Object.entries(cfg)) assert.ok(tryPlace(s, id, ...a).ok, `${d.date} ${id}`);
    assert.equal(s.ending, 'smooth');
  }
});
test('污漬擋住放置', () => {
  const s = createState(1, { blocks: [{ x: 200, y: 100, w: 40, h: 40 }] });
  const r = tryPlace(s, 'makeup', 220, 120, 0); assert.equal(r.ok, false); assert.match(r.reason, /污漬/);
});
test('存檔：讀寫與壞檔', () => {
  const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  assert.equal(load(mem).unlocked, 1); save(mem, { unlocked: 3, best: { 1: 3 }, collection: ['broom'], daily: {}, score: 50 });
  assert.equal(load(mem).best[1], 3); mem.d[SAVE_KEY] = '{壞'; assert.equal(load(mem).unlocked, 1);
});

test('每日挑戰只抽已解鎖章節；用提示最多 2 星', () => {
  for (let d = 1; d <= 28; d++) { const ds = `2026-02-${String(d).padStart(2, '0')}`; assert.equal(daily(ds, 1).chapter, 1); assert.ok(daily(ds, 3).chapter <= 3); }
  assert.equal(stars(1, 1, 4, 1), 2); assert.equal(stars(1, 1, 4, 0), 3);
});
