import assert from 'node:assert/strict';
import worker,{handle,wgsToGcj,gcjToWgs,sanitizePoi} from './server/amap-poi-worker.mjs';
const origin='https://fanbregas-netizen.github.io';
const headers={'Origin':origin,'CF-Connecting-IP':'203.0.113.14'};
const env={AMAP_WEB_SERVICE_KEY:'NEVER_EXPOSE_SAMPLE_SECRET',ALLOWED_ORIGINS:origin,POI_RATE_LIMITER:{limit:async()=>({success:true})}};
const input={lat:31.241,lng:121.456};
const mapped=wgsToGcj(input.lng,input.lat);
assert.ok(Math.abs(mapped[0]-input.lng)>.001 && Math.abs(mapped[1]-input.lat)>.001,'WGS84 should change in China');
const reverse=gcjToWgs(...mapped);
assert.ok(Math.abs(reverse[0]-input.lng)<1e-6&&Math.abs(reverse[1]-input.lat)<1e-6,'GCJ02 inverse conversion must be accurate');
assert.equal(typeof worker.fetch,'function');
const response=(path,h=headers,e=env)=>handle(new Request('https://proxy.example/'+path,{headers:h}),e);
const oldFetch=globalThis.fetch;let lastUrl='';
globalThis.fetch=async req=>{
 const u=new URL(typeof req==='string'?req:req.url);lastUrl=u.href;
 assert.equal(u.hostname,'restapi.amap.com');
 assert.equal(u.pathname,'/v5/place/around');
 assert.equal(u.searchParams.get('page_size'),'25');
 assert.equal(u.searchParams.get('key'),'NEVER_EXPOSE_SAMPLE_SECRET');
 assert.equal(u.searchParams.get('langCode'),'zh');
 assert.notEqual(u.searchParams.get('location'),input.lng+','+input.lat);
 return new Response(JSON.stringify({status:'1',infocode:'10000',pois:[{
  id:'B0001',name:'附近咖啡店',location:mapped[0]+','+mapped[1],
  type:'餐饮服务;咖啡厅',typecode:'050500',address:'长寿路'
 }]}),{status:200,headers:{'Content-Type':'application/json'}});
};
try{
 let r=await response('api/amap-poi?mode=nearby&lng=121.456&lat=31.241&radius=1700&coordinate=wgs84');
 assert.equal(r.status,200);
 let result=await r.json();assert.equal(result.source,'AMap POI 2.0');
 assert.equal(result.places[0].name,'附近咖啡店');
 assert.ok(Math.abs(result.places[0].lng-input.lng)<1e-5);
 assert.ok(Math.abs(result.places[0].lat-input.lat)<1e-5);
 assert.ok(!JSON.stringify(result).includes('NEVER_EXPOSE_SAMPLE_SECRET'),'Key leaked to browser');
 r=await response('api/amap-poi?mode=nearby&lng=121.456&lat=31.241',{Origin:'https://evil.example'});
 assert.equal(r.status,403);
 r=await response('api/amap-poi?mode=nearby&lng=121.456&lat=31.241',headers,{...env,AMAP_WEB_SERVICE_KEY:''});
 assert.equal(r.status,503);assert.equal((await r.json()).code,'KEY_REQUIRED');
 r=await response('api/amap-poi?mode=nearby&lng=121.456&lat=31.241',headers,{...env,POI_RATE_LIMITER:{limit:async()=>({success:false})}});
 assert.equal(r.status,429);
 r=await response('api/amap-poi?mode=nearby&lng=121.456&lat=31.241',headers,{...env,POI_RATE_LIMITER:null});
 assert.equal(r.status,503);
 r=await response('api/amap-poi?mode=nearby&lng=148&lat=-12');
 assert.equal(r.status,400);
 r=await response('api/amap-poi?mode=text&q=%E5%92%96%E5%95%A1');
 assert.equal(r.status,200);
 assert.ok(lastUrl.includes('/v5/place/text?'));
 console.log('PASS AMap contract: 2.0 official request, WGS84 roundtrip, origin/rate/key enforcement, never leaks key; no live provider credentials used');
}finally{globalThis.fetch=oldFetch}
