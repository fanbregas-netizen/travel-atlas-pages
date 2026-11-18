/* Footprint Map V4: data-only bridge for the exact approved route-color-v3 UI.
 * No CSS, icon, gesture, map camera, or rendering modifications.
 * The old demonstration samples are never imported to the user database.
 */
(function(){
'use strict';
if(!window.__fpRouteLive)return;
const PLACE_DB='private-travel-footprints-v1';
const repo=window.FootprintMediaCore?.createRepository(indexedDB);
let current=null,dirty=null,timer=0,busy=false,latestSignature='';
window.__fpRoutePreviewData=[];
function coords(p){
 return p&&p.id!=null&&p.lat!==''&&p.lng!==''&&p.lat!=null&&p.lng!=null
  &&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))
  &&Math.abs(Number(p.lat))<=85.05&&Math.abs(Number(p.lng))<=180;
}
function openPlaces(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(PLACE_DB,1);
  req.onupgradeneeded=()=>{
   if(!req.result.objectStoreNames.contains('places'))req.result.createObjectStore('places',{keyPath:'id'});
   if(!req.result.objectStoreNames.contains('meta'))req.result.createObjectStore('meta',{keyPath:'key'});
  };
  req.onerror=()=>reject(req.error||Error('无法读取收藏'));
  req.onsuccess=()=>{
   const db=req.result;
   try{
    const get=db.transaction('places','readonly').objectStore('places').getAll();
    get.onsuccess=()=>{resolve(get.result||[]);db.close()};
    get.onerror=()=>{reject(get.error);db.close()};
   }catch(e){db.close();reject(e)}
  };
 });
}
function routeStopIds(item){
 const raw=Array.isArray(item?.stops)&&item.stops.length
  ?item.stops.map(s=>String(s?.placeId??s?.id??''))
  :Array.isArray(item?.selected)&&item.selected.length
   ?item.selected.map(s=>String(s?.id??s?.placeId??''))
   :Array.isArray(item?.placeIds)?item.placeIds.map(String):[];
 return [...new Set(raw.filter(Boolean))];
}
function getDayMap(item){
 const days={};
 const stops=Array.isArray(item?.stops)&&item.stops.length?item.stops:(Array.isArray(item?.selected)?item.selected:[]);
 for(const s of stops){
  const id=String(s?.placeId??s?.id??'');
  if(id)days[id]=Math.max(1,Math.min(30,Math.trunc(Number(s.day)||1)));
 }
 return days;
}
function pad(n){return String(n).padStart(2,'0')}
function dateISO(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function plus(day,n){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return dateISO(d)}
function choice(v,fallback,places){
 if(typeof v==='string'&&v.startsWith('place:')&&places.some(p=>String(p.id)===v.slice(6)))return v;
 return fallback?'place:'+fallback:'same';
}
async function bootstrap(){
 let raw=[],routes=[];
 try{raw=await openPlaces()}catch(e){console.warn('[Footprint Route] 读取收藏失败',e)}
 try{routes=await repo?.listRoutes()||[]}catch(e){console.warn('[Footprint Route] 读取已保存路线失败',e)}
 const linkedRouteStops=new Set(routes.flatMap(routeStopIds));
 const places=raw.filter(p=>(p.starred!==false||p.routeOnly===true||linkedRouteStops.has(String(p.id)))&&!p.demo&&coords(p)).map(p=>({
  id:String(p.id),title:String(p.title||p.name||'未命名地点'),name:String(p.name||p.title||''),
  address:String(p.address||p.city||p.subtitle||''),
  lat:Number(p.lat),lng:Number(p.lng),
  note:String(p.note||p.brief||p.reason||''),
  defaultSelected:false
 })).slice(0,300);
 const query=new URLSearchParams(location.search);
 const routeId=query.get('saved')||query.get('edit');
 const selectedRoute=!query.has('new')
  ?(routeId?routes.find(r=>String(r.id)===routeId)
    :routes.slice().sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0])
  :null;
 current=selectedRoute||null;
 const placeIds=new Set(places.map(p=>p.id));
 const ids=(selectedRoute?routeStopIds(selectedRoute):places.slice(0,1).map(p=>p.id)).filter(id=>placeIds.has(id));
 if(!ids.length&&places.length)ids.push(places[0].id);
 const days=getDayMap(selectedRoute);
 const today=new Date();today.setDate(today.getDate()+1);
 const start=selectedRoute?.startDate||dateISO(today),end=selectedRoute?.endDate||plus(start,2);
 const mode=selectedRoute?.transportMode||'car';
 const from=choice(selectedRoute?.originPlaceId?'place:'+selectedRoute.originPlaceId:selectedRoute?.routeFrom||'',ids[0],places);
 const to=choice(selectedRoute?.destinationPlaceId?'place:'+selectedRoute.destinationPlaceId:selectedRoute?.routeTo||'',ids.at(-1)||ids[0],places);
 window.__fpRoutePreviewData.splice(0,window.__fpRoutePreviewData.length,...places.map(p=>({...p,defaultSelected:ids.includes(p.id)})));
 window.__fpRouteLiveInitial={
  id:selectedRoute?.id||null,title:selectedRoute?.title||'我的旅行路线',
  order:ids,days,start,end,from,to,
  mode:['car','walk','bike','transit'].includes(mode)?mode:'car',
  legs:{...(selectedRoute?.legModes||{})},
  locked:Array.isArray(selectedRoute?.lockedPlaceIds)?selectedRoute.lockedPlaceIds:[],
  createdAt:selectedRoute?.createdAt||null
 };
 return {places:window.__fpRoutePreviewData,initial:window.__fpRouteLiveInitial};
}
window.__fpRouteLiveReady=bootstrap().catch(err=>{
 console.error('[Footprint Route] 初始化失败',err);
 const today=dateISO(new Date());
 window.__fpRouteLiveInitial={id:null,title:'我的旅行路线',order:[],days:{},start:today,end:plus(today,2),from:'same',to:'same',mode:'car',legs:{},locked:[]};
 return {places:[],initial:window.__fpRouteLiveInitial};
});
function normalizeState(state){
 const keep=new Set(window.__fpRoutePreviewData.map(p=>p.id));
 const order=[...new Set((state?.order||[]).map(String))].filter(id=>keep.has(id));
 if(!order.length)return null;
 const days=Object.fromEntries(order.map(id=>[id,Math.max(1,Math.min(30,Math.trunc(Number(state.days?.[id])||1)))]));
 const start=state.start||window.__fpRouteLiveInitial?.start;
 const end=state.end||window.__fpRouteLiveInitial?.end;
 const mode=['car','walk','bike','transit'].includes(state.mode)?state.mode:'car';
 return {order,days,start,end,mode,legs:{...(state.legs||{})},from:state.from||'',to:state.to||'',locked:state.locked||[]};
}
async function flush(){
 if(busy)return;
 busy=true;
 try{
  while(dirty){
   const snapshot=dirty;dirty=null;
   const signature=JSON.stringify(snapshot);
   if(signature===latestSignature)continue;
   if(!repo)throw Error('未加载路线仓库');
   const old=current||{},createdAt=old.createdAt||new Date().toISOString();
   const id=old.id||window.crypto?.randomUUID?.()||'trip-'+Date.now();
   const prevStops=Array.isArray(old.stops)?old.stops:[];
   const timeFor=pid=>prevStops.find(x=>String(x.placeId||x.id)===pid)?.time||'';
   const selected=snapshot.order.map((pid,i)=>({id:pid,placeId:pid,order:i+1,day:snapshot.days[pid],time:timeFor(pid)}));
   const start=snapshot.from.startsWith('place:')?snapshot.from.slice(6):'';
   const end=snapshot.to.startsWith('place:')?snapshot.to.slice(6):'';
   const find=id=>window.__fpRoutePreviewData.find(p=>p.id===id);
   const record={
    ...old,id,title:old.title||'我的旅行路线',
    placeIds:snapshot.order,selected,stops:selected.map(s=>({...s})),
    startDate:snapshot.start,endDate:snapshot.end,
    originPlaceId:start,destinationPlaceId:end,
    routeFrom:snapshot.from,routeTo:snapshot.to,
    origin:start?find(start)?.title||'':'',destination:end?find(end)?.title||'':'',
    transportMode:snapshot.mode,legModes:snapshot.legs,
    lockedPlaceIds:snapshot.locked,
    source:'footprint-map',visualVersion:'V4-approved-route-color-v3',
    createdAt,updatedAt:new Date().toISOString(),version:2
   };
   await repo.saveRoute(record);
   current=record;latestSignature=signature;
   window.__fpRouteLiveInitial.id=id;
   document.dispatchEvent(new CustomEvent('footprint:route-saved',{detail:{id,placeIds:record.placeIds}}));
  }
 }catch(e){
  console.error('[Footprint Route] 保存失败',e);
  document.dispatchEvent(new CustomEvent('footprint:route-save-error',{detail:{message:e.message}}));
 }finally{busy=false;if(dirty)queueMicrotask(flush)}
}
window.__fpRouteLiveBridge={
 changed(state){
  const snap=normalizeState(state);
  if(!snap)return;
  dirty=snap;clearTimeout(timer);timer=setTimeout(flush,180);
 },
 get savedId(){return current?.id||null},
 get data(){return window.__fpRouteLiveInitial}
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dirty){clearTimeout(timer);flush()}});
})();