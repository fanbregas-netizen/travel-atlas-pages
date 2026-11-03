/* Footprint Map → Travel Atlas | verified product interaction, 2026-11-03.
 * Route click reveals exactly two small actions; ☆ manages personal collections.
 * Selected places are read-only references; Brief/media never overwritten here. */
(()=>{'use strict';
const DB='private-travel-footprints-v1',TRIPS='travel-atlas-journeys-v1',HANDOFF='footprint-to-travel-atlas-selection-v1';
const $=id=>document.getElementById(id),make=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=text;return n};
const valid=p=>p&&p.id&&p.starred!==false&&!p.demo&&p.lat!=null&&p.lng!=null&&p.lat!==''&&p.lng!==''&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&Math.abs(+p.lat)<=90&&Math.abs(+p.lng)<=180;
const name=p=>String(p.title||p.name||'已收藏地点').slice(0,100);
let records=[],selected=[],menu,searchSheet,mapStrip,library,mode='',lastFocus,searchTerm='',renderLimit=60,markerObserver=null,rerender=false,libraryItems=[],busy=false;
const stopDays=new Map();
function tripDayCount(){
 const start=$('routeFromDate')?.value,end=$('routeToDate')?.value;
 if(!start||!end||end<start)return 1;
 const a=Date.parse(start+'T12:00:00Z'),b=Date.parse(end+'T12:00:00Z');
 return Number.isFinite(a)&&Number.isFinite(b)?Math.max(1,Math.min(60,Math.round((b-a)/86400000)+1)):1;
}
function moveStop(id,by){
 const at=selected.indexOf(id),to=at+by;
 if(at<0||to<0||to>=selected.length)return false;
 [selected[at],selected[to]]=[selected[to],selected[at]];
 updateAll();return true;
}
function balancedDays(){
 if(!selected.length)return;
 const days=tripDayCount();
 if(days===1){labelStatus('请先设置开始和结束日期，才能分配 D1、D2…');return}
 selected.forEach((id,i)=>stopDays.set(id,Math.min(days,Math.floor(i*days/selected.length)+1)));
 updateAll();labelStatus('已按当前站点顺序均分 D1—D'+days+'。仅是日程草案，不代表实际道路时间。');
}
function setStopDay(id,day){if(!selected.includes(id))return;stopDays.set(id,Math.max(1,Math.min(tripDayCount(),Number(day)||1)));updateAll()}

function openDB(name,store){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(store))db.createObjectStore(store,{keyPath:store==='places'?'id':'id'});if(name===DB&&!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'})};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('数据库被占用'));r.onsuccess=()=>resolve(r.result)})}
async function recordsFrom(dbName,store){const db=await openDB(dbName,store);return new Promise((resolve,reject)=>{let req;try{req=db.transaction(store,'readonly').objectStore(store).getAll()}catch(e){db.close();reject(e);return}req.onsuccess=()=>{db.close();resolve(req.result||[])};req.onerror=()=>{db.close();reject(req.error)}})}
async function readPlaces(){try{return (await recordsFrom(DB,'places')).filter(valid)}catch(e){let l=[];try{l=JSON.parse(localStorage.getItem('travel-places')||'[]')}catch{}if(!Array.isArray(l))throw e;return l.filter(valid)}}
function labelStatus(v){const label=$('routeSearchStatus');if(label)label.textContent=v;const map=$('routeMapStatus');if(map)map.textContent=v}
function titleClass(n){return n>0?'ready':''}
function build(){if(menu)return;
 menu=make('nav','route-mini-actions');menu.id='routeMiniActions';menu.setAttribute('aria-label','选择路线选点方式');menu.hidden=true;
 menu.innerHTML='<button id="routeMapAction" class="route-mini-action" type="button" aria-label="地图选点" title="地图选点"><span aria-hidden="true">⌖</span><small>地图选点</small></button><button id="routeSearchAction" class="route-mini-action" type="button" aria-label="搜索已收藏地点" title="搜索已收藏地点"><span aria-hidden="true">⌕</span><small>搜索收藏</small></button>';
 document.body.append(menu);$('routeMapAction').onclick=()=>start('map');$('routeSearchAction').onclick=()=>start('list');
 mapStrip=make('section','route-map-strip');mapStrip.id='routeMapStrip';mapStrip.hidden=true;mapStrip.setAttribute('aria-label','地图选点操作');
 mapStrip.innerHTML='<button id="routeMapClose" type="button" aria-label="结束地图选点">×</button><span class="route-map-count"><strong id="routeMapCount">0</strong> 处已选</span><button id="routeMapToList" type="button" aria-label="切换到搜索收藏地点">⌕ 列表</button><button id="routeMapContinue" class="route-map-primary" type="button" disabled>查看路线 ↗</button>';
 document.body.append(mapStrip);$('routeMapClose').onclick=()=>exit();$('routeMapToList').onclick=()=>start('list');$('routeMapContinue').onclick=proceed;
 searchSheet=make('dialog','route-search-sheet');searchSheet.id='routeSearchSheet';searchSheet.setAttribute('aria-label','搜索已收藏地点');
 searchSheet.innerHTML=`<div class="route-search-head"><span class="route-handle" aria-hidden="true"></span><div class="route-search-head-row"><div><small>FOOTPRINT MAP · ROUTE</small><h2>选择收藏地点</h2></div><button id="routeSearchClose" type="button" aria-label="关闭">×</button></div><div class="route-search-bar"><span aria-hidden="true">⌕</span><input id="routeSearchQuery" type="search" autocomplete="off" inputmode="search" placeholder="搜索已收藏地点、城市、Brief…" aria-label="搜索已收藏地点"></div><div id="routeSearchStatus" class="route-search-status" role="status"></div></div><div id="routeSearchList" class="route-search-list" role="list"></div><div class="route-search-selected"><span id="routeSelectedCount">0 处已选</span><div id="routeSelectedChips" class="route-selected-chips"></div></div><details class="route-condition"><summary>旅行条件 <small>出发 / 结束日期与起终点（可选）</small></summary><div class="route-condition-grid"><label>出发日期<input id="routeFromDate" type="date"></label><label>结束日期<input id="routeToDate" type="date"></label><label>出发地<input id="routeOrigin" maxlength="80" placeholder="例如：上海"></label><label>到达地<input id="routeDestination" maxlength="80" placeholder="例如：杭州"></label></div></details><div class="route-search-foot"><button id="routeSearchMap" type="button">⌖ 地图选点</button><button id="routeSearchContinue" type="button" disabled>查看路线 ↗</button></div>`;
 document.body.append(searchSheet);$('routeSearchClose').onclick=()=>exit();$('routeSearchMap').onclick=()=>start('map');$('routeSearchContinue').onclick=proceed;
 $('routeSearchQuery').addEventListener('input',e=>{searchTerm=e.target.value.toLocaleLowerCase().trim();renderLimit=60;renderList()});
 for(const key of ['routeFromDate','routeToDate'])$(key).addEventListener('change',()=>updateAll());
 searchSheet.addEventListener('cancel',e=>{e.preventDefault();exit()});
 document.addEventListener('click',captureMapStar,true);document.addEventListener('keydown',captureKeyboardStar,true);
 document.addEventListener('click',e=>{if(menu.hidden)return;if(e.target.closest?.('#routeMiniActions,#atlasJourneyEntry'))return;menu.hidden=true},true);
 const favor=$('drawer');if(favor){const head=favor.querySelector('.drawer-head');if(head&&!head.querySelector('#savedTripEntry')){const btn=make('button','route-library-entry','⌁ 我的路线');btn.type='button';btn.id='savedTripEntry';btn.setAttribute('aria-label','打开我保存的旅行路线');btn.onclick=showLibrary;head.insertBefore(btn,head.querySelector('button')||null)}}
 library=make('dialog','route-library');library.id='savedRouteLibrary';library.setAttribute('aria-label','我保存的旅行路线');library.innerHTML='<header><div><small>MY TRAVEL ATLAS</small><h2>我的路线</h2></div><button id="routeLibraryClose" type="button" aria-label="关闭">×</button></header><div id="routeLibraryItems" class="route-library-items" aria-live="polite"></div><footer>路线顺序和日期保持保存状态；地点的 Brief、照片、视频与链接始终读取主页最新内容。</footer>';document.body.append(library);$('routeLibraryClose').onclick=()=>library.close();
}
function toggleMenu(e){e?.preventDefault();build();if(mode==='map'){start('list');return}if(searchSheet.open){searchSheet.close();}lastFocus=document.activeElement;const a=$('atlasJourneyEntry'),r=a.getBoundingClientRect();menu.style.right=Math.max(15,innerWidth-r.left+6)+'px';menu.style.top=Math.max(70,r.top-66)+'px';menu.hidden=!menu.hidden;if(!menu.hidden)$('routeMapAction').focus({preventScroll:true})}
async function load(){records=(await readPlaces()).sort((a,b)=>name(a).localeCompare(name(b),'zh-CN'));selected=selected.filter(id=>records.some(p=>String(p.id)===id));for(const id of stopDays.keys())if(!selected.includes(id))stopDays.delete(id);return records.length}
async function start(next){build();menu.hidden=true;try{await load()}catch(e){labelStatus('无法读取收藏：'+e.message);return}if(!records.length){labelStatus('还没有可选的已定位收藏地点');if(next==='list')showList();return}if(next==='map')showMap();else showList()}
function toggle(id){if(!records.some(p=>String(p.id)===id))return;const at=selected.indexOf(id);if(at>=0){selected.splice(at,1);stopDays.delete(id)}else if(selected.length<100){selected.push(id);stopDays.set(id,1)}else {labelStatus('每次旅行最多选择 100 处地点');return}updateAll()}
function renderList(){if(!searchSheet)return;const list=$('routeSearchList');list.replaceChildren();const filtered=records.filter(p=>(name(p)+' '+String(p.address||'')+' '+String(p.note||p.brief||'')).toLocaleLowerCase().includes(searchTerm));for(const p of filtered.slice(0,renderLimit)){const id=String(p.id),chosen=selected.includes(id),row=make('div','route-result '+(chosen?'is-added':''));row.setAttribute('role','listitem');const info=make('div','route-result-info');info.append(make('strong','',name(p)),make('small','',String(p.address||p.note||'已定位的收藏地点').slice(0,92)));const add=make('button','route-result-add',chosen?'✓ 已添加':'+ 添加');add.type='button';add.setAttribute('aria-label',(chosen?'移除 ':'添加 ')+name(p));add.setAttribute('aria-pressed',String(chosen));add.onclick=()=>toggle(id);row.append(info,add);list.append(row)}if(!filtered.length)list.append(make('p','route-empty','没有找到匹配地点，换个关键词试试。'));if(filtered.length>renderLimit){const b=make('button','route-load-more','加载更多地点');b.type='button';b.onclick=()=>{renderLimit+=60;renderList()};list.append(b)}labelStatus(`找到 ${filtered.length} 处收藏 · 点击「＋ 添加」加入本次路线`)}
function renderChips(){
 const panel=$('routeSelectedChips');panel.replaceChildren();
 const days=tripDayCount();
 for(const [i,id] of selected.entries()){
  const p=records.find(r=>String(r.id)===id);if(!p)continue;
  const row=make('div','route-selected-row');row.dataset.placeId=id;
  row.append(make('span','route-selected-index',String(i+1)),make('span','route-selected-name',name(p)));
  for(const [step,icon,label] of [[-1,'↑','向前移动'],[1,'↓','向后移动']]){
   const b=make('button','route-order-button',icon);b.type='button';b.disabled=i+step<0||i+step>=selected.length;
   b.setAttribute('aria-label',label+' '+name(p));b.onclick=()=>moveStop(id,step);row.append(b)
  }
  const day=make('select','route-day-select');day.setAttribute('aria-label',name(p)+' 行程日');
  for(let d=1;d<=days;d++)day.add(new Option('D'+d,String(d)));
  day.value=String(Math.max(1,Math.min(days,stopDays.get(id)||1)));
  day.onchange=()=>setStopDay(id,day.value);row.append(day);
  const remove=make('button','route-remove-button','×');remove.type='button';remove.setAttribute('aria-label','移除 '+name(p));remove.onclick=()=>toggle(id);row.append(remove);
  panel.append(row);
 }
 if(selected.length>1&&days>1){
  const distribute=make('button','route-even-days','按顺序均分 D1—D'+days);distribute.type='button';
  distribute.onclick=balancedDays;panel.append(distribute)
 }
 $('routeSelectedCount').textContent=selected.length+' 处已选 · 按列表顺序规划';
}
function updateMapPins(){if(mode!=='map')return;for(const pin of document.querySelectorAll('.atlas-bookmark-hit[data-place-id],.star-pin[data-place-id]')){const id=String(pin.dataset.placeId),number=selected.indexOf(id);pin.classList.add('route-pick-candidate');pin.classList.toggle('route-pick-chosen',number>=0);pin.setAttribute('aria-pressed',String(number>=0));if(number>=0)pin.dataset.tripOrder=String(number+1);else delete pin.dataset.tripOrder}}
function observePins(){if(markerObserver)return;markerObserver=new MutationObserver(()=>{if(rerender)return;rerender=true;requestAnimationFrame(()=>{rerender=false;updateMapPins()})});for(const el of ['atlasBookmarkOverlay','map','atlasVectorMap']){const node=$(el);if(node)markerObserver.observe(node,{childList:true,subtree:true})}updateMapPins()}
function clearPins(){markerObserver?.disconnect();markerObserver=null;rerender=false;for(const pin of document.querySelectorAll('.route-pick-candidate,.route-pick-chosen')){pin.classList.remove('route-pick-candidate','route-pick-chosen');pin.removeAttribute('aria-pressed');delete pin.dataset.tripOrder}}
function updateAll(){if(!searchSheet)return;$('routeMapCount').textContent=selected.length;$('routeMapContinue').disabled=!selected.length;$('routeSearchContinue').disabled=!selected.length;renderChips();if(mode==='list')renderList();updateMapPins();document.dispatchEvent(new CustomEvent('atlas:route-selection-changed',{detail:{placeIds:selected.slice()}}))}
function captureMapStar(e){if(mode!=='map')return;const pin=e.target.closest?.('.atlas-bookmark-hit[data-place-id],.star-pin[data-place-id]');if(!pin)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toggle(String(pin.dataset.placeId))}
function captureKeyboardStar(e){if(e.key==='Escape'&&mode==='map'){exit();return}if(mode!=='map'||!['Enter',' '].includes(e.key))return;const pin=e.target.closest?.('.atlas-bookmark-hit[data-place-id],.star-pin[data-place-id]');if(pin){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toggle(String(pin.dataset.placeId))}}
function showMap(){if(searchSheet.open)searchSheet.close();mode='map';window.__atlasTripPicking=true;document.body.classList.add('route-pick-active');mapStrip.hidden=false;window.__atlasRefreshPins?.();observePins();updateAll()}
function showList(){stopMap();mode='list';mapStrip.hidden=true;if(!searchSheet.open)searchSheet.showModal();updateAll();$('routeSearchQuery').focus({preventScroll:true})}
function stopMap(){if(mode==='map'){mode='';window.__atlasTripPicking=false;document.body.classList.remove('route-pick-active');clearPins();window.__atlasRefreshPins?.()}mapStrip.hidden=true}
function exit(){if(menu)menu.hidden=true;if(searchSheet?.open)searchSheet.close();stopMap();mode='';selected=[];stopDays.clear();lastFocus?.focus?.({preventScroll:true})}
function proceed(){if(!selected.length)return;const values=selected.filter(id=>records.some(r=>String(r.id)===id));if(values.length!==selected.length){labelStatus('部分地点已不存在，请重新选择。');return}const from=$('routeFromDate').value,to=$('routeToDate').value;if(from&&to&&to<from){labelStatus('结束日期不能早于出发日期');if(!searchSheet.open)showList();return}const count=tripDayCount();
const stops=values.map(id=>({placeId:id,day:Math.max(1,Math.min(count,stopDays.get(id)||1)),time:''}));
const payload={schema:HANDOFF,placeIds:values,stops,createdAt:Date.now(),startDate:from,endDate:to,origin:$('routeOrigin').value.trim().slice(0,80),destination:$('routeDestination').value.trim().slice(0,80),mode:'view',version:4};try{sessionStorage.setItem(HANDOFF,JSON.stringify(payload));stopMap();location.assign('./route-view.html?from=footprint')}catch(e){labelStatus('无法传递路线：'+e.message)}}
async function showLibrary(){build();if(library.open)library.close();library.showModal();const list=$('routeLibraryItems');list.replaceChildren(make('p','route-empty','正在读取已保存路线…'));try{libraryItems=(await recordsFrom(TRIPS,'plans')).filter(x=>Array.isArray(x.placeIds)||Array.isArray(x.selected)).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));list.replaceChildren();if(!libraryItems.length){list.append(make('p','route-empty','还没有已保存的路线。点击主页「路线」开始规划，进入全屏路线图后可以保存。'));return}for(const item of libraryItems){const ids=Array.isArray(item.placeIds)?item.placeIds:item.selected.map(s=>s.id);const row=make('button','route-library-item');row.type='button';row.append(make('strong','',String(item.title||'我的旅行路线').slice(0,80)),make('span','',`${ids.length} 处地点 · ${(item.startDate||'日期待定')}${item.endDate?' — '+item.endDate:''}`));row.onclick=()=>location.assign('./route-view.html?saved='+encodeURIComponent(item.id));list.append(row)}}catch(e){list.replaceChildren(make('p','route-empty','读取保存路线失败：'+e.message))}}
function init(){const route=$('atlasJourneyEntry');if(!route)return;build();route.addEventListener('click',toggleMenu);route.setAttribute('aria-haspopup','true');route.setAttribute('aria-label','规划旅行：选择地图选点或搜索已收藏地点');window.__atlasTripPicking=false;window.__atlasTripPicker={open:toggleMenu,openList:()=>start('list'),enterMapMode:()=>start('map'),selected:()=>selected.slice(),records:()=>records.slice(),toggle:id=>toggle(String(id)),cancel:exit,showLibrary,moveStop,assignDay:setStopDay,balancedDays,dayCount:tripDayCount,stops:()=>selected.map(id=>({placeId:id,day:stopDays.get(id)||1}))}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();