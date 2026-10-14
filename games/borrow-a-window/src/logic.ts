// 純邏輯：30 秒循環、受限視角、手勢判定、探索點狀態（可單元測試）
export const LOOP_S = 30;
export const YAW_MAX = 12; // 度
export const PITCH_MAX = 6; // 度
export const PAN_X = 0.5, PAN_Y = 0.25; // 相機平移上限（隨視角連動）
export const DEG_PER_PX = 0.08;
export const TAP_SLOP_PX = 6;
export const FEEDBACK_MS = 2000;

export type HotspotId = 'plant' | 'lamp' | 'windmill' | 'roofcat';
export interface Spot { id: HotspotId; layer: '近景' | '中景' | '遠景'; name: string; pos: [number, number, number]; text: string }
export const HOTSPOTS: Spot[] = [
  { id: 'plant', layer: '近景', name: '窗台盆栽', pos: [-0.9, -0.75, -0.8], text: '盆栽的葉子抖了一下，好像在跟你打招呼。' },
  { id: 'lamp', layer: '中景', name: '街角路燈', pos: [2.6, 0.4, -8], text: '路燈眨了兩下，替晚歸的人亮著。' },
  { id: 'windmill', layer: '遠景', name: '山上的風車', pos: [-7, 2.2, -30], text: '風車轉了一圈，剛好三十秒。' },
];

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** 循環時間（秒），0 ≤ t < 30；只由 now 與 start 算，不逐幀累加，故不漂移 */
export const loopTime = (nowMs: number, startMs: number) => {
  const t = ((nowMs - startMs) / 1000) % LOOP_S;
  return t < 0 ? t + LOOP_S : t;
};
export const loopIndex = (nowMs: number, startMs: number) => Math.floor((nowMs - startMs) / 1000 / LOOP_S);

/** 各層循環狀態：全部是週期 30 秒的函數，t=0 與 t=30 數值相同（無跳切） */
export function sceneAt(t: number) {
  const ph = (2 * Math.PI * t) / LOOP_S;
  return {
    sunX: 9 * Math.sin(ph), sunY: 5 + 3 * Math.cos(ph), // 遠景：太陽繞小圓
    windmill: ph, // 遠景：風車轉一圈
    cloudX: 4 * Math.sin(ph), // 中遠：雲左右飄
    lamp: 0.5 - 0.5 * Math.cos(ph), // 中景：路燈亮度 0→1→0
    leaf: 0.12 * Math.sin(2 * ph), // 近景：葉子擺動（兩次／循環）
    sky: 0.5 + 0.5 * Math.cos(ph), // 天色明暗
  };
}

export interface View { yaw: number; pitch: number }
export const centerView = (): View => ({ yaw: 0, pitch: 0 });
/** 拖曳改變視角：往右拖看向左（像推動視線），並夾在上限內 */
export function applyDrag(v: View, dx: number, dy: number): View {
  return { yaw: clamp(v.yaw - dx * DEG_PER_PX, -YAW_MAX, YAW_MAX), pitch: clamp(v.pitch + dy * DEG_PER_PX, -PITCH_MAX, PITCH_MAX) };
}
export function cameraPose(v: View) {
  return { x: (-v.yaw / YAW_MAX) * PAN_X, y: (v.pitch / PITCH_MAX) * PAN_Y, yawRad: (v.yaw * Math.PI) / 180, pitchRad: (-v.pitch * Math.PI) / 180 };
}

