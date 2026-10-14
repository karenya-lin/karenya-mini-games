import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corners, penetration, overlaps, outside } from '../src/geometry.js';
import { createState, reset, tryPlace, rotate, evaluate, CONFIG_SMOOTH, CONFIG_CHAOS, SUITCASE, ITEMS } from '../src/game.js';

const R = (x, y, w, h, angle = 0) => corners({ x, y, w, h, angle });
const apply = (s, cfg, order = ['broom', 'cloak', 'book', 'potion', 'cat', 'crystal']) => {
  for (const id of order) { const [x, y, a] = cfg[id]; const r = tryPlace(s, id, x, y, a); assert.ok(r.ok, `${id}: ${r.reason}`); }
};

test('恰好六件物品', () => { assert.equal(createState().items.length, 6); assert.equal(new Set(ITEMS.map((i) => i.id)).size, 6); });

test('重疊：未旋轉 重疊／分離／邊緣接觸', () => {
  assert.ok(overlaps(R(0, 0, 100, 100), R(50, 0, 100, 100)));
  assert.ok(!overlaps(R(0, 0, 100, 100), R(150, 0, 100, 100)));
  assert.ok(!overlaps(R(0, 0, 100, 100), R(100, 0, 100, 100)), '邊緣剛好接觸合法');
  assert.ok(!overlaps(R(0, 0, 100, 100), R(99.6, 0, 100, 100)), '穿透 0.4 在容差內');
  assert.ok(overlaps(R(0, 0, 100, 100), R(99, 0, 100, 100)), '穿透 1 超過容差');
});

test('重疊：旋轉後（外框重疊但實際不重疊 → 合法）', () => {
  // 45° 菱形，外框 141 寬；AABB 會重疊但幾何不重疊
  const d = R(0, 0, 100, 100, 45), sq = R(115, 115, 100, 100);
  assert.ok(!overlaps(d, sq));
  // 旋轉後真的重疊
  assert.ok(overlaps(R(0, 0, 100, 100, 45), R(110, 0, 100, 100)));
  // 旋轉後頂點剛好接觸邊（0.5 容差）
  assert.ok(!overlaps(R(0, 0, 100, 100, 45), R(50 * Math.SQRT2 + 50, 0, 100, 100)));
});

test('越界：四邊、角落、中心在箱內但旋轉角越界', () => {
  assert.deepEqual(outside(R(20, 200, 60, 60), SUITCASE), ['左']);
  assert.deepEqual(outside(R(590, 200, 60, 60), SUITCASE), ['右']);
  assert.deepEqual(outside(R(300, 10, 60, 60), SUITCASE), ['上']);
  assert.deepEqual(outside(R(300, 390, 60, 60), SUITCASE), ['下']);
  assert.deepEqual(outside(R(10, 10, 60, 60), SUITCASE), ['左', '上']);
  assert.deepEqual(outside(R(50, 200, 100, 100), SUITCASE), []);
  assert.deepEqual(outside(R(50, 200, 100, 100, 45), SUITCASE), ['左'], '旋轉後角越界');
});

test('非法放置退回上個合法位置並給原因', () => {
  const s = createState();
  assert.ok(tryPlace(s, 'cat', 300, 200, 0).ok);
  const r = tryPlace(s, 'potion', 310, 200, 0);
  assert.equal(r.ok, false); assert.match(r.reason, /重疊/);
  const p = s.items.find((i) => i.id === 'potion'); assert.deepEqual([p.x, p.y], [800, 110]);
  const r2 = tryPlace(s, 'cloak', 595, 300, 0); assert.equal(r2.ok, false); assert.match(r2.reason, /跨在|超出/);
});

test('旋轉後重新驗證：箱內靠牆的掃帚旋轉 45° 會越界被退回', () => {
  const s = createState();
  assert.ok(tryPlace(s, 'broom', 150, 20, 0).ok);
  const r = rotate(s, 'broom', 1); assert.equal(r.ok, false); assert.match(r.reason, /超出/);
  assert.equal(s.items.find((i) => i.id === 'broom').angle, 0);
});

test('吸附：格線 5 與離牆 15 內貼齊，吸附後仍驗證', () => {
  const s = createState();
  assert.ok(tryPlace(s, 'cat', 62.3, 211.8, 0).ok);
  const c = s.items.find((i) => i.id === 'cat'); assert.deepEqual([c.x, c.y], [50, 210]);
  // 吸到牆後與已在牆邊的物品重疊 → 非法
  assert.ok(tryPlace(s, 'crystal', 47, 330, 0).ok);
  const cr = s.items.find((i) => i.id === 'crystal'); assert.equal(cr.x, 45);
});

test('三條規則 觸發／解除', () => {
  const s = createState();
  apply(s, CONFIG_SMOOTH);
  assert.deepEqual(s.rules, { fragile: false, calm: true, messy: false });
  assert.ok(tryPlace(s, 'crystal', 450, 300, 0).ok); assert.equal(s.rules.calm, false, '②解除');
  assert.ok(tryPlace(s, 'crystal', 355, 300, 0).ok); assert.equal(s.rules.calm, true);
  assert.ok(tryPlace(s, 'book', 70, 100, 180).ok); assert.equal(s.rules.messy, false, '180° 仍整齊');
  assert.ok(tryPlace(s, 'book', 450, 200, 90).ok); assert.equal(s.rules.messy, true, '90° 觸發③'); assert.equal(s.ending, null, '③成立不能順利出發');
});

test('③ 整齊：書轉 45° 觸發、轉回解除', () => {
  const s = createState();
  assert.ok(tryPlace(s, 'book', 300, 200, 0).ok);
  assert.ok(rotate(s, 'book', 1).ok); assert.equal(s.rules.messy, true);
  assert.ok(rotate(s, 'book', -1).ok); assert.equal(s.rules.messy, false);
});

test('結局一 順利出發 可從 reset 達成', () => {
  const s = createState(); apply(s, CONFIG_SMOOTH); assert.equal(s.ending, 'smooth');
});
test('結局二 行李箱暴走 可從 reset 達成，且優先於順利出發', () => {
  const s = createState(); apply(s, CONFIG_CHAOS);
  assert.equal(s.rules.fragile, true); assert.equal(s.rules.calm, true); assert.equal(s.ending, 'chaos');
  assert.ok(tryPlace(s, 'potion', 570, 350, 0).ok); assert.equal(s.ending, 'smooth', '①解除後回到順利出發');
});
test('不在箱內不判定結局與規則', () => {
  const s = createState(); evaluate(s); assert.equal(s.ending, null); assert.deepEqual(s.rules, { fragile: false, calm: false, messy: false });
});
test('三輪 reset：結局後、操作中都完全還原', () => {
  const s = createState(); const fresh = JSON.stringify(createState());
  for (let i = 0; i < 3; i++) {
    apply(s, i % 2 ? CONFIG_CHAOS : CONFIG_SMOOTH); assert.ok(s.ending);
    s.selected = 'cat'; reset(s); assert.equal(JSON.stringify(s), fresh);
    tryPlace(s, 'cat', 300, 200, 0); reset(s); assert.equal(JSON.stringify(s), fresh);
  }
});
