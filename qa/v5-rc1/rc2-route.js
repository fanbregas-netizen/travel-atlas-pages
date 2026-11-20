/* PR53 continuation | V5 one live MapLibre canvas, single route mode.
 * Reuses the actual V5 IndexedDB route repository, OSRM road geometry,
 * original Map A camera, and saved-star DOM. No new map() or DB schema.
 */
(()=>{'use strict';
if(window.FootprintUnifiedRoute)return;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=p=>p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&Math.abs(+p.lat)<=85.05&&Math.abs(+p.lng)<=180;
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=()=>iso(new Date());
const journeyDays=()=>{const a=Date.parse(DATA.start+'T12:00:00'),b=Date.parse(DATA.end+'T12:00:00');return Number.isFinite(a)&&Number.isFinite(b)?Math.max(1,Math.min(60,Math.floor((b-a)/86400000)+1)):1};
const datePlus=(value,n)=>{const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
const getMap=()=>window.__atlasPOIBridge?.vector?.()||null;
const DATA={open:false,mode:'pick',panel:'half',places:[],routes:[],order:[],days:{},start:today(),end:datePlus(today(),2),title:'我的旅行路线',travel:'car',routeId:'',pending:[],busy:false,selected:'',savedView:false,dayView:0,pickMode:'list',origin:{type:'current'},dest:{type:'last'},legModes:{},history:[],endpointMap:null,modal:null,modalSeg:'',modalEndpoint:'',suggestion:null,mapFocus:false,returnToOrder:false,savedPreviewId:''};
let db=null,map=null,routeRevision=0,activeRoads=new Map(),originalPaint=new Map(),tempPins=new Map(),sheetHeight=0,desiredHeight=0,velocity=0,frame=0,dragging=false,dragY=0,dragHeight=0,toastTimer=0,styleMap=null,styleListener=null,routeClickListener=null,observer=null,closing=false,exitTimeout=0;
let sheetGesture=null,lastCameraFrame=0,cameraFrame=0,cameraTime=0,cameraMoves=0,gestureToken=0;
let routeSegmentListener=null,segmentPopup=null,segmentAnchorMarker=null,selectionPopup=null,segmentContext=null,segmentPlaceFrame=0,segmentDismissTimer=0,lastSegmentTap=0,routeMoveListener=null,selectedSegment='',focusSwipe=null,roadGeomEpoch=0,routeCoordsKey='',routeCoordsCached=[];
const shell=document.createElement('section');shell.id='fpUnifiedRoute';shell.hidden=true;shell.setAttribute('aria-label','足迹路线与地图');shell.innerHTML=
 '<section class="fp-route-sheet" aria-label="路线操作卡片"><div class="fp-route-grip" role="button" tabindex="0" aria-label="上滑展开、下滑收起路线卡片"></div><div class="fp-route-heading"><h2>路线规划</h2><button type="button" class="fp-route-close" data-command="exit" aria-label="保存草稿并退出路线">×</button></div><div class="fp-route-status"><span class="fp-route-step">1 / 3</span><span class="fp-route-gesture-hint" aria-hidden="true">上滑查看更多</span></div><div class="fp-route-body"></div><div class="fp-route-footer"></div></section><div class="fp-route-mini" aria-label="地图选点"><div class="fp-route-mini-grip" tabindex="0" role="button" aria-label="上拉展开选点卡片"></div><button type="button" class="fp-route-mini-confirm" data-command="map-confirm">确认 · 0处</button></div><div class="fp-route-toast" role="status" aria-live="polite"></div><div class="fp-route-dialog-backdrop" hidden><div class="fp-route-dialog" role="dialog" aria-modal="true" aria-label="路线操作"><div class="fp-route-dialog-head"><h3>路线设置</h3><button type="button" data-command="dismiss-dialog" aria-label="关闭设置弹层">×</button></div><div class="fp-route-dialog-content"></div><div class="fp-route-dialog-footer"></div></div></div>';
document.body.append(shell);
const ui={dialog:shell.querySelector('.fp-route-dialog-backdrop'),dialogTitle:shell.querySelector('.fp-route-dialog-head h3'),dialogBody:shell.querySelector('.fp-route-dialog-content'),dialogFooter:shell.querySelector('.fp-route-dialog-footer'),top:shell.querySelector('.fp-route-title'),sheet:shell.querySelector('.fp-route-sheet'),grip:shell.querySelector('.fp-route-grip'),heading:shell.querySelector('.fp-route-heading h2'),step:shell.querySelector('.fp-route-step'),body:shell.querySelector('.fp-route-body'),footer:shell.querySelector('.fp-route-footer'),mini:shell.querySelector('.fp-route-mini'),miniGrip:shell.querySelector('.fp-route-mini-grip'),miniConfirm:shell.querySelector('.fp-route-mini-confirm'),toast:shell.querySelector('.fp-route-toast')};
const repo=()=>db||(db=window.FootprintMediaCore?.createRepository?.(indexedDB));
const place=id=>DATA.places.find(p=>String(p.id)===String(id));
const selectedPlaces=()=>DATA.order.map(place).filter(valid);
const recentSavedRoute=()=>DATA.routes.find(r=>String(r.id)===String(DATA.savedPreviewId))||DATA.routes[0]||null;
const previewRouteId=()=>String(recentSavedRoute()?.id||'');
const displayWaypoints=()=>DATA.mode==='saved'
 ?(recentSavedRoute()?routeRows(recentSavedRoute()).map(place).filter(valid):[])
 :selectedPlaces();
// Keep old rendered tiles from a previous itinerary out of the active route.
const visibleRouteOwner=()=>String(DATA.mode==='saved'?previewRouteId()||'none':DATA.routeId||'draft');
let filteredRouteOwner='';
const displayTransport=(a,b)=>{
 if(DATA.mode!=='saved')return segmentMode(a,b);
 const record=recentSavedRoute();
 const raw=record?.legModes?.[legKey(a,b)]||record?.transportMode||record?.travelMode||'car';
 return raw==='city'?'transit':raw;
};
const travelLabel=mode=>({car:'驾车',walk:'步行',bike:'骑行',transit:'公交'}[mode]||'驾车');
const routeDays=()=>journeyDays();
const originName=()=>selectedPlaces()[0]?.title||selectedPlaces()[0]?.name||'首站';
const destName=()=>selectedPlaces().at(-1)?.title||selectedPlaces().at(-1)?.name||'末站';
function snapshot(label){
 DATA.history.push({label,order:[...DATA.order],days:{...DATA.days},origin:{...DATA.origin},dest:{...DATA.dest},legModes:{...DATA.legModes},start:DATA.start,end:DATA.end,travel:DATA.travel,title:DATA.title});
 if(DATA.history.length>30)DATA.history.shift();
}
function undo(){
 const old=DATA.history.pop();
 if(!old){hint('没有可撤回的操作');return}
 for(const k of ['order','days','origin','dest','legModes','start','end','travel','title'])DATA[k]=old[k];
 DATA.suggestion=null;routeRevision++;body();syncMapMode();fit();hint('已撤回：'+old.label)
}
function effectiveWaypoints(){return selectedPlaces()}
function legKey(a,b){return String(a.id)+'|'+String(b.id)}
function segmentMode(a,b){return DATA.legModes[legKey(a,b)]||DATA.travel}
function markChanged(){DATA.suggestion=null;routeRevision++; /* Road geometry is cached per directed stop pair + transport mode. */}
function modalClose(){DATA.modal=null;ui.dialog.hidden=true;ui.dialogBody.innerHTML='';ui.dialogFooter.innerHTML=''}
function dialogOpen(kind){
 DATA.modal=kind;ui.dialog.hidden=false;renderDialog();
}
function renderDialog(){
 if(!DATA.modal)return;
 const type=DATA.modal,choice=(label,key,value,desc='')=>'<button type="button" class="fp-route-dialog-option" data-command="'+key+'" data-value="'+esc(value)+'"><strong>'+label+'</strong><small>'+esc(desc)+'</small><span>›</span></button>';
 ui.dialogTitle.textContent=type==='origin'?'选择起点':type==='dest'?'选择终点':type==='segment'?'这一段怎么走':type==='save'?'确认保存路线':'路线设置';
 if(type==='origin'){
  ui.dialogBody.innerHTML=choice('当前位置','endpoint-choice','current','从当前定位开始')+choice('第一个访问地点','endpoint-choice','first','与第一站相同')+choice('从收藏地点选择','endpoint-choice','list','在收藏列表中指定')+choice('在地图上选择','endpoint-choice','map','仅选择已收藏的黄星');
 }else if(type==='dest'){
  ui.dialogBody.innerHTML=choice('最后一个访问地点','endpoint-choice','last','到最后一站结束')+choice('返回起点 · 闭环','endpoint-choice','loop','连接回起点')+choice('不指定终点','endpoint-choice','none','开放路线')+choice('从收藏地点选择','endpoint-choice','list','指定不同终点')+choice('在地图上选择','endpoint-choice','map','仅选择已收藏的黄星');
 }else if(type==='segment'){
  const chosen=DATA.legModes[DATA.modalSeg]||DATA.travel;
   ui.dialogBody.innerHTML=[['car','驾车'],['walk','步行'],['bike','骑行'],['transit','公共交通']].map(([m,label])=>choice(label+(m===chosen?' ✓':''),'segment-choice',m)).join('');
 }else if(type==='clear'){
   ui.dialogTitle.textContent='重新选择地点';
   ui.dialogBody.innerHTML='<p class="fp-route-dialog-summary">将清空本次路线选点与编号，不会删除任何收藏或已保存路线。</p>';
   ui.dialogFooter.innerHTML=button('取消','dismiss-dialog')+button('清空并重选','confirm-clear',true);
  }else if(type==='save'){
  ui.dialogBody.innerHTML='<div class="fp-route-dialog-summary"><strong>'+esc(DATA.title)+'</strong><p>'+esc(DATA.start)+' — '+esc(DATA.end)+' · '+DATA.order.length+' 个地点</p><p>'+esc(originName())+' → '+esc(destName())+'</p></div>';
  ui.dialogFooter.innerHTML=button('继续修改','dismiss-dialog')+button('确认保存','confirm-save',true);
 }
}
function chooseEndpoint(value){
 const kind=DATA.modalEndpoint||DATA.modal;
 if(!['origin','dest'].includes(kind))return;
 if(value==='list'){
  DATA.modal='endpoint-list';ui.dialogTitle.textContent=kind==='origin'?'从收藏选择起点':'从收藏选择终点';
  ui.dialogBody.innerHTML=DATA.places.filter(p=>valid(p)&&p.starred!==false&&!p.routeOnly).slice(0,100).map(p=>'<button class="fp-route-dialog-option" data-command="endpoint-select" data-id="'+esc(p.id)+'"><strong>'+esc(p.title||p.name)+'</strong><span>›</span></button>').join('')||'<p class="fp-route-caption">还没有收藏地点。可改用地图选点。</p>';
  return;
 }
 if(value==='map'){
  DATA.endpointMap=kind;modalClose();setMode('settings');spring('peek');
  hint('请点选收藏黄星作为'+(kind==='origin'?'起点':'终点'));return;
 }
 snapshot('调整'+(kind==='origin'?'起点':'终点'));DATA[kind]={type:value};
 modalClose();markChanged();body();syncMapMode();fit();hint('起终点已更新')
}
function endpointSet(id){
 const kind=DATA.endpointMap||DATA.modalEndpoint;
 if(!['origin','dest'].includes(kind))return;
 snapshot('指定'+(kind==='origin'?'起点':'终点'));DATA[kind]={type:'point',id:String(id)};
 DATA.endpointMap=null;DATA.modalEndpoint='';modalClose();markChanged();if(DATA.mapFocus)leaveMapFocus();setMode('settings');fit();hint('已选择'+(kind==='origin'?'起点':'终点'))
}

const routeRows=r=>(r?.stops?.length?r.stops:r?.selected?.length?r.selected:r?.placeIds||[]).map(x=>typeof x==='string'?x:x?.placeId||x?.id).filter(Boolean).map(String);
const viewportHeight=()=>Math.max(430,Math.min(window.innerHeight||844,window.visualViewport?.height||window.innerHeight||844));
// In full mode we intentionally reserve a useful map viewport above the sheet.
// Content continues scrolling inside the sheet; the map canvas is never resized.
/* The SAME home-map three-button tool stack yields to the route card.
 * One spring for all buttons, no separate route toolbar or map resize.
 * The screen-space target is derived from the real map-tool box at open. */
let mapTools=null,toolsBaseBottom=0,toolsBoxHeight=0,toolsY=0,toolsV=0,toolsTarget=0,toolsFrame=0,toolsScale=1,toolsScaleV=0,toolsScaleTarget=1;
function prepareMapTools(){
 const el=document.querySelector('.map-controls');
 if(!el)return;
 if(toolsFrame){cancelAnimationFrame(toolsFrame);toolsFrame=0}
 mapTools=el;el.style.removeProperty('translate');el.style.removeProperty('scale');
 const rect=el.getBoundingClientRect();
 toolsBaseBottom=rect.bottom;toolsBoxHeight=rect.height;
 toolsY=0;toolsV=0;toolsTarget=0;toolsScale=1;toolsScaleV=0;toolsScaleTarget=1;
}
function shiftMapTools(target,scale=1){
 if(!mapTools)return;
 toolsTarget=Number.isFinite(target)?Math.min(0,target):0;
 toolsScaleTarget=Math.max(.92,Math.min(1,scale));
 if(matchMedia('(prefers-reduced-motion:reduce)').matches){
  toolsY=toolsTarget;toolsV=0;toolsScale=toolsScaleTarget;toolsScaleV=0;
  if(!DATA.open&&Math.abs(toolsY)<.5)mapTools.style.removeProperty('translate');
  else mapTools.style.setProperty('translate','0 '+toolsY.toFixed(2)+'px','important');
  mapTools.style.setProperty('scale',toolsScale.toFixed(4),'important');
  return;
 }
 if(toolsFrame)return;
 const tick=()=>{
  const target=toolsTarget;
  toolsV=(toolsV+(target-toolsY)*.19)*.70;
  toolsY+=toolsV;
  toolsScaleV=(toolsScaleV+(toolsScaleTarget-toolsScale)*.23)*.72;
  toolsScale+=toolsScaleV;
  if(Math.abs(target-toolsY)<.45&&Math.abs(toolsV)<.38&&Math.abs(toolsScaleTarget-toolsScale)<.001&&Math.abs(toolsScaleV)<.001){
   toolsY=target;toolsV=0;toolsScale=toolsScaleTarget;toolsScaleV=0;toolsFrame=0;
   if(!DATA.open&&Math.abs(target)<.45)mapTools?.style.removeProperty('translate');
   else mapTools?.style.setProperty('translate','0 '+toolsY.toFixed(2)+'px','important');
   if(!DATA.open)mapTools?.style.removeProperty('scale');else mapTools?.style.setProperty('scale',toolsScale.toFixed(4),'important');
   return;
  }
  mapTools?.style.setProperty('translate','0 '+toolsY.toFixed(2)+'px','important');
  mapTools?.style.setProperty('scale',toolsScale.toFixed(4),'important');
  toolsFrame=requestAnimationFrame(tick);
 };
 toolsFrame=requestAnimationFrame(tick);
}
function followSheetWithTools(){
 // Map tools are hidden with a full sheet, never move them as the sheet changes height.
 if(DATA.open&&mapTools&&(Math.abs(toolsTarget)>.5||Math.abs(toolsScaleTarget-1)>.002))shiftMapTools(0,1);
}

// Card and route lifecycle must be independent: map focus is NOT route exit.
const draftKey='fp-v5-route-draft';
function preserveRouteDraft(){
 if(!['pick','settings','order'].includes(DATA.mode))return;
 const payload={savedAt:Date.now(),mode:DATA.mode,order:[...DATA.order],
  days:{...DATA.days},origin:{...DATA.origin},dest:{...DATA.dest},
  legModes:{...DATA.legModes},start:DATA.start,end:DATA.end,travel:DATA.travel,
  title:DATA.title,routeId:DATA.routeId,returnToOrder:DATA.returnToOrder,
  pendingPlaces:DATA.places.filter(p=>p.routeOnly===true&&p.pending===true)};
 try{sessionStorage.setItem(draftKey,JSON.stringify(payload))}catch(_){}
}
function clearRouteDraft(){try{sessionStorage.removeItem(draftKey)}catch(_){}}
function restoreRouteDraft(){
 try{
  const raw=sessionStorage.getItem(draftKey);
  if(!raw)return false;
  const p=JSON.parse(raw);
  if(!p||!Array.isArray(p.order)||!p.order.length||Date.now()-p.savedAt>7*86400000)return false;
  // Never resurrect old non-starred temporary stops into a star-only route.
  // Keep raw sessionStorage draft untouched for non-destructive recovery.
  DATA.order=p.order.map(String).filter(id=>{
   const saved=place(id);
   return saved&&valid(saved)&&saved.starred!==false&&!saved.demo&&!saved.routeOnly;
  });
  if(!DATA.order.length)return false;
  DATA.mode=DATA.order.length<2?'pick':(['pick','settings','order'].includes(p.mode)?p.mode:'pick');
  DATA.days=p.days&&typeof p.days==='object'?p.days:{};
  DATA.origin=p.origin||{type:'current'};DATA.dest=p.dest||{type:'last'};
  DATA.legModes=p.legModes||{};DATA.start=p.start||today();
  DATA.end=p.end||datePlus(DATA.start,2);DATA.travel=p.travel||'car';
  DATA.title=p.title||'我的旅行路线';DATA.routeId=DATA.routes.some(r=>String(r.id)===String(p.routeId))?p.routeId:'';
  DATA.returnToOrder=DATA.order.length>=2&&!!p.returnToOrder;DATA.pickMode='map';return true;
 }catch(_){return false}
}
function renderMini(){
 const n=DATA.order.length;
 ui.miniConfirm.textContent=n<2?'确认 · '+n+'/2':'确认 · '+n+'处';
 ui.miniConfirm.disabled=n<2;
 ui.miniConfirm.setAttribute('aria-label',n<2?'至少选择两个收藏地点后确认':'确认已选择的'+n+'个地点');
}
function newestStarCamera(force=false){
 if(!DATA.open||!DATA.mapFocus||DATA.mode!=='pick'||!map)return;
 const p=place(DATA.order.at(-1));if(!p||!valid(p))return;
 const point=[+p.lng,+p.lat],xy=map.project?.(point);
 const h=viewportHeight(),w=window.innerWidth||390;
 const nearEdge=!xy||xy.x<65||xy.x>w-95||xy.y<90||xy.y>h-125;
 if(!force&&!nearEdge)return;
 map.easeTo?.({center:point,duration:360,essential:true});
}
function enterMapFocus(){
 if(!DATA.open||closing||DATA.mapFocus||DATA.modal||DATA.mode!=='pick')return;
 DATA.pickMode='map';body();cancelAnimationFrame(frame);frame=0;velocity=0;
 DATA.mapFocus=true;ui.sheet.classList.remove('is-dragging');
 ui.sheet.style.setProperty('transition','transform 350ms cubic-bezier(.22,.74,.22,1)');
 ui.sheet.style.setProperty('transform','translate3d(0,calc(100% + 35px),0)');
 ui.sheet.style.setProperty('pointer-events','none');
 document.body.classList.add('fp-route-map-focus');
 shell.dataset.detent='map';renderMini();followSheetWithTools();syncMapMode();
 newestStarCamera(true);
}
function leaveMapFocus(expand=true){
 if(!DATA.open||!DATA.mapFocus)return;
 DATA.mapFocus=false;
 document.body.classList.remove('fp-route-map-focus');
 ui.sheet.style.setProperty('transition','transform 350ms cubic-bezier(.22,.74,.22,1)');
 ui.sheet.style.setProperty('transform','translate3d(0,0,0)');
 ui.sheet.style.removeProperty('pointer-events');
 if(expand){syncMapMode();spring('peek')}
}
function onFocusTouchStart(e){
 if(!DATA.mapFocus||e.touches.length!==1)return;
 const t=e.touches[0];
 // Only the grip may trigger card reopen; map drag stays native.
 if(!e.target.closest?.('.fp-route-mini-grip'))return;
 focusSwipe={identifier:t.identifier,x:t.clientX,y:t.clientY};
}
function onFocusTouchEnd(e){
 const g=focusSwipe;focusSwipe=null;if(!g||!DATA.mapFocus)return;
 const t=[...e.changedTouches].find(v=>v.identifier===g.identifier);
 if(t&&g.y-t.clientY>64&&Math.abs(t.clientX-g.x)<100)leaveMapFocus();
}
document.addEventListener('touchstart',onFocusTouchStart,{capture:true,passive:true});
document.addEventListener('touchend',onFocusTouchEnd,{capture:true,passive:true});
document.addEventListener('touchcancel',()=>{focusSwipe=null},{capture:true,passive:true});
const heightFor=which=>{const h=viewportHeight(),full=Math.max(300,Math.min(h*.62,h-290));return which==='peek'?Math.max(278,Math.min(358,h*.42,full-100)):which==='full'?full:Math.max(350,Math.min(full-75,h*.57))};
function height(value){sheetHeight=Math.max(175,Math.min(heightFor('full')+26,value));ui.sheet.style.setProperty('--fp-route-height',sheetHeight.toFixed(2)+'px');shell.style.setProperty('--fp-route-height',sheetHeight.toFixed(2)+'px');shell.dataset.detent=DATA.panel;followSheetWithTools();queueRouteCamera(false);queueSegmentPlacement();}
function spring(which){
 if(!['peek','half','full'].includes(which))return;
 DATA.panel=which;desiredHeight=heightFor(which);cancelAnimationFrame(frame);frame=0;
 ui.sheet.classList.remove('is-dragging');
 ui.sheet.classList.add('is-springing');
 if(matchMedia('(prefers-reduced-motion:reduce)').matches){ui.sheet.classList.remove('is-springing');height(desiredHeight);updateRouteCamera(false);return}
 let tick=0,last=0;
 const move=now=>{
  const dt=Math.min(1.7,Math.max(.3,(last?now-last:16.7)/16.7));last=now;
  // A gently underdamped physical spring: perceptible elastic overshoot,
  // continuous from the finger's release velocity, with bounded movement.
  velocity=(velocity+(desiredHeight-sheetHeight)*.145*dt)*Math.pow(.835,dt);
  velocity=Math.max(-32,Math.min(32,velocity));
  height(sheetHeight+velocity*dt);
  if((Math.abs(desiredHeight-sheetHeight)<.55&&Math.abs(velocity)<.48)||++tick>95){height(desiredHeight);velocity=0;frame=0;ui.sheet.classList.remove('is-springing');updateRouteCamera(false);return}
  frame=requestAnimationFrame(move)
 };
 frame=requestAnimationFrame(move)
}
function hint(value){ui.toast.textContent=value;ui.toast.classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('is-visible'),2600)}
function button(label,command,primary=false){return '<button type="button" class="fp-route-btn '+(primary?'fp-route-primary':'fp-route-secondary')+'" data-command="'+command+'">'+label+'</button>'}
function head(title,step){ui.heading.textContent=title;ui.step.textContent=step}
function placeList(){
 let q=(DATA.query||'').trim();
 const available=DATA.places.filter(p=>valid(p)&&p.starred!==false&&!p.demo&&(!q||String(p.title||p.name||'').includes(q))).slice(0,130);
 if(!available.length)return '<div class="fp-route-empty">'+(q?'没有匹配地点':'还没有收藏地点，请先收藏想去的地点。')+'</div>';
 return available.map(p=>{
  const chosen=DATA.order.includes(String(p.id));
  return '<div class="fp-route-place"><span class="fp-route-index">'+(chosen?'★':'☆')+'</span><div class="fp-route-name"><strong>'+esc(p.title||p.name)+'</strong><small>'+esc(p.address||p.city||'收藏地点')+'</small></div><button class="fp-route-btn '+(chosen?'is-active':'')+'" data-command="'+(chosen?'remove-stop':'toggle')+'" data-id="'+esc(p.id)+'" aria-label="'+(chosen?'移除':'添加')+esc(p.title||p.name)+'">'+(chosen?'✓':'＋')+'</button></div>'
 }).join('');
}
function listSaved(routes=DATA.routes){
 if(!routes.length)return '<div class="fp-route-empty">尚无已保存路线。先选择两个地点规划第一条路线。</div>';
 const activeId=previewRouteId();
 return routes.map(r=>{
  const stops=routeRows(r),first=place(stops[0]),last=place(stops.at(-1));
  const startName=first?.title||first?.name||'起点待恢复';
  const endName=last?.title||last?.name||'终点待恢复';
  const active=String(r.id)===activeId;
  const details=[r.startDate&&r.endDate?r.startDate+' — '+r.endDate:r.startDate||'',stops.length+' 个地点'].filter(Boolean).join(' · ');
  return '<button type="button" class="fp-route-saved-row '+(active?'is-current':'')+'" '+
   'data-command="open-saved" data-id="'+esc(r.id)+'" aria-current="'+(active?'true':'false')+'" '+
   'aria-label="查看 '+esc(r.title||'我的旅行路线')+'">'+
   '<span class="fp-route-saved-copy"><strong>'+esc(r.title||'我的旅行路线')+'</strong>'+
   '<small>'+esc(startName)+' → '+esc(endName)+'</small>'+
   '<small>'+esc(details)+'</small></span>'+
   (active?'<span class="fp-route-saved-active">地图显示中</span>':'<span class="fp-route-saved-arrow" aria-hidden="true">›</span>')+
   '</button>';
 }).join('');
}
function orderList(){
 return DATA.order.map((id,i)=>{const p=place(id);if(!p)return '';
 return '<div class="fp-route-reorder" data-stop="'+esc(id)+'"><span class="fp-route-index">'+(i+1)+'</span><span class="fp-route-name">'+esc(p.title||p.name||'地点')+'</span><button type="button" class="fp-route-day" data-command="day" data-id="'+esc(id)+'">D'+(DATA.days[id]||1)+'</button><button type="button" class="fp-route-grab" data-grab="'+esc(id)+'" aria-label="长按拖动调整站点顺序"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="currentColor"><circle cx="8" cy="6" r="1.65"/><circle cx="16" cy="6" r="1.65"/><circle cx="8" cy="12" r="1.65"/><circle cx="16" cy="12" r="1.65"/><circle cx="8" cy="18" r="1.65"/><circle cx="16" cy="18" r="1.65"/></g></svg></button></div>'
 }).join('');
}
function routeLegList(){
 const pts=effectiveWaypoints();if(pts.length<2)return '';
 return pts.slice(1).map((b,i)=>{const a=pts[i];return '<button type="button" class="fp-route-leg" data-command="leg" data-id="'+esc(legKey(a,b))+'"><span class="fp-route-leg-dot">'+(i+1)+'</span><span class="fp-route-leg-text">'+esc(a.title||a.name||'起点')+' → '+esc(b.title||b.name||'终点')+'</span><span class="fp-route-leg-mode">'+travelLabel(segmentMode(a,b))+' ›</span></button>'}).join('');
}
function previewDayFilter(){
 return '<div class="fp-route-segment fp-route-day-filter"><button class="fp-route-btn '+(DATA.dayView===0?'is-active':'')+'" data-command="dayview" data-value="0">全部</button>'+
 Array.from({length:Math.min(7,routeDays())},(_,i)=>'<button class="fp-route-btn '+(DATA.dayView===i+1?'is-active':'')+'" data-command="dayview" data-value="'+(i+1)+'">D'+(i+1)+'</button>').join('')+'</div>'
}
function body(){
 const n=DATA.order.length;
 if(DATA.mode==='saved'){
  head('我的路线',DATA.routes.length+' 条');
  ui.body.innerHTML=DATA.routes.length
    ?'<div class="fp-route-saved-flat">'+listSaved(DATA.routes)+'</div><p class="fp-route-road-status" data-route-road-status aria-live="polite"></p>'
    :'<p class="fp-route-caption">还没有保存的路线。可在地图上选点规划。</p>';
  ui.footer.innerHTML=button('新建路线','new',true);return;
 }
 if(DATA.mode==='pick'){
  head('选择地点','1 / 3');
  const list=DATA.pickMode==='list';
  ui.body.innerHTML='<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">01</span><strong>选择访问地点</strong><span class="fp-route-mode-label">'+n+' 处已选</span></div>'+
  '<div class="fp-route-segment fp-route-tabs"><button class="fp-route-btn '+(list?'is-active':'')+'" data-command="pickmode" data-value="list">收藏列表</button><button class="fp-route-btn '+(!list?'is-active':'')+'" data-command="pickmode" data-value="map">地图选点</button></div>'+
  (list?'<label class="fp-route-field" for="fpUnifiedPlaceSearch">搜索收藏地点</label><input class="fp-route-input" id="fpUnifiedPlaceSearch" placeholder="输入地点名称…" value="'+esc(DATA.query||'')+'"><div id="fpUnifiedAvailable">'+placeList()+'</div>':
  '<p class="fp-route-caption">仅点选地图上的收藏黄星；右上角自动编号。这一步不连线。</p>')+'</div>';
  ui.footer.innerHTML=(n?button('重新选点','reset-places'):button('我的路线','saved'))+button(DATA.returnToOrder?'返回排列顺序':'下一步 · 行程设置','settings',true);
  ui.footer.querySelector('[data-command="settings"]').disabled=n<2;renderMini();return;
 }
 if(DATA.mode==='settings'){
  head('行程设置','2 / 3');
  ui.body.innerHTML='<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">02</span><strong>行程设置</strong></div>'+
  '<label class="fp-route-field" for="fpUnifiedTitle">路线名称</label><input class="fp-route-input" id="fpUnifiedTitle" maxlength="42" value="'+esc(DATA.title)+'">'+
  '<div class="fp-route-field">旅行日期</div><div class="fp-route-dates"><label>开始<input type="date" class="fp-route-input" id="fpUnifiedStart" value="'+esc(DATA.start)+'"></label><label>结束<input type="date" class="fp-route-input" id="fpUnifiedEnd" value="'+esc(DATA.end)+'"></label></div>'+
  '<p class="fp-route-caption">'+routeDays()+' 天行程 · 点击日期使用系统选择器</p>'+
  '<p class="fp-route-caption">首站：'+esc(originName())+' · 末站：'+esc(destName())+'，可在排列顺序中调整。</p>'+
  '<div class="fp-route-field">旅行模式</div><div class="fp-route-travel">'+
  '<button class="fp-route-btn '+(DATA.travel==='car'?'is-active':'')+'" data-command="main-travel" data-value="car" aria-pressed="'+(DATA.travel==='car')+'">驾车旅行 <small>驾车为主</small></button>'+
  '<button class="fp-route-btn '+(DATA.travel!=='car'?'is-active':'')+'" data-command="main-travel" data-value="walk" aria-pressed="'+(DATA.travel!=='car')+'">城市出行 <small>步行／公交按段</small></button></div></div>';
  ui.footer.innerHTML=button('上一步','pick')+button('下一步 · 排列顺序','order',true);return;
 }
 if(DATA.mode==='order'){
  head('排列顺序','3 / 3');
  ui.body.innerHTML='<div class="fp-route-card fp-route-order-list">'+
  '<p class="fp-route-caption">长按右侧拖动调整顺序 · 点击日期标签调整行程</p>'+orderList()+
  '<button type="button" class="fp-route-addmore" data-command="addmore">＋ 继续添加地点</button></div>'+
  '<div class="fp-route-recommendation">'+(DATA.suggestion?.revision===routeRevision?'<p>道路距离建议可减少约 '+DATA.suggestion.saving+'% 绕行（不代表实时路况）。</p>'+button('采用建议','adopt-suggestion',true):button('检查是否有更顺的顺序','suggest'))+'</div>'+
  '<p class="fp-route-road-status" data-route-road-status aria-live="polite">正在获取真实道路…</p>';
  ui.footer.innerHTML=button('上一步','settings')+button('完成并保存','confirm',true);return;
 }
 if(DATA.mode==='view'){
  head('查看行程','路线预览');
  ui.body.innerHTML='<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">✓</span><strong>'+esc(DATA.title)+'</strong><span class="fp-route-mode-label">'+n+' 地点</span></div>'+
  '<p class="fp-route-caption">'+esc(DATA.start)+' — '+esc(DATA.end)+' · '+esc(originName())+' → '+esc(destName())+'</p>'+
  previewDayFilter()+'<p class="fp-route-road-status" data-route-road-status aria-live="polite">正在获取真实道路…</p></div>';
  ui.footer.innerHTML=button('返回我的路线','saved')+button('编辑路线','settings',true);return;
 }
 if(DATA.mode==='detail'){
  const p=place(DATA.selected);
  head(p?.title||p?.name||'地点详情','地点');
  const block=(n,title,desc)=>'<section class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">'+n+'</span><strong>'+title+'</strong></div><p class="fp-route-caption">'+esc(desc)+'</p></section>';
  if(p){
   const media=(p.photos?.length||0)+(p.videos?.length||0);
   const refs=(p.references?.length||0)+(p.guides?.length||0);
   const nearby=DATA.places.filter(x=>x.id!==p.id&&valid(x)&&Math.hypot((+x.lat-(+p.lat))*111195,(+x.lng-(+p.lng))*111195*Math.cos(+p.lat*Math.PI/180))<2500).length;
   ui.body.innerHTML='<div class="fp-route-detail-location">'+esc(p.address||p.city||'路线站点')+'</div>'+
    block('01','Brief / 旅行记录',p.note?.trim()||'还没有写下旅行记录')+
    block('02','照片与视频',media?media+' 项已保存影像':'暂无影像')+
    block('03','相关资料',refs?refs+' 条资料链接':'暂无资料')+
    block('04','附近地点',nearby?nearby+' 个附近的已记录地点':'暂无附近记录');
  }else ui.body.innerHTML='<p class="fp-route-empty">找不到这个地点</p>';
  ui.footer.innerHTML=button('返回路线','view',true);return;
 }
}
function setMode(next,force=false){
 if(!['order','view'].includes(next))dismissSegmentPopup(true);
 dismissSelectionPopup();
 if(DATA.mapFocus)leaveMapFocus(false);
 if(next!=='pick')DATA.returnToOrder=false;
  DATA.mode=next;DATA.selected=next==='detail'?DATA.selected:'';
 body();syncMapMode();spring(['saved','pick','view'].includes(next)?'peek':'half');
}
function stopIndex(){return new Map(displayWaypoints().map((p,i)=>[String(p.id),i+1]))}
function refreshStarLabels(){
 if(!DATA.open)return;
 const index=stopIndex();document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit').forEach(b=>{
  const id=String(b.dataset.placeId),n=index.get(id);
  b.style.opacity=DATA.mode==='view'&&DATA.dayView>0&&DATA.days[id]!==DATA.dayView?'.42':'';
  const old=b.querySelector('.fp-route-stop-order');
  if(!n){old?.remove();return}
  const node=old||document.createElement('span');node.className='fp-route-stop-order';node.textContent=n;if(!old)b.append(node);
 });
}
function clearStarLabels(){document.querySelectorAll('#atlasBookmarkOverlay .fp-route-stop-order').forEach(n=>n.remove());document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit').forEach(n=>n.style.removeProperty('opacity'))}
function temporaryMarkers(){
 if(!map)return;
 const selected=new Set(displayWaypoints().map(p=>String(p.id)));
 for(const [id,pin] of tempPins)if(!selected.has(id)){pin.remove();tempPins.delete(id)}
 [...selected].forEach((id,i)=>{
  const p=place(id);if(!p||p.starred!==false||tempPins.has(id))return;
  const el=document.createElement('button');el.type='button';el.className='fp-route-temp-marker';el.dataset.id=id;el.innerHTML='<span class="fp-route-temp-number">'+(DATA.order.includes(id)?DATA.order.indexOf(id)+1:id===DATA.origin.id?'起':'终')+'</span>';
   el.setAttribute('aria-label','路线临时站点 '+(i+1));
  el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectStop(id)});
  const pin=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([+p.lng,+p.lat]).addTo(map);tempPins.set(id,pin);
 });
 for(const [id,pin] of tempPins){const n=DATA.order.indexOf(id),tag=pin.getElement().querySelector('span');if(tag)tag.textContent=n>=0?n+1:(id===DATA.origin.id?'起':'终')}
}
const geo=(features)=>({type:'FeatureCollection',features});
function ensureLineLayers(){
 if(!map||!map.getStyle?.()?.layers?.length)return false;
 // Source/layers only need the style graph, not a fully idle tile network.
 try{
  if(!map.getSource('fp-single-route'))map.addSource('fp-single-route',{type:'geojson',data:geo([])});
  const faded=['case',['==',['get','dim'],true],.30,1];
  const owner=visibleRouteOwner();
  const ownerMatch=['==',['get','routeOwner'],owner];
  const road=['all',['==',['get','kind'],'road'],ownerMatch];
  const chosen=['all',road,['==',['get','selected'],true]];
  const easing={'line-width-transition':{duration:190,delay:0},'line-opacity-transition':{duration:180,delay:0}};
  const layers=[
   ['fp-single-selected-halo',chosen,{'line-color':'#ddba70','line-width':21,'line-opacity':.78}],
   ['fp-single-outline',road,{'line-color':'#fffefa','line-width':['case',['get','selected'],15,9],'line-opacity':faded}],
   ['fp-single-road',road,{'line-color':['case',['get','selected'],'#215c45','#3f6654'],'line-width':['case',['get','selected'],8,4.5],'line-opacity':faded}],
   ['fp-single-order',['all',['==',['get','kind'],'sequence'],ownerMatch],{'line-color':'#d9b56b','line-width':3,'line-opacity':.93,'line-dasharray':[1.1,1.4]}],
   // Only the transparent hit layer handles road taps. A 30px touch target
   // prevents the original 4.5px road from being nearly impossible to tap.
   ['fp-single-hit',road,{'line-color':'#315a46','line-opacity':.003,'line-width':32}]
  ];
  for(const [id,filter,paint] of layers){
   if(!map.getLayer(id))map.addLayer({id,type:'line',source:'fp-single-route',filter,paint:({...paint,...(id==='fp-single-hit'?{}:easing)}),layout:{'line-cap':'round','line-join':'round'}});
   else if(owner!==filteredRouteOwner)map.setFilter?.(id,filter);
  }
  filteredRouteOwner=owner;
 }catch(_){return false}
 if(!routeSegmentListener&&map.on){
  routeSegmentListener=e=>{
   if(!DATA.open||!['saved','order','view','detail'].includes(DATA.mode))return;
   // General map fallback can dispatch before delegated layer click.
   // Only open one popup for a single finger tap, never reset its animation.
   if(Date.now()-lastSegmentTap<280)return;
   const f=e.features?.[0],from=f?.properties?.from,to=f?.properties?.to;
   if(!from||!to)return;
   e.originalEvent?.stopPropagation?.();
   showSegmentBubble(from,to,e.lngLat);
  };
  map.on('click','fp-single-hit',routeSegmentListener);
 }
 return true
}
function dismissSegmentPopup(immediate=false){
 if(segmentPlaceFrame){cancelAnimationFrame(segmentPlaceFrame);segmentPlaceFrame=0}
 if(segmentDismissTimer){clearTimeout(segmentDismissTimer);segmentDismissTimer=0}
 const popup=segmentPopup;segmentPopup=null;segmentContext=null;selectedSegment='';
 segmentAnchorMarker?.remove();segmentAnchorMarker=null;
 if(DATA.open&&map)lines();
 if(!popup)return;
 if(immediate||!popup.getElement?.()){popup.remove();return}
 popup.getElement().classList.add('is-closing');
 segmentDismissTimer=setTimeout(()=>{segmentDismissTimer=0;popup.remove()},170);
}
function segmentBubbleLayout(ctx){
 if(!map||!ctx)return null;
 const mapRect=map.getContainer?.()?.getBoundingClientRect?.();
 if(!mapRect)return null;
 const w=mapRect.width,h=mapRect.height;
 const card=ui.sheet.getBoundingClientRect();
 const top=Math.max(28,Math.min(74,h*.095));
 const bottom=Math.max(top+60,Math.min(h-18,card.top-mapRect.top-16));
 const available=bottom-top,compact=available<245;
 const width=Math.min(w-32,ctx.expanded?(compact?196:210):160),height=ctx.expanded?(compact?122:165):45;
 if(width<148||available<height+12)return null;
 const clamp=(v,l,r)=>Math.max(l,Math.min(r,v));
 const click=map.project(ctx.clicked);
 if(!Number.isFinite(click.x)||!Number.isFinite(click.y))return null;
 const stars=DATA.order.map(place).filter(valid).map(p=>map.project([+p.lng,+p.lat]));
 const line=ctx.geometry.map(p=>map.project(p));
 const xs=[click.x,click.x-48,click.x+48,click.x-96,click.x+96,w*.5]
  .map(x=>clamp(x,16+width/2,w-16-width/2));
 const ys=[click.y-22,click.y-65,click.y+48,top+height+8,bottom-8]
  .map(y=>clamp(y,top+height+8,bottom-8));
 let best=null;
 for(const x of [...new Set(xs.map(Math.round))])
 for(const y of [...new Set(ys.map(Math.round))]){
  const l=x-width/2,r=x+width/2,t=y-height,b=y;
  const overlap=(p,pad)=>p.x>l-pad&&p.x<r+pad&&p.y>t-pad&&p.y<b+pad;
  const starPenalty=stars.filter(p=>overlap(p,32)).length*6000;
  const linePenalty=line.filter(p=>overlap(p,12)).length*165;
  const score=starPenalty+linePenalty*.25+Math.hypot(x-click.x,y-click.y)*1.9;
  if(!best||score<best.score)best={x,y,compact,score};
 }
 return best;
}
function placeSegmentPopup(){
 if(!segmentPopup||!segmentContext||!map)return;
 const q=segmentBubbleLayout(segmentContext),el=segmentPopup.getElement?.();
 if(!q){el?.classList.add('is-hidden-for-space');return}
 el?.classList.remove('is-hidden-for-space');
 el?.classList.toggle('is-compact',q.compact);
 el?.classList.toggle('is-expanded',!!segmentContext.expanded);
 if(segmentContext.last&&Math.hypot(q.x-segmentContext.last.x,q.y-segmentContext.last.y)<2)return;
 segmentContext.last={x:q.x,y:q.y};
 segmentPopup.setLngLat(map.unproject([q.x,q.y]));
}
function queueSegmentPlacement(){
 if(!DATA.open||!segmentPopup||segmentPlaceFrame)return;
 segmentPlaceFrame=requestAnimationFrame(()=>{segmentPlaceFrame=0;placeSegmentPopup()});
}
function snapToRealSegment(geometry,lngLat){
 if(!map||!Array.isArray(geometry)||geometry.length<2)return lngLat;
 const raw=Array.isArray(lngLat)?lngLat:[lngLat.lng,lngLat.lat],target=map.project(raw);
 let best=null,dist=Infinity;
 for(let i=1;i<geometry.length;i++){
  const a=map.project(geometry[i-1]),b=map.project(geometry[i]);
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  if(!Number.isFinite(den))continue;
  const t=den?Math.min(1,Math.max(0,((target.x-a.x)*dx+(target.y-a.y)*dy)/den)):0;
  const x=a.x+t*dx,y=a.y+t*dy,d=(x-target.x)**2+(y-target.y)**2;
  if(d<dist){dist=d;best=[x,y]}
 }
 return best?map.unproject(best):lngLat;
}
function showSegmentBubble(from,to,lngLat){
 dismissSegmentPopup(true);
 const a=place(from),b=place(to);
 if(!a||!b)return;
 const key=legKey(a,b),travel=displayTransport(a,b),mode=travelLabel(travel);
 const glyph={car:'car-front',walk:'footprints',bike:'bike',transit:'bus-front'}[travel]||'car-front';
 const glyphSVG={
 car:'<path d="M5 17h14l-1-7H6zM7 10l2-4h6l2 4M7 17v2m10-2v2M8 13h2m4 0h2"/>',
 walk:'<circle cx="13" cy="4" r="2"/><path d="m10 21 1-6-4-3 3-5 4 3 3 1m-3 0-2 4m-6 6 3-5"/>',
 bike:'<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-9 4 9 5 0-5-9H9m6-3h3"/>',
 transit:'<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 12h14M8 21l2-2m6 0 2 2M9 7h6"/>'
 }[travel]||'<circle cx="12" cy="12" r="7"/>';
 const icon='<svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+glyphSVG+'</svg>';
 DATA.modalSeg=key;selectedSegment=key;lastSegmentTap=Date.now();lines();
 if(!window.maplibregl?.Popup){dialogOpen('segment');return}
 const html='<button type="button" class="fp-route-segment-pill-button" data-segment-action="expand" aria-expanded="false"><span class="fp-route-pill-icon">'+icon+'</span><span>'+esc(mode)+'</span><span class="fp-route-pill-dot">·</span><span class="fp-route-pill-eta" role="status">计算中</span></button>'+
 '<div class="fp-route-line-bubble" hidden><div class="fp-route-line-title"><span class="fp-route-line-icon">'+icon+'</span><strong>'+esc(mode)+'</strong><button type="button" data-segment-action="edit" aria-label="更改交通方式">更改 ›</button></div>'+
 '<small class="fp-route-line-points">'+esc(a.title||a.name)+' → '+esc(b.title||b.name)+'</small>'+
 '<div class="fp-route-line-eta" role="status">正在计算道路用时…</div><button class="fp-route-line-navigate" type="button" data-segment-action="navigate">导航这一段</button></div>';
 const road=activeRoads.get(travel+'|'+a.id+'|'+b.id);
 const geometry=road?.status==='ok'&&Array.isArray(road.geometry)?road.geometry:[[+a.lng,+a.lat],[+b.lng,+b.lat]];
 const anchor=snapToRealSegment(geometry,lngLat);
 const raw=Array.isArray(anchor)?anchor:[anchor.lng,anchor.lat];
 const popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,anchor:'bottom',offset:9,maxWidth:'230px',className:'fp-route-segment-popup fp-route-segment-pill'})
  .setLngLat(raw).setHTML(html).addTo(map);
 segmentPopup=popup;
 if(window.maplibregl.Marker){
  const dot=document.createElement('span');
  dot.className='fp-route-segment-anchor';
  dot.setAttribute('aria-hidden','true');
  segmentAnchorMarker=new maplibregl.Marker({element:dot,anchor:'center'}).setLngLat(raw).addTo(map);
 }
 const stride=Math.max(1,Math.ceil(geometry.length/85));
 segmentContext={clicked:[+raw[0],+raw[1]],geometry:geometry.filter((_,i)=>i%stride===0||i===geometry.length-1).map(p=>[+p[0],+p[1]]),expanded:false,last:null};
 const updateEstimate=()=>{
  const el=popup.getElement()?.querySelector('.fp-route-line-eta');if(!el)return;
  const estimate=window.__fpLiveRouting?.peek?.(a,b,travel);
  el.textContent=estimate?.label||'路段预计用时暂不可用';
  const eta=popup.getElement()?.querySelector('.fp-route-pill-eta');
  if(eta){
   const label=estimate?.label||'';
   eta.textContent=estimate?.state==='ok'?label.split('·')[0].replace(/\s+/g,''):
    estimate?.state==='loading'?'计算中':estimate?.state==='external'?'查看换乘':'道路不可用';
  }
 };
 const refresh=()=>{if(segmentPopup===popup)updateEstimate()};
 document.addEventListener('fp:route-network-update',refresh);
 popup.on('close',()=>{
  document.removeEventListener('fp:route-network-update',refresh);
  if(segmentPopup===popup){segmentPopup=null;segmentContext=null;segmentAnchorMarker?.remove();segmentAnchorMarker=null;selectedSegment='';if(DATA.open)lines()}
 });
 popup.getElement()?.addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-segment-action]');if(!btn)return;
  e.stopPropagation();e.preventDefault();
  if(btn.dataset.segmentAction==='expand'){
   if(segmentPopup!==popup||!segmentContext)return;
   segmentContext.expanded=true;segmentContext.last=null;
   const container=popup.getElement();
   container?.classList.add('is-expanded');
   const pill=container?.querySelector('.fp-route-segment-pill-button');
   const detail=container?.querySelector('.fp-route-line-bubble');
   if(pill){pill.hidden=true;pill.setAttribute('aria-expanded','true')}
   if(detail)detail.hidden=false;
   placeSegmentPopup();return;
  }
  if(btn.dataset.segmentAction==='edit'){dismissSegmentPopup();DATA.modalSeg=key;dialogOpen('segment');return}
  if(btn.dataset.segmentAction==='navigate'){dismissSegmentPopup();window.__atlasOpenNavigation?.(b,{mode:travel,from:a});}
 });
 updateEstimate();placeSegmentPopup();
}
function updateRoadStatus(points,roadMode){
 const holder=ui.body.querySelector('[data-route-road-status]');if(!holder)return;
 if(!roadMode||points.length<2){holder.textContent='';return}
 let ready=0,loading=0,missing=0;
 for(let i=1;i<points.length;i++){
  const from=points[i-1],to=points[i];
  const status=activeRoads.get(displayTransport(from,to)+'|'+from.id+'|'+to.id)?.status;
  if(status==='ok')ready++;else if(!status||status==='loading')loading++;else missing++;
 }
 holder.textContent=missing
  ?'部分道路暂不可用：仅显示已验证路段，不以直线代替'
  :loading?'正在加载真实道路 · '+ready+'/'+(points.length-1)+' 段'
  :'已显示真实道路 · '+ready+' 段';
}
function lines(){
 if(!DATA.open||!ensureLineLayers())return;
 const source=map.getSource('fp-single-route');
 // Picking never draws links. Settings alone uses a schematic dashed
 // sequence. Order, saved and view may show VERIFIED road geometry only.
 const diagram=DATA.mode==='settings';
 const roadMode=['saved','order','view','detail'].includes(DATA.mode);
 if(!diagram&&!roadMode){source?.setData(geo([]));return}
 const pts=displayWaypoints(),features=[],routeOwner=visibleRouteOwner();
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],mode=displayTransport(a,b);
  const key=mode+'|'+a.id+'|'+b.id,hit=activeRoads.get(key);
  if(diagram){
   features.push({type:'Feature',properties:{kind:'sequence',routeOwner,from:a.id,to:b.id,selected:false,dim:false},
    geometry:{type:'LineString',coordinates:[[+a.lng,+a.lat],[+b.lng,+b.lat]]}});
  }else if(hit?.status==='ok'&&Array.isArray(hit.geometry)&&hit.geometry.length>=2){
   features.push({type:'Feature',properties:{kind:'road',routeOwner,from:a.id,to:b.id,
    selected:selectedSegment===legKey(a,b),
    dim:DATA.mode==='view'&&DATA.dayView>0&&DATA.days[a.id]!==DATA.dayView&&DATA.days[b.id]!==DATA.dayView},
    geometry:{type:'LineString',coordinates:hit.geometry}});
  }
 }
 source?.setData(geo(features));
 updateRoadStatus(pts,roadMode);
 if(!roadMode||pts.length<2)return;
 const request=window.__fpLiveRouting?.get;
 if(!request){const holder=ui.body.querySelector('[data-route-road-status]');if(holder)holder.textContent='道路服务不可用，暂不绘制虚假线路';return}
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],mode=displayTransport(a,b),key=mode+'|'+a.id+'|'+b.id;
  if(activeRoads.has(key))continue;
  const loading={status:'loading'};
  activeRoads.set(key,loading);
  Promise.resolve(mode==='transit'?{status:'unavailable'}:request(a,b,mode)).then(hit=>{
   // A stop reorder can retain this road response. Only a replaced/closed
   // request is stale; geometry is keyed by directed endpoints + mode.
   if(!DATA.open||activeRoads.get(key)!==loading)return;
   activeRoads.set(key,hit||{status:'error'});
   roadGeomEpoch++;lines();
   // Fit the full set of verified roads plus every stop as soon as
   // all active requests have settled, including an unavailable segment.
   const current=displayWaypoints();
   if(current.length>1&&['saved','view','order'].includes(DATA.mode)){
    const allSettled=current.slice(1).every((p,k)=>{
     const a=current[k],status=activeRoads.get(displayTransport(a,p)+'|'+a.id+'|'+p.id)?.status;
     return status&&status!=='loading';
    });
    if(allSettled)queueRouteCamera(!(frame||dragging));
   }
  }).catch(()=>{
   if(!DATA.open||activeRoads.get(key)!==loading)return;
   activeRoads.set(key,{status:'error'});roadGeomEpoch++;lines();queueRouteCamera(false);
  });
 }
 updateRoadStatus(pts,roadMode);
}
/* Optional order advice only when the real road matrix is available.
 * Keep first/last points fixed; never claim an ETA or real-time traffic benefit. */
