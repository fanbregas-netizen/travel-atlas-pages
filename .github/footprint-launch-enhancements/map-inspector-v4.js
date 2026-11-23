/* Footprint Map product release · Chapter 03 · 2026-11-24.
   Read-only map design exhibit. Real OpenFreeMap vectors, original product palette.
   No place storage, no tracking, no fabricated raster zoom or POI icons. */
(()=>{
'use strict';
const q=s=>document.querySelector(s);
const mapStyle='https://tiles.openfreemap.org/styles/bright';
const lib='https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.js';
const libBackup='https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js';
const libCss='https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.css';
const focusItems=[
 {id:'roads',name:'道路',note:'道路等级与支路密度，随尺度逐步显现。',lng:121.464,lat:31.247,zoom:15.3},
 {id:'rail',name:'铁路',note:'真实铁路走向，观察其与道路、街区的关系。',lng:121.455,lat:31.250,zoom:15.4},
 {id:'river',name:'河流',note:'水系形态与桥梁交汇，是地图的空间线索。',lng:121.472,lat:31.242,zoom:14.8},
 {id:'buildings',name:'建筑',note:'放大后出现更细的街区与建筑轮廓。',lng:121.474,lat:31.237,zoom:17.0}
];
const levels=[
 {zoom:11.4,name:'城市',hint:'整体水网与城市主干结构'},
 {zoom:13.4,name:'片区',hint:'街道、河道与地理层次'},
 {zoom:15.3,name:'街道',hint:'轨道、道路与细分街区'},
 {zoom:17.3,name:'建筑',hint:'建筑轮廓和更细的道路'}
];
let map=null,activeFocus='river',initialized=false,loading=false,loadPromise=null;
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function make(tag,className,txt){const n=document.createElement(tag);if(className)n.className=className;if(txt!==undefined)n.textContent=txt;return n}
function script(url){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=url;s.onload=()=>res();s.onerror=()=>{s.remove();rej(new Error('加载地图渲染组件失败'))};document.head.append(s)})}
async function maplibre(){
 if(window.maplibregl?.Map)return window.maplibregl;
 if(!q('link[data-fp-visual-map]')){const l=document.createElement('link');l.rel='stylesheet';l.href=libCss;l.dataset.fpVisualMap='1';document.head.append(l)}
 if(!loadPromise)loadPromise=script(lib).catch(()=>script(libBackup));
 await loadPromise;
 if(!window.maplibregl?.Map)throw new Error('地图组件不可用');return window.maplibregl;
}
function state(txt,kind=''){const el=q('#fp-map-live-status');if(!el)return;el.textContent=txt;el.dataset.status=kind}
function activeButton(container,attr,val){container?.querySelectorAll('button').forEach(b=>{const on=b.dataset[attr]===String(val);b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on))})}
function nearestLevel(z){return levels.reduce((a,b)=>Math.abs(a.zoom-z)<Math.abs(b.zoom-z)?a:b)}
function readZoom(){if(!map)return;const z=map.getZoom();q('#fp-map-zoom-value').textContent='Z '+z.toFixed(1);const level=nearestLevel(z);q('#fp-map-level-hint').textContent=level.name+' · '+level.hint;activeButton(q('#fp-map-zoom-buttons'),'level',level.zoom)}
function ease(options){if(!map)return;const opts={...options,duration:reduced()?0:800,essential:true};if(reduced())map.jumpTo(opts);else map.easeTo(opts)}
function showFallback(message){q('#fp-map-static-fallback').hidden=false;q('#fp-map-live-layer').hidden=true;state(message,'fallback');q('#fp-map-open-product').hidden=false}
function buildFocusLayers(){
 if(!map?.getStyle()?.sources)return;
 const sources=map.getStyle().sources;
 const key=Object.keys(sources).find(id=>sources[id].type==='vector');
 if(!key)return;
 const firstSymbol=map.getStyle().layers.find(l=>l.type==='symbol')?.id;
 const layers=[
  {id:'roads',type:'line',source:key,'source-layer':'transportation',filter:['all',['==',['geometry-type'],'LineString'],['in',['get','class'],['literal',['motorway','trunk','primary','secondary','tertiary','minor','residential','service']]]],paint:{'line-color':'#F0D5C8','line-width':['interpolate',['linear'],['zoom'],11,.5,15,1.8,18,3.7],'line-opacity':0.85}},
  {id:'rail',type:'line',source:key,'source-layer':'transportation',filter:['all',['==',['geometry-type'],'LineString'],['any',['==',['get','class'],'rail'],['==',['get','subclass'],'rail']]],paint:{'line-color':'#F5F3EA','line-width':['interpolate',['linear'],['zoom'],11,.8,15,2.1,18,3.1],'line-dasharray':[2,1.3],'line-opacity':0.96}},
  {id:'river',type:'line',source:key,'source-layer':'waterway',paint:{'line-color':'#D1E8E9','line-width':['interpolate',['linear'],['zoom'],11,1.6,15,3.1,18,5.7],'line-opacity':0.92}},
  {id:'buildings',type:'fill',source:key,'source-layer':'building',paint:{'fill-color':'#B7C8CC','fill-opacity':0.88,'fill-outline-color':'#465D6B'}}
 ];
 for(const layer of layers){try{const id='fp-detail-'+layer.id;if(!map.getLayer(id))map.addLayer({...layer,id,layout:{visibility:'none'}},firstSymbol)}catch(err){console.info('原始矢量数据未提供此图层：',layer.id,err?.message)}}
}
function focus(id,move=true){
 const f=focusItems.find(x=>x.id===id)||focusItems[0];activeFocus=f.id;
 q('#fp-map-focus-title').textContent=f.name;q('#fp-map-focus-note').textContent=f.note;
 activeButton(q('#fp-map-focus-buttons'),'focus',id);
 if(map){for(const ff of focusItems){const layer='fp-detail-'+ff.id;if(map.getLayer(layer))map.setLayoutProperty(layer,'visibility',ff.id===id?'visible':'none')}
  if(move)ease({center:[f.lng,f.lat],zoom:f.zoom});
 }
}
async function initMap(){
 if(loading||map||!q('#page-system')||q('#page-system').hidden)return;
 loading=true;state('正在加载真实地图…');
 try{
  const api=await maplibre();
  if(q('#page-system').hidden){loading=false;return}
  map=new api.Map({container:'fp-map-live-layer',style:mapStyle,center:[121.472,31.242],zoom:14.8,
    pitch:0,bearing:0,minZoom:9,maxZoom:19,maxPitch:0,attributionControl:false,
    dragRotate:false,renderWorldCopies:false,cooperativeGestures:false,fadeDuration:180});
  map.touchZoomRotate?.disableRotation();
  let gotTiles=false;
  const markLoaded=()=>{if(gotTiles)return;if(!map?.isStyleLoaded?.()||!map?.areTilesLoaded?.())return;
    gotTiles=true;q('#fp-map-static-fallback').hidden=true;q('#fp-map-live-layer').hidden=false;
    state('实时矢量地图 · 拖动或缩放查看','ready');q('#fp-map-open-product').hidden=true;};
  map.on('style.load',()=>{
    // Same source palette function as the real Footprint Map application.
    try{window.__atlasBlueGrayMap?.applyTo?.(map)}catch(e){console.info('底图原始配色载入失败',e)}
    buildFocusLayers();focus(activeFocus,false);map.resize();
  });
  map.on('zoom',readZoom);map.on('load',markLoaded);map.on('idle',markLoaded);
  map.on('error',e=>console.info('地图瓦片状态：',e.error?.message||'资源请求失败'));
  setTimeout(()=>{if(!gotTiles&&map)showFallback('实时地图暂未加载；仍可查看产品原始界面截图。')},18000);
  readZoom();
 }catch(err){console.info(err);showFallback('地图组件无法加载；保留实际产品截图。')}
 finally{loading=false}
}
function restoreOriginalSpecs(page){
 const old=page.querySelector('.detail-story');if(old)old.remove();
 const disclosure=page.querySelector('.detail-specs-disclosure');
 const layout=page.querySelector('.system-layout'),palette=page.querySelector('.palette');
 if(disclosure&&layout&&palette){disclosure.before(layout,palette);disclosure.remove()}
 if(!layout||!palette)return;
 layout.classList.add('fp-design-spec-layout');palette.classList.add('fp-design-palette');
 const specs=layout.querySelector('.system-specs');
 if(specs&&!specs.querySelector('.fp-spec-additions')){
  const a=make('div','fp-spec-additions');
  a.innerHTML='<div class="spec-row"><strong>20 <small>px</small></strong><span>地点卡片横向内边距</span></div><div class="spec-row"><strong>18 <small>px</small></strong><span>搜索栏头部横向内边距</span></div><div class="spec-row"><strong>21 <small>px</small></strong><span>地点标题文字</span></div><div class="spec-row"><strong>8 <small>px</small></strong><span>编辑控件间距</span></div>';
  const source=specs.querySelector('.source-note');source?source.before(a):specs.append(a);
 }
 const guide=make('section','fp-spacing-guide');guide.setAttribute('aria-label','间距和圆角的实际数值');
 guide.innerHTML=`<div class="fp-mini-caption">间距样本 <span>源自实际组件 CSS · 单位 px</span></div>
 <div class="fp-spacing-examples">${[8,12,16,18,20].map(v=>`<div class="fp-space-unit"><span style="width:${v*2.1}px"></span><small>${v}</small></div>`).join('')}</div>
 <div class="fp-mini-caption fp-corners-label">真实圆角 <span>媒体 14 · 地点卡片 22</span></div>
 <div class="fp-radius-examples"><div class="fp-radius-tile fp-radius-small">14 px</div><div class="fp-radius-tile fp-radius-large">22 px</div></div>`;
 palette.after(guide);
}
function attach(page){
 if(initialized)return;initialized=true;
 const head=page.querySelector('.chapter-head');
 head.querySelector('.kicker').textContent='03 / 05  ·  细节';
 head.querySelector('h2').textContent='细节，有尺度。';
 head.querySelector('p').textContent='从界面尺寸，到地图缩放的视觉层次。';
 restoreOriginalSpecs(page);
 const lab=make('section','fp-map-atelier');lab.setAttribute('aria-label','地图视觉与不同缩放级别');
 lab.innerHTML=`
 <div class="fp-map-atelier-head"><div><span class="fp-mini-kicker">真实地图 · 尺度观察</span><h3>同一张地图，不同的细节。</h3><p>放大、缩小，观察道路、铁路、河流与建筑如何显现。</p></div><span class="fp-map-tech">矢量地图 · 蓝灰主题</span></div>
 <div class="fp-map-studio-layout">
  <div class="fp-map-main">
   <div class="fp-map-live" id="fp-map-live">
     <div id="fp-map-live-layer" aria-label="可缩放的真实地图：查看道路、铁路、河流与建筑"></div>
     <img id="fp-map-static-fallback" src="assets/actual-map.webp" alt="Footprint Map 实际产品地图截图" hidden>
     <div class="fp-map-corner-label">上海 · 苏州河周边 <span id="fp-map-zoom-value">Z 14.8</span></div>
     <div class="fp-map-zoom-actions"><button type="button" id="fp-map-zoom-plus" aria-label="放大地图">＋</button><button type="button" id="fp-map-zoom-minus" aria-label="缩小地图">－</button></div>
   </div>
   <div class="fp-map-scale-header"><span id="fp-map-level-hint">街道 · 轨道、道路与细分街区</span><span id="fp-map-live-status" role="status">正在准备地图…</span></div>
   <div class="fp-map-zoom-presets" id="fp-map-zoom-buttons" role="group" aria-label="切换地图缩放层级"></div>
   <p class="fp-map-credit">与产品相同的 OpenFreeMap 矢量来源及蓝灰配色。<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap 贡献者</a></p>
   <button id="fp-map-open-product" class="fp-fallback-btn" type="button" hidden>查看真实产品地图截图 ↗</button>
  </div>
  <div class="fp-map-side">
    <span class="fp-mini-kicker">观察什么</span><div id="fp-map-focus-buttons" class="fp-focus-switches" role="group" aria-label="地图视觉类型"></div>
    <div class="fp-focus-insight"><strong id="fp-map-focus-title">河流</strong><p id="fp-map-focus-note">水系形态与桥梁交汇，是地图的空间线索。</p><span>实时矢量数据 · 不是图片放大</span></div>
    <div class="fp-map-context"><span class="fp-mini-kicker">地图与交互</span><button class="fp-context-shot" type="button" data-image="assets/phone_02.webp" data-caption="真实产品：星标选中与地点卡片"><img src="assets/phone_02.webp" alt="地图与地点卡片的真实产品截图" loading="lazy"><span>黄星 · 地点卡片 ↗</span></button><button class="fp-context-shot" type="button" data-image="assets/actual-route.webp" data-caption="真实产品：地图路线与气泡"><img src="assets/actual-route.webp" alt="路线连线与气泡的真实产品截图" loading="lazy"><span>路线 · 气泡提示 ↗</span></button></div>
  </div>
 </div>`;
 const spacing=page.querySelector('.fp-spacing-guide')||page.querySelector('.palette');
 spacing?spacing.after(lab):head.after(lab);
 const levelsBox=q('#fp-map-zoom-buttons');levels.forEach(l=>{
  const b=make('button','',l.name);b.type='button';b.dataset.level=String(l.zoom);b.setAttribute('aria-pressed','false');
  b.addEventListener('click',()=>{if(map)ease({zoom:l.zoom});else{state('地图加载后可切换层级','fallback');initMap()}});levelsBox.append(b)
 });
 const focusBox=q('#fp-map-focus-buttons');focusItems.forEach(f=>{
  const b=make('button','',f.name);b.type='button';b.dataset.focus=f.id;b.setAttribute('aria-pressed','false');
  b.addEventListener('click',()=>{focus(f.id);initMap()});focusBox.append(b)
 });
 q('#fp-map-zoom-plus').addEventListener('click',()=>{if(map)ease({zoom:Math.min(19,map.getZoom()+1)});else initMap()});
 q('#fp-map-zoom-minus').addEventListener('click',()=>{if(map)ease({zoom:Math.max(9,map.getZoom()-1)});else initMap()});
 lab.querySelectorAll('.fp-context-shot').forEach(btn=>btn.addEventListener('click',()=>{
  const d=q('#lightbox');if(!d)return;d.querySelector('#lightbox-image').src=btn.dataset.image;d.querySelector('#lightbox-caption').textContent=btn.dataset.caption||'真实产品截图';if(!d.open)d.showModal();
 }));
 const openProduct=q('#fp-map-open-product');openProduct.addEventListener('click',()=>{
  const d=q('#lightbox');if(!d)return;d.querySelector('#lightbox-image').src='assets/actual-map.webp';d.querySelector('#lightbox-caption').textContent='Footprint Map · 实际地图界面';if(!d.open)d.showModal()
 });
 // Do not let chapter-swipe listener steal real map pans and pinch-zooms.
 q('#fp-map-live').addEventListener('touchend',e=>e.stopPropagation(),{passive:true});
 q('#fp-map-live').addEventListener('pointerup',e=>e.stopPropagation());
 focus('river',false);activeButton(levelsBox,'level',14.8);
 const observer=new MutationObserver(()=>{
  if(!page.hidden){if(map){requestAnimationFrame(()=>map.resize())}else initMap()}
 });observer.observe(page,{attributes:true,attributeFilter:['hidden']});
 if(!page.hidden)initMap();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{const p=q('#page-system');if(p)attach(p)},{once:true});
else {const p=q('#page-system');if(p)attach(p)}
})();