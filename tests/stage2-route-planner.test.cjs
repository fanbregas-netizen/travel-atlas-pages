// Stage 2 functional regression: stable route order, D1-Dn, dynamic-place references,
// legacy saved plans, and no-WebGL read-only Travel Atlas viewer.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const picker=fs.readFileSync('trip-picker.js','utf8');
const viewer=fs.readFileSync('route-view.html','utf8');
const index=fs.readFileSync('index.html','utf8');
const fallback=fs.readFileSync('atlas-route-fallback.js','utf8');
const shell=fs.readFileSync('sw.js','utf8');
const start=picker.indexOf('function tripDayCount(){'),end=picker.indexOf('function openDB(',start);
assert(start>0&&end>start,'Itinerary control functions not found');
const dates={routeFromDate:'2026-11-01',routeToDate:'2026-11-03'};
const mockPicker=Function('$','labelStatus','initial',
 'let selected=initial.slice(); const stopDays=new Map();function updateAll(){};'+picker.slice(start,end)+
 ';return {tripDayCount,moveStop,balancedDays,setStopDay,get selected(){return selected.slice()},get days(){return selected.map(id=>stopDays.get(id)||1)}};');
const p=mockPicker(id=>({value:dates[id]}),()=>{},['a','b','c','d','e','f']);
assert.equal(p.tripDayCount(),3);
p.balancedDays();assert.deepEqual(p.days,[1,1,2,2,3,3]);
assert.equal(p.moveStop('a',1),true);
assert.deepEqual(p.selected,['b','a','c','d','e','f']);
assert.equal(p.moveStop('b',-1),false);
p.setStopDay('b',9);assert.equal(p.days[0],3);
dates.routeToDate='2026-10-31';assert.equal(p.tripDayCount(),1);
dates.routeToDate='2026-11-03';
assert(picker.includes('stops=values.map(id=>({placeId:id,day:'),'Route handoff must preserve day metadata');
assert(picker.includes('Array.isArray(x.stops)'),'Saved journey-only plans must appear in the route library');
const h0=viewer.indexOf('function clamp(v,a,b)'),h1=viewer.indexOf('function outlinePath(',h0);
assert(h0>0&&h1>h0,'Viewer day utilities missing');
const stopData={startDate:'2026-11-01',endDate:'2026-11-03',
 stops:[{placeId:'a',day:1},{placeId:'b',day:2},{placeId:'c',day:3}]};
const utilities=Function('routePayload','places',viewer.slice(h0,h1)+';return {totalDays,dayForPlace,dateForDay,dayForStop};');
const util=utilities(stopData,[{id:'a'},{id:'b'},{id:'c'}]);
assert.equal(util.totalDays(),3);
assert.equal(util.dayForStop(1),2);
assert.equal(util.dateForDay(3),'2026-11-03');
assert.equal(util.dayForPlace('missing'),1);
assert(viewer.includes('const previousStops=Array.isArray(item.stops)'),'Saved route viewer must honor modern plan schema');
assert(viewer.includes('const item={id,title,placeIds:ids,stops,selected:'),'Route save must preserve D1-Dn assignments and legacy compatibility');
assert(viewer.includes('const links=sourceLinks(p)')||viewer.includes('const source=sourceLinks(p)'),'Open current place links, not cached copies');
assert(viewer.includes('places=await loadPlaces(ids)'),'Viewer must read fresh Brief, photos and videos from home database');
assert(viewer.includes('window.AtlasRouteFallback.enableArchitecture(map)'),'iPhone route viewer must activate local 2D architectural geometry');
assert(viewer.includes('const fallback=MapLibre===window.AtlasRouteFallback'),'Route viewer must detect no-WebGL mode');
assert(!viewer.includes('id="chosen"'),'Viewer is not allowed to become an itinerary editor');
new Function(fallback);
assert(fallback.includes('project(a){return this._pixel'),'No-WebGL route projection must share marker coordinates');
assert(fallback.includes('const pts=Array.isArray(bounds)?bounds:'),'No-WebGL route fitBounds must accept route map bounds');
assert(fallback.includes("'source-layer'")==false||fallback.includes('decodeBuildings(buf)'),'No-WebGL route must use actual vector building footprints');
assert(index.includes('atlasJourneyEntry')&&index.includes('trip-picker.js'),'Main map must expose the route entry');
assert(shell.includes('atlas-route-fallback.js'),'Offline shell must include route fallback');
console.log('PASS: route reorder, D1–Dn day assignments, save/restore, latest media links and no-WebGL viewer');
