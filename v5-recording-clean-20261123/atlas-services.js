/* Public, keyless services for the static Pages build. No credentials or user media. */
(function(){
'use strict';
const cache=new Map();
const staticHost=location.hostname.endsWith('github.io')||!!document.querySelector('meta[name="atlas-hosting"][content="static"]');
async function json(url,signal,timeout=8500){
 const ctrl=new AbortController(),cancel=()=>ctrl.abort();
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,timeout);
 try{const r=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/json'}});if(!r.ok)throw Error('地图服务暂不可用 ('+r.status+')');return await r.json()}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
}
const valid=(n,min,max)=>n!==undefined&&n!==null&&n!==''&&Number.isFinite(+n)&&+n>=min&&+n<=max;
const cities=['北京','上海','天津','重庆','广州','深圳','杭州','苏州','南京','成都','武汉','西安','长沙','青岛','厦门','宁波','温州','绍兴','嘉兴','湖州','台州','舟山','金华','丽水','衢州','昆明','三亚','大理','丽江'];
function term(q){const city=/^[\u3400-\u9fff]+$/.test(q)?cities.find(c=>q.startsWith(c)&&q.length>=c.length+2):null;return city?city+' '+q.slice(city.length):q}
function feature(f){const [lon,lat]=f.geometry?.coordinates||[];if(!valid(lat,-90,90)||!valid(lon,-180,180))return null;const p=f.properties||{},name=p.name||p.street||p.city||'';if(!name)return null;return {lat:+lat,lon:+lon,name,display_name:[...new Set([name,p.city,p.state,p.country].filter(Boolean))].join(' · '),type:p.osm_value||p.osm_key||'地点',id:[p.osm_type,p.osm_id].join(':')}}
function remember(key,data){cache.set(key,{time:Date.now(),data});if(cache.size>40)cache.delete(cache.keys().next().value);return data}
function cached(key){const value=cache.get(key);return value&&Date.now()-value.time<(value.data?.places?.length===0?45000:300000)?value.data:null}
async function search(q,{signal,center,allowFallback=false}={}){
 q=String(q).trim().slice(0,120);if(q.length<2)return [];
 const centerKey=valid(center?.lat,-90,90)&&valid(center?.lng,-180,180)?Number(center.lat).toFixed(2)+','+Number(center.lng).toFixed(2):'global';
 const key='search:'+q+':'+centerKey+':'+(allowFallback?'submitted':'suggest'),hit=cached(key);if(hit!==null)return hit;
 const u=new URL('https://photon.komoot.io/api/');u.searchParams.set('q',term(q));u.searchParams.set('limit','16');
 if(valid(center?.lat,-90,90)&&valid(center?.lng,-180,180)){u.searchParams.set('lat',center.lat);u.searchParams.set('lon',center.lng)}
 try{
  const data=await json(u,signal);const items=(data.features||[]).map(feature).filter(Boolean);
  const landmark=new Set(['attraction','museum','lake','water','park','nature_reserve','viewpoint','monument','garden','temple','castle','peak','beach']);
  items.sort((a,b)=>Number(landmark.has(b.type))-Number(landmark.has(a.type)));
  if(items.length||!allowFallback)return remember(key,items.slice(0,10));
 }catch(e){if(signal?.aborted||!allowFallback)throw e}
 // Nominatim is only used for an explicit submitted search, never autocomplete.
 const url='https://nominatim.openstreetmap.org/search?format=json&limit=10&addressdetails=1&accept-language=zh-CN&q='+encodeURIComponent(q);
 const data=await json(url,signal);return remember(key,Array.isArray(data)?data:[]);
}
function meters(a,b,c,d){const rad=x=>x*Math.PI/180,h=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;return Math.round(12742000*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h))))}
// Reverse geocoding returns an address, NOT nearby attractions. Search actual
// georeferenced OSM features; fall back to current MapLibre/AMap tile POIs.
const scenicIcons=new Set(['museum','creative','town','park','mountain','sea','lake','forest']);
function asNearby(name,lat,lng,category,originLat,originLng,radius,id){
 const latitude=Number(lat),longitude=Number(lng),title=String(name||'').trim();
 if(!title||title.length>85||!valid(latitude,-90,90)||!valid(longitude,-180,180))return null;
 const distance=meters(originLat,originLng,latitude,longitude);
 if(distance<20||distance>radius)return null;
 return {id:String(id||title+':'+latitude+':'+longitude),name:title,
  lat:latitude,lng:longitude,lon:longitude,category:String(category||'景点'),
  type:String(category||'景点'),distance,
  address:'距当前地点 '+(distance>=1000?(distance/1000).toFixed(1)+' 公里':distance+' 米')};
}
function tileNearby(lat,lng,radius){
 // These are actual map POIs, not invented places or sample coordinates.
 const rows=[],seen=new Set();
 if(typeof document==='undefined')return rows;
 for(const el of document.querySelectorAll('#atlasPoiOverlay .fp-poi')){
  if(!scenicIcons.has(el.dataset.poiCategory))continue;
  const p=asNearby(el.dataset.poiName,el.dataset.poiLat,el.dataset.poiLng,
    el.dataset.poiRawCategory||el.dataset.poiCategory,lat,lng,radius,el.dataset.poiId);
  if(!p||seen.has(p.id))continue;seen.add(p.id);rows.push(p);
 }
 return rows.sort((a,b)=>a.distance-b.distance);
}
function nearbyQuery(lat,lng,radius){
 const spot='around:'+radius+','+Number(lat).toFixed(6)+','+Number(lng).toFixed(6);
 const types=[
  'nwr('+spot+')["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|aquarium|theme_park)$"]["name"]',
  'nwr('+spot+')["historic"]["name"]',
  'nwr('+spot+')["leisure"~"^(park|garden|nature_reserve)$"]["name"]',
  'nwr('+spot+')["natural"~"^(beach|peak|waterfall|cave_entrance|spring)$"]["name"]',
  'nwr('+spot+')["amenity"~"^(arts_centre|place_of_worship)$"]["name"]'
 ];
 return '[out:json][timeout:13];('+types.map(x=>x+';').join('')+');out center 360;';
}
function osmNearby(data,lat,lng,radius){
 if(!Array.isArray(data?.elements))throw Error('景点服务返回了无效数据');
 const rows=[],seen=new Set();
 for(const e of data.elements){
  const t=e?.tags||{},name=t['name:zh']||t.name||t['name:en'];
  const category=t.tourism||t.historic||t.leisure||t.natural||t.amenity||'景点';
  const item=asNearby(name,e.lat??e.center?.lat,e.lon??e.center?.lon,
    category,lat,lng,radius,String(e.type)+':'+String(e.id));
  if(!item)continue;
  const signature=item.name.toLocaleLowerCase()+':'+Math.round(item.lat*10000)+':'+Math.round(item.lng*10000);
  if(seen.has(signature))continue;
  seen.add(signature);rows.push(item);
 }
 return rows.sort((a,b)=>a.distance-b.distance);
}
async function nearby(lat,lng,{signal,radius=7500}={}){
 if(!valid(lat,-90,90)||!valid(lng,-180,180))throw Error('位置无效');
 lat=+lat;lng=+lng;radius=Math.max(1000,Math.min(12000,Math.round(Number(radius)||7500)));
 const key='nearby-v2:'+lat.toFixed(5)+','+lng.toFixed(5)+':'+radius,hit=cached(key);
 if(hit!==null)return hit;
 const local=tileNearby(lat,lng,radius);
 if(local.length>=4)return remember(key,{places:local.slice(0,8),radius,source:'当前地图的真实地点'});
 const query=nearbyQuery(lat,lng,radius);
 const hosts=['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter'];
 let lastError=null;
 for(const host of hosts){
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  try{
   const data=await json(host+'?data='+encodeURIComponent(query),signal,10500);
   const osm=osmNearby(data,lat,lng,radius);
   const seen=new Set(osm.map(p=>p.name.toLocaleLowerCase()+':'+Math.round(p.lat*10000)+':'+Math.round(p.lng*10000)));
   for(const p of local){
    const k=p.name.toLocaleLowerCase()+':'+Math.round(p.lat*10000)+':'+Math.round(p.lng*10000);
    if(!seen.has(k)){seen.add(k);osm.push(p)}
   }
   osm.sort((a,b)=>a.distance-b.distance);
   return remember(key,{places:osm.slice(0,8),radius,source:'OpenStreetMap 附近地点'});
  }catch(error){
   if(signal?.aborted)throw error;
   lastError=error;console.warn('附近景点数据源暂不可用，尝试备用服务',error);
  }
 }
 if(local.length)return {places:local.slice(0,8),radius,source:'当前地图的真实地点',partial:true};
 throw new Error('附近景点数据源暂不可用：'+(lastError?.message||'网络错误'));
}
window.AtlasServices={staticHost,search,nearby};
})();
