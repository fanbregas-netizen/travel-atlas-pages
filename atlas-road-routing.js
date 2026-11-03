/* Travel Atlas | stage 3 road-route preview.
 * Explicit opt-in only: user taps "道路试算", then selected coordinates are sent
 * to the public OSRM demo. Never auto-submit private route coordinates on page load.
 * The public demo is best-effort, NOT live traffic, navigation, or production SLA.
 * Navigation in China uses official AMap URI separately.
 */
(function(root){
 'use strict';
 const ENDPOINT='https://router.project-osrm.org/route/v1/driving/';
 const MAX_STOPS=12,MAX_GEOMETRY=14000,TIMEOUT_MS=16000;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function normalizeStops(list){
  if(!Array.isArray(list)||list.length<2)throw Error('至少选择两处路线地点');
  if(list.length>MAX_STOPS)throw Error('公开试算服务每次最多支持 12 站；其他站点仍可使用高德导航');
  return list.map((item,i)=>{
   const lng=Number(item?.lng),lat=Number(item?.lat);
   if(!finite(lng)||!finite(lat)||Math.abs(lat)>85||Math.abs(lng)>180||item?.lat==null||item?.lng==null)throw Error('第 '+(i+1)+' 站没有有效坐标');
   return {id:String(item.id??i),title:String(item.title||item.name||'第'+(i+1)+'站').slice(0,100),lat,lng};
  });
 }
 function buildUrl(list){
  const normalized=normalizeStops(list);
  const params=normalized.map(p=>p.lng.toFixed(6)+','+p.lat.toFixed(6)).join(';');
  return ENDPOINT+params+'?overview=simplified&geometries=geojson&steps=false';
 }
 function validateRoute(body,expectedLegs){
  if(body?.code!=='Ok'||!Array.isArray(body.routes)||!body.routes.length)throw Error('道路服务未找到可用路线');
  const route=body.routes[0];
  if(!finite(route.distance)||route.distance<0||!finite(route.duration)||route.duration<0)throw Error('道路服务未返回可信的距离和时间');
  const points=route.geometry?.coordinates;
  if(!Array.isArray(points)||points.length<2||points.length>MAX_GEOMETRY)throw Error('道路服务返回的路线图形无效');
  if(!points.every(p=>Array.isArray(p)&&p.length>=2&&finite(p[0])&&finite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85))throw Error('道路路径包含异常坐标');
  if(!Array.isArray(route.legs)||route.legs.length!==expectedLegs)throw Error('道路服务返回的分段信息不完整');
  const legs=route.legs.map((l,i)=>{
   if(!finite(l.distance)||l.distance<0||!finite(l.duration)||l.duration<0)throw Error('第 '+(i+1)+' 段道路信息无效');
   return {distanceM:l.distance,durationSec:l.duration};
  });
  return {coordinates:points.map(p=>[p[0],p[1]]),legs,distanceM:route.distance,durationSec:route.duration,provider:'OSRM demo / OpenStreetMap',traffic:false};
 }
 async function calculate(stops,opts={}){
  const normalized=normalizeStops(stops);
  const fetcher=opts.fetcher||root.fetch;
  if(typeof fetcher!=='function')throw Error('浏览器不支持网络路线请求');
  const controller=new AbortController(),signal=opts.signal;
  const onAbort=()=>controller.abort();
  if(signal?.aborted)throw Error('道路试算已取消');
  if(signal)signal.addEventListener('abort',onAbort,{once:true});
  const timeout=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
   const response=await fetcher(buildUrl(normalized),{
    method:'GET',mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal,
    headers:{Accept:'application/json'}
   });
   if(!response?.ok)throw Error('道路服务暂不可用（HTTP '+(response?.status||'?')+'）');
   const json=await response.json();
   return validateRoute(json,normalized.length-1);
  }catch(err){
   if(controller.signal.aborted)throw Error(signal?.aborted?'道路试算已取消':'道路服务响应超时，请改用高德地图导航');
   throw err;
  }finally{
   clearTimeout(timeout);
   if(signal)signal.removeEventListener('abort',onAbort);
  }
 }
 function formatDistance(meters){return meters>=1000?(meters/1000).toFixed(1)+' km':Math.round(meters)+' m'}
 function formatDuration(seconds){
  const minutes=Math.round(seconds/60),h=Math.floor(minutes/60),m=minutes%60;
  return h?h+' 小时'+(m?' '+m+' 分钟':''):m+' 分钟';
 }
 const api=Object.freeze({MAX_STOPS,normalizeStops,buildUrl,validateRoute,calculate,formatDistance,formatDuration});
 root.AtlasRoadRouting=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
