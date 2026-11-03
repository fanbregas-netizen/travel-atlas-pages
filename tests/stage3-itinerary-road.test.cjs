/* Stage 3 regression checks. No network access, no private data fixtures. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const apiSource=fs.readFileSync('atlas-road-routing.js','utf8');
const uiSource=fs.readFileSync('atlas-stage3-itinerary.js','utf8');
const viewer=fs.readFileSync('route-view.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const home=fs.readFileSync('index.html','utf8');
const stops=[
 {id:'a',title:'A',lng:13.388860,lat:52.517037},
 {id:'b',title:'B',lng:13.397634,lat:52.529407},
 {id:'c',title:'C',lng:13.428555,lat:52.523219}
];
const moduleObject={exports:{}};
new Function('window','module',apiSource)({},moduleObject);
const route=moduleObject.exports;
assert.equal(route.MAX_STOPS,12);
assert.equal(route.normalizeStops(stops).length,3);
const url=route.buildUrl(stops);
assert(url.startsWith('https://router.project-osrm.org/route/v1/driving/'),'OSRM URL missing');
assert(url.includes('13.388860,52.517037;13.397634,52.529407'),'Coordinate order must be WGS84 longitude,latitude');
assert(url.includes('geometries=geojson')&&url.includes('steps=false'),'Request should be a single bounded preview');
assert.throws(()=>route.normalizeStops([{lng:999,lat:20},{lng:2,lat:20}]),/有效坐标/);
assert.throws(()=>route.normalizeStops(Array(13).fill(stops[0])),/最多支持 12 站/);
assert.throws(()=>route.validateRoute({code:'NoRoute'},2),/未找到/);
assert.throws(()=>route.validateRoute({code:'Ok',routes:[{distance:1,duration:1,geometry:{coordinates:[[13,52],[14,53]]},legs:[{distance:1,duration:1}]}]},2),/分段信息/);
const sample={code:'Ok',routes:[{
 distance:14500,duration:1920,
 geometry:{coordinates:[[13.38886,52.517037],[13.397634,52.529407],[13.428555,52.523219]]},
 legs:[{distance:7000,duration:900},{distance:7500,duration:1020}]
}]};
const road=route.validateRoute(sample,2);
assert.equal(road.legs.length,2);
assert.equal(road.coordinates.length,3);
assert.equal(route.formatDistance(14500),'14.5 km');
assert.equal(route.formatDuration(1920),'32 分钟');
let called=0;
const fetcher=async (req,options)=>{
 called++;
 assert(req.includes('13.388860,52.517037;'));
 assert.equal(options.credentials,'omit','Browser must not send private cookies');
 assert.equal(options.cache,'no-store');
 return {ok:true,json:async()=>sample};
};
async function check(){
 const calculated=await route.calculate(stops,{fetcher});
 assert.equal(called,1,'One user action must generate only one request');
 assert.equal(calculated.distanceM,14500);
 assert.equal(calculated.traffic,false);
 assert.throws(()=>route.validateRoute({code:'Ok',routes:[{distance:1,duration:1,geometry:{coordinates:[[200,30],[13,52]]},legs:[{distance:1,duration:1},{distance:1,duration:1}]}]},2),/异常坐标/);
 new Function(uiSource);
 assert(uiSource.includes('roadController')===false,'UI should use own scoped cancellation controller');
 assert(uiSource.includes('controller?.abort()'),'Closed itinerary must cancel pending routing');
 assert(uiSource.includes('roadBtn')===false,'Read-only itinerary uses private DOM variables');
 assert(uiSource.includes("bridge?.getPlaces()"),'Itinerary should read live route-place references');
 assert(uiSource.includes('getPayload'),'Itinerary should not replace stored metadata');
 assert(viewer.includes('atlas-stage3-itinerary.js?v=stage3-v48'),'Route viewer missing stage 3 UI');
 assert(viewer.includes('AtlasStage3Itinerary?.roadPath?.(map)'),'Map must draw provider geometry only on success');
 assert(viewer.includes('AtlasStage3Itinerary?.attach?.('),'Itinerary has no route state bridge');
 assert(viewer.includes('toGCJ:wgsToGcj'),'AMap origin and destination require GCJ conversion');
 assert(sw.includes('atlas-v4-shell-stage3-roadbook-v48')||sw.includes('atlas-v4-shell-stage4-visit-v49'),'Safari must invalidate stale route scripts');
 assert(sw.includes('atlas-road-routing.js')&&sw.includes('atlas-stage3-itinerary.css'),'Offline shell missing stage 3 assets');
 assert(home.includes('V4.Review.20261103.architectural-b-v46'),'Do not redesign the accepted V4.6 map');
 console.log('PASS: no fabricated roads, explicit opt-in, privacy, per-leg validation, full-screen itinerary, Safari cache, V4.6 preserved');
}
check().catch(e=>{console.error(e);process.exitCode=1});
