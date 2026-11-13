/* Footprint Map → Travel Atlas | build .17 底部 dock 改版, 2026-11-06.
 * 入口迁入底部 dock：路线 icon 侧弹「地图选点 / 收藏点选点」；
 * 规划模式条件条浮在 dock 上方：日期｜起终点｜生成（灰→金）｜退出；
 * 收藏选点走收藏列表：点地点→小卡浮到顶部托盘→托盘右侧 icon 制定路线。
 * Selected places are read-only references; Brief/media never overwritten here. */
(()=>{'use strict';
const DB='private-travel-footprints-v1',HANDOFF='footprint-to-travel-atlas-selection-v1';
const $=id=>document.getElementById(id),make=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=text;return n};
const valid=p=>p&&p.id&&p.starred!==false&&!p.demo&&p.lat!=null&&p.lng!=null&&p.lat!==''&&p.lng!==''&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&Math.abs(+p.lat)<=85.05&&Math.abs(+p.lng)<=180;
const name=p=>String(p.title||p.name||'已收藏地点').slice(0,100);
let records=[],selected=[],condPop,mode='',lastFocus,markerObserver=null,rerender=false,built=false,busy=false;
let navigationEpoch=0; // Discard outdated async route entry operations.
/* 起终点自动跟随选点(默认首站→末站);用户手动改过就不再覆盖——北京→北京这类自选起终点始终允许 */
let autoOD={origin:'',destination:''};
function openDB(name,store){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:'id'});if(name===DB&&!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'})};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('数据库被占用'));r.onsuccess=()=>resolve(r.result)})}
async function recordsFrom(dbName,store){const db=await openDB(dbName,store);return new Promise((resolve,reject)=>{let req;try{req=db.transaction(store,'readonly').objectStore(store).getAll()}catch(e){db.close();reject(e);return}req.onsuccess=()=>{db.close();resolve(req.result||[])};req.onerror=()=>{db.close();reject(req.error)}})}
async function readPlaces(){try{return (await recordsFrom(DB,'places')).filter(valid)}catch(e){let l=[];try{l=JSON.parse(localStorage.getItem('travel-places')||'[]')}catch{}if(!Array.isArray(l))throw e;return l.filter(valid)}}
let sayTimer=0;function say(v){const t=$('toast');if(!t)return;t.textContent=v;t.classList.add('visible');clearTimeout(sayTimer);sayTimer=setTimeout(()=>t.classList.remove('visible'),3000)}
function build(){if(built)return;built=true;
 /* 条件弹卡（保留）：日期/起终点 */
 condPop=make('div','route-bar-pop');condPop.id='routeBarPop';condPop.hidden=true;condPop.setAttribute('role','dialog');condPop.setAttribute('aria-label','旅行条件');
 condPop.innerHTML='<div class="sheet-grab" aria-hidden="true"></div><div class="rb-pop-head"><strong id="routeBarPopTitle">旅行条件</strong><button id="routeBarPopClose" type="button" aria-label="关闭">×</button></div><div class="rb-pop-grid"><label>出发日期<input id="routeFromDate" type="date"></label><label>结束日期<input id="routeToDate" type="date"></label><label>出发地<input id="routeOrigin" maxlength="80" placeholder="例如：上海"></label><label>到达地<input id="routeDestination" maxlength="80" placeholder="例如：杭州"></label></div><div class="rb-od-quick" id="routeOdQuick"><button type="button" data-od="loop">往返我的位置</button><button type="button" data-od="ends">用选点首末</button></div>';
 document.body.append(condPop);$('routeBarPopClose').onclick=()=>{condPop.hidden=true};
 /* build .22 · 下滑关闭手势加 26px 死区（与抽屉一致）：捏抓手立即跟手，内容区下拉先越过死区才接管 */
 (function(){let sy=0,dy=0,on=false,engaged=false;condPop.addEventListener('touchstart',e=>{sy=e.touches[0].clientY;dy=0;on=true;engaged=!!e.target.closest('.sheet-grab,.rb-pop-head')},{passive:true});condPop.addEventListener('touchmove',e=>{if(!on)return;const raw=e.touches[0].clientY-sy;if(!engaged){if(raw<26)return;engaged=true;sy=e.touches[0].clientY}dy=e.touches[0].clientY-sy;if(dy<=0){dy=0;return}if(dy>8)e.preventDefault();condPop.style.animation='none';condPop.style.transition='none';condPop.style.transform='translateX(-50%) translateY('+Math.round(dy)+'px)'},{passive:false});const end=()=>{if(!on)return;on=false;engaged=false;condPop.style.animation='';condPop.style.transition='';condPop.style.transform='';if(dy>Math.min(120,condPop.offsetHeight*0.3))condPop.hidden=true;dy=0};condPop.addEventListener('touchend',end,{passive:true});condPop.addEventListener('touchcancel',end,{passive:true})})();
 /* 起终点快捷填充：闭环（我的城市往返）或首末选点；点过后视为用户选择，不再被自动覆盖 */
 $('routeOdQuick').addEventListener('click',e=>{const b=e.target.closest('button[data-od]');if(!b)return;const o=$('routeOrigin'),d=$('routeDestination');if(b.dataset.od==='loop'){homePlace().then(c=>{const v=c||'我的位置';o.value=v;d.value=v;autoOD={origin:o.value,destination:d.value};syncBar()})}else{const sorted=sortedIds(selected);const first=records.find(r=>String(r.id)===sorted[0]),last=records.find(r=>String(r.id)===sorted[sorted.length-1]);o.value=first?name(first):'';d.value=last?name(last):'';autoOD={origin:o.value,destination:d.value};syncBar()}});
 for(const cid of ['routeFromDate','routeToDate','routeOrigin','routeDestination'])$(cid).addEventListener('input',()=>{$(cid).classList.remove('field-missing');syncBar()});
 /* 规划条（dock 上方）：日期｜起终点｜生成｜退出 */
 const bar=make('div','tp-bar');bar.id='tpBar';bar.hidden=true;bar.setAttribute('role','dialog');bar.setAttribute('aria-label','路线规划条件');
 bar.innerHTML='<button type="button" class="tp-pill" id="tpDates" aria-label="设置旅行日期"><small id="tpDatesTxt">日期</small></button><button type="button" class="tp-pill" id="tpOD" aria-label="设置起点与终点"><small id="tpODTxt">起终点</small></button><button type="button" class="tp-pill tp-count" id="tpCount" aria-label="已选地点，点按查看候选列表"><small id="tpCountTxt">★0</small></button><button type="button" class="tp-go" id="tpGo" aria-label="生成路线" title="生成路线"><img src="./icons/40_direction.svg" alt="" aria-hidden="true"></button><button type="button" class="tp-x" id="tpX" aria-label="退出选点规划" title="退出选点规划"><img src="./icons/19_close.svg" alt="" aria-hidden="true"></button>';
 document.body.append(bar);
 $('tpDates').onclick=()=>openCond('dates');$('tpOD').onclick=()=>openCond('od');
 /* build .22 · 录屏批注「我到底选了几个点」：★n 常驻计数，点按=候选列表入口 */
 $('tpCount').onclick=()=>{
   if(mode==='map'){document.getElementById('btnStars')?.click();requestAnimationFrame(()=>{$('drawer')?.scrollTo?.({top:0,behavior:'smooth'})})}
   else{const t=$('favTray');if(t&&!t.hidden)$('drawer')?.scrollTo?.({top:0,behavior:'smooth'});else say('还没有选点：点列表行或地图星标加入')}
 };
 $('tpGo').onclick=e=>{e.preventDefault();proceed()};
 $('tpX').onclick=e=>{e.preventDefault();exit()};
 /* dock 搜索 ↗ 在规划模式下仍可作为「生成」的备用入口 */
 const form=$('searchForm');
 if(form){
   form.addEventListener('submit',e=>{if(document.body.classList.contains('route-pick-active')){e.preventDefault();e.stopImmediatePropagation();proceed()}},true);
   form.querySelector('.dock-go')?.addEventListener('click',e=>{if(document.body.classList.contains('route-pick-active')){e.preventDefault();e.stopImmediatePropagation();proceed()}},true);
 }
 /* build .22 · 用户批注「保存路线和保存点只允许在一个框内完成点击-下拉列表-选择的动作」：
    已保存的路线卡 + 地点列表合并为一个保存框——点按展开下拉，选「保存的地点/保存的路线」切换抽屉内容。 */
 initSaveBox();
 const journey=$('atlasJourneyEntry');
 if(journey)journey.addEventListener('click',e=>{e.preventDefault();window.__atlasRoutesEntry?.openFromMenu?.()});
 /* 收藏列表：选点托盘（小卡 + 制定路线 icon） */
 const favor=$('drawer');
 if(favor&&!$('favTray')){
   const tray=make('div','fav-tray');tray.id='favTray';tray.hidden=true;tray.setAttribute('aria-label','已选择的路线地点');
   /* build .22 · 图7批注「★候选★」：候选区独立成段，标题常驻计数 */
   tray.innerHTML='<div class="fav-tray-head" id="favTrayHead">★候选 · 0处</div><div id="favTrayCards" class="fav-tray-cards"></div>';
   const desc=favor.querySelector('.list-desc');favor.insertBefore(tray,desc||null);
   const list=$('spotList');
   if(list)list.addEventListener('click',e=>{
     // 只在「收藏点选点」规划模式下拦截：此时点行 = 加入/移出路线。
     // 普通查看模式下必须放行，让行自己的处理器关抽屉并打开地点卡片。
     if(mode!=='fav'&&mode!=='map')return;
     const row=e.target.closest?.('.spotrow');if(!row||!row.dataset.placeId)return;
     e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
     toggle(row.dataset.placeId);
   },true);
   new MutationObserver(()=>{if(favor.classList.contains('visible')){load().then(()=>{syncRows();renderTray();refreshSaveBoxCounts()}).catch(()=>{})}placeBar()}).observe(favor,{attributes:true,attributeFilter:['class']});
 }
 document.addEventListener('click',captureMapStar,true);document.addEventListener('keydown',captureKeyboardStar,true);
}
async function load(){records=(await readPlaces()).sort((a,b)=>name(a).localeCompare(name(b),'zh-CN'));selected=selected.filter(id=>records.some(p=>String(p.id)===id));return records.length}
/* build .22 · 保存框：一个框内「点击→下拉列表→选择」，在保存的地点/保存的路线之间切换抽屉内容 */
let drawerView='places';
function initSaveBox(){
 const box=$('drawerSaveBox');if(!box)return;
 const main=$('saveBoxMain'),menu=$('saveBoxMenu');
 main.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const open=menu.hidden;menu.hidden=!open;main.setAttribute('aria-expanded',String(open));if(open)refreshSaveBoxCounts()});
 document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!e.target.closest('#drawerSaveBox')){menu.hidden=true;main.setAttribute('aria-expanded','false')}},true);
 menu.addEventListener('click',e=>{const b=e.target.closest('button[data-view]');if(!b)return;e.preventDefault();e.stopPropagation();menu.hidden=true;main.setAttribute('aria-expanded','false');setDrawerView(b.dataset.view)});
 refreshSaveBoxCounts();
}
async function refreshSaveBoxCounts(){const p=$('saveBoxPlacesN');if(p)p.textContent=records.length?' · '+records.length:'';const r=$('saveBoxRoutesN');try{const plans=await window.__atlasRoutesEntry?.list?.()||[];if(r)r.textContent=plans.length?' · '+plans.length:''}catch(e){}}
async function setDrawerView(v){
 drawerView=v;const label=$('saveBoxLabel'),list=$('spotList'),routes=$('drawerRouteList'),desc=document.querySelector('#drawer .list-desc'),backup=document.querySelector('#drawer .backuprow');
 if(v==='routes'){
   label.textContent='保存的路线';list.hidden=true;routes.hidden=false;if(desc)desc.hidden=true;
   routes.replaceChildren();
   const plans=await window.__atlasRoutesEntry?.list?.()||[];
   if(!plans.length){const d=make('div','savebox-empty','还没有保存的路线。点底部「路线」，从收藏挑选或在地图点选开始规划。');routes.append(d)}
   for(const p of plans){const a=document.createElement('a');a.className='rs-row';a.href='./route-view.html?saved='+encodeURIComponent(p.id);
     const n=Array.isArray(p.placeIds)?p.placeIds.length:(Array.isArray(p.selected)?p.selected.length:(Array.isArray(p.stops)?p.stops.length:0));
     const days=p.startDate?(p.startDate+(p.endDate&&p.endDate!==p.startDate?' → '+p.endDate:'')):'未标日期';
     a.innerHTML='<span class="rs-badge">☆</span><span class="rs-meta"><b></b><span></span></span><span class="rs-go">›</span>';
     a.querySelector('b').textContent=p.title;a.querySelector('.rs-meta span').textContent=n+' 个收藏点 · '+days;routes.append(a)}
 }else{
   label.textContent='保存的地点';list.hidden=false;routes.hidden=true;if(desc)desc.hidden=false;
 }
}
async function start(next){const epoch=++navigationEpoch;build();lastFocus=document.activeElement;try{await load()}catch(e){if(epoch===navigationEpoch)say('无法读取收藏：'+e.message);return}if(epoch!==navigationEpoch)return;if(!records.length){say('还没有可选的已定位收藏地点');return}if(next==='map')showMap();else if(next==='fav')showFav()}
function toggle(id){id=String(id);if(!records.some(p=>String(p.id)===id)){return}const at=selected.indexOf(id);if(at>=0)selected.splice(at,1);else if(selected.length<100)selected.push(id);else {say('每次旅行最多选择 100 处地点');return}updateAll()}
/* 托盘按顺路顺序展示（与生成后的路线一致），编号只出现在这里=真实游览顺序 */
function renderTray(){const tray=$('favTray'),box=$('favTrayCards'),head=$('favTrayHead');if(!tray||!box)return;box.replaceChildren();tray.hidden=!selected.length;if(head)head.textContent='★候选 · '+selected.length+'处';for(const [i,id] of sortedIds(selected).entries()){const p=records.find(r=>String(r.id)===id);if(!p)continue;const c=make('span','fav-tray-card');c.innerHTML='<img src="./icons/03_star.svg" alt="" aria-hidden="true"><b></b><i aria-hidden="true">'+(i+1)+'</i>';c.querySelector('b').textContent=name(p);const x=make('button','fav-tray-x','×');x.type='button';x.setAttribute('aria-label','移除 '+name(p));x.onclick=ev=>{ev.stopPropagation();toggle(id)};c.append(x);box.append(c)}syncBar()}
/* build .22 · 图6批注「把下面的dock给我放到上面」：收藏选点时规划条收进抽屉、吸附在额头之下；
   地图点选或抽屉关闭时回到底部悬浮位。 */
