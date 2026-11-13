// 物件畫板：以 Shadow DOM 掛進頁匠，樣式互不干擾，顏色與字體沿用頁面的設計變數
export function initBoard(host,{saveFile,isActive}){
const root=host.attachShadow({mode:'open'});
root.innerHTML='<style>'+":host{display:block;container-type:inline-size;--panel:var(--surface);--work:var(--sunken);--soft:var(--accent-soft);--danger:var(--bad);--font:var(--font-body)}\n.app{background:var(--bg);color:var(--ink);font:14px/1.5 var(--font);overflow:hidden}\n*{box-sizing:border-box}\nbutton,input,select,textarea{font:inherit;color:inherit}\nbutton{cursor:pointer}\n:focus-visible{outline:2px solid var(--accent);outline-offset:1px}\n.app{height:100%;display:grid;grid-template:auto 1fr / 56px 1fr 272px}\n.bar{grid-column:1/-1;display:flex;align-items:center;gap:6px;padding:8px 12px;background:var(--panel);border-bottom:1px solid var(--line);overflow-x:auto}\n.brand{font-family:var(--font-display);font-size:17px;font-weight:700;letter-spacing:.04em;margin-right:8px;white-space:nowrap}\n.sep{width:1px;align-self:stretch;background:var(--line);margin:2px 4px;flex:none}\n.grow{flex:1}\n.btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:1px solid var(--line);border-radius:7px;background:var(--panel);white-space:nowrap;flex:none}\n.btn:hover{background:var(--soft)}\n.btn:disabled{opacity:.4;cursor:default;background:var(--panel)}\n.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);font-weight:500}\n.btn.icon{width:32px;padding:0;justify-content:center}\n.btn.on{background:var(--soft);border-color:var(--accent);color:var(--accent)}\n.btn.danger{color:var(--danger)}\nsvg.i{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}\n#zoomLabel{min-width:58px;justify-content:center;font-variant-numeric:tabular-nums}\n.tools{display:flex;flex-direction:column;gap:4px;padding:8px;background:var(--panel);border-right:1px solid var(--line);overflow:auto}\n.tool{width:40px;height:40px;border:1px solid transparent;border-radius:8px;background:none;display:grid;place-items:center;flex:none}\n.tool:hover{background:var(--soft)}\n.tool.on{background:var(--accent);color:var(--accent-ink)}\n.tool svg.i{width:20px;height:20px}\n.stage{position:relative;overflow:hidden;background:var(--work);min-width:0;min-height:0}\n#cv{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}\n#ta{position:absolute;display:none;margin:0;border:0;outline:1.5px dashed var(--accent);resize:none;overflow:hidden;white-space:pre;transform-origin:center}\n.hint{position:absolute;left:12px;bottom:10px;right:12px;pointer-events:none;color:var(--muted);font-size:12px;text-shadow:0 0 4px var(--work)}\n.sample{position:absolute;top:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:6px 8px 6px 12px;background:var(--panel);border:1px solid var(--line);border-radius:999px;font-size:13px;max-width:calc(100% - 24px);box-shadow:0 2px 8px rgba(0,0,0,.08)}\n.sample span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.sample .btn{height:26px;border-radius:999px}\n.side{background:var(--panel);border-left:1px solid var(--line);overflow:auto;display:flex;flex-direction:column}\n.sec{padding:12px 14px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:10px}\n.sec h2{margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--muted)}\n.sec .name{font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.note{color:var(--muted);font-size:12px;margin:0}\n.row{display:grid;grid-template-columns:52px 1fr;align-items:center;gap:8px}\n.row .lab{color:var(--muted);font-size:12px}\n.ctl{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}\n.ctl input[type=number],.ctl select{height:30px;border:1px solid var(--line);border-radius:6px;background:var(--bg);padding:0 8px;min-width:0;width:100%}\n.ctl input[type=number]{width:76px;font-variant-numeric:tabular-nums}\n.ctl input[type=range]{flex:1;min-width:0;accent-color:var(--accent)}\n.ctl .val{width:34px;text-align:right;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}\n.ctl input[type=color]{width:30px;height:30px;padding:0;border:1px solid var(--line);border-radius:6px;background:none;flex:none}\n.sw{width:18px;height:18px;border-radius:50%;border:1px solid var(--line);padding:0;flex:none}\n.sw.none{background:linear-gradient(135deg,transparent 45%,var(--danger) 45%,var(--danger) 55%,transparent 55%),var(--panel)}\n.sw.cur{box-shadow:0 0 0 2px var(--panel),0 0 0 4px var(--accent)}\n.btns{display:flex;flex-wrap:wrap;gap:6px}\n.btns .btn{height:28px;padding:0 8px;font-size:13px}\n.layers{display:flex;flex-direction:column;gap:2px}\n.layer{display:flex;align-items:center;gap:2px;border-radius:6px}\n.layer.on{background:var(--soft)}\n.layer .pick{flex:1;min-width:0;text-align:left;border:0;background:none;padding:6px 8px;display:flex;gap:8px;align-items:center}\n.layer .pick span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.layer .mini{width:28px;height:28px;border:0;background:none;border-radius:6px;display:grid;place-items:center;color:var(--muted);flex:none}\n.layer .mini:hover{background:var(--line)}\n.layer .mini.off{opacity:.3}\n.layer .mini.act{color:var(--accent)}\n.layer svg.i{width:15px;height:15px}\n#toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:8px 14px;border-radius:8px;font-size:13px;opacity:0;pointer-events:none;transition:opacity .2s;max-width:90vw;z-index:20}\n#toast.show{opacity:1}\n.hide{display:none!important}\n@container (max-width:680px){\n  .app{grid-template:auto auto 1fr minmax(0,38%) / 1fr}\n  .tools{flex-direction:row;border-right:0;border-bottom:1px solid var(--line)}\n  .side{border-left:0;border-top:1px solid var(--line)}\n  .hint{display:none}\n}\n@media (prefers-reduced-motion:reduce){#toast{transition:none}}\n"+'</style>'+"<div class=\"app\">\n  <header class=\"bar\">\n    <span class=\"brand\">物件畫板</span>\n    <button class=\"btn primary\" id=\"btnAdd\" title=\"加入圖片（也可以直接拖進來或貼上）\"><svg class=\"i\" viewBox=\"0 0 24 24\"><path d=\"M12 5v14M5 12h14\"/></svg>加入圖片</button>\n    <span class=\"sep\"></span>\n    <button class=\"btn icon\" id=\"btnUndo\" title=\"復原 Ctrl+Z\" aria-label=\"復原\"><svg class=\"i\" viewBox=\"0 0 24 24\"><path d=\"M8 5L3 10l5 5M3 10h10a5 5 0 010 10h-3\"/></svg></button>\n    <button class=\"btn icon\" id=\"btnRedo\" title=\"重做 Ctrl+Y\" aria-label=\"重做\"><svg class=\"i\" viewBox=\"0 0 24 24\"><path d=\"M16 5l5 5-5 5M21 10H11a5 5 0 000 10h3\"/></svg></button>\n    <span class=\"sep\"></span>\n    <button class=\"btn icon\" id=\"btnZoomOut\" title=\"縮小\" aria-label=\"縮小\"><svg class=\"i\" viewBox=\"0 0 24 24\"><path d=\"M5 12h14\"/></svg></button>\n    <button class=\"btn\" id=\"zoomLabel\" title=\"按一下：整張畫布縮放到剛好看得到\">100%</button>\n    <button class=\"btn icon\" id=\"btnZoomIn\" title=\"放大\" aria-label=\"放大\"><svg class=\"i\" viewBox=\"0 0 24 24\"><path d=\"M12 5v14M5 12h14\"/></svg></button>\n    <span class=\"grow\"></span>\n    <button class=\"btn\" id=\"btnOpen\" title=\"開啟之前儲存的專案檔，所有物件都還能繼續調整\">開啟專案</button>\n    <button class=\"btn\" id=\"btnSave\" title=\"存成專案檔，下次開啟還能繼續編輯每個物件\">儲存專案</button>\n    <button class=\"btn primary\" id=\"btnExport\">匯出 PNG</button>\n  </header>\n  <nav class=\"tools\" id=\"tools\" aria-label=\"工具\"></nav>\n  <main class=\"stage\" id=\"stage\">\n    <canvas id=\"cv\"></canvas>\n    <textarea id=\"ta\" spellcheck=\"false\" aria-label=\"編輯文字\"></textarea>\n    <div class=\"sample\" id=\"sample\"><span>目前是範例內容。加入你的圖片後會自動換掉。</span><button class=\"btn\" id=\"btnClearSample\">清空畫布</button></div>\n    <div class=\"hint\" id=\"hint\"></div>\n  </main>\n  <aside class=\"side\">\n    <div id=\"props\"></div>\n    <div class=\"sec\"><h2>圖層</h2><div class=\"layers\" id=\"layers\"></div></div>\n  </aside>\n</div>\n<input type=\"file\" id=\"fileImg\" accept=\"image/*\" multiple class=\"hide\">\n<input type=\"file\" id=\"fileProj\" accept=\".json,application/json\" class=\"hide\">\n<div id=\"toast\" role=\"status\"></div>\n";

'use strict';
const $=s=>root.querySelector(s);
const cv=$('#cv'),ctx=cv.getContext('2d'),stage=$('#stage'),ta=$('#ta');
const mc=document.createElement('canvas').getContext('2d');
const FAM={sans:'"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif',serif:'"Noto Serif TC","PMingLiU",serif',kai:'"LXGW WenKai TC","DFKai-SB","BiauKai",serif',mono:'ui-monospace,Menlo,Consolas,monospace'};
const FAMNAME={sans:'黑體',serif:'明體',kai:'楷體',mono:'等寬'};
const SW=['#1b2033','#ffffff','#e03131','#f08c00','#ffd43b','#2f9e44','#1c7ed6','#7048e8'];
const ICON={
 select:'<path d="M5 3l14 8-6 2-2 6z"/>',text:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
 rect:'<rect x="4" y="6" width="16" height="12" rx="1"/>',ellipse:'<ellipse cx="12" cy="12" rx="8" ry="6"/>',
 line:'<path d="M5 19L19 5"/>',arrow:'<path d="M5 19L19 5M10 5h9v9"/>',
 pen:'<path d="M4 20l4-1L19 8l-3-3L5 16z"/>',marker:'<path d="M8 14l7-9 4 3-7 9zM8 14l-3 5h6l1-2"/>',
 image:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 16l5-5 4 4 3-3 6 5"/><circle cx="15.5" cy="9.5" r="1.3"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 lock:'<rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 018 0v3"/>'};
const ico=k=>`<svg class="i" viewBox="0 0 24 24">${ICON[k]}</svg>`;
const TOOLS=[['select','選取 (V)'],['text','文字 (T)'],['rect','矩形 (R)'],['ellipse','橢圓 (O)'],['line','直線 (L)'],['arrow','箭頭 (A)'],['pen','畫筆 (P)'],['marker','螢光筆 (M)'],['image','加入圖片']];
const TOOLNAME={select:'選取',text:'文字',rect:'矩形',ellipse:'橢圓',line:'直線',arrow:'箭頭',pen:'畫筆',marker:'螢光筆',image:'圖片'};
const HINT={select:'點一下選取，拖曳移動，拉控制點縮放或旋轉。雙擊文字可修改，雙擊圖片可裁剪。拖空白處或滾輪可平移，Ctrl＋滾輪縮放。',
 text:'在畫布上點一下，直接打字。',rect:'拖曳畫出矩形，按住 Shift 畫正方形。',ellipse:'拖曳畫出橢圓，按住 Shift 畫正圓。',
 line:'拖曳畫出直線，按住 Shift 對齊 45°。',arrow:'拖曳畫出箭頭，按住 Shift 對齊 45°。',pen:'直接畫。每一筆都是獨立物件，之後還能移動、改色、刪除。',marker:'半透明的粗筆，用來標重點。',image:''};

const S={doc:{w:1200,h:750,bg:'#ffffff',transparent:false},objs:[],sel:null,tool:'select',zoom:1,pan:{x:0,y:0},
 style:{stroke:'#e03131',fill:'none',sw:6,fontSize:48,family:'sans',bold:false,italic:false,color:'#1b2033',bg:'none',align:'left'},
 marker:{stroke:'#ffd43b',sw:28}};
const assets={};
let cropping=null;
let uid=1,editing=null,drag=null,pristine=true,spaceDown=false,clip=null,raf=0,downloads=null;
let hist=[],hi=-1;
const nid=()=>'o'+(uid++)+Math.random().toString(36).slice(2,6);
const clone=o=>JSON.parse(JSON.stringify(o));
const byId=id=>S.objs.find(o=>o.id===id);
const selObj=()=>S.sel?byId(S.sel):null;
const rot=(x,y,a)=>{const c=Math.cos(a),s=Math.sin(a);return[x*c-y*s,x*s+y*c]};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const isBox=o=>o.type!=='line';
const styleFor=t=>t==='marker'?S.marker:S.style;

/* ---------- text metrics ---------- */
function fontOf(o,size){return `${o.italic?'italic ':''}${o.bold?700:400} ${size||o.fontSize}px ${FAM[o.family]||FAM.sans}`}
function measure(o){mc.font=fontOf(o);const L=(o.text||'').split('\n');let mw=0;for(const l of L)mw=Math.max(mw,mc.measureText(l).width);
 const pad=o.fontSize*.2;o.w=Math.max(mw,o.fontSize*.5)+pad*2;o.h=L.length*o.fontSize*1.3+pad*2}
function remeasure(o){const ax=o.align==='center'?0:o.align==='right'?1:-1;let a=rot(ax*o.w/2,-o.h/2,o.rot);const Ax=o.cx+a[0],Ay=o.cy+a[1];
 measure(o);a=rot(ax*o.w/2,-o.h/2,o.rot);o.cx=Ax-a[0];o.cy=Ay-a[1]}
function ensureFont(o){if(!document.fonts||!document.fonts.load)return;
 document.fonts.load(fontOf(o),o.text||'字').then(()=>{if(byId(o.id)){remeasure(o);render()}}).catch(()=>{})}

/* ---------- drawing ---------- */
function penPath(c,o){const P=o.pts,X=i=>(P[i][0]-.5)*o.w,Y=i=>(P[i][1]-.5)*o.h;c.beginPath();c.moveTo(X(0),Y(0));
 if(P.length===1)c.lineTo(X(0)+.01,Y(0));
 for(let i=1;i<P.length-1;i++)c.quadraticCurveTo(X(i),Y(i),(X(i)+X(i+1))/2,(Y(i)+Y(i+1))/2);
 if(P.length>1)c.lineTo(X(P.length-1),Y(P.length-1))}
function drawObj(c,o,forExport){
 if(o.hidden)return;c.save();c.globalAlpha=o.opacity==null?1:o.opacity;c.lineCap='round';c.lineJoin='round';
 if(o.type==='line'){
  const dx=o.x2-o.x1,dy=o.y2-o.y1,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;c.strokeStyle=c.fillStyle=o.stroke;c.lineWidth=o.sw;
  if(o.arrow){const hl=Math.min(len,Math.max(14,o.sw*3.6)),hw=hl*.42,bx=o.x2-ux*hl,by=o.y2-uy*hl;
   c.lineCap='butt';c.beginPath();c.moveTo(o.x1,o.y1);c.lineTo(bx+ux,by+uy);c.stroke();
   c.beginPath();c.moveTo(o.x2,o.y2);c.lineTo(bx-uy*hw,by+ux*hw);c.lineTo(bx+uy*hw,by-ux*hw);c.closePath();c.fill();
  }else{c.beginPath();c.moveTo(o.x1,o.y1);c.lineTo(o.x2,o.y2);c.stroke()}
  c.restore();return}
 c.translate(o.cx,o.cy);c.rotate(o.rot||0);const w=o.w,h=o.h;
 if(o.type==='image'){const a=assets[o.asset];if(a&&a.img.complete&&a.img.naturalWidth){if(o.flip)c.scale(-1,1);const cr=o.crop,iw=a.img.naturalWidth,ih=a.img.naturalHeight;if(cr)c.drawImage(a.img,cr.x*iw,cr.y*ih,cr.w*iw,cr.h*ih,-w/2,-h/2,w,h);else c.drawImage(a.img,-w/2,-h/2,w,h)}
  else{c.fillStyle='#cfd3de';c.fillRect(-w/2,-h/2,w,h)}}
 else if(o.type==='rect'||o.type==='ellipse'){c.beginPath();
  if(o.type==='ellipse')c.ellipse(0,0,Math.max(w/2,.1),Math.max(h/2,.1),0,0,Math.PI*2);
  else if(o.radius&&c.roundRect)c.roundRect(-w/2,-h/2,w,h,Math.min(o.radius,w/2,h/2));else c.rect(-w/2,-h/2,w,h);
  if(o.fill!=='none'){c.fillStyle=o.fill;c.fill()}
  if(o.stroke!=='none'&&o.sw>0){c.lineJoin='miter';c.strokeStyle=o.stroke;c.lineWidth=o.sw;c.stroke()}}
 else if(o.type==='pen'){penPath(c,o);c.strokeStyle=o.stroke;c.lineWidth=o.sw;c.stroke()}
 else if(o.type==='text'){
  if(editing===o.id&&!forExport){c.restore();return}
  if(o.bg&&o.bg!=='none'){c.fillStyle=o.bg;c.fillRect(-w/2,-h/2,w,h)}
  c.font=fontOf(o);c.fillStyle=o.color;c.textBaseline='middle';c.textAlign=o.align;
  const pad=o.fontSize*.2,lh=o.fontSize*1.3,x=o.align==='center'?0:o.align==='right'?w/2-pad:-w/2+pad;
  (o.text||'').split('\n').forEach((l,i)=>c.fillText(l,x,-h/2+pad+lh*(i+.5)))}
 c.restore()}

let checker=null;
function getChecker(){if(checker)return checker;const p=document.createElement('canvas');p.width=p.height=24;const x=p.getContext('2d');
 x.fillStyle='#fff';x.fillRect(0,0,24,24);x.fillStyle='#d5d8e0';x.fillRect(0,0,12,12);x.fillRect(12,12,12,12);return checker=ctx.createPattern(p,'repeat')}
const w2s=(x,y)=>[x*S.zoom+S.pan.x,y*S.zoom+S.pan.y];
const s2w=(x,y)=>({x:(x-S.pan.x)/S.zoom,y:(y-S.pan.y)/S.zoom});
function corners(o){return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{const r=rot(a*o.w/2,b*o.h/2,o.rot);return w2s(o.cx+r[0],o.cy+r[1])})}
function handles(o){
 if(o.type==='line')return[{mode:'end',k:1,s:w2s(o.x1,o.y1)},{mode:'end',k:2,s:w2s(o.x2,o.y2)}];
 const dirs=o.type==='text'?[[-1,-1],[1,-1],[1,1],[-1,1]]:[[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]];
 const out=dirs.map(([hx,hy])=>{const r=rot(hx*o.w/2,hy*o.h/2,o.rot);return{mode:'resize',hx,hy,s:w2s(o.cx+r[0],o.cy+r[1])}});
 const t=rot(0,-o.h/2,o.rot),ts=w2s(o.cx+t[0],o.cy+t[1]),off=rot(0,-28,o.rot);
 out.push({mode:'rotate',s:[ts[0]+off[0],ts[1]+off[1]],from:ts});return out}
function render(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;paint()})}
function paint(){
 const dpr=window.devicePixelRatio||1,W=stage.clientWidth,H=stage.clientHeight;
 if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
 const css=getComputedStyle(host),work=css.getPropertyValue('--work').trim()||'#ddd',acc=css.getPropertyValue('--accent').trim()||'#2b5cff';
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
 const z=S.zoom,ax=S.pan.x,ay=S.pan.y,aw=S.doc.w*z,ah=S.doc.h*z;
 ctx.save();ctx.translate(ax,ay);ctx.scale(z,z);
 ctx.fillStyle=S.doc.transparent?getChecker():S.doc.bg;ctx.fillRect(0,0,S.doc.w,S.doc.h);
 for(const o of S.objs){if(cropping&&cropping.id===o.id)drawCrop(ctx,o);else drawObj(ctx,o)}
 if(drag&&drag.mode==='pen'){const st=styleFor(S.tool);ctx.globalAlpha=S.tool==='marker'?.4:1;ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle=st.stroke;ctx.lineWidth=st.sw;
  ctx.beginPath();drag.pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));if(drag.pts.length===1)ctx.lineTo(drag.pts[0][0]+.01,drag.pts[0][1]);ctx.stroke();ctx.globalAlpha=1}
 ctx.restore();
 ctx.save();ctx.globalAlpha=.8;ctx.fillStyle=work;ctx.beginPath();ctx.rect(0,0,W,H);ctx.rect(ax,ay,aw,ah);ctx.fill('evenodd');ctx.restore();
 ctx.strokeStyle='rgba(120,128,150,.6)';ctx.lineWidth=1;ctx.strokeRect(Math.round(ax)-.5,Math.round(ay)-.5,Math.round(aw)+1,Math.round(ah)+1);
 const o=selObj();
 if(cropping){const hs=cropHandles();ctx.strokeStyle=acc;ctx.lineWidth=1.5;ctx.beginPath();[0,2,4,6].forEach((k,i)=>i?ctx.lineTo(hs[k].s[0],hs[k].s[1]):ctx.moveTo(hs[k].s[0],hs[k].s[1]));ctx.closePath();ctx.stroke();
  for(const hd of hs){ctx.beginPath();ctx.rect(hd.s[0]-5,hd.s[1]-5,10,10);ctx.fillStyle='#fff';ctx.fill();ctx.stroke()}}
 else if(o&&editing!==o.id){ctx.strokeStyle=acc;ctx.lineWidth=1.5;
  if(isBox(o)){const c=corners(o);if(o.locked)ctx.setLineDash([5,4]);ctx.beginPath();c.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();ctx.setLineDash([])}
  if(!o.locked)for(const hd of handles(o)){
   if(hd.mode==='rotate'){ctx.beginPath();ctx.moveTo(hd.from[0],hd.from[1]);ctx.lineTo(hd.s[0],hd.s[1]);ctx.stroke()}
   ctx.beginPath();if(hd.mode==='resize')ctx.rect(hd.s[0]-5,hd.s[1]-5,10,10);else ctx.arc(hd.s[0],hd.s[1],6,0,Math.PI*2);
   ctx.fillStyle='#fff';ctx.fill();ctx.stroke()}}
 if(editing)placeTA();
 $('#zoomLabel').textContent=Math.round(z*100)+'%'}
