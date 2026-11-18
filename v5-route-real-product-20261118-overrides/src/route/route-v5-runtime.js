/* Footprint Map V5 | approved three-step UI, real V4 data and MapLibre service adapter.
   Never import prototype sample places, route lines, durations, or localStorage model. */
(()=>{'use strict';
const DB='private-travel-footprints-v1';
const $=id=>document.getElementById(id);
const valid=p=>p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&Math.abs(+p.lat)<85&&Math.abs(+p.lng)<=180;
const toName=p=>String(p?.title||p?.name||'未命名地点');
const dateISO=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const plus=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return dateISO(d)};
let map=null,api=null,repo=null,savedRecord=null,rows=[],roadCache=new Map(),ready=false,updating=false,projectionQueued=false,firstFit=true,routeVersion=0;
const emptyCollection={type:'FeatureCollection',features:[]};
function getPlaces(){return new Promise((resolve,reject)=>{
 const req=indexedDB.open(DB,1);
 req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('places'))db.createObjectStore('places',{keyPath:'id'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'})};
 req.onerror=()=>reject(req.error||Error('无法读取地点数据库'));
 req.onsuccess=()=>{const db=req.result;try{const q=db.transaction('places','readonly').objectStore('places').getAll();
 q.onsuccess=()=>{db.close();resolve(q.result||[])};q.onerror=()=>{db.close();reject(q.error)}}catch(e){db.close();reject(e)}};
})}
function saveNewPoints(points){return new Promise((resolve,reject)=>{
 if(!points.length){resolve();return}
 const req=indexedDB.open(DB,1);req.onerror=()=>reject(req.error||Error('地点数据库不可用'));
 req.onsuccess=()=>{const db=req.result,tx=db.transaction('places','readwrite'),store=tx.objectStore('places');
 points.forEach(p=>store.put({id:p.id,title:p.name,name:p.name,address:p.subtitle||'',note:p.note||'',lat:+p.lat,lng:+p.lng,routeOnly:true,starred:false,createdAt:new Date().toISOString()}));
 tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{const err=tx.error;db.close();reject(err||Error('保存地图地点失败'))};};
})}
function idsFromRoute(r){return (r?.stops?.length?r.stops.map(s=>s.placeId||s.id):r?.selected?.length?r.selected.map(s=>s.placeId||s.id):r?.placeIds||[]).map(String).filter(Boolean)}
function parseEnd(v,kind){if(typeof v==='string'&&v.startsWith('place:'))return {type:'point',id:v.slice(6)};
 return kind==='origin'?{type:v==='current'?'current':'none'}:{type:v==='loop'?'loop':v==='none'?'none':'last'};}
function fromEnd(o,kind){return o?.type==='point'?'place:'+o.id:o?.type||(kind==='origin'?'none':'last')}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
async function loadRealData(){
 repo=window.FootprintMediaCore?.createRepository(indexedDB);
 if(!repo)throw Error('原产品路线仓库尚未加载');
 const [places,routes]=await Promise.all([getPlaces(),repo.listRoutes()]);
 const query=new URLSearchParams(location.search),routeId=query.get('saved')||query.get('edit');
 savedRecord=routeId?routes.find(r=>String(r.id)===routeId)||null:null;
 const savedIds=new Set(routes.flatMap(idsFromRoute));
 const s=api.state;
 s.places=places.filter(p=>valid(p)&&!p.demo&&(p.starred!==false||p.routeOnly===true||savedIds.has(String(p.id)))).slice(0,500).map(p=>({
  id:String(p.id),name:toName(p),subtitle:String(p.address||p.city||p.subtitle||'收藏地点'),
  lat:+p.lat,lng:+p.lng,note:String(p.note||p.brief||p.reason||''),routeOnly:!!p.routeOnly
 }));
 const now=new Date();now.setDate(now.getDate()+1);s.start=dateISO(now);s.end=plus(s.start,2);
 s.order=[];s.days={};s.title='我的旅行路线';s.travel='car';s.legModes={};s.origin={type:'current'};s.dest={type:'last'};s.saved=false;
 if(savedRecord){
  const known=new Set(s.places.map(p=>p.id));
  s.order=[...new Set(idsFromRoute(savedRecord))].filter(id=>known.has(id));
  const stopped=savedRecord.stops?.length?savedRecord.stops:savedRecord.selected||[];
  for(const item of stopped){const id=String(item?.placeId??item?.id??'');if(id)s.days[id]=clamp(Math.trunc(Number(item.day)||1),1,30)}
  s.order.forEach(id=>{if(!s.days[id])s.days[id]=1});
  s.title=String(savedRecord.title||s.title);s.start=savedRecord.startDate||s.start;s.end=savedRecord.endDate||s.end;
  s.travel=savedRecord.travelMode==='city'||savedRecord.transportMode==='transit'?'city':'car';
  s.legModes={...(savedRecord.legModes||{})};
  s.origin=parseEnd(savedRecord.routeFrom|| (savedRecord.originPlaceId?'place:'+savedRecord.originPlaceId:'current'),'origin');
  s.dest=parseEnd(savedRecord.routeTo|| (savedRecord.destinationPlaceId?'place:'+savedRecord.destinationPlaceId:'last'),'dest');
  s.saved=true;s.savedRouteId=savedRecord.id;s.step=query.has('edit')?'settings':'view';s.dayView=0;
 }
 s.history=[];ready=true;
 api.render();api.springTo(s.step==='view'?'peek':'half');
}
function coord(p){return p&&valid(p)?[+p.lng,+p.lat]:null}
function position(p){if(!map||!coord(p))return null;return map.project(coord(p))}
function origin(){
 const s=api.state;if(s.origin.type==='point')return s.places.find(p=>p.id===s.origin.id)||null;
 if(s.origin.type==='current'&&valid(s.userPosition))return {...s.userPosition,id:'device',name:'当前位置'};
 return null
}
function destination(){const s=api.state;return s.dest.type==='point'?s.places.find(p=>p.id===s.dest.id)||null:s.dest.type==='loop'?origin():null}
function segments(){
 const s=api.state,ids=s.step==='view'&&s.dayView?s.order.filter(id=>s.days[id]===s.dayView):s.order;
 const pts=ids.map(id=>s.places.find(p=>p.id===id)).filter(Boolean),out=[];
 for(let i=1;i<pts.length;i++){if(s.days[pts[i-1].id]!==s.days[pts[i].id])continue;
 out.push({a:pts[i-1],b:pts[i],id:pts[i-1].id+'|'+pts[i].id,index:i-1})}
 if(!s.dayView||s.step!=='view'){
  const first=pts[0],last=pts.at(-1),a=origin(),b=destination();
  if(a&&first&&a.id!==first.id)out.unshift({a,b:first,id:'origin|'+first.id,index:-1});
  if(b&&last&&b.id!==last.id)out.push({a:last,b,id:last.id+'|dest',index:pts.length-1});
 }
 return out
}
function mode(seg){return api.state.legModes[seg.id]||(api.state.travel==='city'?'transit':'car')}
function segmentInfo(seg,m){
 const mod=m||mode(seg),r=roadCache.get(cacheKey(seg,mod));
 if(mod==='transit')return {label:'公交换乘',sub:'具体班次和用时请在导航 App 中查看'};
 if(r?.status==='ok')return {label:'约 '+Math.max(1,Math.round(r.duration/60))+' 分钟',sub:(r.distance/1000).toFixed(1)+' 公里 · 路网预计，不含实时路况'};
 if(r?.status==='error')return {label:'暂无道路用时',sub:'路网服务不可用，可打开外部导航'};
 return {label:'正在计算路段',sub:'等待道路服务返回真实数据'};
}
function cacheKey(seg,mode){return [seg.id,mode,seg.a.lat,seg.a.lng,seg.b.lat,seg.b.lng].join('|')}
function requestRoads(segs){
 const active=++routeVersion;
 for(const seg of segs){
  const md=mode(seg);if(md==='transit')continue;
  const key=cacheKey(seg,md);if(roadCache.has(key))continue;
  roadCache.set(key,{status:'loading'});
  const net=window.__fpLiveRouting;
  if(!net){roadCache.set(key,{status:'error'});continue}
  net.get(seg.a,seg.b,md).then(r=>{roadCache.set(key,r||{status:'error'});if(ready&&active<=routeVersion)updateMapLayers()}).catch(()=>{roadCache.set(key,{status:'error'});updateMapLayers()});
 }
}
function projectPins(){
 if(!map)return;
 document.querySelectorAll('#pins [data-pin]').forEach(el=>{
  const p=api.state.places.find(x=>x.id===el.dataset.pin),pt=position(p);
  if(!pt){el.hidden=true;return}
  el.hidden=pt.x < -50||pt.x>map.getContainer().clientWidth+50||pt.y< -50||pt.y>map.getContainer().clientHeight+50;
  el.style.left=pt.x+'px';el.style.top=pt.y+'px';
 });
 const mark=$('v5-origin-pin'),op=position(origin());if(mark){mark.hidden=!op;if(op){mark.style.left=op.x+'px';mark.style.top=op.y+'px'}}
 const bubble=$('leg-bubble'),current=segments().find(s=>s.id===api.state.selectedLeg);
 if(bubble&&current){const a=position(current.a),b=position(current.b);if(a&&b){bubble.style.left=clamp((a.x+b.x)/2,98,Math.max(98,innerWidth-95))+'px';bubble.style.top=clamp((a.y+b.y)/2-12,100,Math.max(120,map.getContainer().clientHeight-150))+'px'}}
}
function scheduleProjection(){if(projectionQueued)return;projectionQueued=true;requestAnimationFrame(()=>{projectionQueued=false;projectPins()})}
function ensureLayers(){
 if(!map?.isStyleLoaded?.())return;
 if(!map.getSource('fp-v5-roads'))map.addSource('fp-v5-roads',{type:'geojson',data:emptyCollection});
 if(!map.getLayer('fp-v5-road-back'))map.addLayer({id:'fp-v5-road-back',type:'line',source:'fp-v5-roads',paint:{'line-color':'#fffdfa','line-width':9,'line-opacity':.98},layout:{'line-cap':'round','line-join':'round'}});
 if(!map.getLayer('fp-v5-road-main'))map.addLayer({id:'fp-v5-road-main',type:'line',source:'fp-v5-roads',
   paint:{'line-color':['case',['==',['get','id'],'__none__'],'#c59d43',['==',['get','transit'],true],'#a0ada0','#476651'],
    'line-width':4,'line-opacity':1,'line-dasharray':[1,0]},layout:{'line-cap':'round','line-join':'round'}});
 if(!map.getLayer('fp-v5-road-hit')){map.addLayer({id:'fp-v5-road-hit',type:'line',source:'fp-v5-roads',paint:{'line-color':'#000000','line-opacity':0,'line-width':26},layout:{'line-cap':'round','line-join':'round'}});
 map.on('click','fp-v5-road-hit',e=>{const id=e.features?.[0]?.properties?.id;if(id){api.selectLeg(id);}});
 }
}
function updateMapLayers(){
 if(!map?.isStyleLoaded?.())return;
 try{ensureLayers();const list=segments();requestRoads(list);
  const features=[];
  for(const seg of list){const md=mode(seg),data=roadCache.get(cacheKey(seg,md));
   let geometry=null;
   if(data?.status==='ok'&&Array.isArray(data.geometry))geometry=data.geometry;
   else if(md==='transit')geometry=[coord(seg.a),coord(seg.b)]; // visually distinct direction connector, not a claimed bus route
   if(!geometry||geometry.length<2)continue;
   features.push({type:'Feature',properties:{id:seg.id,transit:md==='transit'},geometry:{type:'LineString',coordinates:geometry}})
  }
  map.getSource('fp-v5-roads').setData({type:'FeatureCollection',features});
  const selected=api.state.selectedLeg||'__none__';
  map.setPaintProperty('fp-v5-road-main','line-color',['case',['==',['get','id'],selected],'#c79e46',['==',['get','transit'],true],'#96a69a','#476651']);
  map.setPaintProperty('fp-v5-road-main','line-width',['case',['==',['get','id'],selected],6,3.6]);
  projectPins();
 }catch(e){console.warn('[V5] 地图路线图层:',e.message)}
}
function drawMap(state){
 const ids=state.step==='view'&&state.dayView?state.order.filter(id=>state.days[id]===state.dayView):state.order;
 $('pins').innerHTML=state.places.map(p=>{
  const index=state.order.indexOf(p.id),selected=index>=0,hidden=state.step==='view'&&state.dayView&&!ids.includes(p.id);
  if(state.step!=='pick'&&!selected)return '';
  const marker=selected?'<span class="day-tag">D'+(state.days[p.id]||1)+'</span><span class="number">'+(index+1)+'</span>':'<span class="pin-icon"><svg viewBox="0 0 24 24"><path d="m12 2.5 2.9 6 6.6 1-4.8 4.6 1.2 6.4L12 17.3l-5.9 3.2 1.2-6.4L2.5 9.5l6.6-1Z"/></svg></span>';
  return '<button class="pin '+(selected?'selected ':'')+(hidden?'faded ':'')+(state.highlight===p.id?'focus':'')+'" data-pin="'+escapeHtml(p.id)+'" aria-label="'+escapeHtml(p.name)+'">'+marker+'</button>';
 }).join('');
 const op=origin();if(op&&state.step!=='pick')$('pins').insertAdjacentHTML('beforeend','<div id="v5-origin-pin" class="pin origin" style="pointer-events:none;font-size:11px;font-weight:800">起</div>');
 const b=$('leg-bubble'),chosen=segments().find(s=>s.id===state.selectedLeg);
 if(chosen){const md=mode(chosen),info=segmentInfo(chosen);b.hidden=false;
  b.innerHTML='<div class="leg-title"><span>'+({car:'驾车',walk:'步行',bike:'骑行',transit:'公交'}[md]||'交通')+'</span><span>'+escapeHtml(info.label)+'</span></div><div class="leg-sub">'+escapeHtml(info.sub)+'</div><button data-open-leg="'+escapeHtml(chosen.id)+'">查看这一段 ›</button>';
 }else{b.hidden=true;b.innerHTML=''}
 if(map)updateMapLayers();
}
function escapeHtml(x){return String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function unproject(x,y){if(!map)return null;const q=map.unproject([x,y]);return {lat:q.lat,lng:q.lng}}
async function maplibre(){
 if(window.maplibregl)return window.maplibregl;
 for(const url of ['https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js','https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js']){
  try{await new Promise((res,rej)=>{const s=document.createElement('script'),t=setTimeout(()=>rej(Error('超时')),9000);s.src=url;s.onload=()=>{clearTimeout(t);res()};s.onerror=()=>{clearTimeout(t);rej(Error('下载失败'))};document.head.appendChild(s)});if(window.maplibregl)return window.maplibregl;}catch(e){console.warn('[V5]',url,e.message)}
 }throw Error('地图引擎暂时无法连接')
}
function fit(){
 if(!map)return;const pts=api.state.order.map(id=>api.state.places.find(p=>p.id===id)).filter(valid);
 if(!pts.length){const first=api.state.places.find(valid);if(first)map.easeTo({center:coord(first),zoom:12.3,duration:450});return}
 const xs=pts.map(p=>+p.lng),ys=pts.map(p=>+p.lat);
 const a=Math.min(...xs),b=Math.max(...xs),c=Math.min(...ys),d=Math.max(...ys);
 if(b-a<.0001&&d-c<.0001){map.easeTo({center:[a,c],zoom:13.4,duration:400});return}
 map.fitBounds([[a,c],[b,d]],{padding:{top:140,bottom:Math.min(innerHeight*.45,360),left:42,right:42},maxZoom:14,duration:550})
}
async function init(hooks){
 api=hooks;
 try{await loadRealData()}catch(e){console.error('[V5] 读取产品数据失败',e);hooks.toast('读取收藏或路线失败，请检查存储权限',false);hooks.state.places=[];hooks.state.order=[];hooks.render()}
 try{
  const M=await maplibre(),s=api.state,first=s.places[0];
  map=new M.Map({container:'atlasMap',style:window.FootprintSharedMap?.routeFigureStyle?.()||window.FootprintSharedMap?.figureStyle?.()||'https://tiles.openfreemap.org/styles/bright',
    center:first?[first.lng,first.lat]:[0,18],zoom:first?11:2.4,minZoom:2,maxZoom:19,pitch:0,bearing:0,maxPitch:0,dragRotate:false,touchPitch:false,renderWorldCopies:false,attributionControl:{compact:true}});
  try{map.touchZoomRotate?.disableRotation();map.keyboard?.disableRotation()}catch{}
  map.on('load',()=>{ensureLayers();updateMapLayers();if(firstFit){firstFit=false;fit()}});
  map.on('style.load',()=>{if(map.isStyleLoaded?.())updateMapLayers()});
  map.on('move',scheduleProjection);map.on('resize',scheduleProjection);
  map.on('click',e=>{if(e.originalEvent?.defaultPrevented)return;
   try{if(map.getLayer('fp-v5-road-hit')&&map.queryRenderedFeatures(e.point,{layers:['fp-v5-road-hit']}).length)return}catch{}
   const {state,onBlankMap}=api;if(state.endpointMap||state.step==='pick'&&state.pickMode==='map')onBlankMap(e.point.x,e.point.y);
   else if(state.selectedLeg){state.selectedLeg=null;api.drawMap()}
  });
  ready=true;api.render();
 }catch(e){console.error('[V5] 地图未加载',e);const n=document.createElement('div');n.className='v5-map-error';n.textContent='地图暂时无法连接，请检查网络后重试；已有收藏与路线不会丢失。';$('stage').appendChild(n)}
 window.__footprintV5ProductReady=true;document.dispatchEvent(new Event('footprint:v5-ready'));
}
async function save(state){
 if(state.order.length<2)throw Error('请先选择至少两个访问地点');
 if(!repo)throw Error('路线存储未就绪');
 const old=savedRecord||{},id=old.id||window.crypto?.randomUUID?.()||'trip-'+Date.now();
 const newPoints=state.places.filter(p=>p.routeOnly&&state.order.includes(p.id));
 await saveNewPoints(newPoints);
 const prev=old.stops||[],timeFor=id=>prev.find(s=>String(s.placeId||s.id)===id)?.time||'';
 const stops=state.order.map((placeId,i)=>({id:placeId,placeId,order:i+1,day:state.days[placeId]||1,time:timeFor(placeId)}));
 const op=state.origin?.type==='point'?state.origin.id:'',dp=state.dest?.type==='point'?state.dest.id:'';
 const record={...old,id,title:String(state.title||'我的旅行路线').slice(0,64),placeIds:[...state.order],selected:stops,stops,
  startDate:state.start,endDate:state.end,originPlaceId:op,destinationPlaceId:dp,
  origin:op?toName(state.places.find(p=>p.id===op)):'',destination:dp?toName(state.places.find(p=>p.id===dp)):'',
  routeFrom:fromEnd(state.origin,'origin'),routeTo:fromEnd(state.dest,'dest'),travelMode:state.travel,
  transportMode:state.travel==='city'?'transit':'car',legModes:{...state.legModes},source:'footprint-map',
  visualVersion:'V5-approved-20261118',createdAt:old.createdAt||new Date().toISOString(),
  updatedAt:new Date().toISOString(),version:2
 };
 await repo.saveRoute(record);savedRecord=record;state.savedRouteId=id;
 history.replaceState(null,'','./journey-v5.html?saved='+encodeURIComponent(id)+'&view=1');
 document.dispatchEvent(new CustomEvent('footprint:route-saved',{detail:{id,placeIds:record.placeIds}}));
 return id
}
function suggest(){
 const s=api?.state,net=window.__fpLiveRouting;
 if(!s||s.order.length<4||s.travel==='city'||!net)return null;
 if(new Set(s.order.map(id=>s.days[id]||1)).size>1)return null; // cross-day itinerary is never silently re-ordered
 const pts=s.order.map(id=>s.places.find(p=>p.id===id));if(pts.some(p=>!valid(p)))return null;
 net.prepareMatrix(pts,'car');
 const dist=(a,b)=>net.metric(a,b,'car');
 const total=ids=>{let sum=0;for(let i=1;i<ids.length;i++){const a=s.places.find(p=>p.id===ids[i-1]),b=s.places.find(p=>p.id===ids[i]);const v=dist(a,b);if(v==null)return null;sum+=v}return sum};
 const original=total(s.order);if(original==null)return null;
 let best=[...s.order],min=original;
 for(let i=1;i<best.length-2;i++)for(let j=i+1;j<best.length-1;j++){
  const trial=[...s.order];trial.splice(i,j-i+1,...s.order.slice(i,j+1).reverse());const length=total(trial);
  if(length!=null&&length<min){min=length;best=trial}
 }
 return min<original*.9?{best,saving:Math.round((1-min/original)*100)}:null
}
function navUrl(app,from,to,md){if(!valid(from)||!valid(to))return '';
 const net=window.__fpLiveRouting;
 if(app==='amap')return net?.amapLink(from,to,md)||'';
 if(app==='apple')return 'https://maps.apple.com/?saddr='+encodeURIComponent(from.lat+','+from.lng)+'&daddr='+encodeURIComponent(to.lat+','+to.lng)+'&dirflg='+(md==='walk'?'w':md==='transit'?'r':'d');
 return net?.link(from,to,md)||'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(from.lat+','+from.lng)+'&destination='+encodeURIComponent(to.lat+','+to.lng)+'&travelmode='+(md==='walk'?'walking':md==='transit'?'transit':md==='bike'?'bicycling':'driving')
}
function navigation(app,state){
 const picked=state.detail?state.places.find(p=>p.id===state.detail):null,
   list=state.order.map(id=>state.places.find(p=>p.id===id)).filter(Boolean),
   dest=picked||list.at(-1),origin=state.userPosition||list[0];
 if(!origin||!dest)return '';
 const md=state.travel==='city'?'transit':'car';
 return navUrl(app,origin,dest,md);
}
function userLocate(){if(!navigator.geolocation){api.toast('当前设备不支持定位',false);return}
 navigator.geolocation.getCurrentPosition(p=>{const coords={lat:p.coords.latitude,lng:p.coords.longitude};
 api.state.userPosition=coords;map?.easeTo({center:[coords.lng,coords.lat],zoom:13.5,duration:560});
 api.drawMap();api.toast('已定位到当前位置',false)},()=>api.toast('定位未授权，可使用地图选点',false),{enableHighAccuracy:true,timeout:10000,maximumAge:120000})
}
function toggleLayers(){if(!map)return;const id=map.getStyle()?.layers?.find(l=>l.type==='background')?.id;api.state.layerAlt=!api.state.layerAlt;if(id)map.setPaintProperty(id,'background-color',api.state.layerAlt?'#e2ebe2':'#f1f0ea')}
window.FootprintRouteV5Real={init,drawMap,segments,segmentInfo,suggest,save,fit,userLocate,toggleLayers,unproject,navigation,origin,destination,
 get map(){return map},get savedId(){return savedRecord?.id},get ready(){return ready}};
})();