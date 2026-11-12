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
  for (const o of outs.slice(0, 200)) box.append(h('li', {}, h('span', { class: 'nm' }, o.name, o.note ? h('div', { class: 'hint' }, o.note) : null), h('span', { class: 'num' }, fmtSize(o.bytes.length)), h('button', { class: 'btn sm', onclick: () => dl(o.name, o.bytes) }, '下載')));
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
  const nav = $('#nav'), main = $('#main'); let grp = ''; const order = ['頁面', '檔案', '編輯與保護', '圖片']; TOOLS.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  for (const t of TOOLS) {
    if (t.group !== grp) { grp = t.group; nav.append(h('div', { class: 'grp' }, grp)); }
    nav.append(h('button', { 'data-t': t.id, onclick: () => go(t.id) }, t.title));
    const sec = t.full ? h('section', { class: 'tool full', id: 't-' + t.id, 'aria-label': t.title }) : h('section', { class: 'tool', id: 't-' + t.id }, h('h1', {}, t.title), h('p', { class: 'sub' }, t.desc));
    main.append(sec); t.build(sec);
  }
  const go = id => { if (!TOOLS.some(t => t.id === id)) id = TOOLS[0].id; $$('.tool').forEach(s => s.classList.toggle('on', s.id === 't-' + id)); main.classList.toggle('full', !!TOOLS.find(t => t.id === id).full); $$('#nav button').forEach(b => b.setAttribute('aria-current', b.dataset.t === id)); if (location.hash.slice(1) !== id) { try { history.replaceState(null, '', '#' + id); } catch {} } window.dispatchEvent(new CustomEvent('toolshown', { detail: id })); };
  window.addEventListener('hashchange', () => go(location.hash.slice(1)));
  go(location.hash.slice(1));
}
// 批次工具：多個檔案 + 設定 + 執行 + 結果清單
function batchTool({ id, group, title, desc, accept = '.pdf,application/pdf', filter = isPdf, options, action, zipName, run, onFiles }) {
  tool({ id, group, title, desc, build(sec) {
    const files = [];
    const list = h('ul', { class: 'files' }), status = h('div', { class: 'status', role: 'status' }), results = h('ul', { class: 'results' });
    const opt = h('div', {}); if (options) options(opt);
    const redraw = () => list.replaceChildren(...files.map(f => h('li', {}, h('span', { class: 'nm' }, f.name), h('span', { class: 'sz' }, fmtSize(f.bytes.length)), h('button', { class: 'btn sm', 'aria-label': '移除 ' + f.name, onclick: () => { files.splice(files.indexOf(f), 1); redraw(); } }, '移除'))));
    const add = async fs => { const ok = fs.filter(filter); if (ok.length < fs.length) setStatus(status, 'err', '已略過不支援的檔案格式'); files.push(...ok); redraw(); if (onFiles && ok.length) try { await onFiles(files, opt); } catch (e) { setStatus(status, 'err', e.message); } };
    const btn = h('button', { class: 'btn pri', onclick: async () => {
      if (!files.length) return setStatus(status, 'err', '請先加入 PDF 檔案。');
      btn.disabled = true; const outs = [];
      try {
        for (const [i, f] of files.entries()) { setStatus(status, 'busy', `處理中 ${i + 1}/${files.length}：${f.name}`); outs.push(...await run(f, opt, m => setStatus(status, 'busy', `${f.name}：${m}`))); }
        showResults(results, outs, zipName, status); setStatus(status, 'ok', outs.length ? `已完成，${outs.length} 個檔案可下載。` : '沒有可輸出的內容。');
      } catch (e) { console.error(e); setStatus(status, 'err', '處理失敗：' + e.message); }
      btn.disabled = false;
    } }, action);
    sec.append(h('div', { class: 'cols' },
      h('div', {}, dropzone('加入 PDF', accept, add), list),
      h('div', { class: 'side' }, h('div', { class: 'panel' }, h('h2', {}, '設定'), opt, btn, status), h('div', { class: 'panel' }, h('h2', {}, '輸出'), results, h('p', { class: 'hint' }, '處理完成的檔案會列在這裡。')))));
  } });
}
const field = (label, input) => h('label', { class: 'field' }, h('span', {}, label), input);
const inp = (name, type, value, extra = {}) => h('input', { type, name, value, id: uid(), ...extra });
const sel = (name, pairs, value) => { const s = h('select', { name, id: uid() }, pairs.map(([v, l]) => h('option', { value: v }, l))); if (value != null) s.value = value; return s; };
const chk = (name, label, checked = false) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', name, id: uid(), checked }), label);
const val = (root, name) => { const e = $(`[name="${name}"]`, root); return e.type === 'checkbox' ? e.checked : e.value; };