function fit(){const W=stage.clientWidth,H=stage.clientHeight,m=W<500?20:56;
 S.zoom=clamp(Math.min((W-m*2)/S.doc.w,(H-m*2)/S.doc.h),.02,8);S.pan.x=(W-S.doc.w*S.zoom)/2;S.pan.y=(H-S.doc.h*S.zoom)/2;render()}
function zoomAt(sx,sy,f){const z=clamp(S.zoom*f,.02,16),w=s2w(sx,sy);S.zoom=z;S.pan.x=sx-w.x*z;S.pan.y=sy-w.y*z;render()}

/* ---------- image cropping ---------- */
// o.crop 以原圖比例記錄保留的範圍；裁剪時 F 是整張圖在畫布上的位置，r 是畫面上保留的範圍（0–1）
function startCrop(o){if(!o||o.type!=='image'||o.locked)return;if(S.tool!=='select')setTool('select');S.sel=o.id;
 const c=o.crop||{x:0,y:0,w:1,h:1},fw=o.w/c.w,fh=o.h/c.h,dx=o.flip?1-(c.x+c.w):c.x,off=rot((dx+c.w/2-.5)*fw,(c.y+c.h/2-.5)*fh,o.rot);
 cropping={id:o.id,F:{cx:o.cx-off[0],cy:o.cy-off[1],w:fw,h:fh,rot:o.rot},r:{x0:dx,y0:c.y,x1:dx+c.w,y1:c.y+c.h}};$('#hint').textContent='拖曳邊框或控制點調整要保留的範圍，拖曳框內可移動。Enter 完成，Esc 取消。';refreshPanel();render()}
