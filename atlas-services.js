/* Public, keyless services for the static Pages build. No credentials or user media. */
(function(){
'use strict';
const cache=new Map();
const staticHost=location.hostname.endsWith('github.io')||!!document.querySelector('meta[name="atlas-hosting"][content="static"]');
async function json(url,signal){
 const ctrl=new AbortController(),cancel=()=>ctrl.abort();
 if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,8500);
 try{const r=await fetch(url,{signal:ctrl.signal,headers:{Accept:'application/json'}});if(!r.ok)throw Error('地图服务暂不可用 ('+r.status+')');return await r.json()}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
}
const valid=(n,min,max)=>n!==undefined&&n!==null&&n!==''&&Number.isFinite(+n)&&+n>=min&&+n<=max;
const cities=['北京','上海','天津','重庆','广州','深圳','杭州','苏州','南京','成都','武汉','西安','长沙','青岛','厦门','宁波','温州','绍兴','嘉兴','湖州','台州','舟山','金华','丽水','衢州','昆明','三亚','大理','丽江'];
function term(q){const city=/^[\u3400-\u9fff]+$/.test(q)?cities.find(c=>q.startsWith(c)&&q.length>=c.length+2):null;return city?city+' '+q.slice(city.length):q}
function feature(f){const [lon,lat]=f.geometry?.coordinates||[];if(!valid(lat,-90,90)||!valid(lon,-180,180))return null;const p=f.properties||{},name=p.name||p.street||p.city||'';if(!name)return null;return {lat:+lat,lon:+lon,name,display_name:[...new Set([name,p.city,p.state,p.country].filter(Boolean))].join(' · '),type:p.osm_value||p.osm_key||'地点',id:[p.osm_type,p.osm_id].join(':')}}
function remember(key,data){cache.set(key,{time:Date.now(),data});if(cache.size>40)cache.delete(cache.keys().next().value);return data}
function cached(key){const value=cache.get(key);return value&&Date.now()-value.time<300000?value.data:null}
async function search(q,{signal,center,allowFallback=false}={}){
 q=String(q).trim().slice(0,120);if(q.length<2)return [];
 const centerKey=valid(center?.lat,-90,90)&&valid(center?.lng,-180,180)?Number(center.lat).toFixed(2)+','+Number(center.lng).toFixed(2):'global';
 const key='search:'+q+':'+centerKey+':'+(allowFallback?'submitted':'suggest'),hit=cached(key);if(hit)return hit;
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
function isAttraction(p){return p.osm_key==='tourism'&&['attraction','museum','viewpoint','gallery','artwork','zoo','aquarium'].includes(p.osm_value)||p.osm_key==='historic'&&!['yes','memorial_plaque'].includes(p.osm_value)||p.osm_key==='leisure'&&['park','garden','nature_reserve'].includes(p.osm_value)||p.osm_key==='natural'&&['beach','peak','cave_entrance','waterfall','cliff','spring'].includes(p.osm_value)}
async function nearby(lat,lng,{signal,radius=1800}={}){
 if(!valid(lat,-90,90)||!valid(lng,-180,180))throw Error('位置无效');
 const key='near:'+Number(lat).toFixed(5)+','+Number(lng).toFixed(5)+':'+Number(radius),hit=cached(key);if(hit)return hit;
 const url=new URL('https://photon.komoot.io/reverse');url.search=new URLSearchParams({lat,lon:lng,limit:'50'});
 const data=await json(url,signal),places=[],seen=new Set();
 for(const f of data.features||[]){const p=f.properties||{},item=feature(f);if(!item||!isAttraction(p))continue;const distance=meters(+lat,+lng,item.lat,item.lon),id=item.id+item.name;
  if(distance<25||distance>radius||seen.has(id))continue;seen.add(id);places.push({...item,lng:item.lon,distance,address:item.display_name});
 }
 places.sort((a,b)=>a.distance-b.distance);return remember(key,{places:places.slice(0,5),source:'Photon / OpenStreetMap'});
}
window.AtlasServices={staticHost,search,nearby};
})();
