'use strict';
const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const origin='http://127.0.0.1:8765';
async function check(label,engine){
 const browser=await engine.launch({headless:true,args:label==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();const localErrors=[];
 page.on('response',response=>{if(response.url().startsWith(origin)&&response.status()===404)localErrors.push(response.url())});
 try{
  const root=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(root.status(),200);assert.equal(await page.title(),'Footprint Map');
  await page.waitForFunction(()=>!!window.FootprintMediaCore?.DB_NAME,null,{timeout:25000});
  assert.equal(await page.evaluate(()=>window.FootprintMediaCore.DB_NAME),'private-travel-footprints-v1');
  await page.evaluate(()=>{localStorage.setItem('fp-branded-path-test','same-origin');});
  const branded=await page.goto(origin+'/footprint-map/',{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(branded.status(),200);
  assert.equal(await page.title(),'Footprint Map');
  assert.equal(new URL(page.url()).pathname,'/footprint-map/');
  assert.equal(await page.locator('#appDock').count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('fp-branded-path-test')),'same-origin');
  await page.waitForFunction(()=>!!window.FootprintMediaCore?.DB_NAME,null,{timeout:25000});
  assert.equal(await page.evaluate(()=>window.FootprintMediaCore.DB_NAME),'private-travel-footprints-v1');
  await page.evaluate(()=>localStorage.removeItem('fp-branded-path-test'));
  const links=['/footprint-map/manifest.webmanifest','/footprint-map/sw.js','/footprint-map/src/media/media-core.js','/footprint-map/src/route/route-single-map-v1.js','/footprint-map/icons/03_star.svg'];
  for(const path of links){const response=await page.request.get(origin+path);assert.equal(response.status(),200,path)}
  assert.match(await (await page.request.get(origin+'/footprint-map/sw.js')).text(),/footprint-map-branded-/);
  assert.doesNotMatch(await (await page.request.get(origin+'/sw.js')).text(),/footprint-map-branded-/);
  // Both route shells redirect in their first <head>; inspecting the served
  // HTML avoids racing Playwright's navigation context in iOS/WebKit.
  const routes=await page.request.get(origin+'/footprint-map/journey.html');
  assert.equal(routes.status(),200);
  const journeyHtml=await routes.text();
  assert.match(journeyHtml,/<title>Footprint Map · 路线<\/title>/);
  assert.match(journeyHtml,/new URL\('\.\/index\.html',location\.href\)/);
  // route-view.html intentionally calls location.replace('./index.html');
  // inspect its real served HTML: WebKit Playwright may interrupt page.goto
  // when the route shell redirects in its initial <head>.
  const routeDetail=await page.request.get(origin+'/footprint-map/route-view.html');
  assert.equal(routeDetail.status(),200);
  const routeHtml=await routeDetail.text();
  assert.match(routeHtml,/<title>Footprint Map · 查看路线<\/title>/);
  assert.match(routeHtml,/new URL\('\.\/index\.html',location\.href\)/);
  assert.deepEqual(localErrors,[]);
  console.log(JSON.stringify({browser:label,result:'PASS',brandedUrl:'/footprint-map/',oldUrlRetained:true,oldUserStorageSameOrigin:true,productionDbUnchanged:true,allAppAssetsPresent:true,routePages:true,isolatedCache:true}));
 }finally{await context.close();await browser.close()}
}
(async()=>{await check('chromium',chromium);await check('webkit',webkit)})()
 .catch(e=>{console.error(e.stack||e);process.exitCode=1});