function endCrop(apply){if(!cropping)return;const o=byId(cropping.id),{F,r}=cropping;cropping=null;$('#hint').textContent=HINT[S.tool]||'';
 if(o&&apply){const w=r.x1-r.x0,hh=r.y1-r.y0;if(w>.999&&hh>.999)delete o.crop;else o.crop={x:o.flip?1-r.x1:r.x0,y:r.y0,w,h:hh};
  o.w=w*F.w;o.h=hh*F.h;const off=rot(((r.x0+r.x1)/2-.5)*F.w,((r.y0+r.y1)/2-.5)*F.h,F.rot);o.cx=F.cx+off[0];o.cy=F.cy+off[1];done()}
 else{refreshPanel();render()}}
function cropHandles(){const{F,r}=cropping,P=(fx,fy)=>{const q=rot((fx-.5)*F.w,(fy-.5)*F.h,F.rot);return w2s(F.cx+q[0],F.cy+q[1])},mx=(r.x0+r.x1)/2,my=(r.y0+r.y1)/2;
 return[[r.x0,r.y0,-1,-1],[mx,r.y0,0,-1],[r.x1,r.y0,1,-1],[r.x1,my,1,0],[r.x1,r.y1,1,1],[mx,r.y1,0,1],[r.x0,r.y1,-1,1],[r.x0,my,-1,0]].map(([fx,fy,hx,hy])=>({hx,hy,s:P(fx,fy)}))}