/* ═════════ 1. 組織：新增、合併、分割、排序 ═════════ */
tool({ id: 'organize', group: '頁面', title: '合併、分割與組織', desc: '加入多個 PDF 或圖片，拖曳縮圖調整順序，旋轉、複製、刪除或插入空白頁，再合併輸出或把選取的頁面另存。', build(sec) {
  const files = new Map(); let pages = [];
  const grid = h('div', { class: 'grid' }), status = h('div', { class: 'status', role: 'status' }), results = h('ul', { class: 'results' }), count = h('span', { class: 'num' });
  const optUnify = sel('unify', [['', '保留原頁面尺寸'], ['p', '統一為 A4（直向）'], ['l', '統一為 A4（橫向）']]);
  const optStrip = chk('strip', '移除元數據（metadata）');
  const queue = []; let busy = false;
  const pump = async () => { if (busy) return; busy = true; while (queue.length) { const p = queue.shift(); if (!pages.includes(p) || p.thumb) continue; try { p.thumb = await renderCanvas(files.get(p.file).pj, p.idx + 1, { width: 220 }); const slot = $(`[data-id="${p.id}"] .th`, grid); if (slot) { p.thumb.style.transform = `rotate(${p.rot}deg)`; slot.replaceChildren(p.thumb); } } catch (e) { console.warn(e); } } busy = false; };
  let dragId = null;
  const draw = () => {
    grid.replaceChildren(...pages.map((p, i) => {
      const th = h('div', { class: 'th' }, p.blank ? h('div', { class: 'blank' }) : (p.thumb || h('span', { class: 'hint' }, '載入中')));
      if (p.thumb) p.thumb.style.transform = `rotate(${p.rot}deg)`;
      const act = (lab, sym, fn) => h('button', { title: lab, 'aria-label': lab, onclick: e => { e.stopPropagation(); fn(); draw(); } }, sym);
      const card = h('div', { class: 'pg' + (p.sel ? ' sel' : ''), 'data-id': p.id, draggable: true, tabindex: 0, role: 'checkbox', 'aria-checked': !!p.sel, 'aria-label': `第 ${i + 1} 頁`,
        onclick: () => { p.sel = !p.sel; draw(); }, onkeydown: e => { if (e.key === ' ') { e.preventDefault(); p.sel = !p.sel; draw(); } },
        ondragstart: e => { dragId = p.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); },
        ondragover: e => { if (dragId) { e.preventDefault(); card.classList.add('dragover'); } }, ondragleave: () => card.classList.remove('dragover'),
        ondrop: e => { if (!dragId) return; e.preventDefault(); e.stopPropagation(); const from = pages.findIndex(x => x.id === dragId), to = pages.indexOf(p); dragId = null; if (from < 0 || from === to) return draw(); const [m] = pages.splice(from, 1); pages.splice(to, 0, m); draw(); } },
        th, h('div', { class: 'cap' }, h('span', {}, p.blank ? '空白頁' : files.get(p.file).name), h('span', { class: 'num' }, i + 1)),
        h('div', { class: 'acts' },
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
    h('div', {}, zone,
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn sm', onclick: () => { const all = pages.every(p => p.sel); pages.forEach(p => p.sel = !all); draw(); } }, '全選／取消'),
        h('button', { class: 'btn sm', onclick: bulk(l => l.forEach(p => p.rot = (p.rot + 270) % 360)) }, '↺ 旋轉已選'),
        h('button', { class: 'btn sm', onclick: bulk(l => l.forEach(p => p.rot = (p.rot + 90) % 360)) }, '↻ 旋轉已選'),
        h('button', { class: 'btn sm', onclick: bulk(l => pages = pages.filter(p => !p.sel)) }, '刪除已選'),
        h('button', { class: 'btn sm', onclick: () => { pages = []; files.clear(); draw(); } }, '清除全部'), count),
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
      h('div', { class: 'panel' }, h('h2', {}, '輸出'), results, h('p', { class: 'hint' }, '點縮圖可選取頁面，拖曳縮圖可調整順序。')))));
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

/* ═════════ 2. 壓縮 ═════════ */
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
batchTool({ id: 'compress', group: '檔案', title: '壓縮 PDF', desc: '重新取樣並壓縮 PDF 內的圖片，同時整理檔案結構。文字與向量圖形保持原樣。', action: '壓縮 PDF', zipName: 'compressed-pdfs.zip',
  options(o) {
    const custom = field('壓縮比率（把檔案大小減少 %）', inp('reduction', 'number', 50, { min: 1, max: 99, step: 1 })); custom.hidden = true;
    const s = sel('profile', [['less', '輕度壓縮'], ['recommended', '建議壓縮'], ['high', '高度壓縮'], ['extreme', '極限壓縮'], ['custom', '自訂壓縮']], 'recommended'); s.onchange = () => custom.hidden = s.value !== 'custom';
    o.append(field('壓縮強度', s), custom, h('p', { class: 'hint' }, '實際大小視檔案內容而定；以文字為主的 PDF 可壓縮的空間較小。'));
  },
  async run(f, o, say) {
    const profile = val(o, 'profile'); let best, note;
    if (profile === 'custom') {
      const r = Number(val(o, 'reduction')); if (!Number.isInteger(r) || r < 1 || r > 99) throw new Error('請輸入 1–99 的整數百分比。');
      const target = f.bytes.length * (1 - r / 100);
      for (const [i, [q, m]] of LADDER.entries()) { say(`嘗試第 ${i + 1}/${LADDER.length} 級`); const res = await compressPdf(f.bytes, q, m); if (!best || res.bytes.length < best.bytes.length) best = res; if (res.bytes.length <= target) break; }
      note = `目標減少 ${r}%，`;
    } else best = await compressPdf(f.bytes, ...PROFILES[profile]);
    if (best.bytes.length >= f.bytes.length) return [{ name: stem(f.name) + '-compressed.pdf', bytes: f.bytes, note: '這份檔案已無法再縮小，輸出與原檔相同。' }];
    const actual = Math.round((1 - best.bytes.length / f.bytes.length) * 100);
    return [{ name: stem(f.name) + '-compressed.pdf', bytes: best.bytes, note: `${note || ''}實際減少 ${actual}%（${fmtSize(f.bytes.length)} → ${fmtSize(best.bytes.length)}）` + (best.skippedCmyk ? `；${best.skippedCmyk} 張 CMYK 圖片保持原樣` : '') }];
  } });

/* ═════════ 3. 轉換為圖片 ═════════ */
batchTool({ id: 'convert', group: '檔案', title: '轉換 PDF', desc: '把 PDF 的每一頁轉成 JPG 或 PNG 圖片。', action: '轉換', zipName: 'converted-images.zip',
  options(o) { o.append(field('輸出格式', sel('fmt', [['jpg', 'JPG'], ['png', 'PNG']])), field('解析度', sel('dpi', [['72', '72 dpi（螢幕）'], ['150', '150 dpi（一般）'], ['300', '300 dpi（列印）']], '150')), field('頁面範圍', inp('range', 'text', '', { placeholder: '留空代表全部頁面，例如 1-3, 5' }))); },
  async run(f, o, say) {
    const pj = await openPdfjs(f.bytes), fmt = val(o, 'fmt'), scale = Number(val(o, 'dpi')) / 72, outs = [];
    for (const i of parseRange(val(o, 'range'), pj.numPages)) { say(`第 ${i + 1} 頁`); const c = await renderCanvas(pj, i + 1, { scale }); outs.push({ name: `${stem(f.name)}-p${String(i + 1).padStart(3, '0')}.${fmt}`, bytes: await canvasBytes(c, fmt === 'jpg' ? 'image/jpeg' : 'image/png', .92) }); }
    return outs;
  } });

/* ═════════ 4. 圖像抽取 ═════════ */
batchTool({ id: 'extract', group: '檔案', title: '圖像抽取', desc: '把 PDF 內嵌的圖片逐一取出，存成 PNG。', action: '抽取圖像', zipName: 'extracted-images.zip',
  async run(f, o, say) {
    const pj = await openPdfjs(f.bytes), outs = [], seen = new Set(), OPS = pdfjsLib.OPS;
    for (let n = 1; n <= pj.numPages; n++) {
      say(`第 ${n} 頁`); const page = await pj.getPage(n), ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] !== OPS.paintImageXObject && ops.fnArray[i] !== OPS.paintImageXObjectRepeat) continue;
        const id = ops.argsArray[i][0]; if (seen.has(id)) continue; seen.add(id);
        const store = String(id).startsWith('g_') ? page.commonObjs : page.objs;
        const im = await Promise.race([new Promise(r => store.get(id, r)), new Promise(r => setTimeout(() => r(null), 4000))]); if (!im) continue;
        const c = h('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d');
        if (im.bitmap) x.drawImage(im.bitmap, 0, 0);
        else if (im.data) { const d = x.createImageData(im.width, im.height), src = im.data, px = im.width * im.height; if (src.length === px * 4) d.data.set(src); else if (src.length === px * 3) for (let k = 0; k < px; k++) { d.data[k * 4] = src[k * 3]; d.data[k * 4 + 1] = src[k * 3 + 1]; d.data[k * 4 + 2] = src[k * 3 + 2]; d.data[k * 4 + 3] = 255; } else continue; x.putImageData(d, 0, 0); }
        else continue;
        outs.push({ name: `${stem(f.name)}-p${n}-img${outs.length + 1}.png`, bytes: await canvasBytes(c), note: `${im.width} × ${im.height} px` });
      }
    }
    if (!outs.length) throw new Error('未找到可抽取圖像');
    return outs;
  } });

/* ═════════ 5. 浮水印 ═════════ */
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
batchTool({ id: 'watermark', group: '編輯與保護', title: '浮水印', desc: '在每一頁加上文字或圖片浮水印，可調整大小、顏色、透明度、角度與位置。', action: '套用浮水印', zipName: 'watermarked-pdfs.zip',
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

/* ═════════ 6. 頁碼 ═════════ */
const PN_FMT = { n: i => `${i}`, page: i => `Page ${i}`, zht: i => `第${i}頁`, zhs: i => `第${i}页`, ja: i => `${i}ページ`, ko: i => `${i}페이지`, of: (i, n) => `${i} / ${n}` };
batchTool({ id: 'pagenum', group: '編輯與保護', title: '新增頁碼', desc: '為每一頁加上頁碼，可選擇樣式、位置與起始號碼。', action: '加入頁碼', zipName: 'numbered-pdfs.zip',
  options(o) {
    o.append(field('頁碼樣式', sel('fmt', [['n', '1, 2, 3'], ['page', 'Page 1, Page 2, Page 3'], ['zht', '第1頁, 第2頁, 第3頁'], ['zhs', '第1页, 第2页, 第3页'], ['ja', '1ページ, 2ページ, 3ページ'], ['ko', '1페이지, 2페이지, 3페이지'], ['of', '1 / 總頁數']])),
      field('頁碼位置', sel('pos', [['bc', '下方置中'], ['bl', '左下'], ['br', '右下'], ['tc', '上方置中'], ['tl', '左上'], ['tr', '右上']])),
      h('div', { class: 'two' }, field('起始頁碼', inp('start', 'number', 1, { min: 0 })), field('文字大小', inp('size', 'number', 11, { min: 5, max: 72 }))),
      field('顏色', colorField('color', '#000000')), field('頁面範圍', inp('range', 'text', '', { placeholder: '留空代表全部頁面，例如 1-3, 5' })));
  },
  async run(f, o) {
    const doc = await openLib(f.bytes), pages = doc.getPages(), idx = parseRange(val(o, 'range'), pages.length), start = parseInt(val(o, 'start')) || 0, fmt = PN_FMT[val(o, 'fmt')];
    for (const [k, i] of idx.entries()) {
      const p = pages[i], v = pageView(p), r = await textToPng(fmt(start + k, start + idx.length - 1), { size: +val(o, 'size') || 11, color: val(o, 'color') });
      const [cx, cy] = anchor(val(o, 'pos'), v.vw, v.vh, r.w, r.h, 22);
      placeImage(p, await doc.embedPng(r.bytes), { cx, cy, w: r.w, h: r.h });
    }
    return [{ name: stem(f.name) + '-numbered.pdf', bytes: await doc.save() }];
  } });

/* ═════════ 互動預覽舞台（簽名、編輯、標記密文共用） ═════════ */
class Stage {
  constructor({ onSelect } = {}) {
    this.objs = []; this.page = 1; this.n = 0; this.sel = null; this.onSelect = onSelect || (() => {}); this.drawCb = null;
    this.canvasHost = h('div'); this.ov = h('div', { class: 'ov' }); this.el = h('div', { class: 'stage', hidden: true }, this.canvasHost, this.ov);
    this.label = h('span', { class: 'num' });
    this.pager = h('div', { class: 'pager', hidden: true }, h('button', { class: 'btn sm', onclick: () => this.go(this.page - 1) }, '上一頁'), this.label, h('button', { class: 'btn sm', onclick: () => this.go(this.page + 1) }, '下一頁'));
    this.wrap = h('div', {}, h('div', { class: 'stagewrap' }, this.el, h('p', { class: 'hint', style: 'text-align:center' }, '加入 PDF 後會在這裡顯示頁面預覽。')), this.pager);
    this.ov.addEventListener('pointerdown', e => this.down(e));
  }
  async load(f) { this.file = f; this.pj = await openPdfjs(f.bytes); this.n = this.pj.numPages; this.objs = []; this.sel = null; this.page = 1; this.el.hidden = false; this.pager.hidden = false; $('.hint', this.wrap).hidden = true; await this.show(); }
  async go(p) { if (!this.pj || p < 1 || p > this.n) return; this.page = p; this.sel = null; this.onSelect(null); await this.show(); }
  async size(p) { const pg = await this.pj.getPage(p), v = pg.getViewport({ scale: 1 }); return [v.width, v.height]; }
  async show() {
    const [vw, vh] = await this.size(this.page); this.vw = vw; this.vh = vh;
    const avail = Math.max(240, (this.wrap.clientWidth || 700) - 28); this.scale = Math.min(1.5, avail / vw);
    const c = await renderCanvas(this.pj, this.page, { scale: this.scale * Math.min(2, window.devicePixelRatio || 1) });
    this.el.style.width = vw * this.scale + 'px'; this.el.style.height = vh * this.scale + 'px'; this.canvasHost.replaceChildren(c);
    this.label.textContent = `第 ${this.page} / ${this.n} 頁`; this.draw();
  }
  add(o) { o.id = uid(); o.page = o.page || this.page; this.objs.push(o); this.sel = o.id; this.draw(); this.onSelect(o); return o; }
  remove(id) { this.objs = this.objs.filter(o => o.id !== id); if (this.sel === id) { this.sel = null; this.onSelect(null); } this.draw(); }
  get selected() { return this.objs.find(o => o.id === this.sel) || null; }
  draw() {
    const s = this.scale; this.ov.replaceChildren(...this.objs.filter(o => o.page === this.page).map(o => {
      const d = h('div', { class: 'ob' + (o.id === this.sel ? ' sel' : ''), 'data-id': o.id, style: `left:${o.x * s}px;top:${o.y * s}px;width:${o.w * s}px;height:${o.h * s}px;${o.fill ? `background:${o.fill};opacity:${o.alpha ?? 1};` : ''}` },
        o.url ? h('img', { src: o.url, alt: '' }) : null, o.inner ? h('img', { src: o.inner.url, alt: '', style: 'width:auto;max-width:100%;object-fit:contain;object-position:left' }) : null, h('span', { class: 'x', 'data-act': 'del', title: '移除' }, '×'), h('span', { class: 'rz', 'data-act': 'rz' }));
      return d;
    }));
  }
  startDraw(cb) { this.drawCb = cb; this.ov.classList.add('draw'); }
  stopDraw() { this.drawCb = null; this.ov.classList.remove('draw'); }
  down(e) {
    const rect = this.ov.getBoundingClientRect(), s = this.scale, px = (e.clientX - rect.left) / s, py = (e.clientY - rect.top) / s;
    const box = e.target.closest('.ob'), act = e.target.dataset.act;
    if (box && act === 'del') return this.remove(box.dataset.id);
    const track = (move, up) => { const mv = ev => { move((ev.clientX - rect.left) / s, (ev.clientY - rect.top) / s); }; const end = ev => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', end); up && up(); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', end); };
    if (box && !this.drawCb) {
      const o = this.objs.find(x => x.id === box.dataset.id); this.sel = o.id; this.onSelect(o); this.draw(); e.preventDefault();
      const ox = px - o.x, oy = py - o.y, w0 = o.w, h0 = o.h;
      if (act === 'rz') track((x, y) => { o.w = Math.max(6, x - o.x); o.h = o.lock ? o.w * h0 / w0 : Math.max(6, y - o.y); this.draw(); });
      else track((x, y) => { o.x = Math.min(this.vw - 4, Math.max(4 - o.w, x - ox)); o.y = Math.min(this.vh - 4, Math.max(4 - o.h, y - oy)); this.draw(); });
      return;
    }
    if (this.drawCb) {
      e.preventDefault(); const ghost = h('div', { class: 'ob sel' }); this.ov.append(ghost); let r = null;
      track((x, y) => { r = { x: Math.min(px, x), y: Math.min(py, y), w: Math.abs(x - px), h: Math.abs(y - py) }; ghost.style.cssText = `left:${r.x * s}px;top:${r.y * s}px;width:${r.w * s}px;height:${r.h * s}px`; },
        () => { ghost.remove(); if (r && r.w > 3 && r.h > 3) this.drawCb({ ...r, page: this.page }); });
      return;
    }
    this.sel = null; this.onSelect(null); this.draw();
  }
}
// 把舞台上的物件畫進 PDF
async function applyObjects(doc, objs) {
  const pages = doc.getPages(), cache = new Map();
  const png = async bytes => { if (!cache.has(bytes)) cache.set(bytes, await doc.embedPng(bytes)); return cache.get(bytes); };
  for (const o of objs) {
    const p = pages[o.page - 1], box = { cx: o.x + o.w / 2, cy: o.y + o.h / 2, w: o.w, h: o.h };
    if (o.fill) placeRect(p, { ...box, color: hexRgb(o.fill), opacity: o.alpha ?? 1 });
    if (o.bytes) placeImage(p, await png(o.bytes), box);
    if (o.inner) { const k = Math.min(1, (o.w - 4) / o.inner.w, o.h / o.inner.h), w = o.inner.w * k, hh = o.inner.h * k; placeImage(p, await png(o.inner.bytes), { cx: o.x + 2 + w / 2, cy: o.y + o.h / 2, w, h: hh }); }
  }
}
// 把指定頁面轉成影像頁（原頁內容不保留在輸出檔中）
async function rasterizePages(bytes, idxSet, scale = 2.2) {
  const pj = await openPdfjs(bytes), src = await openLib(bytes), out = await PDFDocument.create(), n = src.getPageCount();
  const keep = [...Array(n).keys()].filter(i => !idxSet.has(i)), copied = await out.copyPages(src, keep), byIdx = new Map(keep.map((k, j) => [k, copied[j]]));
  for (let i = 0; i < n; i++) {
    if (byIdx.has(i)) { out.addPage(byIdx.get(i)); continue; }
    const c = await renderCanvas(pj, i + 1, { scale }), img = await out.embedJpg(await canvasBytes(c, 'image/jpeg', .92)), w = c.width / scale, hh = c.height / scale;
    out.addPage([w, hh]).drawImage(img, { x: 0, y: 0, width: w, height: hh });
  }
  return out.save();
}
function stageTool({ id, group, title, desc, side, exportName, exportLabel, build: buildOut }) {
  tool({ id, group, title, desc, build(sec) {
    const status = h('div', { class: 'status', role: 'status' }), results = h('ul', { class: 'results' }), panel = h('div', {});
    const st = new Stage({ onSelect: o => api.onSelect && api.onSelect(o) });
    const api = { st, status, need() { if (!st.pj) throw new Error('請先加入 PDF 檔案。'); } };
    const load = async fs => { const f = fs.find(isPdf); if (!f) return setStatus(status, 'err', '請加入 PDF 檔案。'); try { await st.load(f); api.onLoad && await api.onLoad(f); setStatus(status, 'ok', `已開啟 ${f.name}（${st.n} 頁）`); } catch (e) { setStatus(status, 'err', e.message); } };
    side(panel, api);
    const btn = h('button', { class: 'btn pri', onclick: async () => { try { api.need(); btn.disabled = true; setStatus(status, 'busy', '處理中…'); const bytes = await buildOut(api); showResults(results, [{ name: stem(st.file.name) + exportName, bytes }], '', status); setStatus(status, 'ok', '已完成，可下載輸出檔。'); } catch (e) { console.error(e); setStatus(status, 'err', e.message); } btn.disabled = false; } }, exportLabel);
    sec.append(h('div', { class: 'cols' }, h('div', {}, dropzone('加入 PDF', '.pdf,application/pdf', load, false), h('div', { style: 'height:12px' }), st.wrap),
      h('div', { class: 'side' }, h('div', { class: 'panel' }, panel, btn, status), h('div', { class: 'panel' }, h('h2', {}, '輸出'), results))));
    window.addEventListener('toolshown', e => { if (e.detail === id && st.pj) st.show(); });
  } });
}

/* ═════════ 7. 電子簽名 ═════════ */
stageTool({ id: 'sign', group: '編輯與保護', title: '電子簽名', desc: '用輸入、手寫或圖片建立簽名，放到頁面上拖曳調整位置與大小。這是視覺簽名，不含憑證數位簽章。', exportName: '-signed.pdf', exportLabel: '加入簽名並輸出',
  side(p, api) {
    let sig = null; const prev = h('img', { class: 'sigprev', alt: '簽名預覽', hidden: true });
    const setSig = s => { sig = s; prev.src = s.url; prev.hidden = false; };
    const typed = h('div', {}, field('簽名文字', inp('sigtext', 'text', '')), field('字體', sel('sigfont', [['kai', '楷體'], ['serif', '明體'], ['sans', '黑體']])), h('button', { class: 'btn sm', onclick: async () => { const t = val(p, 'sigtext').trim(); if (!t) return setStatus(api.status, 'err', '請先輸入文字。'); const r = await textToPng(t, { size: 40, family: val(p, 'sigfont'), color: val(p, 'sigcolor') }); setSig({ bytes: r.bytes, url: r.url, pw: r.w, ph: r.h }); } }, '使用簽名'));
    const pad = h('canvas', { class: 'pad', width: 560, height: 280, 'aria-label': '手寫簽名板' }), pc = pad.getContext('2d'); let drawing = false, dirty = false;
    const pt = e => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height]; };
    pad.addEventListener('pointerdown', e => { drawing = true; dirty = true; pad.setPointerCapture(e.pointerId); pc.lineWidth = 4; pc.lineCap = pc.lineJoin = 'round'; pc.strokeStyle = val(p, 'sigcolor'); pc.beginPath(); pc.moveTo(...pt(e)); });
    pad.addEventListener('pointermove', e => { if (drawing) { pc.lineTo(...pt(e)); pc.stroke(); } });
    pad.addEventListener('pointerup', () => drawing = false);
    const drawn = h('div', { hidden: true }, pad, h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'btn sm', onclick: () => { pc.clearRect(0, 0, pad.width, pad.height); dirty = false; } }, '清除簽名'),
      h('button', { class: 'btn sm', onclick: async () => { if (!dirty) return setStatus(api.status, 'err', '請先在簽名板上簽名。'); const d = pc.getImageData(0, 0, pad.width, pad.height).data; let x0 = pad.width, y0 = pad.height, x1 = 0, y1 = 0; for (let y = 0; y < pad.height; y++) for (let x = 0; x < pad.width; x++) if (d[(y * pad.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } if (x1 <= x0) return; const c = h('canvas'); c.width = x1 - x0 + 12; c.height = y1 - y0 + 12; c.getContext('2d').drawImage(pad, x0 - 6, y0 - 6, c.width, c.height, 0, 0, c.width, c.height); setSig({ bytes: await canvasBytes(c), url: c.toDataURL(), pw: c.width, ph: c.height }); } }, '使用簽名')));
    const image = h('div', { hidden: true }, field('簽名圖片', h('input', { type: 'file', accept: 'image/png,image/jpeg', id: uid(), onchange: async e => { const [f] = await readFiles(e.target.files); if (f) setSig(await loadImageFile(f, val(p, 'sigbg'))); } })), chk('sigbg', '自動去除圖片背景', true));
    const src = sel('sigsrc', [['typed', '輸入簽名'], ['draw', '手寫簽名'], ['image', '圖片簽名']]); src.onchange = () => { typed.hidden = src.value !== 'typed'; drawn.hidden = src.value !== 'draw'; image.hidden = src.value !== 'image'; };
    p.append(h('h2', {}, '簽名'), field('簽名來源', src), field('顏色', colorField('sigcolor', '#14213d')), typed, drawn, image, prev,
      h('button', { class: 'btn', style: 'margin-bottom:10px', onclick: () => { try { api.need(); if (!sig) throw new Error('請先建立簽名，再按「使用簽名」。'); const w = Math.min(180, api.st.vw * .35), hh = w * sig.ph / sig.pw; api.st.add({ x: (api.st.vw - w) / 2, y: api.st.vh * .7, w, h: hh, url: sig.url, bytes: sig.bytes, lock: true }); } catch (e) { setStatus(api.status, 'err', e.message); } } }, '放到目前頁面'),
      h('p', { class: 'hint' }, '放上頁面後可拖曳移動，拉右下角調整大小。可在多頁重複放置。'));
  },
  async build({ st }) { if (!st.objs.length) throw new Error('請先把簽名放到頁面上。'); const doc = await openLib(st.file.bytes); await applyObjects(doc, st.objs); return doc.save(); } });

