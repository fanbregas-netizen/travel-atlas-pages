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
const datePlus=(value,n)=>{const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
const getMap=()=>window.__atlasPOIBridge?.vector?.()||null;
const DATA={open:false,mode:'pick',panel:'half',places:[],routes:[],order:[],days:{},start:today(),end:datePlus(today(),2),title:'我的旅行路线',travel:'car',routeId:'',pending:[],busy:false,selected:'',savedView:false,dayView:0};
let db=null,map=null,routeRevision=0,activeRoads=new Map(),originalPaint=new Map(),tempPins=new Map(),sheetHeight=0,desiredHeight=0,velocity=0,frame=0,dragging=false,dragY=0,dragHeight=0,toastTimer=0,styleMap=null,styleListener=null,routeClickListener=null,observer=null;
const shell=document.createElement('section');shell.id='fpUnifiedRoute';shell.hidden=true;shell.setAttribute('aria-label','足迹路线与地图');shell.innerHTML=
 '<header class="fp-route-top"><button class="fp-route-topbutton" type="button" data-command="exit" aria-label="返回主页">‹</button><div class="fp-route-title">路线</div><button class="fp-route-topbutton" type="button" data-command="saved" aria-label="已保存路线">▤</button><button class="fp-route-topbutton" type="button" data-command="new" aria-label="新建路线">＋</button></header>'+
 '<section class="fp-route-sheet" aria-label="路线操作卡片"><div class="fp-route-grip" role="button" tabindex="0" aria-label="上下拖动路线卡片"></div><div class="fp-route-heading"><h2>路线规划</h2><span class="fp-route-step">1 / 3</span></div><div class="fp-route-body"></div><div class="fp-route-footer"></div></section><div class="fp-route-toast" role="status" aria-live="polite"></div>';
document.body.append(shell);
const ui={top:shell.querySelector('.fp-route-title'),sheet:shell.querySelector('.fp-route-sheet'),grip:shell.querySelector('.fp-route-grip'),heading:shell.querySelector('.fp-route-heading h2'),step:shell.querySelector('.fp-route-step'),body:shell.querySelector('.fp-route-body'),footer:shell.querySelector('.fp-route-footer'),toast:shell.querySelector('.fp-route-toast')};
const repo=()=>db||(db=window.FootprintMediaCore?.createRepository?.(indexedDB));
const place=id=>DATA.places.find(p=>String(p.id)===String(id));
const selectedPlaces=()=>DATA.order.map(place).filter(valid);
const routeRows=r=>(r?.stops?.length?r.stops:r?.selected?.length?r.selected:r?.placeIds||[]).map(x=>typeof x==='string'?x:x?.placeId||x?.id).filter(Boolean).map(String);
const heightFor=which=>{const h=window.innerHeight||document.documentElement.clientHeight;return which==='peek'?Math.min(260,Math.max(206,h*.28)):which==='full'?h-95:Math.min(585,Math.max(385,h*.60))};
function height(value){sheetHeight=Math.max(175,Math.min(window.innerHeight-88,value));ui.sheet.style.setProperty('--fp-route-height',sheetHeight+'px');shell.style.setProperty('--fp-route-height',sheetHeight+'px')}
function spring(which){
 DATA.panel=which;desiredHeight=heightFor(which);cancelAnimationFrame(frame);
 if(matchMedia('(prefers-reduced-motion:reduce)').matches){height(desiredHeight);return}
 let tick=0;const move=()=>{velocity=(velocity+(desiredHeight-sheetHeight)*.17)*.72;height(sheetHeight+velocity);if((Math.abs(desiredHeight-sheetHeight)<.45&&Math.abs(velocity)<.43)||++tick>110){height(desiredHeight);velocity=0;frame=0;return}frame=requestAnimationFrame(move)};
 frame=requestAnimationFrame(move)
}
function hint(value){ui.toast.textContent=value;ui.toast.classList.add('is-visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('is-visible'),2600)}
function button(label,command,primary=false){return '<button type="button" class="fp-route-btn '+(primary?'fp-route-primary':'fp-route-secondary')+'" data-command="'+command+'">'+label+'</button>'}
function head(title,step){ui.heading.textContent=title;ui.step.textContent=step;ui.top.textContent=DATA.mode==='saved'?'已保存路线':DATA.mode==='view'?DATA.title:'路线规划'}
function placeList(){
 let q=(DATA.query||'').trim();
 const available=DATA.places.filter(p=>valid(p)&&p.starred!==false&&!p.demo&&(!q||String(p.title||p.name||'').includes(q))).slice(0,130);
 if(!available.length)return '<div class="fp-route-empty">'+(q?'没有匹配地点':'还没有收藏地点。可以先返回地图收藏地点，或直接在地图点选。')+'</div>';
 return available.map(p=>{
  const chosen=DATA.order.includes(String(p.id));
  return '<div class="fp-route-place"><span class="fp-route-index">'+(chosen?'★':'☆')+'</span><div class="fp-route-name"><strong>'+esc(p.title||p.name)+'</strong><small>'+esc(p.address||p.city||'收藏地点')+'</small></div><button class="fp-route-btn '+(chosen?'is-active':'')+'" data-command="toggle" data-id="'+esc(p.id)+'" aria-label="'+(chosen?'移除':'添加')+esc(p.title||p.name)+'">'+(chosen?'✓':'＋')+'</button></div>'
 }).join('');
}
function listSaved(){
 if(!DATA.routes.length)return '<div class="fp-route-empty">尚无已保存路线。先选择两个地点规划第一条路线。</div>';
 return DATA.routes.map(r=>{const count=routeRows(r).length;return '<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">↗</span><strong>'+esc(r.title||'我的旅行路线')+'</strong><button class="fp-route-btn" data-command="open-saved" data-id="'+esc(r.id)+'" aria-label="查看已保存路线">查看</button></div><div class="fp-route-caption">'+esc(r.startDate||'')+(r.endDate?' — '+esc(r.endDate):'')+' · '+count+' 个地点</div></div>'}).join('')
}
function orderList(){
 return DATA.order.map((id,i)=>{
  const p=place(id);if(!p)return '';
  return '<div class="fp-route-reorder" data-stop="'+esc(id)+'" draggable="true"><span class="fp-route-index">'+(i+1)+'</span><span class="fp-route-name">'+esc(p.title||p.name||'地点')+'</span><button type="button" data-command="up" data-id="'+esc(id)+'" aria-label="提前一站">↑</button><button type="button" data-command="down" data-id="'+esc(id)+'" aria-label="延后一站">↓</button></div>'
 }).join('');
}
function body(){
 const n=DATA.order.length;
 if(DATA.mode==='saved'){
  head('已保存路线',DATA.routes.length+' 条');ui.body.innerHTML='<div class="fp-route-saved-list">'+listSaved()+'</div>';
  ui.footer.innerHTML=button('返回','back')+button('规划新路线','new',true);return;
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
   orderList()+'</div>';
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
  ui.body.innerHTML=p?'<div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">01</span><strong>'+esc(p.title||p.name)+'</strong></div><p class="fp-route-caption">'+esc(p.address||p.city||'路线站点')+'</p></div><div class="fp-route-card"><div class="fp-route-cardhead"><span class="fp-route-index">02</span><strong>原地点记录</strong></div><p class="fp-route-caption">Brief、照片和视频仍由主页同一地点记录管理，不会创建第二份数据。</p></div>':'';
  ui.footer.innerHTML=button('返回路线','view')+button('查看地点资料','place-detail',true);return;
 }
}
function setMode(next,force=false){
 DATA.mode=next;DATA.selected=next==='detail'?DATA.selected:'';
 body();syncMapMode();if(next==='view'||next==='pick')spring('peek');else if(force||next==='saved'||next==='detail')spring('half');else spring('half');
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
  const el=document.createElement('button');el.type='button';el.className='fp-route-temp-marker';el.dataset.id=id;el.innerHTML='<img src="./icons/03_star.svg" alt="" aria-hidden="true"><span>'+(i+1)+'</span>';
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
    activeRoads.set(key,hit||{status:'error'});lines()
   }).catch(()=>{activeRoads.set(key,{status:'error'});if(revision===routeRevision)lines()});
  }
 }
}
function fit(){
 const pts=selectedPlaces();if(!map||!pts.length)return;
 if(pts.length===1){map.easeTo({center:[+pts[0].lng,+pts[0].lat],zoom:14,duration:420});return}
 const lng=pts.map(p=>+p.lng),lat=pts.map(p=>+p.lat);
 map.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]],{padding:{top:105,bottom:Math.min(innerHeight*.38,350),left:40,right:40},maxZoom:15.2,duration:490,essential:true});
}
function quieter(on){
 if(!map||!map.isStyleLoaded?.())return;
 const style=map.getStyle?.()?.layers||[];
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
 DATA.order=[];DATA.days={};DATA.title='我的旅行路线';DATA.start=today();DATA.end=datePlus(DATA.start,2);DATA.travel='car';DATA.routeId='';DATA.selected='';DATA.pending=[];DATA.query='';
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
 window.__atlasOpenNavigation?.(to);
}
function viewPlace(){
 const p=place(DATA.selected);if(!p)return;
 const id=String(p.id);close();window.__atlasPOIBridge?.selectSaved?.(id);
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
ui.grip.addEventListener('pointerdown',e=>{
 if(!DATA.open)return;dragging=true;dragY=e.clientY;dragHeight=sheetHeight;velocity=0;cancelAnimationFrame(frame);ui.grip.setPointerCapture(e.pointerId)
});
ui.grip.addEventListener('pointermove',e=>{if(dragging)height(dragHeight+dragY-e.clientY)});
function endDrag(){if(!dragging)return;dragging=false;const d={peek:heightFor('peek'),half:heightFor('half'),full:heightFor('full')};spring(Object.keys(d).reduce((a,b)=>Math.abs(d[b]-sheetHeight)<Math.abs(d[a]-sheetHeight)?b:a,'peek'))}
ui.grip.addEventListener('pointerup',endDrag);ui.grip.addEventListener('pointercancel',endDrag);
ui.grip.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const all=['peek','half','full'];spring(all[Math.max(0,Math.min(2,all.indexOf(DATA.panel)+(e.key==='ArrowUp'?1:-1)))])}});
function detachMap(){
 routeRevision++;activeRoads.clear();quieter(false);
 if(map&&routeClickListener)map.off('click',routeClickListener);
 if(styleMap&&styleListener)styleMap.off('style.load',styleListener);
 styleMap=null;styleListener=null;routeClickListener=null;
 if(map?.getLayer){for(const id of ['fp-single-order','fp-single-road','fp-single-outline'])if(map.getLayer(id))try{map.removeLayer(id)}catch(_){}if(map.getSource('fp-single-route'))try{map.removeSource('fp-single-route')}catch(_){}}
 for(const p of tempPins.values())p.remove();tempPins.clear();clearStarLabels();map=null;
}
function close(){
 if(!DATA.open)return;
 document.removeEventListener('click',onStarClick,true);
 DATA.open=false;document.body.classList.remove('fp-unified-route');shell.hidden=true;window.__atlasTripPicking=false;detachMap();
 if(observer){observer.disconnect();observer=null}
 if(new URLSearchParams(location.search).has('route'))history.replaceState(null,'','./index.html');
 document.dispatchEvent(new Event('footprint:route-mode-closed'))
}
async function open(savedId=''){
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
 if(savedId){loadSaved(savedId)}else setMode('pick',true);
 spring(savedId?'peek':'half');
 document.dispatchEvent(new Event('footprint:route-mode-opened'));
 return true
}
window.addEventListener('resize',()=>{if(DATA.open)spring(DATA.panel)},{passive:true});
document.addEventListener('atlas:saved-stars-changed',()=>{if(DATA.open)refreshStarLabels()});
const initial=new URLSearchParams(location.search),deeplink=initial.get('route');
if(deeplink)window.addEventListener('load',()=>{void open(deeplink)},{once:true});
window.FootprintUnifiedRoute=Object.freeze({
 version:'V5 same Map A instance 20261119',
 open,close,
 get state(){return {open:DATA.open,step:DATA.mode,order:[...DATA.order],routeId:DATA.routeId,selected:DATA.selected}},
 get map(){return map},get savedCount(){return DATA.routes.length},
 get canvasCount(){return document.querySelectorAll('#atlasVectorMap canvas.maplibregl-canvas').length}
});
})();
