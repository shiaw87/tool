// 頁匠工具箱 — 全部在瀏覽器本機處理
import * as pdfjsLib from './vendor/pdf.min.mjs';
import { initBoard } from './board.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.min.mjs', import.meta.url).href;
const { PDFDocument, PDFName, PDFHexString, PDFString, PDFDict, PDFArray, PDFRawStream, PDFNumber, degrees, rgb } = PDFLib;

/* ───────── 基本工具 ───────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
}
const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
const stem = n => n.replace(/\.[^.]+$/, '');
const uid = (() => { let i = 0; return () => 'i' + (++i); })();
const A4 = [595.28, 841.89];
const concat = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
const hexRgb = c => { const n = parseInt(c.slice(1), 16); return rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };

async function readFiles(list) {
  const out = [];
  for (const f of list) out.push({ id: uid(), name: f.name, bytes: new Uint8Array(await f.arrayBuffer()), type: f.type || '' });
  return out;
}
const isPdf = f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
const isRaster = f => /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name) || /^image\/(jpeg|png|webp|gif|bmp)$/.test(f.type);
const isImg = f => /\.(jpe?g|png)$/i.test(f.name) || /^image\/(jpeg|png)$/.test(f.type);

async function openPdfjs(bytes) {
  try { return await pdfjsLib.getDocument({ data: bytes.slice() }).promise; }
  catch (e) { throw new Error(e && e.name === 'PasswordException' ? '這份 PDF 已加密，目前無法開啟加密檔。' : '無法讀取這份 PDF：' + (e.message || e)); }
}
async function openLib(bytes, opts = {}) {
  try { return await PDFDocument.load(bytes, { updateMetadata: false, ...opts }); }
  catch (e) { throw new Error(/encrypt/i.test(e.message) ? '這份 PDF 已加密，目前無法處理加密檔。' : '無法讀取這份 PDF：' + e.message); }
}
async function renderCanvas(pj, pageNo, { scale = 1, width, rot = 0 } = {}) {
  const page = await pj.getPage(pageNo);
  const rotation = (page.rotate + rot) % 360;
  let vp = page.getViewport({ scale: 1, rotation });
  if (width) scale = width / vp.width;
  vp = page.getViewport({ scale, rotation });
  const c = h('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext('2d'), canvas: c, viewport: vp }).promise;
  return c;
}
const canvasBytes = (c, type = 'image/png', q) => new Promise(r => c.toBlob(async b => r(new Uint8Array(await b.arrayBuffer())), type, q));
function parseRange(str, n) {
  str = (str || '').trim();
  if (!str) return Array.from({ length: n }, (_, i) => i);
  const set = new Set();
  for (const part of str.split(/[,，\s]+/)) {
    if (!part) continue;
    const m = part.match(/^(\d+)(?:\s*[-–~]\s*(\d+))?$/);
    if (!m) throw new Error('頁面範圍格式不正確：' + part);
    const a = +m[1], b = m[2] ? +m[2] : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= n) set.add(i - 1);
  }
  return [...set].sort((a, b) => a - b);
}

/* 下載：已發布頁面用平台的下載功能，本機開啟時用一般連結 */
let dlCap = null;
if (window.claude && window.claude.use) window.claude.use('downloads').then(d => dlCap = d).catch(() => {});
async function saveFile(name, bytes) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes]);
  if (dlCap) {
    try { await dlCap.save({ filename: name, data: blob }); return '已儲存 ' + name; }
    catch (e) { if (e && e.code === 'declined') return '已取消儲存'; throw new Error('無法儲存：' + ((e && e.message) || e)); }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  return '已下載 ' + name;
}
async function zipOf(outs) { const z = new JSZip(); for (const o of outs) z.file(o.name, o.bytes); return z.generateAsync({ type: 'blob' }); }
function setStatus(el, kind, msg) { el.className = 'status ' + kind; el.textContent = msg; }
function showResults(box, outs, zipName, status) {
  box.replaceChildren();
  const dl = async (name, data) => { try { setStatus(status, 'ok', await saveFile(name, data)); } catch (e) { setStatus(status, 'err', e.message); } };
  if (outs.length > 1) box.append(h('li', {}, h('span', { class: 'nm' }, `全部 ${outs.length} 個檔案`), h('button', { class: 'btn sm pri', onclick: async () => dl(zipName, await zipOf(outs)) }, '下載 ZIP')));
  for (const o of outs.slice(0, 200)) box.append(h('li', {}, h('span', { class: 'nm' }, o.name, o.note ? h('div', { class: 'hint' }, o.note) : null), h('span', { class: 'num' }, fmtSize(o.bytes.length)), isPreviewable(o.name) ? h('button', { class: 'btn sm', onclick: () => viewBytes(o.name, o.bytes) }, '預覽') : null, h('button', { class: 'btn sm', onclick: () => dl(o.name, o.bytes) }, '下載')));
}
function dropzone(label, types, onFiles, multiple = true) {
  const input = h('input', { type: 'file', accept: types, multiple, hidden: true, id: uid(), onchange: async () => { await onFiles(await readFiles(input.files)); input.value = ''; } });
  const z = h('div', { class: 'drop', tabindex: 0, role: 'button', onclick: () => input.click(), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } } },
    h('b', {}, label), '拖放檔案到這裡，或點一下選擇', input);
  attachDrop(z, onFiles);
  return z;
}
function attachDrop(el, onFiles) {
  el.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); el.classList.add('over'); } });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', async e => { if (!e.dataTransfer.files.length) return; e.preventDefault(); el.classList.remove('over'); await onFiles(await readFiles(e.dataTransfer.files)); });
}

/* ───────── 放大檢視：獨立視窗內縮放與拖曳，不必放大整個網頁 ───────── */
let viewerEl = null;
function openViewer(src, title = '預覽', checker = false) {
  if (!viewerEl) {
    const img = h('img', { alt: '' }), pane = h('div', { class: 'vpane' }, img), pct = h('span', { class: 'num vpct' }), ttl = h('b', { class: 'vttl' });
    const st = { z: 1, fit: 1 };
    const apply = () => { img.style.width = Math.max(1, Math.round(img.naturalWidth * st.z)) + 'px'; pct.textContent = Math.round(st.z * 100) + '%'; };
    const setZ = (z, cx, cy) => { z = Math.min(16, Math.max(.05, z)); const r = pane.getBoundingClientRect(); cx ??= r.width / 2; cy ??= r.height / 2; const fx = (pane.scrollLeft + cx) / st.z, fy = (pane.scrollTop + cy) / st.z; st.z = z; apply(); pane.scrollLeft = fx * z - cx; pane.scrollTop = fy * z - cy; };
    const fit = () => { st.fit = Math.min(1, (pane.clientWidth - 32) / img.naturalWidth, (pane.clientHeight - 32) / img.naturalHeight) || 1; st.z = st.fit; apply(); };
    const close = () => { viewerEl.hidden = true; if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); img.removeAttribute('src'); st.back?.focus?.(); };
    const B = (label, fn, aria) => h('button', { class: 'btn sm', onclick: fn, 'aria-label': aria || label, title: aria || label }, label);
    viewerEl = h('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': '放大檢視', hidden: true },
      h('div', { class: 'vbar' }, ttl, h('span', { style: 'flex:1' }), B('－', () => setZ(st.z / 1.25), '縮小'), pct, B('＋', () => setZ(st.z * 1.25), '放大'), B('符合視窗', fit), B('100%', () => setZ(1)), B('關閉', close)), pane);
    document.body.append(viewerEl);
    img.onload = fit;
    pane.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const r = pane.getBoundingClientRect(); setZ(st.z * Math.exp(-e.deltaY * .01), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    pane.addEventListener('dblclick', e => { const r = pane.getBoundingClientRect(); setZ(st.z < 1 ? 1 : st.z * 2, e.clientX - r.left, e.clientY - r.top); });
    pane.addEventListener('pointerdown', e => { if (e.button) return; const x0 = e.clientX, y0 = e.clientY, sl = pane.scrollLeft, stp = pane.scrollTop; pane.setPointerCapture(e.pointerId); pane.classList.add('grab');
      const mv = ev => { pane.scrollLeft = sl - (ev.clientX - x0); pane.scrollTop = stp - (ev.clientY - y0); }, up = () => { pane.removeEventListener('pointermove', mv); pane.removeEventListener('pointerup', up); pane.classList.remove('grab'); };
      pane.addEventListener('pointermove', mv); pane.addEventListener('pointerup', up); });
    document.addEventListener('keydown', e => { if (viewerEl.hidden) return; if (e.key === 'Escape') close(); else if (e.key === '+' || e.key === '=') setZ(st.z * 1.25); else if (e.key === '-') setZ(st.z / 1.25); else return; e.stopPropagation(); }, true);
    viewerEl._open = (s, t, c) => { st.back = document.activeElement; ttl.textContent = t; pane.classList.toggle('chk', c); viewerEl.hidden = false; img.src = s; $('.vbar .btn:last-child', viewerEl).focus(); };
  }
  viewerEl._open(src, title, checker);
}
const isPreviewable = n => /\.(jpe?g|png|webp)$/i.test(n);
const viewBytes = (name, bytes) => openViewer(URL.createObjectURL(new Blob([bytes], { type: MIME[name.split('.').pop().toLowerCase().replace('jpeg', 'jpg')] })), name, /\.(png|webp)$/i.test(name));