/* ═════════ 8. 編輯 PDF ═════════ */
stageTool({ id: 'edit', group: '編輯與保護', title: '編輯 PDF', desc: '在頁面上加入文字、圖片、醒目標記，或用色塊覆蓋後填入替換文字。', exportName: '-edited.pdf', exportLabel: '套用編輯並輸出',
  side(p, api) {
    const st = api.st, B = (name, label) => { const b = h('button', { class: 'btn sm', type: 'button', 'data-k': name, 'aria-pressed': 'false', onclick: () => { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); sync(); } }, label); return b; };
    const props = () => ({ text: val(p, 'etext'), size: +val(p, 'esize') || 14, color: val(p, 'ecolor'), family: val(p, 'efont'), align: val(p, 'ealign'), bold: $('[data-k=bold]', p).classList.contains('on'), italic: $('[data-k=italic]', p).classList.contains('on'), underline: $('[data-k=underline]', p).classList.contains('on'), strike: $('[data-k=strike]', p).classList.contains('on') });
    const renderText = async (o, pr) => { const r = await textToPng(pr.text, pr); const k = o.w && o.tw ? o.w / o.tw : 1; Object.assign(o, { props: pr, bytes: r.bytes, url: r.url, tw: r.w, w: r.w * k, h: r.h * k, lock: true, kind: 'text' }); };
    let t = 0; const sync = () => { clearTimeout(t); t = setTimeout(async () => { const o = st.selected; if (!o) return; if (o.kind === 'text' && val(p, 'etext').trim()) { await renderText(o, props()); st.draw(); } if (o.kind === 'cover') { await setCover(o); st.draw(); } }, 180); };
    const setCover = async o => { const t = val(p, 'ctext').trim(); o.fill = val(p, 'cfill'); o.ctext = t; if (t) { const r = await textToPng(t, { size: Math.max(6, o.h * .62), color: val(p, 'ecolor'), family: val(p, 'efont') }); o.inner = { bytes: r.bytes, w: r.w, h: r.h, url: r.url }; o.url = null; } else o.inner = null; };
    const guard = fn => async () => { try { api.need(); await fn(); } catch (e) { setStatus(api.status, 'err', e.message); } };
    const drawBtn = (label, make) => { const b = h('button', { class: 'btn sm', onclick: guard(() => { $$('.btn.on[data-draw]', p).forEach(x => x.classList.remove('on')); b.classList.add('on'); setStatus(api.status, 'busy', '在頁面上拖曳畫出範圍'); st.startDraw(async r => { st.stopDraw(); b.classList.remove('on'); const o = await make(r); st.add(o); setStatus(api.status, 'ok', '已加入，可拖曳調整。'); }); }) }, label); b.dataset.draw = 1; return b; };
    const layers = h('ul', { class: 'results layers' });
    const names = { text: '文字', image: '圖片', hl: '醒目標記', cover: '覆蓋替換' };
    const drawLayers = () => layers.replaceChildren(...st.objs.map(o => h('li', {}, h('span', { class: 'nm' }, `第 ${o.page} 頁 · ${names[o.kind]}${o.kind === 'text' ? '：' + o.props.text.slice(0, 12) : ''}`), h('button', { class: 'btn sm', onclick: () => st.remove(o.id) }, '刪除'))));
    const origDraw = st.draw.bind(st); st.draw = () => { origDraw(); drawLayers(); };
    api.onSelect = o => { if (o && o.kind === 'text') { const pr = o.props; $('[name=etext]', p).value = pr.text; $('[name=esize]', p).value = pr.size; $('[name=ecolor]', p).value = pr.color; $('[name=efont]', p).value = pr.family; $('[name=ealign]', p).value = pr.align; for (const k of ['bold', 'italic', 'underline', 'strike']) $(`[data-k=${k}]`, p).classList.toggle('on', pr[k]); } if (o && o.kind === 'cover') { $('[name=ctext]', p).value = o.ctext || ''; $('[name=cfill]', p).value = o.fill; } };
    p.append(h('h2', {}, '加入文字'), field('文字內容', h('textarea', { name: 'etext', id: uid() }, '')),
      h('div', { class: 'two' }, field('文字大小', inp('esize', 'number', 14, { min: 4, max: 200 })), field('字體', sel('efont', [['sans', '黑體'], ['serif', '明體'], ['kai', '楷體'], ['mono', '等寬']]))),
      h('div', { class: 'row', style: 'margin-bottom:10px' }, B('bold', '粗體'), B('italic', '斜體'), B('underline', '底線'), B('strike', '刪除線'), sel('ealign', [['left', '靠左'], ['center', '置中'], ['right', '靠右']])),
      field('文字顏色', colorField('ecolor', '#000000')),
      h('div', { class: 'row', style: 'margin-bottom:14px' },
        h('button', { class: 'btn', onclick: guard(async () => { const pr = props(); if (!pr.text.trim()) throw new Error('請先輸入文字。'); const o = { x: 40, y: 60 }; await renderText(o, pr); o.x = (st.vw - o.w) / 2; o.y = st.vh * .3; st.add(o); }) }, '新增文字'),
        h('label', { class: 'btn' }, '新增圖片', h('input', { type: 'file', accept: 'image/png,image/jpeg', hidden: true, id: uid(), onchange: guard(async function () { const input = $('input[type=file][hidden]', p); const [f] = await readFiles(input.files); input.value = ''; if (!f) return; const im = await loadImageFile(f), w = Math.min(st.vw * .4, im.pw * .75); st.add({ kind: 'image', x: (st.vw - w) / 2, y: st.vh * .35, w, h: w * im.ph / im.pw, bytes: im.bytes, url: im.url, lock: true }); }) }))),
      h('h2', {}, '標記與覆蓋'),
      h('div', { class: 'row' }, drawBtn('醒目標記', async r => ({ ...r, kind: 'hl', fill: '#ffe24a', alpha: .4 })), drawBtn('覆蓋替換', async r => { const o = { ...r, kind: 'cover' }; await setCover(o); return o; })),
      h('div', { class: 'two', style: 'margin-top:10px' }, field('替換文字', inp('ctext', 'text', '')), field('覆蓋顏色', inp('cfill', 'color', '#ffffff', { style: 'height:32px;padding:2px' }))),
      h('p', { class: 'warnbox' }, '覆蓋替換適合非敏感的視覺修正；底層原文字可能仍存在。敏感資訊請使用「標記密文」。'),
      field('輸出模式', sel('emode', [['overlay', '視覺覆蓋（保留可選取文字）'], ['flatten', '扁平化編輯頁（編輯過的頁面轉為影像）']])),
      h('h2', {}, '物件圖層'), layers, h('div', { style: 'height:10px' }));
    p.addEventListener('input', sync);
  },
  async build({ st }) {
    if (!st.objs.length) throw new Error('請先在頁面上加入內容。');
    const doc = await openLib(st.file.bytes); await applyObjects(doc, st.objs); const bytes = await doc.save();
    return $('[name=emode]').value === 'flatten' ? rasterizePages(bytes, new Set(st.objs.map(o => o.page - 1))) : bytes;
  } });

