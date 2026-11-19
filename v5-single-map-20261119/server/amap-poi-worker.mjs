/* Footprint Map | Cloudflare Worker reference implementation.
 * Secret never travels to GitHub Pages, source control, or the browser.
 * Requires AMAP_WEB_SERVICE_KEY + POI_RATE_LIMITER rate-limit binding.
 * No deployment is performed by this repository patch.
 */
const json=(body,status=200,origin='',extra={})=>new Response(JSON.stringify(body),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{}),...extra}
});
const finite=(n,low,high)=>n!==''&&n!==null&&Number.isFinite(+n)&&+n>=low&&+n<=high;
const inChina=(lng,lat)=>lng>=72.004&&lng<=137.8347&&lat>=.8293&&lat<=55.8271;
const PI=Math.PI,A=6378245,EE=.00669342162296594323;
function transformLat(x,y){return -100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x))+(20*Math.sin(6*x*PI)+20*Math.sin(2*x*PI))*2/3+(20*Math.sin(y*PI)+40*Math.sin(y/3*PI))*2/3+(160*Math.sin(y/12*PI)+320*Math.sin(y*PI/30))*2/3}
function transformLng(x,y){return 300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x))+(20*Math.sin(6*x*PI)+20*Math.sin(2*x*PI))*2/3+(20*Math.sin(x*PI)+40*Math.sin(x/3*PI))*2/3+(150*Math.sin(x/12*PI)+300*Math.sin(x/30*PI))*2/3}
function wgsToGcj(lng,lat){
 if(!inChina(lng,lat))return [lng,lat];
 const x=lng-105,y=lat-35,rad=lat/180*PI,sin=Math.sin(rad),magic=1-EE*sin*sin,sqrt=Math.sqrt(magic);
 return [lng+transformLng(x,y)*180/(A/sqrt*Math.cos(rad)*PI),lat+transformLat(x,y)*180/((A*(1-EE))/(magic*sqrt)*PI)]
}
function gcjToWgs(lng,lat){
 if(!inChina(lng,lat))return [lng,lat];
 let wlng=lng,wlat=lat;for(let n=0;n<3;n++){const [gLng,gLat]=wgsToGcj(wlng,wlat);wlng+=lng-gLng;wlat+=lat-gLat}
 return [wlng,wlat]
}
const typecodes={
 all:'050000|060000|070000|080000|090000|100000|110000|120000|130000|140000|150000|160000|170000',
 scenic:'110000|140000',food:'050000',hotel:'100000',transit:'150000',culture:'140000',park:'110000',shopping:'060000',arts:'140000'
};
const asText=v=>typeof v==='string'?v:String(v??'');
function sanitizePoi(p,coords){
 if(!p||!p.name||!p.location||!p.id)return null;
 const location=asText(p.location).split(','),gLng=Number(location[0]),gLat=Number(location[1]);
 if(!finite(gLng,-180,180)||!finite(gLat,-90,90))return null;
 const [lng,lat]=coords==='wgs84'?gcjToWgs(gLng,gLat):[gLng,gLat];
 return {id:asText(p.id).slice(0,90),name:asText(p.name).slice(0,100),
  lng:+lng.toFixed(7),lat:+lat.toFixed(7),category:asText(p.typecode||p.type||'地点').slice(0,80),
  typecode:asText(p.typecode||'').slice(0,28),address:asText(p.address||'').slice(0,140),
  city:asText(p.cityname||'').slice(0,55)}
}
async function handle(request,env){
 const method=request.method,origin=request.headers.get('Origin')||'';
 const allowed=(env.ALLOWED_ORIGINS||'https://fanbregas-netizen.github.io').split(',').map(s=>s.trim()).filter(Boolean);
 const ok=allowed.includes(origin);
 if(method==='OPTIONS')return new Response(null,{status:ok?204:403,headers:ok?{
  'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS',
  'Access-Control-Allow-Headers':'Accept','Access-Control-Max-Age':'1800','Vary':'Origin'
 }:{}});
 if(method!=='GET')return json({code:'METHOD_NOT_ALLOWED'},405,ok?origin:'');
 if(!ok)return json({code:'ORIGIN_DENIED'},403);
 if(!env.AMAP_WEB_SERVICE_KEY)return json({code:'KEY_REQUIRED',places:[]},503,origin);
 // Public POI access must be quota-gated; no unlimited account-billed endpoint.
 if(typeof env.POI_RATE_LIMITER?.limit!=='function')return json({code:'RATE_LIMIT_REQUIRED',places:[]},503,origin);
 const client=request.headers.get('CF-Connecting-IP')||'unknown';
 const limit=await env.POI_RATE_LIMITER.limit({key:client});
 if(!limit?.success)return json({code:'RATE_LIMITED',places:[]},429,origin);
 const url=new URL(request.url);if(!url.pathname.endsWith('/api/amap-poi'))return json({code:'NOT_FOUND'},404,origin);
 const mode=url.searchParams.get('mode')||'nearby',coordinate=url.searchParams.get('coordinate')==='wgs84'?'wgs84':'gcj02';
 if(!['nearby','text'].includes(mode))return json({code:'INVALID_MODE',places:[]},400,origin);
 const upstream=new URL('https://restapi.amap.com/v5/place/'+(mode==='nearby'?'around':'text'));
 upstream.searchParams.set('key',env.AMAP_WEB_SERVICE_KEY);
 upstream.searchParams.set('output','json');upstream.searchParams.set('page_size','25');upstream.searchParams.set('page_num','1');
 upstream.searchParams.set('langCode','zh');
 if(mode==='nearby'){
  const lat=url.searchParams.get('lat'),lng=url.searchParams.get('lng');
  if(!finite(lat,-85,85)||!finite(lng,-180,180)||!inChina(+lng,+lat))return json({code:'OUT_OF_REGION',places:[]},400,origin);
  const [gLng,gLat]=coordinate==='wgs84'?wgsToGcj(+lng,+lat):[+lng,+lat];
  upstream.searchParams.set('location',gLng.toFixed(6)+','+gLat.toFixed(6));
  const radius=Math.min(5000,Math.max(150,Math.round(+url.searchParams.get('radius')||1800)));
  upstream.searchParams.set('radius',String(radius));
  upstream.searchParams.set('types',typecodes[url.searchParams.get('category')]||typecodes.all);
  upstream.searchParams.set('sortrule','weight');
 }else{
  const q=(url.searchParams.get('q')||'').trim();
  if(q.length<2||q.length>72)return json({code:'INVALID_KEYWORD',places:[]},400,origin);
  upstream.searchParams.set('keywords',q);
 }
 let response,payload;
 try{
  // Abort upstream to prevent a bad external connection consuming Worker time.
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{response=await fetch(upstream,{signal:controller.signal,headers:{Accept:'application/json'}});payload=await response.json()}finally{clearTimeout(timer)}
 }catch{return json({code:'AMAP_UNAVAILABLE',places:[]},502,origin)}
 if(!response.ok||payload?.status!=='1'||!Array.isArray(payload.pois))
  return json({code:'AMAP_PROVIDER_ERROR',places:[],providerCode:asText(payload?.infocode||'').slice(0,10)},502,origin);
 const rows=payload.pois.map(p=>sanitizePoi(p,coordinate)).filter(Boolean).slice(0,25);
 return json({source:'AMap POI 2.0',places:rows,count:rows.length},200,origin,{
  'Cache-Control':'public, max-age=60, s-maxage=120'
 });
}
export default {fetch:handle};
export {handle,wgsToGcj,gcjToWgs,sanitizePoi};
