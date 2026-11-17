'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),cp=require('node:child_process');
const {chromium}=require('playwright-core');
const browserPath=['google-chrome','google-chrome-stable','chromium'].map(s=>{try{return cp.execFileSync('which',[s],{encoding:'utf8'}).trim()}catch{return null}}).find(Boolean);
if(!browserPath)throw Error('Chromium not available on CI');
const base=process.env.ROUTE_REAL_BASE||'http://127.0.0.1:8765/v4-interaction-system-review-20261117/';
const fixture=[
 {id:'qa-r-a',title:'沿海 A',lat:30,lng:120,starred:true,note:'保留A的原始 Brief',photos:[]},
 {id:'qa-r-c',title:'沿海 C',lat:30,lng:121,starred:true,note:'保留C的原始 Brief',photos:[]},
 {id:'qa-r-b',title:'沿海 B',lat:30,lng:120.2,starred:true,note:'保留B的原始 Brief',photos:[]},
 {id:'qa-r-d',title:'沿海 D',lat:30,lng:121.2,starred:true,note:'保留D的原始 Brief',photos:[]}
];
const out='route-real-evidence';
fs.mkdirSync(out,{recursive:true});
async function seed(page){
 await page.goto(base+'icon.svg',{waitUntil:'domcontentloaded'});
 await page.evaluate(async data=>{
   await new Promise((resolve,reject)=>{
     const req=indexedDB.open('atlas-v4-interaction-20261117-private-travel-footprints-v1',1);
     req.onupgradeneeded=()=>{
       if(!req.result.objectStoreNames.contains('places'))req.result.createObjectStore('places',{keyPath:'id'});
       if(!req.result.objectStoreNames.contains('meta'))req.result.createObjectStore('meta',{keyPath:'key'});
     };
     req.onerror=()=>reject(req.error);
     req.onsuccess=()=>{
       const db=req.result,tx=db.transaction('places','readwrite');
       for(const p of data)tx.objectStore('places').put(p);
       tx.oncomplete=()=>{db.close();resolve()};
       tx.onerror=()=>reject(tx.error);
     };
   });
 },fixture);
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [375,390]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true,serviceWorkers:'block'});
   const page=await context.newPage();page.setDefaultTimeout(35000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await seed(page);
   await page.goto(base+'journey-real-confirmed-20261118.html',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.__atlasJourneyRoute?.getState&&document.querySelectorAll('#places .place').length===4);
   await page.evaluate(()=>window.__atlasJourneyVisual?.setStep('places'));
   for(const title of ['沿海 A','沿海 C','沿海 B','沿海 D']){
    await page.locator('#places .place').filter({hasText:title}).click();
   }
   assert.equal((await page.evaluate(()=>window.__atlasJourneyRoute.getState())).selected.length,4);
   // This CI fixture puts all four actual test-DB points on D1; dates/times
   // are never changed by the recommended order itself.
   for(const id of ['qa-r-a','qa-r-c','qa-r-b','qa-r-d']){
    await page.evaluate(id=>{
     const row=document.querySelector('#chosen [data-stop-id="'+id+'"]');
     const day=row.querySelector('.day-picker');day.value='1';day.dispatchEvent(new Event('change',{bubbles:true}));
    },id);
   }
   await page.evaluate(()=>window.__atlasJourneyVisual.setStep('settings'));
   await page.locator('#originPlaceId').selectOption('qa-r-a');
   await page.locator('#destinationPlaceId').selectOption('qa-r-d');
   await page.locator('[data-route-mode="bike"]').click();
   await page.locator('#routeLegAdvanced summary').click();
   await page.locator('#routeLegModes select').first().selectOption('walk');
   const savedBefore=await page.evaluate(()=>window.__atlasJourneyRoute.getState());
   assert.equal(savedBefore.transportMode,'bike');
   assert.equal(savedBefore.originPlaceId,'qa-r-a');
   assert.equal(savedBefore.destinationPlaceId,'qa-r-d');
   await page.screenshot({path:out+'/settings-'+width+'.png'});
   await page.evaluate(()=>window.__atlasJourneyVisual.setStep('order'));
   const before=await page.evaluate(()=>window.__atlasJourneyRoute.getState().selected.map(s=>s.id));
   await page.locator('#autoArrange').click();
   assert.equal(await page.locator('#routeSuggestion:visible').count(),1);
   assert.deepEqual(await page.evaluate(()=>window.__atlasJourneyRoute.getState().selected.map(s=>s.id)),before,'recommendation must not mutate before approval');
   await page.locator('#routeSuggestion button').filter({hasText:'采用建议'}).click();
   const after=await page.evaluate(()=>window.__atlasJourneyRoute.getState().selected.map(s=>s.id));
   assert.notDeepEqual(after,before,'recommendation should improve tangled fixture');
   assert.deepEqual(after,['qa-r-a','qa-r-b','qa-r-c','qa-r-d']);
   await page.locator('#undoProposal').click();
   assert.deepEqual(await page.evaluate(()=>window.__atlasJourneyRoute.getState().selected.map(s=>s.id)),before);
   await page.screenshot({path:out+'/order-'+width+'.png'});
   // Save uses the same production MediaCore route repository as Footprint.
   await page.locator('#savePlan').click();
   await page.waitForFunction(()=>!!window.__atlasJourneyRoute.getState().id);
   const saved=await page.evaluate(()=>window.__atlasJourneyRoute.getState());
   assert.ok(saved.id);
   await page.locator('#generate').click();
   await page.waitForURL(/\/route-view-real-confirmed-20261118\.html\?saved=/,{timeout:30000});
   await page.waitForFunction(()=>!!document.getElementById('editRouteLink')&&!document.getElementById('editRouteLink').hidden,{timeout:20000});
   assert.equal(await page.locator('#editRouteLink:visible').count(),1);
   await page.screenshot({path:out+'/map-'+width+'.png'});
   await page.locator('#editRouteLink').click();
   await page.waitForURL(/\/journey-real-confirmed-20261118\.html\?edit=/,{timeout:20000});
   await page.waitForFunction(()=>window.__atlasJourneyRoute?.getState().selected.length===4,{timeout:30000});
   const restored=await page.evaluate(()=>window.__atlasJourneyRoute.getState());
   assert.equal(restored.id,saved.id);
   assert.equal(restored.transportMode,'bike');
   assert.equal(restored.originPlaceId,'qa-r-a');
   assert.equal(restored.destinationPlaceId,'qa-r-d');
   assert.deepEqual(restored.selected.map(s=>s.id),before);
   const realDb=await page.evaluate(async()=>new Promise((resolve,reject)=>{
     const r=indexedDB.open('atlas-v4-interaction-20261117-private-travel-footprints-v1',1);
     r.onsuccess=()=>{const db=r.result,q=db.transaction('places','readonly').objectStore('places').get('qa-r-a');
       q.onsuccess=()=>{resolve({note:q.result.note,count:q.result.photos?.length||0});db.close()};
       q.onerror=()=>reject(q.error)};
     r.onerror=()=>reject(r.error);
   }));
   assert.equal(realDb.note,'保留A的原始 Brief','saving route must not alter place notes');
   assert.equal(realDb.count,0);
   assert.equal(errors.length,0,'browser page errors: '+errors.join('; '));
   console.log('PASS '+width+'px real IndexedDB route: select, anchor, preview recommendation, undo, 4 modes, per-leg mode, save, map, edit, Brief unchanged');
   await context.close();
  }
 }finally{await browser.close()}
})().catch(err=>{console.error('FAIL real route integration:',err.stack||err);process.exitCode=1});
