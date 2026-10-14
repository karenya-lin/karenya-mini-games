// 美術載入：優先讀 assets/<key>.png（正式點陣美術），檔案不存在時退回下方的 SVG 暫用圖。
// 每件物品的圖會被拉伸到碰撞矩形大小繪製，因此畫面＝碰撞形狀。
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const eyes = (x1, x2, y, r = 3, c = '#2b1d16') => `<circle cx="${x1}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x2}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x1 + 1}" cy="${y - 1}" r="${r / 3}" fill="#fff"/><circle cx="${x2 + 1}" cy="${y - 1}" r="${r / 3}" fill="#fff"/>`;

export const ITEM_ART = {
  broom: svg(300, 40, `
    <rect x="2" y="16" width="196" height="9" rx="4.5" fill="#9a6a3c" stroke="#5e3d22" stroke-width="2"/>
    <rect x="186" y="12" width="16" height="16" rx="3" fill="#c0392b" stroke="#6e1f17" stroke-width="2"/>
    <path d="M200 6 Q250 0 298 2 L298 38 Q250 40 200 34 Z" fill="#e8b54a" stroke="#8a6116" stroke-width="2"/>
    <path d="M215 8 L295 6 M215 14 L296 13 M215 26 L296 27 M215 32 L295 34" stroke="#b9852a" stroke-width="1.5"/>
    ${eyes(238, 256, 18, 3)}<path d="M238 26 Q248 31 258 25" stroke="#2b1d16" stroke-width="2" fill="none"/>
    <path d="M232 12 L244 14 M252 14 L264 11" stroke="#2b1d16" stroke-width="2"/>`),
  cat: svg(100, 100, `
    <path d="M10 30 L18 2 L38 20 L62 20 L82 2 L90 30 Q98 50 94 80 Q92 98 50 98 Q8 98 6 80 Q2 50 10 30 Z" fill="#2f2b3a" stroke="#14111a" stroke-width="3"/>
    <path d="M20 12 L24 24 M80 12 L76 24" stroke="#e7a3b5" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="34" cy="52" rx="9" ry="10" fill="#f6d55c"/><ellipse cx="66" cy="52" rx="9" ry="10" fill="#f6d55c"/>
    <ellipse cx="34" cy="53" rx="3" ry="8" fill="#14111a"/><ellipse cx="66" cy="53" rx="3" ry="8" fill="#14111a"/>
    <path d="M46 66 L54 66 L50 71 Z" fill="#e7a3b5"/><path d="M50 71 Q44 78 40 74 M50 71 Q56 78 60 74" stroke="#bbb" stroke-width="2" fill="none"/>
    <path d="M8 64 L28 68 M8 74 L28 72 M92 64 L72 68 M92 74 L72 72" stroke="#bbb" stroke-width="1.5"/>
    <circle cx="20" cy="88" r="3" fill="#4b4560"/><circle cx="80" cy="88" r="3" fill="#4b4560"/>`),
  potion: svg(60, 100, `
    <rect x="22" y="2" width="16" height="14" rx="3" fill="#b8865a" stroke="#6b4a2a" stroke-width="2"/>
    <rect x="20" y="15" width="20" height="16" fill="#dff3ff" stroke="#5a7d8c" stroke-width="2"/>
    <path d="M20 30 Q2 44 2 70 Q2 98 30 98 Q58 98 58 70 Q58 44 40 30 Z" fill="#dff3ff" stroke="#5a7d8c" stroke-width="2.5"/>
    <path d="M5 62 Q30 54 55 62 Q58 96 30 96 Q2 96 5 62 Z" fill="#5fc68a"/>
    <circle cx="18" cy="76" r="4" fill="#a6ecc2"/><circle cx="40" cy="84" r="3" fill="#a6ecc2"/><circle cx="30" cy="68" r="2" fill="#a6ecc2"/>
    ${eyes(22, 38, 46, 3.2)}<path d="M23 56 Q26 53 30 56 Q34 59 37 55" stroke="#2b1d16" stroke-width="2" fill="none"/>
    <path d="M48 36 Q52 42 48 44 Q44 42 48 36 Z" fill="#7fc8f8"/>`),
  book: svg(140, 100, `
    <rect x="2" y="4" width="136" height="94" rx="8" fill="#7d3c63" stroke="#3e1a30" stroke-width="3"/>
    <rect x="2" y="4" width="18" height="94" rx="6" fill="#5e2a4a"/>
    <rect x="128" y="10" width="8" height="82" fill="#f3e6c8"/>
    <rect x="28" y="12" width="96" height="78" rx="6" fill="none" stroke="#e5c26a" stroke-width="2.5"/>
    <path d="M90 26 A16 16 0 1 0 90 58 A12 12 0 1 1 90 26 Z" fill="#e5c26a"/>
    <circle cx="56" cy="62" r="11" fill="none" stroke="#2b1d16" stroke-width="2.5"/><circle cx="80" cy="62" r="11" fill="none" stroke="#2b1d16" stroke-width="2.5"/>
    <path d="M67 62 L69 62" stroke="#2b1d16" stroke-width="2.5"/>${eyes(56, 80, 62, 3)}
    <path d="M60 80 L76 80" stroke="#2b1d16" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M110 0 L110 30 L116 24 L122 30 L122 0 Z" fill="#c0392b"/>`),
  crystal: svg(90, 90, `
    <path d="M18 72 L72 72 L80 88 L10 88 Z" fill="#8a5a3a" stroke="#4e3020" stroke-width="2.5"/>
    <circle cx="45" cy="40" r="36" fill="#bfe3f5" stroke="#4f86a8" stroke-width="3"/>
    <path d="M22 46 Q36 22 58 30 Q72 38 62 54 Q50 66 34 56" fill="none" stroke="#e1b0ff" stroke-width="5" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="30" cy="22" rx="9" ry="5" fill="#fff" opacity=".8" transform="rotate(-30 30 22)"/>
    <path d="M34 42 Q38 38 42 42 M50 42 Q54 38 58 42" stroke="#2b1d16" stroke-width="2.5" fill="none"/>
    <path d="M38 52 Q46 58 54 52" stroke="#2b1d16" stroke-width="2.5" fill="none"/>
    <circle cx="30" cy="50" r="4" fill="#f5a3b5" opacity=".7"/><circle cx="62" cy="50" r="4" fill="#f5a3b5" opacity=".7"/>`),
  cloak: svg(200, 120, `
    <path d="M6 20 Q100 2 194 20 L190 110 Q100 120 10 110 Z" fill="#33437a" stroke="#1a2245" stroke-width="3"/>
    <path d="M6 20 Q100 40 194 20 L194 32 Q100 54 6 32 Z" fill="#26325e"/>
    <path d="M100 30 L100 112" stroke="#1a2245" stroke-width="2" stroke-dasharray="4 4"/>
    <path d="M160 52 A14 14 0 1 0 160 80 A10 10 0 1 1 160 52 Z" fill="#f1d38a"/>
    <path d="M40 56 l3 7 7 0 -6 4 2 7 -6 -4 -6 4 2 -7 -6 -4 7 0Z M66 84 l2 4 4 0 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 0Z M130 92 l2 4 4 0 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 0Z" fill="#f1d38a"/>
    <path d="M86 70 Q92 74 98 70 M106 70 Q112 74 118 70" stroke="#f3e6c8" stroke-width="2.5" fill="none"/>
    <path d="M96 84 Q102 87 108 84" stroke="#f3e6c8" stroke-width="2" fill="none"/>
    <circle cx="100" cy="28" r="6" fill="#e5c26a" stroke="#8a6116" stroke-width="2"/>`),
};

