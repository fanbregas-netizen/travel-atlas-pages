/* Footprint Map V4 | Road network service, review-safe adapter.
   Public FOSSGIS OSRM endpoints are preview-only, rate-limited best-effort services.
   Configure owned/contracted OSRM URLs before production. No fabricated ETA. */
(()=>{'use strict';
if(window.__fpLiveRouting)return;
const endpoints=Object.assign({
 car:'https://routing.openstreetmap.de/routed-car/route/v1/driving/',
 walk:'https://routing.openstreetmap.de/routed-foot/route/v1/driving/',
 bike:'https://routing.openstreetmap.de/routed-bike/route/v1/driving/'
},window.__fpRoutingEndpoints||{});
const cache=new Map(),pending=new Map();let queue=Promise.resolve(),lastRequest=0;
let active=[],map=null,version=0,drawScheduled=false,matrix=null,matrixKey='',matrixLoading=null;
const age=15*60*1000;
const coord=p=>[Number(p.lng),Number(p.lat)];
const valid=p=>p&&Number.isFinite(+p.lng)&&Number.isFinite(+p.lat)&&Math.abs(+p.lat)<=85.05&&Math.abs(+p.lng)<=180;
const key=(a,b,mode)=>mode+'|'+a.id+'|'+b.id+'|'+coord(a).join(',')+'|'+coord(b).join(',');
const duration=s=>s>=3600?'约 '+(s/3600).toFixed(1)+' 小时':'约 '+Math.max(1,Math.round(s/60))+' 分钟';
const task=work=>{const p=queue.catch(()=>{}).then(async()=>{const delay=Math.max(0,1250-(Date.now()-lastRequest));if(delay)await new Promise(r=>setTimeout(r,delay));lastRequest=Date.now();return work()});queue=p.catch(()=>{});return p};
async function json(url){
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),11000);
 try{const res=await fetch(url,{signal:ac.signal,mode:'cors',headers:{Accept:'application/json'}});
 if(!res.ok)throw Error('路由服务 HTTP '+res.status);return await res.json()}finally{clearTimeout(timer)}
}
function get(a,b,mode){
 if(!valid(a)||!valid(b)||!endpoints[mode])return Promise.resolve(null);
 const id=key(a,b,mode),hit=cache.get(id);
 if(hit&&Date.now()-hit.when<age)return Promise.resolve(hit);
 if(pending.has(id))return pending.get(id);
 const url=endpoints[mode]+coord(a).join(',')+';'+coord(b).join(',')+'?overview=full&geometries=geojson&steps=false';
 const p=task(async()=>{
  const obj=await json(url),r=obj?.routes?.[0],pts=r?.geometry?.coordinates;
  if(obj?.code!=='Ok'||!Array.isArray(pts)||pts.length<2||!Number.isFinite(+r.distance)||!Number.isFinite(+r.duration))throw Error('暂无可用道路线');
  const result={when:Date.now(),mode,distance:r.distance,duration:r.duration,geometry:pts,status:'ok'};
  cache.set(id,result);return result
 }).catch(e=>{const item={when:Date.now(),status:'error',reason:e?.message||'无法连接路由服务'};cache.set(id,item);return item})
 .finally(()=>{pending.delete(id);document.dispatchEvent(new CustomEvent('fp:route-network-update'))});
 pending.set(id,p);return p;
}
function peek(a,b,mode){
 if(mode==='transit')return {state:'external',label:'公交 · 查看换乘'};
 if(!valid(a)||!valid(b))return {state:'error',label:'地点缺少坐标'};
 const result=cache.get(key(a,b,mode));
 if(!result){get(a,b,mode);return {state:'loading',label:'正在计算道路用时'};}
 if(result.status!=='ok')return {state:'error',label:'暂无道路用时'};
 return {state:'ok',label:duration(result.duration)+' · '+(result.distance/1000).toFixed(1)+' 公里',seconds:result.duration,meters:result.distance};
}
function link(a,b,mode){
 if(!valid(a)||!valid(b))return '';
 // Live transit options are opened in the chosen navigation provider. No fake in-app GTFS.
 const from=a.lat+','+a.lng,to=b.lat+','+b.lng;
 return 'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(from)+'&destination='+encodeURIComponent(to)+'&travelmode='+(mode==='transit'?'transit':mode==='car'?'driving':mode==='walk'?'walking':'bicycling');
}
function update(order,places,mainMode,legModes){
 const all=order.map(id=>places.find(p=>String(p.id)===String(id))).filter(Boolean);
 const token=++version;active=[];
 for(let i=1;i<all.length;i++){
  const a=all[i-1],b=all[i],mode=legModes?.[a.id]||mainMode;
  const item={a,b,mode};active.push(item);
  if(endpoints[mode])get(a,b,mode).then(()=>{if(token===version)scheduleDraw()});
 }
 scheduleDraw();
}
function scheduleDraw(){if(drawScheduled)return;drawScheduled=true;requestAnimationFrame(()=>{drawScheduled=false;draw()})}
function draw(){
 const live=window.__atlasRV?.currentMap;if(!live||typeof live.getSource!=='function')return;
 map=live;if(!map.isStyleLoaded?.())return;
 const features=[];let waiting=false;
 for(const item of active){
  if(!endpoints[item.mode])continue;
  const hit=cache.get(key(item.a,item.b,item.mode));
  if(!hit){waiting=true;continue}
  if(hit.status!=='ok')continue;
  features.push({type:'Feature',properties:{mode:item.mode},geometry:{type:'LineString',coordinates:hit.geometry}});
 }
 const data={type:'FeatureCollection',features};
 try{
  if(!map.getSource('fp-live-roads'))map.addSource('fp-live-roads',{type:'geojson',data});
  else map.getSource('fp-live-roads').setData(data);
  if(!map.getLayer('fp-live-roads-outline'))map.addLayer({id:'fp-live-roads-outline',type:'line',source:'fp-live-roads',
   paint:{'line-color':'#fffefa','line-width':6,'line-opacity':.92},layout:{'line-cap':'round','line-join':'round'}});
  if(!map.getLayer('fp-live-roads-line'))map.addLayer({id:'fp-live-roads-line',type:'line',source:'fp-live-roads',
   paint:{'line-color':'#415d48','line-width':3.4,'line-opacity':.96},layout:{'line-cap':'round','line-join':'round'}});
  document.body.classList.toggle('fp-has-live-road',features.length>0);
  document.body.classList.toggle('fp-live-road-partial',waiting||features.length<active.length);
 }catch(err){console.warn('路线图层稍后加载',err)}
}
async function prepareMatrix(points,mode){
 if(!endpoints[mode]||points.length<3||points.length>10){matrix=null;matrixKey='';return}
 const id=mode+'|'+points.map(p=>p.id+'@'+coord(p).join(',')).join(';');
 if(matrixKey===id&&(matrix||matrixLoading))return matrixLoading;
 matrixKey=id;matrix=null;
 const url=endpoints[mode].replace('/route/v1/','/table/v1/')+points.map(p=>coord(p).join(',')).join(';')+'?annotations=distance';
 matrixLoading=task(()=>json(url)).then(obj=>{
  if(matrixKey!==id)return;
  if(obj?.code==='Ok'&&Array.isArray(obj.distances))matrix={index:new Map(points.map((p,i)=>[String(p.id),i])),distances:obj.distances};
 }).catch(()=>{matrix=null}).finally(()=>{if(matrixKey===id){matrixLoading=null;document.dispatchEvent(new CustomEvent('fp:route-network-update'))}});
 return matrixLoading;
}
function metric(a,b,mode){
 if(!matrix||!a||!b||!endpoints[mode]||!matrixKey.startsWith(mode+'|'))return null;
 const i=matrix.index.get(String(a.id)),j=matrix.index.get(String(b.id));
 const meters=matrix.distances?.[i]?.[j];
 return Number.isFinite(meters)?meters/1000:null;
}
window.__fpLiveRouting={peek,link,update,prepareMatrix,metric,get,
 get state(){return {segments:active.length,network:active.map(s=>({a:s.a.id,b:s.b.id,mode:s.mode,status:peek(s.a,s.b,s.mode).state}))}}};
document.addEventListener('atlas:route-stops-changed',scheduleDraw);
let tries=0;(function attach(){const m=window.__atlasRV?.currentMap;if(m&&m!==map){map=m;map.on?.('styledata',scheduleDraw);map.on?.('load',scheduleDraw);scheduleDraw()}else if(++tries<100)setTimeout(attach,400)})();
})();