/* ───────── PDF 幾何：以「畫面座標」（左上原點、已套用頁面旋轉）放置內容 ───────── */
function pageView(page) {
  const { x, y, width: w, height: hh } = page.getCropBox();
  const R = ((page.getRotation().angle % 360) + 360) % 360;
  const vw = R % 180 ? hh : w, vh = R % 180 ? w : hh;
  const map = (vx, vy) => R === 0 ? [x + vx, y + hh - vy] : R === 90 ? [x + vy, y + vx] : R === 180 ? [x + w - vx, y + vy] : [x + w - vy, y + hh - vx];
  return { R, vw, vh, map };
}
function placeBox(page, { cx, cy, w, h: bh, angle = 0 }) {
  const v = pageView(page), t = angle * Math.PI / 180;
  const bx = cx - (Math.cos(t) * w / 2 - Math.sin(t) * bh / 2);
  const by = cy + (Math.sin(t) * w / 2 + Math.cos(t) * bh / 2);
  const [x, y] = v.map(bx, by);
  return { x, y, width: w, height: bh, rotate: degrees(v.R + angle) };
}
const placeImage = (page, img, o) => page.drawImage(img, { ...placeBox(page, o), opacity: o.opacity ?? 1 });
const placeRect = (page, o) => page.drawRectangle({ ...placeBox(page, o), color: o.color, opacity: o.opacity ?? 1, borderWidth: 0 });
// 把一頁（已 embed）等比縮放置中畫進目標頁，R 為來源頁的顯示旋轉
function fitEmbedded(target, emb, R, W, H) {
  const w = emb.width, hh = emb.height, vw = R % 180 ? hh : w, vh = R % 180 ? w : hh;
  const s = Math.min(W / vw, H / vh), left = (W - vw * s) / 2, bottom = (H - vh * s) / 2;
  const [x, y] = R === 0 ? [left, bottom] : R === 90 ? [left, bottom + w * s] : R === 180 ? [left + w * s, bottom + hh * s] : [left + hh * s, bottom];
  target.drawPage(emb, { x, y, xScale: s, yScale: s, rotate: degrees(-R) });
}
const rotOf = p => ((p.getRotation().angle % 360) + 360) % 360;

/* 文字轉成透明 PNG（支援中日韓字，不必內嵌字型檔） */
const FONTS = { sans: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif', serif: '"Noto Serif TC","Songti TC",serif', kai: '"LXGW WenKai TC","Noto Serif TC",cursive', mono: 'ui-monospace,Menlo,Consolas,monospace' };
async function textToPng(text, { size = 24, color = '#000000', family = 'sans', bold = false, italic = false, underline = false, strike = false, align = 'left', spacing = 0 } = {}) {
  const S = 4, px = size * S, font = `${italic ? 'italic ' : ''}${bold ? 700 : 400} ${px}px ${FONTS[family] || FONTS.sans}`;
  try { await document.fonts.load(font, text); } catch {}
  const c = h('canvas'); let ctx = c.getContext('2d');
  const prep = () => { ctx.font = font; try { ctx.letterSpacing = spacing * S + 'px'; } catch {} ctx.fillStyle = color; ctx.textBaseline = 'middle'; };
  prep();
  const lines = String(text).split('\n'), ws = lines.map(l => ctx.measureText(l).width), pad = Math.ceil(px * 0.18), lh = px * 1.3;
  const W = Math.max(4, Math.ceil(Math.max(...ws)) + pad * 2), H = Math.ceil(lh * lines.length) + pad * 2;
  c.width = W; c.height = H; ctx = c.getContext('2d'); prep();
  lines.forEach((l, i) => {
    const x = align === 'center' ? (W - ws[i]) / 2 : align === 'right' ? W - pad - ws[i] : pad, y = pad + lh * (i + .5);
    ctx.fillText(l, x, y);
    if (underline) ctx.fillRect(x, y + px * .48, ws[i], Math.max(2, px * .06));
    if (strike) ctx.fillRect(x, y, ws[i], Math.max(2, px * .06));
  });
  return { bytes: await canvasBytes(c), url: c.toDataURL(), w: W / S, h: H / S };
}
async function loadImageFile(f, removeBg = false) {
  const bmp = await createImageBitmap(new Blob([f.bytes]));
  const c = h('canvas'); c.width = bmp.width; c.height = bmp.height; const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
  if (removeBg) {
    const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data, W = c.width, H = c.height;
    const cs = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => (y * W + x) * 4);
    const bg = [0, 1, 2].map(k => cs.reduce((s, i) => s + p[i + k], 0) / 4);
    for (let i = 0; i < p.length; i += 4) {
      const dist = Math.hypot(p[i] - bg[0], p[i + 1] - bg[1], p[i + 2] - bg[2]);
      if (dist < 50) p[i + 3] = 0; else if (dist < 110) p[i + 3] = Math.round(p[i + 3] * (dist - 50) / 60);
    }
    ctx.putImageData(d, 0, 0);
  }
  return { bytes: await canvasBytes(c), url: c.toDataURL(), pw: c.width, ph: c.height };
}

/* ───────── 版面框架 ───────── */
const TOOLS = [];
function tool(def) { TOOLS.push(def); }
function mount() {
  const nav = $('#nav'), main = $('#main'); let grp = ''; const order = ['PDF', '壓縮與轉換', '圖片']; TOOLS.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  for (const t of TOOLS) {
    if (t.group !== grp) { grp = t.group; nav.append(h('div', { class: 'grp' }, grp)); }
    nav.append(h('button', { 'data-t': t.id, onclick: () => go(t.id) }, t.title));
    const sec = t.full ? h('section', { class: 'tool full', id: 't-' + t.id, 'aria-label': t.title }) : h('section', { class: 'tool', id: 't-' + t.id }, h('h1', {}, t.title), h('p', { class: 'sub' }, t.desc));
    main.append(sec); t.build(sec);
  }
  const go = id => { if (!TOOLS.some(t => t.id === id)) id = TOOLS[0].id; $$('.tool').forEach(s => s.classList.toggle('on', s.id === 't-' + id)); main.classList.toggle('full', !!TOOLS.find(t => t.id === id).full); $$('#nav button').forEach(b => b.setAttribute('aria-current', b.dataset.t === id)); if (location.hash.slice(1) !== id) { try { history.replaceState(null, '', '#' + id); } catch {} } window.dispatchEvent(new CustomEvent('toolshown', { detail: id })); };
  const tg = $('#navtoggle'), setNav = c => { document.body.classList.toggle('navc', c); tg.setAttribute('aria-expanded', !c); tg.title = c ? '展開側邊欄' : '收起側邊欄'; tg.setAttribute('aria-label', tg.title); tg.textContent = c ? '»' : '«'; try { localStorage.setItem('yj-nav', c ? '1' : ''); } catch {} window.dispatchEvent(new Event('resize')); };
  tg.onclick = () => setNav(!document.body.classList.contains('navc'));
  let saved = false; try { saved = !!localStorage.getItem('yj-nav'); } catch {} setNav(saved);
  window.addEventListener('hashchange', () => go(location.hash.slice(1)));
  go(location.hash.slice(1));
}
// 批次工具：多個檔案 + 設定 + 執行 + 結果清單
function batchTool({ id, group, title, desc, accept = '.pdf,application/pdf', filter = isPdf, options, action, zipName, run, onFiles, dropLabel = '加入 PDF' }) {
  tool({ id, group, title, desc, build(sec) {
    const files = [];
    const list = h('ul', { class: 'files' }), status = h('div', { class: 'status', role: 'status' }), results = h('ul', { class: 'results' });
    const opt = h('div', {}); if (options) options(opt);
    const redraw = () => list.replaceChildren(...files.map(f => h('li', {}, h('span', { class: 'nm' }, f.name), h('span', { class: 'sz' }, fmtSize(f.bytes.length)), h('button', { class: 'btn sm', 'aria-label': '移除 ' + f.name, onclick: () => { files.splice(files.indexOf(f), 1); redraw(); } }, '移除'))));
    const add = async fs => { const ok = fs.filter(filter); if (ok.length < fs.length) setStatus(status, 'err', '已略過不支援的檔案格式'); files.push(...ok); redraw(); if (onFiles && ok.length) try { await onFiles(files, opt); } catch (e) { setStatus(status, 'err', e.message); } };
    const btn = h('button', { class: 'btn pri', onclick: async () => {
      if (!files.length) return setStatus(status, 'err', '請先加入檔案。');
      btn.disabled = true; const outs = [];
      try {
        for (const [i, f] of files.entries()) { setStatus(status, 'busy', `處理中 ${i + 1}/${files.length}：${f.name}`); outs.push(...await run(f, opt, m => setStatus(status, 'busy', `${f.name}：${m}`))); }
        showResults(results, outs, zipName, status); setStatus(status, 'ok', outs.length ? `已完成，${outs.length} 個檔案可下載。` : '沒有可輸出的內容。');
      } catch (e) { console.error(e); setStatus(status, 'err', '處理失敗：' + e.message); }
      btn.disabled = false;
    } }, action);
    sec.append(h('div', { class: 'cols' },
      h('div', {}, dropzone(dropLabel, accept, add), list),
      h('div', { class: 'side' }, h('div', { class: 'panel' }, h('h2', {}, '設定'), opt, btn, status), h('div', { class: 'panel' }, h('h2', {}, '輸出'), results, h('p', { class: 'hint' }, '處理完成的檔案會列在這裡。')))));
  } });
}
const field = (label, input) => h('label', { class: 'field' }, h('span', {}, label), input);
const inp = (name, type, value, extra = {}) => h('input', { type, name, value, id: uid(), ...extra });
const sel = (name, pairs, value) => { const s = h('select', { name, id: uid() }, pairs.map(([v, l]) => h('option', { value: v }, l))); if (value != null) s.value = value; return s; };
const chk = (name, label, checked = false) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', name, id: uid(), checked }), label);
const val = (root, name) => { const e = $(`[name="${name}"]`, root); return e.type === 'checkbox' ? e.checked : e.value; };

