'use strict';
/* Real browser smoke for PR #52 map flicker, two maps, V3 POI, V12 sheet.
 * Must use actual CDN MapLibre tiles, not static or mocked map screenshots. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {webkit}=require('playwright');
const base='http://127.0.0.1:8765/v5-quality-full-product-20261119/';
const timeout=60000;
async function inspectMap(page,kind){
 await page.waitForFunction(()=>window.__atlasBlueGrayMap?.status?.().applied>0,null,{timeout});
 if(kind==='home'){
  await page.waitForFunction(()=>window.__atlasMapHealth?.().ready===true,null,{timeout});
 }else{
  await page.waitForFunction(()=>window.FootprintRouteV5Real?.map?.areTilesLoaded?.()&&document.documentElement.dataset.fpMapTheme==='bluegray-v18',null,{timeout});
 }
 const values=await page.evaluate(kind=>{
  const map=kind==='home'?window.__atlasPOIBridge?.vector?.():window.FootprintRouteV5Real?.map;
  const canvas=document.querySelector(kind==='home'?'#atlasVectorMap .maplibregl-canvas':'#atlasMap .maplibregl-canvas');
  const layers=map?.getStyle?.()?.layers||[];
  const paints=layers.filter(l=>l.type==='background').map(l=>l.paint?.['background-color']);
  const parent=canvas?.parentElement?.getBoundingClientRect();
  return {
   theme:document.documentElement.dataset.fpMapTheme,applied:window.__atlasBlueGrayMap.status().applied,
   provider:window.__atlasMapHealth?.().provider||'route',mapCount:document.querySelectorAll('.maplibregl-canvas').length,
   opacity:canvas?getComputedStyle(canvas).opacity:'missing',canvasPresent:!!canvas,
   colors:paints,palette:window.__atlasBlueGrayMap.palette.background,
   version:window.maplibregl?.version,rect:parent?{w:parent.width,h:parent.height}:null,
   routeMarkers:document.querySelectorAll('#pins .fp-route-map-star').length,
   savedMarkerIcons:[...document.querySelectorAll('#pins .fp-route-saved-pin img')].map(x=>x.getAttribute('src')),
   history:window.__fpThemeTimeline||[]
  };
 },kind);
 assert.equal(values.theme,'bluegray-v18',kind+' was not colored by accepted A');
 assert.equal(values.palette,'#485D6B',kind+' painter palette mismatch');
 assert.ok(values.applied>0,kind+' missing repaint');
 assert.ok(values.canvasPresent,kind+' has no active WebGL canvas');
 assert.ok(+values.opacity>.9,kind+' canvas was never revealed');
 assert.ok(values.rect&&values.rect.w>300&&values.rect.h>350,kind+' canvas collapsed');
 assert.equal(values.version,'5.12.0','home/route MapLibre mismatch');
 assert.equal(values.mapCount,1,kind+' duplicate WebGL canvases');
 const visibleWithoutTheme=values.history.filter(x=>x.active&&x.visible&&x.theme!=='bluegray-v18');
 assert.equal(visibleWithoutTheme.length,0,kind+' showed bright unthemed canvas during startup: '+JSON.stringify(visibleWithoutTheme.slice(0,4)));
 assert.ok(values.colors.some(x=>x==='#485D6B'),kind+' never painted a blue-gray background layer: '+JSON.stringify(values.colors.slice(0,8)));
 return values;
}
async function registerThemeTimeline(page){
 await page.addInitScript(()=>{
  window.__fpThemeTimeline=[];
  const start=performance.now();
  const id=setInterval(()=>{
   if(performance.now()-start>19000||window.__fpThemeTimeline.length>240){clearInterval(id);return}
   const route=!!document.getElementById('stage');
   const canvas=document.querySelector(route?'#atlasMap .maplibregl-canvas':'#atlasVectorMap .maplibregl-canvas');
   const active=route?!!canvas:document.body?.classList.contains('vector-active');
   const s=canvas&&getComputedStyle(canvas);
   const visible=!!(canvas&&s&&+s.opacity>.9&&s.display!=='none'&&s.visibility!=='hidden'&&canvas.getBoundingClientRect().width>10);
   window.__fpThemeTimeline.push({t:Math.round(performance.now()),theme:document.documentElement?.dataset?.fpMapTheme||'',active:!!active,visible});
  },80);
 });
}
(async()=>{
 const browser=await webkit.launch({headless:true});
 try{
  for(const width of [375,390]){
   const ctx=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await registerThemeTimeline(page);
   await page.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout});
   await page.waitForFunction(()=>window.__atlasMapHealth&&window.__atlasBlueGrayMap,null,{timeout:25000});
   const home=await inspectMap(page,'home');
   assert.equal(await page.locator('#atlasPoiOverlay').count(),1);
   // The home POI plane must stay visible and anchored during any camera movement.
   const before=await page.evaluate(()=>window.__atlasQA?.().poiButtons);
   await page.evaluate(()=>{const m=window.__atlasPOIBridge?.vector?.();if(m){const c=m.getCenter();m.easeTo({center:[c.lng+.004,c.lat+.004],duration:320})}});
   await page.waitForTimeout(430);
   assert.equal(await page.locator('#atlasPoiOverlay').evaluate(e=>getComputedStyle(e).opacity),'1');
   const after=await page.evaluate(()=>window.__atlasQA?.().poiButtons);
   assert.ok(before>=0&&after>=0,'home POI bridge is missing');
   await page.waitForFunction(()=>!!window.__atlasPlaceStore?.save&&!!window.FootprintMediaCore?.createRepository,null,{timeout:25000});
   const a='quality-a-'+width,b='quality-b-'+width,trip='quality-route-'+width;
   await page.evaluate(async({a,b,trip})=>{
    await window.__atlasPlaceStore.save({id:a,title:'海边建筑',lat:29.492,lng:121.905,starred:true,stage:'plan',note:'蓝灰地图 A',photos:[]});
    await window.__atlasPlaceStore.save({id:b,title:'古城街区',lat:29.542,lng:121.960,starred:true,stage:'plan',note:'路线地点 V5',photos:[]});
    const repo=window.FootprintMediaCore.createRepository(indexedDB);
    await repo.saveRoute({id:trip,title:'V5 地图视觉验收',startDate:'2026-11-20',endDate:'2026-11-21',stops:[{placeId:a,order:1,day:1},{placeId:b,order:2,day:1}],placeIds:[a,b]});
   },{a,b,trip});
   await page.goto(base+'journey.html?saved='+trip,{waitUntil:'domcontentloaded',timeout});
   await page.waitForFunction(()=>window.__footprintV5ProductReady===true&&window.__fpV12RouteDetail?.version==='V12-shared-placeId'&&window.__footprintV5Demo?.state().step==='view',null,{timeout});
   const route=await inspectMap(page,'route');
   assert.equal(route.routeMarkers,2,'Saved stops must remain on the same two map markers');
   assert.ok(route.savedMarkerIcons.every(x=>x==='./icons/04_star_saved.svg'),'route saved star not V3 source');
   assert.equal(await page.locator('#pins .fp-route-stop-order').count(),2,'numbered stops not attached to stars');
   const image=await page.locator('#pins .fp-route-saved-pin img').first().evaluate(e=>({loaded:e.complete,width:e.naturalWidth}));
   assert.ok(image.loaded&&image.width>0,'route star image broken');
   const initialRect=await page.locator('#atlasMap').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
   const initialCamera=await page.evaluate(()=>window.FootprintRouteV5Real.map.getCenter().toArray());
   await page.locator('#pins [data-pin="'+a+'"]').dispatchEvent('click');
   await page.waitForFunction(id=>document.getElementById('v12-place-bubble')?.dataset.placeId===id,a,{timeout:18000});
   await page.waitForTimeout(470);
   const finalCamera=await page.evaluate(()=>window.FootprintRouteV5Real.map.getCenter().toArray());
   const rect=await page.locator('#atlasMap').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
   assert.deepEqual(rect,initialRect,'route sheet/pin re-centered by resizing the entire map');
   assert.ok(Math.hypot(finalCamera[0]-initialCamera[0],finalCamera[1]-initialCamera[1])>.00003,'Selected route pin did not reframe visible map');
   const token=page.locator('#pins [data-pin="'+a+'"] .fp-route-poi-token');
   assert.ok((await token.getAttribute('style')||'').includes('transform'),'V3 POI pop motion not used');
   await page.locator('#v12-place-bubble').dispatchEvent('click');
   await page.waitForFunction(id=>document.querySelector('.v12-route-sections')?.dataset.placeId===id,a,{timeout:22000});
   assert.equal(await page.locator('.v12-route-sections .fp-block').count(),4);
   assert.equal(await page.locator('#v12-place-bubble').count(),1,'second bubble created');
   assert.equal(await page.locator('#atlasMap .maplibregl-canvas').count(),1,'map recreated on card open');
   fs.mkdirSync('v5-quality-webkit-evidence',{recursive:true});
   await page.screenshot({path:'v5-quality-webkit-evidence/'+width+'-route-stitched.png',fullPage:true});
   assert.deepEqual(errors.filter(x=>/SyntaxError|ReferenceError|TypeError/.test(x)),[], 'page JS error: '+errors.join(' | '));
   console.log('PASS WebKit '+width+'px: single dark first-painted map both pages; V3 POI/route star, selected focus and four real sections');
   await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
