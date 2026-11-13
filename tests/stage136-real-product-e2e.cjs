'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const variant=process.env.BROWSER||'chromium';
const base='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-stage136-approved-real-20261113/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const browser=await ({chromium,webkit})[variant].launch({headless:true,...(variant==='chromium'?{args:['--no-sandbox']}:{})});
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1'
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.message)));
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(()=>window.__atlasPreviewNamespace==='fp-v4-stage136-approved-real-20261113-',null,{timeout:18000});
 await page.waitForSelector('#appDock',{timeout:25000});
 const init=await page.evaluate(async()=>{
  const records=[
   {id:'p1',title:'平江路',lat:31.327,lng:120.629,starred:true,note:'经过平江路'},
   {id:'p2',title:'金鸡湖',lat:31.309,lng:120.699,starred:true,note:'临湖散步'},
   {id:'p3',title:'苏州博物馆',lat:31.325,lng:120.634,starred:true,note:'建筑与园林'}
  ];
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('private-travel-footprints-v1',1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('places'))req.result.createObjectStore('places',{keyPath:'id'});if(!req.result.objectStoreNames.contains('meta'))req.result.createObjectStore('meta',{keyPath:'key'})};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)
  });
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('places','readwrite'),store=tx.objectStore('places');
   for(const p of records)store.put(p);
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)
  }); db.close();
  const handoff={
   schema:'footprint-to-travel-atlas-selection-v1',version:3,
   createdAt:Date.now(),placeIds:records.map(x=>x.id),
   startDate:'2026-11-20',endDate:'2026-11-21',origin:'上海',destination:'苏州',mode:'view'
  };
  sessionStorage.setItem(handoff.schema,JSON.stringify(handoff));
  return {ns:window.__atlasPreviewNamespace,count:records.length};
 });
 await page.goto(base+'route-view.html?from=footprint',{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(()=>window.__atlasRV?.places?.length===3,null,{timeout:30000});
 const loaded=await page.evaluate(()=>({
  ns:window.__atlasPreviewNamespace,
  ids:window.__atlasRV.places.map(p=>String(p.id)),
  days:window.__atlasRV.stopDays.slice()
 }));
 assert.equal(loaded.ns,init.ns,'Route page opened another storage namespace');
 assert.deepEqual(loaded.ids,['p1','p2','p3'],'Real selected collection was not transferred to route');
 await page.evaluate(()=>{
  // Exercise the production route drag-order controller with a valid crossing-day
  // result: V5 intentionally keeps each saved stop's D assignment.
  const days=window.__atlasRV.stopDays;days.splice(0,days.length,1,2,2);
  window.__atlasRV.applyOrder(['p3','p1','p2']);
 });
 const reordered=await page.evaluate(()=>({
  ids:window.__atlasRV.places.map(p=>String(p.id)),
  days:window.__atlasRV.stopDays.slice()
 }));
 assert.deepEqual(reordered.ids,['p3','p1','p2']);
 assert.deepEqual(reordered.days,[2,1,2]);
 await page.evaluate(()=>document.getElementById('saveRoute').click());
 await page.waitForFunction(()=>document.getElementById('saveRouteDialog').open,null,{timeout:12000});
 await page.locator('#routeSaveName').fill('Stage 1.36 验收测试');
 await page.locator('#routeSaveStart').fill('2026-11-20');
 await page.locator('#routeSaveEnd').fill('2026-11-20');
 await page.locator('#routeSaveOrigin').fill('上海');
 await page.locator('#routeSaveDest').fill('苏州');
 await page.locator('#routeSaveConfirm').click();
 await page.waitForFunction(()=>new URL(location.href).searchParams.has('saved'),null,{timeout:20000});
 const persisted=await page.evaluate(()=>({
  ids:window.__atlasRV.places.map(p=>String(p.id)),
  days:window.__atlasRV.stopDays.slice(),
  url:location.pathname+location.search
 }));
 assert.deepEqual(persisted.ids,['p3','p1','p2']);
 assert.deepEqual(persisted.days,[1,1,1],'Date shrink failed to update live D labels');
 await page.reload({waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(()=>window.__atlasRV?.places?.length===3,null,{timeout:30000});
 const reopened=await page.evaluate(()=>({
  ns:window.__atlasPreviewNamespace,
  ids:window.__atlasRV.places.map(p=>String(p.id)),
  days:window.__atlasRV.stopDays.slice()
 }));
 assert.deepEqual(reopened.ids,['p3','p1','p2'],'Saved route unexpectedly resorted by D label on reload');
 assert.deepEqual(reopened.days,[1,1,1],'Saved route D labels no longer match display');
 assert.equal(reopened.ns,init.ns);
 console.log('STAGE136_REAL_ROUTE '+variant+' '+JSON.stringify({loaded,reordered,persisted,reopened,errors:errors.slice(0,5)}));
 await browser.close();
})().catch(err=>{console.error('STAGE136_FAIL '+variant+' '+err.stack);process.exit(1)});