/* ═════════ 1. 組織：新增、合併、分割、排序 ═════════ */
tool({ id: 'organize', group: 'PDF', title: '分割、合併 PDF', desc: '加入多個 PDF 或圖片，拖曳調整順序，旋轉、複製、刪除或插入空白頁，再合併成一份，或把選取的頁面、每一頁分開另存。', build(sec) {
  const files = new Map(); let pages = [];
  const grid = h('div', { class: 'grid' }), status = h('div', { class: 'status', role: 'status' }), results = h('ul', { class: 'results' }), count = h('span', { class: 'num' });
  const optUnify = sel('unify', [['', '保留原頁面尺寸'], ['p', '統一為 A4（直向）'], ['l', '統一為 A4（橫向）']]);
  const optStrip = chk('strip', '移除元數據（metadata）');
  const queue = []; let busy = false;
  const pump = async () => { if (busy) return; busy = true; while (queue.length) { const p = queue.shift(); if (!pages.includes(p) || p.thumb) continue; try { p.thumb = await renderCanvas(files.get(p.file).pj, p.idx + 1, { width: 360 }); const slot = $(`[data-id="${p.id}"] .th`, grid); if (slot) { p.thumb.style.transform = `rotate(${p.rot}deg)`; slot.replaceChildren(p.thumb); } } catch (e) { console.warn(e); } } busy = false; };
  let dragId = null, dragFile = null;
  const zoomPage = async (p, i) => { try { setStatus(status, 'busy', '產生預覽中…'); const c = await renderCanvas(files.get(p.file).pj, p.idx + 1, { scale: 2, rot: p.rot }); const b = await new Promise(r => c.toBlob(r, 'image/png')); openViewer(URL.createObjectURL(b), `${files.get(p.file).name}，第 ${i + 1} 頁`); setStatus(status, '', ''); } catch (e) { setStatus(status, 'err', e.message); } };
  const thumb = h('input', { type: 'range', min: 110, max: 420, step: 10, value: 150, id: uid(), 'aria-label': '縮圖大小', style: 'width:110px' });
  try { const v = +localStorage.getItem('yj-thumb'); if (v >= 110 && v <= 420) thumb.value = v; } catch {}
  const setThumb = () => { grid.style.setProperty('--thumb', thumb.value + 'px'); try { localStorage.setItem('yj-thumb', thumb.value); } catch {} };
  thumb.oninput = setThumb; setThumb();
  // 檔案順序：依各檔第一頁出現的位置；空白頁跟著前一頁所屬的檔案移動
  const fileBar = h('ul', { class: 'files filebar', 'aria-label': '檔案順序' });
  const fileIds = () => [...new Set(pages.filter(p => !p.blank).map(p => p.file))];
  const applyFileOrder = ids => { const g = new Map(); let cur = ids[0]; for (const p of pages) { if (!p.blank) cur = p.file; g.set(p, cur); } pages = ids.flatMap(id => pages.filter(p => g.get(p) === id)); draw(); };
  const moveFile = (id, to) => { const ids = fileIds(), from = ids.indexOf(id); if (from < 0 || to < 0 || to >= ids.length || from === to) return draw(); ids.splice(from, 1); ids.splice(to, 0, id); applyFileOrder(ids); };
  const drawFiles = () => {
    const ids = fileIds();
    fileBar.replaceChildren(...ids.map((id, i) => {
      const f = files.get(id), n = pages.filter(p => p.file === id).length;
      const li = h('li', { draggable: 'true', 'data-file': id,
        ondragstart: e => { dragFile = id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); },
        ondragend: () => { dragFile = null; },
        ondragover: e => { if (dragFile && dragFile !== id) { e.preventDefault(); li.classList.add('dragover'); } }, ondragleave: () => li.classList.remove('dragover'),
        ondrop: e => { if (!dragFile) return; e.preventDefault(); e.stopPropagation(); const src = dragFile; dragFile = null; moveFile(src, i); } },
        h('span', { class: 'grip', 'aria-hidden': 'true' }, '⠿'), h('span', { class: 'num' }, i + 1), h('span', { class: 'nm' }, f.name), h('span', { class: 'sz' }, `${n} 頁`),
        h('button', { class: 'btn sm', disabled: i === 0, 'aria-label': `把 ${f.name} 往前移`, title: '往前移', onclick: () => moveFile(id, i - 1) }, '↑'),
        h('button', { class: 'btn sm', disabled: i === ids.length - 1, 'aria-label': `把 ${f.name} 往後移`, title: '往後移', onclick: () => moveFile(id, i + 1) }, '↓'),
        h('button', { class: 'btn sm', 'aria-label': '移除 ' + f.name, onclick: () => { pages = pages.filter(p => p.file !== id); files.delete(id); draw(); } }, '移除'));
      return li;
    }));
    fileHint.hidden = ids.length < 2;
  };
  const fileHint = h('p', { class: 'hint', hidden: true }, '拖曳檔案列可調整 PDF 的先後順序，該檔的所有頁面會一起移動。');
  const draw = () => {
    drawFiles();
    grid.replaceChildren(...pages.map((p, i) => {
      const th = h('div', { class: 'th' }, p.blank ? h('div', { class: 'blank' }) : (p.thumb || h('span', { class: 'hint' }, '載入中')));
      if (p.thumb) p.thumb.style.transform = `rotate(${p.rot}deg)`;
      const act = (lab, sym, fn) => h('button', { title: lab, 'aria-label': lab, onclick: e => { e.stopPropagation(); fn(); draw(); } }, sym);
      const card = h('div', { class: 'pg' + (p.sel ? ' sel' : ''), 'data-id': p.id, draggable: 'true', tabindex: 0, role: 'checkbox', 'aria-checked': !!p.sel, 'aria-label': `第 ${i + 1} 頁`,
        onclick: () => { p.sel = !p.sel; draw(); }, ondblclick: () => { if (!p.blank) zoomPage(p, i); }, onkeydown: e => { if (e.key === ' ') { e.preventDefault(); p.sel = !p.sel; draw(); } },
        ondragstart: e => { dragId = p.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); }, ondragend: () => { dragId = null; },
        ondragover: e => { if (dragId) { e.preventDefault(); card.classList.add('dragover'); } }, ondragleave: () => card.classList.remove('dragover'),
        ondrop: e => { if (!dragId) return; e.preventDefault(); e.stopPropagation(); const from = pages.findIndex(x => x.id === dragId), to = pages.indexOf(p); dragId = null; if (from < 0 || from === to) return draw(); const [m] = pages.splice(from, 1); pages.splice(to, 0, m); draw(); } },
        th, h('div', { class: 'cap' }, h('span', {}, p.blank ? '空白頁' : files.get(p.file).name), h('span', { class: 'num' }, i + 1)),
        h('div', { class: 'acts' },
          p.blank ? null : h('button', { title: '放大檢視', 'aria-label': '放大檢視', onclick: e => { e.stopPropagation(); zoomPage(p, i); } }, '⤢'),
          act('向左旋轉', '↺', () => p.rot = (p.rot + 270) % 360), act('向右旋轉', '↻', () => p.rot = (p.rot + 90) % 360),
          act('複製頁面', '⧉', () => pages.splice(i + 1, 0, { ...p, id: uid(), sel: false, thumb: null })),
          act('在此頁後加入空白頁', '＋', () => pages.splice(i + 1, 0, { id: uid(), blank: true, rot: 0, w: A4[0], h: A4[1] })),
          act('刪除頁面', '✕', () => pages.splice(i, 1))));
      if (!p.blank && !p.thumb) queue.push(p);
      return card;
    }));
    const nSel = pages.filter(p => p.sel).length; count.textContent = `共 ${pages.length} 頁，已選 ${nSel} 頁`; pump();
  };
  const add = async fs => {
    for (const f of fs) {
      try {
        if (isImg(f)) { const d = await PDFDocument.create(); const im = /png$/i.test(f.name) || f.type === 'image/png' ? await d.embedPng(f.bytes) : await d.embedJpg(f.bytes); const w = im.width * .75, hh = im.height * .75; d.addPage([w, hh]).drawImage(im, { x: 0, y: 0, width: w, height: hh }); f.bytes = await d.save(); }
        else if (!isPdf(f)) { setStatus(status, 'err', `不支援的檔案格式：${f.name}`); continue; }
        f.pj = await openPdfjs(f.bytes); files.set(f.id, f);
        for (let i = 0; i < f.pj.numPages; i++) pages.push({ id: uid(), file: f.id, idx: i, rot: 0 });
      } catch (e) { setStatus(status, 'err', `${f.name}：${e.message}`); }
    }
    draw();
  };
  const build = async (list, { unify, strip }) => {
    const out = await PDFDocument.create(), cache = new Map();
    const src = async id => { if (!cache.has(id)) cache.set(id, await openLib(files.get(id).bytes)); return cache.get(id); };
    const size = unify === 'p' ? A4 : unify === 'l' ? [A4[1], A4[0]] : null;
    for (const p of list) {
      if (p.blank) { out.addPage(size || [p.w, p.h]); continue; }
      const s = await src(p.file);
      if (size) { const sp = s.getPage(p.idx); const [emb] = await out.embedPages([sp]); fitEmbedded(out.addPage(size), emb, (rotOf(sp) + p.rot) % 360, size[0], size[1]); }
      else { const [cp] = await out.copyPages(s, [p.idx]); cp.setRotation(degrees((rotOf(cp) + p.rot) % 360)); out.addPage(cp); }
    }
    if (strip) stripMeta(out); else out.setProducer('頁匠 PDF 工具箱');
    return out.save();
  };
  const opts = () => ({ unify: optUnify.value, strip: $('input', optStrip).checked });
  const guard = fn => async () => { try { setStatus(status, 'busy', '處理中…'); await fn(); } catch (e) { console.error(e); setStatus(status, 'err', '處理失敗：' + e.message); } };
  const need = sel => { const l = sel ? pages.filter(p => p.sel) : pages; if (!l.length) throw new Error(sel ? '請先點選要輸出的頁面。' : '請至少保留一頁作輸出。'); return l; };
  const done = (outs, zip) => { showResults(results, outs, zip, status); setStatus(status, 'ok', `已完成，${outs.length} 個檔案可下載。`); };
  const toImages = async (list, type) => { const outs = []; for (const [i, p] of list.entries()) { let c; if (p.blank) { c = h('canvas'); c.width = Math.round(p.w * 2); c.height = Math.round(p.h * 2); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); } else c = await renderCanvas(files.get(p.file).pj, p.idx + 1, { scale: 2, rot: p.rot }); outs.push({ name: `page-${String(i + 1).padStart(3, '0')}.${type}`, bytes: await canvasBytes(c, type === 'jpg' ? 'image/jpeg' : 'image/png', .92) }); } return outs; };
  const bulk = fn => () => { const l = pages.filter(p => p.sel); if (!l.length) return setStatus(status, 'err', '請先點選頁面。'); fn(l); draw(); };
  const zone = dropzone('加入 PDF、JPG 或 PNG', '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png', add);
  attachDrop(grid, add);
  sec.append(h('div', { class: 'cols' },
    h('div', {}, zone, fileBar, fileHint,
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn sm', onclick: () => { const all = pages.every(p => p.sel); pages.forEach(p => p.sel = !all); draw(); } }, '全選／取消'),
        h('button', { class: 'btn sm', onclick: bulk(l => l.forEach(p => p.rot = (p.rot + 270) % 360)) }, '↺ 旋轉已選'),
        h('button', { class: 'btn sm', onclick: bulk(l => l.forEach(p => p.rot = (p.rot + 90) % 360)) }, '↻ 旋轉已選'),
        h('button', { class: 'btn sm', onclick: bulk(l => pages = pages.filter(p => !p.sel)) }, '刪除已選'),
        h('button', { class: 'btn sm', onclick: () => { pages = []; files.clear(); draw(); } }, '清除全部'), count, h('span', { style: 'flex:1' }), h('label', { class: 'hint', for: thumb.id, style: 'margin:0' }, '縮圖大小'), thumb),
      grid),
    h('div', { class: 'side' },
      h('div', { class: 'panel' }, h('h2', {}, '輸出設定'), field('頁面尺寸', optUnify), optStrip,
        h('div', { class: 'row' },
          h('button', { class: 'btn pri', onclick: guard(async () => done([{ name: 'organized.pdf', bytes: await build(need(false), opts()) }])) }, '合併輸出 PDF'),
          h('button', { class: 'btn', onclick: guard(async () => { const l = need(false), outs = []; for (const [i, p] of l.entries()) outs.push({ name: `page-${String(i + 1).padStart(3, '0')}.pdf`, bytes: await build([p], opts()) }); done(outs, 'split-pages.zip'); }) }, '每頁拆成一個 PDF')),
        h('h2', { style: 'margin-top:14px' }, '已選頁面'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: guard(async () => done([{ name: 'selected-pages.pdf', bytes: await build(need(true), opts()) }])) }, '匯出 PDF'),
          h('button', { class: 'btn', onclick: guard(async () => done(await toImages(need(true), 'jpg'), 'selected-pages-jpg.zip')) }, '匯出 JPG'),
          h('button', { class: 'btn', onclick: guard(async () => done(await toImages(need(true), 'png'), 'selected-pages-png.zip')) }, '匯出 PNG')),
        status),
      h('div', { class: 'panel' }, h('h2', {}, '輸出'), results, h('p', { class: 'hint' }, '點縮圖可選取頁面，拖曳可調整順序，按 ⤢ 或連點兩下可放大檢視。')))));
  sampleDoc().then(bytes => add([{ id: uid(), name: '範例文件.pdf', bytes, type: 'application/pdf' }])).catch(console.warn);
} });
function stripMeta(doc) {
  const info = doc.getInfoDict(); for (const [k] of info.entries()) info.delete(k);
  doc.catalog.delete(PDFName.of('Metadata'));
}
async function sampleDoc() {
  const d = await PDFDocument.create(), font = await d.embedFont(PDFLib.StandardFonts.HelveticaBold), body = await d.embedFont(PDFLib.StandardFonts.Helvetica);
  const c = h('canvas'); c.width = 900; c.height = 520; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 900, 520); g.addColorStop(0, '#1f47c8'); g.addColorStop(1, '#f2b84b'); x.fillStyle = g; x.fillRect(0, 0, 900, 520);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${.05 + (i % 5) * .04})`; x.beginPath(); x.arc((i * 137) % 900, (i * 71) % 520, 20 + (i * 13) % 70, 0, 7); x.fill(); }
  const img = await d.embedJpg(await canvasBytes(c, 'image/jpeg', .95));
  const heads = ['Quarterly Report', 'Budget Summary', 'Delivery Schedule', 'Contact Sheet'];
  heads.forEach((t, i) => { const p = d.addPage(A4); p.drawRectangle({ x: 0, y: 760, width: 595.28, height: 82, color: rgb(.12, .28, .78) }); p.drawText(t, { x: 48, y: 790, size: 26, font, color: rgb(1, 1, 1) });
    if (i === 0) p.drawImage(img, { x: 48, y: 480, width: 500, height: 289 });
    for (let k = 0; k < 9; k++) p.drawText(`Sample line ${k + 1}: invoice INV-20${24 + i}-${100 + k}, contact sample@example.com`, { x: 48, y: (i === 0 ? 440 : 700) - k * 24, size: 12, font: body, color: rgb(.15, .17, .22) });
    p.drawText(`Sample page ${i + 1} of ${heads.length}`, { x: 48, y: 40, size: 10, font: body, color: rgb(.45, .47, .52) }); });
  d.setTitle('Sample document'); d.setAuthor('Yejiang');
  return d.save();
}

/* ═════════ 2. 壓縮（PDF 與圖片） ═════════ */
const PROFILES = { less: [.85, 2400], recommended: [.7, 1800], high: [.5, 1300], extreme: [.3, 900] };
const LADDER = [[.9, 2800], [.8, 2200], [.7, 1800], [.6, 1500], [.5, 1200], [.4, 1000], [.3, 800], [.2, 600], [.12, 420]];
function jpegComponents(b) { let i = 2; while (i + 9 < b.length) { if (b[i] !== 0xFF) return 0; const m = b[i + 1]; if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return b[i + 9]; i += 2 + (b[i + 2] << 8 | b[i + 3]); } return 0; }
async function inflate(bytes) { const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')); return new Uint8Array(await new Response(s).arrayBuffer()); }
async function compressPdf(bytes, q, maxSide) {
  const doc = await openLib(bytes), ctx = doc.context; let touched = 0, skippedCmyk = 0;
  const N = s => PDFName.of(s), name = o => o instanceof PDFName ? o.asString().slice(1) : null;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || name(obj.dict.lookup(N('Subtype'))) !== 'Image') continue;
    const d = obj.dict; if (d.has(N('ImageMask')) || d.has(N('Decode')) || d.has(N('Mask'))) continue;
    let f = d.lookup(N('Filter')); if (f instanceof PDFArray) { if (f.size() !== 1) continue; f = f.lookup(0); } f = name(f);
    const W = d.lookup(N('Width'))?.asNumber?.(), H = d.lookup(N('Height'))?.asNumber?.(); if (!W || !H) continue;
    let bmp;
    try {
      if (f === 'DCTDecode') { const n = jpegComponents(obj.contents); if (n === 4) { skippedCmyk++; continue; } if (n !== 1 && n !== 3) continue; bmp = await createImageBitmap(new Blob([obj.contents], { type: 'image/jpeg' })); }
      else if (f === 'FlateDecode' && !d.has(N('DecodeParms')) && d.lookup(N('BitsPerComponent'))?.asNumber?.() === 8 && W * H >= 40000) {
        const cs = name(d.lookup(N('ColorSpace'))), n = cs === 'DeviceRGB' ? 3 : cs === 'DeviceGray' ? 1 : 0; if (!n) continue;
        const raw = await inflate(obj.contents); if (raw.length < W * H * n) continue;
        const im = new ImageData(W, H); for (let i = 0, j = 0; i < W * H; i++, j += n) { im.data[i * 4] = raw[j]; im.data[i * 4 + 1] = raw[n === 3 ? j + 1 : j]; im.data[i * 4 + 2] = raw[n === 3 ? j + 2 : j]; im.data[i * 4 + 3] = 255; }
        bmp = await createImageBitmap(im);
      } else continue;
    } catch { continue; }
    const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height)), c = h('canvas'); c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
    const jpg = await canvasBytes(c, 'image/jpeg', q); if (jpg.length >= obj.contents.length) continue;
    d.set(N('Width'), PDFNumber.of(c.width)); d.set(N('Height'), PDFNumber.of(c.height)); d.set(N('ColorSpace'), N('DeviceRGB')); d.set(N('BitsPerComponent'), PDFNumber.of(8)); d.set(N('Filter'), N('DCTDecode')); d.delete(N('DecodeParms'));
    ctx.assign(ref, PDFRawStream.of(d, jpg)); touched++;
  }
  return { bytes: await doc.save({ useObjectStreams: true }), touched, skippedCmyk };
}
// 圖片：依品質重新編碼，必要時縮小尺寸。fmt 為 auto 時 JPG 維持 JPG，其餘轉 WebP（保留透明）
async function encodeImage(bmp, { type, q, maxSide = 0, bg = '#ffffff' }) {
  const s = maxSide ? Math.min(1, maxSide / Math.max(bmp.width, bmp.height)) : 1, c = h('canvas');
  c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  if (type === 'image/jpeg') { x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
  x.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, type, q));
  if (!blob) throw new Error('圖片太大，瀏覽器無法處理。');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ext: EXT[blob.type] || 'png', w: c.width, h: c.height, fellBack: blob.type !== type };
}
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const isJpg = f => /\.jpe?g$/i.test(f.name) || f.type === 'image/jpeg';
async function decodeImage(f) { try { return await createImageBitmap(new Blob([f.bytes], { type: f.type || '' })); } catch { throw new Error('這個圖片檔讀不出來，請換成 JPG、PNG、WebP、GIF 或 BMP。'); } }
batchTool({ id: 'compress', group: '壓縮與轉換', title: '壓縮 PDF 與圖片', desc: 'PDF 會重新壓縮內嵌的圖片，文字與向量圖形保持原樣。圖片（JPG、PNG、WebP）會依選定的強度重新編碼。',
  action: '開始壓縮', zipName: 'compressed-files.zip', accept: '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp', filter: f => isPdf(f) || isRaster(f), dropLabel: '加入 PDF 或圖片',
  options(o) {
    const custom = field('壓縮比率（把檔案大小減少 %）', inp('reduction', 'number', 50, { min: 1, max: 99, step: 1 })); custom.hidden = true;
    const s = sel('profile', [['less', '輕度壓縮'], ['recommended', '建議壓縮'], ['high', '高度壓縮'], ['extreme', '極限壓縮'], ['custom', '自訂壓縮']], 'recommended'); s.onchange = () => custom.hidden = s.value !== 'custom';
    o.append(field('壓縮強度', s), custom, h('h2', { style: 'margin-top:14px' }, '圖片檔專用'),
      field('輸出格式', sel('ifmt', [['auto', '自動（JPG 維持 JPG，其餘轉 WebP）'], ['jpg', 'JPG'], ['webp', 'WebP']])),
      field('最長邊上限', sel('iside', [['0', '不縮小尺寸'], ['3840', '3840 px'], ['2560', '2560 px'], ['1920', '1920 px'], ['1280', '1280 px']])),
      h('p', { class: 'hint' }, '實際大小視內容而定。以文字為主的 PDF 可壓縮的空間較小；轉成 JPG 時透明區域會變成白色。'));
  },
  async run(f, o, say) {
    const profile = val(o, 'profile'), r = Number(val(o, 'reduction')), customMode = profile === 'custom';
    if (customMode && (!Number.isInteger(r) || r < 1 || r > 99)) throw new Error('請輸入 1–99 的整數百分比。');
    const target = f.bytes.length * (1 - r / 100), steps = customMode ? LADDER : [PROFILES[profile]];
    const report = (bytes, extra = '') => `${customMode ? `目標減少 ${r}%，` : ''}實際減少 ${Math.round((1 - bytes.length / f.bytes.length) * 100)}%（${fmtSize(f.bytes.length)} → ${fmtSize(bytes.length)}）${extra}`;
    if (isPdf(f)) {
      let best;
      for (const [i, [q, m]] of steps.entries()) { if (customMode) say(`嘗試第 ${i + 1}/${steps.length} 級`); const res = await compressPdf(f.bytes, q, m); if (!best || res.bytes.length < best.bytes.length) best = res; if (!customMode || res.bytes.length <= target) break; }
      if (best.bytes.length >= f.bytes.length) return [{ name: stem(f.name) + '-compressed.pdf', bytes: f.bytes, note: '這份檔案已無法再縮小，輸出與原檔相同。' }];
      return [{ name: stem(f.name) + '-compressed.pdf', bytes: best.bytes, note: report(best.bytes, best.skippedCmyk ? `；${best.skippedCmyk} 張 CMYK 圖片保持原樣` : '') }];
    }
    const bmp = await decodeImage(f), fmt = val(o, 'ifmt'), type = fmt === 'auto' ? (isJpg(f) ? 'image/jpeg' : 'image/webp') : MIME[fmt], maxSide = +val(o, 'iside'); let best;
    for (const [i, [q]] of steps.entries()) { if (customMode) say(`嘗試第 ${i + 1}/${steps.length} 級`); const res = await encodeImage(bmp, { type, q, maxSide }); if (!best || res.bytes.length < best.bytes.length) best = res; if (!customMode || res.bytes.length <= target) break; }
    bmp.close?.();
    if (best.bytes.length >= f.bytes.length && !maxSide) return [{ name: f.name, bytes: f.bytes, note: '這張圖已無法再縮小，輸出與原檔相同。' }];
    return [{ name: `${stem(f.name)}-compressed.${best.ext}`, bytes: best.bytes, note: report(best.bytes, `，${best.w} × ${best.h} px` + (best.fellBack ? '；這個瀏覽器不支援輸出 WebP，已改存 PNG' : '')) }];
  } });

/* ═════════ 3. 格式轉換（PDF 轉圖片、圖片互轉） ═════════ */
batchTool({ id: 'convert', group: '壓縮與轉換', title: '格式轉換', desc: '把 PDF 的每一頁轉成圖片，或在 JPG、PNG、WebP 之間互轉。GIF 與 BMP 也可以當作來源。',
  action: '開始轉換', zipName: 'converted-images.zip', accept: '.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,application/pdf,image/*', filter: f => isPdf(f) || isRaster(f), dropLabel: '加入 PDF 或圖片',
  options(o) {
    o.append(field('輸出格式', sel('fmt', [['jpg', 'JPG'], ['png', 'PNG'], ['webp', 'WebP']])), field('品質（JPG、WebP）', sel('q', [['0.95', '最高'], ['0.9', '高'], ['0.8', '中'], ['0.6', '低']], '0.9')),
      field('透明區域轉成 JPG 時的底色', inp('bg', 'color', '#ffffff', { style: 'width:44px;height:28px;padding:0;border:1px solid var(--line);border-radius:6px' })),
      h('h2', { style: 'margin-top:14px' }, 'PDF 專用'), field('解析度', sel('dpi', [['72', '72 dpi（螢幕）'], ['150', '150 dpi（一般）'], ['300', '300 dpi（列印）']], '150')), field('頁面範圍', inp('range', 'text', '', { placeholder: '留空代表全部頁面，例如 1-3, 5' })));
  },
  async run(f, o, say) {
    const fmt = val(o, 'fmt'), type = MIME[fmt], q = +val(o, 'q'), bg = val(o, 'bg'), outs = [];
    const emit = async (src, name) => { const r = await encodeImage(src, { type, q, bg }); outs.push({ name: `${name}.${r.ext}`, bytes: r.bytes, note: `${r.w} × ${r.h} px` + (r.fellBack ? '；這個瀏覽器不支援輸出 WebP，已改存 PNG' : '') }); };
    if (isPdf(f)) { const pj = await openPdfjs(f.bytes), scale = Number(val(o, 'dpi')) / 72; for (const i of parseRange(val(o, 'range'), pj.numPages)) { say(`第 ${i + 1} 頁`); await emit(await renderCanvas(pj, i + 1, { scale }), `${stem(f.name)}-p${String(i + 1).padStart(3, '0')}`); } }
    else { const bmp = await decodeImage(f); await emit(bmp, stem(f.name)); bmp.close?.(); }
    return outs;
  } });

/* ═════════ 4. 浮水印 ═════════ */
const COLORS = ['#b3261e', '#1f47c8', '#17794a', '#5c6475', '#000000', '#f2b84b'];
function colorField(name, value) {
  const input = inp(name, 'color', value, { style: 'width:44px;height:28px;padding:0;border:1px solid var(--line);border-radius:6px' });
  return h('div', { class: 'row' }, input, h('div', { class: 'sw' }, COLORS.map(c => h('button', { type: 'button', style: 'background:' + c, title: c, 'aria-label': '顏色 ' + c, onclick: () => { input.value = c; input.dispatchEvent(new Event('input', { bubbles: true })); } }))));
}
const POS9 = [['c', '置中'], ['tl', '左上'], ['tc', '上方置中'], ['tr', '右上'], ['ml', '左側置中'], ['mr', '右側置中'], ['bl', '左下'], ['bc', '下方置中'], ['br', '右下']];
function anchor(pos, vw, vh, w, hh, m) {
  const x = pos.includes('l') ? m + w / 2 : pos.includes('r') ? vw - m - w / 2 : vw / 2;
  const y = pos[0] === 't' ? m + hh / 2 : pos[0] === 'b' ? vh - m - hh / 2 : vh / 2;
  return pos === 'c' ? [vw / 2, vh / 2] : [x, y];
}
let wmImage = null;
batchTool({ id: 'watermark', group: 'PDF', title: '浮水印', desc: '在每一頁加上文字或圖片浮水印，可調整大小、顏色、透明度、角度與位置。', action: '套用浮水印', zipName: 'watermarked-pdfs.zip',
  options(o) {
    const txt = h('div', {}, field('浮水印文字', inp('text', 'text', '機密文件')), h('div', { class: 'two' }, field('文字大小', inp('size', 'number', 54, { min: 6, max: 400 })), field('字母間距', inp('spacing', 'number', 2, { min: 0, max: 60 }))), field('顏色', colorField('color', '#b3261e')));
    const prev = h('img', { class: 'sigprev', alt: '浮水印圖片預覽', hidden: true });
    const bg = chk('removebg', '自動去除圖片背景', true); let last = null;
    const loadImg = async () => { if (!last) return; wmImage = await loadImageFile(last, $('input', bg).checked); prev.src = wmImage.url; prev.hidden = false; };
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg', id: uid(), onchange: async e => { [last] = await readFiles(e.target.files); await loadImg(); } });
    $('input', bg).onchange = loadImg;
    const img = h('div', { hidden: true }, field('浮水印圖片', file), bg, prev, field('寬度（佔頁面寬度 %）', inp('imgw', 'number', 40, { min: 2, max: 100 })));
    const type = sel('type', [['text', '文字浮水印'], ['image', '圖片浮水印']]); type.onchange = () => { txt.hidden = type.value !== 'text'; img.hidden = type.value !== 'image'; };
    const angle = inp('angle', 'number', 45, { min: -180, max: 180 });
    const preset = sel('preset', [['45', '左下角至右上角 45 度傾斜'], ['-45', '左上角至右下角 45 度傾斜'], ['0', '水平置中'], ['', '自訂角度']], '45'); preset.onchange = () => { if (preset.value !== '') angle.value = preset.value; };
    o.append(field('類型', type), txt, img, field('排列方式', preset), h('div', { class: 'two' }, field('旋轉角度', angle), field('透明度 %', inp('opacity', 'number', 25, { min: 1, max: 100 }))), field('浮水印位置', sel('pos', POS9)), field('頁面範圍', inp('range', 'text', '', { placeholder: '留空代表全部頁面，例如 1-3, 5' })));
  },
  async run(f, o) {
    const doc = await openLib(f.bytes), type = val(o, 'type'); let png, w0, h0;
    if (type === 'text') { const t = val(o, 'text').trim(); if (!t) throw new Error('請先輸入文字。'); const r = await textToPng(t, { size: +val(o, 'size'), color: val(o, 'color'), bold: true, spacing: +val(o, 'spacing') }); png = r.bytes; w0 = r.w; h0 = r.h; }
    else { if (!wmImage) throw new Error('請先加入浮水印圖片。'); png = wmImage.bytes; }
    const img = await doc.embedPng(png), angle = +val(o, 'angle') || 0, opacity = Math.min(100, Math.max(1, +val(o, 'opacity'))) / 100, pages = doc.getPages();
    for (const i of parseRange(val(o, 'range'), pages.length)) {
      const p = pages[i], v = pageView(p); let w = w0, hh = h0;
      if (type === 'image') { w = v.vw * (+val(o, 'imgw') / 100); hh = w * wmImage.ph / wmImage.pw; }
      const [cx, cy] = anchor(val(o, 'pos'), v.vw, v.vh, w, hh, 24);
      placeImage(p, img, { cx, cy, w, h: hh, angle, opacity });
    }
    return [{ name: stem(f.name) + '-watermarked.pdf', bytes: await doc.save() }];
  } });

/* ═════════ 去背景 ═════════ */
// 以顏色相近程度判斷背景：從圖片邊緣（及使用者點選的位置）往內擴散，適合純色或接近純色的背景
function removeBackground(img, { tol, feather, seeds, edge }) {
  const W = img.width, H = img.height, src = img.data, out = new ImageData(new Uint8ClampedArray(src), W, H), mask = new Uint8Array(W * H), stack = new Int32Array(W * H);
  const T2 = (tol * 2.2) ** 2;
  const flood = (starts, r0, g0, b0) => {
    let n = 0; const push = i => { if (mask[i]) return; const k = i * 4, dr = src[k] - r0, dg = src[k + 1] - g0, db = src[k + 2] - b0; if (src[k + 3] > 8 && dr * dr + dg * dg + db * db > T2) return; mask[i] = 1; stack[n++] = i; };
    for (const i of starts) push(i);
    while (n) { const i = stack[--n], x = i % W; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (i >= W) push(i - W); if (i < W * (H - 1)) push(i + W); }
  };
  if (edge) {
    const border = []; for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x); for (let y = 1; y < H - 1; y++) border.push(y * W, y * W + W - 1);
    const bins = new Map(); for (const i of border) { const k = i * 4, key = (src[k] >> 4) << 8 | (src[k + 1] >> 4) << 4 | src[k + 2] >> 4; let b = bins.get(key); if (!b) bins.set(key, b = [0, 0, 0, 0]); b[0]++; b[1] += src[k]; b[2] += src[k + 1]; b[3] += src[k + 2]; }
    let top = [0]; for (const b of bins.values()) if (b[0] > top[0]) top = b;
    flood(border, top[1] / top[0], top[2] / top[0], top[3] / top[0]);
  }
  for (const s of seeds) { const i = s.y * W + s.x, k = i * 4; flood([i], src[k], src[k + 1], src[k + 2]); }
  let a = new Float32Array(W * H); for (let i = 0; i < W * H; i++) a[i] = mask[i] ? 0 : 1;
  for (let pass = 0; pass < (feather ? 2 : 0); pass++) {          // 邊緣柔化：只讓邊界變淡，不會把背景補回來
    const r = feather, t = new Float32Array(W * H), b = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { let s = 0; const row = y * W; for (let x = -r; x < W; x++) { if (x + r < W) s += a[row + x + r]; if (x - r - 1 >= 0) s -= a[row + x - r - 1]; if (x >= 0) t[row + x] = s / (Math.min(W - 1, x + r) - Math.max(0, x - r) + 1); } }
    for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y < H; y++) { if (y + r < H) s += t[(y + r) * W + x]; if (y - r - 1 >= 0) s -= t[(y - r - 1) * W + x]; if (y >= 0) b[y * W + x] = s / (Math.min(H - 1, y + r) - Math.max(0, y - r) + 1); } }
    for (let i = 0; i < W * H; i++) a[i] = Math.min(a[i], b[i]);
  }
  let removed = 0; for (let i = 0; i < W * H; i++) { if (mask[i]) removed++; out.data[i * 4 + 3] = Math.round(src[i * 4 + 3] * a[i]); }
  return { out, ratio: removed / (W * H) };
}
tool({ id: 'rmbg', group: '圖片', title: '去背景', desc: '把圖片的背景變成透明，輸出 PNG。依顏色判斷背景，適合白底或單色背景的商品圖、簽名、圖示與掃描文件。', build(sec) {
  const status = h('div', { class: 'status', role: 'status' }), cv = h('canvas', { class: 'rmcv', 'aria-label': '去背結果預覽' }), box = h('div', { class: 'pv chk rmbox' }, cv), opt = h('div', {});
  let file = null, orig = null, result = null, seeds = [], showOrig = false, t = 0;
  opt.append(chk('edge', '自動去除與圖片邊緣相連的背景', true), field('顏色容許範圍', h('div', { class: 'row' }, inp('tol', 'range', 18, { min: 1, max: 100, style: 'flex:1' }), h('span', { class: 'num', id: uid() }, '18'))),
    field('邊緣柔化', sel('feather', [['0', '不柔化'], ['1', '輕微'], ['2', '中等'], ['3', '明顯']], '1')),
    h('p', { class: 'hint' }, '在預覽圖上點一下，可以把那個位置相連的同色區域也去掉（例如被主體圍住的背景）。背景去太多就把容許範圍調小。'));
  const paint = () => { if (!orig) return; cv.width = orig.width; cv.height = orig.height; cv.getContext('2d').putImageData(showOrig || !result ? orig : result.out, 0, 0); box.classList.toggle('chk', !showOrig); };
  const run = () => { if (!orig) return; setStatus(status, 'busy', '處理中…'); clearTimeout(t); t = setTimeout(() => { result = removeBackground(orig, { tol: +val(opt, 'tol'), feather: +val(opt, 'feather'), seeds, edge: val(opt, 'edge') }); paint(); setStatus(status, 'ok', `已去除 ${Math.round(result.ratio * 100)}% 的畫面。${seeds.length ? `另外點選了 ${seeds.length} 處。` : ''}`); }, 30); };
  opt.addEventListener('input', () => { $('.num', opt).textContent = val(opt, 'tol'); run(); });
  cv.addEventListener('click', e => { if (!orig || showOrig) return; const r = cv.getBoundingClientRect(); seeds.push({ x: Math.min(orig.width - 1, Math.floor((e.clientX - r.left) * orig.width / r.width)), y: Math.min(orig.height - 1, Math.floor((e.clientY - r.top) * orig.height / r.height)) }); run(); });
  const load = async (f, sample) => {
    const bmp = await decodeImage(f), c = h('canvas'); c.width = bmp.width; c.height = bmp.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
    file = f; orig = x.getImageData(0, 0, c.width, c.height); seeds = []; showOrig = false; toggle.textContent = '看原圖'; tag.hidden = !sample; run();
  };
  const blobOf = () => new Promise(r => { const c = h('canvas'); c.width = orig.width; c.height = orig.height; c.getContext('2d').putImageData(result.out, 0, 0); c.toBlob(r, 'image/png'); });
  const need = () => { if (!result) throw new Error('請先加入圖片。'); };
  const guard = fn => async () => { try { need(); await fn(); } catch (e) { setStatus(status, 'err', e.message); } };
  const toggle = h('button', { class: 'btn sm', onclick: guard(() => { showOrig = !showOrig; toggle.textContent = showOrig ? '看去背結果' : '看原圖'; paint(); }) }, '看原圖');
  const tag = h('span', { class: 'tag', hidden: true }, '範例');
  sec.append(h('div', { class: 'cols' },
    h('div', {}, dropzone('加入圖片', '.jpg,.jpeg,.png,.webp,.gif,.bmp,image/*', async fs => { const f = fs.find(isRaster); if (!f) return setStatus(status, 'err', '請加入 JPG、PNG 或 WebP 圖片。'); try { await load(f); } catch (e) { setStatus(status, 'err', e.message); } }, false),
      h('div', { class: 'toolbar' }, toggle, h('button', { class: 'btn sm', onclick: guard(async () => openViewer(URL.createObjectURL(await blobOf()), '去背結果', true)) }, '放大檢視'),
        h('button', { class: 'btn sm', onclick: guard(() => { seeds = []; run(); }) }, '清除點選'), tag), box),
    h('div', { class: 'side' }, h('div', { class: 'panel' }, h('h2', {}, '設定'), opt,
      h('button', { class: 'btn pri', onclick: guard(async () => setStatus(status, 'ok', await saveFile(stem(file.name) + '-nobg.png', await blobOf()))) }, '下載透明背景 PNG'), status))));
  // 範例：白底上的印章圖樣
  const s = h('canvas'); s.width = 560; s.height = 360; const x = s.getContext('2d'); x.fillStyle = '#fbfaf7'; x.fillRect(0, 0, 560, 360);
  x.strokeStyle = '#b3261e'; x.lineWidth = 10; x.beginPath(); x.arc(280, 180, 130, 0, 7); x.stroke(); x.lineWidth = 3; x.beginPath(); x.arc(280, 180, 112, 0, 7); x.stroke();
  x.fillStyle = '#b3261e'; x.font = '700 64px "Noto Serif TC",serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('頁匠', 280, 160); x.font = '500 24px "Noto Sans TC",sans-serif'; x.fillText('SAMPLE', 280, 220);
  s.toBlob(async b => load({ name: '範例印章.png', type: 'image/png', bytes: new Uint8Array(await b.arrayBuffer()) }, true).catch(console.warn), 'image/png');
} });

/* ═════════ 物件畫板 ═════════ */
tool({ id: 'board', group: '圖片', title: '物件畫板', desc: '在圖片上加文字、圖形、箭頭與筆跡，每個物件之後都能再調整。', full: true, build(sec) {
  const host = h('div', { class: 'boardhost' }); sec.append(host);
  initBoard(host, { saveFile, isActive: () => sec.classList.contains('on') });
} });

/* ═════════ SVG 轉 PNG ═════════ */
const CJK_STACK = `'Noto Sans TC', 'Microsoft JhengHei', '微軟正黑體', 'PingFang TC', 'Heiti TC', 'Source Han Sans TC', sans-serif`;
function fixSvg(raw, strategy) {
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('SVG 語法解析失敗，請確認檔案是有效的 SVG。');
  const svg = doc.documentElement; if (!svg || svg.localName !== 'svg') throw new Error('找不到 <svg> 根節點。');
  if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!svg.getAttribute('xmlns:xlink')) svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.querySelectorAll('foreignObject').forEach(fo => { const c = fo.firstElementChild; if (c && !c.getAttribute('xmlns')) c.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml'); });
  let w = parseFloat(svg.getAttribute('width')), hh = parseFloat(svg.getAttribute('height')); const vb = svg.getAttribute('viewBox');
  if (vb) { const p = vb.trim().split(/[\s,]+/).map(Number); if (p.length === 4 && p[2] > 0 && p[3] > 0) { if (!(w > 0) || /%/.test(svg.getAttribute('width') || '')) w = p[2]; if (!(hh > 0) || /%/.test(svg.getAttribute('height') || '')) hh = p[3]; } }
  if (!(w > 0)) w = 1200; if (!(hh > 0)) hh = 850;
  if (!vb) svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
  svg.setAttribute('width', w); svg.setAttribute('height', hh);
  let css = '';
  if (strategy === 'force') css = `svg, text, tspan, foreignObject, foreignObject * { font-family: ${CJK_STACK} !important; }`;
  else if (strategy === 'auto') { css = `svg, text, tspan, foreignObject, foreignObject div, foreignObject span, foreignObject p { font-family: ${CJK_STACK}; }`;
    svg.querySelectorAll('[font-family]').forEach(el => { const cur = el.getAttribute('font-family') || ''; if (!/Noto Sans TC|JhengHei/.test(cur)) el.setAttribute('font-family', `${cur}, ${CJK_STACK}`); }); }
  if (css) { const st = doc.createElementNS('http://www.w3.org/2000/svg', 'style'); st.textContent = css; svg.insertBefore(st, svg.firstChild); }
  return { svg: new XMLSerializer().serializeToString(svg), w: Math.round(w), h: Math.round(hh) };
}
async function svgToPng(fixed, { scale, bg, pad }) {
  const W = Math.round((fixed.w + pad * 2) * scale), H = Math.round((fixed.h + pad * 2) * scale);
  if (W > 16384 || H > 16384 || W * H > 2e8) throw new Error(`輸出尺寸 ${W} × ${H} px 太大，請降低放大倍率。`);
  const img = new Image(), url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fixed.svg);
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('瀏覽器無法繪製這個 SVG。')); img.src = url; });
  const c = h('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  if (bg !== 'transparent') { x.fillStyle = bg; x.fillRect(0, 0, W, H); }
  x.drawImage(img, Math.round(pad * scale), Math.round(pad * scale), Math.round(fixed.w * scale), Math.round(fixed.h * scale));
  return { bytes: await canvasBytes(c), W, H, svgUrl: url };
}
const DEMO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 300" width="720" height="300">
<defs><marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 1L10 5L0 9z" fill="#475569"/></marker></defs>
<rect x="16" y="16" width="688" height="44" rx="8" fill="#eef0f4" stroke="#cfd4de"/><text x="360" y="45" text-anchor="middle" font-size="18" font-weight="bold" fill="#161b26">訂單處理流程（中文與 foreignObject 測試）</text>
<rect x="16" y="84" width="200" height="200" rx="10" fill="#dfe6fb" stroke="#1f47c8" stroke-width="2"/><text x="116" y="116" text-anchor="middle" font-size="15" font-weight="bold" fill="#1f47c8">1. 接收訂單</text>
<text x="116" y="150" text-anchor="middle" font-size="13" fill="#161b26">網站、門市與電話</text><text x="116" y="174" text-anchor="middle" font-size="13" fill="#5c6475">每日約 320 筆</text>
<rect x="260" y="84" width="200" height="200" rx="10" fill="#fff" stroke="#9a5b00" stroke-width="2" stroke-dasharray="6,4"/><text x="360" y="116" text-anchor="middle" font-size="15" font-weight="bold" fill="#9a5b00">2. 檢查庫存</text>
<foreignObject x="272" y="130" width="176" height="140"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:13px;line-height:1.6;color:#161b26">這段文字放在 foreignObject 裡，會自動換行。缺貨的品項轉給採購，其餘送往出貨。</div></foreignObject>
<rect x="504" y="84" width="200" height="200" rx="10" fill="#e3f4ea" stroke="#17794a" stroke-width="2"/><text x="604" y="116" text-anchor="middle" font-size="15" font-weight="bold" fill="#17794a">3. 包裝出貨</text>
<text x="604" y="150" text-anchor="middle" font-size="13" fill="#161b26">下午三點前完成揀貨</text><text x="604" y="174" text-anchor="middle" font-size="13" fill="#5c6475">隔日送達</text>
<line x1="216" y1="184" x2="256" y2="184" stroke="#475569" stroke-width="2.5" marker-end="url(#a)"/><line x1="460" y1="184" x2="500" y2="184" stroke="#475569" stroke-width="2.5" marker-end="url(#a)"/></svg>`;
tool({ id: 'svg', group: '圖片', title: 'SVG 轉 PNG', desc: '把 SVG 轉成高解析度 PNG，可一次處理多個檔案。轉換時會為文字補上繁體中文字型後備，減少缺字與方塊字。', build(sec) {
  const items = [], cards = h('div', { class: 'cards' }), status = h('div', { class: 'status', role: 'status' }), opt = h('div', {});
  const custom = inp('bgc', 'color', '#ffffff', { style: 'width:44px;height:30px;padding:0;border:1px solid var(--line);border-radius:6px', hidden: true });
  const bgSel = sel('bg', [['#ffffff', '純白底'], ['transparent', '透明底'], ['custom', '自訂顏色']]);
  opt.append(field('解析度放大倍率', sel('scale', [['1', '1x 原始尺寸'], ['2', '2x 清晰'], ['3', '3x 高畫質（簡報、論文）'], ['4', '4x 印刷']], '3')),
    field('背景', h('div', { class: 'row' }, bgSel, custom)), field('四周留白', sel('pad', [['0', '0 px'], ['16', '16 px'], ['32', '32 px'], ['48', '48 px']], '16')),
    field('中文字型處理', sel('font', [['auto', '自動補上中文字型後備'], ['force', '所有文字強制改用繁體黑體'], ['keep', '保留原始字型設定']])),
    h('p', { class: 'hint' }, '字型取自這台電腦已安裝的字型（如微軟正黑體、蘋方）。SVG 內引用的外部圖片或網路字型不會載入。'));
  bgSel.style.flex = '1';
  const settings = () => ({ scale: +val(opt, 'scale'), pad: +val(opt, 'pad'), bg: val(opt, 'bg') === 'custom' ? custom.value : val(opt, 'bg'), font: val(opt, 'font') });
  const outName = it => `${it.name}_${val(opt, 'scale')}x.png`;
  const draw = () => {
    const st = settings();
    cards.replaceChildren(...items.map(it => h('div', { class: 'card' },
      h('div', { class: 'cardhead' }, h('div', { class: 'nm' }, h('b', {}, outName(it)), it.sample ? h('span', { class: 'tag' }, '範例') : null, h('div', { class: 'hint' }, it.err ? it.err : `原始 ${it.w} × ${it.h} px，輸出 ${it.W} × ${it.H} px，${fmtSize(it.bytes.length)}`)),
        h('button', { class: 'btn sm' + (it.mode === 'svg' ? '' : ' on'), 'aria-pressed': it.mode !== 'svg', onclick: () => { it.mode = 'png'; draw(); } }, 'PNG 輸出'),
        h('button', { class: 'btn sm' + (it.mode === 'svg' ? ' on' : ''), 'aria-pressed': it.mode === 'svg', onclick: () => { it.mode = 'svg'; draw(); } }, '原始 SVG'),
        h('button', { class: 'btn sm pri', disabled: !!it.err, onclick: async () => { try { setStatus(status, 'ok', await saveFile(outName(it), it.bytes)); } catch (e) { setStatus(status, 'err', e.message); } } }, '下載'),
        h('button', { class: 'btn sm', 'aria-label': '移除 ' + it.name, onclick: () => { items.splice(items.indexOf(it), 1); draw(); } }, '移除')),
      it.err ? null : h('div', { class: 'pv' + (st.bg === 'transparent' ? ' chk' : '') }, h('img', { src: it.mode === 'svg' ? it.svgUrl : it.url, alt: it.name, title: '點一下放大檢視', style: 'cursor:zoom-in', onclick: () => it.mode === 'svg' ? openViewer(it.svgUrl, it.name + '.svg', true) : viewBytes(outName(it), it.bytes) })))));
    if (!items.length) cards.append(h('p', { class: 'hint' }, '尚未加入 SVG。'));
  };
  const renderItem = async it => { try { const st = settings(), f = fixSvg(it.raw, st.font), r = await svgToPng(f, st); if (it.url) URL.revokeObjectURL(it.url); Object.assign(it, { w: f.w, h: f.h, ...r, url: URL.createObjectURL(new Blob([r.bytes], { type: 'image/png' })), err: null }); } catch (e) { it.err = e.message; } };
  const addRaw = async (name, raw, sample) => { if (!sample) for (let i = items.length - 1; i >= 0; i--) if (items[i].sample) items.splice(i, 1); const it = { name: stem(name), raw, mode: 'png', sample }; items.unshift(it); await renderItem(it); };
  const add = async fs => { let n = 0; for (const f of fs) { if (!/\.svg$/i.test(f.name) && f.type !== 'image/svg+xml') continue; await addRaw(f.name, new TextDecoder().decode(f.bytes)); n++; } draw(); setStatus(status, n ? 'ok' : 'err', n ? `已轉換 ${n} 個 SVG。` : '請選擇 .svg 檔案。'); };
  let t = 0; opt.addEventListener('input', () => { custom.hidden = bgSel.value !== 'custom'; clearTimeout(t); t = setTimeout(async () => { syncLive(); for (const it of items) await renderItem(it); draw(); }, 150); });
  const pasteName = inp('pname', 'text', '貼上的圖.svg', { 'aria-label': '檔案名稱', style: 'width:150px;border:1px solid var(--line);background:var(--surface);border-radius:7px;padding:3px 8px' }), pasteCode = h('textarea', { name: 'pcode', id: uid(), placeholder: '貼上以 <svg ...> 開頭的原始碼', spellcheck: 'false', 'aria-label': 'SVG 程式碼', class: 'code' }, DEMO_SVG);
  const live = h('div', { class: 'pv livepv' }), liveInfo = h('span', { class: 'hint' });
  const syncLive = () => {
    const code = pasteCode.value.trim(), st = settings(); live.classList.toggle('chk', st.bg === 'transparent'); live.style.background = st.bg === 'transparent' ? '' : st.bg;
    if (!code) { live.replaceChildren(h('p', { class: 'hint' }, '在左邊貼上或輸入 SVG，這裡會同步顯示。')); liveInfo.textContent = ''; liveInfo.className = 'hint'; return; }
    try { const f = fixSvg(code, st.font), url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(f.svg), img = h('img', { alt: 'SVG 即時預覽', src: url, title: '點一下放大檢視', style: 'cursor:zoom-in', onclick: () => openViewer(url, pasteName.value || 'SVG 預覽', true) });
      img.onerror = () => { liveInfo.textContent = '瀏覽器無法繪製這段 SVG。'; liveInfo.className = 'hint bad'; };
      live.replaceChildren(img); liveInfo.textContent = `${f.w} × ${f.h} px，${fmtSize(new Blob([code]).size)}`; liveInfo.className = 'hint'; }
    catch (e) { liveInfo.textContent = e.message; liveInfo.className = 'hint bad'; }
  };
  let lt = 0; pasteCode.addEventListener('input', () => { clearTimeout(lt); lt = setTimeout(syncLive, 120); });
  pasteCode.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); pasteCode.setRangeText('  ', pasteCode.selectionStart, pasteCode.selectionEnd, 'end'); } });
  sec.append(h('div', { class: 'cols' },
    h('div', {}, dropzone('加入 SVG', '.svg,image/svg+xml', add),
      h('div', { class: 'panel editor' }, h('div', { class: 'cardhead', style: 'padding:0 0 10px;border:0' }, h('h2', { style: 'margin:0;flex:1' }, '貼上 SVG 原始碼'), pasteName,
          h('button', { class: 'btn sm', onclick: () => { pasteCode.value = ''; syncLive(); pasteCode.focus(); } }, '清空'),
          h('button', { class: 'btn sm pri', onclick: async () => { const code = pasteCode.value.trim(); if (!code.includes('<svg')) return setStatus(status, 'err', '請貼上包含 <svg> 標籤的原始碼。'); await addRaw(pasteName.value.trim() || '貼上的圖.svg', code); draw(); const it = items[0]; setStatus(status, it.err ? 'err' : 'ok', it.err || '已轉換，PNG 在下方。'); } }, '轉換為 PNG')),
        h('div', { class: 'split' }, pasteCode, live), liveInfo),
      cards),
    h('div', { class: 'side' },
      h('div', { class: 'panel' }, h('h2', {}, '輸出設定'), opt,
        h('div', { class: 'row' }, h('button', { class: 'btn pri', onclick: async () => { const ok = items.filter(i => !i.err); if (!ok.length) return setStatus(status, 'err', '沒有可下載的 PNG。'); try { setStatus(status, 'ok', await saveFile(`svg-png-${val(opt, 'scale')}x.zip`, await zipOf(ok.map(i => ({ name: outName(i), bytes: i.bytes }))))); } catch (e) { setStatus(status, 'err', e.message); } } }, '全部打包下載 ZIP'),
          h('button', { class: 'btn', onclick: () => { items.length = 0; draw(); } }, '清空')), status))));
  syncLive();
  addRaw('範例流程圖.svg', DEMO_SVG, true).then(draw);
} });

mount();

