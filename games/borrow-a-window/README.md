# 借一扇窗 — 灰盒原型

Owner：Grok（愛麗咧）。工作單 #2。視覺內容皆為**候選**灰盒。

## 執行

React 18／TypeScript 5.6／React Three Fiber 8／three 0.169／Vite 5，Node 20。

```bash
cd games/borrow-a-window
npm ci
npm run dev       # 開發
npm test          # vitest（純邏輯）
npm run build     # tsc --noEmit + vite build → dist/
npm run preview   # 預覽 dist/（http://localhost:4173/）
# 瀏覽器煙測（另裝 playwright＋chromium，preview 開著；含 65 秒循環實測）：OUT=shots node test/smoke.browser.mjs
```

## 操作

- 按住拖曳（滑鼠或手指）轉動視線；放開後停在原處，不自動回中。
- 點一下（移動 <6px 才算點）黃色光圈的東西，看回饋；已找到的光圈變綠。多指只追蹤第一指。
- 「重來 reset」隨時可按。完全不需要 hover。

## 候選設計

- **一扇窗**：牆上唯一開口 3×2（z=0），相機在室內 z=4，FOV 50°；直式螢幕自動加大 FOV（上限 100°），讓整扇窗都在畫面內。
- **三層景深**：近景＝窗台盆栽（z≈-0.8）；中景＝房子、路燈、草地（z≈-8～-12）；遠景＝山、風車（z≈-30～-32）、太陽（z=-45）；雲在 z=-20。
- **30 秒循環**：`t = ((now - start)/1000) mod 30`，所有動畫都是 t 的週期函數（太陽繞圓、風車一圈、雲左右飄、路燈亮暗、葉子擺兩次、天色明暗）。不逐幀累加，所以不漂移；場景物件只建立一次。
- **視角上限**：yaw ±12°、pitch ±6°；相機同步平移 x ±0.5、y ±0.25（看得出視差，不能走出窗外）。靈敏度 0.08°/px。
- **探索點（固定 3 個）**：近景盆栽 (-0.9,-0.75,-0.8)、中景路燈 (2.6,0.4,-8)、遠景風車 (-7,2.2,-30)。啟動：click／tap 命中（raycast，被牆擋住就不算）。回饋：物件放大脈動＋底部文字 2 秒、光圈轉綠、「已發現 n/3」。重複點：重新播放回饋，不重複計數。
- **reset**：視角歸零、計時從 0、清空已發現與回饋、取消拖曳中的手勢。

## Known limits / TODO

- 視覺全為簡單幾何色塊，最終 UIUX／美術另審；沒有音效。
- 只在 headless Chromium（SwiftShader 軟體 WebGL）測過，實機手機與 Safari 未測；效能未量測。
- 打包後 JS 約 900 KB（three.js），尚未做 code split。
- 鍵盤操作未做（目前只有滑鼠與觸控）。
