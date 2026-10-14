import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corners, overlaps, outside } from '../src/geometry.js';
import { createState, reset, tryPlace, rotate, evaluate, preview, occupiedCells, cellLabel, CHAPTERS, ITEMS, RULES_DB, SPEC_CHAPTER, chapter, validate } from '../src/game.js';

const R = (x, y, w, h, angle = 0) => corners({ x, y, w, h, angle });
const BOX = { x: 0, y: 0, w: 600, h: 400 };
const ORDER = (cfg) => Object.keys(cfg);
const apply = (s, cfg) => { for (const id of ORDER(cfg)) { const r = tryPlace(s, id, ...cfg[id]); assert.ok(r.ok, `${id}: ${r.reason}`); } };

test('物品 ≥20 件、id 不重複、每章物品都存在', () => {
  assert.ok(ITEMS.length >= 20); assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
  for (const c of CHAPTERS) for (const id of c.items) assert.ok(ITEMS.find((i) => i.id === id), id);
});
test('特別篇＝規格基準：恰好六件、三條規則、兩個結局', () => {
  const c = chapter(SPEC_CHAPTER); assert.equal(c.items.length, 6); assert.equal(c.rules.length, 3);
  assert.deepEqual(Object.keys(c.configs).sort(), ['boom', 'smooth']);
});
test('難度曲線：第 1–5 章物品數遞增、規則數不減', () => {
  for (let i = 1; i < 5; i++) { assert.ok(CHAPTERS[i].items.length > CHAPTERS[i - 1].items.length); assert.ok(CHAPTERS[i].rules.length >= CHAPTERS[i - 1].rules.length); }
});
test('每章初始：桌面上互不重疊、都在桌面內', () => {
  for (const c of CHAPTERS) { const s = createState(c.n); for (const it of s.items) assert.equal(validate(s, it), null, `${c.n}/${it.id}`); }
});

test('重疊：未旋轉 重疊／分離／邊緣接觸', () => {
  assert.ok(overlaps(R(0, 0, 100, 100), R(50, 0, 100, 100)));
  assert.ok(!overlaps(R(0, 0, 100, 100), R(150, 0, 100, 100)));
  assert.ok(!overlaps(R(0, 0, 100, 100), R(100, 0, 100, 100)));
  assert.ok(!overlaps(R(0, 0, 100, 100), R(99.6, 0, 100, 100)));
  assert.ok(overlaps(R(0, 0, 100, 100), R(99, 0, 100, 100)));
});
test('重疊：旋轉後', () => {
  assert.ok(!overlaps(R(0, 0, 100, 100, 45), R(115, 115, 100, 100)));
  assert.ok(overlaps(R(0, 0, 100, 100, 45), R(110, 0, 100, 100)));
  assert.ok(!overlaps(R(0, 0, 100, 100, 45), R(50 * Math.SQRT2 + 50, 0, 100, 100)));
});
test('越界：四邊、角落、旋轉角越界', () => {
  assert.deepEqual(outside(R(20, 200, 60, 60), BOX), ['左']); assert.deepEqual(outside(R(590, 200, 60, 60), BOX), ['右']);
  assert.deepEqual(outside(R(300, 10, 60, 60), BOX), ['上']); assert.deepEqual(outside(R(300, 390, 60, 60), BOX), ['下']);
  assert.deepEqual(outside(R(10, 10, 60, 60), BOX), ['左', '上']);
  assert.deepEqual(outside(R(50, 200, 100, 100), BOX), []); assert.deepEqual(outside(R(50, 200, 100, 100, 45), BOX), ['左']);
});