export interface Model {
  start: number; view: View; found: Set<HotspotId>;
  active: { id: HotspotId; until: number } | null;
  gesture: { id: number; x0: number; y0: number; lx: number; ly: number; moved: number; base: View } | null;
  resets: number;
}
export const createModel = (now: number): Model => ({ start: now, view: centerView(), found: new Set(), active: null, gesture: null, resets: 0 });
export function reset(m: Model, now: number) {
  m.start = now; m.view = centerView(); m.found = new Set(); m.active = null; m.gesture = null; m.resets++;
}
export function pointerDown(m: Model, id: number, x: number, y: number) {
  if (m.gesture) return; // 只追蹤第一指
  m.gesture = { id, x0: x, y0: y, lx: x, ly: y, moved: 0, base: { ...m.view } };
}
export function pointerMove(m: Model, id: number, x: number, y: number) {
  const g = m.gesture; if (!g || g.id !== id) return;
  g.moved = Math.max(g.moved, Math.hypot(x - g.x0, y - g.y0));
  if (g.moved >= TAP_SLOP_PX) m.view = applyDrag(g.base, x - g.x0, y - g.y0);
  g.lx = x; g.ly = y;
}
/** 回傳 'tap'（可啟動探索點）或 'drag' 或 null */
export function pointerUp(m: Model, id: number): 'tap' | 'drag' | null {
  const g = m.gesture; if (!g || g.id !== id) return null;
  m.gesture = null;
  return g.moved < TAP_SLOP_PX ? 'tap' : 'drag';
}
export function pointerCancel(m: Model) { m.gesture = null; }
export function activate(m: Model, id: HotspotId, now: number) {
  m.found.add(id); m.active = { id, until: now + FEEDBACK_MS }; // 重複點擊：重新播放回饋
}
export function activeAt(m: Model, now: number) { return m.active && now < m.active.until ? m.active : null; }

/** 直式螢幕加大垂直 FOV，讓整扇窗在寬度內完整可見（橫式維持 50°） */
export const fovFor = (aspect: number) => {
  const needed = (2 * Math.atan(0.5 / aspect) * 180) / Math.PI;
  return Math.min(100, Math.max(50, needed));
};

// ---- 難度曲線 ----
export const EXTRA_SPOTS: Spot[] = [
  { id: 'roofcat', layer: '中景', name: '屋頂上的貓', pos: [-3.5, 0.15, -9.6], text: '屋頂上的貓甩了甩尾巴，假裝沒看到你。' },
];
export const ALL_SPOTS: Spot[] = [...HOTSPOTS, ...EXTRA_SPOTS];
export interface Level { n: number; name: string; spots: HotspotId[]; rings: boolean; lampNightOnly: boolean; desc: string }
export const LEVELS: Level[] = [
  { n: 1, name: '第一眼', spots: ['lamp'], rings: true, lampNightOnly: false, desc: '1 個探索點，有黃色光圈提示。' },
  { n: 2, name: '近中遠', spots: ['plant', 'lamp', 'windmill'], rings: true, lampNightOnly: false, desc: '近／中／遠各 1 個，有光圈提示。' },
  { n: 3, name: '沒有提示', spots: ['plant', 'lamp', 'windmill', 'roofcat'], rings: false, lampNightOnly: false, desc: '4 個探索點，不再顯示光圈，只有文字線索。' },
  { n: 4, name: '等天黑', spots: ['plant', 'lamp', 'windmill', 'roofcat'], rings: false, lampNightOnly: true, desc: '4 個、無光圈；路燈只有亮著時（循環 7.5–22.5 秒）點才算。' },
];
export const levelOf = (n: number) => LEVELS.find((l) => l.n === n) ?? LEVELS[LEVELS.length - 1];
export const spotsOf = (n: number) => ALL_SPOTS.filter((h) => levelOf(n).spots.includes(h.id));
export const lampLit = (t: number) => sceneAt(t).lamp >= 0.5; // 7.5s ≤ t ≤ 22.5s
/** 依關卡規則嘗試啟動；回傳 'ok' | 'not-in-level' | 'wait-night' */
export function tryActivate(m: Model, level: number, id: HotspotId, now: number): 'ok' | 'not-in-level' | 'wait-night' {
  const L = levelOf(level);
  if (!L.spots.includes(id)) return 'not-in-level';
  if (L.lampNightOnly && id === 'lamp' && !lampLit(loopTime(now, m.start))) { m.active = null; return 'wait-night'; }
  activate(m, id, now); return 'ok';
}
export const cleared = (m: Model, level: number) => levelOf(level).spots.every((id) => m.found.has(id));
