'use strict';
/* Actual V5 homepage; original single MapLibre canvas, no route-specific Map().
 * AMap is contract-tested using an explicit test stub, NOT called "live".
 */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {webkit}=require('playwright');
const root='http://127.0.0.1:8765/v5-single-map-full-product-20261119/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await webkit.launch({headless:true});
 try{
 for(const width of [375,390]){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(root+'index.html',{waitUntil:'domcontentloaded',timeout:65000});
  await page.waitForFunction(()=>window.__atlasMapHealth?.().ready===true && window.FootprintUnifiedRoute && window.FootprintMediaCore && window.__atlasPlaceStore && window.__fpSingleRouteNavigation,null,{timeout:65000});
  const before=await page.evaluate(()=>{
   const m=window.__atlasPOIBridge.vector();
   return {canvas:document.querySelectorAll('.maplibregl-canvas').length,map:m,theme:document.documentElement.dataset.fpMapTheme};
  });
  assert.equal(before.canvas,1);
  assert.equal(before.theme,'bluegray-v18');
  const ids={a:'single-unified-a-'+width,b:'single-unified-b-'+width,saved:'single-unified-saved-'+width};
  await page.evaluate(async({a,b,saved})=>{
    await window.__atlasPlaceStore.save({id:a,title:'长寿路',lat:31.241,lng:121.456,starred:true,stage:'plan',photos:[],note:'保留图1卡片资料'});
    await window.__atlasPlaceStore.save({id:b,title:'北岸路',lat:31.248,lng:121.464,starred:true,stage:'plan',photos:[],note:'第二站'});
    const repo=window.FootprintMediaCore.createRepository(indexedDB);
    await repo.saveRoute({id:saved,title:'统一地图已保存路线',startDate:'2026-11-20',endDate:'2026-11-21',
       stops:[{placeId:a,day:1},{placeId:b,day:1}],placeIds:[a,b]});
  },ids);
  // Clicking the real V5 Dock MUST stay on index.html and reuse this MapLibre map.
  await page.locator('#dockRoute').click();
  await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state.open===true,null,{timeout:18000});
  const one=await page.evaluate(()=>({
   mapSame:window.FootprintUnifiedRoute.map===window.__atlasPOIBridge.vector(),
   canvas:document.querySelectorAll('.maplibregl-canvas').length,
   mode:window.FootprintUnifiedRoute.state.step,
   path:location.pathname,routeLayer:!!window.__atlasPOIBridge.vector().getSource('fp-single-route'),
   b:document.body.classList.contains('fp-unified-route'),
   legacyMap:!!document.querySelector('#atlasMap .maplibregl-canvas'),
   approvedSheet:!!document.getElementById('fpUnifiedRoute').querySelector('.fp-route-grip')
  }));
  assert.ok(one.mapSame,'Route created a second map');
  assert.equal(one.canvas,1,'MapLibre canvas duplicated');
  assert.equal(one.mode,'pick');assert.ok(one.path.endsWith('/index.html'));
  assert.equal(one.legacyMap,false);assert.equal(one.b,true);assert.equal(one.approvedSheet,true);
  await page.locator('#fpUnifiedRoute [data-command="toggle"][data-id="'+ids.a+'"]').click();
  await page.locator('#fpUnifiedRoute [data-command="toggle"][data-id="'+ids.b+'"]').click();
  assert.deepEqual((await page.evaluate(()=>window.FootprintUnifiedRoute.state.order)),[ids.a,ids.b]);
  const line=await page.evaluate(()=>window.__atlasPOIBridge.vector().getSource('fp-single-route')?true:false);
  assert.ok(line,'route did not create an in-place GeoJSON source');
  await page.locator('#fpUnifiedRoute [data-command="settings"]').click();
  assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.step),'settings');
  await page.locator('#fpUnifiedTitle').fill('新版单地图路线');
  await page.locator('#fpUnifiedRoute [data-command="travel"][data-value="walk"]').click();
  await page.locator('#fpUnifiedRoute [data-command="order"]').click();
  assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.step),'order');
  await page.locator('#fpUnifiedRoute [data-command="down"][data-id="'+ids.a+'"]').click();
  assert.deepEqual(await page.evaluate(()=>window.FootprintUnifiedRoute.state.order),[ids.b,ids.a]);
  await page.locator('#fpUnifiedRoute [data-command="save"]').click();
  await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state.step==='view',null,{timeout:18000});
  const saved=await page.evaluate(async()=>{
    const r=window.FootprintMediaCore.createRepository(indexedDB);
    const entries=await r.listRoutes(),m=window.__atlasPOIBridge.vector();
    const opacity=(m.getStyle().layers||[]).filter(x=>x.type==='symbol').map(l=>m.getPaintProperty(l.id,'text-opacity'));
    return {mapSame:window.FootprintUnifiedRoute.map===m,
      canvas:document.querySelectorAll('.maplibregl-canvas').length,
      mode:window.FootprintUnifiedRoute.state.step,
      route:entries.find(x=>x.title==='新版单地图路线'),
      muted:opacity.some(v=>v===.45),
      routeLayer:!!m.getLayer('fp-single-road'),
      count:document.querySelectorAll('#atlasBookmarkOverlay .fp-route-stop-order').length}
  });
  assert.ok(saved.route,'did not save to original IndexedDB route repo');
  assert.deepEqual(saved.route.stops.map(s=>s.placeId),[ids.b,ids.a]);
  assert.equal(saved.mapSame,true);assert.equal(saved.canvas,1);
  assert.equal(saved.muted,true,'route preview did not lower native map distraction');
  assert.ok(saved.routeLayer,'route geometry is not rendered on original map');
  await page.locator('#fpUnifiedRoute [data-command="saved"]').click();
  await page.waitForFunction(()=>window.FootprintUnifiedRoute.state.step==='saved',null,{timeout:15000});
  await page.locator('#fpUnifiedRoute [data-command="open-saved"][data-id="'+ids.saved+'"]').click();
  assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.state.step),'view');
  assert.equal(await page.evaluate(()=>window.FootprintUnifiedRoute.map===window.__atlasPOIBridge.vector()),true);
  fs.mkdirSync('v5-single-map-webkit-evidence',{recursive:true});
  await page.screenshot({path:'v5-single-map-webkit-evidence/'+width+'-same-map-route.png',fullPage:true});
  await page.locator('#fpUnifiedRoute [data-command="exit"]').click();
  await page.waitForFunction(()=>!window.FootprintUnifiedRoute.state.open,null,{timeout:15000});
  assert.equal(await page.locator('.maplibregl-canvas').count(),1,'map recreated on exit');
  assert.equal(await page.locator('#fp-single-route').count(),0);
  assert.equal(await page.evaluate(()=>window.__atlasPOIBridge.vector().getSource('fp-single-route')===undefined),true,'old route source remained after exit');
  await page.evaluate(()=>window.__atlasOpenNavigation({title:'长寿路',lat:31.241,lng:121.456}));
  assert.equal(await page.locator('#navigationChooser .nav-target').textContent(),'前往 长寿路');
  await page.locator('#closeNavigationChooser').click();
  assert.deepEqual(errors.filter(s=>/SyntaxError|ReferenceError|TypeError/.test(s)),[],'JS error: '+errors.join('|'));
  console.log('PASS SINGLE MAP WebKit '+width+'px, no second canvas, 3-step save/reorder/reopen, map-muted preview, navigation and original V5 data');
  await context.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
