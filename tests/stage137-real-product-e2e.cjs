'use strict';
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const variant=process.env.BROWSER||'chromium';
const base='https://fanbregas-netizen.github.io/travel-atlas-pages/v4-stage137-approved-parity-20261113/';
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
 await page.waitForFunction(()=>window.__atlasPreviewNamespace==='fp-v4-stage137-approved-parity-20261113-',null,{timeout:18000});
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
 // The approved V4 date field is a readonly calendar trigger, not a
 // native editable input. Keep that UI unchanged. This regression seeds the
 // calendar's *confirmed form value* to validate storage and D-day reflow;
 // calendar touch/confirm/cancel is checked by its existing interaction suite.
 await page.evaluate(()=>{
  for(const [id,value] of [['routeSaveStart','2026-11-20'],['routeSaveEnd','2026-11-20']]){
   const el=document.getElementById(id);
   el.value=value;
   el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
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

 // Use the real approved C V5 planner; no synthetic V5 route controller.
 const savedId=new URLSearchParams(persisted.url.split('?')[1]).get('saved');
 assert.ok(savedId,'Expected a saved itinerary ID');
 await page.goto(base+'journey.html',{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(id=>{
  const select=document.getElementById('savedPlans');
  return select&&Array.from(select.options).some(o=>o.value===id);
 },savedId,{timeout:30000});
 await page.evaluate(id=>{
  const sel=document.getElementById('savedPlans');
  sel.value=id;sel.dispatchEvent(new Event('change',{bubbles:true}));
 },savedId);
 await page.waitForFunction(()=>document.querySelectorAll('#chosen .choice[data-stop-id]').length===3,null,{timeout:15000});
 const planner=()=>page.evaluate(()=>({
  ids:Array.from(document.querySelectorAll('#chosen .choice[data-stop-id]')).map(x=>x.dataset.stopId),
  days:Array.from(document.querySelectorAll('#chosen .choice[data-stop-id]')).map(x=>Number(x.querySelector('select.day-picker').value)),
  ns:window.__atlasPreviewNamespace
 }));
 const initialPlanner=await planner();
 assert.deepEqual(initialPlanner.ids,['p3','p1','p2']);
 assert.equal(initialPlanner.ns,init.ns);
 // Real C V5 calendar: cancel leaves saved dates and D labels untouched.
 await page.evaluate(()=>document.getElementById('endDate').click());
 await page.waitForFunction(()=>document.getElementById('atlasJourneyDateDialog')?.open,null,{timeout:10000});
 await page.locator('#atlasDateDraftEnd').fill('2026-11-21');
 await page.locator('#atlasDateCancel').click();
 assert.equal(await page.locator('#endDate').inputValue(),'2026-11-20');
 // Only explicit 完成 applies a two-day trip.
 await page.evaluate(()=>document.getElementById('endDate').click());
 await page.waitForFunction(()=>document.getElementById('atlasJourneyDateDialog')?.open,null,{timeout:10000});
 await page.locator('#atlasDateDraftEnd').fill('2026-11-21');
 await page.locator('#atlasDateApply').click();
 await page.waitForFunction(()=>document.getElementById('endDate').value==='2026-11-21',null,{timeout:10000});
 // Choose D2 on p3 without moving it; manual day assignment is a separate action.
 await page.evaluate(()=>{
  const sel=document.querySelector('#chosen .choice[data-stop-id="p3"] select.day-picker');
  sel.value='2';sel.dispatchEvent(new Event('change',{bubbles:true}));
 });
 assert.deepEqual((await planner()).ids,['p3','p1','p2'],'Changing day silently reordered itinerary');
 // Approved C V5 keyboard equivalent of dragging first stop down one row.
 await page.evaluate(()=>{
  const grip=document.querySelector('#chosen .choice[data-stop-id="p3"] .choice-drag');
  grip.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
 });
 const movedPlanner=await planner();
 assert.deepEqual(movedPlanner.ids,['p1','p3','p2'],'Reordering stop lost its new position');
 assert.deepEqual(movedPlanner.days,[1,2,1],'Reordering stop replaced the D assignment');
 await page.evaluate(()=>document.getElementById('savePlan').click());
 await page.waitForFunction(async id=>{
  const r=window.FootprintMediaCore.createRepository(indexedDB);
  const routes=await r.listRoutes(),route=routes.find(x=>x.id===id);
  return route?.stops?.map(x=>x.placeId).join(',')==='p1,p3,p2'
    &&route?.stops?.map(x=>x.day).join(',')==='1,2,1';
 },savedId,{timeout:25000});
 await page.reload({waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(id=>{
  const sel=document.getElementById('savedPlans');
  return sel&&Array.from(sel.options).some(o=>o.value===id);
 },savedId,{timeout:30000});
 await page.evaluate(id=>{
  const s=document.getElementById('savedPlans');
  s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}));
 },savedId);
 const reloadedPlanner=await planner();
 assert.deepEqual(reloadedPlanner.ids,['p1','p3','p2']);
 assert.deepEqual(reloadedPlanner.days,[1,2,1]);
 await page.goto(base+'route-view.html?saved='+encodeURIComponent(savedId),{waitUntil:'domcontentloaded',timeout:70000});
 await page.waitForFunction(()=>window.__atlasRV?.places?.length===3,null,{timeout:30000});
 const returnedMap=await page.evaluate(()=>({
  ids:window.__atlasRV.places.map(x=>String(x.id)),
  days:window.__atlasRV.stopDays.slice(),
  ns:window.__atlasPreviewNamespace
 }));
 assert.deepEqual(returnedMap.ids,['p1','p3','p2']);
 assert.deepEqual(returnedMap.days,[1,2,1]);
 assert.equal(returnedMap.ns,init.ns);
 console.log('STAGE137_REAL_ROUTE '+variant+' '+JSON.stringify({loaded,reordered,persisted,reopened,initialPlanner,movedPlanner,reloadedPlanner,returnedMap,errors:errors.slice(0,5)}));
 await browser.close();
})().catch(err=>{console.error('STAGE137_FAIL '+variant+' '+err.stack);process.exit(1)});