/* ═════════ 9. 標記密文 ═════════ */
stageTool({ id: 'redact', group: '編輯與保護', title: '標記密文', desc: '搜尋文字或拖曳框選要遮蔽的範圍。輸出時，含標記的頁面會轉成影像，被遮蔽的文字不會留在檔案裡。', exportName: '-redacted.pdf', exportLabel: '標記密文並輸出',
  side(p, api) {
    const st = api.st, info = h('p', { class: 'hint' }, '尚未加入標記。');
    const origDraw = st.draw.bind(st); st.draw = () => { origDraw(); const n = st.objs.length, pg = new Set(st.objs.map(o => o.page)).size; info.textContent = n ? `共 ${n} 個標記，分布在 ${pg} 頁。` : '尚未加入標記。'; };
    const mark = r => ({ ...r, fill: '#000000', alpha: .85 });
    const b = h('button', { class: 'btn', onclick: () => { try { api.need(); } catch (e) { return setStatus(api.status, 'err', e.message); } if (st.drawCb) { st.stopDraw(); b.classList.remove('on'); return; } b.classList.add('on'); setStatus(api.status, 'busy', '拖曳以插入密文標記；再按一次結束。'); st.startDraw(r => st.add(mark(r))); } }, '拖曳標記密文');
    const search = async () => {
      api.need(); const q = val(p, 'rq'); if (!q.trim()) throw new Error('請先輸入要標記的文字。'); const cs = val(p, 'rcase'), needle = cs ? q : q.toLowerCase(); let n = 0;
      for (let i = 1; i <= st.n; i++) {
        const page = await st.pj.getPage(i), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent();
        for (const it of tc.items) {
          if (!it.str) continue; const hay = cs ? it.str : it.str.toLowerCase(); let from = 0, at;
          while ((at = hay.indexOf(needle, from)) >= 0) {
            from = at + needle.length; const m = pdfjsLib.Util.transform(vp.transform, it.transform), fh = Math.hypot(m[2], m[3]) || it.height, len = it.str.length;
            const x = m[4] + it.width * at / len, w = it.width * needle.length / len;
            st.objs.push({ id: uid(), page: i, ...mark({ x: x - 1.5, y: m[5] - fh * .95, w: w + 3, h: fh * 1.25 }) }); n++;
          }
        }
      }
      st.draw(); setStatus(api.status, n ? 'ok' : 'err', n ? `已標記 ${n} 處「${q}」。` : '找不到符合的文字。');
    };
    p.append(h('h2', {}, '搜尋文字'), field('要標記的文字', inp('rq', 'text', '', { placeholder: '輸入關鍵字' })), chk('rcase', '區分大小寫'),
      h('div', { class: 'row', style: 'margin-bottom:12px' }, h('button', { class: 'btn', onclick: async () => { try { await search(); } catch (e) { setStatus(api.status, 'err', e.message); } } }, '標記全部符合處'), b),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { st.objs = []; st.sel = null; st.draw(); } }, '清除全部標記')), info,
      h('p', { class: 'warnbox' }, '掃描檔或圖片內的文字無法搜尋，請用拖曳框選。輸出前請逐頁確認標記範圍。'));
  },
  async build({ st }) {
    if (!st.objs.length) throw new Error('請先在預覽或搜尋中標記至少一個密文範圍。');
    const doc = await openLib(st.file.bytes); await applyObjects(doc, st.objs.map(o => ({ ...o, alpha: 1 })));
    return rasterizePages(await doc.save(), new Set(st.objs.map(o => o.page - 1)));
  } });