function cropFrac(p){const{F}=cropping,l=rot(p.x-F.cx,p.y-F.cy,-F.rot);return{x:l[0]/F.w+.5,y:l[1]/F.h+.5}}
function drawCrop(c,o){const a=assets[o.asset],{F,r}=cropping;if(!a||!a.img.naturalWidth)return;c.save();c.translate(F.cx,F.cy);c.rotate(F.rot);
 const im=()=>{c.save();if(o.flip)c.scale(-1,1);c.drawImage(a.img,-F.w/2,-F.h/2,F.w,F.h);c.restore()};
 c.globalAlpha=.28;im();c.globalAlpha=o.opacity==null?1:o.opacity;c.beginPath();c.rect((r.x0-.5)*F.w,(r.y0-.5)*F.h,(r.x1-r.x0)*F.w,(r.y1-r.y0)*F.h);c.clip();im();c.restore()}

/* ---------- hit testing ---------- */
function local(o,p){const r=rot(p.x-o.cx,p.y-o.cy,-o.rot);return{x:r[0],y:r[1]}}
function segDist(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,l=dx*dx+dy*dy;let t=l?((px-x1)*dx+(py-y1)*dy)/l:0;t=clamp(t,0,1);return Math.hypot(px-x1-t*dx,py-y1-t*dy)}
function inBox(o,p,tol=0){const l=local(o,p);return Math.abs(l.x)<=o.w/2+tol&&Math.abs(l.y)<=o.h/2+tol}
function hitObj(o,p){const tol=7/S.zoom;
 if(o.type==='line')return segDist(p.x,p.y,o.x1,o.y1,o.x2,o.y2)<=Math.max(o.sw/2,tol);
 const t=Math.max((o.sw||0)/2,tol);if(!inBox(o,p,o.type==='pen'||o.type==='rect'||o.type==='ellipse'?t:0))return false;
 const l=local(o,p);
 if(o.type==='pen'){const P=o.pts;if(P.length===1)return true;for(let i=1;i<P.length;i++)if(segDist(l.x,l.y,(P[i-1][0]-.5)*o.w,(P[i-1][1]-.5)*o.h,(P[i][0]-.5)*o.w,(P[i][1]-.5)*o.h)<=t)return true;return false}
 if(o.type==='rect'&&o.fill==='none')return Math.abs(l.x)>=o.w/2-t||Math.abs(l.y)>=o.h/2-t;
 if(o.type==='ellipse'){const rx=o.w/2,ry=o.h/2,n=(a,b)=>a>0&&b>0?(l.x*l.x)/(a*a)+(l.y*l.y)/(b*b):2;
  if(n(rx+t,ry+t)>1)return false;return o.fill!=='none'||n(rx-t,ry-t)>=1||rx<=t||ry<=t}
 return true}
function hitTest(p){
 for(let i=S.objs.length-1;i>=0;i--){const o=S.objs[i];if(o.hidden||o.locked)continue;if(hitObj(o,p))return o}
 const s=selObj();if(s&&!s.locked&&!s.hidden&&isBox(s)&&inBox(s,p))return s;return null}
function hitHandle(o,s,r=11){let best=null,bd=r;for(const hd of handles(o)){const d=Math.hypot(hd.s[0]-s[0],hd.s[1]-s[1]);if(d<=bd){bd=d;best=hd}}return best}

/* ---------- history ---------- */
const snap=()=>JSON.stringify({doc:S.doc,objs:S.objs});
function commit(){const s=snap();if(hist[hi]===s)return;hist.length=hi+1;hist.push(s);if(hist.length>120)hist.shift();hi=hist.length-1;pristine=false;updateBar()}
function restore(i){cropping=null;hi=i;const d=JSON.parse(hist[hi]);S.doc=d.doc;S.objs=d.objs;if(!selObj())S.sel=null;S.objs.forEach(o=>{if(o.type==='text')ensureFont(o)});updateBar();refreshPanel();render()}
function updateBar(){$('#btnUndo').disabled=hi<=0;$('#btnRedo').disabled=hi>=hist.length-1;$('#sample').classList.toggle('hide',!pristine)}
function done(){commit();refreshPanel();render()}

/* ---------- object operations ---------- */
function nameOf(o){return o.type==='text'?((o.text||'').replace(/\n/g,' ').slice(0,14)||'文字'):o.type==='image'?'圖片':o.type==='rect'?'矩形':o.type==='ellipse'?'橢圓':o.type==='pen'?(o.opacity<1?'螢光筆':'筆跡'):o.arrow?'箭頭':'直線'}
function iconOf(o){return o.type==='line'?(o.arrow?'arrow':'line'):o.type==='pen'?(o.opacity<1?'marker':'pen'):o.type}
function del(){const o=selObj();if(!o)return;S.objs=S.objs.filter(x=>x!==o);S.sel=null;done()}
function shift(o,dx,dy){if(o.type==='line'){o.x1+=dx;o.x2+=dx;o.y1+=dy;o.y2+=dy}else{o.cx+=dx;o.cy+=dy}}
function addCopy(src,off){const o=clone(src);o.id=nid();o.locked=false;shift(o,off,off);S.objs.push(o);S.sel=o.id;done()}
function order(how){const o=selObj();if(!o)return;const a=S.objs,i=a.indexOf(o);a.splice(i,1);
 a.splice(how==='top'?a.length:how==='bottom'?0:clamp(i+(how==='up'?1:-1),0,a.length),0,o);done()}
