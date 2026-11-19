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
const DATA={open:false,mode:'pick',panel:'half',places:[],routes:[],order:[],days:{},start:today(),end:datePlus(today(),2),title:'我的旅行路线',travel:'car',routeId:'',pending:[],busy:false,selected:'',savedView:false,dayView:0};
let db=null,map=null,routeRevision=0,activeRoads=new Map(),originalPaint=new Map(),tempPins=new Map(),sheetHeight=0,desiredHeight=0,velocity=0,frame=0,dragging=false,dragY=0,dragHeight=0,toastTimer=0,styleMap=null,styleListener=null,routeClickListener=null,observer=null,closing=false,exitTimeout=0;
let sheetGesture=null,lastCameraFrame=0,cameraFrame=0,cameraTime=0,gestureToken=0;
const shell=document.createElement('section');shell.id='fpUnifiedRoute';shell.hidden=true;shell.setAttribute('aria-label','足迹路线与地图');shell.innerHTML=
 '<header class="fp-route-top"><button class="fp-route-topbutton" type="button" data-command="exit" aria-label="返回主页">‹</button><div class="fp-route-title">路线</div></header>'+ 
 '<section class="fp-route-sheet" aria-label="路线操作卡片"><div class="fp-route-grip" role="button" tabindex="0" aria-label="上滑展开、下滑收起路线卡片"></div><div class="fp-route-heading"><h2>路线规划</h2><button type="button" class="fp-route-close" data-command="exit" aria-label="关闭路线卡片">×</button></div><div class="fp-route-status"><span class="fp-route-step">1 / 3</span><span class="fp-route-gesture-hint" aria-hidden="true">上滑查看更多</span></div><div class="fp-route-body"></div><div class="fp-route-footer"></div></section><div class="fp-route-toast" role="status" aria-live="polite"></div>';
