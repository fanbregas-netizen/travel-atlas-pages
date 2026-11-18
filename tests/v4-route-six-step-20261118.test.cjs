'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const base='http://127.0.0.1:8765/v4-route-six-step-20261118/';
const kind=process.env.BROWSER||'chromium';
const width=Number(process.env.WIDTH)||390;
const idb='atlas-v4-review-20261116-private-travel-footprints-v1';
const places=[
 {id:'flow-p1',title:'沿海 A',lat:29.27,lng:121.408,starred:true,note:'原收藏 A Brief',photos:[]},
 {id:'flow-p2',title:'沿海 B',lat:29.76,lng:121.583,starred:true,note:'原收藏 B Brief',photos:[]},
 {id:'flow-p3',title:'沿海 C',lat:28.856,lng:121.119,starred:true,note:'原收藏 C Brief',photos:[]},
 {id:'flow-p4',title:'沿海 D',lat:28.37,lng:121.061,starred:true,note:'原收藏 D Brief',photos:[]}
];
(async()=>{
 const browser=await ({chromium,webkit})[kind].launch({headless:true,...(kind==='chromium'?{args:['--no-sandbox']}:{})});
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(16000);
 fs.mkdirSync('route-six-step-evidence',{recursive:true});
 const snap=async name=>page.screenshot({path:'route-six-step-evidence/'+kind+'-'+width+'-'+name+'.png'});
 const state=()=>page.evaluate(()=>window.__fpSixStepRoute?.state);
 const click=async name=>page.locator('#fpRouteFlowSheet [data-action="'+name+'"]').click();
 try{
  await page.goto(base+'icon.svg',{waitUntil:'domcontentloaded'});
  await page.evaluate(async({idb,places})=>{
   await new Promise((resolve,reject)=>{
    const r=indexedDB.open(idb,1);
    r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('places'))db.createObjectStore('places',{keyPath:'id'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'})};
    r.onerror=()=>reject(r.error);
    r.onsuccess=()=>{const db=r.result,t=db.transaction('places','readwrite');for(const p of places)t.objectStore('places').put(p);t.oncomplete=()=>{db.close();resolve()};t.onerror=()=>reject(t.error)}
   })
  },{idb,places});
  console.log('QA opening real homepage / route Dock');
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('#dockRoute').click();
  await page.waitForURL(/\/journey\.html$/,{timeout:20000});
  await page.waitForFunction(()=>Boolean(window.__fpSixStepRoute?.state&&document.getElementById('fpRouteFlowSheet')),{timeout:26000});
  let v=await state();assert.equal(v.step,'entry');
  const sheet=page.locator('#fpRouteFlowSheet');
  assert.equal(await sheet.count(),1);
  assert.equal(await page.locator('#atlasMap').count(),1);
  const colors=await page.evaluate(()=>{
    const cs=getComputedStyle(document.body);
    return [cs.getPropertyValue('--rs-paper').trim(),cs.getPropertyValue('--rs-sage').trim(),cs.getPropertyValue('--rs-green').trim(),cs.getPropertyValue('--rs-gold').trim()];
  });assert.deepEqual(colors,['#fffefa','#edf1e9','#304b3b','#b59a62']);
  await snap('01-entry');
  await click('start');v=await state();assert.equal(v.step,'pick');await snap('02-pick');
  await page.locator('#fpRoutePlaceSearch').fill('沿海 B');
  assert.equal(await page.locator('#fpRoutePlaceRows .fp-route-place-row').count(),1);
  await page.locator('#fpRoutePlaceSearch').fill('');
  for(const id of ['flow-p1','flow-p3','flow-p2','flow-p4'])
    await page.locator('[data-action="toggle"][data-id="'+id+'"]').click();
  v=await state();assert.equal(v.order.length,4);
  assert.equal(await page.locator('#fpRouteSheetFoot [data-action="undo"]').count(),1);
  await click('nextpick');v=await state();assert.equal(v.step,'order');await snap('03-order');
  await page.locator('[data-action="day"][data-id="flow-p3"]').click();
  assert.equal((await state()).days['flow-p3'],2);
  await click('undo');assert.equal((await state()).days['flow-p3'],1);
  await click('nextorder');assert.equal((await state()).step,'settings');await snap('04-settings');
  await page.locator('#fpRouteSheetContent [data-action="mode"][data-mode="bike"]').click();
  assert.equal((await state()).mode,'bike');
  await click('nextsettings');
  assert.equal((await state()).step,'recommend');await snap('05-recommend');
  await page.locator('#fpRouteSheetContent [data-action="adopt"]').click();
  assert.ok((await state()).order.length===4);
  await click('save');
  await page.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='done'&&Boolean(window.__fpSixStepRoute?.state?.savedId),null,{timeout:22000});
  const done=await state();assert.equal(done.mode,'bike');await snap('06-done');
  const record=await page.evaluate(async()=>{
   const id=window.__fpSixStepRoute.state.savedId;
   return (await FootprintMediaCore.createRepository(indexedDB).listRoutes()).find(x=>x.id===id);
  });
  assert.ok(record&&record.id);
  assert.equal(record.stops.length,4);
  assert.equal(record.transportMode,'bike');
  // MediaCore intentionally normalizes route records to stops and drops the input-only placeIds.
  assert.deepEqual(record.stops.map(x=>x.placeId),done.order);
  const note=await page.evaluate(async(name)=>new Promise((resolve,reject)=>{
   const r=indexedDB.open(name,1);r.onerror=()=>reject(r.error);
   r.onsuccess=()=>{const db=r.result,t=db.transaction('places','readonly'),q=t.objectStore('places').get('flow-p1');
    q.onsuccess=()=>{resolve(q.result.note);db.close()};q.onerror=()=>reject(q.error)}
  }),idb);
  assert.equal(note,'原收藏 A Brief');
  await page.goto(base+'journey.html?saved='+encodeURIComponent(record.id),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__fpSixStepRoute?.state?.step==='done',{timeout:25000});
  const reopened=await state();assert.deepEqual(reopened.order,done.order);
  assert.equal(reopened.mode,'bike');
  assert.ok(!errors.some(x=>/ReferenceError|TypeError|SyntaxError/.test(x)),errors.join('\\n'));
  console.log('PASS',kind,width,'six stages, original V4 colors, 4 favorites, undo, dates, transport, save, reopen, Brief unchanged');
 }catch(e){
  await snap('failure').catch(()=>{});
  console.error('Browser JS:',errors.join('\\n'));throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