function setTool(t){if(cropping&&t!=='select')endCrop(true);if(t==='image'){$('#fileImg').click();return}S.tool=t;if(t!=='select')S.sel=null;
 root.querySelectorAll('.tool').forEach(b=>b.classList.toggle('on',b.dataset.t===t));$('#hint').textContent=HINT[t]||'';
 cv.style.cursor=t==='select'?'default':t==='text'?'text':'crosshair';refreshPanel();render()}
function clearAll(){S.objs=[];S.sel=null;pristine=false;hist.length=hi+1;done();updateBar()}

/* ---------- images & files ---------- */
function loadAsset(id,src){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{assets[id]={src,img};res(img)};img.onerror=()=>rej(new Error('img'));img.src=src})}
const readAs=(f,how)=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r[how](f)});
async function addImageFile(f){
 try{const src=await readAs(f,'readAsDataURL'),id='a'+Date.now().toString(36)+(uid++),img=await loadAsset(id,src);
  const iw=img.naturalWidth||300,ih=img.naturalHeight||200;let w=iw,h=ih;
  if(pristine){S.objs=[];S.doc.w=iw;S.doc.h=ih;S.doc.transparent=false}
  else{const k=Math.min(1,S.doc.w*.8/iw,S.doc.h*.8/ih);w=iw*k;h=ih*k}
  const first=pristine,o={id:nid(),type:'image',asset:id,cx:S.doc.w/2,cy:S.doc.h/2,w,h,rot:0,opacity:1,flip:false};
  S.objs.push(o);S.sel=o.id;if(S.tool!=='select')setTool('select');S.sel=o.id;done();if(first)fit();
 }catch(e){toast('這個檔案讀不出來，請換一張 PNG、JPG 或 WebP 圖片。')}}
async function addFiles(files){for(const f of files){if(/\.json$/i.test(f.name)||f.type==='application/json')await openProject(f);else if(f.type.startsWith('image/'))await addImageFile(f)}}
async function openProject(f){
 try{const d=JSON.parse(await readAs(f,'readAsText'));if(!d||!d.doc||!Array.isArray(d.objs))throw 0;
  for(const [id,src] of Object.entries(d.assets||{}))await loadAsset(id,src);
  S.doc=d.doc;S.objs=d.objs;S.sel=null;pristine=false;hist=[snap()];hi=0;S.objs.forEach(o=>{if(o.type==='text')ensureFont(o)});updateBar();refreshPanel();fit();toast('已開啟專案')
 }catch(e){toast('這不是物件畫板的專案檔，請選之前用「儲存專案」存下來的 .json 檔。')}}
function exportCanvas(){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(S.doc.w));c.height=Math.max(1,Math.round(S.doc.h));const x=c.getContext('2d');
 if(!S.doc.transparent){x.fillStyle=S.doc.bg;x.fillRect(0,0,c.width,c.height)}for(const o of S.objs)drawObj(x,o,true);return c}
async function save(filename,data){try{toast(await saveFile(filename,data));return true}catch(e){toast(e.message||'無法儲存');return false}}
function exportPNG(){if(cropping)endCrop(true);exportCanvas().toBlob(async b=>{if(!b){toast('匯出失敗，畫布可能太大。');return}await save('物件畫板.png',b)},'image/png')}
async function saveProject(){if(cropping)endCrop(true);const used={};S.objs.forEach(o=>{if(o.type==='image'&&assets[o.asset])used[o.asset]=assets[o.asset].src});
 await save('物件畫板專案.json',new Blob([JSON.stringify({app:'object-board',v:1,doc:S.doc,objs:S.objs,assets:used})]))}
let toastT=0;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),3200)}

/* ---------- text editing ---------- */
function placeTA(){const o=byId(editing);if(!o)return;const z=S.zoom;
 Object.assign(ta.style,{left:(o.cx*z+S.pan.x)+'px',top:(o.cy*z+S.pan.y)+'px',width:(o.w*z+4)+'px',height:(o.h*z)+'px',transform:`translate(-50%,-50%) rotate(${o.rot}rad)`,
  font:fontOf(o,o.fontSize*z),lineHeight:'1.3',padding:(o.fontSize*.2*z)+'px',textAlign:o.align,color:o.color,background:o.bg==='none'?'transparent':o.bg})}
function startEdit(o,selectAll){if(o.locked)return;editing=o.id;S.sel=o.id;ta.value=o.text;ta.style.display='block';placeTA();ta.focus();if(selectAll)ta.select();refreshPanel();render()}
function endEdit(){if(!editing)return;const o=byId(editing);editing=null;ta.style.display='none';
 if(o&&!o.text.trim()){S.objs=S.objs.filter(x=>x!==o);if(S.sel===o.id)S.sel=null}done()}
ta.addEventListener('input',()=>{const o=byId(editing);if(!o)return;o.text=ta.value;remeasure(o);ensureFont(o);render()});
ta.addEventListener('blur',endEdit);
ta.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();ta.blur()}e.stopPropagation()});

/* ---------- pointer ---------- */
const spt=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
cv.addEventListener('pointerdown',e=>{
 if(editing)ta.blur();
 try{cv.setPointerCapture(e.pointerId)}catch(_){}
 const s=spt(e),p=s2w(s[0],s[1]);
 if(e.button===1||spaceDown){drag={mode:'pan',s,pan:{...S.pan}};e.preventDefault();return}
 if(e.button!==0)return;
 if(cropping){let hd=null,bd=e.pointerType==='touch'?18:11;for(const k of cropHandles()){const d=Math.hypot(k.s[0]-s[0],k.s[1]-s[1]);if(d<=bd){bd=d;hd=k}}
  const f=cropFrac(p),r=cropping.r;
  if(hd)drag={mode:'crop',hd};else if(f.x>=r.x0&&f.x<=r.x1&&f.y>=r.y0&&f.y<=r.y1)drag={mode:'cropmove',f0:f,r0:{...r}};else drag={mode:'pan',s,pan:{...S.pan}};return}
 const t=S.tool,st=styleFor(t);
 if(t==='select'){
  const o=selObj();
  if(o&&!o.locked){const hd=hitHandle(o,s,e.pointerType==='touch'?18:11);if(hd){drag={mode:hd.mode,hd,orig:clone(o),p0:p,o};return}}
  const hit=hitTest(p);
  if(hit){if(S.sel!==hit.id){S.sel=hit.id;refreshPanel()}drag={mode:'move',orig:clone(hit),p0:p,o:hit}}
  else{if(S.sel){S.sel=null;refreshPanel()}drag={mode:'pan',s,pan:{...S.pan}}}
 }else if(t==='text'){drag={mode:'newtext',p}}
 else if(t==='rect'||t==='ellipse'){const o={id:nid(),type:t,cx:p.x,cy:p.y,w:0,h:0,rot:0,opacity:1,fill:st.fill,stroke:st.stroke,sw:st.sw,radius:0};S.objs.push(o);drag={mode:'create',p0:p,o}}
 else if(t==='line'||t==='arrow'){const o={id:nid(),type:'line',arrow:t==='arrow',x1:p.x,y1:p.y,x2:p.x,y2:p.y,opacity:1,stroke:st.stroke,sw:st.sw};S.objs.push(o);drag={mode:'createLine',p0:p,o}}
 else if(t==='pen'||t==='marker'){drag={mode:'pen',pts:[[p.x,p.y]]}}
 render()});
