/* Footprint Map V5 | AMap POI 2.0 overlay adapter. DATA only, never a second map.
 * Active solely when a trusted REST proxy has been configured; otherwise
 * the approved OSM POI pictograms remain intact. Secret stays on the server.
 */
(()=>{'use strict';
if(window.FootprintAMapPOI)return;
const staticHost=location.hostname.endsWith('.github.io');
const state={status:'unconfigured',lastError:'',points:[],source:'高德 POI 2.0',lastFetch:0,enabled:false};
const cache=new Map();
let timer=0,inflight=null,bound=null,revision=0;
const valid=p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&Math.abs(+p.lat)<85.05&&Math.abs(+p.lng)<=180;
const insideChina=p=>valid(p)&&+p.lng>=72.004&&+p.lng<=137.8347&&+p.lat>=.8293&&+p.lat<=55.8271;
const meters=(a,b)=>{
 const rad=Math.PI/180,rLat=(a.lat+b.lat)*.5*rad;
 return Math.hypot((a.lat-b.lat)*111195,(a.lng-b.lng)*111195*Math.cos(rLat))
};
const normalizeName=s=>String(s||'').toLowerCase().replace(/[\s·•（）()\-_/]/g,'');
function category(p){
 const t=String(p.category||p.typecode||p.type||'');
 if(/restaurant|cafe|food|餐饮|咖啡|0500/.test(t))return 'restaurant';
 if(/museum|gallery|展览|美术|博物馆|1402/.test(t))return 'museum';
 if(/hotel|住宿|酒店|1001/.test(t))return 'hotel';
 if(/transit|station|transport|地铁|公交|1505|1507/.test(t))return 'station';
 if(/park|garden|公园|1101/.test(t))return 'park';
 if(/shopping|商场|购物|0601/.test(t))return 'shop';
 if(/school|教育|1412/.test(t))return 'school';
 if(/hospital|医疗|0901/.test(t))return 'hospital';
 if(/scenic|landmark|景点|风景|1102/.test(t))return 'attraction';
 return 'place';
}
function endpoint(){
 const cfg=window.FootprintAMapConfig||{};
 const custom=typeof cfg.endpoint==='string'?cfg.endpoint.trim():'';
 if(custom){
  try{const url=new URL(custom,location.href);if(url.protocol!=='https:'&&url.hostname!=='localhost')return '';if(url.username||url.password)return '';return url.href}catch{return ''}
 }
 if(staticHost)return '';
 return new URL('./api/amap-poi',location.href).href;
}
function stableKey(m){
 const c=m.getCenter?.(),z=m.getZoom?.();if(!c||!insideChina({lat:c.lat,lng:c.lng})||z<13)return null;
 const radius=z>=16?950:z>=15?1700:z>=14?2500:3900;
 const key=Math.round(c.lng*100)/100+'|'+Math.round(c.lat*100)/100+'|'+radius;
 return {key,radius,center:{lng:+c.lng,lat:+c.lat},zoom:z}
}
function visible(m){
 if(!m||!state.enabled)return [];
 const c=m.getCenter?.();if(!c)return [];
 const zoom=m.getZoom?.()||0,range=zoom>=15?4200:zoom>=14?6200:9000;
 return state.points.filter(p=>meters(p,c)<range).slice(0,zoom>=16?82:zoom>=15?54:28)
}
function combine(data){
 const seen=[],result=[];
 for(const x of data){
  if(!x||!valid(x)||!x.name)continue;
  const p={id:'amap:'+String(x.id||''),name:String(x.name).slice(0,80),lat:+x.lat,lng:+x.lng,
   category:category(x),address:String(x.address||'').slice(0,150),fpSource:'amap'};
  if(seen.some(v=>window.FootprintPOIIdentity?.samePlace?.(v,p)||(normalizeName(v.name)===normalizeName(p.name)&&meters(v,p)<28)))continue;
  seen.push(p);result.push(p)
 }
 return result.slice(0,115)
}
async function fetchNearby(m){
 const url=endpoint(),v=stableKey(m);if(!url||!v){state.enabled=false;state.points=[];state.status=url?'out-of-region':'unconfigured';return}
 state.enabled=true;const hit=cache.get(v.key);
 if(hit&&Date.now()-hit.timestamp<6*60_000){state.points=hit.data;state.status='ready';document.dispatchEvent(new Event('atlas:poi-source-updated'));return}
 inflight?.abort();const ctrl=new AbortController();inflight=ctrl;const token=++revision;
 const req=new URL(url);req.searchParams.set('mode','nearby');req.searchParams.set('lng',v.center.lng.toFixed(6));req.searchParams.set('lat',v.center.lat.toFixed(6));req.searchParams.set('radius',v.radius);req.searchParams.set('coordinate','wgs84');req.searchParams.set('category','all');
 const kill=setTimeout(()=>ctrl.abort(),9500);
 try{
  state.status='loading';
  const r=await fetch(req.href,{mode:'cors',cache:'no-store',signal:ctrl.signal,headers:{Accept:'application/json'},credentials:'omit'});
  const obj=await r.json();
  if(!r.ok||!Array.isArray(obj.places)||obj.source!=='AMap POI 2.0')throw Error(obj.code||'地点服务不可用');
  if(token!==revision)return;
  const rows=combine(obj.places);
  state.points=rows;state.lastFetch=Date.now();state.lastError='';state.status='ready';
  cache.set(v.key,{timestamp:Date.now(),data:rows});
  if(cache.size>14)cache.delete(cache.keys().next().value);
  document.dispatchEvent(new Event('atlas:poi-source-updated'));
 }catch(error){
  if(ctrl.signal.aborted)return;
  state.lastError=String(error?.message||'暂不可用').slice(0,100);state.status='unavailable';
  // Preserve the approved map POIs, do NOT manufacture "AMap" markers.
  state.points=[];document.dispatchEvent(new Event('atlas:poi-source-updated'))
 }finally{clearTimeout(kill);if(inflight===ctrl)inflight=null}
}
function attach(m){
 if(m===bound)return true;
 if(bound){bound.off?.('moveend',schedule);bound.off?.('zoomend',schedule)}
 bound=m;if(!m)return false;m.on('moveend',schedule);m.on('zoomend',schedule);schedule();return true
}
function schedule(){
 if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=0;if(bound&&!document.hidden)void fetchNearby(bound)},650)
}
function stop(){
 if(bound){bound.off?.('moveend',schedule);bound.off?.('zoomend',schedule);bound=null}
 clearTimeout(timer);timer=0;inflight?.abort();inflight=null;state.enabled=false;state.points=[]
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
window.FootprintAMapPOI=Object.freeze({attach,visible,schedule,stop,get health(){return {...state,count:state.points.length,configured:!!endpoint()}}});
})();
