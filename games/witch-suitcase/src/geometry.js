// 旋轉矩形幾何與 SAT 碰撞（不使用物理引擎）
export const EPS = 0.5; // 接觸容差：穿透 <= EPS 視為接觸（合法）

export function corners(it) {
  const a = (it.angle * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  const hw = it.w / 2, hh = it.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [
    round6(it.x + x * c - y * s),
    round6(it.y + x * s + y * c),
  ]);
}
const round6 = (v) => Math.round(v * 1e6) / 1e6;

export function aabb(poly) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function axes(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const ex = x2 - x1, ey = y2 - y1, len = Math.hypot(ex, ey);
    out.push([-ey / len, ex / len]);
  }
  return out;
}
function project(poly, [ax, ay]) {
  let min = Infinity, max = -Infinity;
  for (const [x, y] of poly) { const d = x * ax + y * ay; if (d < min) min = d; if (d > max) max = d; }
  return [min, max];
}

/** 最小穿透深度（<=0 代表分離或剛好接觸；回傳 >0 代表重疊深度） */
export function penetration(pa, pb) {
  let minOverlap = Infinity;
  for (const ax of [...axes(pa), ...axes(pb)]) {
    const [a1, a2] = project(pa, ax), [b1, b2] = project(pb, ax);
    const o = Math.min(a2, b2) - Math.max(a1, b1);
    if (o < minOverlap) minOverlap = o;
    if (minOverlap <= 0) return minOverlap;
  }
  return minOverlap;
}
export const overlaps = (pa, pb) => penetration(pa, pb) > EPS;

/** 兩凸多邊形間距（分離時；重疊時 0）。用 SAT 最大分離量近似，矩形夠用 */
export function gap(pa, pb) {
  let maxSep = -Infinity;
  for (const ax of [...axes(pa), ...axes(pb)]) {
    const [a1, a2] = project(pa, ax), [b1, b2] = project(pb, ax);
    const sep = Math.max(b1 - a2, a1 - b2);
    if (sep > maxSep) maxSep = sep;
  }
  return Math.max(0, maxSep);
}

/** 多邊形是否完全在矩形區域內（容差 EPS），回傳超出的邊 */
export function outside(poly, r) {
  const b = aabb(poly), sides = [];
  if (b.minX < r.x - EPS) sides.push('左');
  if (b.maxX > r.x + r.w + EPS) sides.push('右');
  if (b.minY < r.y - EPS) sides.push('上');
  if (b.maxY > r.y + r.h + EPS) sides.push('下');
  return sides;
}
export function intersectsRect(poly, r) {
  const rp = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  return penetration(poly, rp) > EPS;
}