function snapAngle(x1,y1,x2,y2){const a=Math.round(Math.atan2(y2-y1,x2-x1)/(Math.PI/4))*(Math.PI/4),l=Math.hypot(x2-x1,y2-y1);return[x1+Math.cos(a)*l,y1+Math.sin(a)*l]}
cv.addEventListener('pointermove',e=>{
 const s=spt(e),p=s2w(s[0],s[1]);
 if(!drag){if(S.tool==='select'){const o=selObj(),hd=o&&!o.locked&&hitHandle(o,s);cv.style.cursor=spaceDown?'grab':hd?(hd.mode==='rotate'?'grab':'pointer'):hitTest(p)?'move':'default'}return}
 const d=drag,o=d.o,g=d.orig;
 if(d.mode==='crop'){const f=cropFrac(p),r=cropping.r,m=.02;if(d.hd.hx<0)r.x0=clamp(f.x,0,r.x1-m);if(d.hd.hx>0)r.x1=clamp(f.x,r.x0+m,1);if(d.hd.hy<0)r.y0=clamp(f.y,0,r.y1-m);if(d.hd.hy>0)r.y1=clamp(f.y,r.y0+m,1);render();return}
 if(d.mode==='cropmove'){const f=cropFrac(p),r=cropping.r,w=d.r0.x1-d.r0.x0,hh=d.r0.y1-d.r0.y0,x=clamp(d.r0.x0+f.x-d.f0.x,0,1-w),y=clamp(d.r0.y0+f.y-d.f0.y,0,1-hh);r.x0=x;r.x1=x+w;r.y0=y;r.y1=y+hh;render();return}
 if(d.mode==='pan'){S.pan.x=d.pan.x+s[0]-d.s[0];S.pan.y=d.pan.y+s[1]-d.s[1]}
 else if(d.mode==='move'){let dx=p.x-d.p0.x,dy=p.y-d.p0.y;if(!d.moved&&Math.hypot(dx,dy)*S.zoom<3)return;d.moved=true;if(o.locked)return;
  if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0}
  if(o.type==='line'){o.x1=g.x1+dx;o.y1=g.y1+dy;o.x2=g.x2+dx;o.y2=g.y2+dy}else{o.cx=g.cx+dx;o.cy=g.cy+dy}}
 else if(d.mode==='end'){let x=p.x,y=p.y;const k=d.hd.k,ox=k===1?g.x2:g.x1,oy=k===1?g.y2:g.y1;if(e.shiftKey)[x,y]=snapAngle(ox,oy,x,y);o['x'+k]=x;o['y'+k]=y}
 else if(d.mode==='rotate'){let a=Math.atan2(p.y-g.cy,p.x-g.cx)+Math.PI/2;if(e.shiftKey)a=Math.round(a/(Math.PI/12))*(Math.PI/12);o.rot=a}
 else if(d.mode==='resize'){const{hx,hy}=d.hd,an=rot(-hx*g.w/2,-hy*g.h/2,g.rot),Ax=g.cx+an[0],Ay=g.cy+an[1],l=rot(p.x-Ax,p.y-Ay,-g.rot);
  let w=g.w,h=g.h;const corner=hx&&hy;
  if(o.type==='text'){const k=clamp(Math.max(l[0]*hx/g.w,l[1]*hy/g.h),.05,50);o.fontSize=clamp(Math.round(g.fontSize*k),6,1000);measure(o);w=o.w;h=o.h}
  else{const keep=corner&&((o.type==='image'||o.type==='pen')!==e.shiftKey);
   if(keep){const k=Math.max(l[0]*hx/g.w,l[1]*hy/g.h,2/Math.max(g.w,g.h));w=g.w*k;h=g.h*k}
   else{if(hx)w=Math.max(2,l[0]*hx);if(hy)h=Math.max(2,l[1]*hy)}
   o.w=w;o.h=h}
  const c=rot(hx*w/2,hy*h/2,g.rot);o.cx=Ax+c[0];o.cy=Ay+c[1]}
 else if(d.mode==='create'){let dx=p.x-d.p0.x,dy=p.y-d.p0.y;if(e.shiftKey){const m=Math.max(Math.abs(dx),Math.abs(dy));dx=Math.sign(dx||1)*m;dy=Math.sign(dy||1)*m}
  o.w=Math.abs(dx);o.h=Math.abs(dy);o.cx=d.p0.x+dx/2;o.cy=d.p0.y+dy/2}
 else if(d.mode==='createLine'){let x=p.x,y=p.y;if(e.shiftKey)[x,y]=snapAngle(o.x1,o.y1,x,y);o.x2=x;o.y2=y}
 else if(d.mode==='pen'){const q=d.pts[d.pts.length-1];if(Math.hypot(p.x-q[0],p.y-q[1])*S.zoom>=1.5)d.pts.push([p.x,p.y])}
 render()});