function roadDistance(ids,road){
 let total=0;
 for(let i=1;i<ids.length;i++){
  const a=place(ids[i-1]),b=place(ids[i]),d=a&&b?road.metric(a,b,DATA.travel):null;
  if(!Number.isFinite(d))return Infinity;
  total+=d;
 }
 return total
}
async function suggestOrder(){
 const road=window.__fpLiveRouting;
 if(DATA.mode!=='order'||DATA.order.length<3||DATA.order.length>10){hint('建议适用于 3 至 10 个站点');return}
 if(DATA.travel==='transit'||Object.keys(DATA.legModes).length||!road?.prepareMatrix||!road?.metric){hint('该出行方式暂无可验证的道路距离建议');return}
 const revision=routeRevision,original=[...DATA.order];
 hint('正在核对道路距离');
 try{
  await road.prepareMatrix(selectedPlaces(),DATA.travel);
  if(!DATA.open||DATA.mode!=='order'||revision!==routeRevision)return;
  const initial=roadDistance(original,road);
  if(!Number.isFinite(initial)||initial<=0){hint('道路距离数据不完整，保留当前顺序');return}
  let best=original,bestDistance=initial;
  for(let pass=0;pass<original.length;pass++){
   let next=null,nextDistance=bestDistance;
   for(let a=1;a<best.length-2;a++)for(let b=a+1;b<best.length-1;b++){
    const choice=[...best.slice(0,a),...best.slice(a,b+1).reverse(),...best.slice(b+1)];
    const score=roadDistance(choice,road);
    if(Number.isFinite(score)&&score<nextDistance-.001){next=choice;nextDistance=score}
   }
   if(!next)break;best=next;bestDistance=nextDistance
  }
  const improvement=1-bestDistance/initial;
  if(improvement<.05){DATA.suggestion=null;body();hint('当前顺序已接近道路距离最短方案');return}
  DATA.suggestion={order:[...best],revision,saving:Math.round(improvement*100)};
  body();hint('发现可减少绕路的访问顺序')
 }catch(_){hint('道路服务暂不可用，保持当前访问顺序')}
}
// Route geometry, not just stop markers, defines the map's visible bounds.
function routeCoordinates(){
 const key=routeRevision+'|'+roadGeomEpoch+'|'+DATA.mode+'|'+(recentSavedRoute()?.id||'')+'|'+displayWaypoints().map(p=>p.id).join('|');
 if(key===routeCoordsKey)return routeCoordsCached;
 const pts=displayWaypoints(),coordinates=pts.map(p=>[+p.lng,+p.lat]);
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i];
  const road=activeRoads.get(displayTransport(a,b)+'|'+a.id+'|'+b.id);
  if(road?.status!=='ok'||!Array.isArray(road.geometry))continue;
  for(const xy of road.geometry)
   if(Array.isArray(xy)&&Number.isFinite(+xy[0])&&Number.isFinite(+xy[1]))coordinates.push([+xy[0],+xy[1]]);
 }
 routeCoordsKey=key;routeCoordsCached=coordinates;
 return coordinates;
}
function routeCameraPadding(){
  // The real sheet height evolves continuously during swipe and spring.
  const viewport=viewportHeight();
  const occupied=DATA.mapFocus?0:Math.min(viewport-165,Math.max(0,sheetHeight));
  const above=Math.max(165,viewport-occupied);
  const top=Math.max(32,Math.min(68,above*.13));
  const bottom=Math.max(24,Math.min(viewport-top-145,occupied+Math.min(30,above*.09)));
  const horizontal=Math.min(44,Math.max(25,(window.innerWidth||390)*.09));
  return {top,bottom,left:horizontal,right:horizontal};
}
function updateRouteCamera(animate=true){
 if(!DATA.open||!map||(DATA.mode==='pick'&&(DATA.mapFocus||DATA.pickMode==='map')))return;
 const coords=routeCoordinates();
 if(!coords.length)return;
 const lng=coords.map(p=>p[0]),lat=coords.map(p=>p[1]);
 const minLng=Math.min(...lng),maxLng=Math.max(...lng),minLat=Math.min(...lat),maxLat=Math.max(...lat);
 const singular=coords.length===1||(minLng===maxLng&&minLat===maxLat);
 const bounds=singular?[[minLng-.0012,minLat-.0012],[maxLng+.0012,maxLat+.0012]]:
  [[minLng,minLat],[maxLng,maxLat]];
 const padding=routeCameraPadding();
 try{
  if(typeof map.cameraForBounds==='function'){
   const target=map.cameraForBounds(bounds,{padding,maxZoom:singular?14.8:15.2});
   if(!target||!Number.isFinite(target.zoom)||!target.center)return;
   // Avoid needless WebGL renders after the sheet/camera has settled.
   const current=map.getCenter?.(),currentZoom=map.getZoom?.();
   const lng=Array.isArray(target.center)?target.center[0]:target.center.lng;
   const lat=Array.isArray(target.center)?target.center[1]:target.center.lat;
   if(!animate&&current&&Number.isFinite(lng)&&Number.isFinite(lat)&&
      Math.abs(current.lng-lng)<.000001&&Math.abs(current.lat-lat)<.000001&&
      Math.abs(currentZoom-target.zoom)<.002)return;
   if(animate){
    map.easeTo({center:target.center,zoom:target.zoom,duration:360,essential:true,
     easing:t=>t*t*(3-2*t)});
   }else{
    // Card and map camera update on one frame: no late secondary fit.
    map.jumpTo({center:target.center,zoom:target.zoom});
   }
   cameraMoves++;
  }else if(animate){
   map.fitBounds(bounds,{padding,maxZoom:singular?14.8:15.2,duration:360,essential:true});
   cameraMoves++;
  }
 }catch(e){console.warn('[V5 route camera] could not fit visible stars',e)}
}
function queueRouteCamera(animate=false){
 if(!DATA.open||!map||displayWaypoints().length===0||
   (DATA.mode==='pick'&&(DATA.mapFocus||DATA.pickMode==='map')))return;
 if(animate){
  if(cameraFrame){cancelAnimationFrame(cameraFrame);cameraFrame=0}
  updateRouteCamera(true);return;
 }
 // Never suppress frames during drag or while the card spring is active.
 if(cameraFrame)return;
 cameraFrame=requestAnimationFrame(()=>{cameraFrame=0;updateRouteCamera(false)});
}
function fit(){queueRouteCamera(!(dragging||frame))}
function quieter(on){
 if(on&&originalPaint.size)return;
 if(!on&&!originalPaint.size)return;
 // MapLibre may be streaming tiles while its style layers already exist.
 // The approved V5 planner deliberately applies paint without waiting for
 // isStyleLoaded() to become true; otherwise preview never looks subdued.
 if(!map)return;
 const style=map.getStyle?.()?.layers||[];
 if(!style.length)return;
 for(const layer of style){
  if(/^fp-single-/.test(layer.id))continue;
  let prop=null,value=null;
  if(layer.type==='symbol'){prop='text-opacity';value=.45}
  else if(layer.type==='fill'){prop='fill-opacity';value=.54}
  else if(layer.type==='fill-extrusion'){prop='fill-extrusion-opacity';value=.38}
  else if(layer.type==='line'){prop='line-opacity';value=.47}
  if(!prop)continue;
  const key=layer.id+'|'+prop;
  try{
   if(on){
    if(!originalPaint.has(key))originalPaint.set(key,{id:layer.id,prop,original:map.getPaintProperty(layer.id,prop)});
    map.setPaintProperty(layer.id,prop,value)
   }else if(originalPaint.has(key)){
    map.setPaintProperty(layer.id,prop,originalPaint.get(key).original??null)
   }
  }catch(_){}
 }
 if(!on)originalPaint.clear();
}
function syncMapMode(){
 if(!DATA.open)return;
 const preview=['saved','view','detail'].includes(DATA.mode);
 shell.dataset.routeMode=preview?'preview':'planning';
 document.body.classList.toggle('fp-route-picking',DATA.mode==='pick'||!!DATA.endpointMap);
 // Planning keeps the original hand-drawn POIs tappable; preview quiets them.
 document.body.classList.toggle('fp-unified-route-preview',preview);
 window.__atlasTripPicking=!['saved','view','detail'].includes(DATA.mode);
 quieter(DATA.mapFocus||preview);refreshStarLabels();temporaryMarkers();lines();
}
function starFeedback(id){
 const b=[...document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit')].find(el=>String(el.dataset.placeId)===String(id));
 const target=b?.querySelector('svg,img')||[...(b?.children||[])].find(node=>!node.classList.contains('fp-route-stop-order'));
 if(!target?.animate)return;
 target.animate([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:310,easing:'cubic-bezier(.2,.75,.2,1)'});
}

function dismissSelectionPopup(){
 if(selectionPopup){selectionPopup.remove();selectionPopup=null}
}
function showSelectedStopAction(id,number){
 dismissSelectionPopup();
 const p=place(id);if(!p||!map||!window.maplibregl?.Popup)return;
 const popup=new maplibregl.Popup({anchor:'bottom',closeButton:false,closeOnClick:false,
  maxWidth:'170px',offset:22,className:'fp-route-selection-popup'})
  .setLngLat([+p.lng,+p.lat])
  .setHTML('<button type="button" class="fp-route-remove-selected" aria-label="移出本次路线第 '+number+' 站">移出本次路线</button>')
  .addTo(map);
 selectionPopup=popup;
 popup.getElement()?.querySelector('.fp-route-remove-selected')?.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  dismissSelectionPopup();
  if(DATA.mode==='pick'&&DATA.order.includes(String(id)))removeSelectedStop(id);
 });
 popup.on('close',()=>{if(selectionPopup===popup)selectionPopup=null});
}
function selectStop(id){
 id=String(id);if(!DATA.open)return;
 const p=place(id);if(!p||!valid(p)||p.starred===false)return;
 starFeedback(id);
 if(['saved','view','detail'].includes(DATA.mode)){dismissSegmentPopup(true);DATA.selected=id;window.__atlasPOIBridge?.selectSaved?.(id);return}
 if(DATA.mode!=='pick')return;
 const index=DATA.order.indexOf(id);
 // Tapping a numbered star acknowledges it without removing the stop.
 if(index!==-1){showSelectedStopAction(id,index+1);return}
 dismissSelectionPopup();DATA.order.push(id);if(DATA.days[id]===undefined)DATA.days[id]=1;
 markChanged();body();syncMapMode();
 if(DATA.mapFocus)newestStarCamera(false);
 else if(DATA.pickMode!=='map')spring('peek');
 hint('已添加第 '+DATA.order.length+' 站');
}
function removeSelectedStop(id){
 dismissSelectionPopup();
 const index=DATA.order.indexOf(String(id));
 if(index<0)return;
 DATA.order.splice(index,1);delete DATA.days[id];
 markChanged();body();syncMapMode();hint('已从本次路线移除地点');
}
function clearSelections(){
 dismissSelectionPopup();DATA.order=[];DATA.days={};DATA.legModes={};DATA.history=[];
 DATA.routeId='';DATA.suggestion=null;DATA.returnToOrder=false;
 markChanged();body();syncMapMode();clearRouteDraft();hint('已清空本次选点，收藏未改变');
}
function onMapClick(e){
 if(!DATA.open||DATA.modal)return;
 // Native line-layer dispatch and the map's general click share one event.
 if(Date.now()-lastSegmentTap<320)return;
 if(['saved','order','view','detail'].includes(DATA.mode)&&e?.point&&map?.getLayer?.('fp-single-hit')){
  try{
   const p=e.point,margin=13;
   const box=[[p.x-margin,p.y-margin],[p.x+margin,p.y+margin]];
   const f=map.queryRenderedFeatures(box,{layers:['fp-single-hit']})?.find(f=>f?.properties?.from&&f?.properties?.to);
   if(f){showSegmentBubble(f.properties.from,f.properties.to,e.lngLat);return}
  }catch(_){}
 }
 if(segmentPopup)dismissSegmentPopup();
 dismissSelectionPopup();
 if(DATA.mode==='saved')return;
 if(DATA.mode==='pick'&&!DATA.mapFocus)enterMapFocus();
}
function onStarClick(e){
 if(!DATA.open)return;
 const b=e.target.closest?.('#atlasBookmarkOverlay .atlas-bookmark-hit');
 if(!b)return;
 const id=String(b.dataset.placeId||''),p=place(id);
 if(!p||!valid(p)||p.starred===false)return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 selectStop(p.id);
}
function routesWithExistingStars(routes=[]) {
 // Historical routes stay stored; show only real, currently anchored journeys.
 const stars=new Set(DATA.places.filter(p=>valid(p)&&p.starred!==false&&!p.demo&&!p.routeOnly).map(p=>String(p.id)));
 return routes.filter(r=>{
  if(r?.demo===true||r?.sample===true||r?.isDemo===true)return false;
  const ids=routeRows(r);
  return ids.length>=2&&new Set(ids).size>=2&&ids.every(id=>stars.has(id));
 });
}
async function reload(){
 const r=repo();if(!r)throw Error('原产品路线存储尚未加载');
 const [all,routes]=await Promise.all([r.list(),r.listRoutes()]);
 DATA.places=(all||[]).filter(valid).map(p=>({...p,id:String(p.id)}));
 DATA.routes=routesWithExistingStars(routes||[]).sort((a,b)=>Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0));
}
function reset(){
 DATA.mapFocus=false;document.body.classList.remove('fp-route-map-focus');DATA.savedPreviewId=DATA.routes.some(r=>String(r.id)===String(DATA.savedPreviewId))?String(DATA.savedPreviewId):String(DATA.routes[0]?.id||'');DATA.order=[];DATA.days={};DATA.suggestion=null;DATA.history=[];DATA.returnToOrder=false;DATA.pickMode='list';DATA.origin={type:'current'};DATA.dest={type:'last'};DATA.legModes={};DATA.endpointMap=null;DATA.modalEndpoint='';DATA.modal=null;DATA.dayView=0;modalClose();DATA.title='我的旅行路线';DATA.start=today();DATA.end=datePlus(DATA.start,2);DATA.travel='car';DATA.routeId='';DATA.selected='';DATA.pending=[];DATA.query='';DATA.mode='saved';
 activeRoads.clear();routeRevision++;
}
function loadSaved(id){
 const r=DATA.routes.find(x=>String(x.id)===String(id));
 if(!r){setMode('saved',true);hint('路线所需收藏地点尚未恢复；已保存数据没有删除');return}
 const samePreview=previewRouteId()===String(r.id);
 // Never reset() here. Saved-list and detail share a single route identity,
 // unchanged road cache, map instance, selected stops, and camera.
 dismissSegmentPopup(true);dismissSelectionPopup();
 DATA.savedPreviewId=String(r.id);DATA.routeId=String(r.id);
 DATA.title=String(r.title||'我的旅行路线');
 DATA.start=r.startDate||today();DATA.end=r.endDate||datePlus(DATA.start,2);
 DATA.travel=r.transportMode||r.travelMode||'car';
 if(DATA.travel==='city')DATA.travel='transit';
 DATA.order=routeRows(r).filter(stop=>{
  const p=place(stop);return p&&p.starred!==false&&!p.demo&&!p.routeOnly;
 });
 DATA.days=Object.fromEntries((r.stops||[]).map(x=>[String(x.placeId||x.id),Number(x.day)||1]));
 DATA.origin=r.routeOrigin||{type:'first'};
 DATA.dest=r.routeDestination||{type:'last'};
 DATA.legModes=r.legModes&&typeof r.legModes==='object'?{...r.legModes}:{};
 DATA.selected='';DATA.dayView=0;DATA.history=[];DATA.suggestion=null;
 DATA.pickMode='list';DATA.returnToOrder=false;
 setMode('view');
 if(!samePreview)fit(); // Switching to a DIFFERENT route may recenter once.
}
async function save(){
 if(DATA.busy)return;
 if(DATA.order.length<2){hint('请至少选择两个地点');return}
 const r=repo();if(!r){hint('存储不可用');return}
 DATA.busy=true;
 try{
  const id=DATA.routeId||(crypto.randomUUID?.()||'route-'+Date.now());
  const stops=DATA.order.map((placeId,i)=>({placeId,order:i+1,day:DATA.days[placeId]||1,time:''}));
  const temp=[...new Map(selectedPlaces().filter(Boolean).map(p=>[p.id,p])).values()].filter(p=>p.pending&&p.routeOnly===true&&p.starred===false).map(p=>({id:String(p.id),title:p.title||p.name||'地图选点',name:p.title||p.name||'地图选点',lat:+p.lat,lng:+p.lng,routeOnly:true,starred:false,createdAt:new Date().toISOString()}));
  const old=DATA.routes.find(x=>String(x.id)===String(id))||{};
  const record={...old,id,title:DATA.title.trim()||'我的旅行路线',startDate:DATA.start,endDate:DATA.end,travelMode:DATA.travel==='transit'?'city':DATA.travel,transportMode:DATA.travel,stops,placeIds:[...DATA.order],routeOrigin:{type:'first'},routeDestination:{type:'last'},originPlaceId:null,destinationPlaceId:null,legModes:{...DATA.legModes},updatedAt:new Date().toISOString()};
  await r.saveRoute(record,{places:temp});clearRouteDraft();
  DATA.routeId=id;DATA.savedPreviewId=String(id);DATA.history=[];DATA.routes=routesWithExistingStars(await r.listRoutes());
  DATA.places=DATA.places.map(p=>temp.some(t=>t.id===p.id)?{...p,pending:false}:p);
  document.dispatchEvent(new CustomEvent('footprint:route-saved',{detail:{id,placeIds:[...DATA.order]}}));
  history.replaceState(null,'','./index.html?route='+encodeURIComponent(id));
  setMode('view');fit();hint('路线已保存');
 }catch(e){console.warn('[V5 shared route] save',e);hint('保存失败：'+(e?.message||'请检查存储权限'))}
 finally{DATA.busy=false}
}
function navigate(){
 const to=selectedPlaces().at(-1);
 if(!to){hint('尚无可导航地点');return}
 window.__atlasOpenNavigation?.(to,{mode:DATA.travel,from:selectedPlaces()[0]});
}
function viewPlace(){
 const p=place(DATA.selected);if(!p)return;
 if(p.pending){hint('这个地点将在保存路线后可查看完整资料');return}
 // The approved homepage place/Brief/media card opens ABOVE the route sheet.
 // No second map, copied gallery or second place data controller.
 window.__atlasPOIBridge?.selectSaved?.(String(p.id));
}
function command(type,target){
 if(type==='dismiss-dialog'){modalClose();return}
 if(type==='confirm'){dialogOpen('save');return}
 if(type==='confirm-save'){modalClose();void save();return}
 if(type==='undo'){undo();return}
 if(type==='reset-places'){dialogOpen('clear');return}
 if(type==='confirm-clear'){modalClose();clearSelections();return}
 if(type==='remove-stop'){removeSelectedStop(target.dataset.id);return}
 if(type==='map-confirm'){
  if(DATA.order.length<2){hint('请至少选择两个地点');return}
  const next=DATA.returnToOrder?'order':'settings';setMode(next);if(next==='order')fit();return;
 }
 if(type==='addmore'){DATA.returnToOrder=true;DATA.pickMode='map';setMode('pick');enterMapFocus();return}
 if(type==='pickmode'){DATA.pickMode=target.dataset.value==='map'?'map':'list';body();if(DATA.pickMode==='map')enterMapFocus();else spring('half');return}
 if(type==='endpoint'){DATA.modalEndpoint=target.dataset.value;dialogOpen(DATA.modalEndpoint);return}
 if(type==='endpoint-choice'){chooseEndpoint(target.dataset.value);return}
 if(type==='endpoint-select'){endpointSet(target.dataset.id);return}
 if(type==='cancel-endpoint'){DATA.endpointMap=null;setMode('settings');return}
 if(type==='main-travel'){DATA.travel=target.dataset.value==='car'?'car':'walk';DATA.legModes={};markChanged();body();syncMapMode();return}
 if(type==='leg'){DATA.modalSeg=target.dataset.id;dialogOpen('segment');return}
 if(type==='segment-choice'){DATA.legModes[DATA.modalSeg]=target.dataset.value;modalClose();markChanged();body();syncMapMode();fit();if(DATA.mode==='view')void save();return}
 if(type==='dayview'){DATA.dayView=Number(target.dataset.value)||0;body();syncMapMode();fit();return}
 if(type==='exit'){close();return}
 if(type==='saved'){DATA.savedPreviewId=DATA.routeId||DATA.savedPreviewId;setMode('saved',true);return}
 if(type==='new'){clearRouteDraft();reset();setMode('pick',true);return}
 if(type==='open-saved'){loadSaved(target.dataset.id);return}
 if(type==='toggle'){selectStop(target.dataset.id);return}
 if(type==='settings'){if(DATA.order.length<2){hint('请先选择至少两个地点');return}const next=DATA.returnToOrder?'order':'settings';setMode(next);if(next==='order')fit();return}
 if(type==='pick'||type==='back'){DATA.returnToOrder=false;setMode('pick');return}
 if(type==='order'){if(DATA.end<DATA.start){hint('结束日期不能早于出发日期');return}setMode('order');fit();return}
 if(type==='day'){
  const id=String(target.dataset.id||'');snapshot('修改访问日期');if(!DATA.order.includes(id))return;
  const days=journeyDays();DATA.days[id]=((DATA.days[id]||1)%days)+1;
  body();hint('已调整为行程第 '+DATA.days[id]+' 天');return
 }
 if(type==='suggest'){void suggestOrder();return}
 if(type==='adopt-suggestion'){
  if(DATA.suggestion?.revision!==routeRevision)return;
  snapshot('采用路线建议');DATA.order=[...DATA.suggestion.order];DATA.suggestion=null;
  routeRevision++;body();syncMapMode();fit();hint('已采用建议顺序');return
 }
 if(type==='up'||type==='down'){
  const index=DATA.order.indexOf(target.dataset.id),other=index+(type==='up'?-1:1);
  if(index<0||other<0||other>=DATA.order.length)return;
  snapshot('调整访问顺序');[DATA.order[index],DATA.order[other]]=[DATA.order[other],DATA.order[index]];
  routeRevision++;
  body();syncMapMode();hint('路线顺序已更新');return
 }
 if(type==='travel'){snapshot('调整交通方式');DATA.travel=target.dataset.value;routeRevision++;body();syncMapMode();return}
 if(type==='save'){void save();return}
 if(type==='view'){setMode('view');return}
 if(type==='fit'){fit();spring('peek');return}
 if(type==='details'){const id=DATA.order[0];if(id){DATA.selected=id;setMode('detail')}return}
 if(type==='navigate'){navigate();return}
 if(type==='place-detail'){viewPlace();return}
}
shell.addEventListener('click',e=>{const t=e.target.closest('[data-command]');if(!t)return;e.preventDefault();command(t.dataset.command,t)});
ui.dialog.addEventListener('click',e=>{if(e.target===ui.dialog)modalClose()});
shell.addEventListener('input',e=>{
 const t=e.target;if(t.id==='fpUnifiedPlaceSearch'){DATA.query=t.value;const el=$('fpUnifiedAvailable');if(el)el.innerHTML=placeList()}
 if(t.id==='fpUnifiedTitle')DATA.title=t.value;
 if(t.id==='fpUnifiedStart'){snapshot('调整开始日期');DATA.start=t.value}
 if(t.id==='fpUnifiedEnd'){snapshot('调整结束日期');DATA.end=t.value}
});
// Finger-coupled ordering: the dragged row follows the finger, while other
// rows slide out of its way. Delay the DOM rebuild until visual settling.
let routeRowDrag=null,routeCommitTimer=0;
function clearDragRows(){
 for(const row of ui.body.querySelectorAll('.fp-route-reorder')){
  row.classList.remove('is-drop-target','is-drag-source');
  row.style.removeProperty('transform');row.style.removeProperty('transition');
 }
}
ui.body.addEventListener('pointerdown',e=>{
 const handle=e.target.closest?.('[data-grab]');if(!handle||e.isPrimary===false||routeRowDrag)return;
 if(routeCommitTimer){clearTimeout(routeCommitTimer);routeCommitTimer=0}
 const id=handle.dataset.grab,initial=DATA.order.indexOf(id);if(initial<0)return;
 const rows=[...ui.body.querySelectorAll('.fp-route-reorder')],rects=rows.map(r=>r.getBoundingClientRect());
 routeRowDrag={pointerId:e.pointerId,id,initial,target:initial,y:e.clientY,started:e.timeStamp,
  moved:false,handle,rows,centers:rects.map(r=>(r.top+r.bottom)/2),rowHeight:rects[initial]?.height||62};
 handle.setPointerCapture?.(e.pointerId);
},{passive:true});
ui.body.addEventListener('pointermove',e=>{
 const g=routeRowDrag;if(!g||g.pointerId!==e.pointerId)return;
 const dy=e.clientY-g.y;
 if(!g.moved&&Math.abs(dy)<6)return;
 g.moved=true;e.preventDefault();
 const target=g.centers.reduce((best,mid,i)=>Math.abs(e.clientY-mid)<Math.abs(e.clientY-g.centers[best])?i:best,g.initial);
 g.target=target;
 for(const [i,row] of g.rows.entries()){
  const source=i===g.initial;
  row.classList.toggle('is-drag-source',source);
  row.classList.toggle('is-drop-target',i===target&&!source);
  if(source){row.style.transition='none';row.style.transform='translate3d(0,'+dy.toFixed(1)+'px,0)'}
  else{
   row.style.transition='transform 170ms cubic-bezier(.22,.74,.22,1)';
   const shift=(target>g.initial&&i>g.initial&&i<=target)?-g.rowHeight:
      (target<g.initial&&i>=target&&i<g.initial)?g.rowHeight:0;
   row.style.transform=shift?'translate3d(0,'+shift.toFixed(1)+'px,0)':'translate3d(0,0,0)';
  }
 }
},{passive:false});
function finishRowDrag(e,cancelled=false){
 const g=routeRowDrag;if(!g||g.pointerId!==e.pointerId)return;
 routeRowDrag=null;
 try{g.handle.releasePointerCapture?.(e.pointerId)}catch(_){}
 if(cancelled||!g.moved||g.initial===g.target){clearDragRows();return}
 const endY=g.centers[g.target]-g.centers[g.initial];
 const row=g.rows[g.initial];
 row.style.transition='transform 175ms cubic-bezier(.22,.74,.22,1)';
 row.style.transform='translate3d(0,'+endY.toFixed(1)+'px,0)';
 const ids=[...DATA.order];ids.splice(g.initial,1);ids.splice(g.target,0,g.id);
 routeCommitTimer=setTimeout(()=>{
  routeCommitTimer=0;
  if(!DATA.open||DATA.mode!=='order')return;
  snapshot('调整访问顺序');DATA.order=ids;markChanged();
  clearDragRows();body();syncMapMode();
  // A reorder changes the connections, not the geographic camera.
  hint('路线顺序已更新');
 },175);
}
ui.body.addEventListener('pointerup',e=>finishRowDrag(e));
ui.body.addEventListener('pointercancel',e=>finishRowDrag(e,true));
ui.body.addEventListener('keydown',e=>{
 const handle=e.target.closest('[data-grab]');if(!handle||!['ArrowUp','ArrowDown'].includes(e.key))return;
 e.preventDefault();const i=DATA.order.indexOf(handle.dataset.grab),j=i+(e.key==='ArrowUp'?-1:1);
 if(j<0||j>=DATA.order.length)return;
 snapshot('调整访问顺序');[DATA.order[i],DATA.order[j]]=[DATA.order[j],DATA.order[i]];
 markChanged();body();syncMapMode();
  ui.body.querySelectorAll('[data-grab]')[j]?.focus()
});
// Route and the accepted location card share one three-detent gesture language.
// A gesture may begin on the grip, title/header, or unused card content.
// Never hijack buttons, fields, media, or native scrolling in full mode.
const gestureForbidden='button:not(.fp-route-grip),a,input,textarea,select,video,[contenteditable],[draggable="true"]';
const detents=['peek','half','full'];
let lastGripDragAt=0;
function beginSheetGesture(e,origin){
 if(!DATA.open||closing||sheetGesture||e.isPrimary===false||e.button!==0)return;
 if(e.target.closest?.(gestureForbidden))return;
 if(origin==='body'&&DATA.panel==='full')return; // full-sheet body scroll is native
 if(e.target.closest?.('.fp-route-reorder'))return;
 if(document.activeElement?.matches?.('input,textarea,select'))return;
 sheetGesture={id:e.pointerId,origin,startY:e.clientY,startX:e.clientX,
  startHeight:sheetHeight,previousY:e.clientY,startedAt:e.timeStamp,
  originDetent:DATA.panel,samples:[{y:e.clientY,t:e.timeStamp}],moved:false};
 dragging=true;velocity=0;ui.sheet.classList.remove('is-springing');
 cancelAnimationFrame(frame);frame=0;gestureToken++;
 try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_){}
}
function moveSheetGesture(e){
 const g=sheetGesture;if(!g||g.id!==e.pointerId)return;
 const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
 if(!g.moved){
  if(Math.abs(dx)>Math.abs(dy)*1.15&&Math.abs(dx)>8)return;
  if(Math.abs(dy)<4)return;
  g.moved=true;ui.sheet.classList.add('is-dragging');
  if(g.origin==='grip')lastGripDragAt=performance.now();
 }
 const full=heightFor('full'),peek=heightFor('peek');
 const desired=g.startHeight-dy;
 const resisted=desired>full?full+(desired-full)*.22:desired<peek?peek-(peek-desired)*.28:desired;
 height(Math.max(170,resisted));
 g.previousY=e.clientY;g.samples.push({y:e.clientY,t:e.timeStamp});
 while(g.samples.length>3&&e.timeStamp-g.samples[0].t>120)g.samples.shift();
 queueRouteCamera(false);
}
function finishSheetGesture(e,cancelled=false){
 const g=sheetGesture;if(!g||g.id!==e.pointerId)return;
 sheetGesture=null;dragging=false;ui.sheet.classList.remove('is-dragging');
 try{e.currentTarget.releasePointerCapture(e.pointerId)}catch(_){}
 if(!g.moved||cancelled){spring(g.originDetent);return}
 const last=g.samples.at(-1),first=g.samples[0];
 const v=(last.y-first.y)/Math.max(1,last.t-first.t); // + downward, CSS px/ms
 const dy=last.y-g.startY;
 if(g.originDetent==='peek'&&dy>95&&v>.28){enterMapFocus();return}
 // Preserve inertial motion at release; spring continuation must not restart flat.
 velocity=Math.max(-17,Math.min(17,-v*16.7*.55));
 const projected=sheetHeight-v*145;
 const sizes={peek:heightFor('peek'),half:heightFor('half'),full:heightFor('full')};
 let nearest=detents.reduce((best,key)=>Math.abs(projected-sizes[key])<Math.abs(projected-sizes[best])?key:best,'peek');
 const startIndex=detents.indexOf(g.originDetent),nearestIndex=detents.indexOf(nearest);
 if(Math.abs(v)>.58&&Math.abs(dy)>18){
  const step=v<0?1:-1;
  if((nearestIndex-startIndex)*step<=0)nearest=detents[Math.max(0,Math.min(2,startIndex+step))];
 }
 spring(nearest);
}
for(const [el,origin] of [[ui.grip,'grip'],[shell.querySelector('.fp-route-heading'),'header'],[shell.querySelector('.fp-route-status'),'status'],[ui.body,'body']]){
 el.addEventListener('pointerdown',e=>beginSheetGesture(e,origin));
 el.addEventListener('pointermove',moveSheetGesture);
 el.addEventListener('pointerup',finishSheetGesture);
 el.addEventListener('pointercancel',e=>finishSheetGesture(e,true));
 el.addEventListener('lostpointercapture',e=>{if(sheetGesture?.id===e.pointerId)finishSheetGesture(e,true)});
}
ui.miniGrip.addEventListener('click',()=>{if(DATA.mapFocus)leaveMapFocus()});
ui.miniGrip.addEventListener('keydown',e=>{if(DATA.mapFocus&&['Enter',' ','ArrowUp'].includes(e.key)){e.preventDefault();leaveMapFocus()}});
ui.grip.addEventListener('click',()=>{
 if(performance.now()-lastGripDragAt<430)return
 if(!DATA.open)return;
 const i=detents.indexOf(DATA.panel);spring(detents[i===2?1:i+1])
});
ui.grip.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();close()}
 else if(['ArrowUp','ArrowDown','Enter',' '].includes(e.key)){
  e.preventDefault();const i=detents.indexOf(DATA.panel),step=e.key==='ArrowDown'?-1:1;
  if(i===0&&step<0)enterMapFocus();else spring(detents[Math.max(0,Math.min(2,i+step))])
 }
});
/* In full detent the body scrolls naturally. Pulling DOWN from its top edge
   collapses the sheet instead of being swallowed by Safari rubber-band scroll.
   The header/grip also continue to work at every detent. */