function placeBar(){
 const bar=$('tpBar');if(!bar||bar.hidden)return;
 const drawer=$('drawer');
 const docked=!!mode&&!!drawer?.classList.contains('visible');
 if(docked&&bar.parentElement!==drawer){drawer.querySelector('.drawer-head')?.after(bar);bar.classList.add('tp-docked')}
 if(docked){bar.style.top='auto'}
 else bar.style.top='';
 if(!docked&&bar.parentElement!==document.body){document.body.append(bar);bar.classList.remove('tp-docked')}
}
function syncRows(){const want=new Set(selected);for(const row of document.querySelectorAll('#spotList .spotrow[data-place-id]'))row.classList.toggle('tp-sel',want.has(String(row.dataset.placeId)))}
/* build .20 · 用户批注：选点阶段不再打编号——编号意味着顺序，而用户点选时往往还没有顺序意图。
   顺序在生成时由最近邻算法自动排好（路线视图里仍可拖拽调整）。 */
function updateMapPins(){if(mode!=='map')return;for(const pin of document.querySelectorAll('.atlas-bookmark-hit[data-place-id],.star-pin[data-place-id]')){const id=String(pin.dataset.placeId),chosen=selected.includes(id);pin.classList.add('route-pick-candidate');pin.classList.toggle('route-pick-chosen',chosen);pin.setAttribute('aria-pressed',String(chosen));delete pin.dataset.tripOrder}}
/* 无 AI 的顺路排序：以锚点（当前位置/首个选点）出发做贪心最近邻，得到符合直觉的游览顺序 */
function anchorCoords(){try{const u=window.__atlasUserCoords?.();if(u&&Number.isFinite(+u.lat)&&Number.isFinite(+u.lng))return[+u.lat,+u.lng]}catch(e){}const first=records.find(r=>String(r.id)===selected[0]);return first?[+first.lat,+first.lng]:null}
function sortedIds(ids){const pool=ids.map(id=>records.find(r=>String(r.id)===id)).filter(Boolean);let cur=anchorCoords();const out=[];while(pool.length){let bi=0,bd=Infinity;for(let i=0;i<pool.length;i++){const d=cur?(+pool[i].lat-cur[0])**2+(+pool[i].lng-cur[1])**2:i;if(d<bd){bd=d;bi=i}}const next=pool.splice(bi,1)[0];out.push(String(next.id));cur=[+next.lat,+next.lng]}return out}
function observePins(){if(markerObserver)return;markerObserver=new MutationObserver(()=>{if(rerender)return;rerender=true;requestAnimationFrame(()=>{rerender=false;updateMapPins()})});for(const el of ['atlasBookmarkOverlay','map','atlasVectorMap']){const node=$(el);if(node)markerObserver.observe(node,{childList:true,subtree:true})}updateMapPins()}
function clearPins(){markerObserver?.disconnect();markerObserver=null;rerender=false;for(const pin of document.querySelectorAll('.route-pick-candidate,.route-pick-chosen')){pin.classList.remove('route-pick-candidate','route-pick-chosen');pin.removeAttribute('aria-pressed');delete pin.dataset.tripOrder}}
function updateAll(){renderTray();syncRows();updateMapPins();autoFillOD();document.dispatchEvent(new CustomEvent('atlas:route-selection-changed',{detail:{placeIds:selected.slice()}}))}
/* build .20 · 起终点组织逻辑（用户批注）：默认「从我的城市出发再回到我的城市」闭环——
   人在上海、选点在浙江，起终点就应该是 上海→上海；查不到所在城市时退化为首末选点。 */
