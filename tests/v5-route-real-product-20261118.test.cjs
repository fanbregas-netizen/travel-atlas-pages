'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const browserName=process.env.BROWSER||'chromium',width=Number(process.env.WIDTH)||390;
const root='http://127.0.0.1:8765/v5-route-real-product-20261118/';
const places=[
 {id:'v5-accept-shanghai',title:'上海大学',name:'上海大学',lat:31.3218,lng:121.395,starred:true,note:'验收用的实际存储地点'},
 {id:'v5-accept-park',title:'中山公园',name:'中山公园',lat:31.2236,lng:121.4188,starred:true,note:'第二个地点'},
 {id:'v5-accept-temple',title:'静安寺',name:'静安寺',lat:31.223,lng:121.4452,starred:true,note:'第三个地点'}
];
async function run(){
 const browser=await ({chromium,webkit})[browserName].launch({headless:true,...(browserName==='chromium'?{args:['--no-sandbox']}:{})});
 const ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(24000);
 const screenshot=async label=>{fs.mkdirSync('v5-route-real-product-evidence',{recursive:true});await page.screenshot({path:'v5-route-real-product-evidence/'+browserName+'-'+width+'-'+label+'.png'})};
 const state=()=>page.evaluate(()=>window.__footprintV5Demo?.state());
 const press=(action)=>page.locator('#sheet [data-action="'+action+'"]').first().click();
 try{
  await page.goto(root+'journey-v5.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__footprintV5ProductReady===true,{timeout:35000});
  await page.evaluate(async data=>{
   await new Promise((resolve,reject)=>{
    const r=indexedDB.open('private-travel-footprints-v1',1);
    r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('places'))d.createObjectStore('places',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'})};
    r.onerror=()=>reject(r.error);
    r.onsuccess=()=>{const db=r.result,tx=db.transaction('places','readwrite');for(const p of data)tx.objectStore('places').put(p);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};
   });
  },places);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__footprintV5ProductReady===true,{timeout:35000});
  assert.equal((await state()).step,'pick');
  assert.equal((await state()).order.length,0,'prototype sample route leaked into real product');
  assert.equal(await page.locator('#place-list .place-row').count(),3,'real favorites are not loaded');
  await screenshot('01-pick');
  await press('pickmode'); // list mode is initially active; subsequent toggle to map explicitly
  await page.locator('[data-action="pickmode"][data-mode="map"]').click();
  assert.equal((await state()).pickMode,'map');
  await screenshot('02-map-picker');
  const mapOK=await page.evaluate(()=>!!window.FootprintRouteV5Real?.map);
  assert.equal(mapOK,true,'real MapLibre map was not mounted');
  await page.locator('[data-action="pickmode"][data-mode="list"]').click();
  for(const p of places.slice(0,3))await page.locator('[data-action="toggle"][data-id="'+p.id+'"]').click();
  assert.deepEqual((await state()).order,places.map(x=>x.id));
  await press('next-pick');
  assert.equal((await state()).step,'settings');
  await page.locator('#trip-name').fill('三站真实路线验收');
  await page.locator('#trip-name').blur();
  await page.locator('[data-action="date"][data-field="start"]').click();
  await page.locator('#modal.open .calendar-grid .day:not([disabled])').first().click();
  assert.equal(await page.locator('#modal.open').count(),0);
  await page.locator('[data-action="endpoint"][data-kind="dest"]').click();
  await page.locator('[data-modal-action="endpoint-opt"][data-val="loop"]').click();
  assert.equal((await state()).dest.type,'loop');
  await screenshot('03-settings');
  await press('next-settings');
  assert.equal((await state()).step,'order');
  assert.equal(await page.locator('#order-list .order-row').count(),3);
  await page.locator('[data-action="day"][data-id="v5-accept-park"]').click();
  await screenshot('04-order');
  await press('save');
  await page.locator('[data-modal-action="confirm-save"]').click();
  await page.waitForFunction(()=>window.__footprintV5Demo?.state().saved===true,{timeout:17000});
  assert.equal((await state()).step,'view');
  const id=await page.evaluate(()=>new URL(location.href).searchParams.get('saved'));
  assert.ok(id&&id.length>12);
  const saved=await page.evaluate(async routeId=>{
    const rows=await window.FootprintMediaCore.createRepository(indexedDB).listRoutes();
    return rows.find(x=>x.id===routeId);
  },id);
  assert.equal(saved.title,'三站真实路线验收');
  assert.equal(saved.placeIds.length,3);
  assert.equal(saved.routeTo,'loop');
  await screenshot('05-saved');
  const external=await page.evaluate(()=>window.FootprintRouteV5Real.navigation('apple',{order:['v5-accept-shanghai','v5-accept-park'],places:[{id:'v5-accept-shanghai',lat:31.3218,lng:121.395},{id:'v5-accept-park',lat:31.2236,lng:121.4188}],travel:'car'}));
  assert.ok(external.startsWith('https://maps.apple.com/'));
  await page.goto(root+'route-view.html?saved='+encodeURIComponent(id),{waitUntil:'domcontentloaded'});
  await page.waitForURL(/journey-v5\.html\?saved=/,{timeout:12000});
  await page.waitForFunction(()=>window.__footprintV5ProductReady===true,{timeout:35000});
  assert.equal((await state()).step,'view');
  assert.deepEqual((await state()).order,places.map(p=>p.id));
  await screenshot('06-reopened');
  assert.deepEqual(errors.filter(e=>/SyntaxError|ReferenceError|TypeError/.test(e)),[],'runtime errors detected');
  console.log('PASS '+browserName+' '+width+' real V4 favorite→V5 three-step route→IndexedDB saved route→reopened viewer');
 }catch(e){await screenshot('error').catch(()=>{});console.error('BROWSER ERRORS',errors);throw e}
 finally{await browser.close()}
}
run().catch(e=>{console.error(e.stack||e);process.exit(1)});