test('非法放置退回＋原因；旋轉後重新驗證', () => {
  const s = createState(SPEC_CHAPTER);
  assert.ok(tryPlace(s, 'cat', 300, 200, 0).ok);
  const home = s.items.find((i) => i.id === 'book'); const h = [home.x, home.y];
  const r = tryPlace(s, 'book', 310, 200, 0); assert.equal(r.ok, false); assert.match(r.reason, /重疊/); assert.deepEqual([home.x, home.y], h);
  assert.ok(tryPlace(s, 'broom', 150, 20, 0).ok); const r2 = rotate(s, 'broom', 1); assert.equal(r2.ok, false); assert.match(r2.reason, /超出/);
});
test('吸附：格線 5、離牆 15 內貼齊', () => {
  const s = createState(SPEC_CHAPTER); assert.ok(tryPlace(s, 'cat', 62.3, 211.8, 0).ok);
  const c = s.items.find((i) => i.id === 'cat'); assert.deepEqual([c.x, c.y], [50, 210]);
});
test('影子預覽不改狀態，回報吸附位置與合法性', () => {
  const s = createState(SPEC_CHAPTER); tryPlace(s, 'cat', 300, 200, 0); const before = JSON.stringify(s);
  const ok = preview(s, 'crystal', 452, 201, 0); assert.equal(ok.ok, true); assert.deepEqual([ok.x, ok.y], [450, 200]);
  const bad = preview(s, 'crystal', 310, 200, 0); assert.equal(bad.ok, false); assert.match(bad.reason, /重疊/);
  assert.equal(JSON.stringify(s), before);
});
test('格線：佔用格依實際形狀計算', () => {
  const s = createState(SPEC_CHAPTER); tryPlace(s, 'cat', 50, 50, 0); // 0–100 → 5×5 格
  const cells = occupiedCells(s); assert.equal(cells.size, 25); assert.ok(cells.has('0,0') && cells.has('4,4') && !cells.has('5,0'));
  assert.equal(cellLabel(0, 0), 'A1'); assert.equal(cellLabel(2, 9), 'C10'); assert.equal(cellLabel(27, 0), 'AB1');
});

for (const c of CHAPTERS) {
  test(`第 ${c.n} 章（${c.client}）順利出發 可從 reset 達成`, () => { const s = createState(c.n); apply(s, c.configs.smooth); assert.equal(s.ending, 'smooth'); });
  if (c.configs.boom) test(`第 ${c.n} 章 爆炸 可達，爆炸後鎖住操作直到 reset`, () => {
    const s = createState(c.n); const ids = ORDER(c.configs.boom);
    for (const id of ids.slice(0, -1)) assert.ok(tryPlace(s, id, ...c.configs.boom[id]).ok);
    const last = ids.at(-1); tryPlace(s, last, ...c.configs.boom[last]);
    assert.equal(s.ending, 'boom'); assert.equal(s.exploded, true);
    assert.equal(tryPlace(s, ids[0], 10, 10, 0).ok, false);
    reset(s); assert.equal(s.exploded, false); assert.equal(s.ending, null);
  });
}
test('bad 規則擋住過關、good 規則缺少不能過關', () => {
  const c = chapter(1); const s = createState(1); apply(s, c.configs.smooth); assert.equal(s.ending, 'smooth');
  assert.ok(tryPlace(s, 'heels', 220, 30, 0).ok); assert.equal(s.rules.heelsHot, true); assert.equal(s.ending, null);
  const s2 = createState(2); apply(s2, chapter(2).configs.smooth); assert.ok(tryPlace(s2, 'thermos', 300, 200, 0).ok); assert.equal(s2.rules.warm, false); assert.equal(s2.ending, null);
});
test('規格三條規則 觸發／解除（特別篇）', () => {
  const s = createState(SPEC_CHAPTER); apply(s, chapter(SPEC_CHAPTER).configs.smooth);
  assert.deepEqual(s.rules, { fragile: false, calm: true, messy: false });
  assert.ok(tryPlace(s, 'crystal', 450, 300, 0).ok); assert.equal(s.rules.calm, false);
  assert.ok(tryPlace(s, 'crystal', 355, 300, 0).ok); assert.equal(s.rules.calm, true);
  assert.ok(tryPlace(s, 'book', 450, 200, 90).ok); assert.equal(s.rules.messy, true); assert.equal(s.ending, null);
});
test('三輪 reset：結局後、爆炸後、操作中都完全還原', () => {
  for (const c of CHAPTERS) {
    const s = createState(c.n), fresh = JSON.stringify(createState(c.n));
    apply(s, c.configs.smooth); reset(s); assert.equal(JSON.stringify(s), fresh);
    s.selected = s.items[0].id; reset(s); assert.equal(JSON.stringify(s), fresh);
    if (c.configs.boom) { for (const id of ORDER(c.configs.boom)) tryPlace(s, id, ...c.configs.boom[id]); assert.ok(s.exploded); reset(s); assert.equal(JSON.stringify(s), fresh); }
  }
});
test('可換章', () => { const s = createState(1); reset(s, 5); assert.equal(s.chapter, 5); assert.equal(s.items.length, 8); });