/* build .22 · 图8批注「我的位置精确到点」：逆地理从 zoom=10（城市/区级，会得到「嘉定区→嘉定区」这种无效起终点）
   升到 zoom=18（道路/小区/POI 级），起终点闭环默认精确到当前所在的点名。 */
let homeCityCache,homePlaceCache;
function homeCity(){if(homeCityCache!==undefined)return Promise.resolve(homeCityCache);homeCityCache='';try{homeCityCache=localStorage.getItem('atlas-home-city')||''}catch(e){}
  if(homeCityCache)return Promise.resolve(homeCityCache);
  const u=window.__atlasUserCoords?.();if(!u||!Number.isFinite(+u.lat))return Promise.resolve('');
  return fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=zh-CN&lat='+(+u.lat)+'&lon='+(+u.lng))
    .then(r=>r.ok?r.json():null).then(j=>{const a=j?.address||{};const city=a.city||a.town||a.county||a.state||'';homeCityCache=String(city).replace(/市$/,'');try{if(homeCityCache)localStorage.setItem('atlas-home-city',homeCityCache)}catch(e){}return homeCityCache})
    .catch(()=>{homeCityCache='';return ''})}
function homePlace(){if(homePlaceCache!==undefined)return Promise.resolve(homePlaceCache);homePlaceCache='';try{homePlaceCache=localStorage.getItem('atlas-home-place')||''}catch(e){}
  if(homePlaceCache)return Promise.resolve(homePlaceCache);
  const u=window.__atlasUserCoords?.();if(!u||!Number.isFinite(+u.lat))return Promise.resolve(homeCity());
  return fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=zh-CN&lat='+(+u.lat)+'&lon='+(+u.lng))
    .then(r=>r.ok?r.json():null).then(async j=>{
      const a=j?.address||{};
      /* 精确到点：POI/楼名 > 路名+小区 > 村镇 > 城市 */
      let place=String(j?.name||'').trim();
      if(!place||place===a.city||place===a.county){
        const road=a.road||a.pedestrian||a.footway||'';
        const near=a.neighbourhood||a.quarter||a.suburb||a.residential||a.village||a.town||'';
        place=[road,near].filter(Boolean).join('·')||near||'';
      }
      if(!place)place=await homeCity();
      homePlaceCache=String(place||'').slice(0,40);
      try{if(homePlaceCache)localStorage.setItem('atlas-home-place',homePlaceCache)}catch(e){}
      return homePlaceCache})
    .catch(async()=>{homePlaceCache=await homeCity();return homePlaceCache})}