function endDrag(e){
 if(!drag)return;const d=drag,o=d.o;drag=null;
 if(d.mode==='pan'||d.mode==='crop'||d.mode==='cropmove'){render();return}
 if(d.mode==='newtext'){const st=S.style,t={id:nid(),type:'text',text:'',fontSize:st.fontSize,family:st.family,bold:st.bold,italic:st.italic,color:st.color,bg:st.bg,align:st.align,cx:0,cy:0,w:0,h:0,rot:0,opacity:1};
  measure(t);t.cx=d.p.x+t.w/2;t.cy=d.p.y;S.objs.push(t);setTool('select');startEdit(t);return}
 if(d.mode==='create'){if(o.w*S.zoom<4&&o.h*S.zoom<4){o.w=Math.min(240,S.doc.w*.3);o.h=o.w*.62;o.cx=d.p0.x;o.cy=d.p0.y}o.w=Math.max(o.w,2);o.h=Math.max(o.h,2);setTool('select');S.sel=o.id}
 else if(d.mode==='createLine'){if(Math.hypot(o.x2-o.x1,o.y2-o.y1)*S.zoom<4){o.x2=o.x1+Math.min(200,S.doc.w*.25);o.y2=o.y1}setTool('select');S.sel=o.id}
 else if(d.mode==='pen'){const P=d.pts,st=styleFor(S.tool);let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;for(const[x,y]of P){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
  const w=Math.max(x1-x0,1),h=Math.max(y1-y0,1);
  S.objs.push({id:nid(),type:'pen',cx:x0+(x1-x0)/2,cy:y0+(y1-y0)/2,w,h,rot:0,opacity:S.tool==='marker'?.4:1,stroke:st.stroke,sw:st.sw,
   pts:P.map(([x,y])=>[+(x1>x0?(x-x0)/w:.5).toFixed(4),+(y1>y0?(y-y0)/h:.5).toFixed(4)])})}
 done()}
cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
cv.addEventListener('dblclick',e=>{if(S.tool!=='select')return;const s=spt(e),o=hitTest(s2w(s[0],s[1]));if(cropping)return;if(o&&o.type==='text')startEdit(o,true);else if(o&&o.type==='image')startCrop(o)});
cv.addEventListener('wheel',e=>{e.preventDefault();const s=spt(e);if(e.ctrlKey||e.metaKey)zoomAt(s[0],s[1],Math.exp(-e.deltaY*.01));else{S.pan.x-=e.deltaX;S.pan.y-=e.deltaY;render()}},{passive:false});

/* ---------- keyboard, paste, drop ---------- */
const inField=e=>/^(INPUT|TEXTAREA|SELECT)$/.test(((e.composedPath&&e.composedPath()[0])||e.target).tagName||'');
document.addEventListener('keydown',e=>{
 if(!isActive()||inField(e))return;const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey,o=selObj();
 if(cropping){if(k==='enter'){e.preventDefault();endCrop(true)}else if(k==='escape')endCrop(false);return}
 if(k===' '){spaceDown=true;e.preventDefault();return}
 if(mod&&k==='z'){e.preventDefault();if(e.shiftKey){if(hi<hist.length-1)restore(hi+1)}else if(hi>0)restore(hi-1);return}
 if(mod&&k==='y'){e.preventDefault();if(hi<hist.length-1)restore(hi+1);return}
 if(mod&&k==='c'){if(o){clip=clone(o);toast('已複製物件')}return}
 if(mod&&k==='d'){e.preventDefault();if(o)addCopy(o,24);return}
 if(mod)return;
 if(k==='delete'||k==='backspace'){e.preventDefault();del();return}
 if(k==='escape'){if(S.tool!=='select')setTool('select');else if(S.sel){S.sel=null;refreshPanel();render()}return}
 if(k==='enter'&&o&&o.type==='text'){e.preventDefault();startEdit(o,true);return}
 if(k.startsWith('arrow')&&o&&!o.locked){e.preventDefault();const n=e.shiftKey?10:1;shift(o,k==='arrowleft'?-n:k==='arrowright'?n:0,k==='arrowup'?-n:k==='arrowdown'?n:0);commit();render();return}
 if(k===']'){order('up');return}if(k==='['){order('down');return}
 const map={v:'select',t:'text',r:'rect',o:'ellipse',l:'line',a:'arrow',p:'pen',m:'marker'};if(map[k])setTool(map[k])});
document.addEventListener('keyup',e=>{if(e.key===' ')spaceDown=false});
document.addEventListener('paste',e=>{if(!isActive()||inField(e))return;const fs=[...(e.clipboardData?.files||[])].filter(f=>f.type.startsWith('image/'));
 if(fs.length){e.preventDefault();addFiles(fs)}else if(clip){e.preventDefault();addCopy(clip,24);clip=clone(selObj())}});
stage.addEventListener('dragover',e=>e.preventDefault());
stage.addEventListener('drop',e=>{e.preventDefault();if(e.dataTransfer?.files?.length)addFiles([...e.dataTransfer.files])});

/* ---------- inspector ---------- */
function h(tag,attrs,...kids){const el=document.createElement(tag);for(const k in attrs||{}){const v=attrs[k];if(k==='class')el.className=v;else if(k==='html')el.innerHTML=v;else if(k.startsWith('on'))el[k]=v;else if(v!==false&&v!=null)el.setAttribute(k,v===true?'':v)}
 for(const c of kids)if(c!=null)el.append(c);return el}
const row=(label,id,...c)=>h('div',{class:'row'},h('label',{class:'lab',for:id},label),h('div',{class:'ctl'},...c));
function setProp(t,k,v){t[k]=v;if(t.type==='text'){remeasure(t);ensureFont(t)}render()}
function colorCtl(t,key,allowNone,id='p-'+key){const cur=t[key];
 const inp=h('input',{type:'color',id,value:/^#[0-9a-f]{6}$/i.test(cur)?cur:'#ffffff',title:'自訂顏色'});
 inp.oninput=()=>setProp(t,key,inp.value);inp.onchange=()=>{commit();refreshPanel()};
 const pick=c=>()=>{setProp(t,key,c);done()};
 return[inp,allowNone?h('button',{class:'sw none'+(cur==='none'?' cur':''),title:'無','aria-label':'無',onclick:pick('none')}):null,
  ...SW.map(c=>h('button',{class:'sw'+(cur===c?' cur':''),style:'background:'+c,title:c,'aria-label':'顏色 '+c,onclick:pick(c)}))]}
function rangeCtl(t,key,min,max,step,fmt=v=>v,conv=v=>v,inv=v=>v){const val=h('span',{class:'val'},fmt(t[key]));
 const inp=h('input',{type:'range',id:'p-'+key,min,max,step,value:inv(t[key])});
 inp.oninput=()=>{setProp(t,key,conv(+inp.value));val.textContent=fmt(t[key])};inp.onchange=commit;return[inp,val]}
function numCtl(id,value,min,max,apply){const inp=h('input',{type:'number',id,min,max,value:Math.round(value)});
 inp.onchange=()=>{const v=clamp(+inp.value||min,min,max);inp.value=v;apply(v);commit();refreshLayers();render()};return inp}
const tog=(label,on,fn,title)=>h('button',{class:'btn'+(on?' on':''),title:title||label,'aria-pressed':on?'true':'false',onclick:()=>{fn();done()}},label);
function refreshPanel(){
 if(cropping&&S.sel!==cropping.id)return endCrop(true);
 const P=$('#props');P.textContent='';const o=selObj(),tool=S.tool;
 if(cropping&&o){const sec=h('div',{class:'sec'});P.append(sec);sec.append(h('h2',{},'裁剪圖片'),h('div',{class:'name'},nameOf(o)),
  h('p',{class:'note'},'拖曳邊框或控制點調整要保留的範圍，拖曳框內可移動。淡色的部分會被裁掉。'),
  h('div',{class:'btns'},h('button',{class:'btn primary',onclick:()=>endCrop(true)},'完成裁剪'),h('button',{class:'btn',onclick:()=>endCrop(false)},'取消'),
   h('button',{class:'btn',onclick:()=>{cropping.r={x0:0,y0:0,x1:1,y1:1};render()}},'選取整張')));refreshLayers();return}
 const kind=o?(o.type==='line'?'line':o.type):(tool==='arrow'?'line':tool==='marker'?'pen':tool);
 const t=o||styleFor(tool),drawing=o||!['select','image'].includes(tool);
 if(drawing){const sec=h('div',{class:'sec'});P.append(sec);
  sec.append(h('h2',{},o?'選取的物件':'工具設定'),h('div',{class:'name'},o?nameOf(o):TOOLNAME[tool]));
  if(!o)sec.append(h('p',{class:'note'},'接下來畫的'+TOOLNAME[tool]+'會用這些設定。'));
  if(o&&o.locked)sec.append(h('p',{class:'note'},'這個物件已鎖定，在圖層按鎖頭可以解鎖。'));
  if(kind==='text'){
   const sel=h('select',{id:'p-family'},...Object.keys(FAM).map(k=>h('option',{value:k,selected:t.family===k},FAMNAME[k])));
   sel.onchange=()=>{setProp(t,'family',sel.value);commit()};
   sec.append(row('字型','p-family',sel),
    row('大小','p-fontSize',numCtl('p-fontSize',t.fontSize,6,1000,v=>setProp(t,'fontSize',v)),
     tog('粗',t.bold,()=>setProp(t,'bold',!t.bold),'粗體'),tog('斜',t.italic,()=>setProp(t,'italic',!t.italic),'斜體')),
    row('對齊','p-al',h('div',{class:'btns',id:'p-al'},...[['left','靠左'],['center','置中'],['right','靠右']].map(([a,n])=>tog(n,t.align===a,()=>setProp(t,'align',a))))),
    row('文字色','p-color',...colorCtl(t,'color')),row('底色','p-bg',...colorCtl(t,'bg',true)));
   if(o)sec.append(h('div',{class:'btns'},h('button',{class:'btn',onclick:()=>startEdit(o,true)},'修改文字')))}
  if(['rect','ellipse','line','pen'].includes(kind)){
   sec.append(row(kind==='rect'||kind==='ellipse'?'外框':'顏色','p-stroke',...colorCtl(t,'stroke',kind==='rect'||kind==='ellipse')));
   if(kind==='rect'||kind==='ellipse')sec.append(row('填滿','p-fill',...colorCtl(t,'fill',true)));
   sec.append(row('粗細','p-sw',...rangeCtl(t,'sw',1,80,1)));
   if(o&&kind==='rect')sec.append(row('圓角','p-radius',...rangeCtl(t,'radius',0,200,1)));
   if(o&&kind==='line')sec.append(row('樣式','p-arrow',h('div',{class:'btns',id:'p-arrow'},tog('直線',!o.arrow,()=>{o.arrow=false}),tog('箭頭',o.arrow,()=>{o.arrow=true}))))}
  if(o){
   sec.append(row('不透明','p-opacity',...rangeCtl(o,'opacity',10,100,1,v=>Math.round(v*100)+'%',v=>v/100,v=>Math.round(v*100))));
   if(isBox(o)){
    if(o.type!=='text')sec.append(row('尺寸','p-w',numCtl('p-w',o.w,2,20000,v=>{o.w=v}),numCtl('p-h',o.h,2,20000,v=>{o.h=v})));
    sec.append(row('旋轉','p-rot',numCtl('p-rot',((o.rot*180/Math.PI)%360+360)%360,0,360,v=>{o.rot=v*Math.PI/180}),h('span',{class:'val'},'度')))}
   if(o.type==='image')sec.append(h('div',{class:'btns'},h('button',{class:'btn',onclick:()=>startCrop(o)},'裁剪'),o.crop?h('button',{class:'btn',onclick:()=>{startCrop(o);if(cropping){cropping.r={x0:0,y0:0,x1:1,y1:1};endCrop(true)}}},'還原裁剪'):null,tog('左右翻轉',o.flip,()=>{o.flip=!o.flip}),
    h('button',{class:'btn',onclick:()=>{S.doc.w=Math.round(o.w);S.doc.h=Math.round(o.h);o.cx=o.w/2;o.cy=o.h/2;o.rot=0;done();fit()}},'畫布改成這張圖的大小')));
   sec.append(h('div',{class:'btns'},
    h('button',{class:'btn',onclick:()=>order('top')},'移到最上'),h('button',{class:'btn',onclick:()=>order('up')},'上移一層'),
    h('button',{class:'btn',onclick:()=>order('down')},'下移一層'),h('button',{class:'btn',onclick:()=>order('bottom')},'移到最下'),
    h('button',{class:'btn',onclick:()=>addCopy(o,24)},'複製一份'),h('button',{class:'btn danger',onclick:del},'刪除')))}}
 if(!o){const d=S.doc,sec=h('div',{class:'sec'});P.append(sec);
  const tr=h('input',{type:'checkbox',id:'p-transparent'});tr.checked=d.transparent;tr.onchange=()=>{d.transparent=tr.checked;done()};
  sec.append(h('h2',{},'畫布'),
   row('尺寸','p-dw',numCtl('p-dw',d.w,16,12000,v=>{d.w=v}),numCtl('p-dh',d.h,16,12000,v=>{d.h=v}),h('span',{class:'val'},'px')),
   row('背景','p-docbg',...colorCtl(d,'bg',false,'p-docbg')),row('透明','p-transparent',tr,h('span',{class:'note'},'匯出的 PNG 背景透明')),
   h('div',{class:'btns'},h('button',{class:'btn',onclick:fit},'看整張畫布'),h('button',{class:'btn danger',onclick:clearAll},'清空畫布')))}
 refreshLayers()}
function refreshLayers(){const L=$('#layers');L.textContent='';
 if(!S.objs.length){L.append(h('p',{class:'note'},'還沒有物件。用左邊的工具畫，或把圖片拖進來。'));return}
 for(let i=S.objs.length-1;i>=0;i--){const o=S.objs[i];
  L.append(h('div',{class:'layer'+(o.id===S.sel?' on':'')},
   h('button',{class:'pick',html:ico(iconOf(o)),onclick:()=>{if(S.tool!=='select')setTool('select');S.sel=o.id;refreshPanel();render()}},h('span',{},nameOf(o))),
   h('button',{class:'mini'+(o.hidden?' off':''),html:ico('eye'),title:o.hidden?'顯示':'隱藏','aria-label':o.hidden?'顯示':'隱藏',onclick:()=>{o.hidden=!o.hidden;done()}}),
   h('button',{class:'mini'+(o.locked?' act':' off'),html:ico('lock'),title:o.locked?'解鎖':'鎖定（鎖住後不會被誤拖）','aria-label':o.locked?'解鎖':'鎖定',onclick:()=>{o.locked=!o.locked;done()}})))}}

/* ---------- chrome ---------- */
const T=$('#tools');TOOLS.forEach(([t,n])=>T.append(h('button',{class:'tool','data-t':t,title:n,'aria-label':n,html:ico(t),onclick:()=>setTool(t)})));
$('#btnAdd').onclick=()=>$('#fileImg').click();
$('#fileImg').onchange=e=>{addFiles([...e.target.files]);e.target.value=''};
$('#btnOpen').onclick=()=>$('#fileProj').click();
$('#fileProj').onchange=e=>{if(e.target.files[0])openProject(e.target.files[0]);e.target.value=''};
$('#btnSave').onclick=saveProject;$('#btnExport').onclick=exportPNG;
$('#btnUndo').onclick=()=>{if(hi>0)restore(hi-1)};$('#btnRedo').onclick=()=>{if(hi<hist.length-1)restore(hi+1)};
const mid=()=>[stage.clientWidth/2,stage.clientHeight/2];
$('#btnZoomIn').onclick=()=>zoomAt(...mid(),1.25);$('#btnZoomOut').onclick=()=>zoomAt(...mid(),.8);$('#zoomLabel').onclick=fit;
$('#btnClearSample').onclick=clearAll;
new ResizeObserver(()=>{if(pristine&&!drag)fit();else render()}).observe(stage);
if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener('change',render);
new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

/* ---------- sample scene ---------- */
function sampleImage(){const c=document.createElement('canvas');c.width=640;c.height=420;const x=c.getContext('2d');
 const g=x.createLinearGradient(0,0,0,420);g.addColorStop(0,'#7fb2ff');g.addColorStop(.7,'#ffe3b8');x.fillStyle=g;x.fillRect(0,0,640,420);
 x.fillStyle='#fff3c4';x.beginPath();x.arc(470,150,46,0,7);x.fill();
 x.fillStyle='#5d8f6b';x.beginPath();x.moveTo(0,330);x.quadraticCurveTo(170,210,340,320);x.quadraticCurveTo(500,250,640,310);x.lineTo(640,420);x.lineTo(0,420);x.fill();
 x.fillStyle='#3f6f55';x.beginPath();x.moveTo(0,380);x.quadraticCurveTo(240,300,640,372);x.lineTo(640,420);x.lineTo(0,420);x.fill();
 x.fillStyle='rgba(20,26,45,.72)';x.fillRect(16,16,112,34);x.fillStyle='#fff';x.font='500 18px '+FAM.sans;x.textBaseline='middle';x.fillText('範例圖片',30,34);return c.toDataURL('image/png')}
async function init(){
 try{await loadAsset('sample',sampleImage())}catch(e){}
 const tx=(text,cx,cy,fs,extra)=>{const o=Object.assign({id:nid(),type:'text',text,fontSize:fs,family:'sans',bold:false,italic:false,color:'#1b2033',bg:'none',align:'left',cx,cy,w:0,h:0,rot:0,opacity:1},extra);measure(o);return o};
 const wave=[];for(let i=0;i<=40;i++)wave.push([i/40,.5+.5*Math.sin(i/40*Math.PI*5)]);
 S.objs=[
  {id:nid(),type:'image',asset:'sample',cx:400,cy:400,w:640,h:420,rot:-.03,opacity:1,flip:false},
  {id:nid(),type:'pen',cx:880,cy:182,w:330,h:34,rot:0,opacity:.4,stroke:'#ffd43b',sw:30,pts:[[0,.5],[1,.5]]},
  tx('雙擊文字就能修改',880,180,40,{bold:true}),
  {id:nid(),type:'ellipse',cx:545,cy:330,w:150,h:150,rot:0,opacity:1,fill:'none',stroke:'#e03131',sw:6},
  {id:nid(),type:'line',arrow:true,x1:800,y1:330,x2:640,y2:330,opacity:1,stroke:'#e03131',sw:6},
  tx('圈起來、畫箭頭、\n寫註解都是獨立物件',960,330,26,{family:'kai'}),
  {id:nid(),type:'pen',cx:960,cy:392,w:260,h:14,rot:0,opacity:1,stroke:'#1c7ed6',sw:4,pts:wave},
  {id:nid(),type:'rect',cx:965,cy:560,w:330,h:120,rot:.04,opacity:1,fill:'#ffd43b',stroke:'none',sw:0,radius:14},
  tx('想遮掉什麼，\n蓋一塊色塊就好',965,560,28,{rot:.04,align:'center'})];
 hist=[snap()];hi=0;S.objs.forEach(o=>{if(o.type==='text')ensureFont(o)});
 setTool('select');updateBar();fit()}
init();

}