document.body.append(shell);
const ui={top:shell.querySelector('.fp-route-title'),sheet:shell.querySelector('.fp-route-sheet'),grip:shell.querySelector('.fp-route-grip'),heading:shell.querySelector('.fp-route-heading h2'),step:shell.querySelector('.fp-route-step'),body:shell.querySelector('.fp-route-body'),footer:shell.querySelector('.fp-route-footer'),toast:shell.querySelector('.fp-route-toast')};
const repo=()=>db||(db=window.FootprintMediaCore?.createRepository?.(indexedDB));
const place=id=>DATA.places.find(p=>String(p.id)===String(id));
const selectedPlaces=()=>DATA.order.map(place).filter(valid);
const routeRows=r=>(r?.stops?.length?r.stops:r?.selected?.length?r.selected:r?.placeIds||[]).map(x=>typeof x==='string'?x:x?.placeId||x?.id).filter(Boolean).map(String);
const viewportHeight=()=>Math.max(430,Math.min(window.innerHeight||844,window.visualViewport?.height||window.innerHeight||844));
// In full mode we intentionally reserve a useful map viewport above the sheet.
// Content continues scrolling inside the sheet; the map canvas is never resized.
const heightFor=which=>{const h=viewportHeight(),full=Math.max(370,Math.min(h*.72,h-220));return which==='peek'?Math.min(full-145,Math.max(236,Math.min(280,h*.33))):which==='full'?full:Math.max(350,Math.min(full-75,h*.57))};
function height(value){sheetHeight=Math.max(175,Math.min(heightFor('full')+26,value));ui.sheet.style.setProperty('--fp-route-height',sheetHeight.toFixed(2)+'px');shell.style.setProperty('--fp-route-height',sheetHeight.toFixed(2)+'px');shell.dataset.detent=DATA.panel;}
function spring(which){
 if(!['peek','half','full'].includes(which))return;
 DATA.panel=which;desiredHeight=heightFor(which);cancelAnimationFrame(frame);frame=0;
 ui.sheet.classList.remove('is-dragging');
 if(matchMedia('(prefers-reduced-motion:reduce)').matches){height(desiredHeight);updateRouteCamera(true);return}
 let tick=0,last=0;
 const move=now=>{
  const dt=Math.min(1.7,Math.max(.3,(last?now-last:16.7)/16.7));last=now;
  velocity=(velocity+(desiredHeight-sheetHeight)*.17*dt)*Math.pow(.72,dt);
  height(sheetHeight+velocity*dt);queueRouteCamera(false);
  if((Math.abs(desiredHeight-sheetHeight)<.55&&Math.abs(velocity)<.48)||++tick>95){height(desiredHeight);velocity=0;frame=0;updateRouteCamera(true);return}
  frame=requestAnimationFrame(move)
 };
 frame=requestAnimationFrame(move)
}
function hint(value){ui.toast.textContent=value;ui.toast.classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('is-visible'),2600)}
function button(label,command,primary=false){return '<button type="button" class="fp-route-btn '+(primary?'fp-route-primary':'fp-route-secondary')+'" data-command="'+command+'">'+label+'</button>'}
function head(title,step){ui.heading.textContent=title;ui.step.textContent=step;ui.top.textContent=DATA.mode==='saved'?'路线':DATA.mode==='view'?DATA.title:'路线规划'}
function placeList(){
 let q=(DATA.query||'').trim();
 const available=DATA.places.filter(p=>valid(p)&&p.starred!==false&&!p.demo&&(!q||String(p.title||p.name||'').includes(q))).slice(0,130);
 if(!available.length)return '<div class="fp-route-empty">'+(q?'没有匹配地点':'还没有收藏地点。可以先返回地图收藏地点，或直接在地图点选。')+'</div>';
 return available.map(p=>{
  const chosen=DATA.order.includes(String(p.id));
  return '<div class="fp-route-place"><span class="fp-route-index">'+(chosen?'★':'☆')+'</span><div class="fp-route-name"><strong>'+esc(p.title||p.name)+'</strong><small>'+esc(p.address||p.city||'收藏地点')+'</small></div><button class="fp-route-btn '+(chosen?'is-active':'')+'" data-command="toggle" data-id="'+esc(p.id)+'" aria-label="'+(chosen?'移除':'添加')+esc(p.title||p.name)+'">'+(chosen?'✓':'＋')+'</button></div>'
 }).join('');
}
function listSaved(routes=DATA.routes){
 if(!routes.length)return '<div class="fp-route-empty">尚无已保存路线。先选择两个地点规划第一条路线。</div>';
 return routes.map(r=>{const count=routeRows(r).length;return '<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">↗</span><strong>'+esc(r.title||'我的旅行路线')+'</strong><button class="fp-route-btn" data-command="open-saved" data-id="'+esc(r.id)+'" aria-label="查看已保存路线">查看</button></div><div class="fp-route-caption">'+esc(r.startDate||'')+(r.endDate?' — '+esc(r.endDate):'')+' · '+count+' 个地点</div></div>'}).join('')
}
function orderList(){
 return DATA.order.map((id,i)=>{
  const p=place(id);if(!p)return '';
  return '<div class="fp-route-reorder" data-stop="'+esc(id)+'" draggable="true"><span class="fp-route-index">'+(i+1)+'</span><span class="fp-route-name">'+esc(p.title||p.name||'地点')+'</span><button type="button" class="fp-route-day" data-command="day" data-id="'+esc(id)+'" aria-label="调整访问日期，当前第'+(DATA.days[id]||1)+'天">D'+(DATA.days[id]||1)+'</button><button type="button" data-command="up" data-id="'+esc(id)+'" aria-label="提前一站">↑</button><button type="button" data-command="down" data-id="'+esc(id)+'" aria-label="延后一站">↓</button></div>'
 }).join('');
}
function body(){
 const n=DATA.order.length;
 if(DATA.mode==='saved'){
  head('我的路线',DATA.routes.length+' 条');
  const recent=DATA.routes.slice(0,1),older=DATA.routes.slice(1);
  ui.body.innerHTML='<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">01</span><strong>最近路线</strong></div>'+
    (recent.length?'<div class="fp-route-saved-list">'+listSaved(recent)+'</div>':'<p class="fp-route-caption">还没有保存的路线。可以直接在地图上选点开始规划。</p>')+'</div>'+
    (older.length?'<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">02</span><strong>已保存路线</strong></div><div class="fp-route-saved-list">'+listSaved(older)+'</div></div>':'');
  ui.footer.innerHTML=button('新建路线','new',true);return;
 }
 if(DATA.mode==='pick'){
  head('选择地点','1 / 3');
  ui.body.innerHTML='<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">01</span><strong>地图选点与收藏地点</strong><span class="fp-route-mode-label">'+n+' 处已选</span></div><p class="fp-route-caption">点地图黄星可加入或移除路线；地图上其他地点也可选取。下方仅保留必要操作。</p></div>'+
   '<label class="fp-route-field" for="fpUnifiedPlaceSearch">搜索已收藏地点</label><input class="fp-route-input" id="fpUnifiedPlaceSearch" placeholder="输入地点名称…" value="'+esc(DATA.query||'')+'">'+
   '<div id="fpUnifiedAvailable">'+placeList()+'</div>';
  ui.footer.innerHTML=button('已保存路线','saved')+button('下一步 · 行程设置','settings',true);return;
 }
 if(DATA.mode==='settings'){
  head('行程设置','2 / 3');
  ui.body.innerHTML='<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">02</span><strong>路线基本信息</strong></div>'+
   '<label class="fp-route-field" for="fpUnifiedTitle">路线名称</label><input class="fp-route-input" id="fpUnifiedTitle" maxlength="64" value="'+esc(DATA.title)+'">'+
   '<label class="fp-route-field" for="fpUnifiedStart">出发日期</label><input type="date" class="fp-route-input" id="fpUnifiedStart" value="'+esc(DATA.start)+'">'+
   '<label class="fp-route-field" for="fpUnifiedEnd">结束日期</label><input type="date" class="fp-route-input" id="fpUnifiedEnd" value="'+esc(DATA.end)+'">'+
   '<div class="fp-route-field">出行方式</div><div class="fp-route-segment">'+[['car','驾车'],['walk','步行'],['bike','骑行'],['transit','公交']].map(([m,l])=>'<button class="fp-route-btn '+(DATA.travel===m?'is-active':'')+'" data-command="travel" data-value="'+m+'">'+l+'</button>').join('')+'</div></div>';
  ui.footer.innerHTML=button('返回选点','pick')+button('下一步 · 排列顺序','order',true);return;
 }
 if(DATA.mode==='order'){
  head('排列顺序','3 / 3');
  ui.body.innerHTML='<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">03</span><strong>访问顺序</strong></div><div class="fp-route-caption">上下调整站点，地图线路实时对应。没有路网结果的连接显示为虚线示意，不代表真实道路。</div>'+
   orderList()+'</div><div class="fp-route-recommendation">'+
   (DATA.suggestion?.revision===routeRevision
     ?'<p>按可获取的道路距离，建议的访问顺序预计可减少约 '+DATA.suggestion.saving+'% 的绕路；不代表实时路况。</p>'+button('采用建议顺序','adopt-suggestion',true)
     :button('检查是否有更顺的访问顺序','suggest'))+'</div>';
  ui.footer.innerHTML=button('返回设置','settings')+button('保存并预览','save',true);return;
 }
 if(DATA.mode==='view'){
  head(DATA.title,'路线预览');
  ui.body.innerHTML='<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">✓</span><strong>路线预览</strong><span class="fp-route-mode-label">'+n+' 站</span></div><p class="fp-route-caption">'+esc(DATA.start)+' — '+esc(DATA.end)+' · '+({car:'驾车',walk:'步行',bike:'骑行',transit:'公交'}[DATA.travel]||'规划中')+'。底图已适度降低干扰，路线和黄星保持清晰。</p><div class="fp-route-actions">'+button('地图总览','fit')+button('站点详情','details')+'</div></div>';
  ui.footer.innerHTML=button('编辑路线','pick')+button('选择导航','navigate',true);return;
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
  ui.footer.innerHTML=button('返回路线','view')+(p&&!p.pending?button('打开完整地点卡片','place-detail',true):'');return;
 }
}
function setMode(next,force=false){
 DATA.mode=next;DATA.selected=next==='detail'?DATA.selected:'';
 body();syncMapMode();spring(next==='view'?'peek':next==='detail'?'half':next==='pick'&&!force?'peek':'half');
}
function stopIndex(){return new Map(DATA.order.map((id,i)=>[String(id),i+1]))}
function refreshStarLabels(){
 if(!DATA.open)return;
 const index=stopIndex();document.querySelectorAll('#atlasBookmarkOverlay .atlas-bookmark-hit').forEach(b=>{
  const n=index.get(String(b.dataset.placeId));
  const old=b.querySelector('.fp-route-stop-order');
  if(!n){old?.remove();return}
  const node=old||document.createElement('span');node.className='fp-route-stop-order';node.textContent=n;if(!old)b.append(node);
 });
}
function clearStarLabels(){document.querySelectorAll('#atlasBookmarkOverlay .fp-route-stop-order').forEach(n=>n.remove())}
function temporaryMarkers(){
 if(!map)return;
 const selected=new Set(DATA.order);
 for(const [id,pin] of tempPins)if(!selected.has(id)){pin.remove();tempPins.delete(id)}
 DATA.order.forEach((id,i)=>{
  const p=place(id);if(!p||p.starred!==false||tempPins.has(id))return;
  const el=document.createElement('button');el.type='button';el.className='fp-route-temp-marker';el.dataset.id=id;el.innerHTML='<span class="fp-route-temp-number">'+(i+1)+'</span>';
   el.setAttribute('aria-label','路线临时站点 '+(i+1));
  el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectStop(id)});
  const pin=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([+p.lng,+p.lat]).addTo(map);tempPins.set(id,pin);
 });
 for(const [id,pin] of tempPins){const n=DATA.order.indexOf(id);if(n>=0){const tag=pin.getElement().querySelector('span');if(tag)tag.textContent=n+1}}
}
const geo=(features)=>({type:'FeatureCollection',features});
function ensureLineLayers(){
 if(!map||!map.isStyleLoaded?.())return false;
 if(!map.getSource('fp-single-route'))map.addSource('fp-single-route',{type:'geojson',data:geo([])});
 const layers=[
 ['fp-single-outline',['==',['get','kind'],'road'],{'line-color':'#fffefa','line-width':9,'line-opacity':1}],
 ['fp-single-road',['==',['get','kind'],'road'],{'line-color':'#3f6654','line-width':4.5,'line-opacity':1}],
 ['fp-single-order',['==',['get','kind'],'sequence'],{'line-color':'#d9b56b','line-width':3,'line-opacity':.93,'line-dasharray':[1.1,1.4]}]
 ];
 for(const [id,filter,paint] of layers)if(!map.getLayer(id))map.addLayer({id,type:'line',source:'fp-single-route',filter,paint,layout:{'line-cap':'round','line-join':'round'}});
 return true
}
function lines(){
 if(!DATA.open||!ensureLineLayers())return;
 const pts=selectedPlaces(),features=[];
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],key=DATA.travel+'|'+a.id+'|'+b.id;
  const hit=activeRoads.get(key);
  const kind=hit?.status==='ok'?'road':'sequence';
  features.push({type:'Feature',properties:{kind,from:a.id,to:b.id},geometry:{type:'LineString',coordinates:kind==='road'?hit.geometry:[[+a.lng,+a.lat],[+b.lng,+b.lat]]}});
 }
 map.getSource('fp-single-route')?.setData(geo(features));
 if(pts.length>1){
  const revision=routeRevision,request=window.__fpLiveRouting?.get;
  if(request&&DATA.travel!=='transit')for(let i=1;i<pts.length;i++){
   const a=pts[i-1],b=pts[i],key=DATA.travel+'|'+a.id+'|'+b.id;
   if(activeRoads.has(key))continue;
   activeRoads.set(key,{status:'loading'});
   Promise.resolve(request(a,b,DATA.travel)).then(hit=>{
    if(revision!==routeRevision||!DATA.open)return;
    activeRoads.set(key,hit||{status:'error'});lines();if(hit?.status==='ok')queueRouteCamera(true)
   }).catch(()=>{activeRoads.set(key,{status:'error'});if(revision===routeRevision)lines()});
  }
 }
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
 if(DATA.travel==='transit'||!road?.prepareMatrix||!road?.metric){hint('该出行方式暂无可验证的道路距离建议');return}
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
 const pts=selectedPlaces(),coordinates=pts.map(p=>[+p.lng,+p.lat]);
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i];
  const road=activeRoads.get(DATA.travel+'|'+a.id+'|'+b.id);
  if(road?.status!=='ok'||!Array.isArray(road.geometry))continue;
  for(const coord of road.geometry)if(Array.isArray(coord)&&Number.isFinite(+coord[0])&&Number.isFinite(+coord[1]))coordinates.push([+coord[0],+coord[1]]);
 }
 return coordinates;
}
function routeCameraPadding(){
 const screen=viewportHeight(),visible=Math.max(160,screen-sheetHeight);
 return {top:Math.max(26,Math.min(82,visible*.18)),
  bottom:Math.min(screen-100,sheetHeight+Math.min(26,visible*.11)),left:36,right:36};
}
function updateRouteCamera(animate=true){
 if(!DATA.open||!map||DATA.mode==='saved')return;
 const pts=routeCoordinates();
 if(!pts.length)return; // Never move the map before the user selects a place.
 const padding=routeCameraPadding(),duration=animate?320:155;
 try{
  if(pts.length===1){map.easeTo({center:pts[0],padding,maxZoom:15.2,zoom:Math.min(14,map.getZoom?.()||14),duration,essential:true});return}
  const lng=pts.map(p=>p[0]),lat=pts.map(p=>p[1]);
  map.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]],
   {padding,maxZoom:15.2,duration,essential:true});
 }catch(e){console.debug('[V5 route] map camera fit unavailable',e)}
}
function queueRouteCamera(animate=false){
 if(!DATA.open||!map||DATA.mode==='saved'||DATA.order.length===0)return;
 if(animate){if(cameraFrame)cancelAnimationFrame(cameraFrame);cameraFrame=0;cameraTime=performance.now();updateRouteCamera(true);return}
 const now=performance.now();
 // At most ~7 camera reframes/sec during gestures, no WebGL canvas resizes.
 if(cameraFrame||now-cameraTime<140)return;
 cameraTime=now;cameraFrame=requestAnimationFrame(()=>{cameraFrame=0;updateRouteCamera(false)});
}
function fit(){queueRouteCamera(true)}
function quieter(on){
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
 const preview=DATA.mode==='view'||DATA.mode==='detail';
 shell.dataset.routeMode=preview?'preview':'planning';
 // Planning keeps the original hand-drawn POIs tappable; preview quiets them.
 document.body.classList.toggle('fp-unified-route-preview',preview);
 quieter(preview);refreshStarLabels();temporaryMarkers();lines();
}
function selectStop(id){
 id=String(id);if(!DATA.open)return;
 if(DATA.mode==='view'||DATA.mode==='detail'){
  DATA.selected=id;setMode('detail');hint('已选中路线站点');return
 }
 const index=DATA.order.indexOf(id);
 routeRevision++;activeRoads.clear();
 if(index===-1)DATA.order.push(id);else DATA.order.splice(index,1);
 body();syncMapMode();spring('peek');hint(index===-1?'已添加站点 · 地图路线已更新':'已从路线移除站点');
}
function onMapClick(e){
 if(!DATA.open||DATA.mode!=='pick'||!e.lngLat||!valid({lat:e.lngLat.lat,lng:e.lngLat.lng}))return;
 if(e.originalEvent?.target?.closest?.('#fpUnifiedRoute,#atlasBookmarkOverlay,.fp-poi'))return;
 const lon=+e.lngLat.lng,lat=+e.lngLat.lat;
 const old=DATA.places.find(p=>valid(p)&&Math.hypot((p.lng-lon)*Math.cos(lat*Math.PI/180),(p.lat-lat))<.00012);
 if(old){selectStop(old.id);return}
 const id='route-map-'+(crypto.randomUUID?.()||Date.now().toString(36));
 DATA.places.push({id,title:'地图选点 '+(DATA.order.length+1),lat,lng,routeOnly:true,starred:false,pending:true});
 DATA.order.push(id);routeRevision++;activeRoads.clear();body();syncMapMode();spring('peek');hint('已添加地图选点 · 保存时才写入数据');
}
function onStarClick(e){
 if(!DATA.open)return;
 const b=e.target.closest?.('#atlasBookmarkOverlay .atlas-bookmark-hit,#atlasPoiOverlay .fp-poi');
 if(!b)return;
 const id=String(b.dataset.placeId||'');
 let p=place(id);
 if(!p&&b.classList.contains('fp-poi')){
  const loc={lat:Number(b.dataset.poiLat),lng:Number(b.dataset.poiLng)};
  p=DATA.places.find(x=>valid(x)&&Math.hypot((x.lng-loc.lng)*Math.cos(loc.lat*Math.PI/180),x.lat-loc.lat)<.00012);
  if(!p&&valid(loc)){
   const k='route-poi-'+(b.dataset.poiId||crypto.randomUUID?.()||Date.now());
   p={id:k,title:b.dataset.poiName||'地图地点',...loc,routeOnly:true,starred:false,pending:true};
   DATA.places.push(p);
  }
 }
 if(!p)return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();selectStop(p.id);
}
async function reload(){
 const r=repo();if(!r)throw Error('原产品路线存储尚未加载');
 const [all,routes]=await Promise.all([r.list(),r.listRoutes()]);
 DATA.places=all.filter(valid).map(p=>({...p,id:String(p.id)}));
 DATA.routes=routes||[];
}
function reset(){
 DATA.order=[];DATA.days={};DATA.suggestion=null;DATA.title='我的旅行路线';DATA.start=today();DATA.end=datePlus(DATA.start,2);DATA.travel='car';DATA.routeId='';DATA.selected='';DATA.pending=[];DATA.query='';
 activeRoads.clear();routeRevision++;
}
function loadSaved(id){
 const r=DATA.routes.find(x=>String(x.id)===String(id));
 if(!r){hint('这条路线尚未找到');return}
 reset();DATA.routeId=String(r.id);DATA.title=String(r.title||DATA.title);
 DATA.start=r.startDate||DATA.start;DATA.end=r.endDate||DATA.end;DATA.travel=r.transportMode||r.travelMode||'car';
 if(DATA.travel==='city')DATA.travel='transit';
 DATA.order=routeRows(r).filter(id=>!!place(id));DATA.days=Object.fromEntries((r.stops||[]).map(x=>[String(x.placeId||x.id),Number(x.day)||1]));
 DATA.selected='';setMode('view');fit();hint('已打开已保存路线');
}
async function save(){
 if(DATA.busy)return;
 if(DATA.order.length<2){hint('请至少选择两个地点');return}
 const r=repo();if(!r){hint('存储不可用');return}
 DATA.busy=true;
 try{
  const id=DATA.routeId||(crypto.randomUUID?.()||'route-'+Date.now());
  const stops=DATA.order.map((placeId,i)=>({placeId,order:i+1,day:DATA.days[placeId]||1,time:''}));
  const temp=selectedPlaces().filter(p=>p.pending&&p.routeOnly===true&&p.starred===false).map(p=>({id:String(p.id),title:p.title||p.name||'地图选点',name:p.title||p.name||'地图选点',lat:+p.lat,lng:+p.lng,routeOnly:true,starred:false,createdAt:new Date().toISOString()}));
  const old=DATA.routes.find(x=>String(x.id)===String(id))||{};
  const record={...old,id,title:DATA.title.trim()||'我的旅行路线',startDate:DATA.start,endDate:DATA.end,travelMode:DATA.travel==='transit'?'city':DATA.travel,transportMode:DATA.travel,stops,placeIds:[...DATA.order],updatedAt:new Date().toISOString()};
  await r.saveRoute(record,{places:temp});
  DATA.routeId=id;DATA.routes=await r.listRoutes();
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
 if(type==='exit'){close();return}
 if(type==='saved'){setMode('saved',true);return}
 if(type==='new'){reset();setMode('pick',true);return}
 if(type==='open-saved'){loadSaved(target.dataset.id);return}
 if(type==='toggle'){selectStop(target.dataset.id);return}
 if(type==='settings'){if(DATA.order.length<2){hint('请先选择至少两个地点');return}setMode('settings');return}
 if(type==='pick'||type==='back'){setMode(type==='back'?'pick':type);return}
 if(type==='order'){if(DATA.end<DATA.start){hint('结束日期不能早于出发日期');return}setMode('order');fit();return}
 if(type==='day'){
  const id=String(target.dataset.id||'');if(!DATA.order.includes(id))return;
  const days=journeyDays();DATA.days[id]=((DATA.days[id]||1)%days)+1;
  body();hint('已调整为行程第 '+DATA.days[id]+' 天');return
 }
 if(type==='suggest'){void suggestOrder();return}
 if(type==='adopt-suggestion'){
  if(DATA.suggestion?.revision!==routeRevision)return;
  DATA.order=[...DATA.suggestion.order];DATA.suggestion=null;
  routeRevision++;activeRoads.clear();body();syncMapMode();fit();hint('已采用建议顺序');return
 }
 if(type==='up'||type==='down'){
  const index=DATA.order.indexOf(target.dataset.id),other=index+(type==='up'?-1:1);
  if(index<0||other<0||other>=DATA.order.length)return;
  [DATA.order[index],DATA.order[other]]=[DATA.order[other],DATA.order[index]];
  routeRevision++;activeRoads.clear();
  body();syncMapMode();hint('路线顺序已更新');return
 }
 if(type==='travel'){DATA.travel=target.dataset.value;activeRoads.clear();routeRevision++;body();syncMapMode();return}
 if(type==='save'){void save();return}
 if(type==='view'){setMode('view');return}
 if(type==='fit'){fit();spring('peek');return}
 if(type==='details'){const id=DATA.order[0];if(id){DATA.selected=id;setMode('detail')}return}
 if(type==='navigate'){navigate();return}
 if(type==='place-detail'){viewPlace();return}
}
shell.addEventListener('click',e=>{const t=e.target.closest('[data-command]');if(!t)return;e.preventDefault();command(t.dataset.command,t)});
shell.addEventListener('input',e=>{
 const t=e.target;if(t.id==='fpUnifiedPlaceSearch'){DATA.query=t.value;const el=$('fpUnifiedAvailable');if(el)el.innerHTML=placeList()}
 if(t.id==='fpUnifiedTitle')DATA.title=t.value;
 if(t.id==='fpUnifiedStart')DATA.start=t.value;
 if(t.id==='fpUnifiedEnd')DATA.end=t.value;
});
shell.addEventListener('dragstart',e=>{const el=e.target.closest('[data-stop]');if(el){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',el.dataset.stop)}});
shell.addEventListener('dragover',e=>{if(e.target.closest('[data-stop]'))e.preventDefault()});
shell.addEventListener('drop',e=>{
 const el=e.target.closest('[data-stop]');if(!el)return;e.preventDefault();
 const a=e.dataTransfer.getData('text/plain'),b=el.dataset.stop;
 const ai=DATA.order.indexOf(a),bi=DATA.order.indexOf(b);if(ai<0||bi<0||ai===bi)return;
 DATA.order.splice(ai,1);DATA.order.splice(bi,0,a);routeRevision++;activeRoads.clear();body();syncMapMode();hint('拖动顺序已更新')
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
 dragging=true;velocity=0;
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
 if(g.originDetent==='peek'&&dy>95&&v>.28){close();return}
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
ui.grip.addEventListener('click',()=>{
 if(performance.now()-lastGripDragAt<430)return
 if(!DATA.open)return;
 const i=detents.indexOf(DATA.panel);spring(detents[i===2?1:i+1])
});
ui.grip.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();close()}
 else if(['ArrowUp','ArrowDown','Enter',' '].includes(e.key)){
  e.preventDefault();const i=detents.indexOf(DATA.panel),step=e.key==='ArrowDown'?-1:1;
  if(i===0&&step<0)close();else spring(detents[Math.max(0,Math.min(2,i+step))])
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
 routeRevision++;activeRoads.clear();quieter(false);
 if(map&&routeClickListener)map.off('click',routeClickListener);
 if(styleMap&&styleListener)styleMap.off('style.load',styleListener);
 styleMap=null;styleListener=null;routeClickListener=null;
 if(map?.getLayer){for(const id of ['fp-single-order','fp-single-road','fp-single-outline'])if(map.getLayer(id))try{map.removeLayer(id)}catch(_){}if(map.getSource('fp-single-route'))try{map.removeSource('fp-single-route')}catch(_){}}
 for(const p of tempPins.values())p.remove();tempPins.clear();clearStarLabels();map=null;
}
function finishClose(){
 if(exitTimeout){clearTimeout(exitTimeout);exitTimeout=0}
 if(!closing)return;
 closing=false;
 ui.sheet.style.removeProperty('transition');
 ui.sheet.style.removeProperty('transform');
 ui.sheet.style.removeProperty('pointer-events');
 ui.sheet.classList.remove('is-dragging');
 document.body.classList.remove('fp-unified-route','fp-unified-route-preview');
 shell.hidden=true;detachMap();
 if(observer){observer.disconnect();observer=null}
 if(new URLSearchParams(location.search).has('route'))history.replaceState(null,'','./index.html');
 document.dispatchEvent(new Event('footprint:route-mode-closed'))
}
function close(){
 if(!DATA.open||closing)return;
 sheetGesture=null;dragging=false;ui.sheet.classList.remove('is-dragging');
 if(cameraFrame){cancelAnimationFrame(cameraFrame);cameraFrame=0}
 document.removeEventListener('click',onStarClick,true);
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
 try{await reload()}catch(e){console.warn('[V5 route] failed to load original data',e);return false}
 DATA.open=true;window.__atlasTripPicking=true;document.body.classList.add('fp-unified-route');
 shell.hidden=false;
 window.__fpCloseSearch?.();
 $('navigationChooser')?.classList.remove('visible');
 $('closeDrawer')?.click?.();
 window.__atlasDemo?.close?.();
 // Ensure just one camera/route owner: attach to the existing map instance.
 routeClickListener=onMapClick;map.on('click',routeClickListener);
 styleMap=map;styleListener=()=>{originalPaint.clear();if(DATA.open)syncMapMode()};
 map.on('style.load',styleListener);
 document.addEventListener('click',onStarClick,true);
 observer=new MutationObserver(()=>{if(DATA.open)refreshStarLabels()});
 const bookmark=$('atlasBookmarkOverlay');if(bookmark)observer.observe(bookmark,{childList:true,subtree:false});
 reset();
 if(savedId){loadSaved(savedId);if(new URLSearchParams(location.search).get('editRoute')==='1')setMode('pick',true)}else setMode('saved',true);
 spring('half');
 document.dispatchEvent(new Event('footprint:route-mode-opened'));
 return true
}
window.addEventListener('resize',()=>{if(DATA.open)spring(DATA.panel)},{passive:true});
document.addEventListener('atlas:saved-stars-changed',()=>{if(DATA.open)refreshStarLabels()});
const initial=new URLSearchParams(location.search),deeplink=initial.get('route');
if(deeplink||initial.get('openRoute')==='1')window.addEventListener('load',()=>{void open(deeplink||'')},{once:true});
window.FootprintUnifiedRoute=Object.freeze({
 version:'V5 same Map A instance 20261119',
 open,close,
 get state(){return {open:DATA.open,step:DATA.mode,order:[...DATA.order],routeId:DATA.routeId,selected:DATA.selected}},
 get map(){return map},get savedCount(){return DATA.routes.length},
 get canvasCount(){return document.querySelectorAll('#atlasVectorMap canvas.maplibregl-canvas').length}
});
})();