function odDefaults(){const sorted=sortedIds(selected);const first=records.find(r=>String(r.id)===sorted[0]),last=records.find(r=>String(r.id)===sorted[sorted.length-1]);const fo=first?name(first):'',fd=last?name(last):'';
  const place=homePlaceCache||'';
  if(place)return{origin:place,destination:place};      /* 闭环：我的位置（精确到点）→ 我的位置 */
  return{origin:fo,destination:fd}}
function autoFillOD(){const o=$('routeOrigin'),d=$('routeDestination');if(!o||!d)return;
  const apply=v=>{if(!o.value.trim()||o.value===autoOD.origin)o.value=v.origin;if(!d.value.trim()||d.value===autoOD.destination)d.value=v.destination;autoOD={origin:o.value,destination:d.value};syncBar()};
  if(homePlaceCache===undefined)homePlace().then(()=>{if(mode)autoFillOD()});
  apply(odDefaults())}
function captureMapStar(e){if(mode!=='map')return;const pin=e.target.closest?.('.atlas-bookmark-hit[data-place-id],.star-pin[data-place-id]');if(!pin)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toggle(String(pin.dataset.placeId))}
function captureKeyboardStar(e){if(e.key==='Escape'&&mode==='map'){exit();return}if(mode!=='map'||!['Enter',' '].includes(e.key))return;const pin=e.target.closest?.('.atlas-bookmark-hit[data-place-id],.star-pin[data-place-id]');if(pin){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toggle(String(pin.dataset.placeId))}}
function showMap(){if(mode==='fav'&&$('drawer')?.classList.contains('visible'))$('closeDrawer')?.click();mode='map';window.__atlasTripPicking=true;document.body.classList.add('route-pick-active');window.__atlasClosePlace?.();const bar=$('tpBar');if(bar)bar.hidden=false;window.__atlasRefreshPins?.();observePins();updateAll();homePlace();say('点地图上的星标加入路线，规划条上的 ★ 会实时显示已选数量')}
function showFav(){if(mode==='map')clearPins();mode='fav';window.__atlasTripPicking=false;document.body.classList.add('route-pick-active');window.__atlasClosePlace?.();const bar=$('tpBar');if(bar)bar.hidden=false;updateAll();document.getElementById('btnStars')?.click();requestAnimationFrame(placeBar);homePlace();say('在收藏列表点选地点加入路线，规划条上的 ★ 会实时显示已选数量')}
function stopMap(){if(mode==='map'){clearPins();window.__atlasRefreshPins?.()}mode='';window.__atlasTripPicking=false;document.body.classList.remove('route-pick-active');const bar=$('tpBar');if(bar){bar.hidden=true;bar.classList.remove('tp-docked');if(bar.parentElement!==document.body)document.body.append(bar)}syncBar()}
function exit(){++navigationEpoch;if(condPop)condPop.hidden=true;if($('drawer')?.classList.contains('visible'))$('closeDrawer')?.click();stopMap();selected=[];updateAll();window.__atlasDock?.closePop?.();lastFocus?.focus?.({preventScroll:true})}
function proceed(){build();if(!selected.length){say('先在地图上点星，或到收藏列表选择地点');return}const values=sortedIds(selected.filter(id=>records.some(r=>String(r.id)===id)));if(values.length!==selected.length){say('部分地点已不存在，请重新选择。');return}const cond=[['routeFromDate','出发日期'],['routeToDate','结束日期'],['routeOrigin','出发地'],['routeDestination','目的地']];for(const [id] of cond)$(id).classList.toggle('field-missing',!$(id).value.trim());const missing=cond.filter(([id])=>!$(id).value.trim());const from=$('routeFromDate').value,to=$('routeToDate').value;if(missing.length){say('请先补全规划先决条件：'+missing.map(m=>m[1]).join('、'));openCond(missing[0][0]==='routeOrigin'||missing[0][0]==='routeDestination'?'od':'dates');setTimeout(()=>$(missing[0][0]).focus({preventScroll:true}),240);return}if(to<from){say('结束日期不能早于出发日期');$('routeFromDate').classList.add('field-missing');$('routeToDate').classList.add('field-missing');openCond('dates');return}const payload={schema:HANDOFF,placeIds:values,createdAt:Date.now(),startDate:from,endDate:to,origin:$('routeOrigin').value.trim().slice(0,80),destination:$('routeDestination').value.trim().slice(0,80),mode:'view',version:3};try{sessionStorage.setItem(HANDOFF,JSON.stringify(payload));window.__atlasSaveMapView?.();stopMap();location.assign('./route-view.html?from=footprint')}catch(e){say('无法传递路线：'+e.message)}}
function syncBar(){const from=$('routeFromDate')?.value||'',to=$('routeToDate')?.value||'',og=($('routeOrigin')?.value||'').trim(),dt=($('routeDestination')?.value||'').trim();const d=$('tpDatesTxt');if(d)d.textContent=from&&to?(from.slice(5).replace('-','.')+'–'+to.slice(5).replace('-','.')):from?(from.slice(5).replace('-','.')+'–…'):'日期';const o=$('tpODTxt');if(o)o.textContent=og&&dt?(og+'→'+dt):og||dt||'起终点';const c=$('tpCountTxt');if(c)c.textContent='★'+selected.length;$('tpCount')?.classList.toggle('has',selected.length>0);const ready=selected.length>0&&!!from&&!!to&&!!og&&!!dt;const go=document.querySelector('#searchForm .dock-go');if(go)go.classList.toggle('ready',ready);$('tpGo')?.classList.toggle('ready',ready);placeBar()}
function openCond(which){build();condPop.hidden=false;const t=$('routeBarPopTitle');if(t)t.textContent=which==='od'?'起点与终点':'旅行日期';const f=which==='od'?'routeOrigin':'routeFromDate';setTimeout(()=>$(f)?.focus({preventScroll:true}),160)}
function init(){build();window.__atlasTripPicking=false;window.__atlasTripPicker={open:()=>start('map'),enterMapMode:()=>start('map'),pickFromFavs:()=>start('fav'),selected:()=>selected.slice(),records:()=>records.slice(),toggle:id=>toggle(String(id)),cancel:exit,showLibrary:()=>window.__atlasRoutesEntry?.openFromMenu?.()}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