/* ═════════ 10. PDF 加密（AES-256，PDF 2.0 標準安全處理器 R6） ═════════ */
const enc = new TextEncoder();
const sha = async (alg, d) => new Uint8Array(await crypto.subtle.digest(alg, d));
async function aesCbc(key, iv, data, pad) { const k = await crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['encrypt']); const o = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, k, data)); return pad ? o : o.slice(0, data.length); }
async function hashR6(pw, salt, udata = new Uint8Array(0)) {
  let K = await sha('SHA-256', concat(pw, salt, udata));
  for (let round = 1; ; round++) {
    const one = concat(pw, K, udata), K1 = new Uint8Array(one.length * 64); for (let i = 0; i < 64; i++) K1.set(one, i * one.length);
    const E = await aesCbc(K.slice(0, 16), K.slice(16, 32), K1, false);
    let m = 0; for (let i = 0; i < 16; i++) m += E[i];
    K = await sha(['SHA-256', 'SHA-384', 'SHA-512'][m % 3], E);
    if (round >= 64 && E[E.length - 1] <= round - 32) break;
  }
  return K.slice(0, 32);
}
async function encryptPdf(bytes, password) {
  const flat = await (await openLib(bytes)).save({ useObjectStreams: false });
  const doc = await openLib(flat), ctx = doc.context, rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const pw = enc.encode(password.normalize('NFKC')).slice(0, 127), key = rnd(32), zero = new Uint8Array(16);
  const uvs = rnd(8), uks = rnd(8), ovs = rnd(8), oks = rnd(8);
  const U = concat(await hashR6(pw, uvs), uvs, uks), UE = await aesCbc(await hashR6(pw, uks), zero, key, false);
  const O = concat(await hashR6(pw, ovs, U), ovs, oks), OE = await aesCbc(await hashR6(pw, oks, U), zero, key, false);
  const P = -4, perms = concat(new Uint8Array([0xFC, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]), enc.encode('Tadb'), rnd(4)), Perms = await aesCbc(key, zero, perms, false);
  const seal = async data => { const iv = rnd(16); return concat(iv, await aesCbc(key, iv, data, true)); };
  const jobs = [];
  const walk = o => {
    if (o instanceof PDFDict) for (const [k, v] of o.entries()) { if (v instanceof PDFString || v instanceof PDFHexString) jobs.push(async () => o.set(k, PDFHexString.of(hex(await seal(v.asBytes()))))); else walk(v); }
    else if (o instanceof PDFArray) for (let i = 0; i < o.size(); i++) { const v = o.get(i); if (v instanceof PDFString || v instanceof PDFHexString) jobs.push(async () => o.set(i, PDFHexString.of(hex(await seal(v.asBytes()))))); else walk(v); }
    else if (o instanceof PDFRawStream) { walk(o.dict); jobs.push(async () => { o.contents = await seal(o.contents); }); }
  };
  for (const [, obj] of ctx.enumerateIndirectObjects()) walk(obj);
  for (const j of jobs) await j();
  const H = b => PDFHexString.of(hex(b));
  ctx.trailerInfo.Encrypt = ctx.obj({ Filter: 'Standard', V: 5, R: 6, Length: 256, P, O: H(O), U: H(U), OE: H(OE), UE: H(UE), Perms: H(Perms), EncryptMetadata: true, StmF: 'StdCF', StrF: 'StdCF', CF: { StdCF: { CFM: 'AESV3', AuthEvent: 'DocOpen', Length: 32 } } });
  const idh = H(rnd(16)); ctx.trailerInfo.ID = ctx.obj([idh, idh]);
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false });
}
batchTool({ id: 'encrypt', group: '編輯與保護', title: 'PDF 加密', desc: '為 PDF 設定開啟密碼（AES-256）。忘記密碼就無法開啟檔案，請妥善保存。', action: '加密 PDF', zipName: 'encrypted-pdfs.zip',
  options(o) { o.append(field('開啟密碼', inp('pw', 'password', '', { autocomplete: 'new-password' })), field('確認密碼', inp('pw2', 'password', '', { autocomplete: 'new-password' }))); },
  async run(f, o) {
    const pw = val(o, 'pw'); if (!pw) throw new Error('請先輸入開啟密碼。'); if (pw !== val(o, 'pw2')) throw new Error('兩次輸入的密碼不一致，請重新輸入。');
    return [{ name: stem(f.name) + '-encrypted.pdf', bytes: await encryptPdf(f.bytes, pw) }];
  } });