let fullScrollTouch=null;
ui.body.addEventListener('touchstart',e=>{
 if(!DATA.open||DATA.panel!=='full'||e.touches.length!==1||ui.body.scrollTop>1)return;
 if(e.target.closest?.(gestureForbidden))return;
 const t=e.touches[0];fullScrollTouch={id:t.identifier,x:t.clientX,y:t.clientY,drag:false};
},{passive:true});
ui.body.addEventListener('touchmove',e=>{
 if(!fullScrollTouch||e.touches.length!==1)return;
 const t=e.touches[0],dy=t.clientY-fullScrollTouch.y,dx=t.clientX-fullScrollTouch.x;
 if(!fullScrollTouch.drag){
  if(dy<9||Math.abs(dx)>dy*.9||ui.body.scrollTop>1){if(dy<0)fullScrollTouch=null;return}
  beginSheetGesture({pointerId:100000+t.identifier,isPrimary:true,button:0,
   clientX:fullScrollTouch.x,clientY:fullScrollTouch.y,timeStamp:e.timeStamp,
   target:ui.body,currentTarget:ui.body},'full-scroll');
  fullScrollTouch.drag=!!sheetGesture;
 }
 if(fullScrollTouch.drag){
  e.preventDefault();
  moveSheetGesture({pointerId:100000+t.identifier,clientX:t.clientX,clientY:t.clientY,timeStamp:e.timeStamp});
 }
},{passive:false});
function endFullScrollTouch(e,cancelled=false){
 if(!fullScrollTouch)return;
 const gesture=fullScrollTouch;fullScrollTouch=null;
 if(!gesture.drag)return;
 const t=[...e.changedTouches].find(t=>t.identifier===gesture.id);
 if(t)moveSheetGesture({pointerId:100000+t.identifier,clientX:t.clientX,clientY:t.clientY,timeStamp:e.timeStamp});
 finishSheetGesture({pointerId:100000+gesture.id,currentTarget:ui.body},cancelled);
}
ui.body.addEventListener('touchend',e=>endFullScrollTouch(e));
ui.body.addEventListener('touchcancel',e=>endFullScrollTouch(e,true));
function detachMap(){
 window.__fpLiveRouting?.update?.([],[],DATA.travel,{});
 routeRevision++;activeRoads.clear();dismissSegmentPopup(true);dismissSelectionPopup();quieter(false);
 if(map&&routeClickListener)map.off('click',routeClickListener);
 if(map&&routeMoveListener){map.off('move',routeMoveListener);routeMoveListener=null}
 if(map&&routeSegmentListener){for(const layer of ['fp-single-hit'])try{map.off('click',layer,routeSegmentListener)}catch(_){}routeSegmentListener=null}
 if(styleMap&&styleListener)styleMap.off('style.load',styleListener);
 styleMap=null;styleListener=null;routeClickListener=null;
 if(map?.getLayer){for(const id of ['fp-single-hit','fp-single-order','fp-single-road','fp-single-outline','fp-single-selected-halo'])if(map.getLayer(id))try{map.removeLayer(id)}catch(_){}if(map.getSource('fp-single-route'))try{map.removeSource('fp-single-route')}catch(_){}}
 for(const p of tempPins.values())p.remove();tempPins.clear();clearStarLabels();filteredRouteOwner='';map=null;
}
function finishClose(){
 if(exitTimeout){clearTimeout(exitTimeout);exitTimeout=0}
 if(!closing)return;
 closing=false;
 ui.sheet.style.removeProperty('transition');
 ui.sheet.style.removeProperty('transform');
 ui.sheet.style.removeProperty('pointer-events');
 ui.sheet.classList.remove('is-dragging');
 detachMap(); // Teardown markers/layers before removing their route-scoped styles.
 document.body.classList.remove('fp-unified-route','fp-unified-route-preview','fp-route-map-focus','fp-route-picking');
 shell.hidden=true;
 if(observer){observer.disconnect();observer=null}
 if(new URLSearchParams(location.search).has('route'))history.replaceState(null,'','./index.html');
 document.dispatchEvent(new Event('footprint:route-mode-closed'))
}
function close(){
 if(!DATA.open||closing)return;
 preserveRouteDraft();DATA.mapFocus=false;document.body.classList.remove('fp-route-map-focus');
 dismissSegmentPopup(true);dismissSelectionPopup();clearStarLabels();
 // No temporary route geometry or stop numbers during the sheet's exit.
 // Teardown is completed later, but the home map is clean immediately.
 try{map?.getSource?.('fp-single-route')?.setData(geo([]))}catch(_){}
 for(const pin of tempPins.values())pin.remove();tempPins.clear();
 modalClose();DATA.endpointMap=null;
 sheetGesture=null;dragging=false;ui.sheet.classList.remove('is-dragging');
 if(cameraFrame){cancelAnimationFrame(cameraFrame);cameraFrame=0}
 document.removeEventListener('click',onStarClick,true);
 shiftMapTools(0);
 DATA.open=false;closing=true;window.__atlasTripPicking=false;
 cancelAnimationFrame(frame);frame=0;velocity=0;
 ui.sheet.style.pointerEvents='none';
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){finishClose();return}
 // Only the sheet exits. The MapLibre viewport stays the same size;
 // Paired Dock V2 waits for fp-unified-route to be released before returning.
 ui.sheet.style.transition='transform 330ms cubic-bezier(.22,.75,.24,1)';
 requestAnimationFrame(()=>{if(closing)ui.sheet.style.transform='translate3d(0,104%,0)'});
 exitTimeout=setTimeout(finishClose,380);
}
async function open(savedId=''){
 if(closing)finishClose();
 if(DATA.open){if(typeof savedId==='string'&&savedId)loadSaved(savedId);return}
 if(!getMap()){
  window.__atlasDemo?.vector?.();
  await new Promise(resolve=>{let n=0;const poll=setInterval(()=>{if(getMap()||++n>22){clearInterval(poll);resolve()}},150)});
 }
 map=getMap();if(!map){console.warn('[V5 route] shared Map A renderer unavailable; no second map created');return false}
 // Remove stale prototype route lines, never delete any stored route.
 window.__fpLiveRouting?.update?.([],[],DATA.travel,{});
 try{await reload()}catch(e){console.warn('[V5 route] failed to load original data',e);return false}
 prepareMapTools();
 DATA.open=true;window.__atlasTripPicking=true;document.body.classList.add('fp-unified-route');
 shell.hidden=false;
 window.__fpCloseSearch?.();
 $('navigationChooser')?.classList.remove('visible');
 $('closeDrawer')?.click?.();
 window.__atlasDemo?.close?.();
 // Ensure just one camera/route owner: attach to the existing map instance.
 routeClickListener=onMapClick;map.on('click',routeClickListener);
 routeMoveListener=queueSegmentPlacement;map.on('move',routeMoveListener);
 styleMap=map;styleListener=()=>{
  originalPaint.clear();
  if(DATA.open){
   syncMapMode();
   requestAnimationFrame(()=>{if(DATA.open){lines();queueRouteCamera(false)}});
  }
 };
 map.on('style.load',styleListener);
 document.addEventListener('click',onStarClick,true);
 observer=new MutationObserver(()=>{if(DATA.open)refreshStarLabels()});
 const bookmark=$('atlasBookmarkOverlay');if(bookmark)observer.observe(bookmark,{childList:true,subtree:false});
 reset();
 if(savedId){loadSaved(savedId);if(new URLSearchParams(location.search).get('editRoute')==='1')setMode('pick',true)}else if(restoreRouteDraft())setMode(DATA.mode,true);else setMode('saved',true);
 document.dispatchEvent(new Event('footprint:route-mode-opened'));
 return true
}
window.addEventListener('resize',()=>{if(DATA.open)spring(DATA.panel)},{passive:true});
let starsRefreshTicket=0;
 document.addEventListener('atlas:saved-stars-changed',()=>{
  if(!DATA.open)return;
  const ticket=++starsRefreshTicket;
  void (async()=>{
   try{
    await reload();
    if(!DATA.open||ticket!==starsRefreshTicket)return;
    const existing=new Set(DATA.places.filter(p=>valid(p)&&p.starred!==false&&!p.demo&&!p.routeOnly).map(p=>String(p.id)));
    const removed=DATA.order.some(id=>!existing.has(String(id)));
    if(removed){
     DATA.order=DATA.order.filter(id=>existing.has(String(id)));
     markChanged();
     if(DATA.mode==='view'||DATA.mode==='detail'){
      DATA.routeId='';setMode('saved',true);
      hint('部分收藏已变化，原路线已保留但暂不可查看');
      return;
     }
     if(['settings','order'].includes(DATA.mode)&&DATA.order.length<2)setMode('pick',true);
    }
    body();syncMapMode();if(removed)queueRouteCamera(true);
   }catch(e){console.warn('[V5 route] bookmark reconciliation unavailable',e)}
  })();
 });
const initial=new URLSearchParams(location.search),deeplink=initial.get('route');
if(deeplink||initial.get('openRoute')==='1')window.addEventListener('load',()=>{void open(deeplink||'')},{once:true});
window.FootprintUnifiedRoute=Object.freeze({
 version:'V5 same Map A instance 20261119 — saved stars focus',
 open,close,enterMapFocus,leaveMapFocus,
 get state(){return {open:DATA.open,step:DATA.mode,order:[...DATA.order],routeId:DATA.routeId,selected:DATA.selected,mapFocus:DATA.mapFocus,panel:DATA.panel,usableRoutes:DATA.routes.length,savedStars:DATA.places.filter(p=>p.starred!==false&&!p.demo&&!p.routeOnly).length,cameraMoves,cardHeight:Math.round(sheetHeight)}},
 get map(){return map},get savedCount(){return DATA.routes.length},
 get canvasCount(){return document.querySelectorAll('#atlasVectorMap canvas.maplibregl-canvas').length},
 get miniVisible(){return !!(DATA.open&&DATA.mapFocus)},
 get confirmDestination(){return DATA.returnToOrder?'order':'settings'}
});
})();
