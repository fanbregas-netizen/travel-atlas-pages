'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const browserName=process.env.BROWSER||'chromium',width=Number(process.env.WIDTH)||390;
const base='http://127.0.0.1:8765/v4-route-live-five-step-20261118/';
const fixture=[
{id:'real-a',title:'东钱湖',lat:29.77,lng:121.58,starred:true,note:'保留原有收藏 Brief'},
{id:'real-b',title:'象山石浦',lat:29.20,lng:121.94,starred:true,note:'路线参考 B'},
{id:'real-c',title:'温岭石塘',lat:28.27,lng:121.63,starred:true,note:'路线参考 C'},
{id:'real-d',title:'温州洞头',lat:27.84,lng:121.16,starred:true,note:'路线参考 D'}
];
(async()=>{
 const browser=await ({chromium,webkit})[browserName].launch({headless:true,...(browserName==='chromium'?{args:['--no-sandbox']}:{})});
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(22000);
 fs.mkdirSync('route-live-five-step-evidence',{recursive:true});
 const screenshot=tag=>page.screenshot({path:'route-live-five-step-evidence/'+browserName+'-'+width+'-'+tag+'.png'});
 const state=()=>page.evaluate(()=>window.__fpSixStepRoute?.state);
 const act=name=>page.locator('#fpRouteFlowSheet [data-action="'+name+'"]').click();
 try{
  await page.goto(base+'icon.svg');
  await page.evaluate(async places=>{
   await new Promise((resolve,reject)=>{
    const r=indexedDB.open('atlas-v4-review-20261116-private-travel-footprints-v1',1);
    r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('places'))db.createObjectStore('places',{keyPath:'id'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'})};
    r.onerror=()=>reject(r.error);r.onsuccess=()=>{
     const db=r.result,tx=db.transaction('places','readwrite'),store=tx.objectStore('places');
     for(const p of places)store.put(p);
     tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error);
    };
   });
  },fixture);
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded'});
  await page.locator('#dockRoute').click();
  await page.waitForURL(/journey\.html/);
  await page.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='pick');
  assert.equal(await page.locator('#fpRouteFlowSheet').count(),1);
  assert.equal(await page.locator('.fp-route-pick-modes button').count(),2);
  await screenshot('01-pick-list');
  await page.locator('[data-action="pickmode"][data-mode="map"]').click();
  await screenshot('02-pick-map');
  await page.locator('[data-action="pickmode"][data-mode="list"]').click();
  for(const id of ['real-a','real-b','real-c','real-d'])await page.locator('[data-action="toggle"][data-id="'+id+'"]').click();
  assert.equal((await state()).order.length,4);
  await act('nextpick');
  assert.equal((await state()).step,'settings');
  await page.locator('#fpRouteTripName').fill('东海沿线行程');
  await page.locator('#fpRouteTripName').press('Tab');
  await page.locator('[data-action="mode"][data-mode="bike"]').click();
  await screenshot('03-settings');
  await act('nextsettings');
  assert.equal((await state()).step,'order');
  const row=page.locator('[data-action="leg"][data-index="0"]');
  await row.click();
  assert.equal(await page.locator('[data-action="legmode"]').count(),4);
  await page.locator('[data-action="legmode"][data-mode="transit"]').click();
  assert.equal(await page.locator('a[href^="https://uri.amap.com/navigation"]').count(),1);
  assert.equal(await page.locator('a[href^="https://www.google.com/maps/dir/"]').count(),1);
  await act('closeleg');
  await page.locator('[data-action="day"][data-id="real-c"]').click();
  assert.equal((await state()).days['real-c'],2);
  await act('undo');
  assert.equal((await state()).days['real-c'],1);
  await screenshot('04-order-and-legs');
  await act('nextorder');
  assert.equal((await state()).step,'recommend');
  await screenshot('05-recommend');
  const adopt=page.locator('[data-action="adopt"]');
  if(await adopt.count())await adopt.click();
  await act('save');
  await page.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='done'&&window.__fpSixStepRoute?.state?.savedId);
  const saved=await state();
  assert.equal(saved.title,'东海沿线行程');
  await screenshot('06-saved');
  await act('view');
  assert.equal((await state()).step,'preview');
  await page.locator('[data-action="dayview"][data-day="2"]').click();
  assert.equal(await page.locator('body.fp-day-filter').count(),1);
  await screenshot('07-view-day-2');
  const record=await page.evaluate(async()=>{const id=window.__fpSixStepRoute.state.savedId;return (await FootprintMediaCore.createRepository(indexedDB).listRoutes()).find(r=>r.id===id)});
  assert.equal(record.stops.length,4);
  assert.equal(record.title,'东海沿线行程');
  assert.equal(record.transportMode,'bike');
  assert.equal(record.legModes['real-a'],'transit');
  const url=base+'route-view.html?saved='+encodeURIComponent(record.id);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForURL(/journey\.html\?saved=.*view=1/);
  await page.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='preview');
  assert.equal((await state()).order.length,4);
  assert.deepEqual(errors.filter(e=>/SyntaxError|ReferenceError|TypeError/.test(e)),[]);
  console.log('PASS '+browserName+' '+width+' five-stage real routes, IndexedDB, external transit, undo, fixed map browsing');
 }catch(e){await screenshot('failure').catch(()=>{});console.log('PAGE ERRORS',errors);throw e}
 finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