export const SUITCASE_ART = svg(600, 400, `
  <defs><pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#efd9b8"/><path d="M0 20 L40 20 M20 0 L20 40" stroke="#e3c69c" stroke-width="6"/><circle cx="20" cy="20" r="3" fill="#d9a77a"/></pattern></defs>
  <rect x="0" y="0" width="600" height="400" rx="18" fill="#8a4f2a"/>
  <rect x="10" y="10" width="580" height="380" rx="12" fill="url(#p)"/>
  <rect x="10" y="10" width="580" height="380" rx="12" fill="none" stroke="#5e3218" stroke-width="3" stroke-dasharray="8 6"/>
  <rect x="140" y="0" width="22" height="400" fill="#5e3218" opacity=".25"/><rect x="438" y="0" width="22" height="400" fill="#5e3218" opacity=".25"/>
  <circle cx="16" cy="16" r="5" fill="#e5c26a"/><circle cx="584" cy="16" r="5" fill="#e5c26a"/><circle cx="16" cy="384" r="5" fill="#e5c26a"/><circle cx="584" cy="384" r="5" fill="#e5c26a"/>`);

export const TABLE_ART = svg(400, 400, `
  <defs><linearGradient id="w" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3a3157"/><stop offset="1" stop-color="#5a4a7a"/></linearGradient></defs>
  <rect width="400" height="400" fill="url(#w)"/>
  <circle cx="330" cy="60" r="26" fill="#f6e6a8"/><circle cx="318" cy="52" r="24" fill="#3e3460"/>
  <circle cx="80" cy="40" r="2" fill="#fff"/><circle cx="200" cy="70" r="1.5" fill="#fff"/><circle cx="260" cy="30" r="2" fill="#fff"/><circle cx="140" cy="100" r="1.5" fill="#fff"/>
  <rect x="40" y="0" width="360" height="400" fill="#c79563" opacity=".92"/>
  <path d="M40 60 L400 60 M40 130 L400 130 M40 200 L400 200 M40 270 L400 270 M40 340 L400 340" stroke="#a87445" stroke-width="3"/>
  <path d="M120 60 Q140 90 120 130 M300 200 Q280 230 300 270" stroke="#a87445" stroke-width="2" fill="none"/>`);

export const FALLBACK = { ...ITEM_ART, suitcase: SUITCASE_ART, bg: TABLE_ART };
export const ASSET_DIR = 'assets/';
const toData = (svgText) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
const cache = new Map();
export const source = {}; // key -> 'png' | 'fallback'（測試與除錯用）
export function art(key) {
  if (!cache.has(key)) {
    const i = new Image();
    i.onerror = () => { if (!FALLBACK[key]) { source[key] = 'none'; return; } if (source[key] !== 'fallback') { source[key] = 'fallback'; i.src = toData(FALLBACK[key]); } };
    i.onload = () => { if (!source[key]) source[key] = 'png'; };
    i.src = `${ASSET_DIR}${key}.png`;
    cache.set(key, i);
  }
  return cache.get(key);
}
/** 是否有可畫的圖（png 或 SVG 暫用圖）；false 時畫面改畫色塊＋名稱 */
export const drawable = (key) => { const i = art(key); return i.complete && i.naturalWidth > 0; };
export const ready = (keys = Object.keys(FALLBACK)) => Promise.all(keys.map((k) => new Promise((r) => {
  const i = art(k); const done = () => (i.complete && i.naturalWidth > 0) || source[k] === 'none';
  const t = setInterval(() => { if (done()) { clearInterval(t); r(); } }, 30); setTimeout(() => { clearInterval(t); r(); }, 3000);
})));
