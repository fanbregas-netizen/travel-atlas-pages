'use strict';
/* Isolated production-shaped V5 candidate; read-only smoke, no user records. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),cp=require('node:child_process');
const {chromium}=require('playwright-core');
const chrome=['google-chrome','google-chrome-stable','chromium'].map(n=>{
 try{return cp.execFileSync('which',[n],{encoding:'utf8'}).trim()}catch{return null}
}).find(Boolean);
if(!chrome)throw Error('Chromium not installed');
const root='https://fanbregas-netizen.github.io/travel-atlas-pages/v5-pr53-one-map-20261119/';
(async()=>{
 const browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 fs.mkdirSync('v5-pr53-browser-evidence',{recursive:true});
 const report=[];
 try{
  for(const width of [375,390]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true,serviceWorkers:'block'});
   const page=await context.newPage(),errors=[],localFailures=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.url().startsWith(root)&&r.status()>=400)localFailures.push({status:r.status(),url:r.url()})});
   page.setDefaultTimeout(16000);
   const response=await page.goto(root+'index.html?qa=pr53-'+width,{waitUntil:'domcontentloaded',timeout:60000});
   assert.equal(response?.status(),200,width+' homepage HTTP');
   await page.waitForFunction(()=>!!window.FootprintUnifiedRoute?.open&&!!window.__atlasCardDockMotion&&!!window.FootprintNavigationSheet,null,{timeout:27000});
   // Capture startup/fallback state before asserting the one-map contract.
   let before=await page.evaluate(()=>({
    mode:window.__atlasCameraQA?.()||null, vector:!!window.__atlasPOIBridge?.vector?.(),
    maplibre:!!window.maplibregl?.Map, loader:document.querySelector('#atlasMapLoader')?.textContent?.trim().slice(0,100),
    canvas:document.querySelectorAll('canvas.maplibregl-canvas').length,
    mapHidden:document.getElementById('atlasVectorMap')?.hidden,
    status:window.__atlasMapHealth?.()||null
   }));
   console.log('PREVIEW-MAP-DIAGNOSTICS',width,JSON.stringify(before));
   if(!before.vector){
    await page.evaluate(()=>window.__atlasDemo?.vector?.());
    await page.waitForFunction(()=>!!window.__atlasPOIBridge?.vector?.(),null,{timeout:23000}).catch(()=>{});
   }
   const initial=await page.evaluate(()=>({
    map:window.__atlasPOIBridge?.vector?.()||null,
    canvas:document.querySelectorAll('#atlasVectorMap canvas.maplibregl-canvas').length,
    dock:[...document.querySelectorAll('#appDock>button')].map(n=>n.id),
    isolation:window.FootprintMediaCore?.DB_NAME,
    mode:window.__atlasCameraQA?.()||null,
    maplibre:!!window.maplibregl?.Map,
    allCanvases:document.querySelectorAll('canvas.maplibregl-canvas').length
   }));
   await page.screenshot({path:'v5-pr53-browser-evidence/'+width+'-initial.png'});
   console.log('PREVIEW-MAP-AFTER-ACTIVATE',width,JSON.stringify({...initial,map:!!initial.map}));
   assert.deepEqual(initial.dock,['dockStars','dockMap','dockRoute']);
   assert.equal(initial.isolation,'private-travel-footprints-v5-pr53-review-20261119');
   assert.ok(initial.map,'original home vector map not available');
   assert.equal(initial.canvas,1,width+' requires exactly one MapLibre canvas');
   await page.evaluate(()=>{window.__v5QaMap=window.__atlasPOIBridge.vector()});
   await page.locator('#dockRoute').click({timeout:20000});
   await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state.open===true,null,{timeout:16000});
   let opening=await page.evaluate(()=>({
    route:window.FootprintUnifiedRoute.state,
    same:window.__v5QaMap===window.FootprintUnifiedRoute.map,
    canvas:document.querySelectorAll('#atlasVectorMap canvas.maplibregl-canvas').length,
    url:location.pathname,
    recent:document.querySelector('#fpUnifiedRoute .fp-route-body')?.textContent?.includes('最近路线')
   }));
   assert.ok(opening.same,'route allocated another map');
   assert.equal(opening.canvas,1);
   assert.ok(opening.url.endsWith('/index.html'),'route navigated away to separate HTML');
   assert.equal(opening.route.step,'saved');
   assert.ok(opening.recent,'saved routes landing missing');
   await page.screenshot({path:'v5-pr53-browser-evidence/'+width+'-route-home.png'});
   await page.locator('#fpUnifiedRoute [data-command="new"]').first().click();
   await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state.step==='pick');
   assert.ok(await page.evaluate(()=>window.__v5QaMap===window.FootprintUnifiedRoute.map));
   await page.locator('#fpUnifiedRoute [data-command="exit"]').first().click();
   await page.waitForFunction(()=>window.FootprintUnifiedRoute?.state.open===false);
   await page.waitForFunction(()=>window.__atlasCardDockMotion?.getState()?.bottom==='visible',null,{timeout:14000});
   // Navigation uses the existing shared B V3 motor. No route save is needed.
   await page.evaluate(()=>window.__atlasOpenNavigation({title:'导航验收地点',lat:31.240,lng:121.452}));
   await page.waitForFunction(()=>document.getElementById('navigationChooser')?.classList.contains('visible')&&window.FootprintNavigationSheet?.state.sheet!=='closed',null,{timeout:12000});
   assert.ok(await page.locator('#navigationChooser #navLinks a').count()>=2,'navigation choices missing');
   await page.locator('#closeNavigationChooser').click();
   await page.waitForFunction(()=>!document.getElementById('navigationChooser')?.classList.contains('visible'),null,{timeout:6000});
   await page.waitForFunction(()=>window.__atlasCardDockMotion?.getState()?.bottom==='visible',null,{timeout:14000});
   await page.screenshot({path:'v5-pr53-browser-evidence/'+width+'-restored.png'});
   assert.deepEqual(localFailures,[],width+' local asset failures');
   assert.deepEqual(errors,[],width+' uncaught JavaScript errors');
   report.push({width,initial:{canvas:initial.canvas,dock:initial.dock},opening,errors,localFailures});
   await context.close();
  }
  fs.writeFileSync('v5-pr53-browser-evidence/report.json',JSON.stringify(report,null,2));
  console.log('PASS V5 PR53 independent single-map route, Dock V2 restore, navigation V3',JSON.stringify(report.map(r=>r.width)));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