/* ═════════ 11. 元數據 ═════════ */
const META = [['Title', '標題'], ['Author', '作者'], ['Subject', '主旨'], ['Keywords', '關鍵詞'], ['Creator', '建立者'], ['Producer', '生產者']];
const toLocal = d => { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`; };
const pdfDate = d => { const z = n => String(n).padStart(2, '0'), off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-', a = Math.abs(off); return `D:${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}${s}${z(Math.floor(a / 60))}'${z(a % 60)}'`; };
batchTool({ id: 'meta', group: '檔案', title: '編輯元數據', desc: '修改 PDF 的標題、作者、關鍵詞與日期等文件資訊。加入多個檔案時，下方內容會套用到所有檔案。', action: '更新並輸出 PDF', zipName: 'metadata-updated-pdfs.zip',
  options(o) {
    for (const [k, l] of META) o.append(field(l, inp('m' + k, 'text', '')));
    for (const [k, l] of [['CreationDate', '建立日期'], ['ModDate', '修改日期']]) { const i = inp('m' + k, 'datetime-local', '', { step: 1 }); o.append(field(l, h('div', { class: 'row' }, i, h('button', { class: 'btn sm', type: 'button', onclick: () => i.value = toLocal(new Date()) }, '今天'), h('button', { class: 'btn sm', type: 'button', onclick: () => i.value = '' }, '清除')))); i.style.flex = '1'; }
    o.append(h('p', { class: 'hint' }, '留空的欄位會從檔案中移除。'));
  },
  async onFiles(files, o) {
    if (files.length !== 1) return; const d = await openLib(files[0].bytes), g = fn => { try { return fn(); } catch { return undefined; } };
    const v = { Title: g(() => d.getTitle()), Author: g(() => d.getAuthor()), Subject: g(() => d.getSubject()), Keywords: g(() => d.getKeywords()), Creator: g(() => d.getCreator()), Producer: g(() => d.getProducer()) };
    for (const [k] of META) $(`[name=m${k}]`, o).value = v[k] || '';
    const c = g(() => d.getCreationDate()), m = g(() => d.getModificationDate()); $('[name=mCreationDate]', o).value = c ? toLocal(c) : ''; $('[name=mModDate]', o).value = m ? toLocal(m) : '';
  },
  async run(f, o) {
    const d = await openLib(f.bytes), info = d.getInfoDict();
    for (const [k] of META) { const v = val(o, 'm' + k).trim(); if (v) info.set(PDFName.of(k), PDFHexString.fromText(v)); else info.delete(PDFName.of(k)); }
    for (const k of ['CreationDate', 'ModDate']) { const v = val(o, 'm' + k); if (v) info.set(PDFName.of(k), PDFString.of(pdfDate(new Date(v)))); else info.delete(PDFName.of(k)); }
    d.catalog.delete(PDFName.of('Metadata'));
    return [{ name: stem(f.name) + '-metadata.pdf', bytes: await d.save() }];
  } });

/* ═════════ 12. 調整頁面大小 ═════════ */
const SIZES = { A3: [297, 420], A4: [210, 297], A5: [148, 210], B5: [176, 250], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
batchTool({ id: 'resize', group: '頁面', title: '調整頁面大小', desc: '把所有頁面改成指定的紙張尺寸，原內容會等比縮放並置中。', action: '調整並輸出 PDF', zipName: 'resized-pdfs.zip',
  options(o) {
    const custom = h('div', { hidden: true }, field('單位', sel('unit', [['mm', '公釐（mm）'], ['in', '英寸（in）']])), h('div', { class: 'two' }, field('寬度', inp('cw', 'number', 210, { min: 1, step: 'any' })), field('高度', inp('ch', 'number', 297, { min: 1, step: 'any' }))));
    const ori = field('方向', sel('ori', [['p', '直向'], ['l', '橫向']]));
    const s = sel('preset', [...Object.keys(SIZES).map(k => [k, `${k}（${SIZES[k][0]} × ${SIZES[k][1]} mm）`]), ['custom', '自訂大小']], 'A4'); s.onchange = () => { custom.hidden = s.value !== 'custom'; ori.hidden = s.value === 'custom'; };
    o.append(field('預設大小', s), ori, custom);
  },
  async run(f, o) {
    let W, H; const preset = val(o, 'preset');
    if (preset === 'custom') { const k = val(o, 'unit') === 'in' ? 72 : 72 / 25.4; W = +val(o, 'cw') * k; H = +val(o, 'ch') * k; if (!(W >= 10 && H >= 10 && W <= 14400 && H <= 14400)) throw new Error('請輸入有效的尺寸'); }
    else { const [a, b] = SIZES[preset].map(v => v * 72 / 25.4); [W, H] = val(o, 'ori') === 'l' ? [b, a] : [a, b]; }
    const src = await openLib(f.bytes), out = await PDFDocument.create();
    for (const sp of src.getPages()) { const [emb] = await out.embedPages([sp]); fitEmbedded(out.addPage([W, H]), emb, rotOf(sp), W, H); }
    for (const k of ['Title', 'Author', 'Subject', 'Keywords']) { const v = src.getInfoDict().get(PDFName.of(k)); if (v) out.getInfoDict().set(PDFName.of(k), v); }
    return [{ name: stem(f.name) + '-resized.pdf', bytes: await out.save() }];
  } });

/* ═════════ 13. 物件畫板 ═════════ */
tool({ id: 'board', group: '圖片', title: '物件畫板', desc: '在圖片上加文字、圖形、箭頭與筆跡，每個物件之後都能再調整。', full: true, build(sec) {
  const host = h('div', { class: 'boardhost' }); sec.append(host);
  initBoard(host, { saveFile, isActive: () => sec.classList.contains('on') });
} });

/* ═════════ 14. SVG 轉 PNG ═════════ */
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
      it.err ? null : h('div', { class: 'pv' + (st.bg === 'transparent' ? ' chk' : '') }, h('img', { src: it.mode === 'svg' ? it.svgUrl : it.url, alt: it.name })))));
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
    try { const f = fixSvg(code, st.font), img = h('img', { alt: 'SVG 即時預覽', src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(f.svg) });
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
window.__yj = { encryptPdf, compressPdf, rasterizePages, textToPng, sampleDoc };
