import { describe, it, expect } from 'vitest';
import * as L from '../src/logic';

describe('30 秒循環', () => {
  it('t 落在 [0,30)，接縫 t=0 與 t→30 數值一致', () => {
    const a = L.sceneAt(0), b = L.sceneAt(30), c = L.sceneAt(29.999);
    for (const k of Object.keys(a) as (keyof typeof a)[]) {
      if (k === 'windmill') { expect(Math.cos(b[k])).toBeCloseTo(Math.cos(a[k]), 6); continue; }
      expect(b[k]).toBeCloseTo(a[k], 6); expect(c[k]).toBeCloseTo(a[k], 2);
    }
    expect(L.loopTime(30000, 0)).toBe(0); expect(L.loopTime(59999, 0)).toBeCloseTo(29.999, 3);
  });
  it('多輪不漂移：第 1、2、100 輪同相位畫面相同', () => {
    const s = 1234;
    for (const ms of [7000, 7000 + 30000, 7000 + 30000 * 100]) expect(L.loopTime(s + ms, s)).toBeCloseTo(7, 6);
    expect(L.loopIndex(s + 65000, s)).toBe(2);
  });
});

describe('受限視角', () => {
  it('極端拖曳夾在上限內', () => {
    let v = L.centerView();
    v = L.applyDrag(v, -100000, 100000); expect(v).toEqual({ yaw: L.YAW_MAX, pitch: L.PITCH_MAX });
    v = L.applyDrag(v, 100000, -100000); expect(v).toEqual({ yaw: -L.YAW_MAX, pitch: -L.PITCH_MAX });
    const p = L.cameraPose(v); expect(Math.abs(p.x)).toBeLessThanOrEqual(L.PAN_X); expect(Math.abs(p.y)).toBeLessThanOrEqual(L.PAN_Y);
  });
  it('多次拖曳／重新觸碰不累積漂移：來回同距離回到原點', () => {
    const m = L.createModel(0);
    for (let i = 0; i < 50; i++) {
      L.pointerDown(m, 1, 100, 100); L.pointerMove(m, 1, 150, 120); L.pointerUp(m, 1);
      L.pointerDown(m, 1, 300, 300); L.pointerMove(m, 1, 250, 280); L.pointerUp(m, 1);
    }
    expect(m.view.yaw).toBeCloseTo(0, 9); expect(m.view.pitch).toBeCloseTo(0, 9);
  });
});

describe('手勢', () => {
  it('移動 <6px 是 tap，否則 drag；第二指忽略', () => {
    const m = L.createModel(0);
    L.pointerDown(m, 1, 10, 10); L.pointerMove(m, 1, 13, 12); expect(L.pointerUp(m, 1)).toBe('tap');
    expect(m.view).toEqual(L.centerView());
    L.pointerDown(m, 1, 10, 10); L.pointerDown(m, 2, 50, 50); L.pointerMove(m, 2, 400, 400);
    expect(m.view).toEqual(L.centerView()); L.pointerMove(m, 1, 40, 10); expect(L.pointerUp(m, 1)).toBe('drag');
  });
});

describe('探索點與 reset', () => {
  it('啟動、重複啟動重播、到期消失', () => {
    const m = L.createModel(0);
    L.activate(m, 'lamp', 1000); expect(L.activeAt(m, 2500)?.id).toBe('lamp'); expect(L.activeAt(m, 3001)).toBeNull();
    L.activate(m, 'lamp', 4000); expect(L.activeAt(m, 5500)?.id).toBe('lamp'); expect(m.found.size).toBe(1);
  });
  it('三輪 reset（拖曳中／回饋中／接縫附近）全部還原', () => {
    const m = L.createModel(0);
    for (const now of [29900, 60050, 89990]) {
      L.activate(m, 'plant', now - 100); L.pointerDown(m, 1, 0, 0); L.pointerMove(m, 1, 200, 50);
      L.reset(m, now);
      expect(m.view).toEqual(L.centerView()); expect(m.found.size).toBe(0); expect(m.active).toBeNull(); expect(m.gesture).toBeNull();
      expect(L.loopTime(now, m.start)).toBe(0); expect(L.loopTime(now + 5000, m.start)).toBeCloseTo(5, 6);
      L.pointerDown(m, 1, 0, 0); L.pointerMove(m, 1, 20, 0); expect(L.pointerUp(m, 1)).toBe('drag');
      expect(m.view.yaw).not.toBe(0);
    }
    expect(m.resets).toBe(3);
  });
  it('探索點固定 3 個、位置固定', () => {
    expect(L.HOTSPOTS.map((h) => h.layer)).toEqual(['近景', '中景', '遠景']);
  });
});

describe('FOV', () => {
  it('橫式 50°，直式加大但 ≤100°', () => {
    expect(L.fovFor(1.6)).toBe(50); expect(L.fovFor(0.46)).toBeGreaterThan(80); expect(L.fovFor(0.2)).toBe(100);
  });
});

describe('關卡', () => {
  it('難度遞增：探索點不減、提示漸少、條件漸嚴', () => {
    for (let i = 1; i < L.LEVELS.length; i++) {
      const a = L.LEVELS[i - 1], b = L.LEVELS[i];
      expect(b.spots.length).toBeGreaterThanOrEqual(a.spots.length);
      expect(Number(!b.rings) + Number(b.lampNightOnly) + b.spots.length).toBeGreaterThan(Number(!a.rings) + Number(a.lampNightOnly) + a.spots.length);
    }
  });
  it('第 1 關只有路燈；點別的不算', () => {
    const m = L.createModel(0);
    expect(L.tryActivate(m, 1, 'plant', 100)).toBe('not-in-level'); expect(L.tryActivate(m, 1, 'lamp', 100)).toBe('ok'); expect(L.cleared(m, 1)).toBe(true);
  });
  it('第 4 關路燈要等天黑', () => {
    const m = L.createModel(0);
    expect(L.tryActivate(m, 4, 'lamp', 2000)).toBe('wait-night'); expect(m.found.has('lamp')).toBe(false);
    expect(L.tryActivate(m, 4, 'lamp', 15000)).toBe('ok');
    for (const id of ['plant', 'windmill', 'roofcat'] as const) L.tryActivate(m, 4, id, 16000);
    expect(L.cleared(m, 4)).toBe(true);
    expect(L.lampLit(7.4)).toBe(false); expect(L.lampLit(7.6)).toBe(true); expect(L.lampLit(22.6)).toBe(false);
  });
});

describe('星等', () => {
  it('依時間給星與差一點提示', () => {
    expect(L.windowStars(9, 1)).toBe(3); expect(L.windowStars(20, 1)).toBe(2); expect(L.windowStars(99, 1)).toBe(1);
    expect(L.windowSoClose(13, 1)).toBe(3); expect(L.windowSoClose(9, 1)).toBeNull(); expect(L.windowSoClose(30, 1)).toBeNull();
  });
});
